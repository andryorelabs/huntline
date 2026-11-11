# Adopting jobship with your own data

1. **Create the data dir** outside this repository: `mkdir ~/job-search && cd ~/job-search && jobship init`. Consider keeping it in a private git repository.
2. **Write the Fact bank first.** In `facts.yaml`, list each verifiable claim with an `id`, `text` and `tags`. Everything in a CV traces back to these.
3. **Write Bullets** in `bullets.yaml`. Each Bullet has `id`, `text`, `tags` and `facts: [<fact ids>]`.
4. **Fill the Never-claim list** in `never-claim.yaml` with terms you must never claim (`terms: [...]`).
5. **Fill the Profile** following the [Profile reference](../reference/profile.md).
6. **Add a Typst template** at `cv/template.typ`; `examples/cv/` in this repository has a synthetic starting point.
7. **Run `jobship doctor`** until it exits 0.
8. **Add companies** (required for ATS Sources such as `greenhouse`, `lever` and `ashby`): `jobship company add https://jobs.ashbyhq.com/acme` stores `{ats: "ashby", slug: "acme"}`.
9. **Sweep**: `jobship sweep`, or feed browser Sources and JobSpy output through `jobship ingest`.
10. **Work a Lead**: `score`, `cv coverage`, `cv build`, `cv lint`, then the `apply` skill. Record the outcome with Events and let `inbox propose` and `inbox apply` track replies.
11. **Bring history along (niche)**: `jobship migrate legacy <dir>` is an importer for one specific legacy Markdown format, and `jobship migrate linear --team <key>` imports Linear issues. Both write Events, idempotently. Skip this unless you have that history. Legacy ids (for example `AO-7` from a `Lead, Linear, Outcome, Detail` table) are kept as a `legacy id AO-7` note; when a Linear issue such as `JOB-12` matches the same Lead, either order of import adds one `legacy AO-7 = linear JOB-12` note. Ambiguous matches and legacy ids with no Linear match are reported as warnings, never guessed.

Keep real data out of this repository: fixtures and examples here are synthetic, and the data dir is separate (ADR 0003).
