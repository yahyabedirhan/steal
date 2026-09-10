# Steal

A Chrome MV3 extension. Point at an element on a page and copy it to the
clipboard as full HTML, clean HTML, plain text, or Markdown. TypeScript under
`src/`, built by Vite into `dist/`, tested with Vitest on jsdom.

`README.md` is the user-facing reference and is kept accurate. Read it before
changing behavior, and update it in the same commit when behavior changes.

## Layout

- `src/entries/` — the two build entry points, `content.ts` and `background.ts`.
- `src/lib/` — the actual logic: `inspector.ts` (hover, highlight, label),
  `dom-navigator.ts` (arrow-key traversal), `robber.ts` (the copy itself),
  `modes/` (one module per copy mode), `scroll/`, `utils/`.
- `test/` — Vitest suites mirroring `src/lib/`.
- `docs/steal-v01.md` — the full low-level design reference.
- `CHANGELOG.md` — version history. Pre-release versioning, `0.0.x`.
- `.specs/` — numbered specs, one per feature increment
  (`NN-<kebab-topic>.md`). Written before the work, kept as the record of what
  was intended.
- `.handoff/` — session handoff documents, `YYYY-MM-DD-<kebab-topic>.md`.
  The `handoff` skill writes here, not to a temp directory. Keep them
  committed.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Build `dist/` (content script pass, then service worker pass). |
| `npm run dev` | The same build in watch mode. |
| `npm run typecheck` | `tsc --noEmit`, strict. |
| `npm test` | Vitest, jsdom. |
| `npm run gen-icons` | Regenerate the crosshair icons (standard library Python only). |

Run `npm run typecheck` and `npm test` before calling a change done. Loading
the extension is manual: `npm run build`, then reload the card at
`chrome://extensions` and reload the target page. The content script is
injected fresh per activation and does not hot-update an open page.

## Invariants

These have each been the subject of a bug fix. Do not regress them.

- The copy is page content only. Steal's own highlight box, label, and toast are
  never in the output, and any temporary change Steal made to the page is undone
  before the copy is taken, including when copying `<body>` or `<html>`.
- Steal writes to the clipboard and sends nothing anywhere. No network calls, no
  analytics, no storage beyond the remembered copy mode.
- Inspect mode is per-tab, and leaving it (Esc, the shortcut, the toolbar icon,
  or a completed copy) tears the overlay down immediately.
- Traversal skips `head`, `script`, `style` and other non-visible tags.

## Writing style

Applies to code comments, docs, specs, changelog entries, and commit messages.

- Do not fabricate. When something is unknown, mark it unknown or ask.
- Mark unfinished work with an explicit `TODO:` so a later session can resume.
- Do not overuse the em dash (—). Default to restructuring the sentence: split
  it in two, use a subordinate clause, reorder, or use a comma. Reach for one
  only when a sentence genuinely calls for that exact break.
- Avoid a colon introducing a list of items inside a prose sentence. Prefer a
  smoother clause or a separate sentence. Structural Markdown and metadata
  fields may still use colons.
- Match the comment density and idiom of the surrounding code.

## Git

Do not run `git add`, `git commit`, or `git stash` unless asked for that
action. Do not report uncommitted changes unless asked, or unless git status
affects the task at hand.

Commit messages are lowercase and multi-line:

```text
commit message

- explanation 1
- explanation 2
```

## Agent skills

Skills live in `.agents/skills/`, symlinked into `.claude/skills/`. All of them
are imported from upstream and tracked in `skills-lock.json`. **Do not modify
their content.** Update them only from upstream. To add one:

```bash
ln -s ../../.agents/skills/<skill-name> .claude/skills/<skill-name>
```

Stage the symlink itself, not the file inside it.

`to-tickets`, `triage`, and `to-spec` expect a per-repo issue tracker config
under `docs/agents/`. That config does not exist yet. Run
`setup-matt-pocock-skills` once before first using those three.

TODO: run `setup-matt-pocock-skills` to choose an issue tracker (GitHub Issues
on `yahyabedirhan/steal`, or local markdown) and write `docs/agents/`.
