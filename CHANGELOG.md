# Changelog

## 2026-03-14

- feat(cli): embed ASCII splash screen in CLI
- perf(adapter): concurrent file I/O with 64-worker pool

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
