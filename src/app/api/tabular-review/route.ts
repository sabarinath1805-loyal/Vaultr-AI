import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSessionUser,
  isSupabaseConfigured,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ reviews: [] });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ reviews: [] });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  const user = await getSessionUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  userId = user.id;

  const { data, error } = await supabase
    .from("tabular_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[TabularReview] List error:", error);
    return NextResponse.json({ reviews: [] });
  }

  return NextResponse.json({ reviews: data || [] });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  const user = await getSessionUser(authHeader);
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  userId = user.id;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tabular_reviews")
    .insert({
      user_id: userId,
      name: body.name,
      document_type: body.documentType || null,
      columns: body.columns || [],
      document_ids: body.documentIds || [],
      matter_id: typeof body.matterId === "string" ? body.matterId : null,
      results: {},
    })
    .select()
    .single();

  if (error) {
    console.error("[TabularReview] Create error:", error);
    return NextResponse.json({ error: "Failed to create review." }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}
