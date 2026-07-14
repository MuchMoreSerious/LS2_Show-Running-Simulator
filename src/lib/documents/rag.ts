import { db } from "@/lib/db/store";

export interface Chunk {
  documentId: string;
  filename: string;
  category: string;
  text: string;
}

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 100;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

/**
 * 의존성 없는 로컬 벡터 저장소.
 * 임베딩 모델 없이도 동작하도록 TF-IDF 유사 방식의 term-overlap 스코어링을 사용한다.
 * EMBEDDING_PROVIDER=local(기본값)일 때 사용되며, 실제 임베딩 API로 교체 가능하도록
 * getRelevantChunks()의 시그니처만 유지하면 된다.
 */
export function getRelevantChunks(projectId: string, query: string, topK = 5): Chunk[] {
  const documents = db.listDocuments(projectId).filter((d) => d.extractedText);
  const allChunks: Chunk[] = [];
  for (const doc of documents) {
    for (const text of chunkText(doc.extractedText ?? "")) {
      allChunks.push({ documentId: doc.id, filename: doc.filename, category: doc.documentCategory, text });
    }
  }
  if (allChunks.length === 0) return [];

  const queryTerms = tokenize(query);
  const scored = allChunks.map((chunk) => ({ chunk, score: overlapScore(queryTerms, tokenize(chunk.text)) }));
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function overlapScore(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const term of a) if (setB.has(term)) count++;
  return count / Math.sqrt(b.length || 1);
}
