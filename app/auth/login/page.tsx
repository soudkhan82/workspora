"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/app/lib/supabase/browser";
import { useAppStore } from "@/app/lib/store/useAppStore";

type Slide = {
  title: string;
  subtitle: string;
  image: string;
};

const POST_LOGIN_ROUTE = "/dashboard";
// If your actual dashboard route is app/page.tsx, change this to:
// const POST_LOGIN_ROUTE = "/";

const slides: Slide[] = [
  {
    title: "Executive Workspace",
    subtitle:
      "Manage KPIs, invoices, contracts, bookings and purchase orders in one place.",
    image: "/login/workspora-slide-1.png",
  },
  {
    title: "Operational Control",
    subtitle: "Track people, vendors, projects and approvals without clutter.",
    image: "/login/workspora-slide-2.png",
  },
  {
    title: "Business Intelligence",
    subtitle:
      "See executive metrics, trends, forecasts and financial health at a glance.",
    image: "/login/workspora-slide-3.png",
  },
];

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Session check timeout"));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientBrowser(), []);
  const setGlobalLoading = useAppStore((s) => s.setLoading);

  const mountedRef = useRef(true);
  const sessionCheckedRef = useRef(false);
  const routingRef = useRef(false);

  const [activeSlide, setActiveSlide] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function routeUser() {
    if (routingRef.current) return;

    routingRef.current = true;

    try {
      router.replace(POST_LOGIN_ROUTE);
    } finally {
      if (mountedRef.current) {
        setGlobalLoading(false);
      }
    }
  }

  useEffect(() => {
    if (sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;

    let cancelled = false;

    async function checkExistingSession() {
      setCheckingSession(true);

      try {
        const result = await withTimeout(supabase.auth.getSession(), 2500);

        if (cancelled) return;

        const session = result?.data?.session;

        if (session?.user) {
          router.replace(POST_LOGIN_ROUTE);
          return;
        }
      } catch {
        // Do not block login page if session check fails.
      } finally {
        if (!cancelled && mountedRef.current) {
          setCheckingSession(false);
          setGlobalLoading(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, [router, supabase, setGlobalLoading]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) return;

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter email and password.");
      return;
    }

    setSubmitting(true);
    setCheckingSession(false);
    setErrorMessage("");
    setGlobalLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Invalid login credentials.");
        return;
      }

      await routeUser();
    } catch {
      setErrorMessage(
        "Unable to sign in. Please check Supabase URL, anon key, and network connection.",
      );
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setCheckingSession(false);
        setGlobalLoading(false);
      }
    }
  }

  async function handleGoogleLogin() {
    if (submitting) return;

    setSubmitting(true);
    setCheckingSession(false);
    setErrorMessage("");
    setGlobalLoading(true);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message || "Google login failed.");
        setSubmitting(false);
        setGlobalLoading(false);
      }
    } catch {
      setErrorMessage(
        "Unable to start Google login. Please check Supabase Google OAuth configuration.",
      );
      setSubmitting(false);
      setGlobalLoading(false);
    }
  }
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dcfce7_0,#f8fafc_32%,#ffffff_74%)] text-slate-950">
      <section className="flex min-h-screen w-full items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid h-[calc(100vh-56px)] min-h-[610px] w-full max-w-[1380px] items-center gap-7 lg:grid-cols-[minmax(0,1.08fr)_420px] xl:gap-8">
          {/* LEFT PREVIEW / CAROUSEL */}
          <div className="hidden h-full min-h-0 lg:block">
            <div className="flex h-full min-h-0 flex-col rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-2xl shadow-emerald-100/70 backdrop-blur-xl">
              <div className="min-h-0 flex-1 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-slate-50">
                <div className="flex h-full min-h-[360px] w-full items-center justify-center overflow-hidden p-3">
                  <img
                    src={slides[activeSlide].image}
                    alt={slides[activeSlide].title}
                    className="h-full w-full max-w-full select-none object-contain"
                    draggable={false}
                  />
                </div>
              </div>

              <div className="mt-4 shrink-0 rounded-[1.5rem] bg-slate-950 px-6 py-5 text-white shadow-xl">
                <div className="flex items-center justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
                      Workspora
                    </p>

                    <h2 className="mt-1 truncate text-xl font-semibold tracking-tight">
                      {slides[activeSlide].title}
                    </h2>

                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                      {slides[activeSlide].subtitle}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {slides.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveSlide(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          index === activeSlide
                            ? "w-9 bg-emerald-400"
                            : "w-2.5 bg-white/30 hover:bg-white/50"
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT LOGIN */}
          <div className="mx-auto flex w-full max-w-[420px] items-center lg:h-full lg:max-w-none">
            <div className="w-full rounded-[2rem] border border-slate-200 bg-white/92 p-6 shadow-2xl shadow-slate-200/70 backdrop-blur-xl sm:p-7">
              {/* MOBILE PREVIEW */}
              <div className="mb-5 block lg:hidden">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex h-[230px] w-full items-center justify-center overflow-hidden p-2">
                    <img
                      src={slides[activeSlide].image}
                      alt={slides[activeSlide].title}
                      className="h-full w-full max-w-full select-none object-contain"
                      draggable={false}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveSlide(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === activeSlide
                          ? "w-7 bg-emerald-500"
                          : "w-2 bg-slate-300"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-4 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Workspace Control Center
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Sign in to Workspora
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Access your workspace dashboard, modules, members, clients,
                  projects and executive reports.
                </p>
              </div>

              {errorMessage ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              {checkingSession ? (
                <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Checking existing session...
                </div>
              ) : null}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue with Google
              </button>

              <p className="mt-6 text-center text-xs leading-5 text-slate-400">
                Protected workspace access for Workspora modules.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
