# Onboarding research for jobship: the Dossier and what derives from it

Research date: 2026-11-12. Every claim cites a primary source (official docs, specs, first-party APIs, or a live first-party API response). Where only secondary sources exist, the text says so. No real personal data is included; the live API samples are public job postings, not candidate data.

> Decision note: jobship reads LinkedIn in the user's own browser rather than export-only, accepting the risk described in section 5. See [ADR-0011](../adr/0011-linkedin-is-read-in-the-users-browser.md).

---

## 1. What application forms actually ask

### 1.1 Greenhouse (Job Board API)

- `GET /v1/boards/{board_token}/jobs/{id}?questions=true` returns `questions` (each with `required`, `label`, `fields[]` where each field has `name`, `type`, `values`), `location_questions`, `compliance` (EEOC, only when enabled for government contractors), `demographic_questions` (Greenhouse Inclusion: `header`, `description`, `questions[]` with `answer_options[]` that may be `free_form`), `data_compliance` (GDPR: `requires_consent`, `requires_retention_consent`, `retention_period` in days), and, with `pay_transparency=true`, `pay_input_ranges` (`min_cents`, `max_cents`, `currency_type`). https://developers.greenhouse.io/job-board.html (now served at https://docs.greenhouse.io/job-board.html)
- Field types: `input_file`, `input_text`, `input_hidden`, `textarea`, `multi_value_single_select`, `multi_value_multi_select`; one question can aggregate several fields (Resume accepts file or text). Same source.
- The POST apply endpoint needs only `first_name`, `last_name`, `email`; EEOC answers go as `gender`, `race`, `veteran_status`, `disability_status`. Same source. (jobship never calls it; ADR-0002.)
- Live sample, 4 public boards (gitlab, vercel, stripe, airbnb), first job each, fetched 2026-11-12 from `https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true`:
  - Always: First Name, Last Name, Email, Phone, Resume/CV, Cover Letter.
  - Links: LinkedIn Profile (3/4), Github, Twitter, Website (vercel).
  - Preferred name (gitlab, airbnb "Preferred First Name").
  - Country of residence / "based in one of these countries" / US state (4/4).
  - Work authorization (vercel, stripe, airbnb) and visa sponsorship now or in the future (4/4), each with different wording.
  - Prior employment at the company (gitlab, stripe, airbnb).
  - Non-compete or post-employment restrictions (gitlab, airbnb).
  - Accessibility adjustments (gitlab), "How did you first hear" (vercel), current employer and title (stripe), years of experience and language fluency (airbnb), office attendance willingness (airbnb), WhatsApp opt-in (stripe), privacy acknowledgment (vercel), AI-usage attestation (airbnb), "Why us" (airbnb).
  - `compliance` = eeoc (gitlab, stripe); `demographic_questions` gender identity, race/ethnicity, sexual orientation, transgender, disability, veteran (vercel); `data_compliance` = gdpr (4/4).

### 1.2 Lever (Postings API + hosted form)

- Public apply endpoint `POST /v0/postings/SITE/POSTING-ID?key=...` fields: `name`, `email` (required), `phone`, `org` (current company), `urls` (map, e.g. `urls[GitHub]`, prose lists GitHub, Twitter, LinkedIn, Dribbble), `comments`, `resume`, `source`, `timezone`, `consent.marketing`, `consent.store`, `opportunityLocation`. The API does not expose custom questions. https://github.com/lever/postings-api
- Live hosted form (`https://jobs.lever.co/palantir/{id}/apply`, fetched 2026-11-12): base fields `name`, `email`, `phone`, `location` ("Current location", structured), `org`, `urls[LinkedIn]`, `urls[GitHub]`, `urls[Portfolio]`, `resume`, `comments`; custom questions are "cards" posted as `cards[<uuid>][field<n>]`. Card questions seen: language skills (multi-check), preferred name, name pronunciation, legally authorized to work, sponsorship (H-1B), university, how you heard, proudest accomplishment, why this company, AI notetaker consent, citizenship/permanent-resident status for a given country.

### 1.3 Ashby

- Forms come from `jobPosting.info` as `fields[]` with `path`, `type`, `title`, `isRequired`, `selectableValues`; system paths include `_systemfield_name` (String), `_systemfield_email` (Email), `_systemfield_resume` (File). Types: `String`, `Email`, `File`, `Date`, `Number`, `Boolean`, `LongText`, `ValueSelect`, `MultiValueSelect`, `Phone`, `Score`, `SocialLink`. EEOC is a separate survey form submitted via `surveySubmission.create`. https://developers.ashbyhq.com/docs/creating-a-custom-careers-page
- `visibilityCondition` (beta) makes fields conditional; "isRequired applies only while it is shown". https://developers.ashbyhq.com/reference/applicationformsubmit
- Diversity and EEOC survey responses "will never be included" in webhook payloads. Same source.
- The public posting API returns compensation with `includeCompensation=true` (`compensationTierSummary`, `scrapeableCompensationSalarySummary`). https://developers.ashbyhq.com/docs/public-job-posting-api

### 1.4 Workable

- `GET /spi/v3/jobs/{shortcode}/application_form` returns `form_fields` (keys match candidate attributes; types `string`, `free_text`, `file`, `boolean`, `date`, `complex`) and `questions` (types `free_text`, `multiple_choice`, `boolean`, `dropdown`, `numeric`, `date`, `file`). The example shows `headline`, `address`, `avatar` (Photo, can be required), `experience` (complex: title, company, industry, summary, current, start_date, end_date), `summary`, `resume`, `cover_letter`. Needs an account token (`r_jobs`). https://workable.readme.io/reference/jobsshortcodeapplication_form
- Note: Workable lets employers require a photo (`avatar`), which conflicts with the CV norms in section 7.

### 1.5 SmartRecruiters

- `GET /postings/:uuid/configuration` returns screening and diversity questions, privacy policies and consent settings; questions with `complianceType` `DIVERSITY` go last. https://developers.smartrecruiters.com/docs/application-api
- Question field types: `INPUT_TEXT`, `TEXTAREA`, `CHECKBOX`, `RADIO`, `SINGLE_SELECT`, `MULTI_SELECT`, `INFORMATION`. https://developers.smartrecruiters.com/reference/getapplyconfigurationforposting-1
- Candidate fields on create: `firstName`, `lastName`, `email`, `phoneNumber`, `location`, `web` (`linkedIn`, `facebook`, `twitter`, `website`, `skype`), `education`, `experience`, `resume`, `avatar`, `messageToHiringManager`, `answers`, `consentDecisions`, `sourceDetails`. https://developers.smartrecruiters.com/reference/createcandidate-1

### 1.6 Recurring field set (Answer bank pre-fill targets)

| Intent                                                     | Seen in                              | Dossier source                                          |
| ---------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Legal name, preferred name, pronunciation                  | GH, Lever, Ashby                     | identity                                                |
| Email, phone (E.164)                                       | all                                  | identity                                                |
| Current location: country, region/state, city              | all                                  | identity + preferences                                  |
| Work authorization per country                             | GH, Lever                            | identity/legal                                          |
| Sponsorship now or in future                               | GH, Lever                            | identity/legal                                          |
| Citizenship / permanent residency (per country)            | Lever                                | identity/legal                                          |
| Links: LinkedIn, GitHub, portfolio/website, X/Twitter      | all                                  | presence                                                |
| Current employer and title                                 | GH, Lever `org`, Workable experience | career                                                  |
| Years of experience (total, per skill)                     | GH                                   | career (computed)                                       |
| Languages and fluency                                      | GH, Lever                            | career (CEFR)                                           |
| Salary expectation (amount, currency, period)              | many custom questions; GH pay ranges | preferences                                             |
| Notice period / earliest start date                        | custom questions (common)            | preferences                                             |
| Remote / office attendance willingness, relocation         | GH                                   | preferences                                             |
| Previously worked at this company                          | GH                                   | career (per-company scope)                              |
| Non-compete / post-employment restrictions                 | GH                                   | identity/legal                                          |
| How did you hear                                           | GH, Lever, `source` fields           | per-Lead scope (from Ledger Source)                     |
| Why this company / proudest accomplishment                 | GH, Lever, Workable                  | per-Lead draft from Fact bank                           |
| Accessibility adjustments                                  | GH                                   | identity (optional, never pre-filled)                   |
| Privacy / AI-usage / AI-notetaker consent, WhatsApp opt-in | GH, Lever, SR                        | never pre-filled; human ticks                           |
| EEOC / demographics                                        | GH, Ashby survey, SR DIVERSITY       | identity, explicit per-answer choice; default "decline" |

---

## 2. JSON Resume schema

- Current version 1.7.1 (npm `@jsonresume/schema`, registry `dist-tags.latest`, modified 2026-11-06). https://registry.npmjs.org/@jsonresume/schema . The old repo is archived; development moved to the monorepo `packages/schema`. https://github.com/jsonresume/resume-schema
- Sections (all optional): `basics` (name, label, image, email, phone, url, summary, location{address, postalCode, city, countryCode, region}, profiles[{network, username, url}]), `work` (name, position, url, startDate, endDate, summary, highlights, keywords, location, description), `volunteer`, `education` (institution, area, studyType, startDate, endDate, score, courses), `awards`, `certificates` (name, date, issuer, url, credentialId, expiryDate), `publications`, `skills` (name, level, keywords), `languages` (language, fluency), `interests`, `references` (name, reference, relationship, availableOnRequest), `projects` (name, highlights, keywords, roles, entity, type, url, dates), `meta`; plus top-level `objective` and `custom`. https://jsonresume.org/schema
- Fit with jobship: jobship's `FactBank` has `profile`, `experience`/`projects` Entries, `skills` groups and atomic `facts` with ids; Bullets cite `factIds` (`src/cv/types.ts`). JSON Resume `highlights` are free strings with no provenance or ids, and `languages.fluency` is free text.
- Verdict: do not adopt JSON Resume as the internal model (it loses provenance and fact atomicity). Do support it at the edges: import (`work`→Entries, `highlights`→candidate facts with provenance `import:jsonresume`, `profiles`→presence) and export (render the approved Fact bank to a 1.7.1 document, putting fact ids under `custom`). It also gives a ready schema for the career section's field names (`countryCode` ISO 3166-1 alpha-2, ISO 8601 dates).

---

## 3. Extracting from CVs (short)

- PDF: `pdftotext` (poppler) outputs reading order by default; `-layout` keeps physical layout (better for two-column CVs to avoid interleaving), `-raw` is "no longer recommended", `-enc` defaults to UTF-8, `-nopgbrk` drops form feeds. https://manpages.ubuntu.com/manpages/noble/man1/pdftotext.1.html . It is already on this host (`/usr/bin/pdftotext`).
- Detect scans: `pdffonts` lists fonts with `emb`/`sub`; a PDF with no fonts has no text layer, so text extraction returns nothing and the tool must ask for another file or offer OCR. https://manpages.ubuntu.com/manpages/noble/man1/pdffonts.1.html
- DOCX is Office Open XML (ECMA-376), a ZIP whose main text is `word/document.xml`. https://ecma-international.org/publications-and-standards/standards/ecma-376/ . Pandoc reads docx; `--track-changes` defaults to `accept` and drops comments unless `all`. https://pandoc.org/MANUAL.html . Pandoc is not installed on this host; unzip plus XML text-node extraction is a dependency-free fallback.
- Pitfalls: multi-column and sidebar layouts interleave; text in headers/footers and text boxes is lost or misplaced; ligatures and private-use glyphs garble words; icon fonts replace "email"/"phone" labels; dates in mixed formats; tracked changes leak deleted text. Mitigation: extract twice (default and `-layout`), have the agent reconcile, and show every extracted fact for approval with provenance `cv:<file>#p<page>`.

---

## 4. GitHub via `gh`

- Repo inventory: `GET /user/repos` (params `visibility`, `affiliation` = owner,collaborator,organization_member, `sort` = pushed) or `GET /users/{username}/repos` for public only. https://docs.github.com/en/rest/repos/repos . Use `gh api --paginate user/repos`.
- Languages: `GET /repos/{owner}/{repo}/languages` returns bytes per language. Same source. Linguist excludes vendored, generated and documentation files from stats, overridable via `.gitattributes`. https://github.com/github-linguist/linguist/blob/main/docs/overrides.md
- Topics: `GET /repos/{owner}/{repo}/topics`. Same source.
- Pinned repos: GraphQL `User.pinnedItems` (repositories and gists the owner pinned), `hasPinnedItems`. https://docs.github.com/en/graphql/reference/users
- Contributions: `User.contributionsCollection(from, to, organizationID)` with `totalCommitContributions`, `totalPullRequestContributions`, `totalPullRequestReviewContributions`, `totalIssueContributions`, `totalRepositoriesWithContributedCommits`, `commitContributionsByRepository`, `contributionCalendar`, `contributionYears`, `restrictedContributionsCount` (private, only when the user shares them). Same source. Range limit verified live: "The total time spanned by 'from' and 'to' must not exceed 1 year", so iterate `contributionYears`.
- Rate limits: REST 5,000 req/h authenticated, 60 unauthenticated, max 100 concurrent, 900 points/min for REST. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api . GraphQL 5,000 points/h per user, `first`/`last` 1 to 100, max 500,000 nodes per call, query `rateLimit { cost remaining resetAt }`. https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api . A full onboarding scan costs well under 1% of the budget.
- Caution: bytes-of-code and commit counts are activity signals, not skill proof; private-repo names can be confidential employer data. Propose facts only from repos the human marks as showcase, with provenance `github:<owner>/<repo>`.

---

## 5. LinkedIn

- Official export: Settings & Privacy → Data Privacy → "Download your data". Option 1 (selected categories such as Profile, Positions, Skills, Education, Certifications) arrives in minutes; Option 2 (full archive incl. Messages, Connections) within 24 hours (another section says 48); link valid 72 hours; only categories that apply to the account are included; not available on mobile. https://www.linkedin.com/help/linkedin/answer/a1339364
- Category content per the same page: Positions = Experience entries (company, title, description, location, dates); Endorsements given/received; Recommendations given/received; Rich Media links. Exact CSV file names (Profile.csv, Positions.csv, Education.csv, Skills.csv, Certifications.csv, Languages.csv, Projects.csv, Email Addresses.csv) are documented only by third parties (for example https://careerbldr.gitbook.io/documentation/product-guides/importing-your-data-from-linkedin), so the importer must detect files by name and header, not assume them.
- Own-profile PDF: profile → More/Resources → "Save to PDF"; English-language profiles only; the monthly cap does not apply to your own profile. https://www.linkedin.com/help/linkedin/answer/a541960
- User Agreement 8.2 forbids: (2) software, scripts, robots, "crawlers, browser plugins and add-ons" to "scrape or copy the Services", including profiles; (13) "bots or other unauthorized automated methods to access the Services"; (3) bypassing access controls or use limits; (1) copying cookies. https://www.linkedin.com/legal/user-agreement
- Implication: an agent driving the user's Chrome to read and copy LinkedIn pages is plausibly "software ... to scrape or copy", even on one's own profile. The export is LinkedIn's sanctioned route and the user owns that data.
- Recommendation: (1) Data export ZIP (Option 1 categories) as the primary path; (2) own-profile Save-to-PDF as the fallback, parsed like a CV; (3) no CDP reading of LinkedIn during onboarding. The existing `browser-source` skill already touches LinkedIn for Postings; that risk should be called out in an ADR rather than extended to profile data.

---

## 6. Achievement elicitation

- STAR: DDI introduced the S.T.A.R. format in 1974 to gather accurate candidate data; a complete example has Situation/Task, Action, Result, and interviewers probe until all are present. https://www.ddi.com/about/history , https://www.ddi.com/solutions/behavioral-interviewing/star-method
- XYZ: "Accomplished [X] as measured by [Y], by doing [Z]", Laszlo Bock, 29 Sep 2014. https://www.linkedin.com/pulse/20140929001534-24454816-my-personal-formula-for-a-better-resume
- CAR (Challenge, Action, Result) is a common coaching variant; I found no single primary origin, so treat it as a STAR alias.
- Brag document (Julia Evans): sections Goals, Projects (contribution + impact, "who it served", numbers), Collaboration & mentorship, Design & documentation, Company building (interviewing, onboarding), What you learned, Outside of work (talks, OSS); prompts "pitch your work to a friend" and "recall praise"; "explain what the results of your work actually were", and "you don't have to try to make your work sound better than it is". https://jvns.ca/blog/brag-documents/
- Question bank that yields verifiable, quantified facts (derived from the above):
  1. What was broken or missing before you started? (baseline, STAR S/T)
  2. What did you personally do, versus the team? (A, attribution)
  3. What changed afterwards, and how do you know: dashboard, ticket, review, release note? (R + evidence)
  4. What number moved: latency, cost, revenue, users, error rate, time saved? From what to what, over what period? (XYZ Y with baseline)
  5. Who used or depended on it? (scope)
  6. What would a reference from that time confirm? (verifiability)
  7. Who did you mentor, review for, or interview? (brag doc)
  8. Anything you are not allowed to disclose? (NDA → never-claim or generalized wording)
- Rule for jobship: a number becomes a fact only when the human states it and names its evidence; `cv lint` already flags `unbacked-number` (`src/cv/types.ts`).

---

## 7. Sensitive identity data

- What remote/EOR hiring legitimately needs, but only after an offer:
  - Deel contractors: government ID + selfie (via Veriff or manual review) before withdrawals; W-9 (US) or W-8BEN (non-US with US clients); bank details; the self-serve portal asks for banking, tax and personal info based on location. https://help.letsdeel.com/hc/en-gb/articles/9940209181457-Contractor-Account-Overview , https://www.deel.com/blog/how-to-onboard-independent-contractors-efficiently/
  - W-8BEN: given to the withholding agent, not the IRS; notify within 30 days if information changes. https://www.irs.gov/instructions/iw8ben
  - Remote EOR: administrative details and documents, then a right-to-work check before the contract; profile covers personal info, emergency contact, bank details, identity and right-to-work, country-specific documents (India example: PAN, Aadhaar, passport bio page, address proof, personal bank account). https://support.remote.com/hc/en-us/articles/4424424492685-How-employee-onboarding-statuses-work , https://support.remote.com/eor/platform-basics-and-account-management/complete-your-employee-profile-after-moving-from-contractor-to-employee , https://support.remote.com/hc/en-us/articles/27749937802381-What-information-do-customers-need-to-upload-to-onboard-and-offboard-employees-in-India-with-Remote-Payroll
- Never in a CV:
  - US: requests should be limited to what is essential; race, sex, national origin, age, religion are irrelevant; "Employers should not ask for a photograph"; no pre-offer disability inquiries. https://www.eeoc.gov/prohibited-employment-policiespractices
  - UK: Acas advises against asking age or date of birth on applications; monitoring data goes on a separate anonymous form kept apart from the CV. https://www.acas.org.uk/recruitment/follow-discrimination-law , https://www.acas.org.uk/sites/default/files/2024-04/age-discrimination-key-points-for-the-workplace.pdf
  - EU: Europass suggests a photo as optional polish only, not a requirement. https://europass.europa.eu/en/create-europass-cv . Photo/DOB/marital-status conventions in DACH, LATAM and Asia vary; I did not find a primary source that states them, so jobship should treat them as off by default and per-Variant opt-in.
  - GDPR Art. 9(1) special categories: racial/ethnic origin, political opinions, religion, trade-union membership, genetic, biometric, health, sex life/orientation. https://gdpr-info.eu/art-9-gdpr/
  - EU Pay Transparency Directive 2023/970 Art. 5: applicants are entitled to the starting pay or range; "employers shall not ask applicants about their pay history". https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng . So the Answer bank should hold expectations, never pay history.
- GDPR basics: Art. 5(1)(b) purpose limitation, (c) minimisation ("adequate, relevant and limited to what is necessary"), (e) storage limitation. https://gdpr-info.eu/art-5-gdpr/ . A person's own local processing falls under the Art. 2(2)(c) household exemption (https://gdpr-info.eu/art-2-gdpr/), but the principles are still the right design bar because the data leaves the machine when pasted into forms.
- Design consequence: tier identity data. Tier A (any form): name, email, phone, city/country, links. Tier B (asked on forms, yes/no answers only): work authorization, sponsorship, citizenship per country, non-compete. Tier C (post-offer only, do not store by default): ID numbers, tax IDs, bank details, DOB, address proof; at most a checklist of "documents I have ready", no values. Tier D (never auto-filled): EEOC/demographics, disability, accessibility needs; each answer explicit and defaulting to "decline to self-identify".

---

## 8. Other onboarding ideas

- Salary benchmarks: use observed Posting ranges first (Greenhouse `pay_input_ranges`, Ashby `includeCompensation`), already in jobship's data path, then human-supplied sources such as Levels.fyi (https://www.levels.fyi/) or BLS OEWS for US (https://www.bls.gov/oes/). Store floor, target and walk-away separately; only the floor feeds `profile.yaml` `salaryFloor`.
- Target role taxonomy: map target titles to ESCO occupations (ISCO-08-based, multilingual, public API) https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api and/or O*NET-SOC https://www.onetcenter.org/taxonomy.html , so "Backend Engineer" vs "Software Engineer II" are related, not string-matched.
- Seniority calibration: derive from evidence (scope, autonomy, people led, years) rather than titles; ask "what level did your last two employers call you, and what did the ladder say".
- Languages: CEFR A1–C2 (Basic, Independent, Proficient), self-assessed per skill (listening, reading, spoken interaction, spoken production, writing) via the Council of Europe / Europass grid. https://www.coe.int/en/web/common-european-framework-reference-languages/table-1-cefr-3.3-common-reference-levels-global-scale , https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4 . Maps to JSON Resume `languages.fluency` and answers "Are you fluent in X?".
- Timezone overlap: store IANA timezone and working-hours window; derive "hours of overlap with UTC-5 / CET" answers; Lever already collects `timezone`.
- References: name, relationship, organization, consent obtained, last contacted; JSON Resume has `references` with `availableOnRequest`. Store contact details only with the referee's consent.
- Notice period and earliest start date, contract-type and employer-of-record preferences (contractor vs EOR employee), equipment, travel tolerance.
- Answer variance: the 4 Greenhouse samples phrase sponsorship four different ways. jobship's `lookupAnswer` matches the normalized question exactly (`src/apply/answers.ts`, `normalizeQuestion` in `src/apply/blockers.ts`), so a canonical intent key with synonyms (or agent-side intent classification before lookup) is needed for pre-fill to hit.

---

## Recommendations for jobship onboarding

Priority order. Each item names the dossier section and the derived file.

**P0 — safety and structure**

1. Four dossier files with fixed headings: `dossier/career.md`, `dossier/preferences.md`, `dossier/presence.md`, `dossier/identity.md`. Every line carries provenance (`cv:file#p2`, `linkedin-export:Positions`, `github:owner/repo`, `interview:2026-11-12`). The derive step refuses lines without provenance. → all derived files.
2. Identity tiers A–D (section 7). Tier C values are not stored, only "ready: yes/no". Tier D is never derived into `answers.json` without a per-answer explicit choice; default "Decline to self-identify". → `dossier/identity.md`, `answers.json`.
3. LinkedIn: import the official data export ZIP (detect CSV by header) and own-profile Save-to-PDF; no CDP reading of linkedin.com during onboarding, per User Agreement 8.2(2) and 8.2(13). Write an ADR for this and flag the existing `browser-source` LinkedIn path as a known risk. → `dossier/career.md`, `dossier/presence.md`.
4. Proposals, never writes: derive produces a diff per file (`facts.yaml`, `bullets.yaml`, `profile.yaml`, `never-claim.yaml`, `answers.json`) that the human approves item by item; consistent with the Guard and ADR-0002/0003.

**P1 — high-yield sources**

5. Canonical Answer-bank intents from section 1.6 (≈20 keys: `work_authorization.<country>`, `sponsorship_required`, `salary_expectation`, `notice_period`, `earliest_start`, `location_current`, `remote_preference`, `relocation`, `links.linkedin|github|portfolio`, `current_employer`, `current_title`, `years_experience`, `languages`, `previously_employed_here`, `non_compete`, `how_heard`, `preferred_name`, `pronunciation`). Seed `answers.json` from `identity.md` + `preferences.md`; keep `how_heard`, `why_us` and `previously_employed_here` per-Lead scope. Add synonym matching because exact-match lookup will miss real wordings. → `answers.json`.
6. CV extraction: `pdffonts` check for a text layer, then `pdftotext` default and `-layout`, docx via unzip of `word/document.xml`; agent reconciles; each fact shown with page provenance. → `dossier/career.md` → `facts.yaml`, Entries.
7. GitHub via `gh`: `user/repos --paginate`, per-repo `languages` and `topics`, GraphQL `pinnedItems` and `contributionsCollection` per year from `contributionYears`. Human selects showcase repos; only those become project Entries and facts; private repo names default to never exported. → `dossier/presence.md`, `facts.yaml` (projects), `profile.yaml` `stack.include` proposal.
8. Gap interview using the section 6 question bank, one Entry at a time, STAR/XYZ shaped, requiring an evidence pointer for every number. Unverifiable or NDA items go to `never-claim.yaml` or a generalized wording. → `facts.yaml`, `bullets.yaml`, `never-claim.yaml`.

**P2 — calibration**

9. Preferences: salary as floor/target/walk-away with currency and period (floor → `salaryFloor`), notice period, contract types incl. contractor vs EOR, remote mode, regions, IANA timezone and overlap window, excluded companies. Never record pay history (EU 2023/970 Art. 5). → `dossier/preferences.md` → `profile.yaml`, `answers.json`.
10. Benchmarks from the user's own Leads' posted ranges (Greenhouse `pay_input_ranges`, Ashby compensation) shown next to the stated floor. → `dossier/preferences.md`.
11. Target roles mapped to ESCO/O*NET codes and a seniority self-assessment with evidence. → `dossier/preferences.md` → `profile.yaml` (and future scoring).
12. Languages with CEFR per skill. → `dossier/career.md` → facts + `answers.json` `languages`.
13. JSON Resume 1.7.1 import/export adapter at the edge (fact ids in `custom`), not as the internal model. → `facts.yaml` ↔ `resume.json`.
14. `never-claim.yaml` seeded from: skills the human rejects during review, GitHub languages with trivial byte counts, NDA items, and CV claims the human cannot evidence.
15. CV content defaults: no photo, DOB, marital status, nationality, or Art. 9 data in any Variant; a region-specific opt-in per Variant if the human insists. → `bullets.yaml`/CV template, `cv lint` rule.
