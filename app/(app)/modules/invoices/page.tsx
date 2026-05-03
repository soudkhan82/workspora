"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type DropdownItem = {
  id: number;
  name: string;
};

type Invoice = {
  id: number;
  invoice_no: string;
  client_name?: string;
  vendor_name?: string | null;
  project_name?: string | null;
  client_id: number | null;
  vendor_id: number | null;
  project_id: number | null;
  global_client_id?: number | null;
  global_vendor_id?: number | null;
  global_project_id?: number | null;
  milestone_id: number | null;
  status_id: number | null;
  amount: number;
  currency: string | null;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at?: string;
};

type DropdownType = "client" | "vendor" | "project" | "milestone" | "status";

const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CNY"];

const emptyForm = {
  invoice_no: "",
  client_id: "",
  vendor_id: "",
  project_id: "",
  milestone_id: "",
  status_id: "",
  amount: "",
  currency: "PKR",
  due_date: "",
  paid_date: "",
  notes: "",
};

function groupAmountByCurrency(rows: Invoice[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const currency = row.currency || "PKR";
    acc[currency] = (acc[currency] || 0) + Number(row.amount || 0);
    return acc;
  }, {});
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [vendors, setVendors] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [milestones, setMilestones] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [dropdownModal, setDropdownModal] = useState<DropdownType | null>(null);
  const [dropdownName, setDropdownName] = useState("");
  const [editingDropdown, setEditingDropdown] = useState<DropdownItem | null>(
    null,
  );

  function safeJson(text: string, fallback: any) {
    try {
      return text ? JSON.parse(text) : fallback;
    } catch {
      return fallback;
    }
  }

  function getName(
    list: DropdownItem[],
    id: string | number | null | undefined,
  ) {
    if (!id) return "";
    return list.find((x) => Number(x.id) === Number(id))?.name || "";
  }

  function displayName(
    list: DropdownItem[],
    id: string | number | null | undefined,
    fallback = "-",
  ) {
    return getName(list, id) || fallback;
  }

  function money(value: number, currency = "PKR") {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }

  async function loadData() {
    try {
      setLoading(true);

      const [
        invoiceRes,
        clientRes,
        vendorRes,
        projectRes,
        milestoneRes,
        statusRes,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            `
              *,
              clients!global_client_id(name),
              vendors!global_vendor_id(name),
              projects!global_project_id(name),
              invoice_milestones(name),
              invoice_statuses(name)
            `,
          )
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("name"),
        supabase.from("vendors").select("*").order("name"),
        supabase.from("projects").select("*").order("name"),
        supabase.from("invoice_milestones").select("*").order("name"),
        supabase.from("invoice_statuses").select("*").order("name"),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (clientRes.error) throw clientRes.error;
      if (vendorRes.error) throw vendorRes.error;
      if (projectRes.error) throw projectRes.error;
      if (milestoneRes.error) throw milestoneRes.error;
      if (statusRes.error) throw statusRes.error;

      const mappedInvoices =
        invoiceRes.data?.map((item: any) => ({
          ...item,
          client_name: item.clients?.name ?? null,
          vendor_name: item.vendors?.name ?? null,
          project_name: item.projects?.name ?? null,
        })) ?? [];

      setInvoices(mappedInvoices);
      setClients(clientRes.data ?? []);
      setVendors(vendorRes.data ?? []);
      setProjects(projectRes.data ?? []);
      setMilestones(milestoneRes.data ?? []);
      setStatuses(statusRes.data ?? []);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      setInvoices([]);
      setClients([]);
      setVendors([]);
      setProjects([]);
      setMilestones([]);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;

    return invoices.filter((item) =>
      [
        item.invoice_no,
        item.client_name || displayName(clients, item.global_client_id),
        item.vendor_name || displayName(vendors, item.global_vendor_id),
        item.project_name || displayName(projects, item.global_project_id),
        displayName(milestones, item.milestone_id),
        displayName(statuses, item.status_id),
        item.currency || "PKR",
        item.amount,
        item.due_date || "",
        item.paid_date || "",
        item.notes || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [invoices, search, clients, vendors, projects, milestones, statuses]);

  const totalAmountByCurrency = useMemo(() => {
    return groupAmountByCurrency(filteredInvoices);
  }, [filteredInvoices]);

  const paidAmountByCurrency = useMemo(() => {
    return groupAmountByCurrency(
      filteredInvoices.filter(
        (item) =>
          displayName(statuses, item.status_id).toLowerCase() === "paid",
      ),
    );
  }, [filteredInvoices, statuses]);

  const pendingAmountByCurrency = useMemo(() => {
    const paidIds = new Set(
      filteredInvoices
        .filter(
          (item) =>
            displayName(statuses, item.status_id).toLowerCase() === "paid",
        )
        .map((item) => item.id),
    );

    return groupAmountByCurrency(
      filteredInvoices.filter((item) => !paidIds.has(item.id)),
    );
  }, [filteredInvoices, statuses]);

  function openAddInvoice() {
    setEditingInvoice(null);
    setForm(emptyForm);
    setShowInvoiceModal(true);
  }

  function openEditInvoice(invoice: Invoice) {
    setEditingInvoice(invoice);
    setForm({
      invoice_no: invoice.invoice_no || "",
      client_id: invoice.global_client_id
        ? String(invoice.global_client_id)
        : "",
      vendor_id: invoice.global_vendor_id
        ? String(invoice.global_vendor_id)
        : "",
      project_id: invoice.global_project_id
        ? String(invoice.global_project_id)
        : "",
      milestone_id: invoice.milestone_id ? String(invoice.milestone_id) : "",
      status_id: invoice.status_id ? String(invoice.status_id) : "",
      amount: String(invoice.amount || ""),
      currency: invoice.currency || "PKR",
      due_date: invoice.due_date || "",
      paid_date: invoice.paid_date || "",
      notes: invoice.notes || "",
    });
    setShowInvoiceModal(true);
  }

  async function saveInvoice() {
    if (!form.invoice_no.trim()) return alert("Invoice no is required.");
    if (!form.client_id) return alert("Client name is required.");
    if (!form.project_id) return alert("Project name is required.");

    try {
      setSaving(true);

      const payload = {
        invoice_no: form.invoice_no.trim(),
        global_client_id: Number(form.client_id),
        global_vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        global_project_id: Number(form.project_id),
        milestone_id: form.milestone_id ? Number(form.milestone_id) : null,
        status_id: form.status_id ? Number(form.status_id) : null,
        amount: Number(form.amount || 0),
        currency: form.currency || "PKR",
        due_date: form.due_date || null,
        paid_date: form.paid_date || null,
        notes: form.notes || "",
      };

      const { error } = editingInvoice
        ? await supabase
            .from("invoices")
            .update(payload)
            .eq("id", editingInvoice.id)
        : await supabase.from("invoices").insert(payload);

      if (error) {
        console.error("Save invoice failed:", error);
        alert(error.message || "Failed to save invoice.");
        return;
      }

      setShowInvoiceModal(false);
      setEditingInvoice(null);
      setForm(emptyForm);
      await loadData();
    } catch (error) {
      console.error("Save invoice error:", error);
      alert("Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(id: number) {
    if (!confirm("Delete this invoice?")) return;

    const { error } = await supabase.from("invoices").delete().eq("id", id);

    if (error) {
      console.error("Delete invoice failed:", error);
      alert(error.message || "Failed to delete invoice.");
      return;
    }

    await loadData();
  }

  function openDropdown(type: DropdownType) {
    setDropdownModal(type);
    setDropdownName("");
    setEditingDropdown(null);
  }

  function dropdownTitle() {
    if (dropdownModal === "client") return "Manage Clients";
    if (dropdownModal === "vendor") return "Manage Vendors";
    if (dropdownModal === "project") return "Manage Projects";
    if (dropdownModal === "milestone") return "Manage Invoice Milestones";
    if (dropdownModal === "status") return "Manage Invoice Statuses";
    return "";
  }

  function dropdownList() {
    if (dropdownModal === "client") return clients;
    if (dropdownModal === "vendor") return vendors;
    if (dropdownModal === "project") return projects;
    if (dropdownModal === "milestone") return milestones;
    if (dropdownModal === "status") return statuses;
    return [];
  }

  function dropdownTable() {
    if (dropdownModal === "client") return "clients";
    if (dropdownModal === "vendor") return "vendors";
    if (dropdownModal === "project") return "projects";
    if (dropdownModal === "milestone") return "invoice_milestones";
    if (dropdownModal === "status") return "invoice_statuses";
    return "";
  }

  async function saveDropdown() {
    if (!dropdownModal) return;
    if (!dropdownName.trim()) return alert("Name is required.");

    const table = dropdownTable();
    if (!table) return alert("Invalid dropdown type.");

    const payload = { name: dropdownName.trim() };

    const { error } = editingDropdown
      ? await supabase.from(table).update(payload).eq("id", editingDropdown.id)
      : await supabase.from(table).insert(payload);

    if (error) {
      console.error("Save dropdown failed:", error);
      alert(error.message || "Failed to save dropdown.");
      return;
    }

    setDropdownName("");
    setEditingDropdown(null);
    await loadData();
  }

  async function deleteDropdown(item: DropdownItem) {
    if (!dropdownModal) return;
    if (!confirm(`Delete "${item.name}"?`)) return;

    const table = dropdownTable();
    if (!table) return alert("Invalid dropdown type.");

    const { error } = await supabase.from(table).delete().eq("id", item.id);

    if (error) {
      console.error("Delete dropdown failed:", error);
      alert(error.message || "Failed to delete dropdown.");
      return;
    }

    setDropdownName("");
    setEditingDropdown(null);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] px-[120px] py-14">
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage invoice records, clients, vendors, projects, milestones,
              statuses and payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <ActionButton onClick={() => openDropdown("client")}>
              Manage Clients
            </ActionButton>
            <ActionButton onClick={() => openDropdown("vendor")}>
              Manage Vendors
            </ActionButton>
            <ActionButton onClick={() => openDropdown("project")}>
              Manage Projects
            </ActionButton>
            <ActionButton onClick={() => openDropdown("milestone")}>
              Manage Milestones
            </ActionButton>
            <ActionButton onClick={() => openDropdown("status")}>
              Manage Statuses
            </ActionButton>

            <button
              onClick={openAddInvoice}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              + Add Invoice
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Invoices"
            value={String(filteredInvoices.length)}
          />
          <CurrencyStatCard
            title="Total Amount"
            values={totalAmountByCurrency}
          />
          <CurrencyStatCard title="Paid Amount" values={paidAmountByCurrency} />
          <CurrencyStatCard
            title="Pending Amount"
            values={pendingAmountByCurrency}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, client, vendor, project, status, milestone, currency..."
              className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={() => setSearch("")}
              className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[1250px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#020617] text-white">
                  <tr>
                    <Th>Invoice No</Th>
                    <Th>Client</Th>
                    <Th>Vendor</Th>
                    <Th>Project</Th>
                    <Th>Milestone</Th>
                    <Th>Status</Th>
                    <Th>Amount</Th>
                    <Th>Due Date</Th>
                    <Th>Paid Date</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        <Td className="font-bold">{invoice.invoice_no}</Td>
                        <Td>
                          {invoice.client_name ||
                            invoice.client_name ||
                            displayName(clients, invoice.global_client_id)}
                        </Td>
                        <Td>
                          {invoice.vendor_name ||
                            invoice.vendor_name ||
                            displayName(vendors, invoice.global_vendor_id)}
                        </Td>
                        <Td>
                          {invoice.project_name ||
                            invoice.project_name ||
                            displayName(projects, invoice.global_project_id)}
                        </Td>
                        <Td>{displayName(milestones, invoice.milestone_id)}</Td>
                        <Td>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {displayName(statuses, invoice.status_id)}
                          </span>
                        </Td>
                        <Td className="font-bold">
                          {money(
                            Number(invoice.amount || 0),
                            invoice.currency || "PKR",
                          )}
                        </Td>
                        <Td>{invoice.due_date || "-"}</Td>
                        <Td>{invoice.paid_date || "-"}</Td>
                        <Td align="right">
                          <button
                            onClick={() => openEditInvoice(invoice)}
                            className="mr-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showInvoiceModal && (
        <Modal onClose={() => setShowInvoiceModal(false)} maxWidth="max-w-4xl">
          <h2 className="mb-5 text-2xl font-black text-slate-950">
            {editingInvoice ? "Edit Invoice" : "Add Invoice"}
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Invoice No"
              value={form.invoice_no}
              onChange={(v) => setForm({ ...form, invoice_no: v })}
            />

            <SelectField
              label="Client Name"
              value={form.client_id}
              options={clients}
              onChange={(v) => setForm({ ...form, client_id: v })}
            />

            <SelectField
              label="Vendor Name"
              value={form.vendor_id}
              options={vendors}
              onChange={(v) => setForm({ ...form, vendor_id: v })}
            />

            <SelectField
              label="Project Name"
              value={form.project_id}
              options={projects}
              onChange={(v) => setForm({ ...form, project_id: v })}
            />

            <Field
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
            />

            <SelectStaticField
              label="Currency"
              value={form.currency}
              options={currencies}
              onChange={(v) => setForm({ ...form, currency: v })}
            />

            <SelectField
              label="Milestone"
              value={form.milestone_id}
              options={milestones}
              onChange={(v) => setForm({ ...form, milestone_id: v })}
            />

            <SelectField
              label="Status"
              value={form.status_id}
              options={statuses}
              onChange={(v) => setForm({ ...form, status_id: v })}
            />

            <Field
              label="Due Date"
              type="date"
              value={form.due_date}
              onChange={(v) => setForm({ ...form, due_date: v })}
            />

            <Field
              label="Paid Date"
              type="date"
              value={form.paid_date}
              onChange={(v) => setForm({ ...form, paid_date: v })}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="h-28 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowInvoiceModal(false)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={saveInvoice}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Invoice"}
            </button>
          </div>
        </Modal>
      )}

      {dropdownModal && (
        <Modal onClose={() => setDropdownModal(null)} maxWidth="max-w-3xl">
          <h2 className="mb-5 text-2xl font-black text-slate-950">
            {dropdownTitle()}
          </h2>

          <div className="mb-5 flex gap-3">
            <input
              value={dropdownName}
              onChange={(e) => setDropdownName(e.target.value)}
              placeholder="Enter name"
              className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />

            <button
              onClick={saveDropdown}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              {editingDropdown ? "Update" : "Add"}
            </button>
          </div>

          <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-200">
            {dropdownList().length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No records found.
              </div>
            ) : (
              dropdownList().map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <span className="font-semibold text-slate-800">
                    {item.name}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingDropdown(item);
                        setDropdownName(item.name);
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteDropdown(item)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <h3 className="mt-3 text-2xl font-black text-slate-950">{value}</h3>
    </div>
  );
}

function CurrencyStatCard({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  const entries = Object.entries(values);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>

      <div className="mt-5 space-y-3">
        {entries.length === 0 ? (
          <h3 className="text-2xl font-black text-slate-950">0</h3>
        ) : (
          entries.map(([currency, amount]) => (
            <div
              key={currency}
              className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0"
            >
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {currency}
              </span>
              <span className="text-2xl font-black text-slate-950">
                {Number(amount || 0).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Modal({
  children,
  onClose,
  maxWidth = "max-w-4xl",
}: {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-slate-200"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: DropdownItem[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">Select {label}</option>
        {options.map((item) => (
          <option key={item.id} value={String(item.id)}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectStaticField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
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
      className={`px-4 py-3 text-${align} text-xs font-black uppercase tracking-wide`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td className={`px-4 py-3 text-${align} text-slate-700 ${className}`}>
      {children}
    </td>
  );
}
