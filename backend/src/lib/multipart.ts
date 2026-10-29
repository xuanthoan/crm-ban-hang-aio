/**
 * Minimal in-memory multipart/form-data parser — Sprint Import/Export.
 *
 * The backend deliberately has no multer dependency in MVP, so this
 * small parser covers exactly what import needs: one file field from a
 * standard browser FormData upload. It is NOT a general-purpose
 * multipart implementation and must not be used for other uploads.
 *
 * Safety: the caller enforces the size limit (the route reads the raw
 * body with express.raw({ limit: "5mb" }) before this parser runs),
 * and the file content is never written to disk — it stays in memory
 * for preview/confirm and is dropped when the preview expires.
 */

export interface UploadedFile {
  fieldName: string;
  filename: string;
  contentType: string;
  content: Buffer;
}

export class MultipartError extends Error {}

/**
 * Parse a multipart body. Returns the file parts only (text fields are
 * ignored — import takes no text fields besides the file itself).
 * Throws MultipartError on a missing boundary or malformed body.
 */
export function parseMultipart(body: Buffer, contentType: string | undefined): UploadedFile[] {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  const boundary = (match?.[1] ?? match?.[2] ?? "").trim();
  if (!boundary) throw new MultipartError("Thiếu boundary trong multipart/form-data.");
  const delimiter = Buffer.from(`--${boundary}`);
  const files: UploadedFile[] = [];
  let pos = body.indexOf(delimiter);
  if (pos < 0) throw new MultipartError("Nội dung multipart không hợp lệ (không tìm thấy boundary).");
  while (pos >= 0) {
    const afterDelimiter = pos + delimiter.length;
    // Final boundary "--boundary--" ends the body.
    if (body.slice(afterDelimiter, afterDelimiter + 2).toString("ascii") === "--") break;
    // Skip the CRLF after the delimiter.
    let cursor = afterDelimiter;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;
    else if (body[cursor] === 10) cursor += 1;
    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    if (headerEnd < 0) throw new MultipartError("Nội dung multipart không hợp lệ (thiếu header của phần).");
    const headerText = body.slice(cursor, headerEnd).toString("utf8");
    const disposition = /Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/i.exec(headerText);
    const typeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headerText);
    const dataStart = headerEnd + 4;
    const nextDelim = body.indexOf(delimiter, dataStart);
    if (nextDelim < 0) throw new MultipartError("Nội dung multipart không hợp lệ (thiếu boundary kết thúc phần).");
    // The CRLF immediately before the next delimiter belongs to the
    // delimiter, not to the file content.
    let dataEnd = nextDelim;
    if (body[dataEnd - 2] === 13 && body[dataEnd - 1] === 10) dataEnd -= 2;
    else if (body[dataEnd - 1] === 10) dataEnd -= 1;
    if (disposition?.[2] !== undefined) {
      files.push({
        fieldName: disposition[1],
        filename: disposition[2],
        contentType: (typeMatch?.[1] ?? "application/octet-stream").trim(),
        content: body.slice(dataStart, dataEnd),
      });
    }
    pos = nextDelim;
  }
  return files;
}
