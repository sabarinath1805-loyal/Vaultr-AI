import { scanContractFormData } from "@/lib/api/contract-scanner";
import { requireAuth, validateRequestSize, AuthError } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    // Auth gate — require authentication
    const { userId } = await requireAuth(req);

    // Content-Type check
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
    }

    // Parse form data
    const formData = await req.formData();

    // File size validation (before reading entire file)
    const file = formData.get("file");
    if (file instanceof File && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 413 });
    }

    // Process the contract scan
    const result = await scanContractFormData(formData, userId);
    return result;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    console.error("Contract scanner error:", error);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}