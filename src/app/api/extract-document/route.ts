import { NextResponse } from "next/server";
import { extractDocumentText } from "@/lib/document-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filename, fileType, content, dataUrl } = body;

    if (!filename || (!content && !dataUrl)) {
      return NextResponse.json(
        { error: "filename and content or dataUrl are required" },
        { status: 400 }
      );
    }

    const extractedText = await extractDocumentText({
      filename,
      fileType,
      content,
      dataUrl,
    });

    return NextResponse.json({ extractedText: extractedText || "" });
  } catch (error) {
    console.error("Document extraction failed:", error);
    return NextResponse.json(
      { error: "Document extraction failed", extractedText: "" },
      { status: 500 }
    );
  }
}
