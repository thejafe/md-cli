# Changelog

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
