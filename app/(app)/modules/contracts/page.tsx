"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

type WorkspaceContext = {
  userId: string;
  workspaceId: string;
};

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
  contract_type_id: number | null;
  status_id: number | null;
  contract_value: number;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_date: string | null;
  notes: string | null;
  created_at?: string | null;
  workspace_id?: string | null;
  created_by?: string | null;

  client_name?: string | null;
  vendor_name?: string | null;
  project_name?: string | null;
  type_name?: string | null;
  status_name?: string | null;
};

type ContractForm = {
  contract_no: string;
  client_id: string;
  vendor_id: string;
  project_id: string;
  contract_type_id: string;
  status_id: string;
  contract_value: string;
  currency: string;
  start_date: string;
  end_date: string;
  signed_date: string;
  notes: string;
};

type DropdownType = "client" | "vendor" | "project" | "type" | "status";

const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CNY"];

const emptyForm: ContractForm = {
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
  const supabase = useMemo(() => createClientBrowser(), []);

  const [ctx, setCtx] = useState<WorkspaceContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [loading, setLoading] = useState(true);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [vendors, setVendors] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [types, setTypes] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ContractForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [manageType, setManageType] = useState<DropdownType | null>(null);
  const [manageName, setManageName] = useState("");
  const [manageEditId, setManageEditId] = useState<number | null>(null);

  useEffect(() => {
    void loadAll();
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

  async function loadAll() {
    setLoading(true);

    const currentCtx = await getWorkspaceContext();

    if (!currentCtx) {
      setContracts([]);
      setClients([]);
      setVendors([]);
      setProjects([]);
      setTypes([]);
      setStatuses([]);
      setLoading(false);
      return;
    }

    await Promise.all([
      loadContracts(currentCtx),
      loadClients(currentCtx),
      loadVendors(currentCtx),
      loadProjects(currentCtx),
      loadTypes(currentCtx),
      loadStatuses(currentCtx),
    ]);

    setLoading(false);
  }

  async function loadContracts(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("contracts")
      .select(
        `
        *,
        clients!contracts_client_id_fkey(name),
        vendors!contracts_vendor_id_fkey(name),
        projects!contracts_project_id_fkey(name),
        contract_types!contracts_contract_type_id_fkey(name),
        contract_statuses!contracts_status_id_fkey(name)
      `,
      )
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const mapped =
      data?.map((c: any) => ({
        ...c,
        client_name: c.clients?.name ?? null,
        vendor_name: c.vendors?.name ?? null,
        project_name: c.projects?.name ?? null,
        type_name: c.contract_types?.name ?? null,
        status_name: c.contract_statuses?.name ?? null,
      })) ?? [];

    setContracts(mapped);
  }

  async function loadClients(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("clients")
      .select("id,name")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setClients(data ?? []);
  }

  async function loadVendors(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("vendors")
      .select("id,name")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setVendors(data ?? []);
  }

  async function loadProjects(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("projects")
      .select("id,name")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setProjects(data ?? []);
  }

  async function loadTypes(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("contract_types")
      .select("id,name")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setTypes(data ?? []);
  }

  async function loadStatuses(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("contract_statuses")
      .select("id,name")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setStatuses(data ?? []);
  }

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
        c.notes,
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

  function updateForm(key: keyof ContractForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  }

  function openAddContract() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  async function saveContract() {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!form.contract_no.trim()) return alert("Contract No is required.");
    if (!form.contract_value) return alert("Contract value is required.");

    const payload = {
      contract_no: form.contract_no.trim(),
      client_id: form.client_id ? Number(form.client_id) : null,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      contract_type_id: form.contract_type_id
        ? Number(form.contract_type_id)
        : null,
      status_id: form.status_id ? Number(form.status_id) : null,
      contract_value: Number(form.contract_value || 0),
      currency: form.currency || "PKR",
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      signed_date: form.signed_date || null,
      notes: form.notes || null,
      workspace_id: currentCtx.workspaceId,
      created_by: currentCtx.userId,
    };

    if (editingId) {
      const { error } = await supabase
        .from("contracts")
        .update(payload)
        .eq("id", editingId)
        .eq("workspace_id", currentCtx.workspaceId)
        .eq("created_by", currentCtx.userId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("contracts").insert(payload);
      if (error) return alert(error.message);
    }

    resetForm();
    await loadContracts(currentCtx);
  }

  function editContract(c: Contract) {
    setEditingId(c.id);
    setShowForm(true);
    setForm({
      contract_no: c.contract_no || "",
      client_id: c.client_id ? String(c.client_id) : "",
      vendor_id: c.vendor_id ? String(c.vendor_id) : "",
      project_id: c.project_id ? String(c.project_id) : "",
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
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!confirm("Delete this contract?")) return;

    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .eq("workspace_id", currentCtx.workspaceId)
      .eq("created_by", currentCtx.userId);

    if (error) return alert(error.message);

    await loadContracts(currentCtx);
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

  function getManageTitle() {
    if (manageType === "client") return "Manage Clients";
    if (manageType === "vendor") return "Manage Vendors";
    if (manageType === "project") return "Manage Projects";
    if (manageType === "type") return "Manage Types";
    if (manageType === "status") return "Manage Statuses";
    return "Manage Data";
  }

  async function refreshManagedList(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    if (manageType === "client") await loadClients(scopedCtx);
    if (manageType === "vendor") await loadVendors(scopedCtx);
    if (manageType === "project") await loadProjects(scopedCtx);
    if (manageType === "type") await loadTypes(scopedCtx);
    if (manageType === "status") await loadStatuses(scopedCtx);
  }

  async function saveManageItem() {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!manageType || !manageName.trim()) {
      alert("Name is required.");
      return;
    }

    const table = getManageTable();
    if (!table) return alert("Invalid manage type.");

    if (manageEditId) {
      const { error } = await supabase
        .from(table)
        .update({ name: manageName.trim() })
        .eq("id", manageEditId)
        .eq("workspace_id", currentCtx.workspaceId)
        .eq("created_by", currentCtx.userId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from(table).insert({
        name: manageName.trim(),
        workspace_id: currentCtx.workspaceId,
        created_by: currentCtx.userId,
      });

      if (error) return alert(error.message);
    }

    setManageName("");
    setManageEditId(null);

    await refreshManagedList(currentCtx);
    await loadContracts(currentCtx);
  }

  async function deleteManageItem(id: number) {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx || !manageType) return;

    if (
      !confirm(
        "Delete this item? Existing contracts may keep an empty reference.",
      )
    ) {
      return;
    }

    const table = getManageTable();
    if (!table) return;

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("workspace_id", currentCtx.workspaceId)
      .eq("created_by", currentCtx.userId);

    if (error) return alert(error.message);

    await refreshManagedList(currentCtx);
    await loadContracts(currentCtx);
  }

  function closeManageModal() {
    setManageType(null);
    setManageName("");
    setManageEditId(null);
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString();
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-2xl bg-slate-900 px-10 py-8 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-500 border-t-white" />
          <div className="text-lg font-bold text-white">
            Loading dashboard...
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Please wait while data is being fetched
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-10 py-8 text-slate-950">
      {contextError ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {contextError}
        </div>
      ) : null}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Contracts</h1>
          <p className="text-sm text-slate-600">
            Manage contract records using global clients, vendors and projects,
            plus module-specific contract types and statuses.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button onClick={() => setManageType("client")} className="topBtn">
            Manage Clients
          </button>
          <button onClick={() => setManageType("vendor")} className="topBtn">
            Manage Vendors
          </button>
          <button onClick={() => setManageType("project")} className="topBtn">
            Manage Projects
          </button>
          <button onClick={() => setManageType("type")} className="topBtn">
            Manage Types
          </button>
          <button onClick={() => setManageType("status")} className="topBtn">
            Manage Statuses
          </button>
          <button onClick={openAddContract} className="addBtn">
            + Add Contract
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total Contracts" value={String(contracts.length)} />
        <SummaryCard
          title="Signed / Active"
          value={String(signedActiveCount)}
        />
        <CurrencySummaryCard title="Total Value" data={totalValueByCurrency} />
        <CurrencySummaryCard
          title="Active Value"
          data={activeValueByCurrency}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contract, client, vendor, project, type, status, currency..."
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />
          <button onClick={() => setSearch("")} className="cancelBtn">
            Reset
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <Th>Contract No</Th>
                <Th>Client</Th>
                <Th>Vendor</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Value</Th>
                <Th>Start Date</Th>
                <Th>End Date</Th>
                <Th>Signed Date</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {filteredContracts.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <Td bold>{c.contract_no}</Td>
                  <Td>{c.client_name || "-"}</Td>
                  <Td>{c.vendor_name || "-"}</Td>
                  <Td>{c.project_name || "-"}</Td>
                  <Td>{c.type_name || "-"}</Td>
                  <Td>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                      {c.status_name || "-"}
                    </span>
                  </Td>
                  <Td bold>
                    {c.currency || "PKR"}{" "}
                    {formatNumber(Number(c.contract_value || 0))}
                  </Td>
                  <Td>{formatDate(c.start_date)}</Td>
                  <Td>{formatDate(c.end_date)}</Td>
                  <Td>{formatDate(c.signed_date)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => editContract(c)}
                        className="editBtn"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteContract(c.id)}
                        className="deleteBtn"
                      >
                        Delete
                      </button>
                    </div>
                  </Td>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  {editingId ? "Edit Contract" : "Add Contract"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Clients, vendors and projects come from global workspace
                  master data.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Contract No"
                  value={form.contract_no}
                  onChange={(v) => updateForm("contract_no", v)}
                  placeholder="Contract No"
                />
                <Select
                  label="Client"
                  value={form.client_id}
                  onChange={(value) => setForm({ ...form, client_id: value })}
                  items={clients}
                  emptyLabel="Not required"
                />

                <Select
                  label="Vendor"
                  value={form.vendor_id}
                  onChange={(v) => updateForm("vendor_id", v)}
                  items={vendors}
                  emptyLabel="Select Vendor"
                />

                <Select
                  label="Project"
                  value={form.project_id}
                  onChange={(v) => updateForm("project_id", v)}
                  items={projects}
                  emptyLabel="Select Project"
                />

                <Select
                  label="Type"
                  value={form.contract_type_id}
                  onChange={(v) => updateForm("contract_type_id", v)}
                  items={types}
                  emptyLabel="Select Type"
                />

                <Select
                  label="Status"
                  value={form.status_id}
                  onChange={(v) => updateForm("status_id", v)}
                  items={statuses}
                  emptyLabel="Select Status"
                />

                <Input
                  label="Contract Value"
                  value={form.contract_value}
                  onChange={(v) => updateForm("contract_value", v)}
                  type="number"
                  placeholder="Contract Value"
                />

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
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Start Date"
                  value={form.start_date}
                  onChange={(v) => updateForm("start_date", v)}
                  type="date"
                />

                <Input
                  label="End Date"
                  value={form.end_date}
                  onChange={(v) => updateForm("end_date", v)}
                  type="date"
                />

                <Input
                  label="Signed Date"
                  value={form.signed_date}
                  onChange={(v) => updateForm("signed_date", v)}
                  type="date"
                />

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
                <button onClick={resetForm} className="cancelBtn">
                  Cancel
                </button>
                <button onClick={saveContract} className="saveBtn">
                  {editingId ? "Save Contract" : "Add Contract"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black">{getManageTitle()}</h2>
              <button onClick={closeManageModal} className="cancelBtn">
                Close
              </button>
            </div>

            <div className="mb-5 flex gap-3">
              <input
                value={manageName}
                onChange={(e) => setManageName(e.target.value)}
                placeholder="Enter name"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
              <button onClick={saveManageItem} className="saveBtn">
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
                      className="editBtn"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteManageItem(item.id)}
                      className="deleteBtn"
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

      <style jsx>{`
        .topBtn {
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 900;
          box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
        }
        .topBtn:hover {
          background: rgb(248 250 252);
        }
        .addBtn,
        .saveBtn {
          border-radius: 0.75rem;
          background: rgb(5 150 105);
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 900;
          color: white;
        }
        .addBtn:hover,
        .saveBtn:hover {
          background: rgb(4 120 87);
        }
        .cancelBtn {
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 900;
        }
        .cancelBtn:hover {
          background: rgb(248 250 252);
        }
        .editBtn {
          border-radius: 0.5rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .editBtn:hover {
          background: rgb(248 250 252);
        }
        .deleteBtn {
          border-radius: 0.5rem;
          background: rgb(220 38 38);
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 800;
          color: white;
        }
        .deleteBtn:hover {
          background: rgb(185 28 28);
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function CurrencySummaryCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).filter(([, amount]) => amount > 0);

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
                {Number(amount || 0).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-4 text-xs font-extrabold uppercase ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  bold,
  align = "left",
}: {
  children: React.ReactNode;
  bold?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-4 align-middle text-[13px] leading-5 ${
        align === "right" ? "text-right" : "text-left"
      } ${bold ? "font-bold text-slate-950" : "font-normal text-slate-900"}`}
    >
      {children}
    </td>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase text-slate-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  items,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: DropdownItem[];
  emptyLabel: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
      >
        <option value="">{emptyLabel}</option>
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </div>
  );
}
