# The event log is the source of truth; trackers are projections

Status: Accepted
Date: 2026-11-09

Every fact about an Application is an append-only Event, and status is a fold over Events. The local tracker and Linear are projections of that log.

## Context

An Application changes status many times, and the same history has to feed a local tracker, Linear and any tracker added later. Treating a tracker as the record would tie the data to one tool and lose the history of how it got there.

## Decision

- Every fact about an Application is an append-only Event.
- Status is a fold over Events, never a stored field that is edited in place.
- The local tracker and Linear are projections of the log and are rebuilt from it.

## Consequences

- Migration, audit and swapping trackers are cheap.
- Projections must stay idempotent, which is the cost of this choice.
