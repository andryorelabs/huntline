# Brand brief

What jobship is, who it is for and how it presents itself. Terms follow [GLOSSARY.md](../../GLOSSARY.md). The decisions table in `docs/brand/README.md` is the source of truth for name, slogan, palette, typography, mark and cover style; this brief does not set or change any of them. The field is mapped in [competitors.md](competitors.md).

## Category

A local-first job-search system for Claude Code: a plugin plus a CLI. It sweeps job sources, filters and deduplicates in code, builds CVs only from verified facts, assists form filling in the human's own browser, and syncs replies from their inbox ([PRODUCT.md](../../PRODUCT.md)).

## Position

**You press Submit.** Most neighbouring tools compete on how much they do for you, and some on how much they apply for you. jobship takes the other side of that line: code does the mechanical work, every claim traces to a Fact bank fact, and no code path submits a form or sends a message ([ADR-0002](../adr/0002-the-guard-fails-closed.md)). The brand claims no more than the tool ships today.

## Audience

- **Primary:** a job seeker who already works in Claude Code and wants help with the repetitive parts of a search without handing over control.
- **Secondary:** people who keep their own records and want a search they can audit.
- **Not for:** anyone who wants applications sent for them, a hosted service or a shared account, or people without a terminal.

## Pains

- Repetitive work across Sources, forms and inboxes.
- CVs that drift from what is true.
- Fear of a tool that sends something unread.
- Scattered state with no trail of what happened.

## Core message

- **The problem:** a search needs many applications for even a small chance of moving forward, and reading every Posting by hand all day is not possible.
- **The job the tool does:** it sweeps Sources, scores fit against the Profile, builds a Tailored CV from Fact bank facts and assists the form, so the analysis is done for the human.
- **The human's part:** the final decision, and pressing Submit. The time saved goes to deciding, not sifting.
- **Guard rails:** copy may say the tool does the sifting, scoring and tailoring. It never says the tool applies, submits or sends, and it promises no outcome such as interviews or offers, and gives no number the CLI does not back.

## Promise (internal)

The promise stays internal and never appears in public copy: **I can hand off the repetitive parts and still stand behind every word I send.**

Public claims are limited to what the CLI backs today: you press Submit, a CV is built from Fact bank facts and linted, data stays in a data dir you own, and the event log is the source of truth ([ADR-0001](../adr/0001-event-log-is-the-source-of-truth.md)).

## Personality

Precise, calm, trustworthy. The human stays in control. The voice is plain and exact, with no hype and no exclamation marks. The governing metaphor is a line: a trail, a timeline, the event log, an ordered record of what happened that anyone can read back.

## Relation to Anthropic and Claude Code

jobship runs on Claude Code and copy may say so descriptively, for example "plugin for Claude Code". It always carries the notice "Not affiliated with or endorsed by Anthropic". The name, mark, palette and any mascot stay fully separate from Claude's identity.

## Visual world

- A cool palette with a single cobalt accent, chosen in the decisions table of `docs/brand/README.md`. Solid, soft-cornered shapes in that one accent, like the sibling marks.
- Terminal first: the palette must work in 16 ANSI colours, and then in the README.
- The mark stays legible at 16 px and can be read as a line or trail.
- Light and dark both work. Nothing depends on remote fonts or images.

## What to avoid

- **Words:** "AI magic", "auto-apply", "autonomous", "supercharge", "land your dream job", "while you sleep", and any hunting or weapon language.
- **Imagery:** hunting and weapon imagery such as crosshairs, targets, arrows and traps.
- **Colour:** Claude orange or clay, sparks and starbursts, LinkedIn blue, and purple.
- **Claims:** speed, hit-rate or outcome claims, and anything the Fact bank or the code cannot back.
- **Tone:** pressure, urgency or fear about the job market.

## Closed decisions

- You press Submit: no code path submits a form or sends a message.
- The decisions table in `docs/brand/README.md` is the source of truth for name, slogan, palette, typography, mark and cover style.
- The palette works in 16 ANSI colours.
- Docs and copy are in English.
- No personal data in the kit; fixtures are synthetic ([ADR-0003](../adr/0003-code-and-personal-data-live-apart.md)).
- The non-affiliation notice is used verbatim.

## Out of scope

A landing page, merch, video art, a mascot beyond what the decisions table picks, and any change to CLI behaviour or its stdout JSON envelope.
