# Profile reference

`profile.yaml` in the data dir holds your search criteria and hard constraints. It is validated against `schema/profile.schema.json`; `doctor` exits 2 naming the offending field (for example `contractTypes[1]`) when validation fails.

| Field | Type | Meaning |
| --- | --- | --- |
| `regions` | list of strings | Regions you can work from, such as `LATAM` or `EU`. A Posting that states a different region is dismissed with reason `region`. |
| `contractTypes` | list of `full-time`, `part-time`, `contract`, `freelance`, `internship` | Contract types you accept. |
| `remote` | `remote-only`, `hybrid` or `any` | Remote requirement. |
| `stack.include` | list of strings | Technologies a Posting should mention. |
| `stack.exclude` | list of strings | Technologies that rule a Posting out. |
| `salaryFloor` | `null` or `{amount, currency, period?}` | Minimum salary; `currency` is a 3-letter uppercase code; `period` is `year` (default) or `month`. The salary gate normalizes to yearly; a Posting salary with no `period` is `unknown`. |
| `excludedCompanies` | list of strings | Companies never to consider. |
| `outreachDailyCap` | integer, 0 or more | Maximum `outreach log` entries per day. |
| `sources` | list of strings | Source names that `sweep` runs. |
| `tracker.kind` | `local` or `linear` | Where Leads and status changes are projected. |
| `tracker.directory` | string, optional | Directory for the `local` tracker. |
| `tracker.team` | string, optional | Linear team key for the `linear` tracker. |
| `tracker.states` | map, optional | Application state (`lead`, `to-apply`, `applied`, `screening`, `interviewing`, `offer`, `hired`, `rejected`, `withdrawn`, `discarded`) to a Linear workflow state name. Unmapped states use the defaults. |
| `tracker.channelLabels` | map, optional | Source name to a fixed Linear label, for example `linkedin: "channel:linkedin"`. |
| `tracker.channelLabelPrefix` | string, optional | Prefix for Sources without a `channelLabels` entry; default `channel:`. |
| `tracker.titleFormat` | `role-at-company` or `company-role`, optional | Linear issue title shape; default `role-at-company` ("Backend Engineer at Acme"). |

No other keys are allowed.

## Gates

Gates evaluate remote, region, contract, stack, salary floor and excluded companies. A Posting that is silent about a criterion yields Eligibility `unknown` and is kept as a Lead; only an explicit mismatch dismisses it, and every dismissal stores a Rejection reason.

## Example

```yaml
regions: [LATAM]
contractTypes: [full-time, contract]
remote: remote-only
stack:
  include: [typescript]
  exclude: [php]
salaryFloor: { amount: 60000, currency: USD }
excludedCompanies: []
outreachDailyCap: 5
sources: [greenhouse, ashby, himalayas]
tracker:
  kind: local
  directory: tracker
```
