#!/usr/bin/env bun
// md-cli — Headless CLI for Obsidian vaults.
// Zero external dependencies. Runs on Bun.

import { parseArgs } from "util";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, join, basename as pathBasename } from "node:path";
import { VaultAdapter } from "./lib/adapter.ts";
import * as config from "./lib/config.ts";
import * as utils from "./lib/utils.ts";

const VERSION = "0.1.0";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function adapter(pathArg?: string): VaultAdapter {
  const vaultPath = config.resolveVaultPath(pathArg);
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

// ─── Command dispatch ────────────────────────────────────────────────────────

async function main() {
  if (!command || command === "--help" || command === "-h") {
    console.log(`md v${VERSION} — CLI for Obsidian vaults\n`);
    console.log("USAGE");
    console.log("  md <command> [options]\n");
    console.log("COMMANDS");
    console.log("  vault init     Register a vault");
    console.log("  vault list     List registered vaults");
    console.log("  vault status   Show vault statistics");
    console.log("  vault unlink   Deregister a vault");
    return;
  }
  if (command === "--version" || command === "-V") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "vault": return vaultCmd();
    default: die(`Unknown command: ${command}\nRun 'md --help' for usage.`);
  }
}

// ─── vault ───────────────────────────────────────────────────────────────────

async function vaultCmd() {
  const opts = parseArgs({
    args: args.slice(2),
    options: {
      path: { type: "string", short: "p" },
      name: { type: "string", short: "n" },
      "config-dir": { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  switch (subcommand) {
    case "init":   return vaultInit(opts);
    case "list":   return vaultList();
    case "status": return vaultStatus(opts);
    case "unlink": return vaultUnlink(opts);
    default: die("Usage: md vault <init|list|status|unlink>");
  }
}

function vaultInit(opts: { values: Record<string, unknown> }) {
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

async function vaultStatus(opts: { values: Record<string, unknown> }) {
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  const v = config.findVault(vaultPath);
  const a = adapter(opts.values.path as string | undefined);

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

function vaultUnlink(opts: { values: Record<string, unknown> }) {
  const vaultPath = config.resolveVaultPath(opts.values.path as string | undefined);
  if (config.unregisterVault(vaultPath)) console.log(`Vault deregistered: ${vaultPath}`);
  else die(`No vault registered at ${vaultPath}`, 3);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
