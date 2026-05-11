"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

type Id = number;

type DropdownItem = {
  id: Id;
  name: string;
  workspace_id?: string | null;
  created_by?: string | null;
};

type Contact = {
  id: Id;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  designation: string | null;
  company: string | null;
  status: string | null;
};

type Booking = {
  id: Id;
  booking_no: string | null;
  client_id: Id | null;
  project_id: Id | null;
  global_client_id: Id | null;
  global_project_id: Id | null;
  booking_type_id: Id | null;
  status_id: Id | null;
  assigned_contact_id: Id | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  assigned_to?: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  workspace_id?: string | null;
  created_by?: string | null;
};

type BookingRow = Booking & {
  client_name: string;
  project_name: string;
  booking_type: string;
  status: string;
  assigned_contact_name: string;
  assigned_contact_email: string;
  assigned_contact_phone: string;
  assigned_contact_designation: string;
};

type WorkspaceContext = {
  userId: string;
  workspaceId: string;
};

type DropdownType = "client" | "project" | "type" | "status";

type FormState = {
  booking_no: string;
  client_id: string;
  project_id: string;
  booking_type_id: string;
  status_id: string;
  assigned_contact_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
};

const emptyForm: FormState = {
  booking_no: "",
  client_id: "",
  project_id: "",
  booking_type_id: "",
  status_id: "",
  assigned_contact_id: "",
  booking_date: "",
  start_time: "",
  end_time: "",
  location: "",
  notes: "",
};

const dropdownConfig: Record<
  DropdownType,
  {
    title: string;
    table: string;
    stateKey: "clients" | "projects" | "types" | "statuses";
  }
> = {
  client: { title: "Global Clients", table: "clients", stateKey: "clients" },
  project: {
    title: "Global Projects",
    table: "projects",
    stateKey: "projects",
  },
  type: { title: "Booking Types", table: "booking_types", stateKey: "types" },
  status: {
    title: "Booking Statuses",
    table: "booking_statuses",
    stateKey: "statuses",
  },
};

export default function BookingsPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [types, setTypes] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [ctx, setCtx] = useState<WorkspaceContext | null>(null);
  const [contextError, setContextError] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState<DropdownType | null>(null);
  const [dropdownName, setDropdownName] = useState("");
  const [editingDropdownId, setEditingDropdownId] = useState<Id | null>(null);

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
      workspaceId: membership.workspace_id as string,
    };
    setCtx(nextCtx);
    setContextError("");
    return nextCtx;
  }

  async function loadAll() {
    setLoading(true);
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) {
      setLoading(false);
      return;
    }

    await Promise.all([
      loadBookings(currentCtx),
      loadClients(currentCtx),
      loadProjects(currentCtx),
      loadTypes(currentCtx),
      loadStatuses(currentCtx),
      loadContacts(currentCtx),
    ]);
    setLoading(false);
  }

  async function loadBookings(currentCtx = ctx) {
    if (!currentCtx) return;

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id,booking_no,client_id,project_id,global_client_id,global_project_id,booking_type_id,status_id,assigned_contact_id,booking_date,start_time,end_time,location,assigned_to,notes,created_at,workspace_id,created_by",
      )
      .eq("workspace_id", currentCtx.workspaceId)
      .order("booking_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setBookings((data ?? []) as Booking[]);
  }

  async function loadDropdownTable(
    table: string,
    setter: (items: DropdownItem[]) => void,
    currentCtx = ctx,
  ) {
    if (!currentCtx) return;

    const { data, error } = await supabase
      .from(table)
      .select("id,name,workspace_id,created_by")
      .eq("workspace_id", currentCtx.workspaceId)
      .order("name", { ascending: true });

    if (error) {
      alert(`${table}: ${error.message}`);
      setter([]);
      return;
    }

    setter((data ?? []) as DropdownItem[]);
  }

  async function loadClients(currentCtx = ctx) {
    await loadDropdownTable("clients", setClients, currentCtx);
  }

  async function loadProjects(currentCtx = ctx) {
    await loadDropdownTable("projects", setProjects, currentCtx);
  }

  async function loadTypes(currentCtx = ctx) {
    await loadDropdownTable("booking_types", setTypes, currentCtx);
  }

  async function loadStatuses(currentCtx = ctx) {
    await loadDropdownTable("booking_statuses", setStatuses, currentCtx);
  }

  async function loadContacts(currentCtx = ctx) {
    if (!currentCtx) return;

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id,full_name,email,phone,designation,company,status,workspace_id",
      )
      .eq("workspace_id", currentCtx.workspaceId)
      .order("full_name", { ascending: true, nullsFirst: false });

    if (error) {
      alert(`contacts: ${error.message}`);
      setContacts([]);
      return;
    }

    setContacts((data ?? []) as Contact[]);
  }

  const clientMap = useMemo(() => makeNameMap(clients), [clients]);
  const projectMap = useMemo(() => makeNameMap(projects), [projects]);
  const typeMap = useMemo(() => makeNameMap(types), [types]);
  const statusMap = useMemo(() => makeNameMap(statuses), [statuses]);
  const contactMap = useMemo(
    () => new Map(contacts.map((x) => [x.id, x])),
    [contacts],
  );

  const bookingRows = useMemo<BookingRow[]>(() => {
    return bookings.map((b) => {
      const contact = b.assigned_contact_id
        ? contactMap.get(b.assigned_contact_id)
        : null;

      return {
        ...b,
        client_name: b.global_client_id
          ? (clientMap.get(b.global_client_id) ?? "-")
          : b.client_id
            ? (clientMap.get(b.client_id) ?? "-")
            : "-",
        project_name: b.global_project_id
          ? (projectMap.get(b.global_project_id) ?? "-")
          : b.project_id
            ? (projectMap.get(b.project_id) ?? "-")
            : "-",
        booking_type: b.booking_type_id
          ? (typeMap.get(b.booking_type_id) ?? "-")
          : "-",
        status: b.status_id ? (statusMap.get(b.status_id) ?? "-") : "-",
        assigned_contact_name: contact?.full_name ?? b.assigned_to ?? "-",
        assigned_contact_email: contact?.email ?? "",
        assigned_contact_phone: contact?.phone ?? "",
        assigned_contact_designation: contact?.designation ?? "",
      };
    });
  }, [bookings, clientMap, projectMap, typeMap, statusMap, contactMap]);

  const filteredBookings = useMemo(() => {
    const q = search.toLowerCase().trim();
    const rows = [...bookingRows].sort((a, b) => {
      const aDate = a.booking_date || "9999-12-31";
      const bDate = b.booking_date || "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(b.created_at ?? "").localeCompare(
        String(a.created_at ?? ""),
      );
    });

    if (!q) return rows;

    return rows.filter((b) =>
      [
        b.booking_no,
        b.client_name,
        b.project_name,
        b.booking_type,
        b.status,
        b.booking_date,
        b.location,
        b.assigned_contact_name,
        b.assigned_contact_email,
        b.assigned_contact_phone,
        b.assigned_contact_designation,
        b.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [bookingRows, search]);

  const summary = useMemo(() => {
    const total = bookingRows.length;
    const scheduled = bookingRows.filter((b) =>
      ["scheduled", "confirmed", "pending", "active"].includes(
        String(b.status ?? "").toLowerCase(),
      ),
    ).length;
    const completed = bookingRows.filter(
      (b) => String(b.status ?? "").toLowerCase() === "completed",
    ).length;
    const cancelled = bookingRows.filter((b) =>
      ["cancelled", "canceled"].includes(String(b.status ?? "").toLowerCase()),
    ).length;

    return { total, scheduled, completed, cancelled };
  }, [bookingRows]);

  function updateForm(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAddModal() {
    setEditingId(null);
    setForm(emptyForm);
    setShowBookingModal(true);
  }

  function startEdit(item: BookingRow) {
    setEditingId(item.id);
    setForm({
      booking_no: item.booking_no ?? "",
      client_id: item.global_client_id
        ? String(item.global_client_id)
        : item.client_id
          ? String(item.client_id)
          : "",
      project_id: item.global_project_id
        ? String(item.global_project_id)
        : item.project_id
          ? String(item.project_id)
          : "",
      booking_type_id: item.booking_type_id ? String(item.booking_type_id) : "",
      status_id: item.status_id ? String(item.status_id) : "",
      assigned_contact_id: item.assigned_contact_id
        ? String(item.assigned_contact_id)
        : "",
      booking_date: item.booking_date ?? "",
      start_time: item.start_time ?? "",
      end_time: item.end_time ?? "",
      location: item.location ?? "",
      notes: item.notes ?? "",
    });
    setShowBookingModal(true);
  }

  async function saveBooking(e: React.FormEvent) {
    e.preventDefault();

    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    if (!form.booking_no.trim()) return alert("Please enter booking number.");
    if (!form.client_id) return alert("Please select booking client.");
    if (!form.project_id) return alert("Please select booking project.");
    if (!form.booking_type_id) return alert("Please select booking type.");
    if (!form.status_id) return alert("Please select booking status.");

    setSaving(true);

    const payload = {
      booking_no: form.booking_no.trim(),

      // Legacy booking_clients / booking_projects columns are no longer used.
      // Master data now comes from public.clients and public.projects.
      client_id: null,
      project_id: null,

      global_client_id: toNumberOrNull(form.client_id),
      global_project_id: toNumberOrNull(form.project_id),
      booking_type_id: toNumberOrNull(form.booking_type_id),
      status_id: toNumberOrNull(form.status_id),
      assigned_contact_id: toNumberOrNull(form.assigned_contact_id),
      assigned_to: "",
      booking_date: form.booking_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = editingId
      ? await supabase
          .from("bookings")
          .update(payload)
          .eq("id", editingId)
          .eq("workspace_id", currentCtx.workspaceId)
      : await supabase.from("bookings").insert({
          ...payload,
          workspace_id: currentCtx.workspaceId,
          created_by: currentCtx.userId,
        });

    setSaving(false);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setShowBookingModal(false);
    setEditingId(null);
    setForm(emptyForm);
    await loadBookings(currentCtx);
  }

  async function deleteBooking(id: Id) {
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;
    if (!confirm("Delete this booking?")) return;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id)
      .eq("workspace_id", currentCtx.workspaceId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadBookings(currentCtx);
  }

  function openDropdownManager(type: DropdownType) {
    setDropdownModal(type);
    setDropdownName("");
    setEditingDropdownId(null);
  }

  async function saveDropdownItem(e: React.FormEvent) {
    e.preventDefault();
    if (!dropdownModal) return;

    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;

    const name = dropdownName.trim();
    if (!name) return alert("Please enter a name.");

    const config = dropdownConfig[dropdownModal];
    const result = editingDropdownId
      ? await supabase
          .from(config.table)
          .update({ name })
          .eq("id", editingDropdownId)
          .eq("workspace_id", currentCtx.workspaceId)
      : await supabase.from(config.table).insert({
          name,
          workspace_id: currentCtx.workspaceId,
          created_by: currentCtx.userId,
        });

    if (result.error) {
      alert(result.error.message);
      return;
    }

    setDropdownName("");
    setEditingDropdownId(null);
    await reloadDropdown(dropdownModal, currentCtx);
  }

  async function deleteDropdownItem(id: Id) {
    if (!dropdownModal) return;
    const currentCtx = await getWorkspaceContext();
    if (!currentCtx) return;
    if (
      !confirm("Delete this value? Existing bookings using it may be affected.")
    )
      return;

    const config = dropdownConfig[dropdownModal];
    const { error } = await supabase
      .from(config.table)
      .delete()
      .eq("id", id)
      .eq("workspace_id", currentCtx.workspaceId);

    if (error) {
      alert(error.message);
      return;
    }

    await reloadDropdown(dropdownModal, currentCtx);
  }

  async function reloadDropdown(type: DropdownType, currentCtx = ctx) {
    if (type === "client") await loadClients(currentCtx);
    if (type === "project") await loadProjects(currentCtx);
    if (type === "type") await loadTypes(currentCtx);
    if (type === "status") await loadStatuses(currentCtx);
  }

  function getDropdownItems(type: DropdownType | null) {
    if (type === "client") return clients;
    if (type === "project") return projects;
    if (type === "type") return types;
    if (type === "status") return statuses;
    return [];
  }

  function downloadBookingTemplate() {
    const csv = [
      "booking_no,client_name,project_name,booking_type,status,assigned_contact_email,booking_date,start_time,end_time,location,notes",
      "BK-001,Connect,NYC 2K Rollout,Meeting,Scheduled,person@example.com,2026-05-15,10:00,11:00,Conference Room,Initial booking discussion",
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bookings-upload-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef3f8] p-6">
        <div className="rounded-2xl border border-slate-800 bg-[#050505] px-10 py-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-green-500" />
          <p className="text-base font-bold text-white">Loading dashboard...</p>
          <p className="mt-1 text-sm text-slate-400">
            Please wait while data is being fetched
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f8] p-6 text-slate-950">
      {contextError ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {contextError}
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-green-600">Bookings</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Bookings Management Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Create and manage bookings using global master clients, projects,
              contacts, booking types, and statuses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadAll()}
              className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              Refresh Data
            </button>
            <button
              onClick={openAddModal}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700"
            >
              Add Booking
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total Bookings" value={summary.total} />
        <StatCard title="Scheduled" value={summary.scheduled} />
        <StatCard title="Completed" value={summary.completed} />
        <StatCard title="Cancelled" value={summary.cancelled} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">
            Quick Add Booking
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Clients, projects, and contacts come from global master data.
          </p>
          <BookingForm
            form={form}
            clients={clients}
            projects={projects}
            types={types}
            statuses={statuses}
            contacts={contacts}
            saving={saving}
            editingId={editingId}
            compact
            onSubmit={saveBooking}
            onChange={updateForm}
            onManage={openDropdownManager}
            onCancel={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Booking List</h2>
              <p className="mt-1 text-sm text-slate-500">
                Click any row to view full booking details.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={downloadBookingTemplate}
                className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-200"
              >
                Download CSV Template
              </button>
              <button
                onClick={openAddModal}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
              >
                Add Booking
              </button>
            </div>
          </div>

          <div className="mt-5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookings..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div className="mt-5 max-h-[560px] overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-left">Client / Project</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Date / Time</th>
                  <th className="px-4 py-3 text-left">Assigned To</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length ? (
                  filteredBookings.map((booking) => (
                    <tr
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold text-slate-950">
                          {booking.booking_no || "-"}
                        </p>
                        <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                          {booking.location || "No location"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900">
                          {booking.client_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {booking.project_name}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-700">
                        {booking.booking_type}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900">
                          {booking.booking_date || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTimeRange(
                            booking.start_time,
                            booking.end_time,
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900">
                          {booking.assigned_contact_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {booking.assigned_contact_email}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => startEdit(booking)}
                            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void deleteBooking(booking.id)}
                            className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No bookings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBookingModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-sm font-semibold text-green-600">Bookings</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {editingId ? "Edit Booking" : "Add Booking"}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <BookingForm
              form={form}
              clients={clients}
              projects={projects}
              types={types}
              statuses={statuses}
              contacts={contacts}
              saving={saving}
              editingId={editingId}
              onSubmit={saveBooking}
              onChange={updateForm}
              onManage={openDropdownManager}
              onCancel={() => {
                setShowBookingModal(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
            />
          </div>
        </div>
      ) : null}

      {dropdownModal ? (
        <DropdownManagerModal
          type={dropdownModal}
          title={dropdownConfig[dropdownModal].title}
          items={getDropdownItems(dropdownModal)}
          name={dropdownName}
          editingId={editingDropdownId}
          onNameChange={setDropdownName}
          onSubmit={saveDropdownItem}
          onEdit={(item) => {
            setEditingDropdownId(item.id);
            setDropdownName(item.name);
          }}
          onDelete={(id) => void deleteDropdownItem(id)}
          onClose={() => {
            setDropdownModal(null);
            setDropdownName("");
            setEditingDropdownId(null);
          }}
          onCancelEdit={() => {
            setEditingDropdownId(null);
            setDropdownName("");
          }}
        />
      ) : null}

      {selectedBooking ? (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      ) : null}
    </div>
  );
}

function BookingForm({
  form,
  clients,
  projects,
  types,
  statuses,
  contacts,
  saving,
  editingId,
  compact = false,
  onSubmit,
  onChange,
  onManage,
  onCancel,
}: {
  form: FormState;
  clients: DropdownItem[];
  projects: DropdownItem[];
  types: DropdownItem[];
  statuses: DropdownItem[];
  contacts: Contact[];
  saving: boolean;
  editingId: Id | null;
  compact?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (key: keyof FormState, value: string) => void;
  onManage: (type: DropdownType) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div
        className={
          compact ? "space-y-4" : "grid grid-cols-1 gap-4 md:grid-cols-2"
        }
      >
        <Input
          label="Booking No"
          value={form.booking_no}
          onChange={(v) => onChange("booking_no", v)}
          placeholder="BK-001"
        />
        <Input
          label="Booking Date"
          type="date"
          value={form.booking_date}
          onChange={(v) => onChange("booking_date", v)}
        />
      </div>

      <SelectWithManage
        label="Client"
        value={form.client_id}
        options={clients}
        placeholder="Select client from master data"
        onChange={(v) => onChange("client_id", v)}
        onManage={() => onManage("client")}
      />

      <SelectWithManage
        label="Project"
        value={form.project_id}
        options={projects}
        placeholder="Select project from master data"
        onChange={(v) => onChange("project_id", v)}
        onManage={() => onManage("project")}
      />

      <div
        className={
          compact ? "space-y-4" : "grid grid-cols-1 gap-4 md:grid-cols-2"
        }
      >
        <SelectWithManage
          label="Booking Type"
          value={form.booking_type_id}
          options={types}
          placeholder="Select type"
          onChange={(v) => onChange("booking_type_id", v)}
          onManage={() => onManage("type")}
        />
        <SelectWithManage
          label="Status"
          value={form.status_id}
          options={statuses}
          placeholder="Select status"
          onChange={(v) => onChange("status_id", v)}
          onManage={() => onManage("status")}
        />
      </div>

      <Select
        label="Assigned To"
        value={form.assigned_contact_id}
        options={contacts.map((x) => ({
          id: x.id,
          name:
            [x.full_name, x.email].filter(Boolean).join(" · ") ||
            `Contact ${x.id}`,
        }))}
        placeholder="Select contact"
        onChange={(v) => onChange("assigned_contact_id", v)}
      />

      <div
        className={
          compact ? "space-y-4" : "grid grid-cols-1 gap-4 md:grid-cols-2"
        }
      >
        <Input
          label="Start Time"
          type="time"
          value={form.start_time}
          onChange={(v) => onChange("start_time", v)}
        />
        <Input
          label="End Time"
          type="time"
          value={form.end_time}
          onChange={(v) => onChange("end_time", v)}
        />
      </div>

      <Input
        label="Location"
        value={form.location}
        onChange={(v) => onChange("location", v)}
        placeholder="Meeting room, site, or address"
      />

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          rows={compact ? 4 : 5}
          placeholder="Booking notes, agenda, or operational detail"
          className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : editingId ? "Update Booking" : "Add Booking"}
        </button>
        {editingId ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function SelectWithManage({
  label,
  value,
  options,
  placeholder,
  onChange,
  onManage,
}: {
  label: string;
  value: string;
  options: DropdownItem[];
  placeholder: string;
  onChange: (value: string) => void;
  onManage: () => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
        >
          <option value="">{placeholder}</option>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onManage}
          className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
        >
          Manage
        </button>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: DropdownItem[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500"
      >
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
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
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500"
      />
    </div>
  );
}

function DropdownManagerModal({
  title,
  items,
  name,
  editingId,
  onNameChange,
  onSubmit,
  onEdit,
  onDelete,
  onClose,
  onCancelEdit,
}: {
  type: DropdownType;
  title: string;
  items: DropdownItem[];
  name: string;
  editingId: Id | null;
  onNameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onEdit: (item: DropdownItem) => void;
  onDelete: (id: Id) => void;
  onClose: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-semibold text-green-600">Master Data</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex gap-2">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter name"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-green-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700"
          >
            {editingId ? "Update" : "Add"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
          ) : null}
        </form>

        <div className="mt-5 max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <p className="font-semibold text-slate-900">{item.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No values found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingDetailsModal({
  booking,
  onClose,
}: {
  booking: BookingRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-semibold text-green-600">
              Booking Details
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              {booking.booking_no || "-"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {booking.client_name} · {booking.project_name}
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
          <ModalCard title="Type" value={booking.booking_type} />
          <ModalCard title="Status" value={booking.status} />
          <ModalCard title="Date" value={booking.booking_date || "-"} />
          <ModalCard
            title="Time"
            value={formatTimeRange(booking.start_time, booking.end_time)}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoBox
            title="Assigned To"
            lines={[
              booking.assigned_contact_name,
              booking.assigned_contact_email,
              booking.assigned_contact_phone,
              booking.assigned_contact_designation,
            ]}
          />
          <InfoBox
            title="Location"
            lines={[booking.location || "No location added"]}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <h3 className="font-bold text-slate-950">Notes</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {booking.notes || "No notes added for this booking."}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  title,
  lines,
}: {
  title: string;
  lines: Array<string | null | undefined>;
}) {
  const visible = lines.filter(Boolean) as string[];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2 space-y-1 text-sm font-semibold text-slate-900">
        {visible.length ? (
          visible.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p>-</p>
        )}
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

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="mt-3 text-3xl font-bold text-slate-950">{value}</h3>
    </div>
  );
}

function makeNameMap(items: DropdownItem[]) {
  return new Map(items.map((item) => [item.id, item.name]));
}

function toNumberOrNull(value: string) {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return "-";
}
