import JSZip from "jszip";

const PDF_MAGIC = Buffer.from("%PDF-");
const OLE_MAGIC = Buffer.from("d0cf11e0a1b11ae1", "hex");
const ZIP_MAGIC = Buffer.from("504b0304", "hex");

export const MAX_ZIP_ENTRIES = 2_000;
export const MAX_DECLARED_UNCOMPRESSED_BYTES = 250 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  docx: new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  xlsx: new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  xlsm: new Set(["application/vnd.ms-excel.sheet.macroEnabled.12"]),
  pptx: new Set([
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
  doc: new Set(["application/msword"]),
  xls: new Set(["application/vnd.ms-excel"]),
  ppt: new Set(["application/vnd.ms-powerpoint"]),
};

function startsWith(buffer: Buffer, magic: Buffer) {
  return buffer.subarray(0, magic.length).equals(magic);
}

function isGenericMime(mime: string) {
  return !mime || mime === "application/octet-stream" || mime === "binary/octet-stream";
}

function expectedZipEntry(extension: string, entries: string[]) {
  const lower = entries.map((entry) => entry.toLowerCase());
  if (extension === "docx") return lower.some((entry) => entry === "word/document.xml");
  if (extension === "xlsx" || extension === "xlsm")
    return lower.some((entry) => entry === "xl/workbook.xml");
  if (extension === "pptx")
    return lower.some((entry) => entry === "ppt/presentation.xml");
  return false;
}

/**
 * Validates an upload after Multer's byte limit and before persistence.
 * Filename extension remains part of the application contract, but the
 * content must also be a matching PDF, Office ZIP, or legacy OLE container.
 */
export async function validateUploadedFile(
  buffer: Buffer,
  extension: string,
  mimeType: string | undefined,
) {
  const normalizedExtension = extension.toLowerCase();
  const normalizedMime = (mimeType ?? "").toLowerCase().split(";", 1)[0].trim();
  const allowedMimes = MIME_BY_EXTENSION[normalizedExtension];
  if (!allowedMimes) throw new Error("Unsupported file type");
  if (!isGenericMime(normalizedMime) && !allowedMimes.has(normalizedMime)) {
    throw new Error("Uploaded MIME type does not match the file extension");
  }

  if (normalizedExtension === "pdf") {
    if (!startsWith(buffer, PDF_MAGIC)) throw new Error("Uploaded file is not a valid PDF container");
    return;
  }

  const isZipOffice = ["docx", "xlsx", "xlsm", "pptx"].includes(normalizedExtension);
  if (isZipOffice) {
    if (!startsWith(buffer, ZIP_MAGIC))
      throw new Error("Uploaded Office file is not a ZIP container");
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer, { createFolders: false });
    } catch {
      throw new Error("Uploaded Office file archive could not be read");
    }
    const entries = Object.keys(zip.files);
    if (entries.length === 0 || entries.length > MAX_ZIP_ENTRIES)
      throw new Error("Uploaded Office archive has too many entries");
    const declaredBytes = entries.reduce((total, name) => {
      const size = (zip.files[name] as unknown as { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize;
      return total + (typeof size === "number" && Number.isFinite(size) ? size : 0);
    }, 0);
    if (declaredBytes > MAX_DECLARED_UNCOMPRESSED_BYTES)
      throw new Error("Uploaded Office archive expands beyond the resource limit");
    if (!expectedZipEntry(normalizedExtension, entries))
      throw new Error("Uploaded Office archive does not match its extension");
    return;
  }

  if (!["doc", "xls", "ppt"].includes(normalizedExtension) || !startsWith(buffer, OLE_MAGIC)) {
    throw new Error("Uploaded legacy Office file is not an OLE container");
  }
}
