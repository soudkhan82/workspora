"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Workflow = {
  id: number;
  name: string;
  description: string | null;
  status: string | null;
};
type Stage = {
  id: number;
  workflow_id: number;
  name: string;
  position: number;
};
type Project = { id: number; name: string };
type Contact = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  company: string | null;
  status: string | null;
};
type Lookup = { id: number; name: string; color?: string | null };

type Task = {
  id: number;
  workflow_id: number;
  stage_id: number | null;
  project_id: number | null;
  title: string;
  description: string | null;
  assigned_contact_id: number | null;
  priority_id: number | null;
  task_status_id: number | null;
  priority: string | null;
  status: string | null;
  due_date: string | null;
  created_at?: string;
  project_name?: string | null;
  contact_name?: string | null;
  contact_designation?: string | null;
  priority_name?: string | null;
  status_name?: string | null;
};

type ManageType = "stage" | "priority" | "status" | "contact";

const emptyTask = {
  title: "",
  description: "",
  project_id: "",
  assigned_contact_id: "",
  priority_id: "",
  task_status_id: "",
  due_date: "",
  stage_id: "",
};

const emptyContact = {
  full_name: "",
  email: "",
  phone: "",
  designation: "",
  company: "",
  status: "Active",
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [priorities, setPriorities] = useState<Lookup[]>([]);
  const [statuses, setStatuses] = useState<Lookup[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTask);

  const [manageType, setManageType] = useState<ManageType | null>(null);
  const [lookupName, setLookupName] = useState("");
  const [lookupColor, setLookupColor] = useState("slate");
  const [stagePosition, setStagePosition] = useState("1");
  const [editingLookupId, setEditingLookupId] = useState<number | null>(null);

  const [contactForm, setContactForm] = useState(emptyContact);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) loadBoard(selectedWorkflow);
  }, [selectedWorkflow]);

  async function loadInitial() {
    setLoading(true);

    const [
      { data: wf },
      { data: ct },
      { data: pr },
      { data: st },
      { data: pj },
    ] = await Promise.all([
      supabase
        .from("workflows")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("contacts")
        .select("id, full_name, email, phone, designation, company, status")
        .order("full_name", { ascending: true }),
      supabase
        .from("workflow_priorities")
        .select("*")
        .order("id", { ascending: true }),
      supabase
        .from("workflow_task_statuses")
        .select("*")
        .order("id", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

    setWorkflows(wf ?? []);
    setContacts(ct ?? []);
    setPriorities(pr ?? []);
    setStatuses(st ?? []);
    setProjects(pj ?? []);

    if (wf?.length) setSelectedWorkflow(wf[0].id);
    setLoading(false);
  }

  async function loadBoard(workflowId: number) {
    const [{ data: stageData }, { data: taskData }] = await Promise.all([
      supabase
        .from("workflow_stages")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("position", { ascending: true }),
      supabase
        .from("workflow_tasks")
        .select(
          `*, contacts!assigned_contact_id(full_name, designation), workflow_priorities!priority_id(name, color), workflow_task_statuses!task_status_id(name), projects!project_id(name)`,
        )
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false }),
    ]);

    setStages(stageData ?? []);
    setTasks(
      (taskData ?? []).map((t: any) => ({
        ...t,
        project_name: t.projects?.name ?? null,
        contact_name: t.contacts?.full_name ?? null,
        contact_designation: t.contacts?.designation ?? null,
        priority_name: t.workflow_priorities?.name ?? t.priority ?? null,
        status_name: t.workflow_task_statuses?.name ?? t.status ?? null,
      })),
    );
  }

  async function refreshLookups() {
    const [{ data: ct }, { data: pr }, { data: st }, { data: pj }] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("id, full_name, email, phone, designation, company, status")
          .order("full_name", { ascending: true }),
        supabase.from("workflow_priorities").select("*").order("id"),
        supabase.from("workflow_task_statuses").select("*").order("id"),
        supabase.from("projects").select("id, name").order("name"),
      ]);

    setContacts(ct ?? []);
    setPriorities(pr ?? []);
    setStatuses(st ?? []);
    setProjects(pj ?? []);
    if (selectedWorkflow) await loadBoard(selectedWorkflow);
  }

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tasks;
    return tasks.filter((t) =>
      [
        t.title,
        t.description,
        t.project_name,
        t.priority_name,
        t.status_name,
        t.due_date,
        t.contact_name,
        t.contact_designation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [tasks, search]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: tasks.length,
      active: tasks.filter(
        (t) => String(t.status_name ?? "").toLowerCase() !== "completed",
      ).length,
      completed: tasks.filter(
        (t) => String(t.status_name ?? "").toLowerCase() === "completed",
      ).length,
      overdue: tasks.filter(
        (t) =>
          t.due_date &&
          t.due_date < today &&
          String(t.status_name ?? "").toLowerCase() !== "completed",
      ).length,
    };
  }, [tasks]);

  function openAddTask(stageId?: number) {
    setEditingTaskId(null);
    setTaskForm({
      ...emptyTask,
      stage_id: stageId
        ? String(stageId)
        : stages[0]
          ? String(stages[0].id)
          : "",
      priority_id: priorities[0] ? String(priorities[0].id) : "",
      task_status_id: statuses[0] ? String(statuses[0].id) : "",
    });
    setShowTaskModal(true);
  }

  function openEditTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title ?? "",
      description: task.description ?? "",
      project_id: task.project_id ? String(task.project_id) : "",
      assigned_contact_id: task.assigned_contact_id
        ? String(task.assigned_contact_id)
        : "",
      priority_id: task.priority_id ? String(task.priority_id) : "",
      task_status_id: task.task_status_id ? String(task.task_status_id) : "",
      due_date: task.due_date ?? "",
      stage_id: task.stage_id ? String(task.stage_id) : "",
    });
    setShowTaskModal(true);
  }

  async function saveTask() {
    if (!selectedWorkflow) return alert("Please select a workflow.");
    if (!taskForm.title.trim()) return alert("Task title is required.");

    const selectedPriority = priorities.find(
      (x) => String(x.id) === taskForm.priority_id,
    );
    const selectedStatus = statuses.find(
      (x) => String(x.id) === taskForm.task_status_id,
    );

    const payload = {
      workflow_id: selectedWorkflow,
      stage_id: taskForm.stage_id ? Number(taskForm.stage_id) : null,
      project_id: taskForm.project_id ? Number(taskForm.project_id) : null,
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      assigned_contact_id: taskForm.assigned_contact_id
        ? Number(taskForm.assigned_contact_id)
        : null,
      priority_id: taskForm.priority_id ? Number(taskForm.priority_id) : null,
      task_status_id: taskForm.task_status_id
        ? Number(taskForm.task_status_id)
        : null,
      priority: selectedPriority?.name ?? null,
      status: selectedStatus?.name ?? null,
      due_date: taskForm.due_date || null,
    };

    const { error } = editingTaskId
      ? await supabase
          .from("workflow_tasks")
          .update(payload)
          .eq("id", editingTaskId)
      : await supabase.from("workflow_tasks").insert(payload);

    if (error) return alert(error.message);

    setShowTaskModal(false);
    setEditingTaskId(null);
    setTaskForm(emptyTask);
    await loadBoard(selectedWorkflow);
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase
      .from("workflow_tasks")
      .delete()
      .eq("id", id);
    if (error) return alert(error.message);
    if (selectedWorkflow) await loadBoard(selectedWorkflow);
  }

  async function moveTask(task: Task, nextStageId: number) {
    const { error } = await supabase
      .from("workflow_tasks")
      .update({ stage_id: nextStageId })
      .eq("id", task.id);
    if (error) return alert(error.message);
    if (selectedWorkflow) await loadBoard(selectedWorkflow);
  }

  function tasksForStage(stageId: number) {
    return filteredTasks.filter((t) => t.stage_id === stageId);
  }

  function openManage(type: ManageType) {
    setManageType(type);
    setLookupName("");
    setLookupColor("slate");
    setStagePosition("1");
    setEditingLookupId(null);
    setEditingContactId(null);
    setContactForm(emptyContact);
  }

  async function saveLookup() {
    if (!manageType || !lookupName.trim()) return;

    if (manageType === "stage") {
      if (!selectedWorkflow) return alert("Select workflow first.");
      const payload = {
        workflow_id: selectedWorkflow,
        name: lookupName.trim(),
        position: Number(stagePosition || 1),
      };
      const { error } = editingLookupId
        ? await supabase
            .from("workflow_stages")
            .update(payload)
            .eq("id", editingLookupId)
        : await supabase.from("workflow_stages").insert(payload);
      if (error) return alert(error.message);
      setLookupName("");
      setStagePosition("1");
      setEditingLookupId(null);
      await loadBoard(selectedWorkflow);
      return;
    }

    if (manageType === "priority") {
      const payload = { name: lookupName.trim(), color: lookupColor };
      const { error } = editingLookupId
        ? await supabase
            .from("workflow_priorities")
            .update(payload)
            .eq("id", editingLookupId)
        : await supabase.from("workflow_priorities").insert(payload);
      if (error) return alert(error.message);
    }

    if (manageType === "status") {
      const payload = { name: lookupName.trim() };
      const { error } = editingLookupId
        ? await supabase
            .from("workflow_task_statuses")
            .update(payload)
            .eq("id", editingLookupId)
        : await supabase.from("workflow_task_statuses").insert(payload);
      if (error) return alert(error.message);
    }

    setLookupName("");
    setLookupColor("slate");
    setEditingLookupId(null);
    await refreshLookups();
  }

  async function deleteLookup(id: number) {
    if (!manageType) return;
    if (!confirm("Delete this item?")) return;
    const table =
      manageType === "stage"
        ? "workflow_stages"
        : manageType === "priority"
          ? "workflow_priorities"
          : "workflow_task_statuses";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return alert(error.message);
    if (manageType === "stage" && selectedWorkflow)
      await loadBoard(selectedWorkflow);
    else await refreshLookups();
  }

  async function saveContact() {
    if (!contactForm.full_name.trim())
      return alert("Contact name is required.");
    const payload = {
      full_name: contactForm.full_name.trim(),
      email: contactForm.email.trim() || null,
      phone: contactForm.phone.trim() || null,
      designation: contactForm.designation.trim() || null,
      company: contactForm.company.trim() || null,
      status: contactForm.status || "Active",
    };
    const { error } = editingContactId
      ? await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editingContactId)
      : await supabase.from("contacts").insert(payload);
    if (error) return alert(error.message);
    setContactForm(emptyContact);
    setEditingContactId(null);
    await refreshLookups();
  }

  async function deleteContact(id: number) {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return alert(error.message);
    await refreshLookups();
  }

  const manageItems =
    manageType === "stage"
      ? stages
      : manageType === "priority"
        ? priorities
        : manageType === "status"
          ? statuses
          : [];

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
    <div className="px-[120px] py-10">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Workflows
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage tasks, projects, approvals, assignments and workflow
              stages.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button onClick={() => openManage("stage")} className="btn-white">
              Manage Stages
            </button>
            <button
              onClick={() => openManage("priority")}
              className="btn-white"
            >
              Manage Priorities
            </button>
            <button onClick={() => openManage("status")} className="btn-white">
              Manage Statuses
            </button>
            <button onClick={() => openManage("contact")} className="btn-white">
              Manage Contacts
            </button>
            <button onClick={() => openAddTask()} className="btn-green">
              + Add Task
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Total Tasks" value={summary.total} />
        <SummaryCard title="Active Tasks" value={summary.active} />
        <SummaryCard title="Completed" value={summary.completed} />
        <SummaryCard title="Overdue" value={summary.overdue} />
      </div>

      <div className="mb-6 flex gap-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search task, project, assignee, priority, status, due date..."
          className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => setSearch("")}
          className="h-12 rounded-xl border border-slate-300 bg-white px-6 text-sm font-bold hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <main className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-h-[520px] gap-4 pb-2">
          {stages.map((stage) => {
            const stageTasks = tasksForStage(stage.id);
            return (
              <section
                key={stage.id}
                className="w-72 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-950">{stage.name}</h3>
                    <p className="text-xs text-slate-500">
                      {stageTasks.length} task(s)
                    </p>
                  </div>
                  <button
                    onClick={() => openAddTask(stage.id)}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-3">
                  {stageTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      stages={stages}
                      onEdit={() => openEditTask(task)}
                      onDelete={() => deleteTask(task.id)}
                      onMove={(stageId) => moveTask(task, stageId)}
                    />
                  ))}
                  {stageTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-400">
                      No tasks
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {showTaskModal && (
        <Modal
          title={editingTaskId ? "Edit Task" : "Add Task"}
          onClose={() => setShowTaskModal(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Task Title"
              value={taskForm.title}
              onChange={(v) => setTaskForm({ ...taskForm, title: v })}
            />
            <Select
              label="Project"
              value={taskForm.project_id}
              onChange={(v) => setTaskForm({ ...taskForm, project_id: v })}
              options={projects.map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
            />
            <Select
              label="Stage"
              value={taskForm.stage_id}
              onChange={(v) => setTaskForm({ ...taskForm, stage_id: v })}
              options={stages.map((s) => ({
                value: String(s.id),
                label: s.name,
              }))}
            />
            <Select
              label="Assigned To"
              value={taskForm.assigned_contact_id}
              onChange={(v) =>
                setTaskForm({ ...taskForm, assigned_contact_id: v })
              }
              options={contacts
                .filter((c) => c.status === "Active")
                .map((c) => ({
                  value: String(c.id),
                  label: `${c.full_name}${c.designation ? ` - ${c.designation}` : ""}`,
                }))}
            />
            <Select
              label="Priority"
              value={taskForm.priority_id}
              onChange={(v) => setTaskForm({ ...taskForm, priority_id: v })}
              options={priorities.map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
            />
            <Select
              label="Status"
              value={taskForm.task_status_id}
              onChange={(v) => setTaskForm({ ...taskForm, task_status_id: v })}
              options={statuses.map((s) => ({
                value: String(s.id),
                label: s.name,
              }))}
            />
            <Input
              label="Due Date"
              type="date"
              value={taskForm.due_date}
              onChange={(v) => setTaskForm({ ...taskForm, due_date: v })}
            />
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Description
              </label>
              <textarea
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowTaskModal(false)}
              className="btn-white"
            >
              Cancel
            </button>
            <button onClick={saveTask} className="btn-green">
              Save Task
            </button>
          </div>
        </Modal>
      )}

      {manageType && manageType !== "contact" && (
        <Modal
          title={
            manageType === "stage"
              ? "Manage Stages"
              : manageType === "priority"
                ? "Manage Priorities"
                : "Manage Statuses"
          }
          onClose={() => setManageType(null)}
        >
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <input
              value={lookupName}
              onChange={(e) => setLookupName(e.target.value)}
              placeholder="Name"
              className="h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500 md:col-span-5"
            />
            {manageType === "stage" && (
              <input
                value={stagePosition}
                onChange={(e) => setStagePosition(e.target.value)}
                placeholder="Position"
                type="number"
                className="h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-emerald-500 md:col-span-3"
              />
            )}
            {manageType === "priority" && (
              <select
                value={lookupColor}
                onChange={(e) => setLookupColor(e.target.value)}
                className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-500 md:col-span-3"
              >
                <option value="green">Green</option>
                <option value="amber">Amber</option>
                <option value="red">Red</option>
                <option value="rose">Rose</option>
                <option value="slate">Slate</option>
              </select>
            )}
            <button
              onClick={saveLookup}
              className="h-12 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 md:col-span-4"
            >
              {editingLookupId ? "Update" : "Add"}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manageItems.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingLookupId(item.id);
                            setLookupName(item.name);
                            setLookupColor(item.color ?? "slate");
                            setStagePosition(String(item.position ?? 1));
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLookup(item.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {manageType === "contact" && (
        <Modal title="Manage Contacts" onClose={() => setManageType(null)}>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              label="Full Name"
              value={contactForm.full_name}
              onChange={(v) => setContactForm({ ...contactForm, full_name: v })}
            />
            <Input
              label="Email"
              value={contactForm.email}
              onChange={(v) => setContactForm({ ...contactForm, email: v })}
            />
            <Input
              label="Phone"
              value={contactForm.phone}
              onChange={(v) => setContactForm({ ...contactForm, phone: v })}
            />
            <Input
              label="Designation"
              value={contactForm.designation}
              onChange={(v) =>
                setContactForm({ ...contactForm, designation: v })
              }
            />
            <Input
              label="Company"
              value={contactForm.company}
              onChange={(v) => setContactForm({ ...contactForm, company: v })}
            />
            <Select
              label="Status"
              value={contactForm.status}
              onChange={(v) => setContactForm({ ...contactForm, status: v })}
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
            />
          </div>
          <button
            onClick={saveContact}
            className="mb-5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700"
          >
            {editingContactId ? "Update Contact" : "Add Contact"}
          </button>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{c.full_name}</td>
                    <td className="px-4 py-3">{c.designation ?? "-"}</td>
                    <td className="px-4 py-3">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3">{c.status ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingContactId(c.id);
                            setContactForm({
                              full_name: c.full_name ?? "",
                              email: c.email ?? "",
                              phone: c.phone ?? "",
                              designation: c.designation ?? "",
                              company: c.company ?? "",
                              status: c.status ?? "Active",
                            });
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteContact(c.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        .btn-white {
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .btn-white:hover {
          background: #f8fafc;
        }
        .btn-green {
          border-radius: 0.75rem;
          background: #059669;
          padding: 0.75rem 1.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: white;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .btn-green:hover {
          background: #047857;
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-4 text-3xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function TaskCard({
  task,
  stages,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  stages: Stage[];
  onEdit: () => void;
  onDelete: () => void;
  onMove: (stageId: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-950">{task.title}</h4>
        <PriorityBadge value={task.priority_name ?? "Medium"} />
      </div>
      <div className="mb-2 text-xs font-bold text-emerald-700">
        {task.project_name ?? "No project"}
      </div>
      {task.description && (
        <p className="mb-3 line-clamp-2 text-xs text-slate-500">
          {task.description}
        </p>
      )}
      <div className="mb-3 rounded-lg bg-slate-50 p-3">
        <div className="text-xs font-bold text-slate-700">
          {task.contact_name ?? "Unassigned"}
        </div>
        <div className="text-xs text-slate-500">
          {task.contact_designation ?? "No designation"}
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-slate-500">Due</span>
        <span className="font-bold text-slate-800">{task.due_date ?? "-"}</span>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-slate-500">Status</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">
          {task.status_name ?? "-"}
        </span>
      </div>
      <select
        value={task.stage_id ?? ""}
        onChange={(e) => onMove(Number(e.target.value))}
        className="mb-3 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            Move to {s.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const cls =
    value === "Critical"
      ? "bg-red-600 text-white"
      : value === "High"
        ? "bg-red-100 text-red-700"
        : value === "Medium"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${cls}`}>
      {value}
    </span>
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
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
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
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
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
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}
