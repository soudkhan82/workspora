import Link from "next/link";
import Image from "next/image";
import TopBar from "./components/TopBar";
import MasterDataManager from "./components/MasterDataManager";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "KPI", href: "/modules/kpi" },
  { label: "Invoices", href: "/modules/invoices" },
  { label: "Contracts", href: "/modules/contracts" },
  { label: "Bookings", href: "/modules/bookings" },
  { label: "Purchase Orders", href: "/modules/purchase-orders" },
  { label: "Expenses", href: "/modules/expenses" },
  { label: "Workflows", href: "/modules/workflows" },
  { label: "Credits", href: "/modules/credits" },
];

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white shadow-md ring-1 ring-slate-200">
              <Image
                src="/logo.png"
                alt="Workspora logo"
                width={64}
                height={64}
                priority
                className="h-14 w-14 object-contain"
              />
            </div>

            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-extrabold tracking-tight text-slate-950">
                Workspora
              </h2>

              <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Effortless Flow
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-[1500px] items-center justify-end">
            <MasterDataManager />
          </div>
        </div>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
