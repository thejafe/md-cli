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
