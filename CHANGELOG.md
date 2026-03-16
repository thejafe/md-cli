# Changelog

## 2026-03-16 (0.3.0)

### Added
- `md note append <note>` and `md note prepend <note>` — dedicated subcommands for adding content to the end or beginning of a note. Both accept `--content` or piped stdin. The optional `--heading` flag targets a specific markdown section: `append` inserts at the end of that section (before the next heading), `prepend` inserts right after the heading line. Global prepend always lands after any YAML frontmatter.

### Removed
- `md note edit --append` and `md note edit --prepend` flags are removed in favour of the new dedicated subcommands above. `edit` now only handles full content replacement (`--content` or stdin).

### Fixed
- The ASCII splash screen no longer prints to stdout on every command invocation, which previously corrupted piped and redirected output (e.g. `md note list > file.txt`). The splash now appears only inside the interactive REPL.
- Unknown or misspelled flags (e.g. `--contnet` instead of `--content`) are now rejected with a clear error instead of being silently ignored.
- Note paths containing `..` segments are now blocked from escaping the vault boundary; any attempt to read or write outside the vault root raises an error immediately.
- User-supplied regular expressions passed to `md note search --regex` are now validated before use; invalid patterns produce a readable error instead of a raw exception.
- The vault registry (`vaults.json`) is now written atomically via a temp-file-then-rename pattern, preventing data loss if the process is interrupted mid-write. A warning is also printed if the file is found to be corrupt on load.
- Vault registry reads are now memoized within a single command invocation, eliminating redundant disk I/O that previously parsed `vaults.json` two or three times per command.
- The CLI version is now resolved from a compile-time import instead of a runtime `Bun.file("./package.json")` call, fixing a startup failure when `md` was invoked from a directory other than the project root.
- Frontmatter values containing YAML special characters (e.g. colons, brackets, hash signs) are now correctly quoted during serialization, preventing round-trip corruption.
- `isHidden` path check rewritten to a single-pass split, eliminating quadratic traversal on deeply nested paths.
- Escape sequences (`\"`, `\'`, `\\`) inside quoted arguments in the REPL are now handled correctly by the tokenizer.
- Line-number validation in `md task` now explicitly rejects zero and negative values with a clear message.
- Removed redundant non-null assertions after `die()` calls, and removed unnecessary `async` from `vaultCmd`.

## 2026-03-15

### Added
- Interactive REPL mode (`md shell`) with tab-completion, persistent command history, and per-command inline descriptions — run multiple vault commands in a single session without re-invoking the CLI each time.
- `tasks` command to list and filter checkbox tasks across the whole vault; `task` command to view and toggle an individual task's state by file and line number.

### Changed
- Vault resolution now auto-detects when the working directory is inside a registered vault, and falls back automatically when only one vault exists — removing the need to pass `--vault` on most commands.
- Adopted [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format — entries are now grouped by `Added`, `Changed`, `Fixed`, and `Removed` under ISO-8601 date headings.

## 2026-03-14

- feat(cli): embed ASCII splash screen in CLI
- perf(adapter): concurrent file I/O with 64-worker pool
- build(version): read version from package.json, add bump scripts

## 2026-03-13

- refactor(cli): extract command metadata to lib/commands.ts
- feat(docs): auto-generate docs from command metadata
- docs(readme): README with auto-generated command reference
- refactor(cli): wire cli to use commands.ts for option parsing

## 2026-03-12

- feat(cli): search, tags, backlinks, links, tree, daily commands

## 2026-03-11

- feat(note): note CRUD — list, read, create, edit, delete, rename

## 2026-03-10

- feat(cli): CLI entry point with vault init/list/status/unlink
- feat(vault): add vault config command

## 2026-03-09

- feat(config): vault registry with XDG support
- feat(adapter): filesystem adapter with Bun.file I/O

## 2026-03-08

- init(project): scaffold bun + typescript project
- feat(utils): add path normalization and file type utilities
- feat(utils): frontmatter parser, tag/link extraction, serializer
