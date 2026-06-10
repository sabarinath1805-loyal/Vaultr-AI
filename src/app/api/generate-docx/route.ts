import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageOrientation,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { requireAuth, validateRequestSize, AuthError } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1MB

// Per-user hourly cap on docx generation (in-memory; resets on server restart).
const hourlyUsage = new Map<string, { count: number; resetAt: number }>();
const HOURLY_LIMIT = 20;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

function checkUserHourlyCap(userId: string): boolean {
  const now = Date.now();
  const entry = hourlyUsage.get(userId);
  if (!entry || now > entry.resetAt) {
    hourlyUsage.set(userId, { count: 1, resetAt: now + HOURLY_WINDOW_MS });
    return true;
  }
  if (entry.count >= HOURLY_LIMIT) return false;
  entry.count++;
  return true;
}

interface TableRow_ {
  [key: string]: string;
}

interface Section {
  heading: string;
  content?: string;
  table?: TableRow_[];
}

interface DocxRequest {
  title: string;
  sections: Section[];
  landscape?: boolean;
}

const DOWNLOAD_ROOT =
  process.env.DOWNLOAD_DIR || path.join(process.env.TMPDIR || process.cwd(), "vaultr-downloads");

function userDownloadDir(userId: string): string {
  return path.join(DOWNLOAD_ROOT, "users", userId);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildDocument(req: DocxRequest): Document {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      text: req.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  for (const section of req.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      })
    );

    if (section.content) {
      children.push(
        new Paragraph({
          children: [new TextRun(section.content)],
          spacing: { after: 100 },
        })
      );
    }

    if (section.table && section.table.length > 0) {
      const keys = Object.keys(section.table[0]);

      const headerRow = new TableRow({
        children: keys.map(
          (key) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: key, bold: true, size: 20 })],
                  alignment: AlignmentType.LEFT,
                }),
              ],
              width: { size: Math.floor(100 / keys.length), type: WidthType.PERCENTAGE },
            })
        ),
      });

      const dataRows = section.table.map(
        (row) =>
          new TableRow({
            children: keys.map(
              (key) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row[key] || "", size: 20 })],
                    }),
                  ],
                })
            ),
          })
      );

      children.push(
        new Table({
          rows: [headerRow, ...dataRows],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      );
    }
  }

  const sectionProperties = req.landscape
    ? { page: { size: { orientation: PageOrientation.LANDSCAPE } } }
    : {};

  return new Document({
    sections: [
      {
        properties: sectionProperties,
        children,
      },
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(request);

    // Per-user hourly cap
    if (!checkUserHourlyCap(userId)) {
      return NextResponse.json(
        { error: "Hourly docx-generation limit exceeded" },
        { status: 429 }
      );
    }

    // Size cap
    const sizeError = await validateRequestSize(request, MAX_BODY_BYTES);
    if (sizeError) return sizeError;

    const body = (await request.json()) as DocxRequest;
    if (!body.title || !Array.isArray(body.sections)) {
      return NextResponse.json({ error: "title and sections required" }, { status: 400 });
    }

    const userDir = userDownloadDir(userId);
    ensureDir(userDir);

    const doc = buildDocument(body);
    const buffer = await Packer.toBuffer(doc);
    const slug = body.title
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
      .toLowerCase();
    const hash = crypto.randomBytes(4).toString("hex");
    const filename = `${slug}-${hash}.docx`;
    const filePath = path.join(userDir, filename);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      url: `/api/download/${userId}/${filename}`,
      filename,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.userMessage }, { status: error.status });
    }
    console.error("DOCX generation error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
