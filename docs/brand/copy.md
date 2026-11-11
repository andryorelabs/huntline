# Copy

The lines later files reuse verbatim. Each named line sits under its own heading in its own fenced block. The slogan is the pick in the decisions table of [README.md](README.md); the tone is in [voice.md](voice.md) and the guard rails are in [brief.md](brief.md#core-message). Terms follow [GLOSSARY.md](../../GLOSSARY.md).

## brand line

```text
Search less. Decide better.
```

## plain line

```text
Even a small chance of moving forward takes many applications, and nobody can read every Posting by hand all day, so jobship does the analysis from your Profile and the data you give it, and you make the final decision.
```

## GitHub About

```text
Local-first job-search system for Claude Code: sweeps Sources, scores fit against your Profile, builds a Tailored CV from Fact bank facts and assists the form. You press Submit.
```

## package description

```text
Local-first job-search system for Claude Code: a plugin plus a CLI. You press Submit.
```

## plugin description

```text
A job-search plugin for Claude Code: sweeps Sources, scores fit against the Profile, builds a Tailored CV from Fact bank facts and assists the form, while the human presses every Submit and Send.
```

## CLI help line

```text
Local-first job search for Claude Code: sweep, score, tailor, assist the form. You press Submit.
```

## non-affiliation notice

```text
jobship is not affiliated with or endorsed by Anthropic.
```

## Where each line is used

| Line                   | Surface                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| brand line, plain line | README top, below the cover                                        |
| GitHub About           | Repository About field                                             |
| package description    | `package.json` `description`                                       |
| plugin description     | `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` |
| CLI help line          | Usage text of `jobship --help`                                     |
| non-affiliation notice | README footer, brandbook, any page that introduces the project     |

## Claims checked

Every claim above has a row here. Paths are relative to the repository root.

| Claim                                                                  | Line(s)                                    | Backed by                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| It is a plugin for Claude Code                                         | GitHub About, package, plugin, CLI help    | `.claude-plugin/plugin.json`, `skills/sweep/SKILL.md`                                    |
| It is a plugin plus a CLI                                              | package                                    | `.claude-plugin/plugin.json`, `src/cli.ts`, `bin/jobship`                                |
| It is local-first, data stays in a data dir the human owns             | GitHub About, package, CLI help            | `docs/adr/0003-code-and-personal-data-live-apart.md`, `docs/guide/data-dir.md`           |
| It sweeps Sources                                                      | GitHub About, plugin, CLI help             | `src/sweep/sweep.ts`, `docs/reference/cli.md`                                            |
| It scores fit against the Profile                                      | plain line, GitHub About, plugin, CLI help | `skills/score/SKILL.md`, `docs/reference/cli.md`                                         |
| It builds a Tailored CV from Fact bank facts only                      | GitHub About, plugin, CLI help             | `src/cv/build.ts`, `src/cv/lint.ts`, `docs/guide/cv.md`                                  |
| It assists the form                                                    | GitHub About, plugin, CLI help             | `skills/apply/SKILL.md`, `src/apply/command.ts`                                          |
| The analysis uses the Profile and data the human gives it              | plain line                                 | `docs/reference/profile.md`, `docs/guide/data-dir.md`                                    |
| The human makes the final decision                                     | brand line, plain line                     | `PRODUCT.md`, `docs/brand/brief.md`                                                      |
| Applying to many Postings is needed and cannot be done by hand all day | plain line                                 | `docs/brand/brief.md`                                                                    |
| You press Submit; no code path submits or sends                        | GitHub About, package, plugin, CLI help    | `docs/adr/0002-the-guard-fails-closed.md`, `src/guard/decide.ts`, `docs/guide/safety.md` |
| The human presses every Send                                           | plugin                                     | `docs/guide/safety.md`, `skills/outreach/SKILL.md`                                       |
| The slogan is the maintainer's pick                                    | brand line                                 | `docs/brand/README.md`                                                                   |
| jobship runs on Claude Code and is not affiliated with Anthropic       | non-affiliation notice                     | `docs/brand/brief.md`, `docs/brand/voice.md`                                             |

No line promises an outcome, gives a number or says the tool applies, submits or sends.
