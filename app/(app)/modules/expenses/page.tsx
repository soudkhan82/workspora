"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClientBrowser } from "@/app/lib/supabase/browser";

type ExpenseCategory = {
  id: number | string;
  workspace_id?: string | null;
  created_by?: string | null;
  name: string;
  is_active?: boolean | null;
};

type ExpenseCategoryJoin =
  | { name: string | null }
  | { name: string | null }[]
  | null;

type ExpenseRow = {
  id: number | string;
  workspace_id: string | null;
  created_by: string | null;
  expense_category_id: number | string | null;
  expense_date: string | null;
  amount: number | null;
  currency: string | null;
  description: string | null;
  vendor: string | null;
  expense_categories: ExpenseCategoryJoin;
};

type WorkspaceMember = {
  workspace_id: string;
};

type FormState = {
  expense_category_id: string;
  expense_date: string;
  amount: string;
  currency: string;
  description: string;
  vendor: string;
};

type UploadMode = "append" | "overwrite";

const todayIso = () => new Date().toISOString().slice(0, 10);

const CURRENCIES = [
  { code: "USD", label: "US$ - USD" },
  { code: "PKR", label: "PKR" },
  { code: "AED", label: "AED" },
  { code: "SAR", label: "SAR" },
  { code: "GBP", label: "GBP" },
  { code: "EUR", label: "EUR" },
  { code: "CNY", label: "CNY" },
  { code: "TRY", label: "TRY" },
];

const emptyForm: FormState = {
  expense_category_id: "",
  expense_date: todayIso(),
  amount: "",
  currency: "USD",
  description: "",
  vendor: "",
};

function formatAmount(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

function parseAmount(value: string) {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
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
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function getExpenseCategoryName(
  expense: Pick<ExpenseRow, "expense_categories">,
) {
  const joinedCategory = Array.isArray(expense.expense_categories)
    ? expense.expense_categories[0]
    : expense.expense_categories;

  return joinedCategory?.name || "Uncategorized";
}

export default function ExpensesPage() {
  const supabase = createClientBrowser();

  const [userId, setUserId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(
    new Set(),
  );

  const [viewExpense, setViewExpense] = useState<ExpenseRow | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("append");
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);

  const selectedCurrency = form.currency || "USD";

  const loadSessionAndWorkspace = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to detect logged-in user.");
    }

    setUserId(user.id);

    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle<WorkspaceMember>();

    if (membershipError) throw membershipError;

    if (!membership?.workspace_id) {
      throw new Error("No active workspace found for this user.");
    }

    setWorkspaceId(membership.workspace_id);

    return {
      userId: user.id,
      workspaceId: membership.workspace_id,
    };
  }, [supabase]);

  const loadCategories = useCallback(
    async (activeWorkspaceId: string) => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id, name, is_active")
        .eq("workspace_id", activeWorkspaceId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      setCategories((data || []) as ExpenseCategory[]);
    },
    [supabase],
  );

  const loadExpenses = useCallback(
    async (activeWorkspaceId: string) => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          `
          id,
          workspace_id,
          created_by,
          expense_category_id,
          expense_date,
          amount,
          currency,
          description,
          vendor,
          expense_categories (
            name
          )
        `,
        )
        .eq("workspace_id", activeWorkspaceId)
        .order("expense_date", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;

      const normalizedRows = ((data || []) as unknown as ExpenseRow[]).map(
        (row) => ({
          ...row,
          expense_categories: Array.isArray(row.expense_categories)
            ? row.expense_categories[0] || null
            : row.expense_categories,
        }),
      );

      setExpenses(normalizedRows);
    },
    [supabase],
  );

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const session = await loadSessionAndWorkspace();

      await Promise.all([
        loadCategories(session.workspaceId),
        loadExpenses(session.workspaceId),
      ]);
    } catch (error: any) {
      setMessage(error?.message || "Unable to load expenses module.");
    } finally {
      setLoading(false);
    }
  }, [loadSessionAndWorkspace, loadCategories, loadExpenses]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, ExpenseCategory>();

    categories.forEach((category) => {
      map.set(category.name.trim().toLowerCase(), category);
    });

    return map;
  }, [categories]);

  const filteredExpenses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    if (!q) return expenses;

    return expenses.filter((expense) => {
      const category = getExpenseCategoryName(expense);
      const vendor = expense.vendor || "";
      const description = expense.description || "";
      const currency = expense.currency || "";
      const date = expense.expense_date || "";
      const amount = String(expense.amount || "");

      return [category, vendor, description, currency, date, amount]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [expenses, searchTerm]);

  const filteredExpenseIds = useMemo(() => {
    return filteredExpenses.map((expense) => String(expense.id));
  }, [filteredExpenses]);

  const selectedCount = selectedExpenseIds.size;

  const allFilteredSelected = useMemo(() => {
    return (
      filteredExpenseIds.length > 0 &&
      filteredExpenseIds.every((id) => selectedExpenseIds.has(id))
    );
  }, [filteredExpenseIds, selectedExpenseIds]);

  useEffect(() => {
    setSelectedExpenseIds((previous) => {
      const validIds = new Set(expenses.map((expense) => String(expense.id)));
      const next = new Set<string>();

      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });

      return next;
    });
  }, [expenses]);

  const categorySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        category: string;
        currency: string;
        amount: number;
        count: number;
      }
    >();

    expenses.forEach((expense) => {
      const category = getExpenseCategoryName(expense);
      const currency = expense.currency || "USD";
      const key = `${category}__${currency}`;

      const previous = map.get(key) || {
        category,
        currency,
        amount: 0,
        count: 0,
      };

      previous.amount += Number(expense.amount || 0);
      previous.count += 1;

      map.set(key, previous);
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const currencySummary = useMemo(() => {
    const map = new Map<
      string,
      {
        currency: string;
        amount: number;
        count: number;
      }
    >();

    expenses.forEach((expense) => {
      const currency = expense.currency || "USD";
      const previous = map.get(currency) || {
        currency,
        amount: 0,
        count: 0,
      };

      previous.amount += Number(expense.amount || 0);
      previous.count += 1;

      map.set(currency, previous);
    });

    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        amount: number;
        count: number;
      }
    >();

    expenses.forEach((expense) => {
      const month = String(expense.expense_date || "").slice(0, 7);
      if (!month) return;

      const previous = map.get(month) || {
        month,
        amount: 0,
        count: 0,
      };

      previous.amount += Number(expense.amount || 0);
      previous.count += 1;

      map.set(month, previous);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [expenses]);

  const topCategoriesForChart = useMemo(() => {
    return categorySummary.slice(0, 8).map((item) => ({
      name: `${item.category} (${item.currency})`,
      amount: Number(item.amount.toFixed(2)),
    }));
  }, [categorySummary]);

  const openEditExpense = (expense: ExpenseRow) => {
    setEditExpense(expense);
    setEditForm({
      expense_category_id: expense.expense_category_id
        ? String(expense.expense_category_id)
        : "",
      expense_date: expense.expense_date || todayIso(),
      amount: String(expense.amount || ""),
      currency: expense.currency || "USD",
      description: expense.description || "",
      vendor: expense.vendor || "",
    });
  };

  const handleAddCategory = async () => {
    try {
      if (!workspaceId || !userId) return;

      const name = newCategoryName.trim();

      if (!name) {
        setMessage("Please enter category name.");
        return;
      }

      setSaving(true);
      setMessage("");

      const { error } = await supabase.from("expense_categories").insert({
        workspace_id: workspaceId,
        created_by: userId,
        name,
      });

      if (error) throw error;

      setNewCategoryName("");
      await loadCategories(workspaceId);
      setMessage("Expense category added.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to add category.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpense = async () => {
    try {
      if (!workspaceId || !userId) return;

      if (!form.expense_category_id) {
        setMessage("Please select expense category.");
        return;
      }

      const amount = parseAmount(form.amount);

      if (amount <= 0) {
        setMessage("Please enter a valid expense amount.");
        return;
      }

      if (!form.expense_date) {
        setMessage("Please select expense date.");
        return;
      }

      setSaving(true);
      setMessage("");

      const { error } = await supabase.from("expenses").insert({
        workspace_id: workspaceId,
        created_by: userId,
        expense_category_id: Number(form.expense_category_id),
        expense_date: form.expense_date,
        amount,
        currency: form.currency || "USD",
        description: form.description.trim() || null,
        vendor: form.vendor.trim() || null,
      });

      if (error) throw error;

      setForm({
        ...emptyForm,
        expense_date: todayIso(),
      });

      await loadExpenses(workspaceId);
      setMessage("Expense saved.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExpense = async () => {
    try {
      if (!workspaceId || !editExpense) return;

      if (!editForm.expense_category_id) {
        setMessage("Please select expense category.");
        return;
      }

      const amount = parseAmount(editForm.amount);

      if (amount <= 0) {
        setMessage("Please enter a valid expense amount.");
        return;
      }

      if (!editForm.expense_date) {
        setMessage("Please select expense date.");
        return;
      }

      setSaving(true);
      setMessage("");

      const { error } = await supabase
        .from("expenses")
        .update({
          expense_category_id: Number(editForm.expense_category_id),
          expense_date: editForm.expense_date,
          amount,
          currency: editForm.currency || "USD",
          description: editForm.description.trim() || null,
          vendor: editForm.vendor.trim() || null,
        })
        .eq("id", editExpense.id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;

      setEditExpense(null);
      await loadExpenses(workspaceId);
      setMessage("Expense updated.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to update expense.");
    } finally {
      setSaving(false);
    }
  };

  const toggleExpenseSelection = (id: number | string) => {
    const normalizedId = String(id);

    setSelectedExpenseIds((previous) => {
      const next = new Set(previous);

      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }

      return next;
    });
  };

  const toggleAllFilteredExpenses = () => {
    setSelectedExpenseIds((previous) => {
      const next = new Set(previous);

      if (allFilteredSelected) {
        filteredExpenseIds.forEach((id) => next.delete(id));
      } else {
        filteredExpenseIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleBulkDeleteExpenses = async () => {
    if (!workspaceId) return;

    const ids = Array.from(selectedExpenseIds);

    if (!ids.length) {
      setMessage("Please select at least one expense record.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${ids.length} selected expense record${ids.length === 1 ? "" : "s"}?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setMessage("");

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", ids);

      if (error) throw error;

      setSelectedExpenseIds(new Set());
      await loadExpenses(workspaceId);

      setMessage(
        `${ids.length} expense record${ids.length === 1 ? "" : "s"} deleted.`,
      );
    } catch (error: any) {
      setMessage(error?.message || "Unable to delete selected expenses.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: number | string) => {
    const confirmed = window.confirm("Delete this expense?");
    if (!confirmed || !workspaceId) return;

    try {
      setSaving(true);
      setMessage("");

      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;

      setSelectedExpenseIds((previous) => {
        const next = new Set(previous);
        next.delete(String(id));
        return next;
      });

      await loadExpenses(workspaceId);
      setMessage("Expense deleted.");
    } catch (error: any) {
      setMessage(error?.message || "Unable to delete expense.");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "category",
      "currency",
      "amount",
      "expense_date",
      "description",
      "vendor",
    ];

    const sampleRows = [
      [
        "Travel",
        "PKR",
        "15000",
        todayIso(),
        "Client visit travel expense",
        "Careem",
      ],
      [
        "Software",
        "USD",
        "49",
        todayIso(),
        "Monthly SaaS subscription",
        "OpenAI",
      ],
    ];

    const csv = [
      headers.join(","),
      ...sampleRows.map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "expenses_upload_template.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleUploadCsv = async (
    file: File | null,
    mode: UploadMode = "append",
  ) => {
    try {
      if (!file || !workspaceId || !userId) return;

      const confirmed =
        mode === "overwrite"
          ? window.confirm(
              "Overwrite will delete all existing expense records in this workspace before uploading the CSV. Continue?",
            )
          : true;

      if (!confirmed) return;

      setUploading(true);
      setMessage("");

      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setMessage("CSV file has no expense rows.");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((header) =>
        header.trim().toLowerCase(),
      );

      const requiredHeaders = [
        "category",
        "currency",
        "amount",
        "expense_date",
        "description",
        "vendor",
      ];

      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header),
      );

      if (missingHeaders.length) {
        setMessage(`Missing CSV columns: ${missingHeaders.join(", ")}`);
        return;
      }

      const getValue = (values: string[], key: string) => {
        const index = headers.indexOf(key);
        return index >= 0 ? values[index]?.trim() || "" : "";
      };

      const categoriesToCreate = new Map<string, string>();

      const parsedRows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);

        const category = getValue(values, "category");
        const currency = getValue(values, "currency") || "USD";
        const amount = parseAmount(getValue(values, "amount"));
        const expenseDate = getValue(values, "expense_date");
        const description = getValue(values, "description");
        const vendor = getValue(values, "vendor");

        const normalizedCategory = category.trim().toLowerCase();

        if (category && !categoryMap.has(normalizedCategory)) {
          categoriesToCreate.set(normalizedCategory, category.trim());
        }

        return {
          category,
          currency,
          amount,
          expenseDate,
          description,
          vendor,
        };
      });

      const invalidRows = parsedRows.filter(
        (row) => !row.category || !row.expenseDate || row.amount <= 0,
      );

      if (invalidRows.length) {
        setMessage(
          "Upload stopped. Some rows have missing category, missing expense_date, or invalid amount.",
        );
        return;
      }

      if (categoriesToCreate.size > 0) {
        const categoryPayload = Array.from(categoriesToCreate.values()).map(
          (name) => ({
            workspace_id: workspaceId,
            created_by: userId,
            name,
          }),
        );

        const { error: categoryError } = await supabase
          .from("expense_categories")
          .insert(categoryPayload);

        if (categoryError) throw categoryError;

        await loadCategories(workspaceId);
      }

      const { data: freshCategories, error: freshCategoryError } =
        await supabase
          .from("expense_categories")
          .select("id, name, is_active")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);

      if (freshCategoryError) throw freshCategoryError;

      const freshCategoryMap = new Map<string, ExpenseCategory>();

      ((freshCategories || []) as ExpenseCategory[]).forEach((category) => {
        freshCategoryMap.set(category.name.trim().toLowerCase(), category);
      });

      const expensePayload = parsedRows.map((row) => {
        const category = freshCategoryMap.get(row.category.toLowerCase());

        return {
          workspace_id: workspaceId,
          created_by: userId,
          expense_category_id: category?.id || null,
          expense_date: row.expenseDate,
          amount: row.amount,
          currency: row.currency || "USD",
          description: row.description || null,
          vendor: row.vendor || null,
        };
      });

      if (mode === "overwrite") {
        const { error: deleteError } = await supabase
          .from("expenses")
          .delete()
          .eq("workspace_id", workspaceId);

        if (deleteError) throw deleteError;
      }

      const { error: expenseError } = await supabase
        .from("expenses")
        .insert(expensePayload);

      if (expenseError) throw expenseError;

      await Promise.all([
        loadCategories(workspaceId),
        loadExpenses(workspaceId),
      ]);

      setSelectedCsvFile(null);
      setUploadDialogOpen(false);
      setUploadMode("append");

      setMessage(
        mode === "overwrite"
          ? `CSV uploaded in overwrite mode. Existing expenses were replaced with ${expensePayload.length} records.`
          : `CSV uploaded in append mode. ${expensePayload.length} expenses added.`,
      );
    } catch (error: any) {
      setMessage(error?.message || "Unable to upload CSV.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            <div className="text-base font-bold text-slate-950">
              Loading dashboard...
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Please wait while data is being fetched
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Expenses
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Record expenses, bulk upload CSV files, track category spend, and
              monitor expense trend over time.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50"
            >
              Download CSV Template
            </button>

            <button
              type="button"
              onClick={() => {
                setUploadDialogOpen(true);
                setUploadMode("append");
                setSelectedCsvFile(null);
              }}
              disabled={uploading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload CSV"}
            </button>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">
              Total Records
            </p>
            <p className="mt-5 text-4xl font-bold text-slate-950">
              {expenses.length.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600">Categories</p>
            <p className="mt-5 text-4xl font-bold text-slate-950">
              {categories.length.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
            <p className="text-sm font-semibold text-slate-600">
              Total by Currency
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {currencySummary.length ? (
                currencySummary.map((item) => (
                  <span
                    key={item.currency}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800"
                  >
                    {item.currency} {Number(item.amount || 0).toLocaleString()}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No expenses yet</span>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
            <h2 className="text-xl font-bold text-slate-950">Add Expense</h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Expense Category
                </label>
                <select
                  value={form.expense_category_id}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      expense_category_id: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        currency: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                    placeholder={`Amount in ${selectedCurrency}`}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Expense Date
                </label>
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      expense_date: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Vendor / Paid To
                </label>
                <input
                  value={form.vendor}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      vendor: event.target.value,
                    }))
                  }
                  placeholder="Vendor name"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Short expense description"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveExpense}
                disabled={saving}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-950">
                Add Expense Category
              </h3>

              <div className="mt-3 flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="e.g. Travel, Software, Fuel"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-950">
                  Time Series Trend
                </h2>
                <span className="text-xs font-medium text-slate-500">
                  Monthly expense trend
                </span>
              </div>

              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      stroke="#64748b"
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "12px",
                        color: "#020617",
                      }}
                      formatter={(value: any) => [
                        Number(value || 0).toLocaleString(),
                        "Amount",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#059669"
                      fill="#d1fae5"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-950">
                  Category Summary
                </h2>
                <span className="text-xs font-medium text-slate-500">
                  Top categories by amount
                </span>
              </div>

              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategoriesForChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      stroke="#64748b"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "12px",
                        color: "#020617",
                      }}
                      formatter={(value: any) => [
                        Number(value || 0).toLocaleString(),
                        "Amount",
                      ]}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#059669"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-4">
            <h2 className="text-lg font-bold text-slate-950">
              Summary by Category
            </h2>

            <div className="mt-3 max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase tracking-wide text-white">
                  <tr>
                    <th className="w-[34%] px-3 py-3">Category</th>
                    <th className="w-[18%] px-3 py-3 text-center">Records</th>
                    <th className="w-[18%] px-3 py-3">Curr.</th>
                    <th className="w-[30%] px-3 py-3 text-right">Amount</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {categorySummary.length ? (
                    categorySummary.map((item) => (
                      <tr key={`${item.category}-${item.currency}`}>
                        <td
                          className="truncate px-3 py-3 font-medium text-slate-950"
                          title={item.category}
                        >
                          {item.category}
                        </td>

                        <td className="px-3 py-3 text-center font-semibold text-slate-700">
                          {item.count}
                        </td>

                        <td className="px-3 py-3 text-slate-600">
                          {item.currency}
                        </td>

                        <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-950">
                          {formatAmount(item.amount, item.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No category summary available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Recent Expenses
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {filteredExpenses.length} of {expenses.length} records
                  {selectedCount > 0 ? ` • ${selectedCount} selected` : ""}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleBulkDeleteExpenses}
                    disabled={saving}
                    className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Deleting..."
                      : `Delete Selected (${selectedCount})`}
                  </button>
                ) : null}

                <div className="flex w-full gap-2 md:w-[460px]">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search category, vendor, date, amount..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 max-h-[460px] overflow-y-auto rounded-2xl border border-slate-200">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-[11px] uppercase tracking-wide text-white">
                  <tr>
                    <th className="w-[6%] px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFilteredExpenses}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-600"
                        aria-label="Select all visible expenses"
                      />
                    </th>
                    <th className="w-[13%] px-3 py-3">Date</th>
                    <th className="w-[21%] px-3 py-3">Category</th>
                    <th className="w-[18%] px-3 py-3">Vendor</th>
                    <th className="w-[17%] px-3 py-3 text-right">Amount</th>
                    <th className="w-[25%] px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredExpenses.length ? (
                    filteredExpenses.map((expense) => {
                      const expenseId = String(expense.id);
                      const isSelected = selectedExpenseIds.has(expenseId);

                      return (
                        <tr
                          key={expense.id}
                          className={isSelected ? "bg-emerald-50" : "bg-white"}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleExpenseSelection(expense.id)
                              }
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-emerald-600"
                              aria-label={`Select expense ${expense.id}`}
                            />
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                            {expense.expense_date}
                          </td>

                          <td
                            className="truncate px-3 py-3 font-medium text-slate-950"
                            title={getExpenseCategoryName(expense)}
                          >
                            {getExpenseCategoryName(expense)}
                          </td>

                          <td
                            className="truncate px-3 py-3 text-slate-600"
                            title={expense.vendor || "-"}
                          >
                            {expense.vendor || "-"}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-950">
                            {formatAmount(
                              Number(expense.amount || 0),
                              expense.currency || "USD",
                            )}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewExpense(expense)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-slate-50"
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditExpense(expense)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {uploadDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Upload Expenses CSV
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select append or overwrite before uploading your expense CSV.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (uploading) return;
                  setUploadDialogOpen(false);
                  setSelectedCsvFile(null);
                  setUploadMode("append");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setUploadMode("append")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    uploadMode === "append"
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-bold text-slate-950">Append</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Keep existing expenses and add CSV rows as new records.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadMode("overwrite")}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    uploadMode === "overwrite"
                      ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-bold text-slate-950">
                    Overwrite
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Delete existing expense records, then insert CSV rows.
                  </div>
                </button>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Select CSV File
                </label>

                <input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setSelectedCsvFile(file);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-200"
                />

                {selectedCsvFile ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Selected: {selectedCsvFile.name}
                  </p>
                ) : null}
              </div>

              {uploadMode === "overwrite" ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  Warning: overwrite mode will remove existing expense records
                  in this workspace before inserting the uploaded CSV data.
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  Append mode keeps your existing data and only adds new CSV
                  records.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (uploading) return;
                    setUploadDialogOpen(false);
                    setSelectedCsvFile(null);
                    setUploadMode("append");
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={uploading || !selectedCsvFile}
                  onClick={() => handleUploadCsv(selectedCsvFile, uploadMode)}
                  className={`rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                    uploadMode === "overwrite"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {uploading
                    ? "Uploading..."
                    : uploadMode === "overwrite"
                      ? "Overwrite & Upload"
                      : "Append & Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewExpense ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Expense Details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Full expense record information
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewExpense(null)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Category
                </p>
                <p className="mt-1 font-bold text-slate-950">
                  {getExpenseCategoryName(viewExpense)}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Expense Date
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {viewExpense.expense_date}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Amount
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {formatAmount(
                      Number(viewExpense.amount || 0),
                      viewExpense.currency || "USD",
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Vendor / Paid To
                </p>
                <p className="mt-1 font-bold text-slate-950">
                  {viewExpense.vendor || "-"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Description
                </p>
                <p className="mt-1 text-slate-800">
                  {viewExpense.description || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editExpense ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Edit Expense
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update selected expense record
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditExpense(null)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Expense Category
                </label>
                <select
                  value={editForm.expense_category_id}
                  onChange={(event) =>
                    setEditForm((previous) => ({
                      ...previous,
                      expense_category_id: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Currency
                  </label>
                  <select
                    value={editForm.currency}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        currency: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={editForm.expense_date}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        expense_date: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Vendor / Paid To
                </label>
                <input
                  value={editForm.vendor}
                  onChange={(event) =>
                    setEditForm((previous) => ({
                      ...previous,
                      vendor: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((previous) => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditExpense(null)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUpdateExpense}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Updating..." : "Update Expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
