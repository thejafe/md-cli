<!-- AUTO GENERATED — run 'bun run gen' to update -->

# md-cli Reference (v0.3.0)

All commands accept `--path <path>` (`-p`) to specify the vault directory. Defaults to the current working directory.

## Table of Contents

- **[Vault Management](#vault-management)** — Register, configure, and inspect note directories.
  - [`vault init`](#vault-init)
  - [`vault list`](#vault-list)
  - [`vault status`](#vault-status)
  - [`vault config`](#vault-config)
  - [`vault unlink`](#vault-unlink)
- **[Note Operations](#note-operations)** — Create, read, edit, delete, rename, and search notes.
  - [`note list`](#note-list)
  - [`note read`](#note-read)
  - [`note create`](#note-create)
  - [`note edit`](#note-edit)
  - [`note delete`](#note-delete)
  - [`note rename`](#note-rename)
  - [`note append`](#note-append)
  - [`note prepend`](#note-prepend)
  - [`note search`](#note-search)
- **[Tools](#tools)**
  - [`tags`](#tags)
  - [`daily`](#daily)
  - [`backlinks`](#backlinks)
  - [`links`](#links)
  - [`tree`](#tree)
  - [`tasks`](#tasks)
  - [`task`](#task)

## Vault Management

Register, configure, and inspect note directories.

### `vault init`

Register a notes directory and create its config.

```
md vault init [-n, --name <name>] [--config-dir <dir>]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-n`, `--name` | Display name. | — |
| `--config-dir` | Config directory name inside the notes directory. | .obsidian |

**Examples:**

```sh
md vault init --path ~/notes --name 'My Vault'
md vault init
```

---

### `vault list`

List all registered vaults.

```
md vault list
```

**Examples:**

```sh
md vault list
```

---

### `vault status`

Show statistics: note count, total size, last modified time.

```
md vault status
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md vault status
md vault status --path ~/notes
```

---

### `vault config`

View or update configuration. Run without flags to view current settings.

```
md vault config [-n, --name <name>] [--daily-folder <folder>] [--attachment-folder <folder>] [--trash-option <mode>] [--config-dir <dir>]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-n`, `--name` | Set the display name. | — |
| `--daily-folder` | Folder for daily notes. | — |
| `--attachment-folder` | Folder for attachments. | — |
| `--trash-option` | How deleted notes are handled. Choices: `local`, `system`, `permanent`. | — |
| `--config-dir` | Config directory name. | — |

**Examples:**

```sh
md vault config --daily-folder journal
md vault config --trash-option permanent
```

---

### `vault unlink`

Deregister a notes directory from md-cli. Does not delete any files.

```
md vault unlink
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md vault unlink --path ~/notes
```

---

## Note Operations

Create, read, edit, delete, rename, and search notes.

### `note list`

List all markdown notes, optionally scoped to a folder.

```
md note list [-f, --folder <folder>] [-l, --long]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-f`, `--folder` | Only list notes inside this folder. | — |
| `-l`, `--long` | Show modification time and file size for each note. | `false` |

**Examples:**

```sh
md note list
md note list --folder projects -l
```

---

### `note read`

Print the contents of a note to stdout.

```
md note read <note> [--frontmatter] [--body]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path (`.md` extension optional). | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `--frontmatter` | Output only the YAML frontmatter as JSON. | `false` |
| `--body` | Output only the body (after frontmatter). | `false` |

**Examples:**

```sh
md note read 'hello world'
md note read project/todo --frontmatter
md note read project/todo --body | wc -w
```

---

### `note create`

Create a new markdown note. Content can be passed via `--content`, piped from stdin, or left empty.

```
md note create <note> [-c, --content <text>] [-t, --tags <tags>] [-f, --force]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-c`, `--content` | Note body text. Use `\n` for newlines. | — |
| `-t`, `--tags` | Comma-separated tags to add to frontmatter. | — |
| `-f`, `--force` | Overwrite if the note already exists. | `false` |

**Stdin:** Note body content.

**Examples:**

```sh
md note create 'new idea' --content 'Hello world'
md note create meeting --tags 'work,meeting'
echo '# Draft' | md note create draft
```

---

### `note edit`

Replace an existing note's content with `--content` or piped stdin.

```
md note edit <note> [-c, --content <text>]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-c`, `--content` | Replace entire note body. | — |

**Stdin:** Replacement note body.

**Examples:**

```sh
md note edit readme --content 'New content'
echo '# Rewritten' | md note edit readme
```

---

### `note delete`

Delete a note. By default moves to `.trash/` (local trash). Use `--permanent` to delete immediately.

```
md note delete <note> [--permanent]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `--permanent` | Delete permanently instead of moving to trash. | `false` |

**Examples:**

```sh
md note delete 'old note'
md note delete scratch --permanent
```

---

### `note rename`

Rename or move a note.

```
md note rename <note> <new-name>
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Current note name or path. | **required** |
| `new-name` | New note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md note rename draft 'final version'
```

---

### `note append`

Append text to a note. With `--heading`, inserts at the end of that section (before the next heading).

```
md note append <note> [-c, --content <text>] [-H, --heading <heading>]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-c`, `--content` | Text to append. Use `\n` for newlines. | — |
| `-H`, `--heading` | Target heading — appends at the end of that section. | — |

**Stdin:** Text to append.

**Examples:**

```sh
md note append todo --content '- Buy milk'
md note append todo --heading '## Shopping' --content '- eggs'
echo '- item' | md note append todo --heading 'Tasks'
```

---

### `note prepend`

Prepend text to a note (after frontmatter). With `--heading`, inserts right after that heading line.

```
md note prepend <note> [-c, --content <text>] [-H, --heading <heading>]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note name or path. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-c`, `--content` | Text to prepend. Use `\n` for newlines. | — |
| `-H`, `--heading` | Target heading — prepends at the top of that section. | — |

**Stdin:** Text to prepend.

**Examples:**

```sh
md note prepend readme --content '> Warning: deprecated'
md note prepend notes --heading '## Ideas' --content '- spark'
echo '> pinned' | md note prepend journal
```

---

### `note search`

Full-text search across all notes. Matches are shown with file path, line number, and matching text.

```
md note search <query> [-f, --folder <folder>] [-r, --regex] [--count]
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `query` | Search term or pattern. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-f`, `--folder` | Restrict search to a folder. | — |
| `-r`, `--regex` | Treat query as a regular expression. | `false` |
| `--count` | Show match counts per file instead of match lines. | `false` |

**Examples:**

```sh
md note search 'TODO'
md note search '\d{4}-\d{2}-\d{2}' --regex
md note search meeting --folder work --count
```

---

## Tools

### `tags`

List all tags (frontmatter `tags` field + inline `#tag` syntax). Sorted alphabetically.

```
md tags [-c, --count]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-c`, `--count` | Show usage count next to each tag. | `false` |

**Examples:**

```sh
md tags
md tags --count
```

---

### `daily`

Open or create today's daily note. If the note exists, its content is printed to stdout. Otherwise a new note is created with a date header.

```
md daily [-f, --folder <folder>] [-d, --date <YYYY-MM-DD>]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-f`, `--folder` | Folder for daily notes (overrides configured default). | — |
| `-d`, `--date` | Target date in YYYY-MM-DD format. | today |

**Examples:**

```sh
md daily
md daily --date 2025-12-25
md daily --folder journal
```

---

### `backlinks`

Find all notes that link to a given note via `[[wikilinks]]`.

```
md backlinks <note>
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note to find backlinks for. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md backlinks 'project plan'
```

---

### `links`

List all outgoing `[[wikilinks]]` in a note, with a marker for missing targets.

```
md links <note>
```

**Arguments:**

| Argument | Description | |
|---|---|---|
| `note` | Note to extract links from. | **required** |

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md links 'project plan'
```

---

### `tree`

Print a visual directory tree, excluding hidden files and config directories.

```
md tree [-d, --depth <n>]
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |
| `-d`, `--depth` | Maximum directory depth to display. | unlimited |

**Examples:**

```sh
md tree
md tree --depth 2
```

---

### `tasks`

List tasks in the vault. Use positional keywords to filter: file=<name>, path=<path>, status="<char>", todo, done, total, verbose, daily, format=json|tsv|csv.

```
md tasks
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md tasks
md tasks todo
md tasks done
md tasks file=Recipe done
md tasks daily
md tasks daily total
md tasks verbose
md tasks 'status=?'
md tasks format=json
```

---

### `task`

Show or update a single task. Identify by ref=<path:line> or file=<name> line=<n>. Actions: toggle, done, todo, status="<char>". Use daily to target today's daily note.

```
md task
```

**Options:**

| Flag | Description | Default |
|---|---|---|
| `-p`, `--path` | Path to the notes directory. | current directory |

**Examples:**

```sh
md task file=Recipe line=8
md task ref="Recipe.md:8"
md task ref="Recipe.md:8" toggle
md task daily line=3 toggle
md task file=Recipe line=8 done
md task file=Recipe line=8 status=-
```

---

