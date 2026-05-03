import Link from "next/link";
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
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-emerald-600">Workspora</h2>
          <p className="mt-1 text-xs text-slate-500">Modular SaaS Workspace</p>
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
