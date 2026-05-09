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
  contract_no: string | null;
  client_id: number | null;
  client_name?: string | null;
  vendor_id: number | null;
  project_id: number | null;
  contract_type_id: number | null;
  status_id: number | null;
  contract_value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  signed_date: string | null;
  notes: string | null;
  created_at?: string | null;
  workspace_id?: string | null;
  created_by?: string | null;
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

type ManageType = "client" | "vendor" | "project" | "type" | "status";

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

  const [manageType, setManageType] = useState<ManageType | null>(null);
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

    const [clientsData, vendorsData, projectsData, typesData, statusesData] =
      await Promise.all([
        loadDropdown("clients", currentCtx),
        loadDropdown("vendors", currentCtx),
        loadDropdown("projects", currentCtx),
        loadDropdown("contract_types", currentCtx),
        loadDropdown("contract_statuses", currentCtx),
      ]);

    setClients(clientsData);
    setVendors(vendorsData);
    setProjects(projectsData);
    setTypes(typesData);
    setStatuses(statusesData);

    await loadContracts(currentCtx);
    setLoading(false);
  }

  async function loadDropdown(table: string, currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return [];

    let query = supabase
      .from(table)
      .select("id,name")
      .order("name", { ascending: true });

    // Preferred Workspora scoping. If a legacy master table does not have these
    // columns, retry without filters instead of breaking the page.
    let { data, error } = await query
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId);

    if (error) {
      const retry = await supabase
        .from(table)
        .select("id,name")
        .order("name", { ascending: true });
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      alert(error.message);
      return [];
    }

    return (data ?? []).map((item: any) => ({
      id: Number(item.id),
      name: String(item.name ?? ""),
    }));
  }

  async function loadContracts(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx) return;

    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId)
      .order("id", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setContracts((data ?? []) as Contract[]);
  }

  const clientById = useMemo(() => toMap(clients), [clients]);
  const vendorById = useMemo(() => toMap(vendors), [vendors]);
  const projectById = useMemo(() => toMap(projects), [projects]);
  const typeById = useMemo(() => toMap(types), [types]);
  const statusById = useMemo(() => toMap(statuses), [statuses]);

  function getClientName(contract: Contract) {
    if (contract.client_id && clientById.get(contract.client_id)) {
      return clientById.get(contract.client_id)!;
    }
    return contract.client_name || "Not required";
  }

  function getVendorName(contract: Contract) {
    return contract.vendor_id
      ? (vendorById.get(contract.vendor_id) ?? "-")
      : "-";
  }

  function getProjectName(contract: Contract) {
    return contract.project_id
      ? (projectById.get(contract.project_id) ?? "-")
      : "-";
  }

  function getTypeName(contract: Contract) {
    return contract.contract_type_id
      ? (typeById.get(contract.contract_type_id) ?? "-")
      : "-";
  }

  function getStatusName(contract: Contract) {
    return contract.status_id
      ? (statusById.get(contract.status_id) ?? "-")
      : "-";
  }

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;

    return contracts.filter((contract) => {
      const haystack = [
        contract.contract_no,
        getClientName(contract),
        getVendorName(contract),
        getProjectName(contract),
        getTypeName(contract),
        getStatusName(contract),
        contract.currency,
        contract.start_date,
        contract.end_date,
        contract.signed_date,
        contract.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    contracts,
    search,
    clientById,
    vendorById,
    projectById,
    typeById,
    statusById,
  ]);

  const summary = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter((contract) =>
      getStatusName(contract).toLowerCase().includes("active"),
    ).length;

    const totalValueByCurrency = contracts.reduce<Record<string, number>>(
      (acc, contract) => {
        const currency = contract.currency || "PKR";
        acc[currency] =
          (acc[currency] || 0) + Number(contract.contract_value || 0);
        return acc;
      },
      {},
    );

    const activeValueByCurrency = contracts.reduce<Record<string, number>>(
      (acc, contract) => {
        if (!getStatusName(contract).toLowerCase().includes("active"))
          return acc;
        const currency = contract.currency || "PKR";
        acc[currency] =
          (acc[currency] || 0) + Number(contract.contract_value || 0);
        return acc;
      },
      {},
    );

    return {
      total,
      active,
      totalValue: formatCurrencySummary(totalValueByCurrency),
      activeValue: formatCurrencySummary(activeValueByCurrency),
    };
  }, [contracts, statusById]);

  function openAddContract() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditContract(contract: Contract) {
    setEditingId(contract.id);
    setForm({
      contract_no: contract.contract_no ?? "",
      client_id: contract.client_id ? String(contract.client_id) : "",
      vendor_id: contract.vendor_id ? String(contract.vendor_id) : "",
      project_id: contract.project_id ? String(contract.project_id) : "",
      contract_type_id: contract.contract_type_id
        ? String(contract.contract_type_id)
        : "",
      status_id: contract.status_id ? String(contract.status_id) : "",
      contract_value:
        contract.contract_value == null ? "" : String(contract.contract_value),
      currency: contract.currency || "PKR",
      start_date: contract.start_date ?? "",
      end_date: contract.end_date ?? "",
      signed_date: contract.signed_date ?? "",
      notes: contract.notes ?? "",
    });
    setShowForm(true);
  }

  async function saveContract() {
    const scopedCtx = await getWorkspaceContext();
    if (!scopedCtx) return;

    if (!form.contract_no.trim()) {
      alert("Contract No is required.");
      return;
    }

    const selectedClient = form.client_id
      ? clients.find((client) => String(client.id) === form.client_id)
      : null;

    // IMPORTANT FIX:
    // contracts.client_name is NOT NULL in your DB, so always send a safe value.
    // When no client is selected, the contract is saved as "Not required".
    const safeClientName = selectedClient?.name?.trim() || "Not required";

    const payload = {
      contract_no: form.contract_no.trim(),
      client_id: form.client_id ? Number(form.client_id) : null,
      client_name: safeClientName,
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
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase
          .from("contracts")
          .update(payload)
          .eq("id", editingId)
          .eq("workspace_id", scopedCtx.workspaceId)
          .eq("created_by", scopedCtx.userId)
      : await supabase.from("contracts").insert({
          ...payload,
          workspace_id: scopedCtx.workspaceId,
          created_by: scopedCtx.userId,
        });

    if (error) {
      alert(error.message);
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    await loadContracts(scopedCtx);
  }

  async function deleteContract(id: number) {
    const scopedCtx = await getWorkspaceContext();
    if (!scopedCtx) return;
    if (!confirm("Delete this contract?")) return;

    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scopedCtx.workspaceId)
      .eq("created_by", scopedCtx.userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadContracts(scopedCtx);
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
    return "Manage Master Data";
  }

  async function refreshManageItems(currentCtx?: WorkspaceContext) {
    const scopedCtx = currentCtx ?? (await getWorkspaceContext());
    if (!scopedCtx || !manageType) return;

    const table = getManageTable();
    const items = await loadDropdown(table, scopedCtx);

    if (manageType === "client") setClients(items);
    if (manageType === "vendor") setVendors(items);
    if (manageType === "project") setProjects(items);
    if (manageType === "type") setTypes(items);
    if (manageType === "status") setStatuses(items);
  }

  async function saveManageItem() {
    const scopedCtx = await getWorkspaceContext();
    if (!scopedCtx || !manageType) return;

    const table = getManageTable();
    const name = manageName.trim();
    if (!table || !name) return;

    const basePayload = { name };
    const scopedPayload = {
      ...basePayload,
      workspace_id: scopedCtx.workspaceId,
      created_by: scopedCtx.userId,
    };

    let result = manageEditId
      ? await supabase.from(table).update(basePayload).eq("id", manageEditId)
      : await supabase.from(table).insert(scopedPayload);

    // Legacy fallback for master tables that do not have workspace_id/created_by yet.
    if (result.error && !manageEditId) {
      result = await supabase.from(table).insert(basePayload);
    }

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setManageName("");
    setManageEditId(null);
    await refreshManageItems(scopedCtx);
    await loadContracts(scopedCtx);
  }

  async function deleteManageItem(id: number) {
    if (!manageType) return;
    const table = getManageTable();
    if (!table) return;
    if (
      !confirm(
        "Delete this item? Existing contracts may keep an empty reference.",
      )
    )
      return;

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refreshManageItems();
    await loadContracts();
  }

  function openManageModal(type: ManageType) {
    setManageType(type);
    setManageName("");
    setManageEditId(null);
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const textareaClass =
    "min-h-[92px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

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

  if (contextError) {
    return (
      <div className="px-[120px] py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h1 className="text-lg font-bold">Contracts unavailable</h1>
          <p className="mt-2 text-sm">{contextError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-[120px] py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Contracts
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Manage contracts. Clients are optional; vendors and projects come
            from global master data.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={() => openManageModal("client")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Clients
          </button>
          <button
            onClick={() => openManageModal("vendor")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Vendors
          </button>
          <button
            onClick={() => openManageModal("project")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Projects
          </button>
          <button
            onClick={() => openManageModal("type")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Types
          </button>
          <button
            onClick={() => openManageModal("status")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Statuses
          </button>
          <button
            onClick={openAddContract}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            + Add Contract
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total Contracts" value={summary.total} />
        <SummaryCard title="Active Contracts" value={summary.active} />
        <SummaryCard title="Total Value" value={summary.totalValue} />
        <SummaryCard title="Active Value" value={summary.activeValue} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contract, client, vendor, project, type, status..."
            className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => setSearch("")}
            className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-950 text-white">
                <Th>Contract No</Th>
                <Th>Client</Th>
                <Th>Vendor</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Value</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Signed</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No contracts found.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => (
                  <tr key={contract.id} className="border-t border-slate-100">
                    <Td bold>{contract.contract_no || "-"}</Td>
                    <Td>{getClientName(contract)}</Td>
                    <Td>{getVendorName(contract)}</Td>
                    <Td>{getProjectName(contract)}</Td>
                    <Td>{getTypeName(contract)}</Td>
                    <Td>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {getStatusName(contract)}
                      </span>
                    </Td>
                    <Td>
                      {formatMoney(
                        contract.contract_value || 0,
                        contract.currency || "PKR",
                      )}
                    </Td>
                    <Td>{contract.start_date || "-"}</Td>
                    <Td>{contract.end_date || "-"}</Td>
                    <Td>{contract.signed_date || "-"}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditContract(contract)}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void deleteContract(contract.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="max-h-[88vh] overflow-y-auto p-6">
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {editingId ? "Edit Contract" : "Add Contract"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Client is optional. If not selected, it will be saved as Not
                    required.
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                <Field label="Contract No">
                  <input
                    value={form.contract_no}
                    onChange={(e) =>
                      setForm({ ...form, contract_no: e.target.value })
                    }
                    className={inputClass}
                    placeholder="Contract No"
                  />
                </Field>

                <Field label="Client">
                  <select
                    value={form.client_id}
                    onChange={(e) =>
                      setForm({ ...form, client_id: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Not required</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Vendor">
                  <select
                    value={form.vendor_id}
                    onChange={(e) =>
                      setForm({ ...form, vendor_id: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Project">
                  <select
                    value={form.project_id}
                    onChange={(e) =>
                      setForm({ ...form, project_id: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Type">
                  <select
                    value={form.contract_type_id}
                    onChange={(e) =>
                      setForm({ ...form, contract_type_id: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Type</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    value={form.status_id}
                    onChange={(e) =>
                      setForm({ ...form, status_id: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select Status</option>
                    {statuses.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Contract Value">
                  <input
                    type="number"
                    value={form.contract_value}
                    onChange={(e) =>
                      setForm({ ...form, contract_value: e.target.value })
                    }
                    className={inputClass}
                    placeholder="0"
                  />
                </Field>

                <Field label="Currency">
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({ ...form, currency: e.target.value })
                    }
                    className={inputClass}
                  >
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start Date">
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="End Date">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Signed Date">
                  <input
                    type="date"
                    value={form.signed_date}
                    onChange={(e) =>
                      setForm({ ...form, signed_date: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Notes" className="mt-3">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={textareaClass}
                  placeholder="Notes"
                />
              </Field>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveContract()}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  {editingId ? "Update Contract" : "Add Contract"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {manageType && (
        <Modal onClose={() => setManageType(null)}>
          <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  {getManageTitle()}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Add, edit or delete dropdown values.
                </p>
              </div>
              <button
                onClick={() => setManageType(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-lg font-bold hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mb-4 flex gap-3">
              <input
                value={manageName}
                onChange={(e) => setManageName(e.target.value)}
                placeholder="Name"
                className={inputClass}
              />
              <button
                onClick={() => void saveManageItem()}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                {manageEditId ? "Update" : "Add"}
              </button>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200">
              {getManageItems().length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No items found.
                </div>
              ) : (
                getManageItems().map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                  >
                    <div className="font-semibold text-slate-900">
                      {item.name}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setManageEditId(item.id);
                          setManageName(item.name);
                        }}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteManageItem(item.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function toMap(items: DropdownItem[]) {
  const map = new Map<number, string>();
  items.forEach((item) => map.set(item.id, item.name));
  return map;
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">{title}</p>
      <div className="mt-3 whitespace-pre-line text-2xl font-bold text-slate-950">
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({
  children,
  bold = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-3 text-slate-700 ${bold ? "font-bold text-slate-950" : ""}`}
    >
      {children}
    </td>
  );
}

function Field({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-[1px]">
      <button
        aria-label="Close modal"
        className="fixed inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function formatCurrencySummary(values: Record<string, number>) {
  const entries = Object.entries(values).filter(
    ([, value]) => Number(value) > 0,
  );
  if (entries.length === 0) return "0";
  return entries
    .map(([currency, value]) => formatMoney(value, currency))
    .join("\n");
}
