"use client";

import { useAppStore } from "@/app/lib/store/useAppStore";

export default function LoadingOverlay() {
  const loading = useAppStore((s) => s.loading);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[280px] rounded-2xl border border-slate-700 bg-[#050505] px-6 py-5 text-center shadow-2xl">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-green-500" />
        <p className="mt-4 text-sm font-bold text-white">
          Loading dashboard...
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Please wait while data is being fetched.
        </p>
      </div>
    </div>
  );
}
