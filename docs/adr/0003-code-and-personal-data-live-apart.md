# Code and personal data live apart

Status: Accepted
Date: 2026-11-09

The tool reads a user data directory (Profile, Fact bank, Answer bank, Event log) and ships no personal data.

## Context

A job search tool holds a CV, answers and an application history. Keeping that next to the code would make the repository unpublishable and tie the data's history to the code's.

## Decision

- The repository ships code, schemas, templates and synthetic fixtures only.
- Real Profile, Fact bank, Answer bank and Event log data live in a user data directory that the tool reads.
- Tests use synthetic fixtures, never real data.

## Consequences

- The repository stays publishable.
- The data can live in a private place with its own history.
