"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createClientBrowser } from "@/app/lib/supabase/browser";

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
  workspace_id?: string | null;
  created_by?: string | null;
};

type Project = { id: number; name: string };

type Contact = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  company: string | null;
  department?: string | null;
  status: string | null;
};

type Lookup = {
  id: number;
  name: string;
  color?: string | null;
  workspace_id?: string | null;
  created_by?: string | null;
};

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
  workspace_id?: string | null;
  created_by?: string | null;
  project_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_designation?: string | null;
  priority_name?: string | null;
  priority_color?: string | null;
  status_name?: string | null;
  stage_name?: string | null;
};

type ManageType = "stage" | "priority" | "status" | "contact";
type ViewMode = "board" | "table";
type DueFilter = "all" | "overdue" | "today" | "week";
type CsvMode = "append" | "overwrite";

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
  department: "",
  status: "Active",
};

const emptyWorkflow = {
  name: "",
  description: "",
  status: "Active",
};

const WORKFLOW_CSV_HEADERS = [
  "task_title",
  "project_name",
  "description",
  "stage",
  "priority",
  "status",
  "assigned_to_email",
  "due_date",
];

export default function WorkflowsPage() {
  const supabase = useMemo(() => createClientBrowser(), []);

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [priorities, setPriorities] = useState<Lookup[]>([]);
  const [statuses, setStatuses] = useState<Lookup[]>([]);

  const [selectedWorkflow, setSelectedWorkflow] = useState<number | null>(null);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTask);

  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowForm, setWorkflowForm] = useState(emptyWorkflow);
  const [editingWorkflowId, setEditingWorkflowId] = useState<number | null>(
    null,
  );
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvMode, setCsvMode] = useState<CsvMode>("append");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [manageType, setManageType] = useState<ManageType | null>(null);
  const [lookupName, setLookupName] = useState("");
  const [lookupColor, setLookupColor] = useState("slate");
  const [stagePosition, setStagePosition] = useState("1");
  const [editingLookupId, setEditingLookupId] = useState<number | null>(null);

  const [contactForm, setContactForm] = useState(emptyContact);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedWorkflow) void loadBoard(selectedWorkflow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedWorkflow,
    currentWorkspaceId,
    contacts,
    projects,
    priorities,
    statuses,
  ]);

  async function loadSessionContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCurrentUserId(null);
      setCurrentWorkspaceId(null);
      return { user: null, workspaceId: null as string | null };
    }

    setCurrentUserId(user.id);

    const { data: memberships } = await supabase
      .from("workspace_members")
      .select("workspace_id, status")
      .eq("user_id", user.id);

    const activeMembership = (memberships ?? []).find(
      (member: any) =>
        String(member.status ?? "active")
          .trim()
          .toLowerCase() === "active",
    );

    const workspaceId =
      activeMembership?.workspace_id ?? memberships?.[0]?.workspace_id ?? null;

    setCurrentWorkspaceId(workspaceId ? String(workspaceId) : null);

    return { user, workspaceId: workspaceId ? String(workspaceId) : null };
  }

  function applyWorkspaceFilter(query: any, workspaceId: string | null) {
    return workspaceId ? query.eq("workspace_id", workspaceId) : query;
  }

  function normalizeContactRows(rows: any[] | null | undefined): Contact[] {
    return (rows ?? [])
      .map((row: any) => ({
        id: Number(row.id),
        full_name: String(row.full_name ?? row.name ?? "").trim(),
        email: row.email ?? null,
        phone: row.phone ?? null,
        designation: row.designation ?? null,
        company: row.company ?? null,
        department: row.department ?? null,
        status: row.status ?? "Active",
      }))
      .filter((row) => row.id && row.full_name);
  }

  async function fetchMasterContacts(workspaceId: string | null) {
    let query = supabase
      .from("contacts")
      .select(
        "id, full_name, email, phone, designation, company, department, status, workspace_id, created_by",
      );

    query = applyWorkspaceFilter(query, workspaceId);
    const result = await query.order("full_name", { ascending: true });

    return {
      data: normalizeContactRows(result.data),
      error: result.error,
    };
  }

  async function fetchMasterProjects(workspaceId: string | null) {
    let query = supabase
      .from("projects")
      .select("id, name, workspace_id, created_by");
    query = applyWorkspaceFilter(query, workspaceId);
    return query.order("name", { ascending: true });
  }

  async function fetchPriorities(workspaceId: string | null) {
    let query = supabase
      .from("workflow_priorities")
      .select("id, name, color, workspace_id, created_by, created_at");
    query = applyWorkspaceFilter(query, workspaceId);
    return query.order("id", { ascending: true });
  }

  async function fetchStatuses(workspaceId: string | null) {
    let query = supabase
      .from("workflow_task_statuses")
      .select("id, name, workspace_id, created_by, created_at");
    query = applyWorkspaceFilter(query, workspaceId);
    return query.order("id", { ascending: true });
  }

  async function loadInitial() {
    setLoading(true);

    try {
      const { workspaceId } = await loadSessionContext();

      let workflowsQuery = supabase.from("workflows").select("*");
      workflowsQuery = applyWorkspaceFilter(workflowsQuery, workspaceId);

      const [
        { data: wf, error: wfError },
        contactsResult,
        { data: pr, error: prError },
        { data: st, error: stError },
        { data: pj, error: pjError },
      ] = await Promise.all([
        workflowsQuery.order("created_at", { ascending: true }),
        fetchMasterContacts(workspaceId),
        fetchPriorities(workspaceId),
        fetchStatuses(workspaceId),
        fetchMasterProjects(workspaceId),
      ]);

      const firstError =
        wfError ?? contactsResult.error ?? prError ?? stError ?? pjError;

      if (firstError) {
        console.error("Workflow load failed:", firstError);
        alert(firstError.message || "Failed to load workflow data.");
        return;
      }

      setWorkflows(wf ?? []);
      setContacts(contactsResult.data ?? []);
      setPriorities(pr ?? []);
      setStatuses(st ?? []);
      setProjects(
        (pj ?? []).map((p: any) => ({ id: Number(p.id), name: p.name })),
      );

      if (wf?.length) {
        setSelectedWorkflow((current) => {
          const currentStillExists = wf.some(
            (workflow: Workflow) => workflow.id === current,
          );
          return currentStillExists ? current : wf[0].id;
        });
      } else {
        setSelectedWorkflow(null);
        setStages([]);
        setTasks([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadBoard(workflowId: number) {
    setBoardLoading(true);

    try {
      let stageQuery = supabase
        .from("workflow_stages")
        .select("*")
        .eq("workflow_id", workflowId);

      let taskQuery = supabase
        .from("workflow_tasks")
        .select("*")
        .eq("workflow_id", workflowId);

      stageQuery = applyWorkspaceFilter(stageQuery, currentWorkspaceId);
      taskQuery = applyWorkspaceFilter(taskQuery, currentWorkspaceId);

      const [
        { data: stageData, error: stageError },
        { data: taskData, error: taskError },
      ] = await Promise.all([
        stageQuery.order("position", { ascending: true }),
        taskQuery.order("created_at", { ascending: false }),
      ]);

      if (stageError || taskError) {
        console.error("Workflow board load failed:", stageError ?? taskError);
        alert(
          (stageError ?? taskError)?.message ||
            "Failed to load workflow board.",
        );
        return;
      }

      const nextStages = (stageData ?? []).map((s: any) => ({
        ...s,
        id: Number(s.id),
        workflow_id: Number(s.workflow_id),
        position: Number(s.position ?? 0),
      }));

      const projectById = new Map(projects.map((p) => [Number(p.id), p]));
      const contactById = new Map(contacts.map((c) => [Number(c.id), c]));
      const priorityById = new Map(priorities.map((p) => [Number(p.id), p]));
      const statusById = new Map(statuses.map((s) => [Number(s.id), s]));
      const stageById = new Map(nextStages.map((s) => [Number(s.id), s]));

      setStages(nextStages);
      setTasks(
        (taskData ?? []).map((t: any) => {
          const project = t.project_id
            ? projectById.get(Number(t.project_id))
            : null;
          const contact = t.assigned_contact_id
            ? contactById.get(Number(t.assigned_contact_id))
            : null;
          const priority = t.priority_id
            ? priorityById.get(Number(t.priority_id))
            : null;
          const status = t.task_status_id
            ? statusById.get(Number(t.task_status_id))
            : null;
          const stage = t.stage_id ? stageById.get(Number(t.stage_id)) : null;

          return {
            ...t,
            id: Number(t.id),
            workflow_id: Number(t.workflow_id),
            stage_id: t.stage_id ? Number(t.stage_id) : null,
            project_id: t.project_id ? Number(t.project_id) : null,
            assigned_contact_id: t.assigned_contact_id
              ? Number(t.assigned_contact_id)
              : null,
            priority_id: t.priority_id ? Number(t.priority_id) : null,
            task_status_id: t.task_status_id ? Number(t.task_status_id) : null,
            project_name: project?.name ?? null,
            contact_name: contact?.full_name ?? null,
            contact_email: contact?.email ?? null,
            contact_designation: contact?.designation ?? null,
            priority_name: priority?.name ?? t.priority ?? null,
            priority_color: priority?.color ?? null,
            status_name: status?.name ?? t.status ?? null,
            stage_name: stage?.name ?? null,
          };
        }),
      );
    } finally {
      setBoardLoading(false);
    }
  }

  async function refreshLookups() {
    const { workspaceId } = await loadSessionContext();

    const [contactsResult, { data: pr }, { data: st }, { data: pj }] =
      await Promise.all([
        fetchMasterContacts(workspaceId),
        fetchPriorities(workspaceId),
        fetchStatuses(workspaceId),
        fetchMasterProjects(workspaceId),
      ]);

    setContacts(contactsResult.data ?? []);
    setPriorities(pr ?? []);
    setStatuses(st ?? []);
    setProjects(
      (pj ?? []).map((p: any) => ({ id: Number(p.id), name: p.name })),
    );
  }

  const selectedWorkflowRow = useMemo(
    () =>
      workflows.find((workflow) => workflow.id === selectedWorkflow) ?? null,
    [workflows, selectedWorkflow],
  );

  const filteredTasks = useMemo(() => {
    const q = search.toLowerCase().trim();
    const today = new Date().toISOString().slice(0, 10);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndString = weekEnd.toISOString().slice(0, 10);

    return tasks.filter((task) => {
      if (q) {
        const searchable = [
          task.title,
          task.description,
          task.project_name,
          task.priority_name,
          task.status_name,
          task.stage_name,
          task.due_date,
          task.contact_name,
          task.contact_email,
          task.contact_designation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(q)) return false;
      }

      if (projectFilter && String(task.project_id ?? "") !== projectFilter)
        return false;
      if (
        assigneeFilter &&
        String(task.assigned_contact_id ?? "") !== assigneeFilter
      )
        return false;
      if (priorityFilter && String(task.priority_id ?? "") !== priorityFilter)
        return false;
      if (statusFilter && String(task.task_status_id ?? "") !== statusFilter)
        return false;

      const completed = isCompletedTask(task);
      if (
        dueFilter === "overdue" &&
        !(task.due_date && task.due_date < today && !completed)
      ) {
        return false;
      }
      if (dueFilter === "today" && task.due_date !== today) return false;
      if (
        dueFilter === "week" &&
        !(
          task.due_date &&
          task.due_date >= today &&
          task.due_date <= weekEndString
        )
      ) {
        return false;
      }

      return true;
    });
  }, [
    tasks,
    search,
    projectFilter,
    assigneeFilter,
    priorityFilter,
    statusFilter,
    dueFilter,
  ]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: tasks.length,
      open: tasks.filter((t) => !isCompletedTask(t)).length,
      inProgress: tasks.filter((t) =>
        `${t.status_name ?? ""} ${t.stage_name ?? ""}`
          .toLowerCase()
          .includes("progress"),
      ).length,
      completed: tasks.filter(isCompletedTask).length,
      overdue: tasks.filter(
        (t) => t.due_date && t.due_date < today && !isCompletedTask(t),
      ).length,
      highPriority: tasks.filter((t) =>
        ["critical", "high"].includes(
          String(t.priority_name ?? t.priority ?? "").toLowerCase(),
        ),
      ).length,
    };
  }, [tasks]);

  const selectedCount = selectedTaskIds.length;

  function resetFilters() {
    setSearch("");
    setProjectFilter("");
    setAssigneeFilter("");
    setPriorityFilter("");
    setStatusFilter("");
    setDueFilter("all");
  }

  function toggleSelectedTask(taskId: number) {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  }

  function toggleAllFiltered() {
    const filteredIds = filteredTasks.map((task) => task.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedTaskIds.includes(id));

    setSelectedTaskIds((current) => {
      if (allSelected) return current.filter((id) => !filteredIds.includes(id));
      return Array.from(new Set([...current, ...filteredIds]));
    });
  }

  function tasksForStage(stageId: number) {
    return filteredTasks.filter((task) => task.stage_id === stageId);
  }

  function isOverdue(task: Task) {
    const today = new Date().toISOString().slice(0, 10);
    return Boolean(
      task.due_date && task.due_date < today && !isCompletedTask(task),
    );
  }

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

    setSavingTask(true);

    try {
      const { user, workspaceId } = await loadSessionContext();

      if (!user || !workspaceId) {
        alert("User workspace session not found. Please login again.");
        return;
      }

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
        workspace_id: workspaceId,
        created_by: user.id,
      };

      const { error } = editingTaskId
        ? await supabase
            .from("workflow_tasks")
            .update(payload)
            .eq("id", editingTaskId)
            .eq("workspace_id", workspaceId)
        : await supabase.from("workflow_tasks").insert(payload);

      if (error) {
        alert(error.message);
        return;
      }

      setShowTaskModal(false);
      setEditingTaskId(null);
      setTaskForm(emptyTask);
      await loadBoard(selectedWorkflow);
    } finally {
      setSavingTask(false);
    }
  }

  async function deleteTask(id: number) {
    if (!confirm("Delete this task?")) return;

    let query = supabase.from("workflow_tasks").delete().eq("id", id);
    if (currentWorkspaceId)
      query = query.eq("workspace_id", currentWorkspaceId);

    const { error } = await query;

    if (error) return alert(error.message);
    setSelectedTaskIds((current) => current.filter((taskId) => taskId !== id));
    if (selectedWorkflow) await loadBoard(selectedWorkflow);
  }

  async function deleteSelectedTasks() {
    if (selectedTaskIds.length === 0) return;
    if (!confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)) return;

    setBulkDeleting(true);

    try {
      let query = supabase
        .from("workflow_tasks")
        .delete()
        .in("id", selectedTaskIds);
      if (currentWorkspaceId)
        query = query.eq("workspace_id", currentWorkspaceId);

      const { error } = await query;

      if (error) {
        alert(error.message);
        return;
      }

      setSelectedTaskIds([]);
      if (selectedWorkflow) await loadBoard(selectedWorkflow);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function moveTask(task: Task, nextStageId: number) {
    let query = supabase
      .from("workflow_tasks")
      .update({ stage_id: nextStageId })
      .eq("id", task.id);

    if (currentWorkspaceId)
      query = query.eq("workspace_id", currentWorkspaceId);

    const { error } = await query;

    if (error) return alert(error.message);
    if (selectedWorkflow) await loadBoard(selectedWorkflow);
  }

  function openCreateWorkflow() {
    setEditingWorkflowId(null);
    setWorkflowForm(emptyWorkflow);
    setShowWorkflowModal(true);
  }

  function openEditWorkflow(workflow: Workflow | null) {
    if (!workflow) return;

    setEditingWorkflowId(workflow.id);
    setWorkflowForm({
      name: workflow.name ?? "",
      description: workflow.description ?? "",
      status: workflow.status ?? "Active",
    });
    setShowWorkflowModal(true);
  }

  async function saveWorkflow() {
    if (!workflowForm.name.trim()) return alert("Workflow name is required.");

    setSavingWorkflow(true);

    try {
      const { user, workspaceId } = await loadSessionContext();

      if (!user || !workspaceId) {
        alert("User workspace session not found. Please login again.");
        return;
      }

      const basePayload = {
        name: workflowForm.name.trim(),
        description: workflowForm.description.trim() || null,
        status: workflowForm.status || "Active",
      };

      if (editingWorkflowId) {
        const { error } = await supabase
          .from("workflows")
          .update(basePayload)
          .eq("id", editingWorkflowId)
          .eq("workspace_id", workspaceId);

        if (error) {
          alert(error.message);
          return;
        }

        setWorkflowForm(emptyWorkflow);
        setEditingWorkflowId(null);
        setShowWorkflowModal(false);
        await loadInitial();
        setSelectedWorkflow(editingWorkflowId);
        return;
      }

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          ...basePayload,
          workspace_id: workspaceId,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      setWorkflowForm(emptyWorkflow);
      setEditingWorkflowId(null);
      setShowWorkflowModal(false);
      await loadInitial();

      if (data?.id) {
        setSelectedWorkflow(Number(data.id));
      }
    } finally {
      setSavingWorkflow(false);
    }
  }

  async function deleteWorkflow(workflow: Workflow | null) {
    if (!workflow) return;

    const confirmed = confirm(
      `Delete workflow "${workflow.name}"?\n\nThis will also delete all tasks and stages inside this workflow. This action cannot be undone.`,
    );

    if (!confirmed) return;

    setSavingWorkflow(true);

    try {
      const { workspaceId } = await loadSessionContext();

      if (!workspaceId) {
        alert("User workspace session not found. Please login again.");
        return;
      }

      const { error: taskDeleteError } = await supabase
        .from("workflow_tasks")
        .delete()
        .eq("workflow_id", workflow.id)
        .eq("workspace_id", workspaceId);

      if (taskDeleteError) {
        alert(taskDeleteError.message);
        return;
      }

      const { error: stageDeleteError } = await supabase
        .from("workflow_stages")
        .delete()
        .eq("workflow_id", workflow.id)
        .eq("workspace_id", workspaceId);

      if (stageDeleteError) {
        alert(stageDeleteError.message);
        return;
      }

      const { error: workflowDeleteError } = await supabase
        .from("workflows")
        .delete()
        .eq("id", workflow.id)
        .eq("workspace_id", workspaceId);

      if (workflowDeleteError) {
        alert(workflowDeleteError.message);
        return;
      }

      setSelectedWorkflow(null);
      setStages([]);
      setTasks([]);
      setSelectedTaskIds([]);
      await loadInitial();
    } finally {
      setSavingWorkflow(false);
    }
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

    const { user, workspaceId } = await loadSessionContext();

    if (!user || !workspaceId) {
      alert("User workspace session not found. Please login again.");
      return;
    }

    if (manageType === "stage") {
      if (!selectedWorkflow) return alert("Select workflow first.");

      const payload = {
        workflow_id: selectedWorkflow,
        name: lookupName.trim(),
        position: Number(stagePosition || 1),
        workspace_id: workspaceId,
        created_by: user.id,
      };

      const { error } = editingLookupId
        ? await supabase
            .from("workflow_stages")
            .update(payload)
            .eq("id", editingLookupId)
            .eq("workspace_id", workspaceId)
        : await supabase.from("workflow_stages").insert(payload);

      if (error) return alert(error.message);

      setLookupName("");
      setStagePosition("1");
      setEditingLookupId(null);
      await loadBoard(selectedWorkflow);
      return;
    }

    if (manageType === "priority") {
      const payload = {
        name: lookupName.trim(),
        color: lookupColor,
        workspace_id: workspaceId,
        created_by: user.id,
      };

      const { error } = editingLookupId
        ? await supabase
            .from("workflow_priorities")
            .update(payload)
            .eq("id", editingLookupId)
            .eq("workspace_id", workspaceId)
        : await supabase.from("workflow_priorities").insert(payload);

      if (error) return alert(error.message);
    }

    if (manageType === "status") {
      const payload = {
        name: lookupName.trim(),
        workspace_id: workspaceId,
        created_by: user.id,
      };

      const { error } = editingLookupId
        ? await supabase
            .from("workflow_task_statuses")
            .update(payload)
            .eq("id", editingLookupId)
            .eq("workspace_id", workspaceId)
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

    let query = supabase.from(table).delete().eq("id", id);
    if (currentWorkspaceId)
      query = query.eq("workspace_id", currentWorkspaceId);

    const { error } = await query;

    if (error) return alert(error.message);
    if (manageType === "stage" && selectedWorkflow)
      await loadBoard(selectedWorkflow);
    else await refreshLookups();
  }

  async function saveContact() {
    if (!contactForm.full_name.trim())
      return alert("Contact name is required.");

    const { user, workspaceId } = await loadSessionContext();

    if (!user || !workspaceId) {
      alert("User workspace session not found. Please login again.");
      return;
    }

    const payload = {
      full_name: contactForm.full_name.trim(),
      email: contactForm.email.trim() || null,
      phone: contactForm.phone.trim() || null,
      designation: contactForm.designation.trim() || null,
      company: contactForm.company.trim() || null,
      department: contactForm.department.trim() || null,
      status: contactForm.status || "Active",
      workspace_id: workspaceId,
      created_by: user.id,
    };

    const result = editingContactId
      ? await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editingContactId)
          .eq("workspace_id", workspaceId)
      : await supabase.from("contacts").insert(payload);

    if (result.error) return alert(result.error.message);

    setContactForm(emptyContact);
    setEditingContactId(null);
    await refreshLookups();
  }

  async function deleteContact(id: number) {
    if (!confirm("Delete this contact?")) return;

    let query = supabase.from("contacts").delete().eq("id", id);
    if (currentWorkspaceId)
      query = query.eq("workspace_id", currentWorkspaceId);

    const { error } = await query;

    if (error) return alert(error.message);
    await refreshLookups();
  }

  function downloadWorkflowCsvTemplate() {
    const csv = `${WORKFLOW_CSV_HEADERS.join(",")}\n`;
    downloadBlob(csv, "workflow_tasks_template.csv", "text/csv;charset=utf-8;");
  }

  function parseCsvLine(line: string) {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  function findLookupId<T extends { id: number; name?: string | null }>(
    list: T[],
    value: string,
  ) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    return (
      list.find(
        (item) =>
          String(item.name ?? "")
            .trim()
            .toLowerCase() === normalized,
      )?.id ?? null
    );
  }

  function findContactIdByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    return (
      contacts.find(
        (contact) =>
          String(contact.email ?? "")
            .trim()
            .toLowerCase() === normalized,
      )?.id ?? null
    );
  }

  async function uploadCsvTasks() {
    if (!csvFile) return alert("Please select a CSV file first.");
    if (!selectedWorkflow)
      return alert(
        "Please create or select a workflow before uploading tasks.",
      );

    setUploadingCsv(true);

    try {
      const { user, workspaceId } = await loadSessionContext();

      if (!user || !workspaceId) {
        alert("User workspace session not found. Please login again.");
        return;
      }

      const text = await csvFile.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        alert("CSV has headers only. Please add task rows before uploading.");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((header) =>
        header.trim().toLowerCase(),
      );
      const missingHeaders = WORKFLOW_CSV_HEADERS.filter(
        (header) => !headers.includes(header),
      );

      if (missingHeaders.length > 0) {
        alert(`Missing CSV columns: ${missingHeaders.join(", ")}`);
        return;
      }

      const getValue = (row: string[], key: string) => {
        const index = headers.indexOf(key);
        return index >= 0 ? row[index]?.trim() || "" : "";
      };

      const rows = lines.slice(1).map(parseCsvLine);
      const invalidRows: string[] = [];

      const payload = rows
        .map((row, index) => {
          const rowNumber = index + 2;
          const title = getValue(row, "task_title");
          const projectName = getValue(row, "project_name");
          const stageName = getValue(row, "stage");
          const priorityName = getValue(row, "priority");
          const statusName = getValue(row, "status");
          const assignedEmail = getValue(row, "assigned_to_email");
          const dueDate = getValue(row, "due_date");

          if (!title) {
            invalidRows.push(`Row ${rowNumber}: task_title is required`);
            return null;
          }

          const projectId = findLookupId(projects, projectName);
          const stageId = findLookupId(stages, stageName);
          const priorityId = findLookupId(priorities, priorityName);
          const statusId = findLookupId(statuses, statusName);
          const assignedContactId = findContactIdByEmail(assignedEmail);

          if (projectName && !projectId)
            invalidRows.push(`Row ${rowNumber}: project_name not found`);
          if (stageName && !stageId)
            invalidRows.push(`Row ${rowNumber}: stage not found`);
          if (priorityName && !priorityId)
            invalidRows.push(`Row ${rowNumber}: priority not found`);
          if (statusName && !statusId)
            invalidRows.push(`Row ${rowNumber}: status not found`);
          if (assignedEmail && !assignedContactId) {
            invalidRows.push(`Row ${rowNumber}: assigned_to_email not found`);
          }

          return {
            workflow_id: selectedWorkflow,
            stage_id: stageId,
            project_id: projectId,
            title,
            description: getValue(row, "description") || null,
            assigned_contact_id: assignedContactId,
            priority_id: priorityId,
            task_status_id: statusId,
            priority: priorityName || null,
            status: statusName || null,
            due_date: dueDate || null,
            workspace_id: workspaceId,
            created_by: user.id,
          };
        })
        .filter(Boolean);

      if (invalidRows.length > 0) {
        alert(
          `CSV upload stopped. Fix these issues:\n\n${invalidRows.slice(0, 15).join("\n")}`,
        );
        return;
      }

      if (payload.length === 0) {
        alert("No valid task rows found in CSV.");
        return;
      }

      if (csvMode === "overwrite") {
        const { error: deleteError } = await supabase
          .from("workflow_tasks")
          .delete()
          .eq("workflow_id", selectedWorkflow)
          .eq("workspace_id", workspaceId);

        if (deleteError) {
          alert(deleteError.message);
          return;
        }
      }

      const { error } = await supabase.from("workflow_tasks").insert(payload);

      if (error) {
        console.error(error);
        alert(error.message || "Failed to upload workflow tasks.");
        return;
      }

      alert(
        `${payload.length} workflow task(s) ${csvMode === "overwrite" ? "uploaded after overwrite" : "appended"} successfully.`,
      );

      setCsvFile(null);
      setCsvMode("append");
      setShowCsvModal(false);
      setSelectedTaskIds([]);
      await loadBoard(selectedWorkflow);
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "CSV upload failed.");
    } finally {
      setUploadingCsv(false);
    }
  }

  function exportFilteredTasksCsv() {
    const rows = filteredTasks.map((task) => {
      const stageName =
        stages.find((stage) => stage.id === task.stage_id)?.name ?? "";
      return [
        task.title,
        task.project_name ?? "",
        task.description ?? "",
        stageName,
        task.priority_name ?? task.priority ?? "",
        task.status_name ?? task.status ?? "",
        task.contact_name ?? "",
        task.contact_email ?? "",
        task.due_date ?? "",
      ];
    });

    const csv = [
      [
        "task_title",
        "project_name",
        "description",
        "stage",
        "priority",
        "status",
        "assigned_to",
        "assigned_to_email",
        "due_date",
      ],
      ...rows,
    ]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    downloadBlob(csv, "workflow_filtered_tasks.csv", "text/csv;charset=utf-8;");
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
    <div className="space-y-5 px-2 py-2 md:px-0">
      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                <span>Workspora</span>
                <span className="text-slate-300">/</span>
                <span>Workflow Board</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                {selectedWorkflowRow?.name ?? "Workflows"}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Track tasks across stages, owners, priorities and due dates in a
                compact Jira-style board.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedWorkflow ?? ""}
                onChange={(event) => {
                  setSelectedWorkflow(
                    event.target.value ? Number(event.target.value) : null,
                  );
                  setSelectedTaskIds([]);
                }}
                className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">Select workflow</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => openEditWorkflow(selectedWorkflowRow)}
                disabled={!selectedWorkflowRow || savingWorkflow}
                className="btn-soft disabled:cursor-not-allowed disabled:opacity-50"
                title="Edit selected workflow"
              >
                Edit Workflow
              </button>
              <button
                onClick={() => deleteWorkflow(selectedWorkflowRow)}
                disabled={!selectedWorkflowRow || savingWorkflow}
                className="btn-red disabled:cursor-not-allowed disabled:opacity-50"
                title="Delete selected workflow"
              >
                Delete Workflow
              </button>

              <SegmentedButton
                active={viewMode === "board"}
                onClick={() => setViewMode("board")}
              >
                Board
              </SegmentedButton>
              <SegmentedButton
                active={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                Table
              </SegmentedButton>

              <button onClick={() => openManage("stage")} className="btn-soft">
                Stages
              </button>
              <button
                onClick={() => openManage("priority")}
                className="btn-soft"
              >
                Priorities
              </button>
              <button onClick={() => openManage("status")} className="btn-soft">
                Statuses
              </button>
              <button
                onClick={() => openManage("contact")}
                className="btn-soft"
              >
                Contacts
              </button>
              <button
                onClick={downloadWorkflowCsvTemplate}
                className="btn-soft"
              >
                Template
              </button>
              <button
                onClick={() => setShowCsvModal(true)}
                className="btn-soft"
              >
                Upload CSV
              </button>
              <button onClick={exportFilteredTasksCsv} className="btn-soft">
                Export CSV
              </button>
              <button onClick={openCreateWorkflow} className="btn-blue">
                + Workflow
              </button>
              <button onClick={() => openAddTask()} className="btn-green">
                + Task
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
          <MetricPill label="Total" value={summary.total} tone="slate" />
          <MetricPill label="Open" value={summary.open} tone="blue" />
          <MetricPill
            label="In Progress"
            value={summary.inProgress}
            tone="indigo"
          />
          <MetricPill
            label="Completed"
            value={summary.completed}
            tone="emerald"
          />
          <MetricPill label="Overdue" value={summary.overdue} tone="rose" />
          <MetricPill
            label="High Priority"
            value={summary.highPriority}
            tone="amber"
          />
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks, assignee, project, status..."
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:border-blue-500 xl:col-span-2"
          />
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            options={projects.map((project) => ({
              value: String(project.id),
              label: project.name,
            }))}
            placeholder="All projects"
          />
          <FilterSelect
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={contacts.map((contact) => ({
              value: String(contact.id),
              label: contact.full_name,
            }))}
            placeholder="All assignees"
          />
          <FilterSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={priorities.map((priority) => ({
              value: String(priority.id),
              label: priority.name,
            }))}
            placeholder="All priorities"
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statuses.map((status) => ({
              value: String(status.id),
              label: status.name,
            }))}
            placeholder="All statuses"
          />
          <select
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value as DueFilter)}
            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All due dates</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">
            Showing{" "}
            <span className="text-slate-950">{filteredTasks.length}</span> of{" "}
            <span className="text-slate-950">{tasks.length}</span> task(s)
            {boardLoading ? (
              <span className="ml-2 text-blue-600">Refreshing...</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button
                onClick={deleteSelectedTasks}
                disabled={bulkDeleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                {bulkDeleting
                  ? "Deleting..."
                  : `Delete selected (${selectedCount})`}
              </button>
            )}
            <button onClick={toggleAllFiltered} className="btn-soft-small">
              {filteredTasks.length > 0 &&
              filteredTasks.every((task) => selectedTaskIds.includes(task.id))
                ? "Clear selection"
                : "Select filtered"}
            </button>
            <button onClick={resetFilters} className="btn-soft-small">
              Reset filters
            </button>
          </div>
        </div>
      </section>

      {!selectedWorkflow ? (
        <EmptyState
          title="No workflow selected"
          description="Create or select a workflow to start managing your board."
          actionLabel="+ Create workflow"
          onAction={() => setShowWorkflowModal(true)}
        />
      ) : viewMode === "board" ? (
        <main className="h-[calc(100vh-360px)] min-h-[520px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <div className="flex h-full min-h-0 gap-4 overflow-x-auto overflow-y-hidden pb-2">
            {stages.length === 0 ? (
              <div className="flex min-h-[420px] w-full items-center justify-center">
                <EmptyState
                  title="No stages yet"
                  description="Create workflow stages like Backlog, To Do, In Progress, Review and Done."
                  actionLabel="+ Add stage"
                  onAction={() => openManage("stage")}
                />
              </div>
            ) : (
              stages.map((stage, index) => {
                const stageTasks = tasksForStage(stage.id);
                return (
                  <section
                    key={stage.id}
                    className="flex h-full min-h-0 w-[310px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="rounded-t-2xl border-b border-slate-100 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${stageDotClass(index)}`}
                            />
                            <h3 className="truncate text-sm font-black uppercase tracking-wide text-slate-800">
                              {stage.name}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-400">
                            {stageTasks.length} issue(s)
                          </p>
                        </div>
                        <button
                          onClick={() => openAddTask(stage.id)}
                          className="h-8 w-8 rounded-xl bg-blue-50 text-sm font-black text-blue-700 hover:bg-blue-100"
                          title="Add task in this stage"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="workflow-column-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pr-2">
                      {stageTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          stages={stages}
                          checked={selectedTaskIds.includes(task.id)}
                          overdue={isOverdue(task)}
                          onToggle={() => toggleSelectedTask(task.id)}
                          onEdit={() => openEditTask(task)}
                          onDelete={() => deleteTask(task.id)}
                          onMove={(stageId) => moveTask(task, stageId)}
                        />
                      ))}

                      {stageTasks.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">
                          Drop tasks here
                        </div>
                      )}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </main>
      ) : (
        <TaskTable
          tasks={filteredTasks}
          stages={stages}
          selectedTaskIds={selectedTaskIds}
          onToggleTask={toggleSelectedTask}
          onEdit={openEditTask}
          onDelete={deleteTask}
          onMove={moveTask}
          isOverdue={isOverdue}
        />
      )}

      {showWorkflowModal && (
        <Modal
          title={editingWorkflowId ? "Edit Workflow" : "Create Workflow"}
          onClose={() => {
            setShowWorkflowModal(false);
            setEditingWorkflowId(null);
            setWorkflowForm(emptyWorkflow);
          }}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Workflow Name"
              value={workflowForm.name}
              onChange={(value) =>
                setWorkflowForm({ ...workflowForm, name: value })
              }
            />
            <Select
              label="Status"
              value={workflowForm.status}
              onChange={(value) =>
                setWorkflowForm({ ...workflowForm, status: value })
              }
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
                { value: "Archived", label: "Archived" },
              ]}
            />
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Description
              </label>
              <textarea
                value={workflowForm.description}
                onChange={(event) =>
                  setWorkflowForm({
                    ...workflowForm,
                    description: event.target.value,
                  })
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowWorkflowModal(false);
                setEditingWorkflowId(null);
                setWorkflowForm(emptyWorkflow);
              }}
              className="btn-soft"
            >
              Cancel
            </button>
            <button
              onClick={saveWorkflow}
              disabled={savingWorkflow}
              className="btn-blue"
            >
              {savingWorkflow
                ? editingWorkflowId
                  ? "Updating..."
                  : "Creating..."
                : editingWorkflowId
                  ? "Update Workflow"
                  : "Create Workflow"}
            </button>
          </div>
        </Modal>
      )}

      {showCsvModal && (
        <Modal
          title="Upload Workflow Tasks CSV"
          onClose={() => setShowCsvModal(false)}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              Upload supports these headers:{" "}
              <span className="font-bold">
                {WORKFLOW_CSV_HEADERS.join(", ")}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <button
                onClick={() => setCsvMode("append")}
                className={`rounded-2xl border p-4 text-left ${
                  csvMode === "append"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="font-black">Append</div>
                <div className="mt-1 text-xs font-semibold opacity-70">
                  Keep existing tasks and add new CSV rows.
                </div>
              </button>
              <button
                onClick={() => setCsvMode("overwrite")}
                className={`rounded-2xl border p-4 text-left ${
                  csvMode === "overwrite"
                    ? "border-rose-500 bg-rose-50 text-rose-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="font-black">Overwrite</div>
                <div className="mt-1 text-xs font-semibold opacity-70">
                  Delete current workflow tasks, then upload CSV rows.
                </div>
              </button>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCsvFile(event.target.files?.[0] ?? null)
              }
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCsvModal(false)}
                className="btn-soft"
              >
                Cancel
              </button>
              <button
                onClick={uploadCsvTasks}
                disabled={uploadingCsv}
                className="btn-blue"
              >
                {uploadingCsv ? "Uploading..." : "Upload CSV"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showTaskModal && (
        <Modal
          title={editingTaskId ? "Edit Task" : "Create Task"}
          onClose={() => setShowTaskModal(false)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Task Title"
              value={taskForm.title}
              onChange={(value) => setTaskForm({ ...taskForm, title: value })}
            />
            <Select
              label="Project"
              value={taskForm.project_id}
              onChange={(value) =>
                setTaskForm({ ...taskForm, project_id: value })
              }
              options={projects.map((project) => ({
                value: String(project.id),
                label: project.name,
              }))}
            />
            <Select
              label="Stage"
              value={taskForm.stage_id}
              onChange={(value) =>
                setTaskForm({ ...taskForm, stage_id: value })
              }
              options={stages.map((stage) => ({
                value: String(stage.id),
                label: stage.name,
              }))}
            />
            <Select
              label="Assigned To"
              value={taskForm.assigned_contact_id}
              onChange={(value) =>
                setTaskForm({ ...taskForm, assigned_contact_id: value })
              }
              options={contacts
                .filter(
                  (contact) =>
                    String(contact.status ?? "active")
                      .trim()
                      .toLowerCase() === "active",
                )
                .map((contact) => ({
                  value: String(contact.id),
                  label: `${contact.full_name}${contact.designation ? ` - ${contact.designation}` : ""}`,
                }))}
            />
            <Select
              label="Priority"
              value={taskForm.priority_id}
              onChange={(value) =>
                setTaskForm({ ...taskForm, priority_id: value })
              }
              options={priorities.map((priority) => ({
                value: String(priority.id),
                label: priority.name,
              }))}
            />
            <Select
              label="Status"
              value={taskForm.task_status_id}
              onChange={(value) =>
                setTaskForm({ ...taskForm, task_status_id: value })
              }
              options={statuses.map((status) => ({
                value: String(status.id),
                label: status.name,
              }))}
            />
            <Input
              label="Due Date"
              type="date"
              value={taskForm.due_date}
              onChange={(value) =>
                setTaskForm({ ...taskForm, due_date: value })
              }
            />
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-bold text-slate-700">
                Description
              </label>
              <textarea
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm({ ...taskForm, description: event.target.value })
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setShowTaskModal(false)}
              className="btn-soft"
            >
              Cancel
            </button>
            <button
              onClick={saveTask}
              disabled={savingTask}
              className="btn-blue"
            >
              {savingTask ? "Saving..." : "Save Task"}
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
              onChange={(event) => setLookupName(event.target.value)}
              placeholder="Name"
              className="h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 md:col-span-5"
            />
            {manageType === "stage" && (
              <input
                value={stagePosition}
                onChange={(event) => setStagePosition(event.target.value)}
                placeholder="Position"
                type="number"
                className="h-12 rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500 md:col-span-3"
              />
            )}
            {manageType === "priority" && (
              <select
                value={lookupColor}
                onChange={(event) => setLookupColor(event.target.value)}
                className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500 md:col-span-3"
              >
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="amber">Amber</option>
                <option value="red">Red</option>
                <option value="rose">Rose</option>
                <option value="slate">Slate</option>
              </select>
            )}
            <button
              onClick={saveLookup}
              className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 md:col-span-4"
            >
              {editingLookupId ? "Update" : "Add"}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="px-4 py-3">Name</th>
                  {manageType === "stage" && (
                    <th className="px-4 py-3">Position</th>
                  )}
                  {manageType === "priority" && (
                    <th className="px-4 py-3">Color</th>
                  )}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manageItems.map((item: any) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{item.name}</td>
                    {manageType === "stage" && (
                      <td className="px-4 py-3">{item.position ?? "-"}</td>
                    )}
                    {manageType === "priority" && (
                      <td className="px-4 py-3">{item.color ?? "slate"}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingLookupId(Number(item.id));
                            setLookupName(item.name);
                            setLookupColor(item.color ?? "slate");
                            setStagePosition(String(item.position ?? 1));
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLookup(Number(item.id))}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {manageItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No records found.
                    </td>
                  </tr>
                )}
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
              onChange={(value) =>
                setContactForm({ ...contactForm, full_name: value })
              }
            />
            <Input
              label="Email"
              value={contactForm.email}
              onChange={(value) =>
                setContactForm({ ...contactForm, email: value })
              }
            />
            <Input
              label="Phone"
              value={contactForm.phone}
              onChange={(value) =>
                setContactForm({ ...contactForm, phone: value })
              }
            />
            <Input
              label="Designation"
              value={contactForm.designation}
              onChange={(value) =>
                setContactForm({ ...contactForm, designation: value })
              }
            />
            <Input
              label="Company"
              value={contactForm.company}
              onChange={(value) =>
                setContactForm({ ...contactForm, company: value })
              }
            />
            <Input
              label="Department"
              value={contactForm.department}
              onChange={(value) =>
                setContactForm({ ...contactForm, department: value })
              }
            />
            <Select
              label="Status"
              value={contactForm.status}
              onChange={(value) =>
                setContactForm({ ...contactForm, status: value })
              }
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" },
              ]}
            />
          </div>
          <button
            onClick={saveContact}
            className="mb-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white hover:bg-blue-700"
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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold">{contact.full_name}</td>
                    <td className="px-4 py-3">{contact.designation ?? "-"}</td>
                    <td className="px-4 py-3">{contact.phone ?? "-"}</td>
                    <td className="px-4 py-3">{contact.status ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingContactId(contact.id);
                            setContactForm({
                              full_name: contact.full_name ?? "",
                              email: contact.email ?? "",
                              phone: contact.phone ?? "",
                              designation: contact.designation ?? "",
                              company: contact.company ?? "",
                              department: contact.department ?? "",
                              status: contact.status ?? "Active",
                            });
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      No contacts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        .btn-soft {
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.625rem 0.95rem;
          font-size: 0.8rem;
          font-weight: 800;
          color: #334155;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
        }
        .btn-soft:hover {
          background: #f8fafc;
        }
        .btn-soft-small {
          border-radius: 0.75rem;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0.5rem 0.8rem;
          font-size: 0.75rem;
          font-weight: 800;
          color: #334155;
        }
        .btn-soft-small:hover {
          background: #f8fafc;
        }
        .btn-blue {
          border-radius: 0.75rem;
          background: #2563eb;
          padding: 0.625rem 1.05rem;
          font-size: 0.8rem;
          font-weight: 900;
          color: white;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .btn-blue:hover {
          background: #1d4ed8;
        }
        .btn-blue:disabled {
          opacity: 0.6;
        }
        .btn-green {
          border-radius: 0.75rem;
          background: #059669;
          padding: 0.625rem 1.05rem;
          font-size: 0.8rem;
          font-weight: 900;
          color: white;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .btn-green:hover {
          background: #047857;
        }
        .btn-red {
          border-radius: 0.75rem;
          background: #dc2626;
          padding: 0.625rem 1.05rem;
          font-size: 0.8rem;
          font-weight: 900;
          color: white;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }
        .btn-red:hover {
          background: #b91c1c;
        }
        .workflow-column-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .workflow-column-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .workflow-column-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

function TaskTable({
  tasks,
  stages,
  selectedTaskIds,
  onToggleTask,
  onEdit,
  onDelete,
  onMove,
  isOverdue,
}: {
  tasks: Task[];
  stages: Stage[];
  selectedTaskIds: number[];
  onToggleTask: (taskId: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  onMove: (task: Task, stageId: number) => void;
  isOverdue: (task: Task) => boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="px-4 py-3">Select</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={() => onToggleTask(task.id)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-black text-slate-950">{task.title}</div>
                  <div className="mt-1 max-w-[340px] truncate text-xs text-slate-500">
                    {task.description ?? "No description"}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {task.project_name ?? "No project"}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">
                    {task.contact_name ?? "Unassigned"}
                  </div>
                  <div className="text-xs text-slate-400">
                    {task.contact_designation ?? task.contact_email ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge
                    value={task.priority_name ?? task.priority ?? "Medium"}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={task.status_name ?? task.status ?? "-"} />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={task.stage_id ?? ""}
                    onChange={(event) =>
                      onMove(task, Number(event.target.value))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold outline-none"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <DueBadge value={task.due_date} overdue={isOverdue(task)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(task)}
                    className="mr-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(task.id)}
                    className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm font-semibold text-slate-400"
                >
                  No tasks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  stages,
  checked,
  overdue,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  stages: Stage[];
  checked: boolean;
  overdue: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (stageId: number) => void;
}) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
              TASK-{task.id}
            </div>
            <h4 className="line-clamp-2 text-sm font-black leading-snug text-slate-950">
              {task.title}
            </h4>
          </div>
        </div>
        <PriorityBadge
          value={task.priority_name ?? task.priority ?? "Medium"}
          color={task.priority_color}
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
          {task.project_name ?? "No project"}
        </span>
        <StatusBadge value={task.status_name ?? task.status ?? "-"} />
      </div>

      {task.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {task.description}
        </p>
      )}

      <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <AvatarInitials name={task.contact_name ?? "Unassigned"} />
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-slate-800">
            {task.contact_name ?? "Unassigned"}
          </div>
          <div className="truncate text-[11px] font-semibold text-slate-400">
            {task.contact_designation ?? task.contact_email ?? "No designation"}
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400">Due</span>
        <DueBadge value={task.due_date} overdue={overdue} />
      </div>

      <select
        value={task.stage_id ?? ""}
        onChange={(event) => onMove(Number(event.target.value))}
        className="mb-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
      >
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            Move to {stage.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "indigo" | "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : tone === "indigo"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : tone === "emerald"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : tone === "rose"
            ? "bg-rose-50 text-rose-700 ring-rose-100"
            : tone === "amber"
              ? "bg-amber-50 text-amber-700 ring-amber-100"
              : "bg-slate-50 text-slate-700 ring-slate-100";

  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${toneClass}`}>
      <div className="text-xs font-black uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function SegmentedButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function PriorityBadge({
  value,
  color,
}: {
  value: string;
  color?: string | null;
}) {
  const normalized = String(value ?? "").toLowerCase();
  const normalizedColor = String(color ?? "").toLowerCase();

  const cls =
    normalized.includes("critical") ||
    normalizedColor === "red" ||
    normalizedColor === "rose"
      ? "bg-red-600 text-white"
      : normalized.includes("high")
        ? "bg-rose-100 text-rose-700"
        : normalized.includes("medium") || normalizedColor === "amber"
          ? "bg-amber-100 text-amber-700"
          : normalizedColor === "blue"
            ? "bg-blue-100 text-blue-700"
            : normalizedColor === "green"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${cls}`}
    >
      {value || "Medium"}
    </span>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = String(value ?? "").toLowerCase();
  const cls =
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("closed")
      ? "bg-emerald-100 text-emerald-700"
      : normalized.includes("progress")
        ? "bg-blue-100 text-blue-700"
        : normalized.includes("hold") || normalized.includes("blocked")
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${cls}`}>
      {value || "-"}
    </span>
  );
}

function DueBadge({
  value,
  overdue,
}: {
  value: string | null | undefined;
  overdue: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
        overdue ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {value ?? "No due date"}
    </span>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
      {initials || "U"}
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        {description}
      </p>
      <button
        onClick={onAction}
        className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Modal({
  title,
  children,
  onClose,
  maxWidth = "max-w-5xl",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4">
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50"
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
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-500"
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
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-blue-500"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function isCompletedTask(task: Task) {
  const value =
    `${task.status_name ?? task.status ?? ""} ${task.stage_name ?? ""}`.toLowerCase();
  return (
    value.includes("completed") ||
    value.includes("complete") ||
    value.includes("done") ||
    value.includes("closed")
  );
}

function csvEscape(value: string | number | null | undefined) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function stageDotClass(index: number) {
  const classes = [
    "bg-slate-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-rose-500",
  ];

  return classes[index % classes.length];
}
