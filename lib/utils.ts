// Path & content utilities for Obsidian vault operations.
// Mirrors obsidian-headless path normalization and frontmatter handling.

const NBSP_RE = /[\u00A0\u202F]/g;

export function normalizePath(s: string): string {
  s = s.replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "");
  return s || "/";
}

export function normalizeFilename(s: string): string {
  return s.replace(NBSP_RE, " ").normalize("NFC");
}

export function basename(s: string): string {
  const i = s.lastIndexOf("/");
  return i === -1 ? s : s.slice(i + 1);
}

export function dirname(s: string): string {
  const i = s.lastIndexOf("/");
  return i === -1 ? "" : s.slice(0, i);
}

export function extension(s: string): string {
  const name = basename(s);
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

export function withoutExtension(s: string): string {
  const i = s.lastIndexOf(".");
  if (i <= 0 || i === s.length - 1) return s;
  return s.slice(0, i);
}

export function isHidden(s: string): boolean {
  let cur = s;
  while (cur) {
    if (basename(cur).startsWith(".")) return true;
    cur = dirname(cur);
  }
  return false;
}

export function isNote(s: string): boolean {
  return extension(s) === "md";
}

export function isCanvas(s: string): boolean {
  return extension(s) === "canvas";
}

export const IMAGE_EXTS = ["bmp", "png", "jpg", "jpeg", "gif", "svg", "webp", "avif"] as const;
export const AUDIO_EXTS = ["mp3", "wav", "m4a", "3gp", "flac", "ogg", "oga", "opus"] as const;
export const VIDEO_EXTS = ["mp4", "webm", "ogv", "mov", "mkv"] as const;
export const PDF_EXTS = ["pdf"] as const;

export type FileCategory = "note" | "canvas" | "image" | "audio" | "video" | "pdf" | "other";

export function fileType(s: string): FileCategory {
  const ext = extension(s);
  if (ext === "md") return "note";
  if (ext === "canvas") return "canvas";
  if ((IMAGE_EXTS as readonly string[]).includes(ext)) return "image";
  if ((AUDIO_EXTS as readonly string[]).includes(ext)) return "audio";
  if ((VIDEO_EXTS as readonly string[]).includes(ext)) return "video";
  if ((PDF_EXTS as readonly string[]).includes(ext)) return "pdf";
  return "other";
}

// Minimal YAML frontmatter parser — handles the subset Obsidian actually produces.
export interface FrontmatterResult {
  data: Record<string, unknown> | null;
  body: string;
}

export function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { data: null, body: content };
  }

  const endMatch = content.match(/\r?\n---\s*(?:\r?\n|$)/);
  if (!endMatch) return { data: null, body: content };

  const endIdx = content.indexOf(endMatch[0], 3);
  const raw = content.substring(content.indexOf("\n") + 1, endIdx);
  const body = content.substring(endIdx + endMatch[0].length);

  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let inArray = false;

  for (const line of raw.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (inArray && /^\s+-\s/.test(line)) {
      const val = trimmed.replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, "");
      const arr = data[currentKey!];
      if (Array.isArray(arr)) arr.push(val);
      continue;
    }

    inArray = false;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).trim();
    let value: string = trimmed.substring(colonIdx + 1).trim();
    currentKey = key;

    if (value === "") {
      data[key] = [];
      inArray = true;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      data[key] = value.slice(1, -1);
      continue;
    }

    if (value === "true") { data[key] = true; continue; }
    if (value === "false") { data[key] = false; continue; }
    if (/^-?\d+$/.test(value)) { data[key] = parseInt(value, 10); continue; }
    if (/^-?\d+\.\d+$/.test(value)) { data[key] = parseFloat(value); continue; }

    data[key] = value;
  }

  return { data, body };
}

export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  if (!data || Object.keys(data).length === 0) return body;

  let fm = "---\n";
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      fm += `${key}:\n`;
      for (const item of value) fm += `  - ${item}\n`;
    } else {
      fm += `${key}: ${value}\n`;
    }
  }
  fm += "---\n";
  return fm + body;
}

export function extractInlineTags(content: string): string[] {
  const tags = new Set<string>();
  const re = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) tags.add(m[1]!);
  return [...tags];
}

export function extractWikiLinks(content: string): string[] {
  const links = new Set<string>();
  const re = /\[\[([^\]|#]+)(?:[#|][^\]]*)?]]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) links.add(m[1]!.trim());
  return [...links];
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${i === 0 ? bytes : bytes.toFixed(2)} ${units[i]}`;
}

const INVALID_CHARS_RE = /[\\/:*?"<>|]/g;
export function sanitizeFilename(name: string): string {
  return name.replace(INVALID_CHARS_RE, "_").trim();
}

export function resolveNotePath(input: string): string {
  let p = normalizePath(input);
  if (p === "/") return p;
  if (!p.endsWith(".md")) p += ".md";
  return p;
}
