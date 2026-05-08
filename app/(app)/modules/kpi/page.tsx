"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

type KPI = {
  id: string;
  title: string;
  category: string | null;
  target_value: number;
  current_value: number;
  unit: string | null;
  status: string;
  due_date: string | null;
  detail: string | null;
  created_at: string;
  workspace_id?: string | null;
  created_by?: string | null;
};

type KpiCategory = {
  id: number;
  name: string;
};

type WorkspaceContext = {
  userId: string;
  workspaceId: string;
};

const FALLBACK_CATEGORIES = [
  "Sales",
  "Marketing",
  "Finance",
  "Operations",
  "Customer Support",
  "HR",
  "Productivity",
  "Growth",
  "Other",
];

const KPI_UNITS = [
  "PKR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SAR",
  "CAD",
  "JPY",
  "SGD",
  "AUD",
  "OMR",
  "%",
  "Count",
  "Users",
  "Hours",
  "Days",
  "Tasks",
];

export default function KPIPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [sortKey, setSortKey] = useState<keyof KPI>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [categories, setCategories] = useState<KpiCategory[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [ctx, setCtx] = useState<WorkspaceContext | null>(null);
  const [contextError, setContextError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null);

  const [form, setForm] = useState({
    title: "",
    category: "",
    target_value: "",
    current_value: "",
    unit: "PKR",
    status: "active",
    due_date: "",
    detail: "",
  });

  useEffect(() => {
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
    if (ctx?.userId && ctx?.workspaceId) return ctx;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setContextError(userError.message);
      return null;
    }

    if (!user) {
      setContextError("User not authenticated. Please login again.");
      return null;
    }

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id,status")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      setContextError(membershipError.message);
      return null;
    }

    if (!membership?.workspace_id) {
      setContextError("No active workspace found for this user.");
      return null;
    }

    if (
      membership.status &&
      String(membership.status).toLowerCase() !== "active"
    ) {
      setContextError("Your workspace membership is not active.");
      return null;
    }

    const nextCtx = {
      userId: user.id,
      workspaceId: String(membership.workspace_id),
    };

    setCtx(nextCtx);
    setContextError("");
    return nextCtx;
  }

  async function loadInitialData() {
    setLoading(true);

    const currentCtx = await getWorkspaceContext();

    if (!currentCtx) {
      setKpis([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    await Promise.all([fetchKpis(currentCtx), loadCategories()]);
    setLoading(false);
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/kpi/categories", { cache: "no-store" });
      const data = await res.json();

      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        setCategories([]);
        if (data.error)
          console.error("Failed to load KPI categories:", data.error);
      }
    } catch (error) {
      console.error("Failed to load KPI categories:", error);
      setCategories([]);
    }
  }

  async function seedFallbackCategories() {
    for (const name of FALLBACK_CATEGORIES) {
      await fetch("/api/kpi/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).catch(() => null);
    }

    await loadCategories();
  }

  function handleSort(key: keyof KPI) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  async function fetchKpis(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("kpis")
      .select("*")
      .eq("workspace_id", scopedCtx.workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setKpis([]);
      return;
    }

    setKpis((data ?? []) as KPI[]);
  }

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      title: "",
      category: "",
      target_value: "",
      current_value: "",
      unit: "PKR",
      status: "active",
      due_date: "",
      detail: "",
    });
  }

  async function saveKpi(e: React.FormEvent) {
    e.preventDefault();

    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!form.title.trim()) return alert("Please enter KPI title");
    if (!form.category) return alert("Please select KPI category");

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      category: form.category,
      target_value: Number(form.target_value || 0),
      current_value: Number(form.current_value || 0),
      unit: form.unit,
      status: form.status,
      due_date: form.due_date || null,
      detail: form.detail.trim() || null,
    };

    const result = editingId
      ? await supabase
          .from("kpis")
          .update(payload)
          .eq("id", editingId)
          .eq("workspace_id", currentCtx.workspaceId)
      : await supabase.from("kpis").insert({
          ...payload,
          workspace_id: currentCtx.workspaceId,
          created_by: currentCtx.userId,
        });

    setSaving(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    resetForm();
    await fetchKpis(currentCtx);
  }

  function startEdit(item: KPI) {
    setEditingId(item.id);
    setForm({
      title: item.title || "",
      category: item.category || "",
      target_value: String(item.target_value ?? ""),
      current_value: String(item.current_value ?? ""),
      unit: item.unit || "PKR",
      status: item.status || "active",
      due_date: item.due_date || "",
      detail: item.detail || "",
    });
  }

  async function deleteKpi(id: string) {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!confirm("Are you sure you want to delete this KPI?")) return;

    const { error } = await supabase
      .from("kpis")
      .delete()
      .eq("id", id)
      .eq("workspace_id", currentCtx.workspaceId);

    if (error) {
      alert(error.message);
      return;
    }

    await fetchKpis(currentCtx);
  }

  function downloadKpiTemplate() {
    const csv = [
      "title,category,target_value,current_value,unit,status,due_date,detail",
      "Monthly Revenue,Sales,100000,25000,PKR,active,2026-04-30,Track monthly revenue against target",
      "Customer Acquisition,Marketing,500,320,Users,active,2026-05-15,Track new customer acquisition",
      "Website Conversion Rate,Growth,5,2.5,%,paused,2026-06-01,Track website lead conversion rate",
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kpi-upload-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return headers.reduce<Record<string, string>>((obj, header, index) => {
        obj[header] = values[index] || "";
        return obj;
      }, {});
    });
  }

  async function uploadKpiCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploading(true);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      const payload = rows
        .filter((row) => row.title)
        .map((row) => ({
          title: row.title,
          category: row.category || "Other",
          target_value: Number(row.target_value || 0),
          current_value: Number(row.current_value || 0),
          unit: row.unit || "PKR",
          status: row.status || "active",
          due_date: row.due_date || null,
          detail: row.detail || null,
          workspace_id: currentCtx.workspaceId,
          created_by: currentCtx.userId,
        }));

      if (!payload.length) return alert("No valid KPI records found.");

      const { error } = await supabase.from("kpis").insert(payload);

      if (error) {
        alert(error.message);
        return;
      }

      await fetchKpis(currentCtx);
      alert(`${payload.length} KPI records uploaded successfully.`);
    } finally {
      setBulkUploading(false);
      e.target.value = "";
    }
  }

  const dropdownCategories = useMemo(() => {
    const dbCategories = categories.map((x) => x.name);
    const existingKpiCategories = kpis
      .map((x) => x.category)
      .filter(Boolean) as string[];

    return Array.from(
      new Set([
        ...dbCategories,
        ...existingKpiCategories,
        ...FALLBACK_CATEGORIES,
      ]),
    ).sort((a, b) => a.localeCompare(b));
  }, [categories, kpis]);

  const filteredKpis = useMemo(() => {
    const filtered = kpis.filter((item) => {
      const searchText = `${item.title} ${item.category || ""} ${
        item.status || ""
      } ${item.detail || ""}`.toLowerCase();

      return searchText.includes(search.toLowerCase());
    });

    return [...filtered].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (sortKey === "current_value") {
        const aProgress =
          Number(a.target_value) > 0
            ? (Number(a.current_value) / Number(a.target_value)) * 100
            : 0;

        const bProgress =
          Number(b.target_value) > 0
            ? (Number(b.current_value) / Number(b.target_value)) * 100
            : 0;

        return sortDirection === "asc"
          ? aProgress - bProgress
          : bProgress - aProgress;
      }

      if (sortKey === "target_value") {
        return sortDirection === "asc"
          ? Number(a.target_value) - Number(b.target_value)
          : Number(b.target_value) - Number(a.target_value);
      }

      return sortDirection === "asc"
        ? String(aValue || "").localeCompare(String(bValue || ""))
        : String(bValue || "").localeCompare(String(aValue || ""));
    });
  }, [kpis, search, sortKey, sortDirection]);

  const stats = useMemo(() => {
    const total = kpis.length;
    const active = kpis.filter((x) => x.status === "active").length;
    const completed = kpis.filter(
      (x) =>
        Number(x.target_value) > 0 &&
        Number(x.current_value) >= Number(x.target_value),
    ).length;

    const avgProgress =
      total === 0
        ? 0
        : Math.round(
            kpis.reduce((sum, item) => {
              const target = Number(item.target_value || 0);
              const current = Number(item.current_value || 0);
              const progress = target > 0 ? (current / target) * 100 : 0;
              return sum + Math.min(progress, 100);
            }, 0) / total,
          );

    return { total, active, completed, avgProgress };
  }, [kpis]);

  return (
    <div className="min-h-screen bg-[#eef3f8] p-6">
      {contextError ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {contextError}
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-green-600">KPI Tracking</p>

        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              KPI Management Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create, upload, monitor, and manage company KPIs.
            </p>
          </div>

          <button
            onClick={() => loadInitialData()}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
          >
            Refresh Data
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total KPIs" value={stats.total} />
        <StatCard title="Active KPIs" value={stats.active} />
        <StatCard title="Completed" value={stats.completed} />
        <StatCard title="Avg Progress" value={`${stats.avgProgress}%`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={saveKpi}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-950">
            {editingId ? "Edit KPI" : "Add New KPI"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add KPI target, current value, detail, and due date.
          </p>

          <div className="mt-5 space-y-4">
            <Input
              placeholder="KPI title"
              value={form.title}
              onChange={(v) => updateForm("title", v)}
            />

            <div className="flex gap-2">
              <select
                value={form.category}
                onChange={(e) => updateForm("category", e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
              >
                <option value="">Select Category</option>
                {dropdownCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                Manage
              </button>
            </div>

            {categories.length === 0 && (
              <button
                type="button"
                onClick={seedFallbackCategories}
                className="w-full rounded-xl border border-dashed border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 hover:bg-green-100"
              >
                Create Default Categories
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Target"
                value={form.target_value}
                onChange={(v) => updateForm("target_value", v)}
              />

              <Input
                type="number"
                placeholder="Current"
                value={form.current_value}
                onChange={(v) => updateForm("current_value", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.unit}
                onChange={(e) => updateForm("unit", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
              >
                {KPI_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>

              <Input
                type="date"
                value={form.due_date}
                onChange={(v) => updateForm("due_date", v)}
              />
            </div>

            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>

            <textarea
              value={form.detail}
              onChange={(e) => updateForm("detail", e.target.value)}
              placeholder="KPI detail, notes, definition, or business explanation"
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
            />

            <button
              type="submit"
              disabled={saving || !!contextError}
              className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Update KPI" : "Add KPI"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">KPI List</h2>
                <p className="text-sm text-slate-500">
                  Click any KPI row to view full details.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={downloadKpiTemplate}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  Download CSV Template
                </button>

                <label className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-center text-sm font-bold text-white hover:bg-green-700">
                  {bulkUploading ? "Uploading..." : "Upload CSV"}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={uploadKpiCsv}
                    disabled={bulkUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search KPI..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-green-500 sm:w-80"
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">
              Loading KPIs...
            </div>
          ) : filteredKpis.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">
              No KPIs found.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="w-[40%] px-4 py-3">
                      <SortButton
                        label="KPI"
                        column="title"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[18%] px-4 py-3">
                      <SortButton
                        label="Progress"
                        column="current_value"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[14%] px-4 py-3">
                      <SortButton
                        label="Status"
                        column="status"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[14%] px-4 py-3">
                      <SortButton
                        label="Due Date"
                        column="due_date"
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
              </table>

              <div className="max-h-[680px] overflow-y-auto">
                <table className="w-full table-fixed text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {filteredKpis.map((item) => {
                      const target = Number(item.target_value || 0);
                      const current = Number(item.current_value || 0);
                      const progress =
                        target > 0
                          ? Math.min(Math.round((current / target) * 100), 100)
                          : 0;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedKpi(item)}
                          className="cursor-pointer bg-white hover:bg-slate-50"
                        >
                          <td className="w-[40%] px-4 py-4">
                            <div className="font-bold text-slate-950">
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.category || "General"} · Current:{" "}
                              {formatKpiValue(current, item.unit)} / Target:{" "}
                              {formatKpiValue(target, item.unit)}
                            </div>
                          </td>

                          <td className="w-[18%] px-4 py-4">
                            <div className="mb-1 text-xs font-semibold text-slate-600">
                              {progress}%
                            </div>
                            <div className="h-2 w-36 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-green-600"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>

                          <td className="w-[14%] px-4 py-4">
                            <StatusBadge status={item.status} />
                          </td>

                          <td className="w-[14%] px-4 py-4 text-slate-600">
                            {item.due_date || "-"}
                          </td>

                          <td className="w-[14%] px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(item);
                                }}
                                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteKpi(item.id);
                                }}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <CategoryManagerModal
        open={categoryModalOpen}
        categories={categories}
        onClose={() => setCategoryModalOpen(false)}
        onRefresh={loadCategories}
      />

      {selectedKpi && (
        <KpiDetailsModal
          kpi={selectedKpi}
          onClose={() => setSelectedKpi(null)}
        />
      )}
    </div>
  );
}

function CategoryManagerModal({
  open,
  categories,
  onClose,
  onRefresh,
}: {
  open: boolean;
  categories: KpiCategory[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function addCategory() {
    const name = newName.trim();
    if (!name) return alert("Please enter category name");

    setLoading(true);
    try {
      const res = await fetch("/api/kpi/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to add category");
        return;
      }

      setNewName("");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function updateCategory(id: number) {
    const name = editingName.trim();
    if (!name) return alert("Please enter category name");

    setLoading(true);
    try {
      const res = await fetch("/api/kpi/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update category");
        return;
      }

      setEditingId(null);
      setEditingName("");
      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm("Delete this category?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/kpi/categories?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete category");
        return;
      }

      await onRefresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Manage KPI Categories
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add, rename, or delete your KPI categories.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCategory();
            }}
            placeholder="New category name"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
          />

          <button
            type="button"
            onClick={addCategory}
            disabled={loading}
            className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
          >
            Add
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
          {categories.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No categories found.
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                {editingId === cat.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                ) : (
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                    {cat.name}
                  </span>
                )}

                <div className="flex shrink-0 gap-2">
                  {editingId === cat.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => updateCategory(cat.id)}
                        disabled={loading}
                        className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-100 disabled:opacity-60"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    disabled={loading}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
    </div>
  );
}

function SortButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  column: keyof KPI;
  sortKey: keyof KPI;
  sortDirection: "asc" | "desc";
  onSort: (key: keyof KPI) => void;
}) {
  const active = sortKey === column;

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="flex items-center gap-1 font-bold uppercase text-slate-500 hover:text-green-700"
    >
      {label}
      <span className="text-[10px]">
        {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? "bg-blue-50 text-blue-700"
      : status === "paused"
        ? "bg-orange-50 text-orange-700"
        : "bg-green-50 text-green-700";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles}`}>
      {status}
    </span>
  );
}

function KpiDetailsModal({ kpi, onClose }: { kpi: KPI; onClose: () => void }) {
  const target = Number(kpi.target_value || 0);
  const current = Number(kpi.current_value || 0);
  const progress =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-semibold text-green-600">KPI Details</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {kpi.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {kpi.category || "General"} · {kpi.status}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <ModalCard
            title="Current"
            value={formatKpiValue(current, kpi.unit)}
          />
          <ModalCard title="Target" value={formatKpiValue(target, kpi.unit)} />
          <ModalCard title="Progress" value={`${progress}%`} />
          <ModalCard title="Due Date" value={kpi.due_date || "-"} />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm font-semibold text-slate-600">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-green-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <h3 className="font-bold text-slate-950">KPI Detail</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {kpi.detail || "No detail added for this KPI."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ModalCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <h3 className="mt-2 text-lg font-bold text-slate-950">{value}</h3>
    </div>
  );
}

function formatKpiValue(value: number, unit?: string | null) {
  const formatted = Number(value).toLocaleString();
  const safeUnit = unit || "";

  if (safeUnit === "PKR" || safeUnit === "Rs")
    return `${safeUnit} ${formatted}`;
  if (safeUnit === "%") return `${formatted}%`;
  if (!safeUnit) return formatted;

  return `${formatted} ${safeUnit}`;
}
