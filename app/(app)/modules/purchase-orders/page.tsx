"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const currencies = ["PKR", "USD", "EUR", "GBP", "AED", "SAR", "CNY"];

type DropdownItem = {
  id: number;
  name: string;
};

type PurchaseOrder = {
  id: number;
  po_no: string;
  client_id: number | null;
  project_id: number | null;
  global_client_id?: number | null;
  global_project_id?: number | null;
  status_id: number | null;
  line_code: string;
  line_item: string;
  unit_price: number;
  unit_of_measurement: string | null;
  currency: string | null;
  quantity: number;
  delivery_date: string | null;
  notes: string | null;
  created_at?: string;
  client_name?: string | null;
  project_name?: string | null;
  status?: string | null;
};

type DropdownType = "client" | "project" | "status";

type PoHeaderForm = {
  po_no: string;
  client_id: string;
  project_id: string;
  status_id: string;
  currency: string;
  delivery_date: string;
  notes: string;
};

type PoLineForm = {
  id?: number;
  line_code: string;
  line_item: string;
  unit_price: string;
  unit_of_measurement: string;
  quantity: string;
};

type LineCatalogItem = {
  id?: number;
  line_code: string;
  line_item: string;
  unit_price: number;
  unit_of_measurement: string;
};

type PoGroup = {
  po_no: string;
  po_date: string | null;
  client_name: string | null;
  project_name: string | null;
  status: string | null;
  currency: string;
  total: number;
  rowCount: number;
  rows: PurchaseOrder[];
};

const emptyHeader: PoHeaderForm = {
  po_no: "",
  client_id: "",
  project_id: "",
  status_id: "",
  currency: "PKR",
  delivery_date: "",
  notes: "",
};

const emptyLine: PoLineForm = {
  line_code: "",
  line_item: "",
  unit_price: "",
  unit_of_measurement: "",
  quantity: "",
};

const emptyMasterLineItem = {
  line_code: "",
  line_item: "",
  unit_of_measurement: "",
  unit_price: "",
};

const defaultLineCatalog: LineCatalogItem[] = [
  {
    line_code: "LC-001-001",
    line_item: "Fiber Cable",
    unit_of_measurement: "Meter",
    unit_price: 3819,
  },
  {
    line_code: "LC-002-002",
    line_item: "Patch Cord",
    unit_of_measurement: "Piece",
    unit_price: 2403,
  },
  {
    line_code: "LC-008-008",
    line_item: "UPS Battery",
    unit_of_measurement: "Unit",
    unit_price: 8779,
  },
];

export default function PurchaseOrdersPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lineMasterFileRef = useRef<HTMLInputElement | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);

  const [headerForm, setHeaderForm] = useState<PoHeaderForm>(emptyHeader);
  const [lineRows, setLineRows] = useState<PoLineForm[]>([]);
  const [masterLineItems, setMasterLineItems] = useState<LineCatalogItem[]>([]);
  const [showLineMasterModal, setShowLineMasterModal] = useState(false);
  const [lineMasterForm, setLineMasterForm] = useState({
    ...emptyMasterLineItem,
  });
  const [editingMasterLineCode, setEditingMasterLineCode] = useState<
    string | null
  >(null);
  const [selectedMasterLineCodes, setSelectedMasterLineCodes] = useState<
    string[]
  >([]);
  const [lineMasterSearch, setLineMasterSearch] = useState("");
  const [editingPoNo, setEditingPoNo] = useState<string | null>(null);

  const [lineItemModalOpen, setLineItemModalOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [lineDraft, setLineDraft] = useState<PoLineForm>(emptyLine);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showPoModal, setShowPoModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState<DropdownType | null>(null);
  const [dropdownName, setDropdownName] = useState("");
  const [editingDropdownId, setEditingDropdownId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([
      loadOrders(),
      loadClients(),
      loadProjects(),
      loadStatuses(),
      loadLineItemsMaster(),
    ]);
    setLoading(false);
  }

  async function loadOrders() {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        `
        *,
        clients!global_client_id(name),
        projects!global_project_id(name),
        po_statuses(name)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setOrders(
      data?.map((po: any) => ({
        ...po,
        client_name: po.clients?.name ?? null,
        project_name: po.projects?.name ?? null,
        status: po.po_statuses?.name ?? null,
      })) ?? [],
    );
  }

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data ?? []);
  }

  async function loadProjects() {
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects(data ?? []);
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from("po_statuses")
      .select("*")
      .order("name");
    setStatuses(data ?? []);
  }

  async function loadLineItemsMaster() {
    const { data, error } = await supabase
      .from("line_items_master")
      .select("*")
      .order("line_code", { ascending: true })
      .range(0, 9999);

    // Keep page usable even if the master table is not ready.
    if (error) {
      console.warn("line_items_master load warning:", error.message);
      setMasterLineItems([]);
      return;
    }

    // Supports both old and new column names:
    // line_item OR item_description OR description
    // unit_of_measurement OR uom
    setMasterLineItems(
      (data ?? [])
        .map((item: any) => {
          const lineCode = String(item.line_code ?? item.code ?? "").trim();
          const description = String(
            item.line_item ?? item.item_description ?? item.description ?? "",
          ).trim();
          const uom = String(
            item.unit_of_measurement ?? item.uom ?? item.unit ?? "",
          ).trim();

          return {
            id: item.id,
            line_code: lineCode,
            line_item: description,
            unit_price: Number(item.unit_price ?? item.price ?? 0),
            unit_of_measurement: uom,
          };
        })
        .filter((item) => item.line_code),
    );
  }

  const lineCatalog = useMemo(() => {
    const map = new Map<string, LineCatalogItem>();

    for (const item of defaultLineCatalog) {
      map.set(item.line_code, item);
    }

    for (const item of masterLineItems) {
      if (!item.line_code) continue;
      map.set(item.line_code, item);
    }

    for (const po of orders) {
      if (!po.line_code) continue;
      map.set(po.line_code, {
        line_code: po.line_code,
        line_item: po.line_item ?? "",
        unit_price: Number(po.unit_price || 0),
        unit_of_measurement: po.unit_of_measurement ?? "",
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.line_code.localeCompare(b.line_code),
    );
  }, [orders, masterLineItems]);

  const filteredMasterLineItems = useMemo(() => {
    const q = lineMasterSearch.trim().toLowerCase();
    if (!q) return masterLineItems;

    return masterLineItems.filter((item) =>
      [
        item.line_code,
        item.line_item,
        item.unit_of_measurement,
        String(item.unit_price),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [masterLineItems, lineMasterSearch]);

  const allFilteredMasterSelected =
    filteredMasterLineItems.length > 0 &&
    filteredMasterLineItems.every((item) =>
      selectedMasterLineCodes.includes(item.line_code),
    );

  const poGroups = useMemo(() => {
    const map = new Map<string, PurchaseOrder[]>();

    for (const row of orders) {
      const key = row.po_no || `PO-${row.id}`;
      const existing = map.get(key) ?? [];
      existing.push(row);
      map.set(key, existing);
    }

    return Array.from(map.entries()).map(([poNo, rows]) => {
      const first = rows[0];
      const total = rows.reduce(
        (sum, row) =>
          sum + Number(row.unit_price || 0) * Number(row.quantity || 0),
        0,
      );

      return {
        po_no: poNo,
        po_date: first.delivery_date ?? first.created_at ?? null,
        client_name: first.client_name ?? null,
        project_name: first.project_name ?? null,
        status: first.status ?? null,
        currency: first.currency || "PKR",
        total,
        rowCount: rows.length,
        rows,
      } satisfies PoGroup;
    });
  }, [orders]);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return poGroups;

    return poGroups.filter((po) =>
      [
        po.po_no,
        po.po_date,
        po.client_name,
        po.project_name,
        po.status,
        po.currency,
        ...po.rows.flatMap((row) => [
          row.line_code,
          row.line_item,
          row.unit_of_measurement,
          row.notes,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [poGroups, search]);

  const summary = useMemo(() => {
    const totalOrders = poGroups.length;
    const totalByCurrency: Record<string, number> = {};
    const openByCurrency: Record<string, number> = {};
    const deliveredByCurrency: Record<string, number> = {};

    for (const po of poGroups) {
      const currency = po.currency || "PKR";
      const status = String(po.status || "").toLowerCase();

      totalByCurrency[currency] = (totalByCurrency[currency] || 0) + po.total;

      if (!["delivered", "closed", "cancelled"].includes(status)) {
        openByCurrency[currency] = (openByCurrency[currency] || 0) + po.total;
      }

      if (status === "delivered" || status === "closed") {
        deliveredByCurrency[currency] =
          (deliveredByCurrency[currency] || 0) + po.total;
      }
    }

    return {
      totalOrders,
      totalByCurrency,
      openByCurrency,
      deliveredByCurrency,
    };
  }, [poGroups]);

  const poTotal = useMemo(() => {
    return lineRows.reduce(
      (sum, row) =>
        sum + Number(row.quantity || 0) * Number(row.unit_price || 0),
      0,
    );
  }, [lineRows]);

  function formatNumber(value: number) {
    return Number(value || 0).toLocaleString();
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  }

  function openAddPo() {
    setHeaderForm(emptyHeader);
    setLineRows([]);
    setEditingPoNo(null);
    setShowPoModal(true);
  }

  function openEditPo(group: PoGroup) {
    const first = group.rows[0];

    setEditingPoNo(group.po_no);
    setHeaderForm({
      po_no: first.po_no ?? "",
      client_id: first.global_client_id ? String(first.global_client_id) : "",
      project_id: first.global_project_id
        ? String(first.global_project_id)
        : "",
      status_id: first.status_id ? String(first.status_id) : "",
      currency: first.currency ?? "PKR",
      delivery_date: first.delivery_date ?? "",
      notes: first.notes ?? "",
    });

    setLineRows(
      group.rows.map((row) => ({
        id: row.id,
        line_code: row.line_code ?? "",
        line_item: row.line_item ?? "",
        unit_price: String(row.unit_price ?? ""),
        unit_of_measurement: row.unit_of_measurement ?? "",
        quantity: String(row.quantity ?? ""),
      })),
    );

    setShowPoModal(true);
  }

  function addLineRow() {
    setEditingLineIndex(null);
    setLineDraft({ ...emptyLine });
    setLineSearch("");
    setLineItemModalOpen(true);
  }

  function openEditLineRow(index: number) {
    const row = lineRows[index];
    setEditingLineIndex(index);
    setLineDraft({ ...row });
    setLineSearch(row.line_code ? `${row.line_code} ${row.line_item}` : "");
    setLineItemModalOpen(true);
  }

  function closeLineItemModal() {
    setLineItemModalOpen(false);
    setEditingLineIndex(null);
    setLineDraft({ ...emptyLine });
    setLineSearch("");
  }

  function selectLineCatalogItem(item: LineCatalogItem) {
    setLineDraft((prev) => ({
      ...prev,
      line_code: item.line_code,
      line_item: item.line_item,
      unit_of_measurement: item.unit_of_measurement,
      unit_price: String(item.unit_price ?? 0),
    }));
    setLineSearch(`${item.line_code} ${item.line_item}`);
  }

  function saveLineItemToPo() {
    if (!lineDraft.line_code.trim()) return alert("Please select a line code.");
    if (Number(lineDraft.quantity || 0) <= 0) {
      return alert("Please enter quantity greater than zero.");
    }

    if (editingLineIndex === null) {
      setLineRows((prev) => [...prev, { ...lineDraft }]);
    } else {
      setLineRows((prev) =>
        prev.map((row, index) =>
          index === editingLineIndex ? { ...lineDraft } : row,
        ),
      );
    }

    closeLineItemModal();
  }

  function removeLineRow(index: number) {
    setLineRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineRow(index: number, key: keyof PoLineForm, value: string) {
    setLineRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  }

  function handleLineCodeChange(index: number, lineCode: string) {
    const selected = lineCatalog.find((item) => item.line_code === lineCode);

    setLineRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              line_code: lineCode,
              line_item: selected?.line_item ?? "",
              unit_of_measurement: selected?.unit_of_measurement ?? "",
              unit_price:
                selected?.unit_price !== undefined
                  ? String(selected.unit_price)
                  : "",
            }
          : row,
      ),
    );
  }

  async function savePo() {
    if (!headerForm.po_no.trim()) return alert("PO No is required.");
    if (!lineRows.length) return alert("Please add at least one line item.");

    const validLines = lineRows.filter(
      (row) => row.line_code.trim() && Number(row.quantity || 0) > 0,
    );

    if (!validLines.length) {
      return alert("Select line code and enter quantity for at least one row.");
    }

    const cleanPoNo = headerForm.po_no.trim();

    if (!editingPoNo) {
      const { data: existingPO, error: existingError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("po_no", cleanPoNo)
        .maybeSingle();

      if (existingError) return alert(existingError.message);

      if (existingPO) {
        return alert(
          `PO No "${cleanPoNo}" already exists. Please use a unique PO No.`,
        );
      }
    }

    const payload = validLines.map((row) => ({
      po_no: cleanPoNo,
      global_client_id: headerForm.client_id
        ? Number(headerForm.client_id)
        : null,
      global_project_id: headerForm.project_id
        ? Number(headerForm.project_id)
        : null,
      status_id: headerForm.status_id ? Number(headerForm.status_id) : null,
      line_code: row.line_code.trim(),
      line_item: row.line_item.trim(),
      unit_price: Number(row.unit_price || 0),
      unit_of_measurement: row.unit_of_measurement || null,
      currency: headerForm.currency || "PKR",
      quantity: Number(row.quantity || 0),
      delivery_date: headerForm.delivery_date || null,
      notes: headerForm.notes || null,
    }));

    if (editingPoNo) {
      const { error: deleteError } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("po_no", editingPoNo);

      if (deleteError) return alert(deleteError.message);
    }

    const { error: insertError } = await supabase
      .from("purchase_orders")
      .insert(payload);

    if (insertError) return alert(insertError.message);

    alert(editingPoNo ? "PO updated successfully." : "PO saved successfully.");

    setShowPoModal(false);
    setEditingPoNo(null);
    setHeaderForm(emptyHeader);
    setLineRows([]);
    await loadOrders();
  }
  async function deletePo(poNo: string) {
    if (!confirm("Delete this purchase order and all linked line items?"))
      return;

    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("po_no", poNo);

    if (error) return alert(error.message);

    await loadOrders();
  }

  function downloadCsvTemplate() {
    const headers = [
      "po_no",
      "client_name",
      "project_name",
      "status",
      "line_code",
      "line_item",
      "unit_price",
      "unit_of_measurement",
      "currency",
      "quantity",
      "delivery_date",
      "notes",
    ];

    const sampleRows = [
      [
        "PO-001",
        "Connect",
        "NYC 2K Rollout",
        "Issued",
        "LC-001-001",
        "Fiber Cable",
        "3819",
        "Meter",
        "PKR",
        "10",
        "2026-06-30",
        "Sample PO line 1",
      ],
      [
        "PO-001",
        "Connect",
        "NYC 2K Rollout",
        "Issued",
        "LC-008-008",
        "UPS Battery",
        "8779",
        "Unit",
        "PKR",
        "2",
        "2026-06-30",
        "Sample PO line 2",
      ],
    ];

    const csv = [
      headers.join(","),
      ...sampleRows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "purchase_orders_template.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function csvEscape(value: string) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  function parseCsv(text: string) {
    const rows: string[][] = [];
    let current = "";
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (current || row.length) {
          row.push(current.trim());
          rows.push(row);
          row = [];
          current = "";
        }
        if (char === "\r" && next === "\n") i++;
      } else {
        current += char;
      }
    }

    if (current || row.length) {
      row.push(current.trim());
      rows.push(row);
    }

    return rows;
  }

  async function handleCsvUpload(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      alert("CSV has no data rows.");
      return;
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1).filter((r) => r.some(Boolean));

    const get = (row: string[], key: string) => row[headers.indexOf(key)] ?? "";

    const clientMap = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
    const projectMap = new Map(
      projects.map((p) => [p.name.toLowerCase(), p.id]),
    );
    const statusMap = new Map(
      statuses.map((s) => [s.name.toLowerCase(), s.id]),
    );

    const payload = dataRows.map((row) => ({
      po_no: get(row, "po_no"),
      global_client_id:
        clientMap.get(get(row, "client_name").toLowerCase()) ?? null,
      global_project_id:
        projectMap.get(get(row, "project_name").toLowerCase()) ?? null,
      status_id: statusMap.get(get(row, "status").toLowerCase()) ?? null,
      line_code: get(row, "line_code"),
      line_item: get(row, "line_item"),
      unit_price: Number(get(row, "unit_price") || 0),
      unit_of_measurement: get(row, "unit_of_measurement") || null,
      currency: get(row, "currency") || "PKR",
      quantity: Number(get(row, "quantity") || 0),
      delivery_date: get(row, "delivery_date") || null,
      notes: get(row, "notes") || null,
    }));

    const valid = payload.filter((x) => x.po_no && x.line_code && x.line_item);

    if (!valid.length) {
      alert("No valid records found. Required: po_no, line_code, line_item.");
      return;
    }

    const { error } = await supabase.from("purchase_orders").insert(valid);

    if (error) {
      alert(error.message);
      return;
    }

    alert(`${valid.length} purchase order line records uploaded successfully.`);
    await loadOrders();

    if (fileRef.current) fileRef.current.value = "";
  }

  function openLineMasterModal() {
    setShowLineMasterModal(true);
    setLineMasterForm({ ...emptyMasterLineItem });
    setEditingMasterLineCode(null);
    setSelectedMasterLineCodes([]);
    setLineMasterSearch("");
  }

  function editMasterLineItem(item: LineCatalogItem) {
    setLineMasterForm({
      line_code: item.line_code,
      line_item: item.line_item,
      unit_of_measurement: item.unit_of_measurement,
      unit_price: String(item.unit_price ?? 0),
    });
    setEditingMasterLineCode(item.line_code);
  }

  function resetLineMasterForm() {
    setLineMasterForm({ ...emptyMasterLineItem });
    setEditingMasterLineCode(null);
  }

  async function saveMasterLineItem() {
    const lineCode = lineMasterForm.line_code.trim();
    const lineItem = lineMasterForm.line_item.trim();
    const uom = lineMasterForm.unit_of_measurement.trim();
    const price = Number(lineMasterForm.unit_price || 0);

    if (!lineCode || !lineItem || !uom) {
      alert("Line Code, Item Description and UOM are required.");
      return;
    }

    if (editingMasterLineCode) {
      const { error } = await supabase
        .from("line_items_master")
        .update({
          line_code: lineCode,
          line_item: lineItem,
          unit_of_measurement: uom,
          unit_price: price,
        })
        .eq("line_code", editingMasterLineCode);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("line_items_master").upsert(
        {
          line_code: lineCode,
          line_item: lineItem,
          unit_of_measurement: uom,
          unit_price: price,
        },
        { onConflict: "line_code" },
      );

      if (error) return alert(error.message);
    }

    resetLineMasterForm();
    await loadLineItemsMaster();
  }

  async function deleteMasterLineItem(lineCode: string) {
    if (!confirm("Delete this line item from master list?")) return;

    const { error } = await supabase
      .from("line_items_master")
      .delete()
      .eq("line_code", lineCode);

    if (error) return alert(error.message);

    setSelectedMasterLineCodes((prev) =>
      prev.filter((code) => code !== lineCode),
    );
    await loadLineItemsMaster();
  }

  async function bulkDeleteMasterLineItems() {
    if (!selectedMasterLineCodes.length) return;
    if (
      !confirm(
        `Delete ${selectedMasterLineCodes.length} selected line item(s)?`,
      )
    )
      return;

    const { error } = await supabase
      .from("line_items_master")
      .delete()
      .in("line_code", selectedMasterLineCodes);

    if (error) return alert(error.message);

    setSelectedMasterLineCodes([]);
    await loadLineItemsMaster();
  }

  function toggleMasterLineSelection(lineCode: string) {
    setSelectedMasterLineCodes((prev) =>
      prev.includes(lineCode)
        ? prev.filter((code) => code !== lineCode)
        : [...prev, lineCode],
    );
  }

  function toggleAllFilteredMasterLines() {
    const filteredCodes = filteredMasterLineItems.map((item) => item.line_code);

    if (allFilteredMasterSelected) {
      setSelectedMasterLineCodes((prev) =>
        prev.filter((code) => !filteredCodes.includes(code)),
      );
    } else {
      setSelectedMasterLineCodes((prev) =>
        Array.from(new Set([...prev, ...filteredCodes])),
      );
    }
  }

  function downloadLineItemsTemplate() {
    const headers = [
      "line_code",
      "line_item",
      "unit_of_measurement",
      "unit_price",
    ];
    const rows = [
      ["LC-001-001", "Fiber Cable", "Meter", "3819"],
      ["LC-008-008", "UPS Battery", "Unit", "8779"],
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "po_line_items_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleLineItemsCsvUpload(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length < 2) {
      alert("CSV has no data rows.");
      return;
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const get = (row: string[], keys: string[]) => {
      for (const key of keys) {
        const idx = headers.indexOf(key);
        if (idx >= 0) return row[idx] ?? "";
      }
      return "";
    };

    const payload = rows
      .slice(1)
      .filter((row) => row.some(Boolean))
      .map((row) => ({
        line_code: get(row, ["line_code", "code"]).trim(),
        line_item: get(row, [
          "line_item",
          "item_description",
          "description",
        ]).trim(),
        unit_of_measurement: get(row, [
          "unit_of_measurement",
          "uom",
          "unit",
        ]).trim(),
        unit_price: Number(get(row, ["unit_price", "price"]) || 0),
      }))
      .filter(
        (item) => item.line_code && item.line_item && item.unit_of_measurement,
      );

    if (!payload.length) {
      alert(
        "No valid rows found. Required columns: line_code, line_item, unit_of_measurement, unit_price.",
      );
      return;
    }

    const { error } = await supabase
      .from("line_items_master")
      .upsert(payload, { onConflict: "line_code" });

    if (error) return alert(error.message);

    alert(`${payload.length} line item(s) uploaded successfully.`);
    await loadLineItemsMaster();
    if (lineMasterFileRef.current) lineMasterFileRef.current.value = "";
  }

  function getDropdownItems() {
    if (dropdownModal === "client") return clients;
    if (dropdownModal === "project") return projects;
    if (dropdownModal === "status") return statuses;
    return [];
  }

  function getDropdownTable() {
    if (dropdownModal === "client") return "clients";
    if (dropdownModal === "project") return "projects";
    if (dropdownModal === "status") return "po_statuses";
    return "";
  }

  function getDropdownTitle() {
    if (dropdownModal === "client") return "Manage Clients";
    if (dropdownModal === "project") return "Manage Projects";
    if (dropdownModal === "status") return "Manage Statuses";
    return "";
  }

  async function refreshDropdown() {
    if (dropdownModal === "client") await loadClients();
    if (dropdownModal === "project") await loadProjects();
    if (dropdownModal === "status") await loadStatuses();
  }

  async function saveDropdownItem() {
    const table = getDropdownTable();
    if (!table || !dropdownName.trim()) return;

    const payload = { name: dropdownName.trim() };

    const { error } = editingDropdownId
      ? await supabase.from(table).update(payload).eq("id", editingDropdownId)
      : await supabase.from(table).insert(payload);

    if (error) return alert(error.message);

    setDropdownName("");
    setEditingDropdownId(null);
    await refreshDropdown();
    await loadOrders();
  }

  async function deleteDropdownItem(id: number) {
    const table = getDropdownTable();
    if (!table) return;
    if (!confirm("Delete this item? Existing POs will keep empty reference."))
      return;

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return alert(error.message);

    await refreshDropdown();
    await loadOrders();
  }

  function openDropdownModal(type: DropdownType) {
    setDropdownModal(type);
    setDropdownName("");
    setEditingDropdownId(null);
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
    <div className="px-[120px] py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Purchase Orders
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Manage purchase order header records with linked line items in a
            clean sub-form layout.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={() => openDropdownModal("client")}
            className="topBtn"
          >
            Manage Clients
          </button>
          <button
            onClick={() => openDropdownModal("project")}
            className="topBtn"
          >
            Manage Projects
          </button>
          <button
            onClick={() => openDropdownModal("status")}
            className="topBtn"
          >
            Manage Statuses
          </button>
          <button onClick={openLineMasterModal} className="topBtn">
            Manage Line Items
          </button>
          <button onClick={downloadCsvTemplate} className="topBtn">
            Download CSV Template
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvUpload(file);
            }}
          />

          <button onClick={() => fileRef.current?.click()} className="topBtn">
            Upload CSV
          </button>

          <button
            onClick={openAddPo}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            + Add PO
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total POs" value={String(summary.totalOrders)} />
        <CurrencyCard title="Total PO Value" data={summary.totalByCurrency} />
        <CurrencyCard title="Open PO Value" data={summary.openByCurrency} />
        <CurrencyCard
          title="Delivered / Closed Value"
          data={summary.deliveredByCurrency}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, client, project, status, line code, line item, currency..."
            className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500"
          />

          <button
            onClick={() => setSearch("")}
            className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold hover:bg-slate-50"
          >
            Reset
          </button>
        </div>

        <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-950 text-white">
                <Th>PO No</Th>
                <Th>PO Date</Th>
                <Th>Client</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Line Items</Th>
                <Th>PO Amount</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                filteredGroups.map((po) => (
                  <tr key={po.po_no} className="border-t border-slate-100">
                    <Td bold>{po.po_no}</Td>
                    <Td>{formatDate(po.po_date)}</Td>
                    <Td>{po.client_name ?? "-"}</Td>
                    <Td>{po.project_name ?? "-"}</Td>
                    <Td>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                        {po.status ?? "-"}
                      </span>
                    </Td>
                    <Td>{po.rowCount}</Td>
                    <Td bold>
                      {po.currency} {formatNumber(po.total)}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditPo(po)}
                          className="editBtn"
                        >
                          View / Edit
                        </button>
                        <button
                          onClick={() => deletePo(po.po_no)}
                          className="deleteBtn"
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

      {showPoModal && (
        <Modal
          title={editingPoNo ? "Edit Purchase Order" : "Add Purchase Order"}
          onClose={() => setShowPoModal(false)}
        >
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">
                    PO Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Header details remain same for all linked line items.
                  </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-slate-200">
                  <div className="text-[11px] font-extrabold uppercase text-slate-500">
                    PO Total
                  </div>
                  <div className="text-xl font-extrabold text-slate-950">
                    {headerForm.currency} {formatNumber(poTotal)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  label="PO No"
                  value={headerForm.po_no}
                  onChange={(v) => setHeaderForm({ ...headerForm, po_no: v })}
                />

                <Input
                  label="PO Date"
                  type="date"
                  value={headerForm.delivery_date}
                  onChange={(v) =>
                    setHeaderForm({ ...headerForm, delivery_date: v })
                  }
                />

                <Select
                  label="Client"
                  value={headerForm.client_id}
                  onChange={(v) =>
                    setHeaderForm({ ...headerForm, client_id: v })
                  }
                  items={clients}
                />

                <Select
                  label="Project"
                  value={headerForm.project_id}
                  onChange={(v) =>
                    setHeaderForm({ ...headerForm, project_id: v })
                  }
                  items={projects}
                />

                <Select
                  label="Status"
                  value={headerForm.status_id}
                  onChange={(v) =>
                    setHeaderForm({ ...headerForm, status_id: v })
                  }
                  items={statuses}
                />

                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700">
                    Currency
                  </label>
                  <select
                    value={headerForm.currency}
                    onChange={(e) =>
                      setHeaderForm({
                        ...headerForm,
                        currency: e.target.value,
                      })
                    }
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="mb-1 block text-sm font-bold text-slate-700">
                    Notes
                  </label>
                  <textarea
                    value={headerForm.notes}
                    onChange={(e) =>
                      setHeaderForm({ ...headerForm, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">
                    Line Items
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select line code. Description, UOM and unit price auto-fill.
                    Enter quantity only.
                  </p>
                </div>

                <button onClick={addLineRow} className="saveBtn">
                  + Add Row
                </button>
              </div>

              <div className="max-h-[430px] overflow-y-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[980px] table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-white">
                    <tr>
                      <th className="w-[160px] px-4 py-4 text-left text-xs font-semibold uppercase">
                        Line Code
                      </th>
                      <th className="w-[320px] px-4 py-4 text-left text-xs font-semibold uppercase">
                        Item Description
                      </th>
                      <th className="w-[130px] px-4 py-4 text-left text-xs font-semibold uppercase">
                        UOM
                      </th>
                      <th className="w-[150px] px-4 py-4 text-right text-xs font-semibold uppercase">
                        Unit Price
                      </th>
                      <th className="w-[110px] px-4 py-4 text-right text-xs font-semibold uppercase">
                        Qty
                      </th>
                      <th className="w-[170px] px-4 py-4 text-right text-xs font-semibold uppercase">
                        Total
                      </th>
                      <th className="w-[170px] px-4 py-4 text-right text-xs font-semibold uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {lineRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-slate-500"
                        >
                          No line items added yet. Click “Add Row” to open the
                          line item form.
                        </td>
                      </tr>
                    ) : (
                      lineRows.map((row, index) => {
                        const rowTotal =
                          Number(row.quantity || 0) *
                          Number(row.unit_price || 0);

                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-950">
                              {row.line_code}
                            </td>
                            <td className="px-4 py-4 text-slate-700">
                              <div className="line-clamp-2 max-w-[300px]">
                                {row.line_item}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                              {row.unit_of_measurement || "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                              {formatNumber(Number(row.unit_price || 0))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right text-slate-700">
                              {formatNumber(Number(row.quantity || 0))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right font-extrabold text-slate-950">
                              {headerForm.currency} {formatNumber(rowTotal)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openEditLineRow(index)}
                                  className="editBtn"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => removeLineRow(index)}
                                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-extrabold text-red-600 hover:bg-red-100"
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {lineItemModalOpen && (
                <LineItemFormModal
                  currency={headerForm.currency}
                  items={lineCatalog}
                  draft={lineDraft}
                  search={lineSearch}
                  onSearchChange={setLineSearch}
                  onDraftChange={setLineDraft}
                  onSelectItem={selectLineCatalogItem}
                  onClose={closeLineItemModal}
                  onSave={saveLineItemToPo}
                  formatNumber={formatNumber}
                  title={
                    editingLineIndex === null
                      ? "Add PO Line Item"
                      : "Edit PO Line Item"
                  }
                />
              )}
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-500">
                  Final PO Amount
                </p>
                <p className="text-2xl font-extrabold text-slate-950">
                  {headerForm.currency} {formatNumber(poTotal)}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPoModal(false)}
                  className="cancelBtn"
                >
                  Cancel
                </button>
                <button onClick={savePo} className="saveBtn">
                  Save PO
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showLineMasterModal && (
        <Modal
          title="Manage PO Line Items"
          onClose={() => setShowLineMasterModal(false)}
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-950">
                    Line Item Master
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Maintain reusable line code, item description, UOM and unit
                    price. PO line-item dropdowns are populated from this table.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {selectedMasterLineCodes.length > 0 && (
                    <button
                      onClick={bulkDeleteMasterLineItems}
                      className="deleteBtn"
                    >
                      Bulk Delete ({selectedMasterLineCodes.length})
                    </button>
                  )}
                  <button
                    onClick={downloadLineItemsTemplate}
                    className="topBtn"
                  >
                    Download Template
                  </button>
                  <input
                    ref={lineMasterFileRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLineItemsCsvUpload(file);
                    }}
                  />
                  <button
                    onClick={() => lineMasterFileRef.current?.click()}
                    className="topBtn"
                  >
                    Upload CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Input
                  label="Line Code"
                  value={lineMasterForm.line_code}
                  onChange={(v) =>
                    setLineMasterForm({ ...lineMasterForm, line_code: v })
                  }
                />
                <Input
                  label="Item Description"
                  value={lineMasterForm.line_item}
                  onChange={(v) =>
                    setLineMasterForm({ ...lineMasterForm, line_item: v })
                  }
                />
                <Input
                  label="UOM"
                  value={lineMasterForm.unit_of_measurement}
                  onChange={(v) =>
                    setLineMasterForm({
                      ...lineMasterForm,
                      unit_of_measurement: v,
                    })
                  }
                />
                <Input
                  label="Unit Price"
                  type="number"
                  value={lineMasterForm.unit_price}
                  onChange={(v) =>
                    setLineMasterForm({ ...lineMasterForm, unit_price: v })
                  }
                />
              </div>

              <div className="mt-4 flex justify-end gap-3">
                {editingMasterLineCode && (
                  <button onClick={resetLineMasterForm} className="cancelBtn">
                    Cancel Edit
                  </button>
                )}
                <button onClick={saveMasterLineItem} className="saveBtn">
                  {editingMasterLineCode
                    ? "Update Line Item"
                    : "+ Add Line Item"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex gap-3">
                <input
                  value={lineMasterSearch}
                  onChange={(e) => setLineMasterSearch(e.target.value)}
                  placeholder="Search line code, item description, UOM or price..."
                  className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => setLineMasterSearch("")}
                  className="cancelBtn"
                >
                  Reset
                </button>
              </div>

              <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-950 text-white">
                    <tr>
                      <th className="w-[50px] px-4 py-4">
                        <input
                          type="checkbox"
                          checked={allFilteredMasterSelected}
                          onChange={toggleAllFilteredMasterLines}
                        />
                      </th>
                      <Th>Line Code</Th>
                      <Th>Item Description</Th>
                      <Th>UOM</Th>
                      <Th align="right">Unit Price</Th>
                      <Th align="right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterLineItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm text-slate-500"
                        >
                          No line items found.
                        </td>
                      </tr>
                    ) : (
                      filteredMasterLineItems.map((item) => (
                        <tr
                          key={item.line_code}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedMasterLineCodes.includes(
                                item.line_code,
                              )}
                              onChange={() =>
                                toggleMasterLineSelection(item.line_code)
                              }
                            />
                          </td>
                          <Td bold>{item.line_code}</Td>
                          <Td>{item.line_item}</Td>
                          <Td>{item.unit_of_measurement}</Td>
                          <Td align="right">
                            {formatNumber(Number(item.unit_price || 0))}
                          </Td>
                          <Td align="right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => editMasterLineItem(item)}
                                className="editBtn"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  deleteMasterLineItem(item.line_code)
                                }
                                className="deleteBtn"
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
          </div>
        </Modal>
      )}

      {dropdownModal && (
        <Modal
          title={getDropdownTitle()}
          onClose={() => setDropdownModal(null)}
        >
          <div className="mb-4 flex gap-3">
            <input
              value={dropdownName}
              onChange={(e) => setDropdownName(e.target.value)}
              placeholder="Enter name..."
              className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500"
            />

            <button onClick={saveDropdownItem} className="saveBtn">
              {editingDropdownId ? "Update" : "Add"}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <Th>Name</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>

              <tbody>
                {getDropdownItems().map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <Td bold>{item.name}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDropdownName(item.name);
                            setEditingDropdownId(item.id);
                          }}
                          className="editBtn"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteDropdownItem(item.id)}
                          className="deleteBtn"
                        >
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .topBtn {
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 800;
          box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
        }
        .topBtn:hover {
          background: rgb(248 250 252);
        }
        .editBtn {
          border-radius: 0.5rem;
          border: 1px solid rgb(203 213 225);
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
        .cancelBtn {
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          background: white;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 800;
        }
        .cancelBtn:hover {
          background: rgb(248 250 252);
        }
        .saveBtn {
          border-radius: 0.75rem;
          background: rgb(5 150 105);
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 800;
          color: white;
        }
        .saveBtn:hover {
          background: rgb(4 120 87);
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-sm font-bold text-slate-600">{title}</div>
      <div className="mt-6 text-3xl font-extrabold text-slate-950">{value}</div>
    </div>
  );
}

function CurrencyCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const rows = Object.entries(data).filter(([, value]) => value > 0);

  return (
    <div className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mb-5 text-sm font-bold text-slate-600">{title}</div>

      {rows.length === 0 ? (
        <div className="text-3xl font-extrabold text-slate-950">0</div>
      ) : (
        <div className="space-y-3">
          {rows.map(([currency, value]) => (
            <div
              key={currency}
              className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0"
            >
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">
                {currency}
              </span>
              <span className="text-2xl font-extrabold text-slate-950">
                {Number(value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
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

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div className="max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              Microsoft Access style header form with linked sub-form line
              items.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(90vh-81px)] overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function Input({
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
      <label className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function LineItemFormModal({
  title,
  currency,
  items,
  draft,
  search,
  onSearchChange,
  onDraftChange,
  onSelectItem,
  onClose,
  onSave,
  formatNumber,
}: {
  title: string;
  currency: string;
  items: LineCatalogItem[];
  draft: PoLineForm;
  search: string;
  onSearchChange: (value: string) => void;
  onDraftChange: (value: PoLineForm) => void;
  onSelectItem: (item: LineCatalogItem) => void;
  onClose: () => void;
  onSave: () => void;
  formatNumber: (value: number) => string;
}) {
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      `${item.line_code} ${item.line_item} ${item.unit_of_measurement}`
        .toLowerCase()
        .includes(q),
    );
  }, [items, search]);

  const rowTotal = Number(draft.quantity || 0) * Number(draft.unit_price || 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-950">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Search and select line code. Description, UOM and unit price
              auto-fill. Enter quantity only.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-81px)] grid-cols-1 gap-5 overflow-y-auto p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="mb-2 block text-sm font-bold text-slate-700">
              Search Line Code / Item
            </label>
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Type line code, description or UOM..."
              autoFocus
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <div className="mt-4 max-h-[460px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No matching line item found.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const selected = item.line_code === draft.line_code;
                  return (
                    <button
                      key={item.line_code}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className={`flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left hover:bg-emerald-50 last:border-b-0 ${
                        selected
                          ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200"
                          : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-950">
                          {item.line_code}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {item.line_item}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-slate-500">
                        <div className="font-bold text-slate-700">
                          {item.unit_of_measurement || "-"}
                        </div>
                        <div className="mt-1 font-extrabold text-slate-950">
                          {Number(item.unit_price || 0).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyBox label="Line Code" value={draft.line_code} />
              <ReadOnlyBox label="UOM" value={draft.unit_of_measurement} />
              <ReadOnlyBox
                label="Unit Price"
                value={formatNumber(Number(draft.unit_price || 0))}
                align="right"
              />
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={draft.quantity}
                  onChange={(e) =>
                    onDraftChange({ ...draft, quantity: e.target.value })
                  }
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-right text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Item Description
              </label>
              <textarea
                value={draft.line_item}
                readOnly
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-500">
                  Row Total
                </p>
                <p className="text-2xl font-extrabold text-slate-950">
                  {currency} {formatNumber(rowTotal)}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="cancelBtn">
                  Cancel
                </button>
                <button onClick={onSave} className="saveBtn">
                  Save Line
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyBox({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <input
        value={value || ""}
        readOnly
        className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none ${
          align === "right" ? "text-right" : "text-left"
        }`}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: DropdownItem[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      >
        <option value="">Select</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}
