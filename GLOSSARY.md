# jobship

A local-first job-search system: it finds Postings, turns the worthwhile ones into Leads, and carries each Lead through an Application, with a human making every irreversible move.

## Language

**Posting**:
A job ad as published by a Source.
_Avoid_: Job, offer, listing

**Source**:
A place Postings come from: an ATS board, a job board API, or a browser-only site.
_Avoid_: Portal, provider

**Sweep**:
One pass over a set of Sources that turns new Postings into Leads.
_Avoid_: Scan, crawl

**Lead**:
A Posting that passed the Gates and is worth a human look.
_Avoid_: Opportunity, candidate job

**Application**:
The lifecycle of one Lead from Lead to an end state.
_Avoid_: Job, deal

**Dedup key**:
The normalized identity that makes two Postings the same Application.

**Ledger**:
The record of every Posting seen or dismissed, used for dedup.
_Avoid_: Seen list, cache

**Event**:
An immutable fact about an Application; an Application's status is derived from its Events.
_Avoid_: Log entry, update

### Filtering and scoring

**Profile**:
The user's search criteria and hard constraints.
_Avoid_: Settings, preferences

**Gate**:
A hard, deterministic check of a Posting against the Profile.

**Eligibility**:
A Gate result: eligible, ineligible, or unknown when the Posting is silent.

**Rejection reason**:
The coded reason a Gate dismissed a Posting.

**Fit score**:
The agent's judgement of a Lead against the Profile, with reasons.

### CV and answers

**Fact bank**:
The user's verified facts, each with provenance; the only material a CV may use.
_Avoid_: Profile data, resume data

**Bullet**:
A tagged CV line built only from Fact bank facts.

**Never-claim list**:
Skills or claims a CV must never contain.

**Entry**:
An experience or project in the Fact bank that Bullets belong to.

**Variant**:
A CV produced by selecting Bullets with tag rules (all, any, none).

**Tailored CV**:
A Variant built for one Lead.

**Answer bank**:
Reusable form answers with provenance and scope; it abstains when unsure.

### Onboarding

**Dossier**:
Everything the user knows about their own career, search and identity, in their own words, with provenance; the source the Fact bank, Profile and Answer bank are derived from.
_Avoid_: Onboarding data, resume

**Dossier section**:
One part of the Dossier (career, search, presence or identity) with a completeness status.

**Onboarding**:
Building the Dossier from the user's sources and an interview, then deriving the first Fact bank, Profile, Answer bank and CV.

**Identity tier**:
How far a piece of identity data may travel: any form, yes/no only, readiness only, or never pre-filled.

**Answer key**:
The stable meaning of a recurring form question that many phrasings map to.

### Human gates

**Blocker**:
Something the agent cannot resolve during an Application, scoped to a field, a section, or the whole application.

**Needs-you queue**:
All open Blockers waiting on the human.
_Avoid_: Inbox, todo

**Approval batch**:
A frozen set of proposed writes that the human approves as a whole.

**Guard**:
The hook that denies Submit and Send actions and fails closed.

### Outputs

**Tracker adapter**:
The projection of Applications into a tracker, either local files or Linear.

**Prep pack**:
Interview material for one company and role.

**Story**:
A STAR+R interview story built from Fact bank facts.

**Draft**:
An outreach message the human sends.

## Relationships

- A **Source** publishes **Postings**; a **Sweep** turns new Postings into **Leads**.
- A **Gate** checks a Posting against the **Profile** and yields an **Eligibility**; a dismissal carries a **Rejection reason**.
- A **Lead** is a Posting that passed the Gates; an **Application** is the lifecycle of one Lead.
- A **Dedup key** makes two Postings the same Application; the **Ledger** records every Posting seen or dismissed for dedup.
- An **Application**'s status is derived from its **Events**.
- A **Fit score** judges a Lead against the Profile.
- A **Bullet** is built only from **Fact bank** facts and belongs to an **Entry**; a **Variant** selects Bullets by tag rules; a **Tailored CV** is a Variant built for one Lead.
- The **Never-claim list** names what a CV must never contain.
- **Onboarding** builds the **Dossier**, which has **Dossier sections**; the Fact bank, Bullets, Profile, Never-claim list and Answer bank are derived from the Dossier through **Approval batches**.
- Each **Answer bank** entry is stored under an **Answer key**; identity data in the Dossier carries an **Identity tier**.
- A **Blocker** arises during an Application; the **Needs-you queue** holds all open Blockers.
- An **Approval batch** is a set of proposed writes the human approves as a whole.
- The **Guard** denies Submit and Send actions and fails closed.
- A **Tracker adapter** projects Applications into a tracker.
- A **Prep pack** holds interview material for one company and role; a **Story** is built from Fact bank facts.
- A **Draft** is an outreach message the human sends.

## Flagged ambiguities

- "Job" is avoided for both **Posting** and **Application**: a Posting is the ad, an Application is the lifecycle of one Lead.
- "Inbox" is avoided for the **Needs-you queue**: the queue holds open Blockers, not mail.
- **Profile** is not "Settings" or "Preferences", and the **Fact bank** is not "Profile data": the Profile holds search criteria, the Fact bank holds verified facts.
- The Dossier's search section is not the **Profile**: it holds what the user wants in their own words, and the Profile is derived from it. "Portal" is avoided for the accounts the user holds on job platforms; call them platform accounts.
