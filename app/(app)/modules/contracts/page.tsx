"use client";

import { useEffect, useMemo, useState } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type DropdownItem = {
  id: number;
  name: string;
};

type Contract = {
  id: number;
  contract_no: string;
  client_id: number | null;
  vendor_id: number | null;
  project_id: number | null;
  global_client_id?: number | null;
  global_vendor_id?: number | null;
  global_project_id?: number | null;
  contract_type_id: number | null;
  status_id: number | null;
  contract_value: number;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_date: string | null;
  notes: string | null;

  client_name?: string | null;
  vendor_name?: string | null;
  project_name?: string | null;
  type_name?: string | null;
  status_name?: string | null;
};

type DropdownType = "client" | "vendor" | "project" | "type" | "status";

const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CNY"];

const emptyForm = {
  contract_no: "",
  client_id: "",
  vendor_id: "",
  project_id: "",
  contract_type_id: "",
  status_id: "",
  contract_value: "",
  currency: "PKR",
  start_date: "",
  end_date: "",
  signed_date: "",
  notes: "",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [vendors, setVendors] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [types, setTypes] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [manageType, setManageType] = useState<DropdownType | null>(null);
  const [manageName, setManageName] = useState("");
  const [manageEditId, setManageEditId] = useState<number | null>(null);

  async function supabaseFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async function loadDropdowns() {
    const [clientData, vendorData, projectData, typeData, statusData] =
      await Promise.all([
        supabaseFetch("clients?select=id,name&order=name.asc"),
        supabaseFetch("vendors?select=id,name&order=name.asc"),
        supabaseFetch("projects?select=id,name&order=name.asc"),
        supabaseFetch("contract_types?select=id,name&order=name.asc"),
        supabaseFetch("contract_statuses?select=id,name&order=name.asc"),
      ]);

    setClients(clientData || []);
    setVendors(vendorData || []);
    setProjects(projectData || []);
    setTypes(typeData || []);
    setStatuses(statusData || []);
  }

  async function loadContracts() {
    const data = await supabaseFetch(
      `contracts?select=*,clients!global_client_id(name),vendors!global_vendor_id(name),projects!global_project_id(name),contract_types(name),contract_statuses(name)&order=id.desc`,
    );

    const mapped = (data || []).map((c: any) => ({
      ...c,
      client_name: c.clients?.name || null,
      vendor_name: c.vendors?.name || null,
      project_name: c.projects?.name || null,
      type_name: c.contract_types?.name || null,
      status_name: c.contract_statuses?.name || null,
    }));

    setContracts(mapped);
  }

  useEffect(() => {
    loadDropdowns();
    loadContracts();
  }, []);

  const filteredContracts = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return contracts;

    return contracts.filter((c) =>
      [
        c.contract_no,
        c.client_name,
        c.vendor_name,
        c.project_name,
        c.type_name,
        c.status_name,
        c.currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [contracts, search]);

  const signedActiveCount = useMemo(() => {
    return contracts.filter((c) => {
      const s = String(c.status_name || "").toLowerCase();
      return s === "active" || s === "signed";
    }).length;
  }, [contracts]);

  const totalValueByCurrency = useMemo(() => {
    return contracts.reduce<Record<string, number>>((acc, c) => {
      const currency = c.currency || "PKR";
      acc[currency] = (acc[currency] || 0) + Number(c.contract_value || 0);
      return acc;
    }, {});
  }, [contracts]);

  const activeValueByCurrency = useMemo(() => {
    return contracts
      .filter((c) => {
        const s = String(c.status_name || "").toLowerCase();
        return s === "active" || s === "signed";
      })
      .reduce<Record<string, number>>((acc, c) => {
        const currency = c.currency || "PKR";
        acc[currency] = (acc[currency] || 0) + Number(c.contract_value || 0);
        return acc;
      }, {});
  }, [contracts]);

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function saveContract() {
    if (!form.contract_no.trim()) return alert("Contract No is required.");
    if (!form.contract_value) return alert("Contract value is required.");

    const payload = {
      contract_no: form.contract_no.trim(),
      global_client_id: form.client_id ? Number(form.client_id) : null,
      global_vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      global_project_id: form.project_id ? Number(form.project_id) : null,
      contract_type_id: form.contract_type_id
        ? Number(form.contract_type_id)
        : null,
      status_id: form.status_id ? Number(form.status_id) : null,
      contract_value: Number(form.contract_value),
      currency: form.currency,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      signed_date: form.signed_date || null,
      notes: form.notes || null,
    };

    if (editingId) {
      await supabaseFetch(`contracts?id=eq.${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await supabaseFetch("contracts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    loadContracts();
  }

  function editContract(c: Contract) {
    setEditingId(c.id);
    setShowForm(true);
    setForm({
      contract_no: c.contract_no || "",
      client_id: c.global_client_id ? String(c.global_client_id) : "",
      vendor_id: c.global_vendor_id ? String(c.global_vendor_id) : "",
      project_id: c.global_project_id ? String(c.global_project_id) : "",
      contract_type_id: c.contract_type_id ? String(c.contract_type_id) : "",
      status_id: c.status_id ? String(c.status_id) : "",
      contract_value: c.contract_value ? String(c.contract_value) : "",
      currency: c.currency || "PKR",
      start_date: c.start_date || "",
      end_date: c.end_date || "",
      signed_date: c.signed_date || "",
      notes: c.notes || "",
    });
  }

  async function deleteContract(id: number) {
    if (!confirm("Delete this contract?")) return;

    await supabaseFetch(`contracts?id=eq.${id}`, {
      method: "DELETE",
    });

    loadContracts();
  }

  function getManageItems() {
    if (manageType === "client") return clients;
    if (manageType === "vendor") return vendors;
    if (manageType === "project") return projects;
    if (manageType === "type") return types;
    if (manageType === "status") return statuses;
    return [];
  }

  function getManageTable() {
    if (manageType === "client") return "clients";
    if (manageType === "vendor") return "vendors";
    if (manageType === "project") return "projects";
    if (manageType === "type") return "contract_types";
    if (manageType === "status") return "contract_statuses";
    return "";
  }

  async function saveManageItem() {
    try {
      if (!manageType || !manageName.trim()) {
        alert("Name is required.");
        return;
      }

      const table = getManageTable();

      if (!table) {
        alert("Invalid manage type.");
        return;
      }

      const payload = { name: manageName.trim() };

      if (manageEditId) {
        await supabaseFetch(`${table}?id=eq.${manageEditId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await supabaseFetch(table, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setManageName("");
      setManageEditId(null);

      await loadDropdowns();
      await loadContracts();

      alert(manageEditId ? "Updated successfully." : "Added successfully.");
    } catch (error: any) {
      console.error("Save manage item error:", error);
      alert(error?.message || "Failed to save item.");
    }
  }

  async function deleteManageItem(id: number) {
    if (!manageType) return;
    if (!confirm("Delete this item?")) return;

    await supabaseFetch(`${getManageTable()}?id=eq.${id}`, {
      method: "DELETE",
    });

    await loadDropdowns();
    await loadContracts();
  }

  function CurrencySummaryCard({
    title,
    data,
  }: {
    title: string;
    data: Record<string, number>;
  }) {
    const entries = Object.entries(data);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-slate-500">{title}</p>

        <div className="mt-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-2xl font-black text-slate-950">0</p>
          ) : (
            entries.map(([currency, amount]) => (
              <div
                key={currency}
                className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
              >
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  {currency}
                </span>
                <span className="text-xl font-black text-slate-950">
                  {amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-10 py-8 text-slate-950">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Contracts</h1>
          <p className="text-sm text-slate-600">
            Manage contract records, clients, vendors, projects, types, statuses
            and dates.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={() => setManageType("client")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black shadow-sm"
          >
            Manage Clients
          </button>

          <button
            onClick={() => setManageType("vendor")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black shadow-sm"
          >
            Manage Vendors
          </button>

          <button
            onClick={() => setManageType("project")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black shadow-sm"
          >
            Manage Projects
          </button>

          <button
            onClick={() => setManageType("type")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black shadow-sm"
          >
            Manage Types
          </button>

          <button
            onClick={() => setManageType("status")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black shadow-sm"
          >
            Manage Statuses
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm"
          >
            + Add Contract
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Total Contracts</p>
          <p className="mt-4 text-2xl font-black">{contracts.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">Signed / Active</p>
          <p className="mt-4 text-2xl font-black">{signedActiveCount}</p>
        </div>

        <CurrencySummaryCard title="Total Value" data={totalValueByCurrency} />
        <CurrencySummaryCard
          title="Active Value"
          data={activeValueByCurrency}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-950">
                {editingId ? "Edit Contract" : "Add Contract"}
              </h2>

              <button
                onClick={resetForm}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Contract No
                </label>
                <input
                  value={form.contract_no}
                  onChange={(e) => updateForm("contract_no", e.target.value)}
                  placeholder="Contract No"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Client
                </label>
                <select
                  value={form.client_id}
                  onChange={(e) => updateForm("client_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Select Client</option>
                  {clients.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Vendor
                </label>
                <select
                  value={form.vendor_id}
                  onChange={(e) => updateForm("vendor_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Project
                </label>
                <select
                  value={form.project_id}
                  onChange={(e) => updateForm("project_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Select Project</option>
                  {projects.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Type
                </label>
                <select
                  value={form.contract_type_id}
                  onChange={(e) =>
                    updateForm("contract_type_id", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Select Type</option>
                  {types.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Status
                </label>
                <select
                  value={form.status_id}
                  onChange={(e) => updateForm("status_id", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="">Select Status</option>
                  {statuses.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Contract Value
                </label>
                <input
                  value={form.contract_value}
                  onChange={(e) => updateForm("contract_value", e.target.value)}
                  placeholder="Contract Value"
                  type="number"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => updateForm("currency", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Start Date
                </label>
                <input
                  value={form.start_date}
                  onChange={(e) => updateForm("start_date", e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  End Date
                </label>
                <input
                  value={form.end_date}
                  onChange={(e) => updateForm("end_date", e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Signed Date
                </label>
                <input
                  value={form.signed_date}
                  onChange={(e) => updateForm("signed_date", e.target.value)}
                  type="date"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  placeholder="Notes"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-black"
              >
                Cancel
              </button>

              <button
                onClick={saveContract}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white"
              >
                {editingId ? "Save Contract" : "Add Contract"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contract, client, vendor, project, type, status, currency..."
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
          />

          <button
            onClick={() => setSearch("")}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black"
          >
            Reset
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-4">CONTRACT NO</th>
                <th className="px-4 py-4">CLIENT</th>
                <th className="px-4 py-4">VENDOR</th>
                <th className="px-4 py-4">PROJECT</th>
                <th className="px-4 py-4">TYPE</th>
                <th className="px-4 py-4">STATUS</th>
                <th className="px-4 py-4">VALUE</th>
                <th className="px-4 py-4">START DATE</th>
                <th className="px-4 py-4">END DATE</th>
                <th className="px-4 py-4">SIGNED DATE</th>
                <th className="px-4 py-4 text-right">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredContracts.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-4 py-4 font-bold">{c.contract_no}</td>
                  <td className="px-4 py-4">{c.client_name || "-"}</td>
                  <td className="px-4 py-4">{c.vendor_name || "-"}</td>
                  <td className="px-4 py-4">{c.project_name || "-"}</td>
                  <td className="px-4 py-4">{c.type_name || "-"}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                      {c.status_name || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-black">
                    {c.currency || "PKR"}{" "}
                    {Number(c.contract_value || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">{c.start_date || "-"}</td>
                  <td className="px-4 py-4">{c.end_date || "-"}</td>
                  <td className="px-4 py-4">{c.signed_date || "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => editContract(c)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteContract(c.id)}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredContracts.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No contracts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manageType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black capitalize">
                Manage {manageType}s
              </h2>
              <button
                onClick={() => {
                  setManageType(null);
                  setManageName("");
                  setManageEditId(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                Close
              </button>
            </div>

            <div className="mb-5 flex gap-3">
              <input
                value={manageName}
                onChange={(e) => setManageName(e.target.value)}
                placeholder={`Enter ${manageType} name`}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button
                onClick={saveManageItem}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
              >
                {manageEditId ? "Update" : "Add"}
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200">
              {getManageItems().map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"
                >
                  <span className="font-bold">{item.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setManageEditId(item.id);
                        setManageName(item.name);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteManageItem(item.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {getManageItems().length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No records found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
