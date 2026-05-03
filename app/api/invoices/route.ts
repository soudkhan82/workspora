import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

// ================= GET =================
export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?select=*, 
        invoice_clients(name),
        invoice_vendors(name),
        invoice_projects(name),
        invoice_milestones(name),
        invoice_statuses(name)
      `,
      { headers },
    );

    const data = await res.json();

    // 🔥 transform for UI (VERY IMPORTANT)
    const formatted = data.map((inv: any) => ({
      ...inv,
      client_name: inv.invoice_clients?.name || "-",
      vendor_name: inv.invoice_vendors?.name || "-",
      project_name: inv.invoice_projects?.name || "-",
      milestone_name: inv.invoice_milestones?.name || "-",
      status_name: inv.invoice_statuses?.name || "-",
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}

// ================= POST =================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        invoice_no: body.invoice_no,
        client_id: body.client_id,
        vendor_id: body.vendor_id || null,
        project_id: body.project_id,
        milestone_id: body.milestone_id || null,
        status_id: body.status_id || null,
        amount: body.amount,
        currency: body.currency || "PKR",
        due_date: body.due_date || null,
        paid_date: body.paid_date || null,
        notes: body.notes || null,
      }),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}

// ================= PUT =================
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${body.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        invoice_no: body.invoice_no,
        client_id: body.client_id,
        vendor_id: body.vendor_id || null,
        project_id: body.project_id,
        milestone_id: body.milestone_id || null,
        status_id: body.status_id || null,
        amount: body.amount,
        currency: body.currency,
        due_date: body.due_date || null,
        paid_date: body.paid_date || null,
        notes: body.notes || null,
      }),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// ================= DELETE =================
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
