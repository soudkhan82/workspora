"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const modules = [
  {
    title: "Projects",
    desc: "Track active projects, ownership, delivery status and timelines.",
    href: "/modules/contracts",
    stat: "Portfolio",
    icon: "📁",
  },
  {
    title: "Clients",
    desc: "Manage client records, contacts, contracts and assignments.",
    href: "/modules/contracts",
    stat: "Relationships",
    icon: "🤝",
  },
  {
    title: "Tasks",
    desc: "Monitor workflow tasks, stages, priorities and assigned teams.",
    href: "/modules/workflows",
    stat: "Execution",
    icon: "✅",
  },
  {
    title: "Purchase Orders",
    desc: "Control PO records, line items, procurement and approvals.",
    href: "/modules/purchase-orders",
    stat: "Procurement",
    icon: "🧾",
  },
  {
    title: "Invoices",
    desc: "Review invoices, milestones, collections and billing pipeline.",
    href: "/modules/invoices",
    stat: "Billing",
    icon: "💳",
  },
  {
    title: "KPIs",
    desc: "Measure progress, targets, performance and business outcomes.",
    href: "/modules/kpi",
    stat: "Performance",
    icon: "📊",
  },
];

type Counts = {
  projects: number;
  clients: number;
  tasks: number;
  purchaseOrders: number;
  invoices: number;
  kpis: number;
  contracts: number;
  bookings: number;
};

const emptyCounts: Counts = {
  projects: 0,
  clients: 0,
  tasks: 0,
  purchaseOrders: 0,
  invoices: 0,
  kpis: 0,
  contracts: 0,
  bookings: 0,
};

async function ensureWorkspace() {
  const { data, error } = await supabase.rpc("ensure_user_workspace");

  if (error) {
    console.error("Workspace creation/check failed:", error.message);
    throw error;
  }

  return data as string;
}

async function getCount(table: string, workspaceId: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error(`Count error for ${table}:`, error.message);
    return 0;
  }

  return count ?? 0;
}

export default function HomePage() {
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [counts, setCounts] = useState<Counts>(emptyCounts);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setAuthChecking(true);
        setLoadingData(true);
        setErrorText("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          router.replace("/auth/login");
          return;
        }

        const { data: workspaceId, error: workspaceError } = await supabase.rpc(
          "ensure_user_workspace",
        );

        if (workspaceError) {
          throw workspaceError;
        }

        if (!workspaceId) {
          throw new Error("Workspace could not be created.");
        }

        if (!mounted) return;

        setWorkspaceId(workspaceId);

        const [
          projects,
          clients,
          tasks,
          purchaseOrders,
          invoices,
          kpis,
          contracts,
          bookings,
        ] = await Promise.all([
          getCount("projects", workspaceId),
          getCount("clients", workspaceId),
          getCount("workflow_tasks", workspaceId),
          getCount("purchase_orders", workspaceId),
          getCount("invoices", workspaceId),
          getCount("kpis", workspaceId),
          getCount("contracts", workspaceId),
          getCount("bookings", workspaceId),
        ]);

        if (!mounted) return;

        setCounts({
          projects,
          clients,
          tasks,
          purchaseOrders,
          invoices,
          kpis,
          contracts,
          bookings,
        });
      } catch (err: any) {
        console.error("Landing page init failed:", err);

        if (mounted) {
          setErrorText(
            err?.message ||
              "Unable to prepare workspace. Please refresh or contact admin.",
          );
        }
      } finally {
        if (mounted) {
          setAuthChecking(false);
          setLoadingData(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [router]);

  const pulse = useMemo(() => {
    const pulseTotal =
      counts.projects +
        counts.tasks +
        counts.invoices +
        counts.purchaseOrders || 1;

    return [
      {
        label: "Projects",
        count: counts.projects,
        percent: Math.round((counts.projects / pulseTotal) * 100),
      },
      {
        label: "Tasks",
        count: counts.tasks,
        percent: Math.round((counts.tasks / pulseTotal) * 100),
      },
      {
        label: "Invoices",
        count: counts.invoices,
        percent: Math.round((counts.invoices / pulseTotal) * 100),
      },
      {
        label: "Purchase Orders",
        count: counts.purchaseOrders,
        percent: Math.round((counts.purchaseOrders / pulseTotal) * 100),
      },
    ];
  }, [counts]);

  if (authChecking || loadingData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl bg-slate-950 px-10 py-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-emerald-400" />
          <div className="text-base font-semibold text-white">
            Loading dashboard...
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Please wait while data is being fetched
          </div>
        </div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="text-lg font-extrabold text-red-700">
            Workspace setup failed
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{errorText}</p>

          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-8 py-10 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="mb-4 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
                Workspora Executive Workspace
              </div>

              <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
                One view for projects, clients, tasks and operations.
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 xl:text-base">
                Workspora gives your management team a clean executive summary
                of business modules including KPIs, bookings, contracts,
                workflows, invoices and purchase orders.
              </p>

              {workspaceId && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                  Active workspace ready
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  Open Dashboard
                </Link>

                <Link
                  href="/modules/workflows"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold hover:bg-slate-50"
                >
                  View Workflows
                </Link>
              </div>
            </div>

            <div className="relative min-h-[470px] overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white">
              <div className="absolute right-[-80px] top-[-80px] h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
              <div className="absolute bottom-[-80px] left-[-80px] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

              <div className="relative grid grid-cols-2 gap-4">
                <VisualCard
                  title="Projects"
                  value={String(counts.projects)}
                  sub="Active project records"
                />
                <VisualCard
                  title="Clients"
                  value={String(counts.clients)}
                  sub="Client master records"
                />
                <VisualCard
                  title="Tasks"
                  value={String(counts.tasks)}
                  sub="Workflow task records"
                />
                <VisualCard
                  title="POs"
                  value={String(counts.purchaseOrders)}
                  sub="Purchase order records"
                />
              </div>

              <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold">
                      Executive Pulse
                    </div>
                    <div className="text-xs text-slate-300">
                      Actual module records with relative share
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">
                    Live
                  </span>
                </div>

                <div className="space-y-4">
                  {pulse.map((item) => (
                    <PulseBar
                      key={item.label}
                      label={item.label}
                      count={item.count}
                      percent={item.percent}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Summary title="Projects" value={counts.projects} />
          <Summary title="Contracts" value={counts.contracts} />
          <Summary title="Bookings" value={counts.bookings} />
          <Summary title="KPIs" value={counts.kpis} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-2xl">
                  {m.icon}
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {m.stat}
                </span>
              </div>

              <h2 className="text-xl font-extrabold">{m.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{m.desc}</p>

              <div className="mt-5 text-sm font-bold text-emerald-700">
                Open module →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function VisualCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
      <div className="text-sm font-bold text-slate-300">{title}</div>
      <div className="mt-3 text-4xl font-extrabold">{value}</div>
      <div className="mt-2 text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function PulseBar({
  label,
  count,
  percent,
}: {
  label: string;
  count: number;
  percent: number;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-bold text-slate-200">
          {label} ({count})
        </span>
        <span className="text-slate-300">{percent}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-bold text-slate-600">{title}</div>
      <div className="mt-4 text-3xl font-extrabold">{value}</div>
    </div>
  );
}
