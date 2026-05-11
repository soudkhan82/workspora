import Link from "next/link";

const modules = [
  {
    title: "KPI Tracking",
    href: "/modules/kpi",
    desc: "Track goals, KPIs, and team performance.",
  },
  {
    title: "Invoices",
    href: "/modules/invoices",
    desc: "Create and manage customer invoices.",
  },
  {
    title: "Contracts",
    href: "/modules/contracts",
    desc: "Store and review business contracts.",
  },
  {
    title: "Bookings",
    href: "/modules/bookings",
    desc: "Manage appointments and reservations.",
  },
  {
    title: "Purchase Orders",
    href: "/modules/purchase-orders",
    desc: "Create and manage vendor purchase orders.",
  },
  {
    title: "Expenses",
    href: "/modules/expenses",
    desc: "Monitor costs and business spending.",
  },
  {
    title: "Workflows",
    href: "/modules/workflows",
    desc: "Automate routine business processes.",
  },
  {
    title: "Credits",
    href: "/modules/credits",
    desc: "Manage credits and adjustment records.",
  },
];

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-green-600">
          Welcome to Workspora
        </p>

        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Business Workspace Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Manage KPIs, invoices, contracts, bookings, purchase orders,
              expenses, credits, and workflows from one modular SaaS platform.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Modules" value="8" />
        <StatCard title="Workspace Status" value="Ready" />
        <StatCard title="Pending Tasks" value="0" />
        <StatCard title="System Health" value="Good" />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Modules</h2>
            <p className="text-sm text-slate-500">
              Start setting up your business tools.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-green-700">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.desc}
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  Setup
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
