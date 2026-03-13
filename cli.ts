#!/usr/bin/env bun
// md-cli — Headless CLI for Obsidian vaults.
// Zero external dependencies. Runs on Bun.

import { parseArgs } from "util";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join, basename as pathBasename } from "node:path";
import { VaultAdapter } from "./lib/adapter.ts";
import * as config from "./lib/config.ts";
import * as utils from "./lib/utils.ts";
import { groups, standaloneCommands, parseArgsOptions, findCommand } from "./lib/commands.ts";
import type { CommandDef } from "./lib/commands.ts";

const { version: VERSION } = await Bun.file("./package.json").json();



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
      strict: false,
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
  if (process.stdin.isTTY) return null;
  const text = await Bun.stdin.text();
  return text || null;
}

// ─── Command dispatch ────────────────────────────────────────────────────────

async function main() {
  if (!command || command === "--help" || command === "-h") {
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
    default: die(`Unknown command: ${command}\nRun 'md --help' for usage.`);
  }
}

// ─── vault ───────────────────────────────────────────────────────────────────

async function vaultCmd() {
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
    case "list":   return noteList();
    case "read":   return noteRead();
    case "create": return noteCreate();
    case "edit":   return noteEdit();
    case "delete": return noteDelete();
    case "rename": return noteRename();
    case "search": return noteSearch();
    default: die("Usage: md note <list|read|create|edit|delete|rename|search>");
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
  if (!notePath) die("Usage: md note edit <note> [--content|--append|--prepend <text>]");

  const a = adapter(opts);
  const resolved = utils.resolveNotePath(notePath);
  if (!a.exists(resolved)) die(`Note not found: ${resolved}`);

  if (opts.values.content !== undefined) {
    await a.write(resolved, (opts.values.content as string).replace(/\\n/g, "\n"));
    console.log(`Updated: ${resolved}`);
  } else if (opts.values.append !== undefined) {
    const text = (opts.values.append as string).replace(/\\n/g, "\n");
    a.append(resolved, (text.startsWith("\n") ? "" : "\n") + text);
    console.log(`Appended to: ${resolved}`);
  } else if (opts.values.prepend !== undefined) {
    const existing = await a.read(resolved);
    const { data, body } = utils.parseFrontmatter(existing);
    const text = (opts.values.prepend as string).replace(/\\n/g, "\n");
    const newBody = text + "\n" + body;
    await a.write(resolved, data ? utils.serializeFrontmatter(data, newBody) : newBody);
    console.log(`Prepended to: ${resolved}`);
  } else {
    const stdin = await readStdin();
    if (stdin) {
      await a.write(resolved, stdin);
      console.log(`Updated: ${resolved}`);
    } else {
      die("No content provided. Use --content, --append, --prepend, or pipe via stdin.");
    }
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
