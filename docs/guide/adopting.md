# Adopting huntline with your own data

1. **Create the data dir** outside this repository: `mkdir ~/job-search && cd ~/job-search && huntline init`. Consider keeping it in a private git repository.
2. **Write the Fact bank first.** In `facts.yaml`, list each verifiable claim with an `id`, `text` and `tags`. Everything in a CV traces back to these.
3. **Write Bullets** in `bullets.yaml`. Each Bullet has `id`, `text`, `tags` and `facts: [<fact ids>]`.
4. **Fill the Never-claim list** in `never-claim.yaml` with terms you must never claim (`terms: [...]`).
5. **Fill the Profile** following the [Profile reference](../reference/profile.md).
6. **Add a Typst template** at `cv/template.typ`; `examples/cv/` in this repository has a synthetic starting point.
7. **Run `huntline doctor`** until it exits 0.
8. **Add companies**: `huntline company add https://jobs.ashbyhq.com/acme` stores `{ats: "ashby", slug: "acme"}`.
9. **Sweep**: `huntline sweep`, or feed browser Sources and JobSpy output through `huntline ingest`.
10. **Work a Lead**: `score`, `cv coverage`, `cv build`, `cv lint`, then the `apply` skill. Record the outcome with Events and let `inbox propose` and `inbox apply` track replies.
11. **Bring history along**: `huntline migrate legacy <dir>` and `huntline migrate linear --team <key>` import old sweeps and Linear issues as Events, idempotently.

Keep real data out of this repository: fixtures and examples here are synthetic, and the data dir is separate (ADR 0003).
