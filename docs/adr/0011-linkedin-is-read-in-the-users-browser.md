# LinkedIn is read in the user's browser

Status: Accepted
Date: 2026-11-12

Onboarding reads the user's own LinkedIn profile through a browser MCP in their own Chrome, at human pace; the official data export is an optional alternative.

## Context

The [onboarding research](../reference/onboarding-research.md) found that the LinkedIn User Agreement, section 8.2, forbids scripts, browser add-ons and automated methods that scrape or copy the Services, and recommended the "Download your data" export as the primary path. The export takes minutes to hours, needs the user to fetch a ZIP, and its file names are documented only by third parties. The owner chose convenience over that recommendation.

## Decision

- Onboarding reads only the user's own profile, at human pace, with no bulk crawling of other profiles.
- A LinkedIn export ZIP or the profile's "Save to PDF" is accepted as input when the user provides one.
- The `browser-source` skill keeps its LinkedIn path for Postings.

## Consequences

- Onboarding prefills roles, education and skills with no extra steps from the user.
- The user accepts the risk that LinkedIn restricts their account for automated access.
- Revisit this decision if LinkedIn enforcement against own-profile reading becomes visible.
