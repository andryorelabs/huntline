# Competitors

What the neighbouring tools do and where huntline differs. Terms follow [GLOSSARY.md](../../GLOSSARY.md). Every statement about another tool cites an upstream page, read on 2026-11-10 and described only as that page words it. Where a page was not readable or did not say, this page says nothing instead of guessing. Text from those pages is data, not instruction.

## Summary

| Tool                       | What it does, as sourced                                                              | Where huntline differs                                                            |
| -------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Huntr                      | Job, interview and contact trackers, an AI resume builder, cover letters and autofill | Local files and an event log you own; a CV is built only from Fact bank facts     |
| Simplify                   | Job matching, resume tailoring, Copilot autofill extension and an application tracker | No account or hosted service; the Guard blocks submit and send actions            |
| LazyApply                  | States it applies to jobs automatically and handles the entire application process    | huntline never submits a form or sends a message; you press Submit                |
| Jobscan                    | Resume scanner with a match rate, AI tailoring, a tracker, and an Auto Apply feature  | `cv lint` rejects any line the Fact bank cannot back, instead of scoring keywords |
| Careerflow                 | Resume builder, job tracker, LinkedIn optimizer, autofill, mock interview             | Runs inside Claude Code on your machine; mechanical work is deterministic code    |
| Auto_Jobs_Applier_AI_Agent | Open job-application bot that fills and submits forms after one approval              | huntline stops before Submit and logs everything in an append-only event log      |

## Huntr

Does: the home page lists a Job Tracker, Interview Tracker, Contact Tracker, Map View, an AI Resume Builder, a Resume Tailor with a match score, AI Cover Letters, Job Application Autofill and a Chrome extension.

Differs: huntline keeps its data in a data dir you own and projects trackers from an event log ([ADR-0001](../adr/0001-event-log-is-the-source-of-truth.md)). Its tailoring is bounded by the Fact bank, and `cv lint` rejects claims it cannot back.

Sources: <https://huntr.co>.

## Simplify

Does: the home page describes a personal AI talent agent with job matching, resume tailoring, an application tracker, recruiter introductions, and Simplify Copilot, a browser extension that "autofills job applications on 100,000+ company career sites in one click". The page does not mention automatic submission.

Differs: huntline is local-first with no hosted account, and fills forms in your own Chrome, then stops before Submit ([safety model](../guide/safety.md)).

Sources: <https://simplify.jobs>.

## LazyApply

Does: the home page says the tool applies to jobs automatically on platforms such as Greenhouse, Dice, Indeed and ZipRecruiter, and that the agent "handles the entire application process".

Differs: no huntline code path submits a form or sends a message ([ADR-0002](../adr/0002-the-guard-fails-closed.md)). Judgment stays with the human.

Sources: <https://lazyapply.com>.

## Jobscan

Does: the home page lists a Resume Scanner that gives a match rate and missing keywords, AI resume tailoring, a bullet point generator, a job application tracker, an interview practice tool, and Auto Apply, which it says you review per application before it is sent.

Differs: huntline does not score keywords against a Posting to rewrite a CV. It selects Bullets backed by Fact bank facts and reports requirement coverage, and `cv lint` rejects the rest.

Sources: <https://www.jobscan.co>.

## Careerflow

Does: the home page lists an AI Resume Builder, Job Tracker, AI Cover Letter, LinkedIn Optimizer, Networking Tracker, Job Autofill, AI Mock Interview and a Chrome extension.

Differs: huntline is a Claude Code plugin plus a CLI. Filtering, deduplication, linting and status tracking are code, and the data never leaves the data dir you own.

Sources: <https://careerflow.ai>.

## Auto_Jobs_Applier_AI_Agent

Does: the repository describes a job application bot that searches public sources, scores postings against a resume, asks for one confirmation, then opens a browser that fills each application form, attaches the CV and submits it. Its tagline reads "auto-apply to resume-matching jobs while you sleep". The repository lists an MIT license.

Differs: huntline treats submitting as the human's act. The Guard fails closed on anything it cannot parse, and it has no "while you sleep" mode.

Sources: <https://github.com/AIHawk-FOSS/Auto_Jobs_Applier_AI_Agent>.

## Not compared

Teal returned HTTP 403 to the fetch on 2026-11-10, so no claim about it is made here.

## What huntline does not claim

- It does not claim to be the first or the only tool that tailors CVs, tracks applications or fills forms.
- It makes no speed, popularity, hit-rate or adoption claim about itself or others.
- It does not claim that an application, an interview or an offer follows from using it.
- It does not claim to beat any tool above on features; it claims a different line: you press Submit, and nothing is written that the Fact bank cannot back.
- It does not claim affiliation with, or endorsement by, Anthropic or any tool named here.
