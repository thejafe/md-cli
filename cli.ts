#!/usr/bin/env bun
// md-cli — Headless CLI for Obsidian vaults.
// Zero external dependencies. Runs on Bun.

import { parseArgs } from "util";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join, basename as pathBasename } from "node:path";
import { isatty } from "node:tty";
import { VaultAdapter } from "./lib/adapter.ts";
import * as config from "./lib/config.ts";
import * as utils from "./lib/utils.ts";
import { groups, standaloneCommands, parseArgsOptions, findCommand } from "./lib/commands.ts";
import type { CommandDef } from "./lib/commands.ts";
import { startRepl } from "./lib/repl.ts";

import pkg from "./package.json";
const VERSION: string = pkg.version;

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function getOpts(cmdDef: CommandDef) {
  try {
    return parseArgs({
      args: args.slice(command === "vault" || command === "note" ? 2 : 1),
      options: parseArgsOptions(cmdDef),
      strict: true,
      allowPositionals: true,
    });
  } catch (e: unknown) {
    die((e as Error).message);
  }
}

function adapter(opts: { values: Record<string, unknown> }): VaultAdapter {
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  const v = config.findVault(vaultPath);
  return new VaultAdapter(vaultPath, v?.configDir ?? ".obsidian");
}

function printVaultInfo(v: config.VaultConfig): void {
  console.log(`  Name:              ${v.name}`);
  console.log(`  Path:              ${v.path}`);
  console.log(`  ID:                ${v.id}`);
  console.log(`  Config dir:        ${v.configDir}`);
  console.log(`  Daily folder:      ${v.dailyFolder || "(none)"}`);
  console.log(`  Attachment folder: ${v.attachmentFolder || "(vault root)"}`);
  console.log(`  Trash:             ${v.trashOption}`);
}

async function readStdin(): Promise<string | null> {
  if (Bun.stdin.stream().locked) return null;
  // Check if stdin is a TTY — no piped input
  if (isatty(0)) return null;
  const text = await Bun.stdin.text();
  return text || null;
}

// ─── Command dispatch ────────────────────────────────────────────────────────

async function main() {
  if (!command) {
    if (isatty(0) && !process.env.MD_REPL_CHILD) {
      return startRepl(VERSION);
    }
  }

  if (!command) {
    printHelp();
    return;
  }
  if (command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "--version" || command === "-V") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "vault": return vaultCmd();
    case "note":  return noteCmd();
    case "tags":  return tagsCmd();
    case "daily": return dailyCmd();
    case "backlinks": return backlinksCmd();
    case "links": return linksCmd();
    case "tree":  return treeCmd();
    case "tasks": return tasksCmd();
    case "task":  return taskCmd();
    default: die(`Unknown command: ${command}\nRun 'md --help' for usage.`);
  }
}

// ─── vault ───────────────────────────────────────────────────────────────────

function vaultCmd() {
  switch (subcommand) {
    case "init":   return vaultInit();
    case "list":   return vaultList();
    case "status": return vaultStatus();
    case "config": return vaultConfig();
    case "unlink": return vaultUnlink();
    default: die("Usage: md vault <init|list|status|config|unlink>");
  }
}

function vaultInit() {
  const opts = getOpts(findCommand("vault", "init")!);
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  if (!existsSync(vaultPath)) mkdirSync(vaultPath, { recursive: true });

  const configDir = (opts.values["config-dir"] as string) || ".obsidian";
  const obsDir = join(vaultPath, configDir);
  if (!existsSync(obsDir)) mkdirSync(obsDir, { recursive: true });

  const v = config.registerVault(vaultPath, {
    name: opts.values.name as string | undefined,
    configDir,
  });
  console.log("Vault registered:");
  printVaultInfo(v);
}

function vaultList() {
  const vaults = config.listVaults();
  if (vaults.length === 0) {
    console.log("No vaults registered.\nRun 'md vault init' to register a vault.");
    return;
  }
  console.log("Registered vaults:");
  for (const v of vaults) {
    console.log(`  ${v.name}`);
    console.log(`    Path: ${v.path}`);
    console.log(`    ID:   ${v.id}`);
  }
}

async function vaultStatus() {
  const opts = getOpts(findCommand("vault", "status")!);
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  const v = config.findVault(vaultPath);
  const a = adapter(opts);

  const notes = a.listNotes();
  const allFiles = a.listRecursive("", (f) => !utils.isHidden(f));
  const attachments = allFiles.filter((f) => !utils.isNote(f));

  let totalSize = 0;
  let lastModified = 0;
  for (const f of allFiles) {
    const s = a.stat(f);
    if (s) {
      totalSize += s.size;
      if (s.mtime > lastModified) lastModified = s.mtime;
    }
  }

  console.log(`Vault: ${v?.name || pathBasename(vaultPath)}`);
  console.log(`  Path:          ${vaultPath}`);
  console.log(`  Config dir:    ${v?.configDir || ".obsidian"}`);
  console.log(`  Notes:         ${notes.length}`);
  console.log(`  Attachments:   ${attachments.length}`);
  console.log(`  Total files:   ${allFiles.length}`);
  console.log(`  Total size:    ${utils.formatSize(totalSize)}`);
  if (lastModified > 0) console.log(`  Last modified: ${new Date(lastModified).toISOString()}`);
  if (v) {
    console.log(`  Daily folder:  ${v.dailyFolder || "(none)"}`);
    console.log(`  Attachments:   ${v.attachmentFolder || "(vault root)"}`);
    console.log(`  Trash:         ${v.trashOption || "local"}`);
  }
}

function vaultConfig() {
  const opts = getOpts(findCommand("vault", "config")!);
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  let v = config.findVault(vaultPath);
  if (!v) die(`No vault registered at ${vaultPath}\nRun 'md vault init' first.`, 3);

  const updates: config.VaultUpdateOpts = {};
  let changed = false;

  const set = <K extends keyof config.VaultUpdateOpts>(
    key: K, argKey: string
  ) => {
    const val = opts.values[argKey];
    if (val !== undefined) {
      (updates as Record<string, unknown>)[key] = val;
      changed = true;
    }
  };

  set("name", "name");
  set("dailyFolder", "daily-folder");
  set("attachmentFolder", "attachment-folder");
  set("configDir", "config-dir");

  const trash = opts.values["trash-option"] as string | undefined;
  if (trash !== undefined) {
    if (!["local", "system", "permanent"].includes(trash))
      die('Invalid trash option. Must be: local, system, or permanent');
    updates.trashOption = trash as config.VaultConfig["trashOption"];
    changed = true;
  }

  if (changed) v = config.registerVault(vaultPath, updates);
  console.log(changed ? "Configuration updated:" : "Current configuration:");
  printVaultInfo(v!);
}

function vaultUnlink() {
  const opts = getOpts(findCommand("vault", "unlink")!);
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  if (config.unregisterVault(vaultPath)) console.log(`Vault deregistered: ${vaultPath}`);
  else die(`No vault registered at ${vaultPath}`, 3);
}

// ─── note ────────────────────────────────────────────────────────────────────

async function noteCmd() {
  switch (subcommand) {
    case "list":    return noteList();
    case "read":    return noteRead();
    case "create":  return noteCreate();
    case "edit":    return noteEdit();
    case "append":  return noteAppend();
    case "prepend": return notePrepend();
    case "delete":  return noteDelete();
    case "rename":  return noteRename();
    case "search":  return noteSearch();
    default: die("Usage: md note <list|read|create|edit|append|prepend|delete|rename|search>");
  }
}

function noteList() {
  const opts = getOpts(findCommand("note", "list")!);
  const a = adapter(opts);
  const notes = a.listNotes((opts.values.folder as string) || "");

  if (notes.length === 0) { console.log("No notes found."); return; }

  if (opts.values.long) {
    for (const n of notes) {
      const s = a.stat(n);
      const mtime = s ? new Date(s.mtime).toISOString().substring(0, 19) : "";
      const size = s ? utils.formatSize(s.size).padStart(10) : "";
      console.log(`${mtime}  ${size}  ${n}`);
    }
  } else {
    for (const n of notes) console.log(n);
  }
}

async function noteRead() {
  const opts = getOpts(findCommand("note", "read")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note read <note>");
  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);

  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  const content = await a.read(resolved);

  if (opts.values.frontmatter || opts.values.body) {
    const { data, body } = utils.parseFrontmatter(content);
    if (opts.values.frontmatter) {
      if (data) console.log(JSON.stringify(data, null, 2));
    } else {
      await Bun.write(Bun.stdout, body);
    }
  } else {
    await Bun.write(Bun.stdout, content);
  }
}

async function noteCreate() {
  const opts = getOpts(findCommand("note", "create")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note create <note> [--content <text>] [--tags <tags>]");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);

  if (a.exists(resolved) && !opts.values.force)
    die(`Note already exists: ${resolved}\nUse --force to overwrite.`);

  let content = (opts.values.content as string)?.replace(/\\n/g, "\n")
    ?? await readStdin()
    ?? "";

  if (opts.values.tags) {
    const tags = (opts.values.tags as string).split(",").map((t) => t.trim()).filter(Boolean);
    const { data, body } = utils.parseFrontmatter(content);
    content = utils.serializeFrontmatter({ ...(data || {}), tags }, body || content);
  }

  await a.write(resolved, content);
  console.log(`Created: ${resolved}`);
}

async function noteEdit() {
  const opts = getOpts(findCommand("note", "edit")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note edit <note> [--content <text>]");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  if (opts.values.content !== undefined) {
    await a.write(resolved, (opts.values.content as string).replace(/\\n/g, "\n"));
    console.log(`Updated: ${resolved}`);
  } else {
    const stdin = await readStdin();
    if (stdin) {
      await a.write(resolved, stdin);
      console.log(`Updated: ${resolved}`);
    } else {
      die("No content provided. Use --content or pipe via stdin.");
    }
  }
}

/** Find the line range for a markdown heading's section. Strips leading #s for flexible matching. */
function findHeadingSection(
  lines: string[],
  heading: string,
): { headingIdx: number; bodyStart: number; bodyEnd: number } | null {
  const query = heading.replace(/^#+\s*/, "").trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{1,6})\s+(.+)/.exec(lines[i]!);
    if (!m) continue;
    if (m[2]!.trim().toLowerCase() !== query) continue;
    const level = m[1]!.length;
    let bodyEnd = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const nm = /^(#{1,6})\s/.exec(lines[j]!);
      if (nm && nm[1]!.length <= level) { bodyEnd = j; break; }
    }
    return { headingIdx: i, bodyStart: i + 1, bodyEnd };
  }
  return null;
}

async function noteAppend() {
  const opts = getOpts(findCommand("note", "append")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note append <note> [--content <text>] [--heading <heading>]");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  const rawText = (opts.values.content as string | undefined)?.replace(/\\n/g, "\n")
    ?? await readStdin()
    ?? die("No content provided. Use --content or pipe via stdin.");

  const heading = opts.values.heading as string | undefined;
  if (heading) {
    const content = await a.read(resolved);
    const lines = content.split("\n");
    const section = findHeadingSection(lines, heading);
    if (!section) die(`Heading not found: "${heading}"`);
    // Insert before trailing blank lines at section end
    let insertAt = section.bodyEnd;
    while (insertAt > section.bodyStart && lines[insertAt - 1]!.trim() === "") insertAt--;
    lines.splice(insertAt, 0, ...rawText.split("\n"));
    await a.write(resolved, lines.join("\n"));
    console.log(`Appended to [${heading}] in: ${resolved}`);
  } else {
    a.append(resolved, (rawText.startsWith("\n") ? "" : "\n") + rawText);
    console.log(`Appended to: ${resolved}`);
  }
}

async function notePrepend() {
  const opts = getOpts(findCommand("note", "prepend")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note prepend <note> [--content <text>] [--heading <heading>]");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  const rawText = (opts.values.content as string | undefined)?.replace(/\\n/g, "\n")
    ?? await readStdin()
    ?? die("No content provided. Use --content or pipe via stdin.");

  const heading = opts.values.heading as string | undefined;
  if (heading) {
    const content = await a.read(resolved);
    const lines = content.split("\n");
    const section = findHeadingSection(lines, heading);
    if (!section) die(`Heading not found: "${heading}"`);
    lines.splice(section.bodyStart, 0, ...rawText.split("\n"));
    await a.write(resolved, lines.join("\n"));
    console.log(`Prepended to [${heading}] in: ${resolved}`);
  } else {
    // Always insert after optional frontmatter, never before it
    const existing = await a.read(resolved);
    const { data, body } = utils.parseFrontmatter(existing);
    const newBody = rawText + "\n" + body;
    await a.write(resolved, data ? utils.serializeFrontmatter(data, newBody) : newBody);
    console.log(`Prepended to: ${resolved}`);
  }
}

function noteDelete() {
  const opts = getOpts(findCommand("note", "delete")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md note delete <note>");

  const a = adapter(opts);
  const v = config.findVault(config.resolveVaultPath(opts.values.path as string | undefined));
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  if (opts.values.permanent || v?.trashOption === "permanent") {
    a.remove(resolved);
    console.log(`Deleted: ${resolved}`);
  } else {
    a.trash(resolved);
    console.log(`Moved to trash: ${resolved}`);
  }
}

function noteRename() {
  const opts = getOpts(findCommand("note", "rename")!);
  const [from, to] = opts.positionals;
  if (!from || !to) die("Usage: md note rename <note> <new-name>");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(from);
  const newResolved = utils.resolveNotePath(to);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  a.rename(resolved, newResolved);
  console.log(`Renamed: ${resolved} -> ${newResolved}`);
}

async function noteSearch() {
  const opts = getOpts(findCommand("note", "search")!);
  const query = opts.positionals[0];
  if (!query) die("Usage: md note search <query>");

  const a = adapter(opts);
  const results = await a.search(query, (opts.values.folder as string) || "", !!opts.values.regex);

  if (results.length === 0) { console.log("No matches found."); return; }

  if (opts.values.count) {
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.path] = (counts[r.path] || 0) + 1;
    for (const [p, c] of Object.entries(counts)) console.log(`${p}: ${c}`);
  } else {
    for (const r of results) console.log(`${r.path}:${r.line}: ${r.text}`);
  }
  console.log(`\n${results.length} match${results.length !== 1 ? "es" : ""} found.`);
}

// ─── Top-level commands ──────────────────────────────────────────────────────

async function tagsCmd() {
  const opts = getOpts(findCommand("tags")!);
  const a = adapter(opts);
  const notes = a.listNotes();
  const tagCounts: Record<string, number> = {};
  const contents = await a.readMany(notes);

  for (const [, content] of contents) {
    const { data, body } = utils.parseFrontmatter(content);

    if (data?.tags) {
      const fmTags = Array.isArray(data.tags) ? data.tags : [data.tags];
      for (const t of fmTags) {
        const tag = String(t).trim();
        if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    for (const t of utils.extractInlineTags(body || content)) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  const sorted = Object.entries(tagCounts).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) { console.log("No tags found."); return; }

  for (const [tag, count] of sorted) {
    console.log(opts.values.count ? `#${tag}: ${count}` : `#${tag}`);
  }
  console.log(`\n${sorted.length} tag${sorted.length !== 1 ? "s" : ""} found.`);
}

async function dailyCmd() {
  const opts = getOpts(findCommand("daily")!);
  const a = adapter(opts);
  const v = config.findVault(config.resolveVaultPath(opts.values.path as string | undefined));
  const folder = (opts.values.folder as string) || v?.dailyFolder || "";

  const date = (opts.values.date as string) || new Date().toISOString().substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die("Invalid date format. Use YYYY-MM-DD.");

  const notePath = folder ? `${folder}/${date}.md` : `${date}.md`;

  if (a.exists(notePath)) {
    await Bun.write(Bun.stdout, await a.read(notePath));
  } else {
    await a.write(notePath, `---\ndate: ${date}\n---\n\n# ${date}\n\n`);
    console.log(`Created daily note: ${notePath}`);
  }
}

async function backlinksCmd() {
  const opts = getOpts(findCommand("backlinks")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md backlinks <note>");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  const targetName = utils.withoutExtension(utils.basename(resolved));

  const notes = a.listNotes();
  const contents = await a.readMany(notes.filter((n) => n !== resolved));
  const backlinks: string[] = [];

  for (const [n, content] of contents) {
    const links = utils.extractWikiLinks(content);
    if (links.some((l) =>
      l === targetName || l === resolved || utils.resolveNotePath(l) === resolved
    )) {
      backlinks.push(n);
    }
  }

  if (backlinks.length === 0) { console.log(`No backlinks found for ${resolved}`); return; }

  console.log(`Backlinks to ${resolved}:`);
  for (const b of backlinks) console.log(`  ${b}`);
  console.log(`\n${backlinks.length} backlink${backlinks.length !== 1 ? "s" : ""} found.`);
}

async function linksCmd() {
  const opts = getOpts(findCommand("links")!);
  const notePath = opts.positionals[0];
  if (!notePath) die("Usage: md links <note>");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  const content = await a.read(resolved);
  const links = utils.extractWikiLinks(content);

  if (links.length === 0) { console.log(`No links found in ${resolved}`); return; }

  console.log(`Links in ${resolved}:`);
  for (const l of links) {
    const target = utils.resolveNotePath(l);
    console.log(`  [[${l}]]${a.exists(target) ? "" : " (missing)"}`);
  }
}

function treeCmd() {
  const opts = getOpts(findCommand("tree")!);
  const a = adapter(opts);
  const depth = opts.values.depth ? parseInt(opts.values.depth as string, 10) : Infinity;
  process.stdout.write(a.tree("", depth));
}

// ─── tasks / task ────────────────────────────────────────────────────────────

interface TaskEntry {
  path: string;
  line: number;
  status: string;
  text: string;
}

const TASK_RE = /^(\s*[-*+]\s+)\[(.)\]\s*(.*)/;

function parseTasks(notePath: string, content: string): TaskEntry[] {
  const tasks: TaskEntry[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = TASK_RE.exec(lines[i]!);
    if (m) tasks.push({ path: notePath, line: i + 1, status: m[2]!, text: m[3]!.trimEnd() });
  }
  return tasks;
}

/** Parse keyword-style positional args like `file=Recipe done status=?` */
function parseKeywordArgs(positionals: string[]): Record<string, string | true> {
  const kw: Record<string, string | true> = {};
  for (const tok of positionals) {
    const eq = tok.indexOf("=");
    if (eq > 0) kw[tok.slice(0, eq)] = tok.slice(eq + 1);
    else kw[tok] = true;
  }
  return kw;
}

function resolveDailyPath(opts: { values: Record<string,unknown> }): string {
  const v = config.findVault(config.resolveVaultPath(opts.values.path as string | undefined));
  const folder = v?.dailyFolder || "";
  const date = new Date().toISOString().substring(0, 10);
  return folder ? `${folder}/${date}.md` : `${date}.md`;
}

function findNoteByName(a: VaultAdapter, name: string): string | null {
  const resolved = utils.resolveNotePath(name);
  if (a.exists(resolved)) return resolved;
  // Search all notes for a basename match
  const notes = a.listNotes();
  const target = utils.withoutExtension(utils.basename(resolved)).toLowerCase();
  return notes.find((n) => utils.withoutExtension(utils.basename(n)).toLowerCase() === target) ?? null;
}

function formatTask(t: TaskEntry): string {
  return `- [${t.status}] ${t.text}`;
}

function formatTaskVerbose(t: TaskEntry): string {
  return `${t.path}:${t.line}: - [${t.status}] ${t.text}`;
}

function formatTasksOutput(tasks: TaskEntry[], format: string | undefined, verbose: boolean): string {
  if (format === "json") return JSON.stringify(tasks, null, 2);
  if (format === "tsv") {
    const header = "path\tline\tstatus\ttext";
    return [header, ...tasks.map((t) => `${t.path}\t${t.line}\t${t.status}\t${t.text}`)].join("\n");
  }
  if (format === "csv") {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = "path,line,status,text";
    return [header, ...tasks.map((t) => `${esc(t.path)},${t.line},${esc(t.status)},${esc(t.text)}`)].join("\n");
  }
  if (verbose) {
    // Group by file
    const grouped = new Map<string, TaskEntry[]>();
    for (const t of tasks) {
      const arr = grouped.get(t.path) ?? [];
      arr.push(t);
      grouped.set(t.path, arr);
    }
    const lines: string[] = [];
    for (const [p, entries] of grouped) {
      lines.push(p);
      for (const t of entries) lines.push(`  ${t.line}: - [${t.status}] ${t.text}`);
    }
    return lines.join("\n");
  }
  return tasks.map(formatTask).join("\n");
}

async function tasksCmd() {
  const opts = getOpts(findCommand("tasks")!);
  const kw = parseKeywordArgs(opts.positionals as string[]);
  const a = adapter(opts);

  // Determine which notes to scan
  let notes: string[];
  if (kw.daily) {
    const dp = resolveDailyPath(opts);
    if (!a.exists(dp)) die(`Daily note not found: ${dp}`);
    notes = [dp];
  } else if (kw.file) {
    const found = findNoteByName(a, kw.file as string);
    if (!found) die(`Note not found: ${kw.file}`);
    notes = [found];
  } else if (kw.path) {
    const resolved = utils.resolveNotePath(kw.path as string);
    if (!a.exists(resolved)) die(`Note not found: ${resolved}`);
    notes = [resolved];
  } else {
    notes = a.listNotes();
  }

  // Collect tasks
  const contents = await a.readMany(notes);
  let tasks: TaskEntry[] = [];
  for (const [notePath, content] of contents) {
    tasks.push(...parseTasks(notePath, content));
  }

  // Filter by status keyword
  if (kw.todo) tasks = tasks.filter((t) => t.status === " ");
  if (kw.done) tasks = tasks.filter((t) => t.status === "x" || t.status === "X");
  if (kw.status) tasks = tasks.filter((t) => t.status === (kw.status as string));

  // Output
  if (kw.total) {
    console.log(tasks.length);
    return;
  }

  if (tasks.length === 0) { console.log("No tasks found."); return; }

  const format = typeof kw.format === "string" ? kw.format : undefined;
  console.log(formatTasksOutput(tasks, format, !!kw.verbose));
}

async function taskCmd() {
  const opts = getOpts(findCommand("task")!);
  const kw = parseKeywordArgs(opts.positionals as string[]);
  const a = adapter(opts);

  // Resolve target file and line
  let filePath: string | undefined;
  let lineNum: number | undefined;

  if (kw.ref) {
    const ref = kw.ref as string;
    const colonIdx = ref.lastIndexOf(":");
    if (colonIdx === -1) die("Invalid ref format. Use ref=<path:line>");
    const rPath = ref.slice(0, colonIdx);
    const rLine = parseInt(ref.slice(colonIdx + 1), 10);
    if (isNaN(rLine)) die("Invalid line number in ref.");
    const found = findNoteByName(a, rPath);
    if (!found) die(`Note not found: ${rPath}`);
    filePath = found;
    lineNum = rLine;
  } else if (kw.daily) {
    filePath = resolveDailyPath(opts);
    if (!a.exists(filePath)) die(`Daily note not found: ${filePath}`);
    lineNum = kw.line ? parseInt(kw.line as string, 10) : undefined;
  } else {
    if (kw.file) {
      const found = findNoteByName(a, kw.file as string);
      if (!found) die(`Note not found: ${kw.file}`);
      filePath = found;
    } else if (kw.path) {
      filePath = utils.resolveNotePath(kw.path as string);
    }
    lineNum = kw.line ? parseInt(kw.line as string, 10) : undefined;
  }

  if (!filePath) die("Specify a task with ref=<path:line>, or file=<name> line=<n>, or daily line=<n>.");
  if (lineNum === undefined || lineNum <= 0) die("Specify line=<n> or use ref=<path:line>.");

  const content = await a.read(filePath);
  const lines = content.split("\n");
  const targetLine = lines[lineNum - 1];
  if (targetLine === undefined) die(`Line ${lineNum} is out of range (file has ${lines.length} lines).`);

  const m = TASK_RE.exec(targetLine);
  if (!m) die(`Line ${lineNum} is not a task: ${targetLine}`);

  const task: TaskEntry = { path: filePath, line: lineNum, status: m[2]!, text: m[3]!.trimEnd() };

  // Actions: toggle, done, todo, status=X
  const hasAction = kw.toggle || kw.done || kw.todo || kw.status;

  if (!hasAction) {
    // Show task info
    console.log(`file    ${utils.basename(filePath!)}`);
    console.log(`line    ${lineNum}`);
    console.log(`status  ${task.status === " " ? "(empty)" : task.status}`);
    console.log(`text    ${formatTask(task)}`);
    return;
  }

  let newStatus: string;
  if (kw.done) newStatus = "x";
  else if (kw.todo) newStatus = " ";
  else if (kw.toggle) newStatus = (task.status === " ") ? "x" : " ";
  else newStatus = kw.status as string;

  const prefix = m[1]!;
  lines[lineNum - 1] = `${prefix}[${newStatus}] ${task.text}`;
  await a.write(filePath, lines.join("\n"));

  console.log(`Updated: [${task.status}] → [${newStatus}]`);
  console.log(formatTask({ ...task, status: newStatus }));
}

// ─── Help ────────────────────────────────────────────────────────────────────

function printHelp() {
  const lines: string[] = [`md v${VERSION} — CLI for Obsidian vaults`, "", "USAGE", "  md <command> [options]", ""];

  for (const g of groups) {
    lines.push(g.label.toUpperCase());
    for (const cmd of g.commands) {
      const sig = buildSig(g.name, cmd);
      lines.push(`  ${sig}`);
    }
    lines.push("");
  }

  lines.push("TOOLS");
  for (const cmd of standaloneCommands) {
    const sig = buildSig(null, cmd);
    lines.push(`  ${sig}`);
  }
  lines.push("");

  lines.push("OPTIONS");
  lines.push("  -p, --path     Vault path (default: current directory)");
  lines.push("  -h, --help     Show this help");
  lines.push("  -V, --version  Show version");

  console.log(lines.join("\n"));
}

function buildSig(group: string | null, cmd: CommandDef): string {
  const parts: string[] = [];
  if (group) parts.push(group);
  parts.push(cmd.name.padEnd(group ? 10 : 14));
  if (cmd.positionals) {
    for (const p of cmd.positionals) {
      parts.push(p.required ? `<${p.name}>` : `[${p.name}]`);
    }
  }
  if (cmd.options) {
    for (const [name, opt] of Object.entries(cmd.options)) {
      if (name === "path") continue;
      const flag = `--${name}`;
      if (opt.type === "boolean") {
        parts.push(`[${flag}]`);
      } else {
        parts.push(`[${flag} <${opt.placeholder || name}>]`);
      }
    }
  }
  return parts.join(" ");
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
