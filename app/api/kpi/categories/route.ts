import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/KPI_Categories?select=*&order=name.asc`,
      { headers, cache: "no-store" },
    );

    const data = await res.json();

    return NextResponse.json({
      success: res.ok,
      categories: Array.isArray(data) ? data : [],
      error: res.ok ? null : data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();

  if (!name) {
    return NextResponse.json(
      { success: false, error: "Category name is required" },
      { status: 400 },
    );
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/KPI_Categories`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name }),
  });

  const data = await res.json();

  return NextResponse.json(
    {
      success: res.ok,
      category: Array.isArray(data) ? data[0] : null,
      error: res.ok ? null : data,
    },
    { status: res.ok ? 200 : 400 },
  );
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  const name = String(body.name || "").trim();

  if (!id || !name) {
    return NextResponse.json(
      { success: false, error: "Category id and name are required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/KPI_Categories?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name }),
    },
  );

  const data = await res.json();

  return NextResponse.json(
    {
      success: res.ok,
      category: Array.isArray(data) ? data[0] : null,
      error: res.ok ? null : data,
    },
    { status: res.ok ? 200 : 400 },
  );
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Category id is required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/KPI_Categories?id=eq.${id}`,
    {
      method: "DELETE",
      headers,
    },
  );

  return NextResponse.json({ success: res.ok }, { status: res.ok ? 200 : 400 });
}
