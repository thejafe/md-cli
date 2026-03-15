// Interactive REPL with autocomplete for md-cli.
// Zero external dependencies — raw terminal mode with ANSI escape codes.

import { groups, standaloneCommands } from "./commands.ts";

// Compiled Bun binaries have argv[1] pointing to /$bunfs/root/...
// In that case, execPath IS the binary — no separate script arg needed.
const isCompiled = process.argv[1]?.startsWith("/$bunfs/");
const selfCmd = isCompiled
  ? [process.execPath]
  : [process.execPath, process.argv[1]];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Completion {
  name: string;
  description: string;
}

interface State {
  input: string;
  cursor: number;
  selected: number;
  history: string[];
  historyPos: number;
  savedInput: string;
}

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const A = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  blue: "\x1b[1;34m",
  purple: "\x1b[1;35m",
  white: "\x1b[1;97m",
  gray: "\x1b[0;37m",
  clearDown: "\x1b[J",
  hide: "\x1b[?25l",
  show: "\x1b[?25h",
  col: (n: number) => `\x1b[${n}G`,
  up: (n: number) => (n > 0 ? `\x1b[${n}A` : ""),
};

const MAX_VISIBLE = 10;

// ─── Build completions from command definitions ─────────────────────────────

function buildCompletions(): Completion[] {
  const list: Completion[] = [];

  for (const g of groups)
    for (const cmd of g.commands)
      list.push({ name: `${g.name} ${cmd.name}`, description: cmd.description });

  for (const cmd of standaloneCommands)
    list.push({ name: cmd.name, description: cmd.description });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Filter suggestions by prefix ───────────────────────────────────────────

function match(completions: Completion[], input: string): Completion[] {
  const q = input.trimStart().toLowerCase();
  return q ? completions.filter((c) => c.name.toLowerCase().startsWith(q)) : completions;
}

// ─── Tokenize input (handle quotes) ─────────────────────────────────────────

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (const ch of input) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      q = ch;
    } else if (ch === " " || ch === "\t") {
      if (cur) {
        tokens.push(cur);
        cur = "";
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

// ─── Render prompt + suggestions ─────────────────────────────────────────────

function render(s: State, completions: Completion[]) {
  const cols = process.stdout.columns || 80;
  const hits = match(completions, s.input);

  // Clamp selection
  if (hits.length > 0) {
    s.selected = Math.min(s.selected, Math.min(hits.length, MAX_VISIBLE) - 1);
  } else {
    s.selected = 0;
  }

  let o = A.hide + "\r" + A.clearDown;

  // Prompt + input
  o += `${A.blue}>${A.reset} ${A.white}${s.input}${A.reset}`;

  // Suggestion list
  if (hits.length > 0) {
    const vis = hits.slice(0, MAX_VISIBLE);
    const nameW = Math.max(20, ...vis.map((m) => m.name.length + 2));

    for (let i = 0; i < vis.length; i++) {
      const m = vis[i];
      const sel = i === s.selected;
      const dW = Math.max(0, cols - nameW - 8);
      const desc =
        m.description.length > dW && dW > 4
          ? m.description.slice(0, dW - 1) + "…"
          : m.description;
      const pad = m.name.padEnd(nameW);

      o += sel
        ? `\n  ${A.blue}> ${A.purple}${pad}${A.reset}  ${A.gray}${desc}${A.reset}`
        : `\n    ${A.dim}${pad}${A.reset}  ${A.dim}${desc}${A.reset}`;
    }

    if (hits.length > MAX_VISIBLE)
      o += `\n    ${A.dim}${hits.length - MAX_VISIBLE} more${A.reset}`;

    const linesDown = vis.length + (hits.length > MAX_VISIBLE ? 1 : 0);
    o += A.up(linesDown);
  }

  // Position cursor on input line
  o += "\r" + A.col(s.cursor + 3) + A.show;
  process.stdout.write(o);
}

// ─── Header ──────────────────────────────────────────────────────────────────

function showHeader() {
  const w = process.stdout.columns || 80;
  process.stdout.write(
    `${A.dim}Tab to autocomplete, ↑/↓ to navigate, Ctrl+C to quit${A.reset}\n` +
      `${A.dim}${"─".repeat(w)}${A.reset}\n\n`,
  );
}

// ─── Animated splash ─────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function animatedSplash(version: string) {
  const C = "\x1b[0m";
  const B = "\x1b[1;34m";
  const W = "\x1b[1;97m";
  const CB = "\x1b[1;36m";
  const G = "\x1b[1;32m";
  const D = "\x1b[0;34m";
  const Y = "\x1b[1;33m";
  const M = "\x1b[0;35m";
  const DIM = "\x1b[2m";

  const art = [
    `       ${D}▄${B}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${D}▄${C}`,
    `      ${B}█${CB}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}                                      ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}              ${W}██${C}          ${G}██${C}     ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}███${C}            ${W}███${C}         ${G}████${C}    ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}████${C}          ${W}████${C}        ${G}██████${C}   ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${G}▓${W}██${C}        ${W}██${G}▓${W}██${C}       ${G}████████${C}  ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C} ${G}▓${W}██${C}      ${W}██${C} ${G}▓${W}██${C}        ${G}████${C}    ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}  ${G}▓${W}██${C}    ${W}██${C}  ${G}▓${W}██${C}         ${G}██${C}     ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}   ${G}▓${W}██${C}  ${W}██${C}   ${G}▓${W}██${C}         ${G}██${C}     ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}    ${G}▓${W}████${C}    ${G}▓${W}██${C}                ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}     ${G}▓${W}██${C}     ${G}▓${W}██${C}         ${G}██${C}     ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}  ${W}██${C}      ${G}▓${C}      ${G}▓${W}██${C}         ${G}██${C}     ${CB}▓▓${B}█${C}`,
    `     ${B}█${CB}▓▓${C}                                      ${CB}▓▓${B}█${C}`,
    `      ${B}█${CB}▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓${B}█${C}`,
    `       ${D}▀${B}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${D}▀${C}`,
  ];

  const tagline = [
    `                    ${W}m${B}cli ${Y}${version}${C}`,
    `              ${M}the markdown command line${C}`,
  ];

  process.stdout.write("\n");

  // Phase 1: cascade the art lines (fast)
  for (let i = 0; i < art.length; i++) {
    process.stdout.write(art[i] + "\n");
    await sleep(20);
  }

  // Phase 2: brief pause, then tagline with a fade-in feel
  await sleep(80);
  process.stdout.write("\n");
  for (const line of tagline) {
    process.stdout.write(line + "\n");
    await sleep(60);
  }

  process.stdout.write("\n");
}

// ─── Main REPL loop ──────────────────────────────────────────────────────────

export async function startRepl(version: string) {
  const completions = buildCompletions();
  const s: State = {
    input: "",
    cursor: 0,
    selected: 0,
    history: [],
    historyPos: 0,
    savedInput: "",
  };

  await animatedSplash(version);
  showHeader();

  process.stdin.setRawMode(true);
  process.stdin.resume();
  render(s, completions);

  for await (const chunk of process.stdin) {
    const d = Buffer.from(chunk);

    // Ctrl+C / Ctrl+D — quit
    if (d[0] === 0x03 || (d[0] === 0x04 && s.input === "")) {
      process.stdout.write("\r" + A.clearDown + A.show + "\n");
      process.stdin.setRawMode(false);
      process.exit(0);
    }

    // Enter — execute command
    if (d[0] === 0x0d || d[0] === 0x0a) {
      const cmd = s.input.trim();
      // Clear suggestions, keep prompt text
      process.stdout.write("\r" + A.col(s.input.length + 3) + A.clearDown + "\n");

      if (cmd) {
        process.stdin.setRawMode(false);
        process.stdin.pause();

        Bun.spawnSync([...selfCmd, ...tokenize(cmd)], {
          cwd: process.cwd(),
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          env: { ...process.env, MD_REPL_CHILD: "1" },
        });

        // Separator
        const sep = "─".repeat(process.stdout.columns || 80);
        process.stdout.write(`\n${A.dim}${sep}${A.reset}\n\n`);

        // History (deduplicate consecutive)
        if (!s.history.length || s.history[s.history.length - 1] !== cmd)
          s.history.push(cmd);
        s.historyPos = s.history.length;

        process.stdin.setRawMode(true);
        process.stdin.resume();
      }

      s.input = "";
      s.cursor = 0;
      s.selected = 0;
      s.savedInput = "";
      render(s, completions);
      continue;
    }

    // Tab — autocomplete
    if (d[0] === 0x09) {
      const hits = match(completions, s.input);
      if (hits.length > 0) {
        const sel = hits[Math.min(s.selected, hits.length - 1)];
        s.input = sel.name + " ";
        s.cursor = s.input.length;
        s.selected = 0;
      }
    }

    // Backspace
    else if (d[0] === 0x7f || d[0] === 0x08) {
      if (s.cursor > 0) {
        s.input = s.input.slice(0, s.cursor - 1) + s.input.slice(s.cursor);
        s.cursor--;
        s.selected = 0;
      }
    }

    // Ctrl+U — clear line
    else if (d[0] === 0x15) {
      s.input = "";
      s.cursor = 0;
      s.selected = 0;
    }

    // Ctrl+W — delete word backwards
    else if (d[0] === 0x17) {
      const before = s.input.slice(0, s.cursor).replace(/\S+\s*$/, "");
      s.input = before + s.input.slice(s.cursor);
      s.cursor = before.length;
      s.selected = 0;
    }

    // Ctrl+A — beginning of line
    else if (d[0] === 0x01) s.cursor = 0;

    // Ctrl+E — end of line
    else if (d[0] === 0x05) s.cursor = s.input.length;

    // Ctrl+L — clear screen
    else if (d[0] === 0x0c) {
      process.stdout.write("\x1b[2J\x1b[H");
      showHeader();
    }

    // Escape sequences (arrows, home, end, delete)
    else if (d[0] === 0x1b && d[1] === 0x5b) {
      const hits = match(completions, s.input);
      switch (d[2]) {
        case 0x41: // ↑
          if (hits.length > 0) {
            if (s.selected > 0) s.selected--;
          } else if (s.historyPos > 0) {
            if (s.historyPos === s.history.length) s.savedInput = s.input;
            s.historyPos--;
            s.input = s.history[s.historyPos];
            s.cursor = s.input.length;
          }
          break;
        case 0x42: // ↓
          if (hits.length > 0) {
            const max = Math.min(hits.length, MAX_VISIBLE) - 1;
            if (s.selected < max) s.selected++;
          } else if (s.historyPos < s.history.length) {
            s.historyPos++;
            s.input =
              s.historyPos === s.history.length
                ? s.savedInput
                : s.history[s.historyPos];
            s.cursor = s.input.length;
          }
          break;
        case 0x43: // →
          if (s.cursor < s.input.length) s.cursor++;
          break;
        case 0x44: // ←
          if (s.cursor > 0) s.cursor--;
          break;
        case 0x48: // Home
          s.cursor = 0;
          break;
        case 0x46: // End
          s.cursor = s.input.length;
          break;
        case 0x33: // Delete
          if (d[3] === 0x7e && s.cursor < s.input.length) {
            s.input =
              s.input.slice(0, s.cursor) + s.input.slice(s.cursor + 1);
            s.selected = 0;
          }
          break;
      }
    }

    // Printable ASCII
    else if (d[0] >= 0x20 && d[0] < 0x7f) {
      const ch = String.fromCharCode(d[0]);
      s.input =
        s.input.slice(0, s.cursor) + ch + s.input.slice(s.cursor);
      s.cursor++;
      s.selected = 0;
    }

    // Multi-byte UTF-8
    else if (d[0] > 0x7f && d[0] !== 0x1b) {
      const ch = d.toString("utf8");
      s.input =
        s.input.slice(0, s.cursor) + ch + s.input.slice(s.cursor);
      s.cursor += [...ch].length;
      s.selected = 0;
    }

    render(s, completions);
  }
}
