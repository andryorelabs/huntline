# The brand kit lives in docs/brand

Status: Accepted
Date: 2026-11-11

Name, slogan, palette, typography, mark, cover and banner are recorded in `docs/brand/`, and its decisions table is the source of truth. Voice, tokens, logos, fonts, rasters and the brandbook are generated or written from that table and never change a pick.

## Context

The brand was picked by the maintainer in an interactive canvas. Without one place that records the picks, copy, tokens and assets drift apart, as the three differing pitches in the README, `package.json` and the plugin manifests already did.

## Decision

- `docs/brand/README.md` holds one dated row per pick. A change of pick is a new dated row, never an edit.
- Assets are derived from it: `tokens.css`, `logo/`, `og/`, `terminal/`, `brandbook/`.
- Rasters come only from one export command, never by hand.
- The kit loads nothing over the network and carries no personal data ([ADR-0003](0003-code-and-personal-data-live-apart.md)).

## Consequences

- A rebrand is a new row plus a re-run of the export, listed in `docs/brand/apply-spec.md`.
- Workers read picks from the table instead of from chat or from the canvas, which only its owner can open.
