import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const TABLE = "contracts";

async function findIdByName(table: string, name: string) {
  if (!name) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=id,name&name=eq.${encodeURIComponent(
      name,
    )}&limit=1`,
    { headers, cache: "no-store" },
  );

  const text = await res.text();
  if (!res.ok) return null;

  const rows = text ? JSON.parse(text) : [];
  return rows?.[0]?.id ?? null;
}

async function buildPayload(body: any) {
  const clientName = body.client_name || body.clientName || body.client || "";
  const projectName =
    body.project_name || body.projectName || body.project || "";
  const contractTypeName =
    body.contract_type_name || body.contract_type || body.contractType || "";
  const statusName = body.status_name || body.status || body.statusName || "";

  const [clientId, projectId, contractTypeId, statusId] = await Promise.all([
    body.client_id || findIdByName("contract_clients", clientName),
    body.project_id || findIdByName("contract_projects", projectName),
    body.contract_type_id || findIdByName("contract_types", contractTypeName),
    body.status_id || findIdByName("contract_statuses", statusName),
  ]);

  return {
    contract_no: body.contract_no,
    client_name: clientName,
    project_name: projectName || null,
    client_id: clientId,
    project_id: projectId,
    contract_type_id: contractTypeId,
    status_id: statusId,
    contract_value: Number(body.contract_value || 0),
    currency: body.currency || "PKR",
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    signed_date: body.signed_date || null,
    notes: body.notes || null,
  };
}

export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=created_at.desc`,
      { headers, cache: "no-store" },
    );

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to fetch contracts" },
        { status: res.status },
      );
    }

    return new NextResponse(text || "[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Contract GET failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = await buildPayload(body);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to save contract" },
        { status: res.status },
      );
    }

    return new NextResponse(text || "[]", {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Contract POST failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Contract id is required" },
        { status: 400 },
      );
    }

    const payload = await buildPayload(body);

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${body.id}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to update contract" },
        { status: res.status },
      );
    }

    return new NextResponse(text || "[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Contract PUT failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Contract id is required" },
        { status: 400 },
      );
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: text || "Failed to delete contract" },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Contract DELETE failed" },
      { status: 500 },
    );
  }
}
