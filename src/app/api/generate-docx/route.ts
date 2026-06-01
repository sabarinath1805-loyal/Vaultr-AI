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

export const runtime = "nodejs";

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

const DOWNLOAD_DIR = "/tmp/vaultr-downloads";

function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
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
    const body = (await request.json()) as DocxRequest;
    if (!body.title || !Array.isArray(body.sections)) {
      return NextResponse.json({ error: "title and sections required" }, { status: 400 });
    }

    ensureDownloadDir();

    const doc = buildDocument(body);
    const buffer = await Packer.toBuffer(doc);
    const slug = body.title
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60)
      .toLowerCase();
    const hash = crypto.randomBytes(4).toString("hex");
    const filename = `${slug}-${hash}.docx`;
    const filePath = path.join(DOWNLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      url: `/api/download/${filename}`,
      filename,
    });
  } catch (error) {
    console.error("DOCX generation error:", error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
