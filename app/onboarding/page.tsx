"use client";

import { useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function OnboardingPage() {
  const supabase = createClientBrowser();

  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      alert("Please enter workspace name");
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Please login first");
      window.location.href = "/auth/login";
      return;
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email,
    });

    const slug = `${slugify(workspaceName)}-${user.id.slice(0, 6)}`;

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .insert({
        name: workspaceName,
        slug,
        owner_id: user.id,
      })
      .select()
      .single();

    if (workspaceError) {
      alert(workspaceError.message);
      setLoading(false);
      return;
    }

    await supabase.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });

    const { data: modules } = await supabase
      .from("modules")
      .select("module_key")
      .eq("is_active", true);

    if (modules?.length) {
      await supabase.from("workspace_modules").insert(
        modules.map((m) => ({
          workspace_id: workspace.id,
          module_key: m.module_key,
          is_enabled: true,
        })),
      );
    }

    window.location.href = "/dashboard";
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">
          Create your workspace
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Set up your business workspace to start using Workspora.
        </p>

        <div className="mt-6">
          <label className="text-sm font-medium text-slate-700">
            Workspace Name
          </label>

          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Example: ABC Traders"
            className="mt-2 w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
          />
        </div>

        <button
          onClick={handleCreateWorkspace}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating workspace..." : "Create Workspace"}
        </button>
      </div>
    </main>
  );
}
