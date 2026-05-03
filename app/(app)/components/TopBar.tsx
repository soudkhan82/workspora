"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClientBrowser } from "@/app/lib/supabase/browser";

function getPageTitle(pathname: string) {
  if (pathname.includes("/modules/kpi")) return "KPI";
  if (pathname.includes("/modules/invoices")) return "Invoices";
  if (pathname.includes("/modules/contracts")) return "Contracts";
  if (pathname.includes("/modules/bookings")) return "Bookings";
  if (pathname.includes("/modules/purchase-orders")) return "Purchase Orders";
  if (pathname.includes("/modules/expenses")) return "Expenses";
  if (pathname.includes("/modules/workflows")) return "Workflows";
  if (pathname.includes("/workspaces")) return "Workspace";
  return "Dashboard";
}

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClientBrowser(), []);

  const [userName, setUserName] = useState("User");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);

      const metadataName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "User";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setUserName(profile?.full_name || metadataName);
    };

    loadUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{pageTitle}</h1>
        <p className="text-xs text-slate-500">Business management portal</p>
      </div>

      {isLoggedIn && (
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            {userName}
          </div>

          <button
            onClick={handleLogout}
            className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
