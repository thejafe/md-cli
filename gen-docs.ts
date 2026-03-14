#!/usr/bin/env bun
// Generates docs/reference.md and updates README.md from lib/commands.ts.
// Run: bun run gen-docs.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { groups, standaloneCommands } from "./lib/commands.ts";
import type { CommandDef, CommandGroup, OptionDef } from "./lib/commands.ts";

const { version: VERSION } = JSON.parse(readFileSync("./package.json", "utf-8"));
const REF_PATH = "./docs/reference.md";
const README_PATH = "./README.md";
const BEGIN_MARKER = "<!-- BEGIN AUTO GENERATED REFERENCE -->";
const END_MARKER = "<!-- END AUTO GENERATED REFERENCE -->";

// ─── Markdown helpers ────────────────────────────────────────────────────────

function anchor(group: string, cmd: string): string {
  return `${group}-${cmd}`.toLowerCase().replace(/\s+/g, "-");
}

function optionUsage(name: string, opt: OptionDef): string {
  const flag = opt.short ? `-${opt.short}, --${name}` : `--${name}`;
  if (opt.type === "boolean") return `[${flag}]`;
  const ph = opt.placeholder || name;
  return `[${flag} <${ph}>]`;
}

function commandSignature(group: string | null, cmd: CommandDef): string {
  const parts = ["md"];
  if (group) parts.push(group);
  parts.push(cmd.name);
  if (cmd.positionals) {
    for (const p of cmd.positionals) {
      parts.push(p.required ? `<${p.name}>` : `[${p.name}]`);
    }
  }
  if (cmd.options) {
    for (const [name, opt] of Object.entries(cmd.options)) {
      if (name === "path") continue; // global, always implied
      parts.push(optionUsage(name, opt));
    }
  }
  return parts.join(" ");
}

// ─── Reference doc ───────────────────────────────────────────────────────────

function generateReference(): string {
  const lines: string[] = [];

  lines.push(`<!-- AUTO GENERATED — run 'bun run gen' to update -->`);
  lines.push("");
  lines.push(`# md-cli Reference (v${VERSION})`);
  lines.push("");
  lines.push("All commands accept `--path <path>` (`-p`) to specify the vault directory. Defaults to the current working directory.");
  lines.push("");

  // ── TOC ──
  lines.push("## Table of Contents");
  lines.push("");
  for (const g of groups) {
    lines.push(`- **[${g.label}](#${g.label.toLowerCase().replace(/\s+/g, "-")})** — ${g.description}`);
    for (const cmd of g.commands) {
      lines.push(`  - [\`${g.name} ${cmd.name}\`](#${anchor(g.name, cmd.name)})`);
    }
  }
  lines.push(`- **[Tools](#tools)**`);
  for (const cmd of standaloneCommands) {
    lines.push(`  - [\`${cmd.name}\`](#${cmd.name})`);
  }
  lines.push("");

  // ── Grouped commands ──
  for (const g of groups) {
    lines.push(`## ${g.label}`);
    lines.push("");
    lines.push(g.description);
    lines.push("");

    for (const cmd of g.commands) {
      renderCommand(lines, cmd, g);
    }
  }

  // ── Standalone commands ──
  lines.push("## Tools");
  lines.push("");
  for (const cmd of standaloneCommands) {
    renderCommand(lines, cmd, null);
  }

  return lines.join("\n");
}

function renderCommand(lines: string[], cmd: CommandDef, group: CommandGroup | null): void {
  const prefix = group ? `${group.name} ` : "";
  lines.push(`### \`${prefix}${cmd.name}\``);
  lines.push("");
  lines.push(cmd.description);
  lines.push("");

  // Signature
  lines.push("```");
  lines.push(commandSignature(group?.name ?? null, cmd));
  lines.push("```");
  lines.push("");

  // Positionals
  if (cmd.positionals?.length) {
    lines.push("**Arguments:**");
    lines.push("");
    for (const p of cmd.positionals) {
      const req = p.required ? "**required**" : "_optional_";
      lines.push(`| \`${p.name}\` | ${p.description} | ${req} |`);
    }
    // prepend header
    const idx = lines.lastIndexOf("**Arguments:**");
    lines.splice(idx + 2, 0, "| Argument | Description | |", "|---|---|---|");
    lines.push("");
  }

  // Options
  if (cmd.options && Object.keys(cmd.options).length > 0) {
    lines.push("**Options:**");
    lines.push("");
    lines.push("| Flag | Description | Default |");
    lines.push("|---|---|---|");
    for (const [name, opt] of Object.entries(cmd.options)) {
      const flag = opt.short ? `\`-${opt.short}\`, \`--${name}\`` : `\`--${name}\``;
      const def = opt.default ?? (opt.type === "boolean" ? "`false`" : "—");
      let desc = opt.description;
      if (opt.choices) desc += ` Choices: ${opt.choices.map((c) => `\`${c}\``).join(", ")}.`;
      lines.push(`| ${flag} | ${desc} | ${def} |`);
    }
    lines.push("");
  }

  // Stdin
  if (cmd.stdin) {
    lines.push(`**Stdin:** ${cmd.stdin}`);
    lines.push("");
  }

  // Examples
  if (cmd.examples?.length) {
    lines.push("**Examples:**");
    lines.push("");
    lines.push("```sh");
    for (const ex of cmd.examples) lines.push(ex);
    lines.push("```");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
}

// ─── README TOC ──────────────────────────────────────────────────────────────

function generateReadmeTOC(): string {
  const lines: string[] = [];

  for (const g of groups) {
    lines.push(`**${g.label}**`);
    lines.push("");
    lines.push("| Command | Description |");
    lines.push("|---|---|");
    for (const cmd of g.commands) {
      lines.push(`| \`md ${g.name} ${cmd.name}\` | ${cmd.description.split(".")[0]}. |`);
    }
    lines.push("");
  }

  lines.push("**Tools**");
  lines.push("");
  lines.push("| Command | Description |");
  lines.push("|---|---|");
  for (const cmd of standaloneCommands) {
    lines.push(`| \`md ${cmd.name}\` | ${cmd.description.split(".")[0]}. |`);
  }
  lines.push("");
  lines.push(`> Full reference: [docs/reference.md](docs/reference.md)`);

  return lines.join("\n");
}

function updateReadme(toc: string): void {
  if (!existsSync(README_PATH)) {
    console.log("No README.md found, skipping README update.");
    return;
  }

  const content = readFileSync(README_PATH, "utf-8");
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (beginIdx === -1 || endIdx === -1) {
    console.log(
      `No auto-gen markers found in README.md. Add these lines where you want the reference:\n  ${BEGIN_MARKER}\n  ${END_MARKER}`,
    );
    return;
  }

  const before = content.substring(0, beginIdx + BEGIN_MARKER.length);
  const after = content.substring(endIdx);
  const updated = `${before}\n\n${toc}\n\n${after}`;

  writeFileSync(README_PATH, updated);
  console.log("Updated README.md");
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ref = generateReference();

if (!existsSync("./docs")) mkdirSync("./docs");
writeFileSync(REF_PATH, ref + "\n");
console.log(`Generated ${REF_PATH} (${groups.reduce((n, g) => n + g.commands.length, 0) + standaloneCommands.length} commands)`);

const toc = generateReadmeTOC();
updateReadme(toc);
