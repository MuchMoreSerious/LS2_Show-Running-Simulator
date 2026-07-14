import fs from "fs";
import path from "path";

/**
 * 파일 저장소 추상화. 현재는 로컬 디스크 구현체만 제공하지만,
 * 인터페이스를 분리해 두어 S3 등 다른 백엔드로 교체할 수 있다.
 */
export interface FileStorage {
  save(projectId: string, filename: string, content: Buffer): Promise<string>; // returns storagePath
  read(storagePath: string): Promise<Buffer>;
}

class LocalFileStorage implements FileStorage {
  private root: string;
  constructor(root: string) {
    this.root = root;
  }
  async save(projectId: string, filename: string, content: Buffer): Promise<string> {
    const dir = path.join(this.root, projectId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const fullPath = path.join(dir, safeName);
    fs.writeFileSync(fullPath, content);
    return path.relative(process.cwd(), fullPath);
  }
  async read(storagePath: string): Promise<Buffer> {
    return fs.readFileSync(path.join(process.cwd(), storagePath));
  }
}

let instance: FileStorage | null = null;
export function getFileStorage(): FileStorage {
  if (!instance) {
    instance = new LocalFileStorage(process.env.FILE_STORAGE_ROOT || "./data/uploads");
  }
  return instance;
}
