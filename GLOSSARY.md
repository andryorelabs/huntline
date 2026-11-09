# huntline

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

**Variant**:
A CV produced by selecting Bullets by tag.

**Tailored CV**:
A Variant built for one Lead.

**Answer bank**:
Reusable form answers with provenance and scope; it abstains when unsure.

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
