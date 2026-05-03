import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const tableMap: Record<string, string> = {
  client: "contract_clients",
  clients: "contract_clients",
  project: "contract_projects",
  projects: "contract_projects",
  type: "contract_types",
  types: "contract_types",
  contract_type: "contract_types",
  contract_types: "contract_types",
  status: "contract_statuses",
  statuses: "contract_statuses",
};

function getTable(body: any) {
  const type = String(body?.type || body?.dropdownType || body?.kind || "")
    .trim()
    .toLowerCase();

  return tableMap[type];
}

async function readTable(table: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&order=name.asc`,
    { headers, cache: "no-store" },
  );

  const text = await res.text();

  if (!res.ok) {
    console.error(`${table} read error:`, text);
    return [];
  }

  return text ? JSON.parse(text) : [];
}

export async function GET() {
  try {
    const [clients, projects, types, statuses] = await Promise.all([
      readTable("contract_clients"),
      readTable("contract_projects"),
      readTable("contract_types"),
      readTable("contract_statuses"),
    ]);

    return NextResponse.json({ clients, projects, types, statuses });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Dropdown GET failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const table = getTable(body);

    if (!table) {
      return NextResponse.json(
        { error: "Invalid dropdown type", received: body },
        { status: 400 },
      );
    }

    const name = String(body.name || body.value || body.label || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ name }),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to save dropdown" },
        { status: res.status },
      );
    }

    return new NextResponse(text || "[]", {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Dropdown POST failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const table = getTable(body);

    if (!table || !body.id) {
      return NextResponse.json(
        { error: "Dropdown type and id are required", received: body },
        { status: 400 },
      );
    }

    const name = String(body.name || body.value || body.label || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${body.id}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ name }),
        cache: "no-store",
      },
    );

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to update dropdown" },
        { status: res.status },
      );
    }

    return new NextResponse(text || "[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Dropdown PUT failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const table = getTable(body);

    if (!table || !body.id) {
      return NextResponse.json(
        { error: "Dropdown type and id are required", received: body },
        { status: 400 },
      );
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${body.id}`,
      {
        method: "DELETE",
        headers,
        cache: "no-store",
      },
    );

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to delete dropdown" },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Dropdown DELETE failed" },
      { status: 500 },
    );
  }
}
