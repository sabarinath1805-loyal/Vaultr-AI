import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export const runtime = "nodejs";

// Configurable download directory — production deployments should set DOWNLOAD_DIR.
// Falls back to a per-user temp directory when not set.
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(process.env.TMPDIR || "/tmp", "vaultr-downloads");

function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

function markdownToDocxChildren(markdown: string): (Paragraph)[] {
  const children: Paragraph[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ children: [] }));
      continue;
    }

    // Headings
    const h1Match = trimmed.match(/^# (.+)/);
    if (h1Match) {
      children.push(new Paragraph({ text: h1Match[1], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
      continue;
    }
    const h2Match = trimmed.match(/^## (.+)/);
    if (h2Match) {
      children.push(new Paragraph({ text: h2Match[1], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }));
      continue;
    }
    const h3Match = trimmed.match(/^### (.+)/);
    if (h3Match) {
      children.push(new Paragraph({ text: h3Match[1], heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
      continue;
    }

    // Bold + italic processing
    const runs: TextRun[] = [];
    let remaining = trimmed;
    const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: remaining.slice(lastIndex, match.index), size: 22 }));
      }
      if (match[2]) {
        runs.push(new TextRun({ text: match[2], bold: true, italics: true, size: 22 }));
      } else if (match[3]) {
        runs.push(new TextRun({ text: match[3], bold: true, size: 22 }));
      } else if (match[4]) {
        runs.push(new TextRun({ text: match[4], italics: true, size: 22 }));
      } else if (match[5]) {
        runs.push(new TextRun({ text: match[5], font: "Courier New", size: 20 }));
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < remaining.length) {
      runs.push(new TextRun({ text: remaining.slice(lastIndex), size: 22 }));
    }
    if (runs.length === 0) {
      runs.push(new TextRun({ text: trimmed, size: 22 }));
    }

    // List items
    const bulletMatch = trimmed.match(/^[-*+] (.+)/);
    const numberMatch = trimmed.match(/^\d+\. (.+)/);
    if (bulletMatch || numberMatch) {
      children.push(new Paragraph({
        children: runs,
        bullet: bulletMatch ? { level: 0 } : undefined,
        spacing: { after: 40 },
      }));
    } else {
      children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    }
  }

  return children;
}

export async function POST(request: NextRequest) {
  try {
    const { content, format, title } = await request.json();
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    ensureDownloadDir();

    const exportTitle = typeof title === "string" && title.trim() ? title.trim() : "Lex Response";
    const slug = exportTitle.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).toLowerCase();
    const hash = crypto.randomBytes(4).toString("hex");

    if (format === "pdf") {
      const pdfContent = buildSimplePdf(content, exportTitle);
      const filename = generatePDFFilename(content);
      const filePath = path.join(DOWNLOAD_DIR, filename);
      fs.writeFileSync(filePath, pdfContent);
      return NextResponse.json({ url: `/api/download/${filename}`, filename });
    }

    // Default: DOCX
    const docChildren = markdownToDocxChildren(content);
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: exportTitle, heading: HeadingLevel.TITLE, spacing: { after: 200 } }),
          ...docChildren,
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    const filename = `${slug}-${hash}.docx`;
    const filePath = path.join(DOWNLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return NextResponse.json({ url: `/api/download/${filename}`, filename });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function generatePDFFilename(responseText: string): string {
  const words = responseText
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
    .join("-")
    .toLowerCase();
  const date = new Date().toISOString().split("T")[0];
  return `Lex - ${words || "response"} - ${date}.pdf`;
}

function sanitizeSpecialChars(text: string): string {
  return text
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

function buildSimplePdf(markdown: string, title: string): Buffer {
  const plainText = sanitizeSpecialChars(
    markdown
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  );

  const lines = [`${title}`, "", ...plainText.split("\n")];
  const escapedLines = lines.map((line) =>
    line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
  );

  // Build PDF objects
  const pageHeight = 792;
  const pageWidth = 612;
  const margin = 72;
  const lineHeight = 14;
  const maxCharsPerLine = 80;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  // Word-wrap lines
  const wrappedLines: string[] = [];
  for (const line of escapedLines) {
    if (line.length <= maxCharsPerLine) {
      wrappedLines.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxCharsPerLine) {
        wrappedLines.push(line.slice(i, i + maxCharsPerLine));
      }
    }
  }

  // Split into pages
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += maxLinesPerPage) {
    pages.push(wrappedLines.slice(i, i + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  let objectCount = 0;
  const offsets: number[] = [];

  function addObject(content: string) {
    objectCount++;
    offsets.push(-1); // placeholder
    objects.push(content);
    return objectCount;
  }

  // Object 1: Catalog
  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Object 2: Pages (placeholder, updated later)
  addObject(""); // will be replaced

  // Object 3: Font
  addObject("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  // Create page objects
  const pageObjIds: number[] = [];
  for (const pageLines of pages) {
    const streamLines = pageLines.map((line, idx) => {
      const y = pageHeight - margin - idx * lineHeight;
      const fontSize = idx === 0 && pageObjIds.length === 0 ? 16 : 11;
      return `BT /F1 ${fontSize} Tf ${margin} ${y} Td (${line}) Tj ET`;
    });
    const stream = streamLines.join("\n");

    const contentId = addObject(
      `${objectCount + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );

    const pageId = addObject(
      `${objectCount + 1} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`
    );
    pageObjIds.push(pageId);
  }

  // Update Pages object
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj\n`;

  // Build PDF
  let pdf = "%PDF-1.4\n";
  for (let i = 0; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += objects[i];
  }

  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 0; i < objectCount; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += "trailer\n";
  pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return Buffer.from(pdf, "latin1");
}
