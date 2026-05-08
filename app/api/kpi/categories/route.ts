import { NextResponse, type NextRequest } from "next/server";
import { createClientServer } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getWorkspaceContext() {
  const supabase = await createClientServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      supabase,
      user: null,
      workspaceId: null,
      error: userError.message,
      status: 401,
    };
  }

  if (!user) {
    return {
      supabase,
      user: null,
      workspaceId: null,
      error: "User not authenticated",
      status: 401,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,status")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      supabase,
      user,
      workspaceId: null,
      error: membershipError.message,
      status: 500,
    };
  }

  if (!membership?.workspace_id) {
    return {
      supabase,
      user,
      workspaceId: null,
      error: "No active workspace found for this user",
      status: 403,
    };
  }

  if (
    membership.status &&
    String(membership.status).toLowerCase() !== "active"
  ) {
    return {
      supabase,
      user,
      workspaceId: null,
      error: "Your workspace membership is not active",
      status: 403,
    };
  }

  return {
    supabase,
    user,
    workspaceId: String(membership.workspace_id),
    error: null,
    status: 200,
  };
}

export async function GET() {
  try {
    const ctx = await getWorkspaceContext();

    if (ctx.error || !ctx.user || !ctx.workspaceId) {
      return NextResponse.json(
        { success: false, categories: [], error: ctx.error },
        { status: ctx.status },
      );
    }

    const { data, error } = await ctx.supabase
      .from("KPI_Categories")
      .select("id,name,workspace_id,created_by,created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("created_by", ctx.user.id)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, categories: [], error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      categories: data ?? [],
      error: null,
    });
  } catch {
    return NextResponse.json(
      { success: false, categories: [], error: "Failed to load categories" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getWorkspaceContext();

    if (ctx.error || !ctx.user || !ctx.workspaceId) {
      return NextResponse.json(
        { success: false, error: ctx.error },
        { status: ctx.status },
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Category name is required" },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("KPI_Categories")
      .insert({
        name,
        workspace_id: ctx.workspaceId,
        created_by: ctx.user.id,
      })
      .select("id,name,workspace_id,created_by,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, category: null, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      category: data,
      error: null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to add category" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getWorkspaceContext();

    if (ctx.error || !ctx.user || !ctx.workspaceId) {
      return NextResponse.json(
        { success: false, error: ctx.error },
        { status: ctx.status },
      );
    }

    const body = await req.json();
    const id = Number(body.id);
    const name = String(body.name || "").trim();

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: "Category id and name are required" },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("KPI_Categories")
      .update({ name })
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("created_by", ctx.user.id)
      .select("id,name,workspace_id,created_by,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, category: null, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      category: data,
      error: null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to update category" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();

    if (ctx.error || !ctx.user || !ctx.workspaceId) {
      return NextResponse.json(
        { success: false, error: ctx.error },
        { status: ctx.status },
      );
    }

    const id = Number(req.nextUrl.searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Category id is required" },
        { status: 400 },
      );
    }

    const { error } = await ctx.supabase
      .from("KPI_Categories")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("created_by", ctx.user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      error: null,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
