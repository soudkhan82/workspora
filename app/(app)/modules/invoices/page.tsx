"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

type DropdownItem = { id: number; name: string };

type LineMasterItem = {
  id: number;
  line_code: string;
  line_item: string;
  unit_of_measurement: string;
  unit_price: number;
};

type InvoiceLineItem = {
  id?: number;
  invoice_id?: number;
  line_item_master_id: number | null;
  line_code: string;
  line_item: string;
  unit_of_measurement: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Invoice = {
  id: number;
  invoice_no: string;
  client_name?: string | null;
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
  subtotal?: number | null;
  tax_percent?: number | null;
  grand_total?: number | null;
  currency: string | null;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at?: string;
  line_items?: InvoiceLineItem[];
};

type DropdownType = "client" | "vendor" | "project" | "milestone" | "status";

type InvoiceForm = {
  invoice_no: string;
  client_id: string;
  vendor_id: string;
  project_id: string;
  milestone_id: string;
  status_id: string;
  currency: string;
  tax_percent: string;
  due_date: string;
  paid_date: string;
  notes: string;
};

const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CNY"];

const emptyForm: InvoiceForm = {
  invoice_no: "",
  client_id: "",
  vendor_id: "",
  project_id: "",
  milestone_id: "",
  status_id: "",
  currency: "PKR",
  tax_percent: "0",
  due_date: "",
  paid_date: "",
  notes: "",
};

const emptyLine: InvoiceLineItem = {
  line_item_master_id: null,
  line_code: "",
  line_item: "",
  unit_of_measurement: "",
  quantity: 1,
  unit_price: 0,
  line_total: 0,
};

const csvTemplateRows = [
  [
    "invoice_no",
    "client_name",
    "vendor_name",
    "project_name",
    "currency",
    "tax_percent",
    "milestone",
    "status",
    "due_date",
    "paid_date",
    "notes",
  ],
  [
    "INV-001",
    "Client A",
    "Vendor A",
    "Project A",
    "PKR",
    "5",
    "Phase 1",
    "Pending",
    "2026-05-30",
    "",
    "Sample invoice header. Add line items from UI after upload.",
  ],
];

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) =>
    header
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, ""),
  );

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index]?.trim() ?? "";
      return acc;
    }, {});
  });
}

function readCsvValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = key
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (row[normalizedKey]) return row[normalizedKey].trim();
  }
  return "";
}

function normalizeDateInput(value: string) {
  const text = value.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return text;
}

function normalizeDropdownRows(rows: any[] | null | undefined): DropdownItem[] {
  return (rows ?? [])
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name ?? item.full_name ?? item.title ?? "").trim(),
    }))
    .filter((item) => item.id && item.name);
}

function normalizeLineMasterRows(
  rows: any[] | null | undefined,
): LineMasterItem[] {
  return (rows ?? [])
    .map((item) => ({
      id: Number(item.id),
      line_code: String(item.line_code ?? "").trim(),
      line_item: String(item.line_item ?? "").trim(),
      unit_of_measurement: String(item.unit_of_measurement ?? "").trim(),
      unit_price: Number(item.unit_price ?? 0),
    }))
    .filter((item) => item.id && item.line_code);
}

function lineTotal(line: InvoiceLineItem) {
  return Number(line.quantity || 0) * Number(line.unit_price || 0);
}

function calculateTotals(
  lines: InvoiceLineItem[],
  taxPercentText: string | number | null | undefined,
) {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const taxPercent = Number(taxPercentText || 0);
  const safeTaxPercent = Number.isFinite(taxPercent) ? taxPercent : 0;
  const taxAmount = (subtotal * safeTaxPercent) / 100;
  const grandTotal = subtotal + taxAmount;
  return { subtotal, taxPercent: safeTaxPercent, taxAmount, grandTotal };
}

function groupAmountByCurrency(rows: Invoice[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const currency = row.currency || "PKR";
    const value = Number(row.grand_total ?? row.amount ?? 0);
    acc[currency] = (acc[currency] || 0) + value;
    return acc;
  }, {});
}

export default function InvoicesPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [vendors, setVendors] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [milestones, setMilestones] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);
  const [lineMasterItems, setLineMasterItems] = useState<LineMasterItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportInvoice, setReportInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [formLines, setFormLines] = useState<InvoiceLineItem[]>([
    { ...emptyLine },
  ]);

  const [dropdownModal, setDropdownModal] = useState<DropdownType | null>(null);
  const [dropdownName, setDropdownName] = useState("");
  const [editingDropdown, setEditingDropdown] = useState<DropdownItem | null>(
    null,
  );

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
    return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
        lineMasterRes,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, name").order("name"),
        supabase.from("vendors").select("id, name").order("name"),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("invoice_milestones").select("id, name").order("name"),
        supabase.from("invoice_statuses").select("id, name").order("name"),
        supabase
          .from("line_items_master")
          .select("id, line_code, line_item, unit_of_measurement, unit_price")
          .order("line_code"),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (clientRes.error) throw clientRes.error;
      if (vendorRes.error) throw vendorRes.error;
      if (projectRes.error) throw projectRes.error;
      if (milestoneRes.error) throw milestoneRes.error;
      if (statusRes.error) throw statusRes.error;
      if (lineMasterRes.error) throw lineMasterRes.error;

      const clientRows = normalizeDropdownRows(clientRes.data);
      const vendorRows = normalizeDropdownRows(vendorRes.data);
      const projectRows = normalizeDropdownRows(projectRes.data);
      const milestoneRows = normalizeDropdownRows(milestoneRes.data);
      const statusRows = normalizeDropdownRows(statusRes.data);
      const masterRows = normalizeLineMasterRows(lineMasterRes.data);
      const invoiceRows = invoiceRes.data ?? [];
      const invoiceIds = invoiceRows
        .map((item: any) => Number(item.id))
        .filter(Boolean);

      let lineRows: InvoiceLineItem[] = [];
      if (invoiceIds.length) {
        const { data: linesData, error: linesError } = await supabase
          .from("invoice_line_items")
          .select(
            "id, invoice_id, line_code, line_item, unit_of_measurement, quantity, unit_price, line_total",
          )
          .in("invoice_id", invoiceIds)
          .order("id", { ascending: true });

        if (linesError) {
          console.warn(
            "Could not load invoice_line_items. Run the SQL schema provided with this drop-in fix.",
            linesError,
          );
        } else {
          lineRows = (linesData ?? []).map((line: any) => ({
            id: Number(line.id),
            invoice_id: Number(line.invoice_id),
            line_item_master_id:
              masterRows.find(
                (master) => master.line_code === String(line.line_code ?? ""),
              )?.id ?? null,
            line_code: String(line.line_code ?? ""),
            line_item: String(line.line_item ?? ""),
            unit_of_measurement: String(line.unit_of_measurement ?? ""),
            quantity: Number(line.quantity ?? 0),
            unit_price: Number(line.unit_price ?? 0),
            line_total: Number(line.line_total ?? 0),
          }));
        }
      }

      const mappedInvoices: Invoice[] = invoiceRows.map((item: any) => {
        const itemLines = lineRows.filter(
          (line) => Number(line.invoice_id) === Number(item.id),
        );
        const computedSubtotal = itemLines.reduce(
          (sum, line) => sum + Number(line.line_total || lineTotal(line)),
          0,
        );
        const taxPercent = Number(item.tax_percent ?? 0);
        const computedGrand =
          computedSubtotal + (computedSubtotal * taxPercent) / 100;

        return {
          ...item,
          amount: Number(item.amount ?? item.grand_total ?? computedGrand ?? 0),
          subtotal: Number(item.subtotal ?? computedSubtotal ?? 0),
          tax_percent: taxPercent,
          grand_total: Number(
            item.grand_total ?? item.amount ?? computedGrand ?? 0,
          ),
          line_items: itemLines,
          client_name:
            item.client_name ??
            clientRows.find(
              (x) =>
                Number(x.id) ===
                Number(item.global_client_id ?? item.client_id),
            )?.name ??
            null,
          vendor_name:
            item.vendor_name ??
            vendorRows.find(
              (x) =>
                Number(x.id) ===
                Number(item.vendor_id ?? item.global_vendor_id),
            )?.name ??
            null,
          project_name:
            item.project_name ??
            projectRows.find(
              (x) =>
                Number(x.id) ===
                Number(item.global_project_id ?? item.project_id),
            )?.name ??
            null,
        };
      });

      setInvoices(mappedInvoices);
      setClients(clientRows);
      setVendors(vendorRows);
      setProjects(projectRows);
      setMilestones(milestoneRows);
      setStatuses(statusRows);
      setLineMasterItems(masterRows);
    } catch (error) {
      console.error("Failed to load invoices:", error);
      setInvoices([]);
      setClients([]);
      setVendors([]);
      setProjects([]);
      setMilestones([]);
      setStatuses([]);
      setLineMasterItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;

    return invoices.filter((item) =>
      [
        item.invoice_no,
        item.client_name ||
          displayName(clients, item.global_client_id ?? item.client_id),
        item.vendor_name ||
          displayName(vendors, item.vendor_id ?? item.global_vendor_id),
        item.project_name ||
          displayName(projects, item.global_project_id ?? item.project_id),
        displayName(milestones, item.milestone_id),
        displayName(statuses, item.status_id),
        item.currency || "PKR",
        item.amount,
        item.due_date || "",
        item.paid_date || "",
        item.notes || "",
        ...(item.line_items ?? []).flatMap((line) => [
          line.line_code,
          line.line_item,
          line.unit_of_measurement,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [invoices, search, clients, vendors, projects, milestones, statuses]);

  const totalAmountByCurrency = useMemo(
    () => groupAmountByCurrency(filteredInvoices),
    [filteredInvoices],
  );

  const paidAmountByCurrency = useMemo(() => {
    return groupAmountByCurrency(
      filteredInvoices.filter(
        (item) =>
          displayName(statuses, item.status_id).toLowerCase() === "paid",
      ),
    );
  }, [filteredInvoices, statuses]);

  const pendingAmountByCurrency = useMemo(() => {
    return groupAmountByCurrency(
      filteredInvoices.filter(
        (item) =>
          displayName(statuses, item.status_id).toLowerCase() !== "paid",
      ),
    );
  }, [filteredInvoices, statuses]);

  const formTotals = useMemo(
    () => calculateTotals(formLines, form.tax_percent),
    [formLines, form.tax_percent],
  );

  function openAddInvoice() {
    setEditingInvoice(null);
    setForm(emptyForm);
    setFormLines([{ ...emptyLine }]);
    setShowInvoiceModal(true);
  }

  function openEditInvoice(invoice: Invoice) {
    const invoiceLines = invoice.line_items?.length
      ? invoice.line_items
      : [{ ...emptyLine }];

    setEditingInvoice(invoice);
    setForm({
      invoice_no: invoice.invoice_no || "",
      client_id: invoice.global_client_id
        ? String(invoice.global_client_id)
        : invoice.client_id
          ? String(invoice.client_id)
          : "",
      vendor_id: invoice.global_vendor_id
        ? String(invoice.global_vendor_id)
        : invoice.vendor_id
          ? String(invoice.vendor_id)
          : "",
      project_id: invoice.global_project_id
        ? String(invoice.global_project_id)
        : invoice.project_id
          ? String(invoice.project_id)
          : "",
      milestone_id: invoice.milestone_id ? String(invoice.milestone_id) : "",
      status_id: invoice.status_id ? String(invoice.status_id) : "",
      currency: invoice.currency || "PKR",
      tax_percent: String(invoice.tax_percent ?? 0),
      due_date: invoice.due_date || "",
      paid_date: invoice.paid_date || "",
      notes: invoice.notes || "",
    });
    setFormLines(
      invoiceLines.map((line) => ({
        ...line,
        line_total: line.line_total || lineTotal(line),
      })),
    );
    setShowInvoiceModal(true);
  }

  function openReport(invoice: Invoice) {
    setReportInvoice(invoice);
    setShowReportModal(true);
  }

  function updateLine(index: number, patch: Partial<InvoiceLineItem>) {
    setFormLines((current) =>
      current.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        return { ...next, line_total: lineTotal(next) };
      }),
    );
  }

  function selectMasterItem(index: number, masterId: string) {
    const found = lineMasterItems.find((item) => String(item.id) === masterId);
    if (!found) {
      updateLine(index, { ...emptyLine });
      return;
    }

    updateLine(index, {
      line_item_master_id: found.id,
      line_code: found.line_code,
      line_item: found.line_item,
      unit_of_measurement: found.unit_of_measurement,
      unit_price: found.unit_price,
      quantity: formLines[index]?.quantity || 1,
    });
  }

  function addLine() {
    setFormLines((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setFormLines((current) =>
      current.length === 1
        ? [{ ...emptyLine }]
        : current.filter((_, i) => i !== index),
    );
  }

  async function saveInvoice() {
    if (!form.invoice_no.trim()) return alert("Invoice no is required.");
    if (!form.client_id) return alert("Client name is required.");
    if (!form.project_id) return alert("Project name is required.");

    const validLines = formLines
      .map((line) => ({
        ...line,
        quantity: Number(line.quantity || 0),
        unit_price: Number(line.unit_price || 0),
        line_total: lineTotal(line),
      }))
      .filter((line) => line.line_code && line.quantity > 0);

    if (validLines.length === 0)
      return alert(
        "Add at least one invoice line item from Line Items Master.",
      );

    try {
      setSaving(true);
      const totals = calculateTotals(validLines, form.tax_percent);

      const payload = {
        invoice_no: form.invoice_no.trim(),
        // Master-data mode: clients/vendors/projects come from public master tables.
        // Keep legacy module-level FK columns null to avoid old invoice_* FK violations.
        client_id: null,
        global_client_id: form.client_id ? Number(form.client_id) : null,
        vendor_id: null,
        global_vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        project_id: null,
        global_project_id: form.project_id ? Number(form.project_id) : null,
        milestone_id: form.milestone_id ? Number(form.milestone_id) : null,
        status_id: form.status_id ? Number(form.status_id) : null,
        amount: totals.grandTotal,
        subtotal: totals.subtotal,
        tax_percent: totals.taxPercent,
        grand_total: totals.grandTotal,
        currency: form.currency || "PKR",
        due_date: form.due_date || null,
        paid_date: form.paid_date || null,
        notes: form.notes || "",
      };

      let invoiceId = editingInvoice?.id;
      if (editingInvoice) {
        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingInvoice.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("invoices")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        invoiceId = Number(data.id);
      }

      if (!invoiceId)
        throw new Error("Invoice was saved but invoice id was not returned.");

      const { error: deleteLinesError } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", invoiceId);
      if (deleteLinesError) throw deleteLinesError;

      const linePayload = validLines.map((line) => ({
        invoice_id: invoiceId,
        line_code: line.line_code,
        line_item: line.line_item,
        unit_of_measurement: line.unit_of_measurement,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.line_total,
      }));

      const { error: insertLinesError } = await supabase
        .from("invoice_line_items")
        .insert(linePayload);
      if (insertLinesError) throw insertLinesError;

      setShowInvoiceModal(false);
      setEditingInvoice(null);
      setForm(emptyForm);
      setFormLines([{ ...emptyLine }]);
      await loadData();
    } catch (error: any) {
      console.error("Save invoice failed:", error);
      alert(
        error?.message ||
          "Failed to save invoice. Confirm invoice_line_items table and invoice total columns exist.",
      );
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

  function downloadCsvTemplate() {
    const csv = buildCsv(csvTemplateRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invoice_bulk_upload_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function resolveLookupId(
    table:
      | "clients"
      | "vendors"
      | "projects"
      | "invoice_milestones"
      | "invoice_statuses",
    list: DropdownItem[],
    name: string,
    required: boolean,
  ) {
    const cleanName = name.trim();
    if (!cleanName) {
      if (required)
        throw new Error(`Missing required lookup value for ${table}.`);
      return { id: null, list };
    }

    const existing = list.find(
      (item) => item.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (existing) return { id: existing.id, list };

    const { data: found, error: findError } = await supabase
      .from(table)
      .select("id, name")
      .ilike("name", cleanName)
      .maybeSingle();
    if (findError) throw findError;
    if (found?.id) {
      const normalized = normalizeDropdownRows([found])[0];
      return { id: normalized.id, list: [...list, normalized] };
    }

    const { data: inserted, error: insertError } = await supabase
      .from(table)
      .insert({ name: cleanName })
      .select("id, name")
      .single();
    if (insertError) throw insertError;

    const normalized = normalizeDropdownRows([inserted])[0];
    return { id: normalized.id, list: [...list, normalized] };
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setSaving(true);
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) return alert("CSV file is empty or invalid.");

      let clientLookup = [...clients];
      let vendorLookup = [...vendors];
      let projectLookup = [...projects];
      let milestoneLookup = [...milestones];
      let statusLookup = [...statuses];

      const payloads: any[] = [];
      const skipped: string[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const lineNo = index + 2;
        const invoiceNo = readCsvValue(row, [
          "invoice_no",
          "invoice no",
          "invoice",
        ]);
        const clientName = readCsvValue(row, [
          "client_name",
          "client name",
          "client",
        ]);
        const vendorName = readCsvValue(row, [
          "vendor_name",
          "vendor name",
          "vendor",
        ]);
        const projectName = readCsvValue(row, [
          "project_name",
          "project name",
          "project",
        ]);
        const milestoneName = readCsvValue(row, [
          "milestone",
          "milestone_name",
          "milestone name",
        ]);
        const statusName = readCsvValue(row, [
          "status",
          "status_name",
          "status name",
        ]);
        const currency = readCsvValue(row, ["currency"]) || "PKR";
        const taxPercentText = readCsvValue(row, [
          "tax_percent",
          "tax",
          "tax %",
        ]);
        const dueDate = readCsvValue(row, ["due_date", "due date"]);
        const paidDate = readCsvValue(row, ["paid_date", "paid date"]);
        const notes = readCsvValue(row, ["notes", "description", "remarks"]);

        if (!invoiceNo || !clientName || !projectName) {
          skipped.push(
            `Line ${lineNo}: invoice_no, client_name and project_name are required.`,
          );
          continue;
        }

        const clientResult = await resolveLookupId(
          "clients",
          clientLookup,
          clientName,
          true,
        );
        clientLookup = clientResult.list;
        const vendorResult = await resolveLookupId(
          "vendors",
          vendorLookup,
          vendorName,
          false,
        );
        vendorLookup = vendorResult.list;
        const projectResult = await resolveLookupId(
          "projects",
          projectLookup,
          projectName,
          true,
        );
        projectLookup = projectResult.list;
        const milestoneResult = await resolveLookupId(
          "invoice_milestones",
          milestoneLookup,
          milestoneName,
          false,
        );
        milestoneLookup = milestoneResult.list;
        const statusResult = await resolveLookupId(
          "invoice_statuses",
          statusLookup,
          statusName,
          false,
        );
        statusLookup = statusResult.list;

        payloads.push({
          invoice_no: invoiceNo.trim(),
          client_id: clientResult.id,
          vendor_id: vendorResult.id,
          project_id: projectResult.id,
          milestone_id: milestoneResult.id,
          status_id: statusResult.id,
          amount: 0,
          subtotal: 0,
          tax_percent: Number(taxPercentText || 0),
          grand_total: 0,
          currency: currency.trim().toUpperCase(),
          due_date: normalizeDateInput(dueDate),
          paid_date: normalizeDateInput(paidDate),
          notes,
        });
      }

      if (payloads.length === 0) {
        alert(
          `No valid invoice rows found.${skipped.length ? "\n\n" + skipped.slice(0, 8).join("\n") : ""}`,
        );
        return;
      }

      const { error } = await supabase.from("invoices").insert(payloads);
      if (error) throw error;

      await loadData();
      alert(
        `Uploaded ${payloads.length} invoice header(s). Open each invoice to add line items.${
          skipped.length
            ? `\nSkipped ${skipped.length} row(s):\n${skipped.slice(0, 8).join("\n")}`
            : ""
        }`,
      );
    } catch (error: any) {
      console.error("CSV upload failed:", error);
      alert(error?.message || "CSV upload failed.");
    } finally {
      setSaving(false);
    }
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

  function downloadReportPdf(invoice: Invoice) {
    const reportWindow = window.open("", "_blank", "width=980,height=760");
    if (!reportWindow)
      return alert(
        "Please allow pop-ups to download/print the invoice report.",
      );

    const currency = invoice.currency || "PKR";
    const lines = invoice.line_items ?? [];
    const subtotal = Number(
      invoice.subtotal ??
        lines.reduce(
          (sum, line) => sum + Number(line.line_total || lineTotal(line)),
          0,
        ),
    );
    const taxPercent = Number(invoice.tax_percent ?? 0);
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = Number(
      invoice.grand_total ?? invoice.amount ?? subtotal + taxAmount,
    );

    const rowsHtml = lines
      .map(
        (line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(line.line_code || "-")}</td>
          <td>${escapeHtml(line.line_item || "-")}</td>
          <td>${escapeHtml(line.unit_of_measurement || "-")}</td>
          <td class="num">${Number(line.quantity || 0).toLocaleString()}</td>
          <td class="num">${Number(line.unit_price || 0).toLocaleString()}</td>
          <td class="num strong">${Number(line.line_total || lineTotal(line)).toLocaleString()}</td>
        </tr>`,
      )
      .join("");

    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(invoice.invoice_no)} - Invoice Report</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; background: #e2e8f0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
            .page { width: 920px; margin: 24px auto; background: #fff; padding: 34px; border-radius: 18px; box-shadow: 0 20px 45px rgba(15, 23, 42, .16); }
            .top { display: flex; justify-content: space-between; gap: 22px; border-bottom: 3px solid #0f172a; padding-bottom: 20px; }
            h1 { margin: 0; font-size: 34px; letter-spacing: -1px; }
            .muted { color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
            .boxgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; min-height: 74px; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 800; margin-bottom: 7px; }
            .value { color: #0f172a; font-size: 14px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { background: #0f172a; color: white; text-align: left; padding: 10px 9px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
            td { padding: 10px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            .num { text-align: right; white-space: nowrap; }
            .strong { font-weight: 900; }
            .totals { width: 360px; margin-left: auto; margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
            .totalrow { display: flex; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .totalrow:last-child { border-bottom: 0; background: #0f172a; color: white; font-size: 15px; font-weight: 900; }
            .notes { margin-top: 22px; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; min-height: 80px; }
            .actions { display: flex; justify-content: flex-end; gap: 10px; margin: 0 auto 16px; width: 920px; }
            button { border: 0; background: #059669; color: white; font-weight: 900; padding: 11px 18px; border-radius: 12px; cursor: pointer; }
            @media print { body { background: #fff; } .page { width: auto; margin: 0; padding: 20px; border-radius: 0; box-shadow: none; } .actions { display: none; } }
          </style>
        </head>
        <body>
          <div class="actions"><button onclick="window.print()">Download / Save as PDF</button></div>
          <section class="page">
            <div class="top">
              <div>
                <div class="muted">Invoice Report</div>
                <h1>${escapeHtml(invoice.invoice_no)}</h1>
              </div>
              <div style="text-align:right">
                <div class="muted">Grand Total</div>
                <div style="font-size:26px;font-weight:900;margin-top:6px">${currency} ${grandTotal.toLocaleString()}</div>
              </div>
            </div>
            <div class="boxgrid">
              <div class="box"><div class="label">Client</div><div class="value">${escapeHtml(invoice.client_name || displayName(clients, invoice.client_id ?? invoice.global_client_id))}</div></div>
              <div class="box"><div class="label">Vendor</div><div class="value">${escapeHtml(invoice.vendor_name || displayName(vendors, invoice.vendor_id ?? invoice.global_vendor_id))}</div></div>
              <div class="box"><div class="label">Project</div><div class="value">${escapeHtml(invoice.project_name || displayName(projects, invoice.project_id ?? invoice.global_project_id))}</div></div>
              <div class="box"><div class="label">Milestone</div><div class="value">${escapeHtml(displayName(milestones, invoice.milestone_id))}</div></div>
              <div class="box"><div class="label">Status</div><div class="value">${escapeHtml(displayName(statuses, invoice.status_id))}</div></div>
              <div class="box"><div class="label">Due Date</div><div class="value">${escapeHtml(invoice.due_date || "-")}</div></div>
            </div>
            <table>
              <thead><tr><th>#</th><th>Code</th><th>Line Item</th><th>UOM</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Line Total</th></tr></thead>
              <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:#64748b">No line items found.</td></tr>`}</tbody>
            </table>
            <div class="totals">
              <div class="totalrow"><span>Subtotal</span><strong>${currency} ${subtotal.toLocaleString()}</strong></div>
              <div class="totalrow"><span>Tax (${taxPercent.toLocaleString()}%)</span><strong>${currency} ${taxAmount.toLocaleString()}</strong></div>
              <div class="totalrow"><span>Grand Total</span><span>${currency} ${grandTotal.toLocaleString()}</span></div>
            </div>
            <div class="notes"><div class="label">Notes</div><div>${escapeHtml(invoice.notes || "-")}</div></div>
          </section>
          <script>setTimeout(() => window.print(), 350);</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  }

  return (
    <main className="min-h-screen bg-[#eef3f9] px-6 py-10 lg:px-[120px] lg:py-14">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Invoices
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Create invoices with line items from Line Items Master, subtotal,
              optional tax and grand total.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
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
            <ActionButton onClick={downloadCsvTemplate}>
              Download CSV Template
            </ActionButton>
            <input
              id="invoice-csv-upload"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvUpload}
            />
            <label
              htmlFor="invoice-csv-upload"
              className="cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50"
            >
              Upload CSV
            </label>
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
            title="Total Grand Total"
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
              placeholder="Search invoice, client, vendor, project, status, line code, line item..."
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
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[#020617] text-white">
                  <tr>
                    <Th>Invoice No</Th>
                    <Th>Client</Th>
                    <Th>Vendor</Th>
                    <Th>Project</Th>
                    <Th>Status</Th>
                    <Th>Lines</Th>
                    <Th align="right">Subtotal</Th>
                    <Th align="right">Tax %</Th>
                    <Th align="right">Grand Total</Th>
                    <Th>Due Date</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        Loading invoices...
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const currency = invoice.currency || "PKR";
                      return (
                        <tr
                          key={invoice.id}
                          className="border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <Td className="font-bold">{invoice.invoice_no}</Td>
                          <Td>
                            {invoice.client_name ||
                              displayName(
                                clients,
                                invoice.client_id ?? invoice.global_client_id,
                              )}
                          </Td>
                          <Td>
                            {invoice.vendor_name ||
                              displayName(
                                vendors,
                                invoice.vendor_id ?? invoice.global_vendor_id,
                              )}
                          </Td>
                          <Td>
                            {invoice.project_name ||
                              displayName(
                                projects,
                                invoice.project_id ?? invoice.global_project_id,
                              )}
                          </Td>
                          <Td>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                              {displayName(statuses, invoice.status_id)}
                            </span>
                          </Td>
                          <Td>{invoice.line_items?.length || 0}</Td>
                          <Td align="right" className="font-bold">
                            {money(Number(invoice.subtotal || 0), currency)}
                          </Td>
                          <Td align="right">
                            {Number(invoice.tax_percent || 0).toLocaleString()}%
                          </Td>
                          <Td
                            align="right"
                            className="font-black text-emerald-700"
                          >
                            {money(
                              Number(
                                invoice.grand_total ?? invoice.amount ?? 0,
                              ),
                              currency,
                            )}
                          </Td>
                          <Td>{invoice.due_date || "-"}</Td>
                          <Td align="right">
                            <button
                              onClick={() => openReport(invoice)}
                              className="mr-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                            >
                              View
                            </button>
                            <button
                              onClick={() => downloadReportPdf(invoice)}
                              className="mr-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold hover:bg-slate-50"
                            >
                              PDF
                            </button>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showInvoiceModal && (
        <Modal onClose={() => setShowInvoiceModal(false)} maxWidth="max-w-7xl">
          <h2 className="mb-5 text-2xl font-black text-slate-950">
            {editingInvoice ? "Edit Invoice" : "Add Invoice"}
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
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
            <SelectStaticField
              label="Currency"
              value={form.currency}
              options={currencies}
              onChange={(v) => setForm({ ...form, currency: v })}
            />
            <Field
              label="Tax %"
              type="number"
              value={form.tax_percent}
              onChange={(v) => setForm({ ...form, tax_percent: v })}
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

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">
                  Invoice Line Items
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Select rows from line_items_master. Description, UOM and unit
                  price auto-fill.
                </p>
              </div>
              <button
                onClick={addLine}
                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800"
              >
                + Add Line
              </button>
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <Th>Line Code</Th>
                    <Th>Line Item</Th>
                    <Th>UOM</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Unit Price</Th>
                    <Th align="right">Line Total</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {formLines.map((line, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <select
                          value={
                            line.line_item_master_id
                              ? String(line.line_item_master_id)
                              : ""
                          }
                          onChange={(e) =>
                            selectMasterItem(index, e.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="">Select line code</option>
                          {lineMasterItems.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.line_code} — {item.line_item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">
                        {line.line_item || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {line.unit_of_measurement || "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, {
                              quantity: Number(e.target.value || 0),
                            })
                          }
                          className="h-10 w-28 rounded-lg border border-slate-300 px-3 text-right text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) =>
                            updateLine(index, {
                              unit_price: Number(e.target.value || 0),
                            })
                          }
                          className="h-10 w-32 rounded-lg border border-slate-300 px-3 text-right text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-950">
                        {Number(
                          line.line_total || lineTotal(line),
                        ).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => removeLine(index)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white">
              <TotalRow
                label="Subtotal"
                value={money(formTotals.subtotal, form.currency)}
              />
              <TotalRow
                label={`Tax (${formTotals.taxPercent.toLocaleString()}%)`}
                value={money(formTotals.taxAmount, form.currency)}
              />
              <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-sm font-black text-white">
                <span>Grand Total</span>
                <span>{money(formTotals.grandTotal, form.currency)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-600">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

      {showReportModal && reportInvoice && (
        <Modal onClose={() => setShowReportModal(false)} maxWidth="max-w-6xl">
          <InvoiceReport
            invoice={reportInvoice}
            clients={clients}
            vendors={vendors}
            projects={projects}
            milestones={milestones}
            statuses={statuses}
            money={money}
            displayName={displayName}
          />
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => downloadReportPdf(reportInvoice)}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Download PDF
            </button>
            <button
              onClick={() => setShowReportModal(false)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              Close
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

function InvoiceReport({
  invoice,
  clients,
  vendors,
  projects,
  milestones,
  statuses,
  money,
  displayName,
}: {
  invoice: Invoice;
  clients: DropdownItem[];
  vendors: DropdownItem[];
  projects: DropdownItem[];
  milestones: DropdownItem[];
  statuses: DropdownItem[];
  money: (value: number, currency?: string) => string;
  displayName: (
    list: DropdownItem[],
    id: string | number | null | undefined,
    fallback?: string,
  ) => string;
}) {
  const currency = invoice.currency || "PKR";
  const lines = invoice.line_items ?? [];
  const subtotal = Number(
    invoice.subtotal ??
      lines.reduce(
        (sum, line) => sum + Number(line.line_total || lineTotal(line)),
        0,
      ),
  );
  const taxPercent = Number(invoice.tax_percent ?? 0);
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = Number(
    invoice.grand_total ?? invoice.amount ?? subtotal + taxAmount,
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 border-b-2 border-slate-950 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Invoice Report
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {invoice.invoice_no}
          </h2>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Grand Total
          </p>
          <p className="mt-1 text-3xl font-black text-emerald-700">
            {money(grandTotal, currency)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ReportBox
          label="Client"
          value={
            invoice.client_name ||
            displayName(clients, invoice.client_id ?? invoice.global_client_id)
          }
        />
        <ReportBox
          label="Vendor"
          value={
            invoice.vendor_name ||
            displayName(vendors, invoice.vendor_id ?? invoice.global_vendor_id)
          }
        />
        <ReportBox
          label="Project"
          value={
            invoice.project_name ||
            displayName(
              projects,
              invoice.project_id ?? invoice.global_project_id,
            )
          }
        />
        <ReportBox
          label="Milestone"
          value={displayName(milestones, invoice.milestone_id)}
        />
        <ReportBox
          label="Status"
          value={displayName(statuses, invoice.status_id)}
        />
        <ReportBox label="Due Date" value={invoice.due_date || "-"} />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <Th>#</Th>
              <Th>Code</Th>
              <Th>Line Item</Th>
              <Th>UOM</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Unit Price</Th>
              <Th align="right">Line Total</Th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No line items found.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr
                  key={line.id ?? index}
                  className="border-t border-slate-100"
                >
                  <Td>{index + 1}</Td>
                  <Td className="font-bold">{line.line_code}</Td>
                  <Td>{line.line_item}</Td>
                  <Td>{line.unit_of_measurement}</Td>
                  <Td align="right">
                    {Number(line.quantity || 0).toLocaleString()}
                  </Td>
                  <Td align="right">
                    {Number(line.unit_price || 0).toLocaleString()}
                  </Td>
                  <Td align="right" className="font-black">
                    {Number(
                      line.line_total || lineTotal(line),
                    ).toLocaleString()}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 ml-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white">
        <TotalRow label="Subtotal" value={money(subtotal, currency)} />
        <TotalRow
          label={`Tax (${taxPercent.toLocaleString()}%)`}
          value={money(taxAmount, currency)}
        />
        <div className="flex items-center justify-between bg-slate-950 px-4 py-3 text-sm font-black text-white">
          <span>Grand Total</span>
          <span>{money(grandTotal, currency)}</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Notes
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-700">
          {invoice.notes || "-"}
        </p>
      </div>
    </div>
  );
}

function ReportBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value || "-"}</p>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
      <span className="font-bold text-slate-600">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
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
                {Number(amount || 0).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
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
        className={`relative max-h-[92vh] w-full ${maxWidth} overflow-auto rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-slate-200"
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
      className={`${align === "right" ? "text-right" : "text-left"} px-4 py-3 text-xs font-black uppercase tracking-wide`}
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
    <td
      className={`${align === "right" ? "text-right" : "text-left"} px-4 py-3 text-slate-700 ${className}`}
    >
      {children}
    </td>
  );
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
