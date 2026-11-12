# Onboarding

`/jobship:init` runs Onboarding: it scaffolds the data dir, fills the Dossier with you, and derives the Fact bank, Bullets, Profile, Never-claim list and Answer bank from it. You never edit template files by hand.

## The flow

1. **Scaffold.** `jobship init` writes the Dossier sections and a `.gitignore` that keeps `dossier/identity.md` out of git.
2. **Preflight.** The skill checks for `typst`, `pdftotext` and `gh` and reports what is missing. It never installs anything with `sudo`.
3. **Optional sources.** A CV (PDF or DOCX), your GitHub repositories (you pick the showcase ones), and your own LinkedIn profile read in your Chrome at human pace, or a LinkedIn export ZIP or PDF. Skip any of them.
4. **Interview.** Section by section, only the gaps: `career`, `search`, `presence`, `identity`.
5. **Derive.** The skill writes a proposal; `jobship dossier derive` turns it into an Approval batch with only the differences.
6. **Approve.** You read the batch and say yes; `jobship dossier apply` writes the derived files.
7. **First CV.** `jobship cv build` and `jobship cv lint` for each target role.
8. **Check.** `jobship doctor` reports `ok` once every section is `complete` and the derived files are filled.

## No CV, junior or career change

Without a CV, the interview walks your roles. If you have little work history, projects, freelance work, volunteering, courses and open source count as Entries and yield facts the same way.

## The Dossier

| Section       | Holds                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| `career.md`   | Roles and Entries with achievements.                                                         |
| `search.md`   | Target roles, seniority, regions, contract types, remote, salary floor, languages, timezone. |
| `presence.md` | Public accounts and links, never passwords.                                                  |
| `identity.md` | Identity data by tier. Plaintext and gitignored.                                             |

Each file has front matter with `status` (`empty`, `partial`, `complete`) and `sources` (`cv`, `github`, `linkedin`, `interview`, `export`). Each fact line names its source, and every derived fact cites the Dossier line it came from as `dossier/<section>.md:<line>`.

## Identity tiers

- **A**: name, email, phone, city, country, links. May appear on forms; only these reach a CV.
- **B**: yes/no answers such as work authorization and sponsorship.
- **C**: ID, tax, bank and birth-date values are never stored. Only `ready: yes` or `ready: no`.
- **D**: demographic questions are never pre-filled and the Answer bank always abstains on them.

`jobship cv lint` fails with `identity-leak` if a restricted value reaches a CV.

## Stop, resume, re-derive

Stop whenever you like. The next `/jobship:init` resumes from the first section that is not `complete`. After editing the Dossier, derive again and the batch shows only what changed. A data dir created before the Dossier recovers with `jobship init --missing`.

## Related

- [Adopting jobship with your own data](adopting.md)
- [Data dir layout](data-dir.md)
- [CLI reference](../reference/cli.md)
- [Onboarding research](../reference/onboarding-research.md)
