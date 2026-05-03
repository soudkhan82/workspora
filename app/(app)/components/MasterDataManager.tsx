"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type TabKey = "clients" | "projects" | "vendors" | "contacts" | "members";

type AnyRow = Record<string, any>;

const tabs: { key: TabKey; label: string; table: string; note: string }[] = [
  {
    key: "clients",
    label: "Clients",
    table: "clients",
    note: "Global clients",
  },
  {
    key: "projects",
    label: "Projects",
    table: "projects",
    note: "Global projects",
  },
  {
    key: "vendors",
    label: "Vendors",
    table: "vendors",
    note: "Global vendors",
  },
  {
    key: "contacts",
    label: "Contacts",
    table: "contacts",
    note: "Global contacts",
  },
  {
    key: "members",
    label: "Members",
    table: "contacts",
    note: "Members are managed from public.contacts",
  },
];

const emptyForms: Record<TabKey, AnyRow> = {
  clients: { name: "" },
  projects: { name: "" },
  vendors: { name: "" },
  contacts: {
    full_name: "",
    email: "",
    phone: "",
    designation: "",
    company: "",
    department: "",
    status: "active",
    notes: "",
  },
  members: {
    full_name: "",
    email: "",
    phone: "",
    designation: "",
    company: "",
    department: "Operations",
    status: "active",
    notes: "",
  },
};

export default function MasterDataManager() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [form, setForm] = useState<AnyRow>({ ...emptyForms.contacts });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeMeta = useMemo(
    () => tabs.find((t) => t.key === activeTab)!,
    [activeTab],
  );

  useEffect(() => {
    if (open) loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  async function loadRows() {
    setLoading(true);

    const selectQuery =
      activeTab === "contacts" || activeTab === "members"
        ? "id,full_name,email,phone,designation,company,department,status,notes,created_at"
        : "id,name,created_at";

    const { data, error } = await supabase
      .from(activeMeta.table)
      .select(selectQuery)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRows(data || []);
    resetForm(false);
  }

  function resetForm(clearEdit = true) {
    setForm({ ...emptyForms[activeTab] });
    if (clearEdit) setEditingId(null);
  }

  function changeTab(tab: TabKey) {
    setActiveTab(tab);
    setForm({ ...emptyForms[tab] });
    setEditingId(null);
    setRows([]);
  }

  function startEdit(row: AnyRow) {
    setEditingId(row.id);
    setForm({
      ...emptyForms[activeTab],
      ...row,
    });
  }

  async function saveRow() {
    if (activeTab === "contacts" || activeTab === "members") {
      if (!String(form.full_name || "").trim()) {
        alert("Full name is required.");
        return;
      }
    } else if (!String(form.name || "").trim()) {
      alert("Name is required.");
      return;
    }

    setSaving(true);

    const payload: AnyRow =
      activeTab === "contacts" || activeTab === "members"
        ? {
            full_name: String(form.full_name || "").trim(),
            email: form.email || null,
            phone: form.phone || null,
            designation: form.designation || null,
            company: form.company || null,
            department: form.department || null,
            status: form.status || "active",
            notes: form.notes || null,
          }
        : {
            name: String(form.name || "").trim(),
          };

    const result = editingId
      ? await supabase
          .from(activeMeta.table)
          .update(payload)
          .eq("id", editingId)
      : await supabase.from(activeMeta.table).insert(payload);

    setSaving(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    await loadRows();
    resetForm();
  }

  function uniqueOptions(field: string) {
    return Array.from(
      new Set(
        rows.map((row) => String(row[field] || "").trim()).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }

  async function deleteRow(row: AnyRow) {
    const label = row.full_name || row.name || "this record";
    const ok = window.confirm(`Delete ${label}?`);
    if (!ok) return;

    const { error } = await supabase
      .from(activeMeta.table)
      .delete()
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadRows();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-auto items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        Master Data
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  Global Master Data
                </p>
                <h2 className="text-2xl font-bold text-slate-950">
                  Clients, Projects, Vendors, Contacts & Members
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Contacts and Members now use <b>public.contacts</b> as the
                  single source.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="grid max-h-[75vh] grid-cols-1 overflow-y-auto lg:grid-cols-[260px_1fr]">
              <aside className="border-r border-slate-200 bg-slate-50 p-5">
                <div className="space-y-2">
                  {tabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.key}
                      onClick={() => changeTab(tab.key)}
                      className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                        activeTab === tab.key
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="block">{tab.label}</span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          activeTab === tab.key
                            ? "text-slate-300"
                            : "text-slate-400"
                        }`}
                      >
                        {tab.note}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              <main className="p-6">
                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">
                        {editingId ? "Modify" : "Add"} {activeMeta.label}
                      </h3>
                      <p className="text-sm text-slate-500">
                        Table: {activeMeta.table}
                      </p>
                    </div>

                    {editingId && (
                      <button
                        type="button"
                        onClick={() => resetForm()}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {activeTab === "contacts" || activeTab === "members" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Input
                        label="Full Name"
                        value={form.full_name || ""}
                        onChange={(v) => setForm({ ...form, full_name: v })}
                      />
                      <Input
                        label="Email"
                        value={form.email || ""}
                        onChange={(v) => setForm({ ...form, email: v })}
                      />
                      <Input
                        label="Phone"
                        value={form.phone || ""}
                        onChange={(v) => setForm({ ...form, phone: v })}
                      />
                      <EditableDropdown
                        label="Designation"
                        value={form.designation || ""}
                        options={uniqueOptions("designation")}
                        placeholder="Select or type designation"
                        onChange={(v) => setForm({ ...form, designation: v })}
                      />
                      <EditableDropdown
                        label="Company"
                        value={form.company || ""}
                        options={uniqueOptions("company")}
                        placeholder="Select or type company"
                        onChange={(v) => setForm({ ...form, company: v })}
                      />
                      <EditableDropdown
                        label="Department"
                        value={form.department || ""}
                        options={uniqueOptions("department")}
                        placeholder="Select or type department"
                        onChange={(v) => setForm({ ...form, department: v })}
                      />
                      <Select
                        label="Status"
                        value={form.status || "active"}
                        onChange={(v) => setForm({ ...form, status: v })}
                        options={[
                          { value: "active", label: "Active" },
                          { value: "inactive", label: "Inactive" },
                          { value: "paused", label: "Paused" },
                        ]}
                      />
                      <Input
                        label="Notes"
                        value={form.notes || ""}
                        onChange={(v) => setForm({ ...form, notes: v })}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Input
                        label="Name"
                        value={form.name || ""}
                        onChange={(v) => setForm({ ...form, name: v })}
                      />
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={saveRow}
                      disabled={saving}
                      className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : editingId ? "Update" : "Add"}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="text-lg font-bold text-slate-950">
                      Existing {activeMeta.label}
                    </h3>
                  </div>

                  {loading ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      Loading records...
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No records found.
                    </div>
                  ) : (
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-white">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            {(activeTab === "contacts" ||
                              activeTab === "members") && (
                              <>
                                <th className="px-4 py-3">Email / Phone</th>
                                <th className="px-4 py-3">Designation</th>
                                <th className="px-4 py-3">Company</th>
                              </>
                            )}
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {row.full_name || row.name}
                              </td>

                              {(activeTab === "contacts" ||
                                activeTab === "members") && (
                                <>
                                  <td className="px-4 py-3 text-slate-600">
                                    {row.email || "-"}
                                    <br />
                                    <span className="text-xs">
                                      {row.phone || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {row.designation || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {row.company || "-"}
                                  </td>
                                </>
                              )}

                              <td className="px-4 py-3">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {row.status || "active"}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="mr-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRow(row)}
                                  className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
    </label>
  );
}

function EditableDropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-options`;

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        list={listId}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
      >
        {options.map((opt) => (
          <option key={opt.value || "empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
