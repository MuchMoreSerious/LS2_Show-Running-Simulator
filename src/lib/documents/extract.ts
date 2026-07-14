import mammoth from "mammoth";
import * as XLSX from "xlsx";

export interface ExtractResult {
  ok: boolean;
  text: string;
  error?: string;
}

const SUPPORTED = ["pdf", "docx", "xlsx", "csv", "txt", "md"] as const;
export type SupportedFileType = (typeof SUPPORTED)[number];

export function inferFileType(filename: string): SupportedFileType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (SUPPORTED as readonly string[]).includes(ext ?? "") ? (ext as SupportedFileType) : null;
}

/** 문서에서 텍스트를 추출한다. 파싱이 어려운 파일은 명확한 오류 메시지를 반환한다 (요구사항 §7). */
export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<ExtractResult> {
  try {
    switch (fileType) {
      case "txt":
      case "md":
        return { ok: true, text: buffer.toString("utf-8") };
      case "csv":
        return { ok: true, text: buffer.toString("utf-8") };
      case "docx": {
        const result = await mammoth.extractRawText({ buffer });
        return { ok: true, text: result.value };
      }
      case "xlsx": {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const parts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          parts.push(`--- 시트: ${sheetName} ---\n${csv}`);
        }
        return { ok: true, text: parts.join("\n\n") };
      }
      case "pdf": {
        // pdf-parse v2 API (PDFParse 클래스) 사용.
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          const text = result.text ?? "";
          if (text.trim().length === 0) {
            return { ok: false, text: "", error: "PDF에서 텍스트를 추출하지 못했습니다. 스캔 이미지 기반 PDF일 수 있습니다 — OCR이 필요합니다." };
          }
          return { ok: true, text };
        } finally {
          await parser.destroy();
        }
      }
      default:
        return { ok: false, text: "", error: `지원하지 않는 파일 형식입니다: ${fileType}` };
    }
  } catch (err) {
    return { ok: false, text: "", error: `문서 파싱 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}` };
  }
}
