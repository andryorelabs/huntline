# Identity data is tiered

Status: Accepted
Date: 2026-11-12

Every identity field in the Dossier carries an Identity tier that limits where it may travel, and some values are never stored.

## Context

A job search needs identity data at different moments: contact details on every form, yes/no answers on work authorization, ID, tax and bank details only after an offer, and demographic questions that must stay the user's choice each time. Storing all of it in one place and letting it reach a CV or a form is a leak waiting to happen.

## Decision

- Tier A, any form: name, email, phone, city, country, links.
- Tier B, yes/no only: work authorization, visa sponsorship, citizenship, non-compete.
- Tier C, after an offer: ID, tax, bank, date of birth. Only readiness (`ready: yes|no`) is stored, never the value; `jobship dossier check` refuses a value.
- Tier D, never pre-filled: demographic and EEOC questions. The Answer bank always abstains on them.
- `dossier/identity.md` is plaintext and listed in the data-dir `.gitignore` written by `jobship init`. No encryption.
- `jobship cv lint` fails with `identity-leak` when a tier B, C or D value, or a tier-A field beyond the contact line, appears in a CV; `jobship dossier derive` refuses facts and bullets that contain one.

## Consequences

- The tool can never paste a passport number into a form, because it never holds one.
- Post-offer paperwork stays manual.
- A user who commits the data dir to a public repository still exposes tier A and B data; the `.gitignore` only covers `identity.md`.
