# Inbox classification fixtures

Synthetic, labelled recruiting emails (EN and ES) used by `inbox eval`. All names and domains are fictional (`*.example`). No personal data.

Files: `emails-en.json`, `emails-es.json`. Each is an array of `{messageId, language, from, subject, body, label}`. `label` is one of `rejection`, `interview`, `info-request`, `offer`, `other`.

## Label rules

1. Closed requisition = `rejection`. A notice that the role or requisition was closed or filled is a rejection of the application.
2. Surveys = `other`. Candidate-experience surveys and feedback requests are never `info-request`.
3. Offer outranks everything. An email that mentions an interview and an offer (for example "after your final interview we extend an offer") is `offer`.
4. Interview outranks info-request. Scheduling a call, screen or technical session is `interview`.
5. `info-request` asks the candidate for specific data or documents (salary expectations, portfolio, resume resend, availability, work authorization).
6. `other` covers automatic application receipts, newsletters, job alerts, career-fair invitations and account emails.

## Classifications file

`inbox eval <classifications.json>` takes a JSON array of `{messageId, classification}` (extra fields such as those of `ClassifiedEmail` are ignored). Every fixture `messageId` should appear once; missing ones count as wrong.
