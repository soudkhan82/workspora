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

type Contact = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  company: string | null;
  status: string | null;
};

type Booking = {
  id: number;
  booking_no: string;
  client_id: number | null;
  project_id: number | null;
  global_client_id?: number | null;
  global_project_id?: number | null;
  booking_type_id: number | null;
  status_id: number | null;
  assigned_contact_id: number | null;
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at?: string;
  client_name?: string | null;
  project_name?: string | null;
  booking_type?: string | null;
  status?: string | null;
  assigned_contact_name?: string | null;
  assigned_contact_email?: string | null;
  assigned_contact_phone?: string | null;
  assigned_contact_designation?: string | null;
};

type DropdownType = "client" | "project" | "type" | "status";

const emptyForm = {
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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<DropdownItem[]>([]);
  const [projects, setProjects] = useState<DropdownItem[]>([]);
  const [types, setTypes] = useState<DropdownItem[]>([]);
  const [statuses, setStatuses] = useState<DropdownItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showBookingModal, setShowBookingModal] = useState(false);
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
      loadBookings(),
      loadClients(),
      loadProjects(),
      loadTypes(),
      loadStatuses(),
      loadContacts(),
    ]);
    setLoading(false);
  }

  async function loadBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        clients!global_client_id(name),
        projects!global_project_id(name),
        booking_types(name),
        booking_statuses(name),
        contacts!assigned_contact_id(full_name,email,phone,designation)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const mapped =
      data?.map((b: any) => ({
        ...b,
        client_name: b.clients?.name ?? null,
        project_name: b.projects?.name ?? null,
        booking_type: b.booking_types?.name ?? null,
        status: b.booking_statuses?.name ?? null,
        assigned_contact_name: b.contacts?.full_name ?? b.assigned_to ?? null,
        assigned_contact_email: b.contacts?.email ?? null,
        assigned_contact_phone: b.contacts?.phone ?? null,
        assigned_contact_designation: b.contacts?.designation ?? null,
      })) ?? [];

    setBookings(mapped);
  }

  async function loadClients() {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data ?? []);
  }

  async function loadProjects() {
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects(data ?? []);
  }

  async function loadTypes() {
    const { data } = await supabase
      .from("booking_types")
      .select("*")
      .order("name");
    setTypes(data ?? []);
  }

  async function loadStatuses() {
    const { data } = await supabase
      .from("booking_statuses")
      .select("*")
      .order("name");
    setStatuses(data ?? []);
  }

  async function loadContacts() {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone, designation, company, status")
      .order("full_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setContacts(data ?? []);
  }

  const filteredBookings = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return bookings;

    return bookings.filter((b) =>
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
  }, [bookings, search]);

  const summary = useMemo(() => {
    const total = bookings.length;
    const scheduled = bookings.filter((b) =>
      ["scheduled", "confirmed", "pending"].includes(
        String(b.status ?? "").toLowerCase(),
      ),
    ).length;
    const completed = bookings.filter(
      (b) => String(b.status ?? "").toLowerCase() === "completed",
    ).length;
    const cancelled = bookings.filter(
      (b) => String(b.status ?? "").toLowerCase() === "cancelled",
    ).length;

    return { total, scheduled, completed, cancelled };
  }, [bookings]);

  function openAddBooking() {
    setForm(emptyForm);
    setEditingId(null);
    setShowBookingModal(true);
  }

  function openEditBooking(booking: Booking) {
    setEditingId(booking.id);
    setForm({
      booking_no: booking.booking_no ?? "",
      client_id: booking.global_client_id
        ? String(booking.global_client_id)
        : "",
      project_id: booking.global_project_id
        ? String(booking.global_project_id)
        : "",
      booking_type_id: booking.booking_type_id
        ? String(booking.booking_type_id)
        : "",
      status_id: booking.status_id ? String(booking.status_id) : "",
      assigned_contact_id: booking.assigned_contact_id
        ? String(booking.assigned_contact_id)
        : "",
      booking_date: booking.booking_date ?? "",
      start_time: booking.start_time ? booking.start_time.slice(0, 5) : "",
      end_time: booking.end_time ? booking.end_time.slice(0, 5) : "",
      location: booking.location ?? "",
      notes: booking.notes ?? "",
    });
    setShowBookingModal(true);
  }

  async function saveBooking() {
    if (!form.booking_no.trim()) {
      alert("Booking No is required.");
      return;
    }

    const selectedContact = contacts.find(
      (c) => String(c.id) === form.assigned_contact_id,
    );

    const payload = {
      booking_no: form.booking_no.trim(),
      global_client_id: form.client_id ? Number(form.client_id) : null,
      global_project_id: form.project_id ? Number(form.project_id) : null,
      booking_type_id: form.booking_type_id
        ? Number(form.booking_type_id)
        : null,
      status_id: form.status_id ? Number(form.status_id) : null,
      assigned_contact_id: form.assigned_contact_id
        ? Number(form.assigned_contact_id)
        : null,
      assigned_to: selectedContact?.full_name ?? null,
      booking_date: form.booking_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("bookings").update(payload).eq("id", editingId)
      : await supabase.from("bookings").insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    setShowBookingModal(false);
    setForm(emptyForm);
    setEditingId(null);
    await loadBookings();
  }

  async function deleteBooking(id: number) {
    if (!confirm("Delete this booking?")) return;

    const { error } = await supabase.from("bookings").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadBookings();
  }

  function getDropdownItems() {
    if (dropdownModal === "client") return clients;
    if (dropdownModal === "project") return projects;
    if (dropdownModal === "type") return types;
    if (dropdownModal === "status") return statuses;
    return [];
  }

  function getDropdownTable() {
    if (dropdownModal === "client") return "clients";
    if (dropdownModal === "project") return "projects";
    if (dropdownModal === "type") return "booking_types";
    if (dropdownModal === "status") return "booking_statuses";
    return "";
  }

  function getDropdownTitle() {
    if (dropdownModal === "client") return "Manage Clients";
    if (dropdownModal === "project") return "Manage Projects";
    if (dropdownModal === "type") return "Manage Booking Types";
    if (dropdownModal === "status") return "Manage Statuses";
    return "";
  }

  async function refreshDropdown() {
    if (dropdownModal === "client") await loadClients();
    if (dropdownModal === "project") await loadProjects();
    if (dropdownModal === "type") await loadTypes();
    if (dropdownModal === "status") await loadStatuses();
  }

  async function saveDropdownItem() {
    const table = getDropdownTable();

    if (!table || !dropdownName.trim()) return;

    const payload = { name: dropdownName.trim() };

    const { error } = editingDropdownId
      ? await supabase.from(table).update(payload).eq("id", editingDropdownId)
      : await supabase.from(table).insert(payload);

    if (error) {
      alert(error.message);
      return;
    }

    setDropdownName("");
    setEditingDropdownId(null);
    await refreshDropdown();
    await loadBookings();
  }

  async function deleteDropdownItem(id: number) {
    const table = getDropdownTable();

    if (!table) return;
    if (
      !confirm("Delete this item? Existing bookings will keep empty reference.")
    )
      return;

    const { error } = await supabase.from(table).delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await refreshDropdown();
    await loadBookings();
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
            Bookings
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Manage booking records, clients, projects, booking types, statuses,
            schedules and assignments.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={() => openDropdownModal("client")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Clients
          </button>

          <button
            onClick={() => openDropdownModal("project")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Projects
          </button>

          <button
            onClick={() => openDropdownModal("type")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Types
          </button>

          <button
            onClick={() => openDropdownModal("status")}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold shadow-sm hover:bg-slate-50"
          >
            Manage Statuses
          </button>

          <button
            onClick={openAddBooking}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            + Add Booking
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total Bookings" value={summary.total} />
        <SummaryCard title="Scheduled / Active" value={summary.scheduled} />
        <SummaryCard title="Completed" value={summary.completed} />
        <SummaryCard title="Cancelled" value={summary.cancelled} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking, client, project, type, status, location, assigned person..."
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
                <Th>Booking No</Th>
                <Th>Client</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Location</Th>
                <Th>Assigned To</Th>
                <Th>Actions</Th>
              </tr>
            </thead>

            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No bookings found.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-slate-100">
                    <Td bold>{booking.booking_no}</Td>
                    <Td>{booking.client_name ?? "-"}</Td>
                    <Td>{booking.project_name ?? "-"}</Td>
                    <Td>{booking.booking_type ?? "-"}</Td>
                    <Td>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                        {booking.status ?? "-"}
                      </span>
                    </Td>
                    <Td>{booking.booking_date ?? "-"}</Td>
                    <Td>
                      {booking.start_time || booking.end_time
                        ? `${booking.start_time?.slice(0, 5) ?? "-"} - ${
                            booking.end_time?.slice(0, 5) ?? "-"
                          }`
                        : "-"}
                    </Td>
                    <Td>{booking.location ?? "-"}</Td>
                    <Td>
                      <div className="font-bold text-slate-900">
                        {booking.assigned_contact_name ?? "-"}
                      </div>
                      {booking.assigned_contact_designation && (
                        <div className="text-xs text-slate-500">
                          {booking.assigned_contact_designation}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditBooking(booking)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteBooking(booking.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
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

      {showBookingModal && (
        <Modal
          title={editingId ? "Edit Booking" : "Add Booking"}
          onClose={() => setShowBookingModal(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Booking No"
              value={form.booking_no}
              onChange={(v) => setForm({ ...form, booking_no: v })}
            />

            <Select
              label="Client"
              value={form.client_id}
              onChange={(v) => setForm({ ...form, client_id: v })}
              items={clients}
            />

            <Select
              label="Project"
              value={form.project_id}
              onChange={(v) => setForm({ ...form, project_id: v })}
              items={projects}
            />

            <Select
              label="Booking Type"
              value={form.booking_type_id}
              onChange={(v) => setForm({ ...form, booking_type_id: v })}
              items={types}
            />

            <Select
              label="Status"
              value={form.status_id}
              onChange={(v) => setForm({ ...form, status_id: v })}
              items={statuses}
            />

            <ContactSelect
              label="Assigned To"
              value={form.assigned_contact_id}
              onChange={(v) => setForm({ ...form, assigned_contact_id: v })}
              items={contacts}
            />

            <Input
              label="Booking Date"
              type="date"
              value={form.booking_date}
              onChange={(v) => setForm({ ...form, booking_date: v })}
            />

            <Input
              label="Start Time"
              type="time"
              value={form.start_time}
              onChange={(v) => setForm({ ...form, start_time: v })}
            />

            <Input
              label="End Time"
              type="time"
              value={form.end_time}
              onChange={(v) => setForm({ ...form, end_time: v })}
            />

            <Input
              label="Location"
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowBookingModal(false)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              onClick={saveBooking}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Save Booking
            </button>
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

            <button
              onClick={saveDropdownItem}
              className="h-12 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700"
            >
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
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteDropdownItem(item.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
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
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="min-h-[150px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-sm font-bold text-slate-600">{title}</div>
      <div className="mt-6 text-3xl font-extrabold text-slate-950">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-4 text-xs font-extrabold uppercase">{children}</th>
  );
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td
      className={`px-4 py-4 align-middle ${
        bold ? "font-extrabold text-slate-950" : "text-slate-900"
      }`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-2xl font-extrabold text-slate-950">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {children}
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
        className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500"
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
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500"
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

function ContactSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: Contact[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500"
      >
        <option value="">Select contact</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.full_name}
            {item.designation ? ` - ${item.designation}` : ""}
            {item.phone ? ` - ${item.phone}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
