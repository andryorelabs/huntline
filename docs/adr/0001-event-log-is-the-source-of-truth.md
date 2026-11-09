# The event log is the source of truth; trackers are projections

Every fact about an Application is an append-only Event, and status is a fold over Events. The local tracker and Linear are projections of that log. This makes migration, audit and swapping trackers cheap, at the cost of keeping projections idempotent.
