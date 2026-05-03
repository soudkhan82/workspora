"use client";

import { useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";
import { useAppStore } from "@/app/lib/store/useAppStore";

export default function LoginPage() {
  const supabase = createClientBrowser();
  const setGlobalLoading = useAppStore((s) => s.setLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const routeUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setGlobalLoading(false);

    if (!user) {
      alert("Login failed. Please try again.");
      return;
    }

    window.location.href = "/dashboard";
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setGlobalLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setGlobalLoading(false);
      alert(error.message);
      return;
    }

    await routeUser();
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setGlobalLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setGlobalLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/dashboard";
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">Login</h1>

        <p className="mt-2 text-sm text-slate-500">
          Access your Workspora portal
        </p>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email address"
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-green-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={handleSignIn}
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700"
          >
            Sign In
          </button>

          <button
            onClick={handleSignUp}
            className="w-full rounded-lg border px-4 py-3 font-medium text-slate-800 hover:bg-slate-50"
          >
            Create Account
          </button>
        </div>
      </div>
    </main>
  );
}
