import { readFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

export type ApiLikeRequest = {
  headers?: Record<string, string | string[] | undefined>;
  rawBody?: Buffer | null;
  on?: (event: string, handler: (chunk?: Buffer) => void) => void;
};

export type MultipartFileField = {
  kind: "file";
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type MultipartFieldValue = string | MultipartFileField;

function getHeader(headers: ApiLikeRequest["headers"], name: string): string {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

export function getRequestContentType(req: ApiLikeRequest): string {
  return getHeader(req.headers, "content-type");
}

export async function getRequestRawBody(req: ApiLikeRequest): Promise<Buffer> {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }

  if (!req.on) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];

  return new Promise((resolve) => {
    req.on?.("data", (chunk) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    });
    req.on?.("end", () => resolve(Buffer.concat(chunks)));
  });
}

export function parseMultipartFormData(rawBody: Buffer, contentType: string): Record<string, MultipartFieldValue> {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const bodyText = rawBody.toString("latin1");
  const delimiter = `--${boundary}`;
  const segments = bodyText.split(delimiter).slice(1, -1);
  const fields: Record<string, MultipartFieldValue> = {};

  for (const segment of segments) {
    const normalizedSegment = segment.startsWith("\r\n") ? segment.slice(2) : segment;
    if (!normalizedSegment.trim()) continue;

    const headerEndIndex = normalizedSegment.indexOf("\r\n\r\n");
    if (headerEndIndex === -1) continue;

    const headerText = normalizedSegment.slice(0, headerEndIndex);
    let valueText = normalizedSegment.slice(headerEndIndex + 4);
    if (valueText.endsWith("\r\n")) {
      valueText = valueText.slice(0, -2);
    }

    const dispositionLine = headerText
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-disposition:"));
    if (!dispositionLine) continue;

    const nameMatch = dispositionLine.match(/name="([^"]+)"/i);
    const filenameMatch = dispositionLine.match(/filename="([^"]*)"/i);
    const fieldName = nameMatch?.[1];
    if (!fieldName) continue;

    const typeLine = headerText
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-type:"));
    const mimeType = typeLine?.split(":")[1]?.trim() || "application/octet-stream";

    if (filenameMatch && filenameMatch[1]) {
      fields[fieldName] = {
        kind: "file",
        filename: filenameMatch[1],
        mimeType,
        buffer: Buffer.from(valueText, "latin1"),
      };
      continue;
    }

    fields[fieldName] = valueText;
  }

  return fields;
}

function sanitizePublicAssetPath(assetPath: string): string | null {
  if (!assetPath.startsWith("/")) {
    return null;
  }

  const decodedPath = decodeURIComponent(assetPath);
  const resolvedPath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return resolvedPath;
}

function getMimeTypeFromExtension(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

export async function resolveMultipartImageField(
  fields: Record<string, MultipartFieldValue>,
  fieldName: string
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const value = fields[fieldName];
  if (!value) {
    throw new Error(`Missing field: ${fieldName}`);
  }

  if (typeof value !== "string") {
    return {
      buffer: value.buffer,
      filename: value.filename || `${fieldName}.png`,
      mimeType: value.mimeType || "image/png",
    };
  }

  if (value.startsWith("/")) {
    const resolvedPath = sanitizePublicAssetPath(value);
    if (!resolvedPath) {
      throw new Error(`Invalid local asset path: ${value}`);
    }

    const buffer = await readFile(resolvedPath);
    return {
      buffer,
      filename: path.basename(resolvedPath),
      mimeType: getMimeTypeFromExtension(resolvedPath),
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote image for ${fieldName}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const urlObject = new URL(value);
    const filename = path.basename(urlObject.pathname) || `${fieldName}.png`;
    return {
      buffer: Buffer.from(arrayBuffer),
      filename,
      mimeType: response.headers.get("content-type") || getMimeTypeFromExtension(filename),
    };
  }

  throw new Error(`Unsupported image input for ${fieldName}`);
}
