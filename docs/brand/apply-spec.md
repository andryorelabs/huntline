# Applying the kit

Where each brand asset lands and what is still manual. Picks live in [README.md](README.md); the named lines live in [copy.md](copy.md). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## Asset to surface

| Asset                                | Surface                                                               | Status                                              |
| ------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------- |
| `og/cover.png`, `og/cover-light.png` | `README.md` top, a `<picture>` on `prefers-color-scheme`              | applied                                             |
| copy.md `brand line`, `plain line`   | `README.md` intro                                                     | applied                                             |
| copy.md `non-affiliation notice`     | `README.md` footer                                                    | applied                                             |
| copy.md `package description`        | `package.json` `description`                                          | applied                                             |
| `package.json` keywords and author   | `jobship` keyword, author `andryorelabs`                              | applied                                             |
| copy.md `plugin description`         | `.claude-plugin/plugin.json` `description`                            | applied                                             |
| copy.md `plugin description`         | `.claude-plugin/marketplace.json` plugin and `metadata` `description` | applied                                             |
| copy.md `CLI help line`              | usage text of `jobship --help` in `src/`                              | pending a follow-up (not in this ticket's surfaces) |
| copy.md `GitHub About`               | repository About field                                                | manual, see below                                   |
| `og/social-preview.png`              | repository social preview (Settings)                                  | manual, see below                                   |
| `logo/` favicon files                | favicon of the brandbook and any future site                          | brandbook only, nothing else consumes it yet        |

Tests in `src/e2e/docs.test.ts` and `tools/plugin.test.ts` read copy.md and fail naming the file when a surface drifts.

## When the brand changes

1. Edit the brand files and [copy.md](copy.md).
2. Run `bun run brand:export` to regenerate the rasters.
3. Update every surface in the table above, word for word from copy.md.
4. Run `bun run check` and `bun run test`.

## Manual steps

The coordinator fills the date after each step is done.

| Step              | What                                                                                   | Status  | Date                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| GitHub About      | Set the About description to the copy.md `GitHub About` line                           | done    | 2026-11-11                                                                            |
| Topics            | Set topics from the `package.json` keywords                                            | done    | 2026-11-11                                                                            |
| Homepage          | Set the homepage URL in repository Settings                                            | skipped | 2026-11-11, no site exists yet                                                        |
| Social preview    | Upload `docs/brand/og/social-preview.png` (1280x640) in repository Settings            | done    | 2026-11-11                                                                            |
| Repository rename | Rename `andryorelabs/huntline` to `andryorelabs/jobship`, then flip the old URLs below | pending |                                                                                       |
| CLI help line     | Use the copy.md `CLI help line` in the `src/` usage text (follow-up, changes `src/`)   | skipped | 2026-11-11, the usage text is part of the stdout JSON envelope, which must not change |

Files that still contain `andryorelabs/huntline` (from `git grep -n andryorelabs/huntline`):

- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/SECURITY.md`
- `README.md`
- `bin/jobship`
- `docs/adr/0005-rename-huntline-to-jobship.md`
- `docs/brand/naming-candidates.md` (a historical note; leave as written)
- `docs/guide/dogfooding.md`
- `docs/guide/install.md`
- `docs/reference/cli.md`
- `package.json`
- `schema/profile.schema.json`
- `src/core/doctor.test.ts`
- `src/core/doctor.ts`
- `src/e2e/docs.test.ts`
- `tools/shim.test.ts`
