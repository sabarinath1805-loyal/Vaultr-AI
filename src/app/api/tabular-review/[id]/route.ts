import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getSessionUser,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { analyseCell } from "@/lib/tabular-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  if (process.env.NODE_ENV === "development" && !authHeader) {
    userId = "00000000-0000-0000-0000-000000000001";
  } else {
    const user = await getSessionUser(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    userId = user.id;
  }

  const { data, error } = await supabase
    .from("tabular_reviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  return NextResponse.json({ review: data });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  if (process.env.NODE_ENV === "development" && !authHeader) {
    userId = "00000000-0000-0000-0000-000000000001";
  } else {
    const user = await getSessionUser(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    userId = user.id;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.documentId !== "string" || typeof body.columnIndex !== "number") {
    return NextResponse.json({ error: "Document ID and column index are required." }, { status: 400 });
  }

  // Fetch the review to get the document_ids and columns
  const { data: review, error: fetchError } = await supabase
    .from("tabular_reviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  // Check if documentId is valid
  if (!review.document_ids.includes(body.documentId)) {
    return NextResponse.json({ error: "Document not found in review." }, { status: 404 });
  }

  // Fetch document text from local vault
  const document = await fetch(`/api/local-vault/documents/${body.documentId}`, {
    headers: {
      "Authorization": `Bearer ${authHeader}`,
    },
  });
  if (!document.ok) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  const documentData = await document.json();
  const documentText = documentData.content || "";

  // Run analysis
  try {
    const result = await analyseCell({
      documentText,
      columnQuestion: review.columns[body.columnIndex],
      documentName: documentData.filename,
    });

    // Update results
    const newResults = review.results || {};
    if (!newResults[body.documentId]) {
      newResults[body.documentId] = {};
    }
    newResults[body.documentId][body.columnIndex] = result;

    const { error: updateError } = await supabase
      .from("tabular_reviews")
      .update({ results: newResults })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      console.error("[TabularReview] Update error:", updateError);
      return NextResponse.json({ error: "Failed to save result." }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[TabularReview] Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  if (process.env.NODE_ENV === "development" && !authHeader) {
    userId = "00000000-0000-0000-0000-000000000001";
  } else {
    const user = await getSessionUser(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    userId = user.id;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (Array.isArray(body.columns)) updates.columns = body.columns;
  if (typeof body.name === "string") updates.name = body.name;
  if (typeof body.documentType === "string") updates.document_type = body.documentType;
  // Accept both camelCase (documentIds) and snake_case (document_ids) for
  // document attachments — the detail page sends snake_case, the create page
  // sends camelCase. Persist both to the same column.
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds
    : Array.isArray(body.document_ids)
      ? body.document_ids
      : null;
  if (documentIds) updates.document_ids = documentIds;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("tabular_reviews")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[TabularReview] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");

  if (process.env.NODE_ENV === "development" && !authHeader) {
    userId = "00000000-0000-0000-0000-000000000001";
  } else {
    const user = await getSessionUser(authHeader);
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    userId = user.id;
  }

  const { error } = await supabase
    .from("tabular_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("[TabularReview] Delete error:", error);
    return NextResponse.json({ error: "Failed to delete review." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
