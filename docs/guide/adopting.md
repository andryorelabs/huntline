# Adopting jobship with your own data

1. **Create the data dir** outside this repository: `mkdir ~/job-search && cd ~/job-search`. Consider keeping it in a private git repository.
2. **Run `/jobship:init`.** It runs `jobship init` and then Onboarding: it reads your CV, GitHub and LinkedIn if you offer them, interviews you for the gaps, writes the Dossier, and derives the Fact bank, Bullets, Profile and Never-claim list as an Approval batch you approve. See [Onboarding](onboarding.md). You do not edit template files by hand.
3. **Already have a data dir from before the Dossier?** Run `jobship init --missing`. It writes only the absent files and appends `dossier/identity.md` to an existing `.gitignore`; then run `/jobship:init` to fill the Dossier.
4. **Review the derived files** (`facts.yaml`, `bullets.yaml`, `profile.yaml`, `never-claim.yaml`, `answers.json`). Editing them by hand still works, but the next derive proposes the difference against the Dossier. See the [Profile reference](../reference/profile.md).
5. **Add a Typst template** at `cv/template.typ`; `examples/cv/` in this repository has a synthetic starting point.
6. **Run `jobship doctor`** until it exits 0. It names every Dossier section that is not `complete`.
7. **Check the first CV**: `jobship cv build` and `jobship cv lint` per target role.
8. **Add companies** (required for ATS Sources such as `greenhouse`, `lever` and `ashby`): `jobship company add https://jobs.ashbyhq.com/acme` stores `{ats: "ashby", slug: "acme"}`.
9. **Sweep**: `jobship sweep`, or feed browser Sources and JobSpy output through `jobship ingest`.
10. **Work a Lead**: `score`, `cv coverage`, `cv build`, `cv lint`, then the `apply` skill. Record the outcome with Events and let `inbox propose` and `inbox apply` track replies.
11. **Bring history along (niche)**: `jobship migrate legacy <dir>` is an importer for one specific legacy Markdown format, and `jobship migrate linear --team <key>` imports Linear issues. Both write Events, idempotently. Skip this unless you have that history. Legacy ids (for example `AO-7` from a `Lead, Linear, Outcome, Detail` table) are kept as a `legacy id AO-7` note; when a Linear issue such as `JOB-12` matches the same Lead, either order of import adds one `legacy AO-7 = linear JOB-12` note. Ambiguous matches and legacy ids with no Linear match are reported as warnings, never guessed.

Keep real data out of this repository: fixtures and examples here are synthetic, and the data dir is separate (ADR 0003).
