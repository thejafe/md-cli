// Filesystem adapter for vault operations.
// Uses Bun.file/Bun.write for reads/writes, node:fs for dir ops and sync FS calls.

import {
  existsSync, mkdirSync, readdirSync, renameSync, rmSync,
  statSync, unlinkSync, appendFileSync, type Dirent,
} from "node:fs";
import { join, dirname as pathDirname, basename as pathBasename, resolve, extname } from "node:path";
import {
  normalizePath, normalizeFilename, basename, isHidden, isNote,
} from "./utils.ts";

export interface FileStat {
  type: "file" | "folder" | "other";
  ctime: number;
  mtime: number;
  size: number;
}

export interface DirListing {
  files: string[];
  folders: string[];
}

export interface SearchResult {
  path: string;
  line: number;
  text: string;
}

export class VaultAdapter {
  readonly basePath: string;
  readonly configDir: string;

  constructor(basePath: string, configDir = ".obsidian") {
    this.basePath = resolve(basePath);
    this.configDir = configDir;
  }

  fullPath(relPath: string): string {
    const n = normalizePath(relPath);
    return join(this.basePath, n === "/" ? "" : n);
  }

  exists(relPath: string): boolean {
    return existsSync(this.fullPath(relPath));
  }

  stat(relPath: string): FileStat | null {
    try {
      const s = statSync(this.fullPath(relPath));
      return {
        type: s.isFile() ? "file" : s.isDirectory() ? "folder" : "other",
        ctime: Math.round(s.birthtimeMs),
        mtime: Math.round(s.mtimeMs),
        size: s.size,
      };
    } catch {
      return null;
    }
  }

  async read(relPath: string): Promise<string> {
    return Bun.file(this.fullPath(relPath)).text();
  }

  async readBinary(relPath: string): Promise<Uint8Array> {
    return Bun.file(this.fullPath(relPath)).bytes();
  }

  async write(relPath: string, content: string | Uint8Array): Promise<void> {
    const full = this.fullPath(relPath);
    mkdirSync(pathDirname(full), { recursive: true });
    await Bun.write(full, content);
  }

  append(relPath: string, text: string): void {
    appendFileSync(this.fullPath(relPath), text, "utf-8");
  }

  remove(relPath: string): void {
    unlinkSync(this.fullPath(relPath));
  }

  // Mirrors Obsidian's "Move to Obsidian trash" — move to .trash/
  trash(relPath: string): void {
    const full = this.fullPath(relPath);
    const trashDir = join(this.basePath, ".trash");
    mkdirSync(trashDir, { recursive: true });

    const ext = extname(full);
    const name = pathBasename(full, ext);
    let dest = join(trashDir, name + ext);
    let counter = 1;
    while (existsSync(dest)) {
      dest = join(trashDir, `${name} ${++counter}${ext}`);
    }
    renameSync(full, dest);
  }

  rename(oldPath: string, newPath: string): void {
    const oldFull = this.fullPath(oldPath);
    const newFull = this.fullPath(newPath);
    if (existsSync(newFull)) throw new Error(`Destination already exists: ${newPath}`);
    mkdirSync(pathDirname(newFull), { recursive: true });
    renameSync(oldFull, newFull);
  }

  mkdir(relPath: string): void {
    mkdirSync(this.fullPath(relPath), { recursive: true });
  }

  rmdir(relPath: string, recursive = false): void {
    rmSync(this.fullPath(relPath), { recursive });
  }

  list(relPath = ""): DirListing {
    const full = this.fullPath(relPath);
    if (!existsSync(full)) return { files: [], folders: [] };

    const entries: Dirent[] = readdirSync(full, { withFileTypes: true });
    const files: string[] = [];
    const folders: string[] = [];

    for (const entry of entries) {
      const name = normalizeFilename(entry.name);
      const rel = relPath && relPath !== "/" ? `${relPath}/${name}` : name;
      if (entry.isFile()) files.push(rel);
      else if (entry.isDirectory()) folders.push(rel);
    }

    return { files, folders };
  }

  listRecursive(relPath = "", filter?: (path: string) => boolean): string[] {
    const results: string[] = [];
    const walk = (dir: string): void => {
      const { files, folders } = this.list(dir);
      for (const f of files) {
        if (!filter || filter(f)) results.push(f);
      }
      for (const d of folders) {
        if (!isHidden(d)) walk(d);
      }
    };
    walk(relPath);
    return results.sort();
  }

  listNotes(folder = ""): string[] {
    return this.listRecursive(folder, (f) => isNote(f) && !isHidden(f));
  }

  async search(query: string, folder = "", useRegex = false): Promise<SearchResult[]> {
    const notes = this.listNotes(folder);
    const results: SearchResult[] = [];
    const pattern = useRegex ? new RegExp(query, "gi") : null;
    const lower = query.toLowerCase();

    for (const notePath of notes) {
      try {
        const content = await this.read(notePath);
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const hit = pattern ? pattern.test(line) : line.toLowerCase().includes(lower);
          if (pattern) pattern.lastIndex = 0;
          if (hit) results.push({ path: notePath, line: i + 1, text: line.trimEnd() });
        }
      } catch { /* skip unreadable */ }
    }

    return results;
  }

  tree(relPath = "", maxDepth = Infinity): string {
    const name = relPath ? basename(relPath) : pathBasename(this.basePath);
    return `${name}/\n${this.treeInner(relPath, "", maxDepth)}`;
  }

  private treeInner(relPath: string, prefix: string, depth: number): string {
    if (depth <= 0) return "";
    const { files, folders } = this.list(relPath);
    const items = [
      ...folders.filter((f) => !isHidden(basename(f))).sort().map((f) => ({ path: f, isDir: true })),
      ...files.filter((f) => !isHidden(basename(f))).sort().map((f) => ({ path: f, isDir: false })),
    ];

    let out = "";
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const last = i === items.length - 1;
      out += `${prefix}${last ? "└── " : "├── "}${basename(item.path)}${item.isDir ? "/" : ""}\n`;
      if (item.isDir) out += this.treeInner(item.path, prefix + (last ? "    " : "│   "), depth - 1);
    }
    return out;
  }
}
