import { NextRequest, NextResponse } from "next/server";
import { searchLegalDatabases } from "@/lib/legal-search";

export async function POST(request: NextRequest) {
  try {
    const { query, jurisdiction } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }
    const results = await searchLegalDatabases(query, jurisdiction);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
