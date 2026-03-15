// Single source of truth for all CLI commands, options, and docs.

export interface OptionDef {
  type: "string" | "boolean";
  short?: string;
  description: string;
  placeholder?: string;
  choices?: string[];
  default?: string;
}

export interface CommandDef {
  name: string;
  description: string;
  positionals?: { name: string; required: boolean; description: string }[];
  options?: Record<string, OptionDef>;
  examples?: string[];
  stdin?: string; // description of what stdin is used for, if applicable
}

export interface CommandGroup {
  name: string;
  label: string;
  description: string;
  commands: CommandDef[];
}

// ─── Shared option fragments ─────────────────────────────────────────────────

const pathOpt: OptionDef = {
  type: "string",
  short: "p",
  description: "Path to the notes directory.",
  placeholder: "path",
  default: "current directory",
};

// ─── Command definitions ─────────────────────────────────────────────────────

export const groups: CommandGroup[] = [
  {
    name: "vault",
    label: "Vault Management",
    description: "Register, configure, and inspect note directories.",
    commands: [
      {
        name: "init",
        description: "Register a notes directory and create its config.",
        options: {
          path: pathOpt,
          name: {
            type: "string",
            short: "n",
            description: "Display name.",
            placeholder: "name",
          },
          "config-dir": {
            type: "string",
            description: "Config directory name inside the notes directory.",
            placeholder: "dir",
            default: ".obsidian",
          },
        },
        examples: [
          "md vault init --path ~/notes --name 'My Vault'",
          "md vault init",
        ],
      },
      {
        name: "list",
        description: "List all registered vaults.",
        examples: ["md vault list"],
      },
      {
        name: "status",
        description:
          "Show statistics: note count, total size, last modified time.",
        options: { path: pathOpt },
        examples: ["md vault status", "md vault status --path ~/notes"],
      },
      {
        name: "config",
        description:
          "View or update configuration. Run without flags to view current settings.",
        options: {
          path: pathOpt,
          name: {
            type: "string",
            short: "n",
            description: "Set the display name.",
            placeholder: "name",
          },
          "daily-folder": {
            type: "string",
            description: "Folder for daily notes.",
            placeholder: "folder",
          },
          "attachment-folder": {
            type: "string",
            description: "Folder for attachments.",
            placeholder: "folder",
          },
          "trash-option": {
            type: "string",
            description: "How deleted notes are handled.",
            placeholder: "mode",
            choices: ["local", "system", "permanent"],
          },
          "config-dir": {
            type: "string",
            description: "Config directory name.",
            placeholder: "dir",
          },
        },
        examples: [
          "md vault config --daily-folder journal",
          "md vault config --trash-option permanent",
        ],
      },
      {
        name: "unlink",
        description:
          "Deregister a notes directory from md-cli. Does not delete any files.",
        options: { path: pathOpt },
        examples: ["md vault unlink --path ~/notes"],
      },
    ],
  },
  {
    name: "note",
    label: "Note Operations",
    description: "Create, read, edit, delete, rename, and search notes.",
    commands: [
      {
        name: "list",
        description:
          "List all markdown notes, optionally scoped to a folder.",
        options: {
          path: pathOpt,
          folder: {
            type: "string",
            short: "f",
            description: "Only list notes inside this folder.",
            placeholder: "folder",
          },
          long: {
            type: "boolean",
            short: "l",
            description: "Show modification time and file size for each note.",
          },
        },
        examples: [
          "md note list",
          "md note list --folder projects -l",
        ],
      },
      {
        name: "read",
        description:
          "Print the contents of a note to stdout.",
        positionals: [
          { name: "note", required: true, description: "Note name or path (`.md` extension optional)." },
        ],
        options: {
          path: pathOpt,
          frontmatter: {
            type: "boolean",
            description: "Output only the YAML frontmatter as JSON.",
          },
          body: {
            type: "boolean",
            description: "Output only the body (after frontmatter).",
          },
        },
        examples: [
          "md note read 'hello world'",
          "md note read project/todo --frontmatter",
          "md note read project/todo --body | wc -w",
        ],
      },
      {
        name: "create",
        description:
          "Create a new markdown note. Content can be passed via `--content`, piped from stdin, or left empty.",
        positionals: [
          { name: "note", required: true, description: "Note name or path." },
        ],
        options: {
          path: pathOpt,
          content: {
            type: "string",
            short: "c",
            description: "Note body text. Use `\\n` for newlines.",
            placeholder: "text",
          },
          tags: {
            type: "string",
            short: "t",
            description: "Comma-separated tags to add to frontmatter.",
            placeholder: "tags",
          },
          force: {
            type: "boolean",
            short: "f",
            description: "Overwrite if the note already exists.",
          },
        },
        stdin: "Note body content.",
        examples: [
          "md note create 'new idea' --content 'Hello world'",
          "md note create meeting --tags 'work,meeting'",
          "echo '# Draft' | md note create draft",
        ],
      },
      {
        name: "edit",
        description:
          "Modify an existing note. Provide new content with `--content`, or append/prepend text. Falls back to stdin.",
        positionals: [
          { name: "note", required: true, description: "Note name or path." },
        ],
        options: {
          path: pathOpt,
          content: {
            type: "string",
            short: "c",
            description: "Replace entire note body.",
            placeholder: "text",
          },
          append: {
            type: "string",
            short: "a",
            description: "Append text to the end of the note.",
            placeholder: "text",
          },
          prepend: {
            type: "string",
            description: "Prepend text to the body (after frontmatter).",
            placeholder: "text",
          },
        },
        stdin: "Replacement note body.",
        examples: [
          "md note edit todo --append '- Buy milk'",
          "md note edit readme --content 'New content'",
        ],
      },
      {
        name: "delete",
        description:
          "Delete a note. By default moves to `.trash/` (local trash). Use `--permanent` to delete immediately.",
        positionals: [
          { name: "note", required: true, description: "Note name or path." },
        ],
        options: {
          path: pathOpt,
          permanent: {
            type: "boolean",
            description: "Delete permanently instead of moving to trash.",
          },
        },
        examples: [
          "md note delete 'old note'",
          "md note delete scratch --permanent",
        ],
      },
      {
        name: "rename",
        description: "Rename or move a note.",
        positionals: [
          { name: "note", required: true, description: "Current note name or path." },
          { name: "new-name", required: true, description: "New note name or path." },
        ],
        options: { path: pathOpt },
        examples: ["md note rename draft 'final version'"],
      },
      {
        name: "search",
        description:
          "Full-text search across all notes. Matches are shown with file path, line number, and matching text.",
        positionals: [
          { name: "query", required: true, description: "Search term or pattern." },
        ],
        options: {
          path: pathOpt,
          folder: {
            type: "string",
            short: "f",
            description: "Restrict search to a folder.",
            placeholder: "folder",
          },
          regex: {
            type: "boolean",
            short: "r",
            description: "Treat query as a regular expression.",
          },
          count: {
            type: "boolean",
            description: "Show match counts per file instead of match lines.",
          },
        },
        examples: [
          "md note search 'TODO'",
          "md note search '\\d{4}-\\d{2}-\\d{2}' --regex",
          "md note search meeting --folder work --count",
        ],
      },
    ],
  },
];

export const standaloneCommands: CommandDef[] = [
  {
    name: "tags",
    description:
      "List all tags (frontmatter `tags` field + inline `#tag` syntax). Sorted alphabetically.",
    options: {
      path: pathOpt,
      count: {
        type: "boolean",
        short: "c",
        description: "Show usage count next to each tag.",
      },
    },
    examples: ["md tags", "md tags --count"],
  },
  {
    name: "daily",
    description:
      "Open or create today's daily note. If the note exists, its content is printed to stdout. Otherwise a new note is created with a date header.",
    options: {
      path: pathOpt,
      folder: {
        type: "string",
        short: "f",
        description: "Folder for daily notes (overrides configured default).",
        placeholder: "folder",
      },
      date: {
        type: "string",
        short: "d",
        description: "Target date in YYYY-MM-DD format.",
        placeholder: "YYYY-MM-DD",
        default: "today",
      },
    },
    examples: [
      "md daily",
      "md daily --date 2025-12-25",
      "md daily --folder journal",
    ],
  },
  {
    name: "backlinks",
    description:
      "Find all notes that link to a given note via `[[wikilinks]]`.",
    positionals: [
      { name: "note", required: true, description: "Note to find backlinks for." },
    ],
    options: { path: pathOpt },
    examples: ["md backlinks 'project plan'"],
  },
  {
    name: "links",
    description:
      "List all outgoing `[[wikilinks]]` in a note, with a marker for missing targets.",
    positionals: [
      { name: "note", required: true, description: "Note to extract links from." },
    ],
    options: { path: pathOpt },
    examples: ["md links 'project plan'"],
  },
  {
    name: "tree",
    description: "Print a visual directory tree, excluding hidden files and config directories.",
    options: {
      path: pathOpt,
      depth: {
        type: "string",
        short: "d",
        description: "Maximum directory depth to display.",
        placeholder: "n",
        default: "unlimited",
      },
    },
    examples: ["md tree", "md tree --depth 2"],
  },
  {
    name: "tasks",
    description:
      "List tasks in the vault. Use positional keywords to filter: file=<name>, path=<path>, status=\"<char>\", todo, done, total, verbose, daily, format=json|tsv|csv.",
    options: { path: pathOpt },
    examples: [
      "md tasks",
      "md tasks todo",
      "md tasks done",
      "md tasks file=Recipe done",
      "md tasks daily",
      "md tasks daily total",
      "md tasks verbose",
      "md tasks 'status=?'",
      "md tasks format=json",
    ],
  },
  {
    name: "task",
    description:
      "Show or update a single task. Identify by ref=<path:line> or file=<name> line=<n>. Actions: toggle, done, todo, status=\"<char>\". Use daily to target today's daily note.",
    options: { path: pathOpt },
    examples: [
      "md task file=Recipe line=8",
      "md task ref=\"Recipe.md:8\"",
      "md task ref=\"Recipe.md:8\" toggle",
      "md task daily line=3 toggle",
      "md task file=Recipe line=8 done",
      "md task file=Recipe line=8 status=-",
    ],
  },
];

// ─── Helpers for cli.ts ──────────────────────────────────────────────────────

/** Build the options object that `util.parseArgs` expects from a CommandDef. */
export function parseArgsOptions(cmd: CommandDef) {
  const result: Record<string, { type: "string" | "boolean"; short?: string }> = {};
  if (!cmd.options) return result;
  for (const [key, opt] of Object.entries(cmd.options)) {
    result[key] = { type: opt.type };
    if (opt.short) result[key].short = opt.short;
  }
  return result;
}

/** Find a command definition by group name and subcommand name, or standalone name. */
export function findCommand(name: string, sub?: string): CommandDef | undefined {
  if (sub) {
    const group = groups.find((g) => g.name === name);
    return group?.commands.find((c) => c.name === sub);
  }
  return standaloneCommands.find((c) => c.name === name);
}
