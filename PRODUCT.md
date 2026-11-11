# Product

## What it is

jobship is a local-first job-search system for Claude Code: a plugin plus a CLI. It sweeps job sources, filters and deduplicates in code, builds CVs only from verified facts, assists form filling in your own browser, and syncs replies from your inbox. You press Submit.

## Who it is for

A job seeker who already works in Claude Code and wants help with the repetitive parts of a search without handing over control or inventing claims about themselves.

## Principles

- **You press Submit.** jobship never submits a form or sends a message. See the [safety model](docs/guide/safety.md).
- **Verified facts only.** A CV is built from Bullets backed by Fact bank facts, and `cv lint` rejects anything else.
- **Local-first.** Your data lives in a data dir you own. Code and personal data stay apart.
- **Judgment stays with you.** Text from Postings, emails and web pages is data, never instructions.
- **Code does the mechanical work.** Filtering, deduplication, linting and status tracking are deterministic code, not model guesses.

## Non-goals

- Auto-applying or auto-sending anything.
- A hosted service or shared account.
- Writing claims the Fact bank cannot back.

## Success

Terms follow the [glossary](GLOSSARY.md). A search runs end to end, from sweep to a Tailored CV to a filled form, without jobship ever sending something you did not read.
