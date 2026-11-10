# Naming candidates

Run 1 research, 2026-11-10. Status: options and a recommendation. Nothing here
is a decision: the maintainer picks the name, and no name is registered,
bought or renamed by this document.

huntline ships today under the name `huntline`. This document tests that name
against 45 alternatives drawn from the product's own metaphor, checks all 46
for availability, and scores 5 finalists, huntline among them.

## Constraints

From [PRODUCT.md](../../PRODUCT.md) and the brand interview direction:

1. **Calm, precise, trustworthy.** The name must not promise speed, magic or
   force. No auto-apply tone.
2. **Line, trail or timeline metaphor.** The product is an event log that
   projects into trackers: a record of a search laid out in order.
3. **No hunting or weapon imagery.** No prey, trap, arrow, bow, sniper or
   target words.
4. **No purple, LinkedIn blue or Claude orange associations.** The name must
   not suggest a colour, a Claude or Anthropic mark, or a LinkedIn product.
5. **Lowercase-friendly CLI name.** One lowercase word, no hyphen, typed many
   times a day as a binary. Under about 10 letters.
6. **Plugin-safe.** No `claude` or `anthropic` in the name, so Claude Code's
   plugin validator accepts it.
7. **Safe to publish.** Nothing here imitates another brand.

## Method

1. Brainstorm from the metaphor: lines, bearings, trails and marks, threads,
   surveying, soundings and tallies.
2. Run the same checks on every name (below).
3. Drop names with a hard registry collision. A taken unscoped npm name is a
   drop only because a clean npm name keeps the CLI and plugin names aligned;
   a scoped `@andryorelabs/<name>` stays open for every name.
4. Search GitHub for same-name tools on the survivors.
5. Score 5 finalists on seven axes, 0 to 10 each, for a total out of 70.

## Long list by family

46 candidates in 6 families, including the incumbent.

### Incumbent

| Name     | Why it fits                                                       |
| -------- | ----------------------------------------------------------------- |
| huntline | The current name: a line through a search; "hunt" is the risk too |

### Lines and bearings

| Name        | Why it fits                                     |
| ----------- | ----------------------------------------------- |
| plumbline   | A true vertical: precise, trusted               |
| throughline | The single thread a search runs along           |
| rhumbline   | A line of constant bearing: a steady course     |
| sightline   | What you can see from here to the goal          |
| pathline    | A path drawn as a line, in order                |
| wayline     | A line of travel                                |
| linewise    | Line by line                                    |
| isoline     | A line joining points of equal value            |
| datumline   | A reference line everything is measured from    |
| overline    | A line above: a summary over the detail         |
| tideline    | The mark a tide leaves: a record after the fact |
| ridgeline   | The line along the top, seen from far           |
| tramline    | A fixed track, parallel and predictable         |

### Trails and marks

| Name      | Why it fits                          |
| --------- | ------------------------------------ |
| cairn     | A stack of stones that marks a trail |
| waymark   | A sign that marks the way            |
| trailmark | A blaze on a trail                   |
| trailhead | Where a trail starts                 |
| milepost  | Distance travelled, recorded         |
| waypoint  | A point passed along a route         |
| wayfinder | Finding the way, without force       |
| landmark  | A fixed point you can navigate by    |
| tidemark  | A recorded high-water level          |
| benchmark | A surveyed mark of known height      |
| marker    | A plain mark                         |

### Threads and tracks

| Name     | Why it fits                              |
| -------- | ---------------------------------------- |
| skein    | A length of thread wound loosely         |
| strand   | One thread of a rope                     |
| ropewalk | The long shed where rope is laid in line |
| tether   | A line that keeps you attached           |
| lanyard  | A cord you keep on you                   |
| furrow   | A line cut in order, row by row          |
| lodeline | A line that leads                        |

### Surveying and charts

| Name      | Why it fits                                    |
| --------- | ---------------------------------------------- |
| transect  | A line along which things are counted in order |
| traverse  | A survey run from point to point               |
| contour   | A line on a map joining equal height           |
| graticule | The grid of lines on a chart                   |
| azimuth   | A bearing measured from a fixed point          |
| bearing   | Which way you are heading                      |

### Soundings and tallies

| Name       | Why it fits                                 |
| ---------- | ------------------------------------------- |
| sounding   | A depth reading taken and written down      |
| leadline   | The weighted line used to take soundings    |
| tallyline  | A tally of what was done, kept as a line    |
| ledgerline | A line in a ledger: the event log           |
| lineage    | The line a thing descends along: provenance |
| fairway    | A marked safe channel                       |
| slipway    | Where a vessel is launched, gently          |
| caravel    | A small, steady sailing ship                |

## Availability filter

Checked 2026-11-10. One row per candidate.

How each column was checked:

- **npm**: `npm view <name> name`. `free` means `E404`.
- **gh slug**: `gh api repos/andryorelabs/<name>`. `free` means 404.
- **gh account**: `gh api users/<name>`. `User` or `Org` means the account
  name is held by someone else; `none` means 404.
- **.dev / .com**: RDAP, `https://pubapi.registry.google/rdap/domain/<name>.dev`
  and `https://rdap.verisign.com/com/v1/domain/<name>.com`. `taken` is HTTP 200
  (a registration record exists), `no record` is HTTP 404. `no record` is not
  a registrar quote: nothing was bought, reserved or priced. The first pass
  through `rdap.org` returned HTTP 429 for some names, so every domain result
  here comes from the registries directly, and the four `.dev` results that
  were rate limited once (furrow, contour, trailmark, leadline) were re-run
  and came back `taken`.
- **web collision**: `gh search repos <name>` on the survivors only. `not
  searched` means the name was already dropped on a registry.

| Name        | npm   | gh slug      | gh account | .dev      | .com  | Web collision                                                                               | Verdict                                 |
| ----------- | ----- | ------------ | ---------- | --------- | ----- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| huntline    | free  | ours, exists | Org        | no record | taken | Two job-search repos named huntline, 0 stars each; `huntline` org is a ProductHunt timeline | **finalist**                            |
| plumbline   | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| throughline | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| rhumbline   | free  | free         | User       | taken     | taken | `Njaybby/rhumbline` 0 stars; geodesy libraries use the term                                 | **finalist**                            |
| sightline   | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| pathline    | free  | free         | User       | taken     | taken | `react-svg-pathline` 46 stars; flow-visualisation term                                      | **finalist**                            |
| wayline     | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| linewise    | taken | free         | User       | no record | taken | `rjbs/Mixin-Linewise` 3 stars                                                               | drop: npm taken                         |
| isoline     | free  | free         | User       | taken     | taken | not searched                                                                                | drop: cartography jargon, weak fit      |
| datumline   | free  | free         | Org        | taken     | taken | not searched                                                                                | drop: awkward, `.dev` taken             |
| overline    | free  | free         | User       | taken     | taken | not searched                                                                                | drop: typography term, negative reading |
| tideline    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| ridgeline   | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| tramline    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| cairn       | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken, Cairn is a known name  |
| waymark     | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| trailmark   | taken | free         | Org        | taken     | taken | `trailofbits/trailmark` 529 stars                                                           | drop: npm taken, category collision     |
| trailhead   | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| milepost    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| waypoint    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| wayfinder   | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| landmark    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| tidemark    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| benchmark   | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken, generic                |
| marker      | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken, generic                |
| skein       | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| strand      | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| ropewalk    | free  | free         | User       | no record | taken | `psegni/ropewalk` 0 stars; no tool in the category                                          | **finalist**                            |
| tether      | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken, Tether is a big brand  |
| lanyard     | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| furrow      | free  | free         | Org        | taken     | taken | `Agent-Field/furrow` 7 stars                                                                | drop: `.dev` taken, agent tool          |
| lodeline    | free  | free         | none       | taken     | taken | not searched                                                                                | drop: nonword, `.dev` taken             |
| transect    | free  | free         | Org        | taken     | taken | not searched                                                                                | drop: `.dev` taken, science term        |
| traverse    | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| contour     | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| graticule   | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| azimuth     | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| bearing     | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken, generic                |
| sounding    | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| leadline    | free  | free         | User       | taken     | taken | not searched                                                                                | drop: "lead" clashes with the Lead term |
| tallyline   | free  | free         | User       | no record | taken | `nhinata/tallyline` 3 stars, `LoopGlitch26/tallyline` 2 stars                               | **finalist**                            |
| ledgerline  | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| lineage     | taken | free         | none       | taken     | taken | not searched                                                                                | drop: npm taken, generic                |
| fairway     | taken | free         | User       | taken     | taken | not searched                                                                                | drop: npm taken                         |
| slipway     | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |
| caravel     | taken | free         | Org        | taken     | taken | not searched                                                                                | drop: npm taken                         |

What the filter shows:

- **npm is the sharpest filter.** 34 of 46 names are taken on npm, so only
  12 survive, and `tallyline`, `ropewalk` and `huntline` are the only ones
  that also have a `.dev` with no registration record.
- **`.com` is gone for every name.** Each of the 46 has a `.com` record, so a
  `.com` is not a deciding factor; `.dev` is.
- **A GitHub account named `huntline` already exists** as an organisation
  (bio "ProductHunt Timeline", created 2024-08-22, no public repos). The repo
  slug `andryorelabs/huntline` is ours, so this does not block the project,
  but it means the short GitHub URL is not available.

## Finalists: scored /70

Five finalists, chosen from the survivors for spread and for fit with the
line metaphor, with huntline included as the incumbent. 0 to 10 each, higher
is better on every axis. This is directional judgment, not a formula.

- **Sound:** easy to say and spell, short as a binary, reads well as
  `/<name>:sweep`.
- **Registry collision:** npm, GitHub slug and account, `.dev`.
- **Brand collision:** same-name tools and big brands that own the word.
- **Brief fit:** calm, precise, trustworthy; a line, trail or timeline; no
  hunting imagery.
- **Headroom:** room to grow past a job search into other records of work.
- **Warmth:** whether the word suggests a character or a mark.
- **Overpromise risk:** lower risk scores higher. Includes negative readings
  and any hint of auto-apply.

| Axis               | huntline                                                   | tallyline                              | ropewalk                                | rhumbline                            | pathline                      |
| ------------------ | ---------------------------------------------------------- | -------------------------------------- | --------------------------------------- | ------------------------------------ | ----------------------------- |
| Sound              | 8: two clear halves, 8 letters                             | 8: clear, 9 letters                    | 6: "rope walk" fused, 8 letters         | 5: "rhumb" is rare, reads "rum"      | 9: plain, 8 letters           |
| Registry collision | 5: GitHub account `huntline` held, two same-name repos     | 8: npm, slug and `.dev` free           | 9: npm, slug and `.dev` free            | 7: npm free, `.dev` taken            | 7: npm free, `.dev` taken     |
| Brand collision    | 5: other job tools use the exact word                      | 8: two tiny repos, 3 stars at most     | 8: none in the category                 | 8: only geodesy terms                | 7: a 46-star React package    |
| Brief fit          | 6: line yes, calm yes, "hunt" works against the avoid list | 8: a tally of a search, kept as a line | 6: a line, but rope-making is a stretch | 9: a steady course, precise and calm | 8: a path as a line, in order |
| Headroom           | 7: any search, but job-bound                               | 7: any counted record                  | 6: narrow image                         | 7: any course                        | 7: any path                   |
| Warmth             | 5: no character in it                                      | 6: tally marks make a friendly mark    | 6: a long shed and a rope, tactile      | 5: abstract                          | 5: abstract                   |
| Overpromise risk   | 6: "hunt" hints at aggression and auto-apply               | 8: "tally" promises only counting      | 7: nothing promised                     | 8: nothing promised                  | 8: nothing promised           |
| **Total /70**      | **42**                                                     | **53**                                 | **48**                                  | **49**                               | **51**                        |

Each total is the sum of its seven scores: huntline 8+5+5+6+7+5+6 = 42,
tallyline 8+8+8+8+7+6+8 = 53, ropewalk 6+9+8+6+6+6+7 = 48, rhumbline
5+7+8+9+7+5+8 = 49, pathline 9+7+7+8+7+5+8 = 51.

Reading it straight:

- **tallyline** leads. It is the only finalist that is free on npm, GitHub
  slug and `.dev` and also names something the product does: it keeps a
  running count of a search. Its weakness is warmth.
- **pathline** is the easiest to say and fits the metaphor, but its `.dev` is
  taken and a small React package shares the name.
- **rhumbline** fits the brief best (a line of constant bearing) and loses
  points on sound: few people know how to say "rhumb".
- **ropewalk** is the cleanest on registries and the weakest on brief fit.
- **huntline** is last. It is the incumbent and says "job search" at once, but
  the word "hunt" sits against the brief's avoid list, the GitHub account name
  is held, and other job tools already use it.

## Recommendation

This is input for the maintainer, who decides.

1. **Keep huntline only if renaming costs more than the brand risk.** It
   scores 42 of 70, 11 points behind the leader, and its main cost is the
   hunting reading, which the brand brief explicitly avoids.
2. **If the name is open, take `tallyline`**, then `pathline` as the fallback
   if `.dev` matters less than sound. Before any rename, confirm `.dev`
   availability with a registrar: RDAP "no record" is a signal, not a quote.
3. **Re-run the availability table before acting.** It is dated 2026-11-10 and
   registrations change.

Nothing was bought or registered for this research.

## Round 2

Run 2 research, 2026-11-10. Status: options and a recommendation, input for
the maintainer, who decides. Nothing here is a decision, and no name is
registered, bought or renamed.

### Why a second round

Round 1 drew only on the line and trail metaphor, and the maintainer found
that hard to follow: a stranger cannot connect `tallyline` or `rhumbline` to a
job search from the name. Round 2 adds names built from job-search vocabulary
and adds an eighth axis, **Findability**, so both rounds compare on one scale.

Round 1 text above is unchanged. The hard filters are unchanged too: no
hunting or weapon imagery, no purple, LinkedIn-blue or Claude-orange
associations, no auto-apply or "AI magic" tone, npm and GitHub slug free,
lowercase and CLI-friendly, and the name must read well as `/<name>:sweep`.

One reading differs from round 1. Round 1 dropped `leadline` because "lead"
clashes with the Lead term. This round treats "lead" as an asset, since Lead
is the product's own word for a tracked Posting ([GLOSSARY.md](../../GLOSSARY.md)).
The sales-lead reading is counted under overpromise risk instead.

### Long list by family

50 new candidates in 2 families.

#### Direct

Job-search vocabulary: lead, posting, shortlist, opening, application, role and
CV-adjacent words, using `line`, `list`, `log` or `trail` where it fits.

| Name       | Why it fits                                   |
| ---------- | --------------------------------------------- |
| shortlist  | The few Leads worth a second look             |
| postline   | A line of Postings                            |
| postlog    | A log of Postings seen                        |
| openline   | Openings, in order                            |
| openroles  | The roles that are open                       |
| rolelog    | A log of roles                                |
| rolebook   | A book of roles                               |
| roleline   | A line of roles                               |
| rolelist   | A list of roles                               |
| leadlog    | A log of Leads                                |
| leadbook   | A book of Leads                               |
| leadtrail  | The trail a Lead leaves from Posting to reply |
| leadlist   | A list of Leads                               |
| applog     | A log of Applications                         |
| applytrail | The trail of Applications                     |
| applyline  | A line of Applications                        |
| cvtrail    | The trail of a Tailored CV                    |
| cvline     | A line of CVs                                 |
| cvlog      | A log of CVs                                  |
| jobline    | A line of jobs                                |
| joblog     | A log of jobs                                 |
| jobtrail   | The trail of a job search                     |
| jobtally   | A running count of a search                   |
| hireline   | The line to being hired                       |
| hirepath   | The path to being hired                       |
| shortlog   | A short log, as in a shortlist                |
| careerline | A line through a career                       |
| careerlog  | A log of a career                             |

#### Suggestive

Hints at work or career without saying it.

| Name        | Why it fits                                 |
| ----------- | ------------------------------------------- |
| workline    | A line of work                              |
| worklog     | A log of work                               |
| workbook    | A book of work                              |
| worktrail   | The trail of work done                      |
| craftline   | A line of craft                             |
| tradeline   | A line of trade                             |
| guildline   | A line of guild membership                  |
| journeyman  | A worker between apprenticeship and mastery |
| apprentice  | A worker learning a trade                   |
| fieldwork   | Work done in the field                      |
| workwise    | Wise about work                             |
| tradecraft  | The skill of a trade                        |
| toolbelt    | The tools a worker carries                  |
| workbench   | Where work is done                          |
| ladderline  | A career ladder drawn as a line             |
| rungline    | One rung of a ladder, in line               |
| stepline    | Steps in order                              |
| daywork     | Work paid by the day                        |
| handwork    | Work done by hand                           |
| workshed    | A shed where work happens                   |
| benchline   | A line at the workbench                     |
| callingline | A calling, as in vocation                   |

### Availability filter

Checked 2026-11-10 with the same method as round 1: `npm view <name> name`,
`gh api repos/andryorelabs/<name>`, `gh api users/<name>`, RDAP for `.dev`
(`https://pubapi.registry.google/rdap/domain/<name>.dev`) and `.com`
(`https://rdap.verisign.com/com/v1/domain/<name>.com`); `rdap.org` was not
used. The `.dev` registry rate limited (HTTP 429) 30 of 50 names on the first
pass; each was re-run one at a time with a pause and returned 200 or 404. Web
collision is `gh search repos <name> --match name` on every name that is free
on npm; the stars shown are from the top results. `no record` is not a
registrar quote.

| Name        | npm   | gh slug | gh account | .dev      | .com  | Web collision                                 | Verdict                                                       |
| ----------- | ----- | ------- | ---------- | --------- | ----- | --------------------------------------------- | ------------------------------------------------------------- |
| shortlist   | taken | free    | Org        | taken     | taken | not searched                                  | drop: npm taken                                               |
| postline    | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| postlog     | free  | free    | User       | taken     | taken | `statianzo/PostLog` 21 stars                  | survivor, not shortlisted: `.dev` taken, logging library      |
| openline    | taken | free    | Org        | taken     | taken | not searched                                  | drop: npm taken                                               |
| openroles   | free  | free    | User       | taken     | taken | `datascry/openroles` 8 stars                  | survivor, not shortlisted: `.dev` taken, reads as a job board |
| rolelog     | free  | free    | none       | taken     | taken | 0 stars                                       | survivor, not shortlisted: `.dev` taken                       |
| rolebook    | free  | free    | Org        | taken     | taken | 1-star cookbook repos                         | survivor, not shortlisted: `.dev` taken, account held         |
| roleline    | free  | free    | none       | no record | taken | none found                                    | **finalist**                                                  |
| rolelist    | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: plain, no line or trail            |
| leadlog     | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: sales-CRM reading                  |
| leadbook    | free  | free    | none       | no record | taken | 2 stars at most                               | survivor, not shortlisted: sales-CRM reading                  |
| leadtrail   | free  | free    | none       | no record | taken | 0 stars; `leadtrailpro` is a lead tool        | **finalist**                                                  |
| leadlist    | free  | free    | Org        | taken     | taken | 9-star lead scraper                           | survivor, not shortlisted: scraper tone, `.dev` taken         |
| applog      | free  | free    | User       | no record | taken | 4 stars                                       | survivor, not shortlisted: reads as app log, account held     |
| applytrail  | free  | free    | none       | no record | taken | `kaung-myat-code/applytrail` 9 stars          | survivor, not shortlisted: "apply" hints at auto-apply        |
| applyline   | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: "apply" hints at auto-apply        |
| cvtrail     | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: CV-only, narrow                    |
| cvline      | free  | free    | User       | no record | taken | 0 stars                                       | survivor, not shortlisted: CV-only, account held              |
| cvlog       | free  | free    | User       | no record | taken | 11 stars on a near match, a logger            | survivor, not shortlisted: logger reading, account held       |
| jobline     | taken | free    | Org        | no record | taken | not searched                                  | drop: npm taken                                               |
| joblog      | taken | free    | User       | no record | taken | not searched                                  | drop: npm taken                                               |
| jobtrail    | free  | free    | User       | taken     | taken | `baozha2023/JobTrail` 70 stars                | survivor, not shortlisted: job-tracker collision              |
| jobtally    | free  | free    | none       | no record | taken | three repos, 0 stars each                     | **finalist**                                                  |
| hireline    | free  | free    | User       | taken     | taken | 0 stars                                       | survivor, not shortlisted: `.dev` taken, recruiter reading    |
| hirepath    | free  | free    | Org        | taken     | taken | `askmadhavan/hirepath` 6 stars                | survivor, not shortlisted: `.dev` taken, recruiter reading    |
| shortlog    | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| careerline  | free  | free    | none       | no record | taken | `root165/careerline` 3 stars                  | **finalist**                                                  |
| careerlog   | free  | free    | User       | no record | taken | `wudasong/careerlog` 2 stars                  | survivor, not shortlisted: account held, close to careerline  |
| workline    | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| worklog     | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| workbook    | taken | free    | Org        | taken     | taken | not searched                                  | drop: npm taken                                               |
| worktrail   | free  | free    | Org        | no record | taken | `jasonethicseo/worktrail` 4 stars             | **finalist**                                                  |
| craftline   | free  | free    | Org        | taken     | taken | 0 stars                                       | survivor, not shortlisted: `.dev` taken, crafts reading       |
| tradeline   | free  | free    | Org        | no record | taken | 0 stars                                       | survivor, not shortlisted: reads as trading or finance        |
| guildline   | free  | free    | Org        | no record | taken | repo names misspell "guideline"               | survivor, not shortlisted: reads as a typo                    |
| journeyman  | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| apprentice  | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| fieldwork   | free  | free    | User       | taken     | taken | `sillsdev/FieldWorks` 110 stars, a near match | survivor, not shortlisted: `.dev` taken, science term         |
| workwise    | free  | free    | Org        | taken     | taken | `opencodeiiita/WorkWise` 8 stars              | survivor, not shortlisted: `.dev` taken, account held         |
| tradecraft  | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| toolbelt    | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| workbench   | taken | free    | User       | taken     | taken | not searched                                  | drop: npm taken                                               |
| ladderline  | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: climbing and pressure reading      |
| rungline    | free  | free    | none       | no record | taken | 0 stars                                       | survivor, not shortlisted: nonword feel                       |
| stepline    | free  | free    | none       | taken     | taken | 7 stars                                       | survivor, not shortlisted: `.dev` taken, no work link         |
| daywork     | taken | free    | Org        | taken     | taken | not searched                                  | drop: npm taken                                               |
| handwork    | taken | free    | Org        | no record | taken | not searched                                  | drop: npm taken                                               |
| workshed    | free  | free    | User       | taken     | taken | 2 stars                                       | survivor, not shortlisted: `.dev` taken, account held         |
| benchline   | free  | free    | Org        | taken     | taken | 0 stars                                       | survivor, not shortlisted: `.dev` taken, "benchmark" reading  |
| callingline | free  | free    | none       | no record | taken | none found                                    | survivor, not shortlisted: reads as a phone line              |

What the filter shows:

- **npm removes about a third.** 16 of 50 are taken on npm, so 34 survive,
  against 12 of 46 in round 1. Compound job words are mostly free.
- **`.com` is gone for all 50.** Every name has a `.com` record, as in round 1.
- **`.dev` has no record for 23 of 50.** Of the 34 npm survivors, 20 have no
  `.dev` record. The five finalists below all do.
- **GitHub account** is held by someone for 35 of 50 names; the slug
  `andryorelabs/<name>` is free for all 50. Finalists prefer an unheld account.

### Findability

The eighth axis, added to the seven from round 1.

- **Findability:** 0 to 10. Would a stranger who searches "job search Claude
  Code", or who only reads the name, connect it to job search? 0 means no
  connection, 10 means the name says job search outright.

Total is now out of 80.

### Round 1 finalists, re-scored

The five round-1 finalists keep their seven scores from round 1 and gain a
Findability score. The original totals out of 70 stay in the table.

| Name      | Findability                                       | Original /70 | New /80 |
| --------- | ------------------------------------------------- | ------------ | ------- |
| huntline  | 8: "hunt" and "line" read as job hunt at a glance | 42           | **50**  |
| tallyline | 2: a tally of something, with no job cue          | 53           | **55**  |
| pathline  | 2: a path, with no job cue                        | 51           | **53**  |
| rhumbline | 1: a nautical term most strangers cannot place    | 49           | **50**  |
| ropewalk  | 1: a rope shed, with no job cue                   | 48           | **49**  |

Sums: huntline 42+8 = 50, tallyline 53+2 = 55, pathline 51+2 = 53, rhumbline
49+1 = 50, ropewalk 48+1 = 49.

### New finalists: scored /80

Five finalists from the survivors, chosen for a free `.dev`, a clear job cue
and a low collision, with at least one from each family. Axes are the round 1
definitions plus Findability. This is directional judgment, not a formula.

| Axis               | roleline                                     | jobtally                                   | leadtrail                                      | careerline                                       | worktrail                                     |
| ------------------ | -------------------------------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Sound              | 8: plain, 8 letters, `/roleline:sweep` flows | 8: plain, 8 letters                        | 7: 9 letters, "lead" can read as the metal     | 8: plain, 10 letters                             | 8: plain, 9 letters                           |
| Registry collision | 9: npm, slug, `.dev` free, no account held   | 9: npm, slug, `.dev` free, no account held | 9: npm, slug, `.dev` free, no account held     | 9: npm, slug, `.dev` free, no account held       | 7: `.dev` free, GitHub account held by an Org |
| Brand collision    | 9: no repo uses the word                     | 8: three 0-star repos                      | 7: a lead tool has a similar name              | 6: 3-star repos and many recruiting sites        | 6: 3 and 4 star repos                         |
| Brief fit          | 7: a line, calm; role means job              | 7: a tally, not a line; precise            | 8: a trail, and Lead is the product's own word | 7: a line, but "career" is broad and a bit grand | 8: a trail of work, calm, precise             |
| Headroom           | 5: job-bound                                 | 4: job-bound                               | 6: any pipeline of leads                       | 7: past one search, into a career                | 8: any work record                            |
| Warmth             | 4: abstract                                  | 6: tally marks are friendly                | 6: a trail is a human mark                     | 4: abstract, corporate                           | 6: a trail of effort                          |
| Overpromise risk   | 8: nothing promised                          | 7: a tally may hint at metrics             | 6: sales-lead and scraper reading              | 6: "career" promises a lot                       | 8: nothing promised                           |
| Findability        | 7: "role" reads as job, or as access roles   | 9: "job" and "tally" say it                | 7: "lead" reads as job or sales lead           | 9: names the field outright                      | 5: "work" is wider than a job search          |
| **Total /80**      | **57**                                       | **58**                                     | **56**                                         | **56**                                           | **56**                                        |

Each total is the sum of its eight scores: roleline 8+9+9+7+5+4+8+7 = 57,
jobtally 8+9+8+7+4+6+7+9 = 58, leadtrail 7+9+7+8+6+6+6+7 = 56, careerline
8+9+6+7+7+4+6+9 = 56, worktrail 8+7+6+8+8+6+8+5 = 56.

### Both rounds compared

All ten finalists on the same /80 scale, highest first.

| Rank | Name       | Round | Total /80 | Findability |
| ---- | ---------- | ----- | --------- | ----------- |
| 1    | jobtally   | 2     | 58        | 9           |
| 2    | roleline   | 2     | 57        | 7           |
| 3    | leadtrail  | 2     | 56        | 7           |
| 3    | careerline | 2     | 56        | 9           |
| 3    | worktrail  | 2     | 56        | 5           |
| 6    | tallyline  | 1     | 55        | 2           |
| 7    | pathline   | 1     | 53        | 2           |
| 8    | huntline   | 1     | 50        | 8           |
| 8    | rhumbline  | 1     | 50        | 1           |
| 10   | ropewalk   | 1     | 49        | 1           |

Reading it straight:

- **The spread is narrow.** The top six sit within 3 points, which is inside
  the noise of a judgment score. Treat ranks 1 to 6 as a group, not a ladder.
- **jobtally** leads on Findability and registries, and it extends the tally
  idea that made `tallyline` the round 1 leader. Its weak spots are headroom
  (it says job) and that it is a count, not a line.
- **roleline** keeps the line metaphor and has the cleanest brand collision,
  but "role" can also read as access roles.
- **careerline** is the easiest to find and the most generic: several
  recruiting sites use "career line", and "career" claims more than the tool
  does.
- **worktrail** has the best fit and headroom and the weakest Findability. It
  suits the event-log idea best and tells a stranger least.
- **huntline** moves up on Findability (8) yet stays near the bottom: the
  hunting reading and the held GitHub account are unchanged.
- **leadtrail** matches the Lead term and the trail metaphor, but a sales
  scraper reading is the risk the brief warns about.

### Round 2 recommendation

This is input for the maintainer, who decides.

1. **If findability matters most, take `jobtally`**, with `careerline` as the
   fallback when a broader name is wanted. Both are free on npm, the slug and
   `.dev`, and a stranger reads them as job search.
2. **If the line metaphor matters most, take `roleline`.** It scores 57, one
   behind `jobtally`, and keeps the line from round 1 with a job cue.
3. **If fit and headroom matter more than discovery, take `worktrail`**, and
   rely on the slogan and README to say "job search".
4. **Round 1 names still stand.** `tallyline` (55) beats `pathline`, `huntline`,
   `rhumbline` and `ropewalk` on the 80-point scale. It loses to the top five
   only by 1 to 3 points.
5. **Do not rename for a 1 to 3 point gap.** Between ranks 1 and 6 the scores
   do not separate the options; pick by which axis you care about.
6. **Confirm before acting.** RDAP "no record" is a signal, not a quote, and
   registrations change. Re-run the table and ask a registrar before any
   rename, and search for trademarks, which this research did not do.

Nothing was bought or registered for this research.

## Round 3

Run 3 research, 2026-11-10. Status: options and a recommendation, input for
the maintainer, who decides. Nothing here is a decision, and no name is
registered, bought or renamed. Rounds 1 and 2 above are unchanged.

### Why a third round

The maintainer pointed at "Jobbie" as the kind of name they like: friendly, a
small character, easy to say, a name you can say to a friend ("ask Jobbie").
Rounds 1 and 2 leaned on lines, trails and job vocabulary and produced precise,
cool names. Round 3 looks for warmth: diminutives (`-ie`, `-y`, `-o`), pals and
helpers, and small creatures with an easy mascot or mark. Every name still
carries a work cue (job, role, lead, tally, CV, post, sweep) so a stranger can
connect it to a job search.

The hard filters are unchanged: no hunting or weapon imagery, no purple,
LinkedIn-blue or Claude-orange associations, no auto-apply or "AI magic" tone,
no implication that the tool applies for the user, npm and GitHub slug free,
lowercase and CLI-friendly, and the name must read well as `/<name>:sweep`.
Any mascot idea is a plain generic animal, never a copy of a real person's or
brand's character.

The brief asks for calm, precise and trustworthy. A playful name can sit
against that, and the Brief fit axis says where it does.

### What "Jobbie" is

`jobbie` is taken in the job space, so it is a reference here, not a candidate.
Checked 2026-11-10:

- **npm:** `jobbie` is taken. Version 0.1.0 is described as a "Privacy-first
  Agent Skill and CLI for evidence-based job applications, keyword-gap checks,
  and outcome tracking". That is the same space as huntline.
- **GitHub:** `jobbie-bot/Summer-2027-Tech-Internships` (101 stars, every row
  "applies through Jobbie"), `alexsieusahai/Jobbie` ("Automated job applier",
  3 stars), plus unrelated repos (a Quartz.NET scheduler, a job board).
- **Web:** directories list `jobbie.io`, a job application and resume product
  whose listings describe it as one-click application automation (Product
  Hunt, TrustMRR) or as a resume checker (creati.ai). Sources disagree on what
  it does. An iOS app "Jobbie Employee" also exists.
- **Domains:** `jobbie.com` is registered. `jobbie.dev` has no RDAP record.
- **Account:** the GitHub account `jobbie` is held by a User.

Plainly: Jobbie is a live job-search product and its tone includes
auto-apply, which is the opposite of the huntline position. The close
variants `jobby`, `jobbit`, `jobsy` and `joby` are all taken on npm. The
round 3 names borrow the feeling, not the word.

### Long list by family

70 new candidates in 3 families.

#### Diminutives

Short soft endings (`-ie`, `-y`, `-o`) on a work word.

| Name    | Why it fits                    |
| ------- | ------------------------------ |
| jobby   | A friendly "job"               |
| jobbit  | A small job, with a nod to bit |
| jobsy   | Jobs, said with a smile        |
| joby    | A short, soft "job"            |
| jobbo   | A pal called Job               |
| jobo    | Short and easy to say          |
| jobito  | A little job                   |
| leady   | A friendly "lead"              |
| leadie  | A small Lead                   |
| rolie   | A small role                   |
| roley   | A soft "role"                  |
| rolo    | Role, shortened                |
| cvie    | A friendly CV                  |
| cvy     | CV with a soft ending          |
| postie  | A Posting, and the postie      |
| posty   | A soft "post"                  |
| listie  | A small shortlist              |
| tallie  | A tally, made small            |
| tallo   | A tally, in two syllables      |
| shortie | A short list                   |
| sweepy  | A sweep, made friendly         |
| sweepie | The sweep, as a helper         |
| workie  | A bit of work                  |
| worky   | Work, made friendly            |
| hirie   | A hire, made small             |
| gigly   | A gig, made light              |
| nudgy   | A gentle nudge                 |
| findy   | A thing that finds             |

#### Pals and helpers

A name you could say to a friend, built from a work word and a helper word.

| Name     | Why it fits               |
| -------- | ------------------------- |
| jobpal   | A pal for the job search  |
| jobmate  | A mate for the job search |
| jobbud   | A buddy for jobs          |
| cvpal    | A pal for your CV         |
| cvbuddy  | A buddy for your CV       |
| leadpal  | A pal for your Leads      |
| rolepal  | A pal for roles           |
| leadmate | A mate for Leads          |
| rolemate | A mate for roles          |
| tallypal | A pal who keeps the tally |
| sweeppal | A pal who does the sweep  |
| postpal  | A pal for Postings        |
| workpal  | A pal for work            |
| workmate | A colleague               |
| applypal | A pal for applications    |
| shortpal | A pal for the shortlist   |
| listpal  | A pal for lists           |
| jobkit   | A small kit for jobs      |
| cvkit    | A small kit for CVs       |

#### Small creatures and homes

A small, calm, generic animal or a snug place, so there is an easy mascot or
mark. No predator, dog-and-chase or hunting animal is intended.

| Name     | Why it fits                             |
| -------- | --------------------------------------- |
| jobpup   | A young helper dog                      |
| jobbee   | A busy bee for jobs                     |
| jobmouse | A small mouse, quiet and careful        |
| jobbird  | A small bird for jobs                   |
| rolebird | A bird for roles                        |
| leadbird | A bird for Leads                        |
| jobowl   | An owl that keeps watch over the record |
| hirowl   | An owl for hiring                       |
| jobotter | An otter, playful and calm              |
| rolebee  | A bee for roles                         |
| leadbee  | A bee for Leads                         |
| jobwren  | A wren, small and exact                 |
| tallybee | A bee that keeps a tally                |
| tallypup | A pup that keeps a tally                |
| jobpip   | A small seed or mark for jobs           |
| leadpip  | A small mark for a Lead                 |
| rolepip  | A small mark for a role                 |
| jobnest  | A snug place for jobs                   |
| rolenest | A snug place for roles                  |
| leadnest | A snug place for Leads                  |
| jobtail  | The tail of a log, a tail on a mascot   |
| leadtail | The tail of a Lead                      |
| roletail | The tail of a role                      |

### Availability filter

Checked 2026-11-10 with the same method as rounds 1 and 2: `npm view <name>
name`, `gh api repos/andryorelabs/<name>`, `gh api users/<name>`, RDAP for
`.dev` (`https://pubapi.registry.google/rdap/domain/<name>.dev`) and `.com`
(`https://rdap.verisign.com/com/v1/domain/<name>.com`); `rdap.org` was not
used. Lookups ran one name at a time with a pause between calls, and a 429 on
`.dev` was retried after a longer pause. Web collision is `gh search repos
<name> --match name` on every name free on npm, plus a web search on the
finalists; the stars shown are from the top results. `no record` is not a
registrar quote.

| Name     | npm   | gh slug | gh account | .dev      | .com      | Web collision                                                      | Verdict                                                                    |
| -------- | ----- | ------- | ---------- | --------- | --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| jobby    | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| jobbit   | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| jobsy    | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| joby     | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| jobbo    | free  | free    | User       | no record | taken     | job-board repos, 12 to 178 stars                                   | survivor, not shortlisted: reads as a job board, account held              |
| jobo     | free  | free    | User       | taken     | taken     | `GresonKwan/JobOK` 445 stars, a near match                         | survivor, not shortlisted: `.dev` taken, account held                      |
| jobito   | free  | free    | User       | taken     | taken     | 0 stars                                                            | survivor, not shortlisted: `.dev` taken, account held                      |
| leady    | free  | free    | User       | taken     | taken     | 0 stars                                                            | survivor, not shortlisted: `.dev` taken, sales-lead reading                |
| leadie   | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, sales-lead reading                |
| rolie    | free  | free    | User       | no record | taken     | `rolieup/rolie` 4 stars                                            | survivor, not shortlisted: account held, reads as a person                 |
| roley    | free  | free    | User       | taken     | taken     | `roleypoly/roleypoly` 45 stars                                     | survivor, not shortlisted: `.dev` taken, Discord roles                     |
| rolo     | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| cvie     | free  | free    | User       | no record | taken     | `cview` near matches, 14 stars at most                             | survivor, not shortlisted: account held, hard to say                       |
| cvy      | taken | free    | User       | no record | taken     | not searched                                                       | drop: npm taken                                                            |
| postie   | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| posty    | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| listie   | free  | free    | User       | no record | taken     | 1 star                                                             | survivor, not shortlisted: account held, shopping-list feel                |
| tallie   | free  | free    | User       | taken     | taken     | `tallier` near matches, 21 stars                                   | survivor, not shortlisted: `.dev` taken, account held                      |
| tallo    | free  | free    | User       | taken     | taken     | `basil00/Tallow` 561 stars, a near match                           | survivor, not shortlisted: `.dev` taken, account held                      |
| shortie  | free  | free    | User       | taken     | taken     | `getify/shortie.me` 12 stars                                       | survivor, not shortlisted: `.dev` taken, reads as slang                    |
| sweepy   | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| sweepie  | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, cleaning reading                  |
| workie   | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| worky    | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| hirie    | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, recruiter reading                 |
| gigly    | free  | free    | User       | taken     | taken     | `GroundworkTechnologies/Gigly` 6 stars                             | survivor, not shortlisted: `.dev` taken, gig-work reading                  |
| nudgy    | free  | free    | User       | taken     | taken     | `Hamma111/nudgy` 12 stars                                          | survivor, not shortlisted: `.dev` taken, nudging is pressure               |
| findy    | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| jobpal   | free  | free    | Org        | taken     | taken     | `Heimdall21/JobPal` 1 star; JobPal is a recruiting chatbot company | survivor, not shortlisted: `.dev` taken, a recruiting chatbot has the name |
| jobmate  | free  | free    | Org        | no record | taken     | `bnguyen212/jobmate` 5 stars                                       | survivor, not shortlisted: account held, JobMate repos                     |
| jobbud   | free  | free    | none       | no record | taken     | 0 stars; `JobBuddy` repos nearby                                   | survivor, not shortlisted: "bud" reads oddly, near JobBuddy                |
| cvpal    | free  | free    | User       | taken     | taken     | `pichenettes/cvpal` 87 stars                                       | survivor, not shortlisted: `.dev` taken, account held                      |
| cvbuddy  | free  | free    | Org        | no record | taken     | `teamorigin/cvbuddy` 2 stars                                       | survivor, not shortlisted: account held, CV-only                           |
| leadpal  | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, sales-lead reading                |
| rolepal  | free  | free    | none       | no record | taken     | `rolepaly` repos, a typo-near "roleplay"                           | **finalist**                                                               |
| leadmate | free  | free    | Org        | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, sales-lead reading                |
| rolemate | free  | free    | Org        | no record | taken     | `SiddyDevelops/RoleMate` 2 stars                                   | survivor, not shortlisted: account held                                    |
| tallypal | free  | free    | none       | no record | taken     | one repo, 0 stars                                                  | **finalist**                                                               |
| sweeppal | free  | free    | none       | no record | taken     | none found                                                         | survivor, not shortlisted: `/sweeppal:sweep` repeats itself                |
| postpal  | free  | free    | Org        | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, reads as mail                     |
| workpal  | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| workmate | taken | free    | User       | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| applypal | free  | free    | User       | no record | taken     | `NacerKROUDIR/ApplyPal` 5 stars                                    | survivor, not shortlisted: "apply" hints at auto-apply                     |
| shortpal | free  | free    | User       | no record | taken     | 2 stars                                                            | survivor, not shortlisted: account held, reads as palindrome               |
| listpal  | free  | free    | User       | no record | taken     | `aschmelyun/listpal` 40 stars                                      | survivor, not shortlisted: account held, list app                          |
| jobkit   | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| cvkit    | taken | free    | Org        | taken     | taken     | not searched                                                       | drop: npm taken                                                            |
| jobpup   | free  | free    | none       | no record | taken     | `DonCastillo/jobpup` 0 stars                                       | survivor, not shortlisted: dog-and-chase reading                           |
| jobbee   | free  | free    | Org        | no record | taken     | `ghulamabbas2/jobbee-api` 43 stars, a job board                    | survivor, not shortlisted: account held, job-board repos                   |
| jobmouse | free  | free    | none       | no record | taken     | none found                                                         | **finalist**                                                               |
| jobbird  | free  | free    | none       | no record | taken     | 0-star job-board repos                                             | survivor, not shortlisted: generic bird, job-board repos                   |
| rolebird | free  | free    | none       | no record | taken     | none found                                                         | survivor, not shortlisted: weaker job cue than jobwren                     |
| leadbird | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, sales-lead reading                |
| jobowl   | free  | free    | Org        | no record | taken     | `rekasa7000/jobowl` 1 star                                         | survivor, not shortlisted: account held                                    |
| hirowl   | free  | free    | User       | no record | no record | none found                                                         | survivor, not shortlisted: account held, reads as a typo                   |
| jobotter | free  | free    | none       | no record | taken     | none found; "otter" brings Otter.ai to mind                        | **finalist**                                                               |
| rolebee  | free  | free    | none       | no record | taken     | none found                                                         | survivor, not shortlisted: a busy bee argues against calm                  |
| leadbee  | free  | free    | User       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: account held, sales-lead reading                |
| jobwren  | free  | free    | none       | no record | taken     | none found                                                         | **finalist**                                                               |
| tallybee | free  | free    | User       | no record | taken     | `beeminder/tallybee` 1 star                                        | survivor, not shortlisted: account held                                    |
| tallypup | free  | free    | none       | no record | taken     | none found                                                         | survivor, not shortlisted: dog-and-chase reading                           |
| jobpip   | free  | free    | none       | no record | taken     | `archtechx/jobpipeline` 133 stars, a near match                    | survivor, not shortlisted: reads as pip, the Python tool                   |
| leadpip  | free  | free    | none       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: reads as a pipe, sales-lead reading             |
| rolepip  | free  | free    | none       | no record | no record | none found                                                         | survivor, not shortlisted: nonword feel, no job cue                        |
| jobnest  | free  | free    | Org        | taken     | taken     | `Shanisoni/JobNest` 7 stars                                        | survivor, not shortlisted: `.dev` taken, account held                      |
| rolenest | free  | free    | none       | no record | taken     | 0 stars                                                            | survivor, not shortlisted: a nest suggests staying put                     |
| leadnest | free  | free    | Org        | no record | taken     | `useleadnest/leadnest` 0 stars                                     | survivor, not shortlisted: account held, sales-lead reading                |
| jobtail  | free  | free    | none       | no record | taken     | `dalogax/jobtail` 2 stars                                          | survivor, not shortlisted: "tail" reads as following, near "tailor"        |
| leadtail | free  | free    | Org        | no record | taken     | `Aaryan-Codes/LeadTail` 0 stars                                    | survivor, not shortlisted: account held, sales-lead reading                |
| roletail | free  | free    | none       | no record | no record | 0 stars; near `RoleTailor` repos                                   | survivor, not shortlisted: reads as "role tailor"                          |

What the filter shows:

- **npm removes few.** 16 of 70 are taken, so 54 survive. Short
  pet-like words (`jobby`, `joby`, `postie`, `sweepy`) are mostly gone;
  compounds with a helper or creature word are mostly free.
- **`.com` is gone for most.** Only `hirowl`, `rolepip` and `roletail` have no
  `.com` record, and all three read poorly. As in earlier rounds, `.com` does
  not separate the names.
- **`.dev` has no record for 43 of 70.** Of the 54 npm
  survivors, 42 have no `.dev` record. Short diminutives are the ones that lose
  it.
- **GitHub account** is held far more often for the diminutives and pal names
  than for the creature names. The slug `andryorelabs/<name>` is free for all 70. The finalists below all have an unheld account.
- **The shortlist is small on purpose.** Names with a held account, a taken
  `.dev`, a sales-lead or recruiter reading, an "apply" cue or a hunting
  hint were set aside.

### Round 3 finalists: scored /80

Five finalists, chosen for a free npm name, slug and `.dev`, an unheld GitHub
account and a work cue, spread over the three families. Axes are the round 2
definitions: sound, registry collision, brand collision, brief fit, headroom,
warmth, overpromise risk and findability, each 0 to 10. This is directional
judgment, not a formula.

| Axis               | jobotter                                        | jobwren                                         | tallypal                                    | jobmouse                                    | rolepal                                            |
| ------------------ | ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| Sound              | 8: 8 letters, easy to say                       | 7: "wren" is short but a little odd after "job" | 8: 8 letters, easy rhythm                   | 7: 8 letters, "mouse" also means the device | 8: 7 letters, "ask rolepal" reads naturally        |
| Registry collision | 9: npm, slug, `.dev` free, no account held      | 9: npm, slug, `.dev` free, no account held      | 9: npm, slug, `.dev` free, no account held  | 9: npm, slug, `.dev` free, no account held  | 9: npm, slug, `.dev` free, no account held         |
| Brand collision    | 6: no repo, but "otter" brings Otter.ai to mind | 9: no repo or product found                     | 9: one 0-star repo                          | 8: none found, a generic animal             | 6: typo-near "roleplay", a 2336-star repo nearby   |
| Brief fit          | 5: playful, against calm and precise            | 6: a small quiet bird, careful and exact        | 6: a tally is precise, "pal" is casual      | 5: playful, a careful small creature        | 5: "pal" is casual and suggests an agent           |
| Headroom           | 4: job-bound                                    | 4: job-bound                                    | 5: a tally of anything                      | 4: job-bound                                | 5: role is broader than job                        |
| Warmth             | 10: an otter is the friendliest mark here       | 8: small and gentle, a less obvious mascot      | 9: a pal who keeps count                    | 9: a mouse is easy to draw and friendly     | 9: a pal                                           |
| Overpromise risk   | 8: nothing promised                             | 9: nothing promised                             | 7: a pal can hint at doing the work for you | 8: nothing promised                         | 6: a pal for roles can read as doing roles for you |
| Findability        | 8: "job" says it, the otter is a mnemonic       | 7: "job" says it, "wren" does not               | 6: a tally and a pal, no job cue            | 7: "job" says it, "mouse" is a mnemonic     | 7: "role" reads as job or as access roles          |
| **Total /80**      | **58**                                          | **59**                                          | **59**                                      | **57**                                      | **55**                                             |

Each total is the sum of its eight scores: jobotter 8+9+6+5+4+10+8+8 = 58,
jobwren 7+9+9+6+4+8+9+7 = 59, tallypal 8+9+9+6+5+9+7+6 = 59, jobmouse
7+9+8+5+4+9+8+7 = 57, rolepal 8+9+6+5+5+9+6+7 = 55.

Where these sit against the brief: no round 3 name scores above 6 on Brief
fit, because a cute name is not calm and precise by default. `jobwren` and
`tallypal` score 6 because a wren is small and exact and a tally is a precise
thing. The brief's personality is "precise, calm, trustworthy", with "no hype
and no exclamation marks", so a warm mascot name should be read as a trade:
more warmth and findability, less formality. Overpromise risk is where the
`-pal` and `-mate` names lose points, since a friend you ask can sound like a
friend who does it for you, and huntline's position is that you press Submit.

### Rounds 1 to 3 compared

The five round 3 finalists next to the top three of rounds 1 and 2, on the
same /80 scale.

| Rank | Name       | Round | Total /80 | Brief fit | Warmth | Findability |
| ---- | ---------- | ----- | --------- | --------- | ------ | ----------- |
| 1    | jobwren    | 3     | 59        | 6         | 8      | 7           |
| 1    | tallypal   | 3     | 59        | 6         | 9      | 6           |
| 3    | jobtally   | 2     | 58        | 7         | 6      | 9           |
| 3    | jobotter   | 3     | 58        | 5         | 10     | 8           |
| 5    | roleline   | 2     | 57        | 7         | 4      | 7           |
| 5    | jobmouse   | 3     | 57        | 5         | 9      | 7           |
| 7    | careerline | 2     | 56        | 7         | 4      | 9           |
| 8    | rolepal    | 3     | 55        | 5         | 9      | 7           |

Reading it straight:

- **The spread is narrow again.** All eight sit within 4 points, inside the
  noise of a judgment score. Treat the table as a group, not a ladder.
- **Round 3 wins on warmth and loses on brief fit.** The round 3 finalists
  average 5.4 on Brief fit and 9.0 on Warmth. The three round 2 names average
  7.0 and 4.7. The total hides that trade.
- **jobwren** has the cleanest collision profile and the best overpromise
  score, and a wren is a small, quiet mark. Its weakness is that "wren" tells a
  stranger nothing, so the slogan and README carry the meaning.
- **tallypal** continues the tally idea behind `jobtally` and `tallyline`, with
  warmth added. It has no job cue in the name and "pal" invites the "does it
  for me" reading.
- **jobotter** is the friendliest and the closest to the feel of "Jobbie". The
  otter brings Otter.ai (a note-taking product) to mind, which costs it brand
  collision points, and it has the weakest fit with the calm brief.
- **jobmouse** has an easy mark, but "mouse" also means the pointing device.
- **rolepal** lands last: it reads as "roleplay", and "pal" is the riskiest
  word on overpromise.

### Round 3 recommendation

This is input for the maintainer, who decides.

1. **If character matters most, take `jobwren`.** It is the friendliest name
   that still fits "small, quiet and exact", it has no brand collision, and it
   tops the round with `tallypal`.
2. **If a clear job cue and warmth matter most, `jobotter`** is the warmest and
   has the strongest findability, but check the Otter.ai association before
   relying on it.
3. **If the brief's calm tone matters most, round 2 still wins.** `jobtally`
   (58) has Brief fit 7 and Findability 9 against 6 and 7 for `jobwren`. A
   1-point gap is not a reason to trade fit for charm.
4. **Avoid the `-pal` and `-mate` names for the public name.** They are the
   most likely to read as a tool that acts for you, which the brief rules out.
5. **Jobbie itself stays out.** It is a live job-search product, with an
   auto-apply tone in some of its listings.
6. **Confirm before acting.** RDAP "no record" is a signal, not a quote, and
   registrations change. Re-run the table and ask a registrar before any
   rename, and search for trademarks, which this research did not do.

Nothing was bought or registered for this research.

## Round 4

Run 4 research, 2026-11-10. Status: options and a recommendation, input for
the maintainer, who decides. Nothing here is a decision, and no name is
registered, bought or renamed. Rounds 1 to 3 above are unchanged.

### What went wrong in rounds 1 to 3

The maintainer rejected all 15 finalists of rounds 1 to 3 as "too compound"
and "not memorable", and asked for a wider exploration to react to. Two
patterns explain it:

- **Compounds of job + word.** `jobtally`, `roleline`, `jobwren`, `jobotter`
  and the rest are two words stuck together. Each part is easy, but the whole
  has no shape of its own, so nothing sticks. Round 3 took "Jobbie" as a
  model and copied its job cue instead of its feel: a single short word that
  sounds like a name.
- **Names that read as technical tools.** Rounds 1 and 2 leaned on lines,
  trails and surveying, and read as infrastructure. The brief's "calm,
  precise" tone was taken as "technical", and warmth was left to round 3,
  which then lost it again by adding a job word.

Round 4 drops both. Every name is **one word, not a compound**, and a name
need not say "job": the maintainer did not ask for that. The list is sorted by
style so the maintainer can react to a style, not only to a word:

- **(a) Invented words:** short, pronounceable, no meaning to learn.
- **(b) Real words as metaphor:** a thing that finds, guides, keeps, waits or
  opens.
- **(c) Verbs:** something you would say to a friend ("I'll mosey").
- **(d) English and Spanish:** words that mean something in both languages, or
  a Spanish word that an English speaker can say.
- **(e) Very short:** 4 to 6 letters (`oru` is 3).
- **(f) Mascot or mark:** a small animal or a plain object with an easy mark.

The hard filters are unchanged: no hunting or weapon imagery, no purple,
LinkedIn-blue or Claude-orange associations, no auto-apply or "AI magic" tone,
no implication that the tool applies for the user, npm and GitHub slug free,
lowercase and CLI-friendly, and the name must read well as `/<name>:sweep`.
Nothing already in rounds 1 to 3 is proposed again. The animals are plain
generic ones, never a copy of a real person's or brand's character.

Scoring changes for this round. **Sound** now means "memorable and easy to say
aloud". **Findability** is scored honestly: a name with no job cue scores low
there, which is expected and accepted by the maintainer. That cost is paid by
the slogan and README, not the name.

### Long list by style

134 new candidates in 6 styles, each with one line on the idea. Real short
words are mostly taken on npm, so the list is wide on purpose: 57 fell at the
first check.

#### Invented words (20)

| Name   | Why it fits                               |
| ------ | ----------------------------------------- |
| zindle | A small bright sound, like a tinkle       |
| fenli  | Soft and open, two easy syllables         |
| sorli  | Warm and round, a pet-name feel           |
| plono  | Plain, calm, a little comic               |
| solva  | Hints at solving, said in two beats       |
| tandel | A tidy, made-up word with a steady rhythm |
| wickle | A small, soft thing, easy to say          |
| nuvio  | Light and open, a new view                |
| orlin  | A friendly invented first name            |
| minto  | Fresh and short, a mint-clean feel        |
| sivan  | A calm name with an even rhythm           |
| trelli | Trellis-like, something that holds a line |
| vessi  | A small vessel, softly said               |
| lorio  | Rolling, friendly vowels                  |
| pamio  | Warm, open vowels, a pal-like sound       |
| kivo   | Crisp and quick, two letters of motion    |
| tavi   | A friendly short name                     |
| orbo   | Round, a single loop                      |
| brio   | Liveliness, from music                    |
| mavi   | Soft, a small bright word                 |

#### Real words as metaphor (21)

| Name       | Why it fits                                      |
| ---------- | ------------------------------------------------ |
| fanlight   | The window over a door that lets light in        |
| lychgate   | The roofed gate where you wait before you go in  |
| doorsill   | The step you cross to go in                      |
| hearthside | Where you sit and wait for news                  |
| sedge      | A plain marsh grass that grows along a line      |
| tansy      | A small yellow wayside flower                    |
| teasel     | A spiky seed head used to raise a nap, for cloth |
| lantern    | A light you carry to see the next step           |
| beacon     | A light that marks where to go                   |
| harbor     | A safe place to come back to                     |
| porch      | Where you wait before you are let in             |
| latch      | Small, simple, opens with a lift                 |
| hinge      | What lets a door open and close                  |
| kettle     | Something you put on and wait for                |
| hearth     | The warm centre of a home                        |
| usher      | One who shows you to your seat                   |
| nook       | A snug small place                               |
| pebble     | A small smooth stone                             |
| moss       | Soft, slow and steady                            |
| acorn      | A small thing that grows                         |
| lamp       | Light on a desk                                  |

#### Verbs (18)

| Name    | Why it fits                                     |
| ------- | ----------------------------------------------- |
| unlatch | What you do to a gate you leave open            |
| mosey   | Walk slowly with no hurry                       |
| pootle  | Potter along at an easy pace                    |
| tarry   | Stay a while, no pressure                       |
| tend    | Look after a small thing                        |
| mend    | Fix a little, keep going                        |
| sift    | Sort the useful from the rest                   |
| glean   | Gather what is left in the field                |
| linger  | Stay a while longer                             |
| amble   | Walk at an easy pace                            |
| wander  | Move without a fixed path                       |
| jot     | Write a quick note                              |
| mull    | Think something over, no rush                   |
| hallar  | Spanish "to find", pronounced easily in English |
| fetch   | Bring something back for a friend               |
| ask     | The plainest verb to a friend                   |
| tidy    | Put things in order                             |
| tinker  | Fiddle with a thing until it works              |

#### English and spanish (22)

| Name    | Why it fits                                  |
| ------- | -------------------------------------------- |
| alma    | Spanish "soul", easy in English too          |
| hogar   | Spanish "home", the hearth                   |
| huella  | Spanish "a trace", "footprint"               |
| trazo   | Spanish "a stroke or line", near "trace"     |
| atajo   | Spanish "a shortcut"                         |
| abrigo  | Spanish "a shelter, a coat"                  |
| amparo  | Spanish "protection, shelter"                |
| linde   | Spanish "a boundary", near "line"            |
| etapa   | Spanish "a stage", near "step"               |
| quieto  | "Quiet" in both languages                    |
| vigia   | Spanish "a lookout", someone who keeps watch |
| cobijo  | Spanish "a shelter"                          |
| remanso | Spanish "a still pool"                       |
| vereda  | Spanish "a path"                             |
| sosiego | Spanish "calm"                               |
| fiel    | Spanish "faithful, true"                     |
| leal    | Spanish "loyal"                              |
| humilde | "Humble" in both languages                   |
| sincero | "Sincere" in both languages                  |
| sereno  | "Serene" in both languages                   |
| brujula | Spanish "compass"                            |
| cuidado | Spanish "care", "take care"                  |

#### Very short (22)

| Name | Why it fits                          |
| ---- | ------------------------------------ |
| moxa | Four letters, a pluck word           |
| noru | Four letters, a calm "nor" sound     |
| kemi | Short, a friendly first name         |
| tepi | Short and light, a tent sound        |
| sunu | Short, a sun-like echo               |
| wevi | Short, a weave sound                 |
| dexo | Short, brisk and dexterous           |
| bimi | Short, a baby-talk "bimi"            |
| wiru | Short, a thread-like "wire"          |
| zuri | Short, "beautiful" in Swahili        |
| tuli | Short, easy to say                   |
| piku | Short, a pick sound                  |
| fenn | Four letters, a fen, a wet low place |
| kuno | Short, a plain first name            |
| tavo | Short, a friendly first name         |
| oru  | Three letters, a vowel-led sound     |
| hapo | Short, a "happy" echo                |
| wimo | Short, a small bright sound          |
| ravo | Short, a cheer-like sound            |
| rilo | Short, a smooth flow                 |
| tolu | Short, a soft call                   |
| nyla | Short, a soft, rounded name          |

#### Mascot or mark (31)

| Name     | Why it fits                                   |
| -------- | --------------------------------------------- |
| hoopoe   | A crested bird, an easy crest mark            |
| dunnock  | The hedge sparrow, a quiet small bird         |
| curlew   | A bird with a curved bill, a line in the mark |
| smew     | A small duck, a clean black and white mark    |
| twite    | A small finch, an easy small mark             |
| dunlin   | A small shorebird, a calm mark                |
| wheatear | A small bird of open ground                   |
| whinchat | A small bird that perches on a post           |
| potoo    | A bird that stays very still                  |
| bushbaby | A small night animal with big eyes            |
| nuthatch | A small bird that walks down a trunk          |
| puffin   | A friendly seabird, an easy mark              |
| quokka   | A small, smiling marsupial                    |
| wombat   | A calm burrower                               |
| newt     | A small, quiet amphibian                      |
| gecko    | A small, clinging lizard                      |
| pika     | A small mountain hare cousin that stores hay  |
| marmot   | A mountain burrower that keeps watch          |
| quoll    | A small spotted marsupial                     |
| kakapo   | A round, gentle, flightless parrot            |
| numbat   | A striped marsupial, an easy stripe mark      |
| okapi    | A forest animal, a striped mark               |
| dormouse | A small sleepy mouse                          |
| vole     | A small field mouse                           |
| shrew    | A small, busy insectivore                     |
| lemur    | A ring-tailed primate, a clear mark           |
| tapir    | A calm forest animal                          |
| coati    | A long-nosed, curious animal                  |
| dugong   | A gentle sea mammal                           |
| bilby    | A long-eared marsupial                        |
| axolotl  | A smiling salamander                          |

### Availability filter

Checked 2026-11-10 with the same method as earlier rounds: `npm view <name>
name`, `gh api repos/andryorelabs/<name>`, `gh api users/<name>`, RDAP for
`.dev` (`https://pubapi.registry.google/rdap/domain/<name>.dev`) and `.com`
(`https://rdap.verisign.com/com/v1/domain/<name>.com`); `rdap.org` was not
used. Lookups ran one name at a time with a pause between calls, and a 429 was
retried after a longer pause. The `.dev` and `.com` lookups and the account
check ran only on names free on npm. Web collision is `gh search repos <name>
--match name` on every name free on npm (top result and its stars), plus a web
search on the finalists. `no record` is not a registrar quote, and `none` in
the account column means no GitHub account of that name.

| Name       | npm   | slug | account      | .dev      | .com  | Web collision                                                 | Verdict                                                                                |
| ---------- | ----- | ---- | ------------ | --------- | ----- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| zindle     | free  | free | Organization | no record | taken | `xiaopenggithub/zindle` 207 stars                             | survivor, not shortlisted: account held, well-used repo of the same name               |
| fenli      | free  | free | User         | no record | taken | `fenli/HashTagEditText` 20 stars                              | survivor, not shortlisted: account held                                                |
| sorli      | free  | free | User         | no record | taken | `gpender/sorlingas` 1 stars                                   | survivor, not shortlisted: account held                                                |
| plono      | free  | free | User         | no record | taken | `p3mxz9ght/plono` 0 stars                                     | **finalist**                                                                           |
| solva      | free  | free | User         | taken     | taken | `StreakingMan/solvable-sheep-game` 409 stars                  | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| tandel     | free  | free | User         | no record | taken | `vishalaxi-tandel/serverless-sagemaker-orchestration` 4 stars | survivor, not shortlisted: account held                                                |
| wickle     | free  | free | User         | no record | taken | `jeffgeiser/Wicklee` 2 stars                                  | survivor, not shortlisted: account held                                                |
| nuvio      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| orlin      | free  | free | User         | taken     | taken | `orlin/statica` 15 stars                                      | survivor, not shortlisted: `.dev` taken, account held                                  |
| minto      | free  | free | User         | taken     | taken | `susam/mintotp` 1402 stars                                    | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| sivan      | free  | free | User         | taken     | taken | `sivan/heti` 6752 stars                                       | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| trelli     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| vessi      | free  | free | User         | no record | taken | `dos-group/vessim` 102 stars                                  | survivor, not shortlisted: account held, well-used repo of the same name               |
| lorio      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| pamio      | free  | free | User         | no record | taken | `pamio/lob-templates` 0 stars                                 | survivor, not shortlisted: account held                                                |
| kivo       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| tavi       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| orbo       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| brio       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| mavi       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| moxa       | free  | free | User         | taken     | taken | `reidmefirst/MoxaPass` 38 stars                               | survivor, not shortlisted: `.dev` taken, account held                                  |
| noru       | free  | free | User         | taken     | taken | `ajax-lives/NoRussian` 356 stars                              | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| kemi       | free  | free | User         | taken     | taken | `kemitchell/writing.kemitchell.com` 48 stars                  | survivor, not shortlisted: `.dev` taken, account held                                  |
| tepi       | free  | free | User         | taken     | taken | `tepi/FilteringTable` 46 stars                                | survivor, not shortlisted: `.dev` taken, account held                                  |
| sunu       | free  | free | User         | taken     | taken | `Sunnshino/sunui-upimg` 157 stars                             | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| wevi       | free  | free | none         | no record | taken | `Tencent/WeVisOne-VL` 1136 stars                              | survivor, not shortlisted: well-used repo of the same name                             |
| dexo       | free  | free | User         | taken     | taken | `dexonline/dexonline` 248 stars                               | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| bimi       | free  | free | Organization | taken     | taken | `NiWeiNi/BIMiconToolbar` 61 stars                             | survivor, not shortlisted: `.dev` taken, account held                                  |
| wiru       | free  | free | User         | no record | taken | `suissa/wiru` 14 stars                                        | **finalist**                                                                           |
| zuri       | free  | free | Organization | taken     | taken | `adrische/quant-jobs-zurich` 289 stars                        | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| tuli       | free  | free | User         | taken     | taken | `shorepine/tulipcc` 981 stars                                 | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| piku       | free  | free | Organization | taken     | taken | `piku/piku` 6607 stars                                        | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| fenn       | free  | free | User         | taken     | taken | `bakpakin/Fennel` 2765 stars                                  | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| kuno       | free  | free | User         | taken     | taken | `kuno/GeoIP` 416 stars                                        | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| tavo       | free  | free | User         | taken     | taken | `Tavotto/Tavotto` 693 stars                                   | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| oru        | free  | free | User         | no record | taken | `oruga-ui/oruga` 1163 stars                                   | survivor, not shortlisted: account held, well-used repo of the same name               |
| hapo       | free  | free | User         | taken     | taken | `danarashed73kk-coder/hapora-enhancement` 149 stars           | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| wimo       | free  | free | User         | taken     | taken | `wimoor-erp/wimoor` 1391 stars                                | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| ravo       | free  | free | User         | taken     | taken | `ravenprotocol/ravop` 9 stars                                 | survivor, not shortlisted: `.dev` taken, account held                                  |
| rilo       | free  | free | User         | taken     | taken | `tubalmartin/riloadr` 642 stars                               | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| tolu       | free  | free | User         | taken     | taken | `topameng/tolua` 3066 stars                                   | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| nyla       | free  | free | User         | taken     | taken | `nylas/nylas-mail` 24727 stars                                | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| unlatch    | free  | free | User         | taken     | taken | `Narden91/unlatched` 3 stars                                  | survivor, not shortlisted: `.dev` taken, account held                                  |
| mosey      | free  | free | User         | taken     | taken | `thelok1s/mosey-extended` 153 stars                           | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| pootle     | free  | free | User         | no record | taken | `translate/pootle` 1502 stars                                 | **finalist**                                                                           |
| tarry      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| tend       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| mend       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| sift       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| glean      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| linger     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| amble      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| wander     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| jot        | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| mull       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| hallar     | free  | free | User         | no record | taken | `edannas/HALLaR` 3 stars                                      | survivor, not shortlisted: account held                                                |
| fetch      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| ask        | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| tidy       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| tinker     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| fanlight   | free  | free | User         | no record | taken | `Hanbyori/Unity_Fanlight` 39 stars                            | **finalist**                                                                           |
| lychgate   | free  | free | User         | no record | taken | `Richmond-Grey/lychgate` 0 stars                              | **finalist**                                                                           |
| doorsill   | free  | free | User         | no record | taken | none found                                                    | survivor, not shortlisted: account held                                                |
| hearthside | free  | free | Organization | taken     | taken | `naomiHauret/hearthside-hangouts` 2 stars                     | survivor, not shortlisted: `.dev` taken, account held                                  |
| sedge      | free  | free | User         | taken     | taken | `aistrate/AlgorithmsSedgewick` 2748 stars                     | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| tansy      | free  | free | User         | taken     | taken | `QTqingtan/tansyqinyrproj` 11 stars                           | survivor, not shortlisted: `.dev` taken, account held                                  |
| teasel     | free  | free | User         | taken     | taken | `tjdevWorks/TEASEL` 26 stars                                  | survivor, not shortlisted: `.dev` taken, account held                                  |
| lantern    | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| beacon     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| harbor     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| porch      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| latch      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| hinge      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| kettle     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| hearth     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| usher      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| nook       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| pebble     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| moss       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| acorn      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| lamp       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| alma       | free  | free | Organization | taken     | taken | `marchof/java-almanac` 1149 stars                             | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| hogar      | free  | free | User         | no record | taken | `leonjza/hogar` 52 stars                                      | survivor, not shortlisted: account held                                                |
| huella     | free  | free | User         | taken     | taken | `ayudadigital/huelladigital-backend` 8 stars                  | survivor, not shortlisted: `.dev` taken, account held                                  |
| trazo      | free  | free | User         | taken     | taken | `PhenX/Trazor` 76 stars                                       | survivor, not shortlisted: `.dev` taken, account held                                  |
| atajo      | free  | free | Organization | taken     | taken | `ulymay/atajosEclipse.textile` 7 stars                        | survivor, not shortlisted: `.dev` taken, account held                                  |
| abrigo     | free  | free | User         | taken     | taken | `luisparravicini/abrigo-pinos` 6 stars                        | survivor, not shortlisted: `.dev` taken, account held                                  |
| amparo     | free  | free | User         | taken     | taken | `mayerstrk/amparo-fastify-deprecated-` 7 stars                | survivor, not shortlisted: `.dev` taken, account held                                  |
| linde      | free  | free | User         | taken     | taken | `lindera/lindera` 707 stars                                   | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| etapa      | free  | free | User         | no record | taken | `CristiannGuerra/Informatorio-Etapa-1` 14 stars               | survivor, not shortlisted: account held                                                |
| quieto     | free  | free | User         | taken     | taken | `sachaservan/QuietOT` 7 stars                                 | survivor, not shortlisted: `.dev` taken, account held                                  |
| vigia      | free  | free | User         | taken     | taken | `nogates/vigia` 95 stars                                      | survivor, not shortlisted: `.dev` taken, account held                                  |
| cobijo     | free  | free | none         | no record | taken | `abelSotillos/oca-cobijo` 1 stars                             | **finalist**                                                                           |
| remanso    | free  | free | User         | no record | taken | `remansolution/remansolution` 4 stars                         | survivor, not shortlisted: account held                                                |
| vereda     | free  | free | User         | taken     | taken | `BielVereda/BielVereda` 7 stars                               | survivor, not shortlisted: `.dev` taken, account held                                  |
| sosiego    | free  | free | User         | no record | taken | `sosiego1/sosiego` 0 stars                                    | survivor, not shortlisted: account held                                                |
| fiel       | free  | free | User         | taken     | taken | `halfrost/Halfrost-Field` 13253 stars                         | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| leal       | free  | free | User         | taken     | taken | `lealone/Lealone` 2591 stars                                  | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| humilde    | free  | free | User         | no record | taken | `ricardorifli/humilde` 1 stars                                | survivor, not shortlisted: account held                                                |
| sincero    | free  | free | User         | no record | taken | `PedroSincero/PedroSincero` 3 stars                           | survivor, not shortlisted: account held                                                |
| sereno     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| brujula    | free  | free | User         | no record | taken | `nogates/brujula` 6 stars                                     | survivor, not shortlisted: account held                                                |
| cuidado    | free  | free | User         | no record | taken | `Thyale/CuidadoPet` 7 stars                                   | survivor, not shortlisted: account held                                                |
| hoopoe     | free  | free | User         | taken     | taken | `axol8002/hoopoe-player` 11 stars                             | survivor, not shortlisted: `.dev` taken, account held                                  |
| dunnock    | free  | free | User         | no record | taken | `dunnock/react-sigma` 265 stars                               | **finalist**                                                                           |
| curlew     | free  | free | User         | taken     | taken | `chamfay/Curlew` 64 stars                                     | survivor, not shortlisted: `.dev` taken, account held                                  |
| smew       | free  | free | Organization | taken     | taken | `smew-tech/public-apis` 280 stars                             | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| twite      | free  | free | none         | no record | taken | `Robert-Stackflow/Twitee` 45 stars                            | **finalist**                                                                           |
| dunlin     | free  | free | Organization | taken     | taken | `fluidself/dunlin` 19 stars                                   | survivor, not shortlisted: `.dev` taken, account held                                  |
| wheatear   | free  | free | User         | taken     | taken | `akshay-eng/Wheatear` 3 stars                                 | survivor, not shortlisted: `.dev` taken, account held                                  |
| whinchat   | free  | free | User         | no record | taken | `ehdrjs0110/Whinchat` 0 stars                                 | survivor, not shortlisted: account held                                                |
| potoo      | free  | free | User         | taken     | taken | `MichaelChirico/potools` 63 stars                             | survivor, not shortlisted: `.dev` taken, account held                                  |
| bushbaby   | free  | free | Organization | taken     | taken | `bushbaby/BsbFlysystem` 37 stars                              | survivor, not shortlisted: `.dev` taken, account held                                  |
| nuthatch   | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| puffin     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| quokka     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| wombat     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| newt       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| gecko      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| pika       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| marmot     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| quoll      | free  | free | User         | taken     | taken | `quoll/asami` 360 stars                                       | survivor, not shortlisted: `.dev` taken, account held, well-used repo of the same name |
| kakapo     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| numbat     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| okapi      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| dormouse   | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| vole       | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| shrew      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| lemur      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| tapir      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| coati      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| dugong     | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| bilby      | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |
| axolotl    | taken | -    | -            | -         | -     | not searched                                                  | drop: npm taken                                                                        |

What the filter shows:

- **npm removes 57 of 134, so 77 survive.** Short everyday words (`lantern`,
  `beacon`, `porch`, `pika`, `newt`, `puffin`) are almost all gone; rare
  words, Spanish words and invented words mostly survive. Every one of the 77
  has a free `andryorelabs/<name>` slug.
- **`.com` is gone for all 77.** No survivor has a `.com` without a record. As
  in earlier rounds, `.com` does not separate the names.
- **`.dev` has no record for 28 of the 77.** Short invented names lose it
  most often.
- **A held GitHub account is the norm.** Only 3 of the 77 (`wevi`, `cobijo`,
  `twite`) have no account of that name. Earlier rounds used an unheld account
  as a shortlist condition; with single words that would leave almost nothing.
  Round 4 keeps the hard filter (npm and slug free) and treats a held account
  as a cost on the Registry axis, lower when the account is idle and higher
  when it is a real project.
- **Collision is a near-name problem.** `wevi` sits next to `WeVisOne` and the
  We-Vibe brand, `pootle` is a 1502-star translation tool, `zindle` has a
  207-star repo, and `oru` sits next to the Oruga UI library.
- **The shortlist** picks 8 names with a free npm name and slug, mostly a free
  `.dev`, a calm reading, no brand owning the word, and at least one per
  style. Names with a well-known owner or a hard-to-say shape were set aside.

### Round 4 finalists: scored /80

Eight finalists, at least one per style: `plono` (a), `fanlight` and
`lychgate` (b), `pootle` (c), `cobijo` (d), `wiru` (e), `twite` and `dunnock`
(f). Axes are the round 2 definitions (sound, registry collision, brand
collision, brief fit, headroom, warmth, overpromise risk, findability, each 0
to 10), except Sound is "memorable and easy to say aloud". This is directional
judgment, not a formula.

Web search on the finalists found no software product of the same name for
`plono`, `lychgate`, `twite`, `cobijo`, `dunnock` or `wiru` (the nearest hits
were `Plano`, `LitiGate`, Twitter clients, `Cobiro`, `Wayru`). `fanlight`
belongs to Fanlight Sync and Fanlight Link, two ceiling-fan control apps.
`pootle` is the open-source translation system Pootle (2004, on PyPI). A UK
trademark application for `remanso` in class 9 (software) is why it was not
shortlisted.

| Axis               | plono                                | fanlight                              | lychgate                                 | pootle                                  | cobijo                                         | wiru                                 | twite                                      | dunnock                                   |
| ------------------ | ------------------------------------ | ------------------------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| Sound              | 6: easy, but flat and hard to recall | 8: two clear beats, a real word       | 5: "lych" is an odd start                | 9: bouncy, hard to forget               | 7: three soft syllables, stress needs learning | 7: two easy syllables                | 6: reads as "twit" or a Twitter typo       | 8: two firm syllables, a real bird        |
| Registry collision | 8: npm, slug, `.dev` free, idle user | 8: npm, slug, `.dev` free, idle user  | 8: npm, slug, `.dev` free, idle user     | 8: npm, slug, `.dev` free, idle user    | 9: npm, slug, `.dev` free, no account held     | 8: npm, slug, `.dev` free, idle user | 9: npm, slug, `.dev` free, no account held | 6: free, but the account has active repos |
| Brand collision    | 8: 0-star repos, no product found    | 6: two fan-control apps with the word | 9: no product, only a 0-star repo        | 3: a 1502-star translation tool owns it | 8: small repos, no product found               | 7: 14-star API repos, `Wayru` nearby | 5: Twitter-adjacent, no product            | 6: a 265-star repo under the account      |
| Brief fit          | 6: neutral, neither calm nor loud    | 7: a window that lets light in, calm  | 8: a gate where you wait, calm and exact | 4: silly, against "precise"             | 8: a shelter, calm and trustworthy             | 5: neutral                           | 6: small and plain                         | 8: a quiet, plain bird, unassuming        |
| Headroom           | 9: means nothing, can grow anywhere  | 8: not job-bound                      | 9: not job-bound                         | 9: not job-bound                        | 9: not job-bound                               | 10: means nothing                    | 9: not job-bound                           | 9: not job-bound                          |
| Warmth             | 6: friendly sound, no image          | 7: light and a door                   | 5: old and formal                        | 10: the friendliest word in the list    | 9: a shelter, the most human meaning           | 5: neutral                           | 8: a small finch, an easy mark             | 8: a small brown bird, an easy mark       |
| Overpromise risk   | 10: nothing promised                 | 10: nothing promised                  | 10: nothing promised                     | 10: nothing promised                    | 9: shelter hints at safety, not at acting      | 10: nothing promised                 | 10: nothing promised                       | 10: nothing promised                      |
| Findability        | 2: no cue                            | 2: no cue, and fan hardware           | 2: no cue                                | 2: no cue                               | 2: no cue, Spanish only                        | 1: no cue, not a word                | 2: no cue                                  | 2: no cue                                 |
| **Total /80**      | **55**                               | **56**                                | **56**                                   | **55**                                  | **61**                                         | **53**                               | **55**                                     | **57**                                    |

Each total is the sum of its eight scores: plono 6+8+8+6+9+6+10+2 = 55,
fanlight 8+8+6+7+8+7+10+2 = 56, lychgate 5+8+9+8+9+5+10+2 = 56, pootle
9+8+3+4+9+10+10+2 = 55, cobijo 7+9+8+8+9+9+9+2 = 61, wiru 7+8+7+5+10+5+10+1 =
53, twite 6+9+5+6+9+8+10+2 = 55, dunnock 8+6+6+8+9+8+10+2 = 57.

Findability is 1 or 2 for every finalist, as expected: none says "job". It is
the cost of leaving compounds behind, and the totals above are comparable
with the earlier rounds only with that in mind. The top 3 of earlier rounds
averaged 7.3 on Findability against 1.9 here.

### Rounds 1 to 4 compared

The round 4 finalists next to the top 3 of rounds 1 to 3, on the same /80
scale. The Sound axis is scored differently in round 4 (memorable and easy to
say, not only easy to say).

| Rank | Name     | Round | Total /80 | Brief fit | Warmth | Findability |
| ---- | -------- | ----- | --------- | --------- | ------ | ----------- |
| 1    | cobijo   | 4     | 61        | 8         | 9      | 2           |
| 2    | jobwren  | 3     | 59        | 6         | 8      | 7           |
| 2    | tallypal | 3     | 59        | 6         | 9      | 6           |
| 4    | jobtally | 2     | 58        | 7         | 6      | 9           |
| 5    | dunnock  | 4     | 57        | 8         | 8      | 2           |
| 6    | fanlight | 4     | 56        | 7         | 7      | 2           |
| 6    | lychgate | 4     | 56        | 8         | 5      | 2           |
| 8    | plono    | 4     | 55        | 6         | 6      | 2           |
| 8    | pootle   | 4     | 55        | 4         | 10     | 2           |
| 8    | twite    | 4     | 55        | 6         | 8      | 2           |
| 11   | wiru     | 4     | 53        | 5         | 5      | 1           |

Reading it straight:

- **The spread is narrow again.** Eleven names sit within 8 points, inside the
  noise of a judgment score. Treat the table as a group, not a ladder.
- **Round 4 wins on Brief fit and loses on Findability.** `cobijo`, `dunnock`
  and `lychgate` match the calm, plain brief better than any round 3 name,
  because real words about shelter, gates and quiet birds are calm by default.
  They give up the job cue entirely.
- **cobijo** is the best balance: Spanish for "shelter", so a plain, warm
  image of a place to keep things safe, which matches a local-first tool that
  keeps the user's data in a directory they own. English speakers get a
  pleasant sound and no meaning, and a Spanish speaker gets the meaning at
  once. It reads well as `/cobijo:sweep`.
- **dunnock** is the best mascot option: a quiet, plain, common bird. Its
  cost is a GitHub account that holds real projects.
- **pootle** is the warmest and the most memorable, and the nearest in feel to
  "Jobbie". A well-used translation tool already owns the word, and it is the
  least calm.
- **lychgate** has the best metaphor (a place you wait before you go in, which
  fits "you press Submit") and the weakest sound.
- **plono and wiru** are the invented-word and short-name picks. Neither has
  an image, and they score no better than the real words.

### Round 4 recommendation

This is input for the maintainer, who decides.

1. **If the maintainer wants a single, warm word with a calm meaning, take
   `cobijo`.** It leads the round on total and on collision profile (no
   account held, `.dev` free, no product found). Its weakness is that the
   meaning is Spanish only. A 2-point lead is noise, so react to the style,
   not the number.
2. **If a mascot matters most, `dunnock`.** It is the best of the mascot
   names on brief fit. Check the existing `dunnock` GitHub account before
   relying on it.
3. **If a metaphor for the "you press Submit" position matters most,
   `lychgate`**, at the cost of an awkward first syllable.
4. **Avoid `pootle` for the public name.** It has the best feel, but an
   established tool owns the word.
5. **Say which styles appeal, then iterate.** The useful reaction is "more
   like `cobijo`" or "more like `dunnock`": a round 5 can stay inside one or
   two styles (Spanish words, or small birds) and go deeper, with a wider list
   of rare words, which survive npm far more often than common ones.
6. **Findability is the open cost.** Every round 4 name needs the slogan or
   README to say what it is. The maintainer has accepted that trade, and it is
   named here so it is not a surprise later.
7. **Confirm before acting.** RDAP "no record" is a signal, not a quote, and
   registrations change. Re-run the table and ask a registrar before any
   rename, and search for trademarks, which this research did not do beyond
   what the web search surfaced.

Nothing was bought or registered for this research.

## Round 5

Run 5 research, 2026-11-10. Status: options and a recommendation, input for
the maintainer, who decides. Nothing here is a decision, and no name is
registered, bought or renamed. Rounds 1 to 4 above are unchanged.

### What round 4 got wrong

Round 4 read the maintainer's "too compound" as "drop the job cue", and left
it out. That was the wrong half to keep. The maintainer wants both: a single
word that is not a compound, and a name that a stranger ties to jobs, because
"if the name has nothing to do with jobs, it is harder to find". Every round 4
finalist scored 1 or 2 on Findability, and the round 4 text called it an
accepted cost. It was not accepted, and it should have been asked about first.

The feel to copy is `jobbie`: short, friendly, one word, tied to jobs.
`jobbie` and its close variants `jobby`, `jobbit`, `jobsy` and `joby` are taken
(see "What Jobbie is" in round 3), so this round looks for the same feel with
a free name. The job cue is the main requirement of this round, ahead of
warmth and calm.

### The rule

A name enters the finalists only if both parts hold:

1. **One word.** Not job + word stuck together (`jobtally`, `jobwren`). A
   suffix that makes a small friendly form (`jobling`, `jobkin`) counts as one
   word, because the suffix carries no meaning of its own. Two real words
   stuck together does not.
2. **A stranger connects it to jobs.** Someone who reads the name, with no
   explanation, thinks of jobs, work, hiring, careers or applying.
   **Findability below 7 is cut before the finalists.**

The hard filters are unchanged: no hunting or weapon imagery, no purple,
LinkedIn-blue or Claude-orange associations, no auto-apply or "AI magic" tone,
no implication that the tool applies for the user, npm and GitHub slug free,
lowercase and CLI-friendly, and the name must read well as `/<name>:sweep`.
Nothing already in rounds 1 to 4 is proposed again. Scoring uses the same 8
axes out of 80 as round 4, with Sound as "memorable and easy to say aloud" and
Findability scored honestly.

### Long list by style

162 new candidates in 6 styles, each with one line on the idea. Job roots used:
job, work, hire, career, role, gig, shift, craft, post, offer, apply, lead,
resume, CV, opening, vacancy. Short job words are mostly taken on npm, so the
list is wide on purpose: 67 fell at the first check. A name is listed once,
under its main style. The style tags in the finalists are the main style, and
the tag of a name can overlap with another (`jobling` is also a creature mark,
`hiret` is also five letters).

#### (a) Diminutives and friendly forms of a job root (32)

| Name     | Why it fits                                       |
| -------- | ------------------------------------------------- |
| jobkin   | Job plus the "-kin" of a small thing, like napkin |
| jobette  | A small, light job word, "-ette" like kitchenette |
| jobley   | A friendly first-name shape, like Barley          |
| jobsie   | A pet-name for jobs, in the spirit of Jobbie      |
| jobbly   | A playful, rolling job word                       |
| joblet   | A small job, a real word in print shops           |
| hirey    | Short and chatty, "hire" with a smile             |
| hirely   | Hire plus "-ly", easy and open                    |
| hirelet  | A little hire, soft and small                     |
| hirelin  | Hire plus "-lin", near "hireling" (a poor tone)   |
| hirelo   | Hire plus a friendly "-lo"                        |
| workette | A small, light work word                          |
| careery  | Career with a soft tail                           |
| careerie | Career as a pet name                              |
| resumey  | Resume with a friendly tail                       |
| gigling  | A small gig, a giggle inside                      |
| gigsy    | A gig pet name                                    |
| gigsie   | A gig pet name, softer                            |
| gigette  | A little gig                                      |
| giggy    | A playful gig word                                |
| applie   | Apply as a pet name                               |
| appley   | Apply with a friendly tail, also reads as apple   |
| cvee     | CV said aloud, with a tail                        |
| offerie  | Offer as a pet name                               |
| vacky    | A vacancy, said in a friendly way                 |
| postlet  | A small post (job post)                           |
| shiftie  | A friendly shift word                             |
| craftie  | Craft as a pet name                               |
| rolly    | A role, rolling and friendly                      |
| openie   | An opening, as a pet name                         |
| jobee    | Job plus bee, a busy worker                       |
| worklet  | A small piece of work                             |

#### (b) Invented words built from job roots (35)

| Name    | Why it fits                                                   |
| ------- | ------------------------------------------------------------- |
| jobiva  | Job plus a soft "-iva", a made-up brand shape                 |
| careva  | Career, shortened and softened                                |
| kareer  | Career with a hard K, one syllable shorter                    |
| resuma  | Resume as a made-up word                                      |
| resumo  | Resume with an open "-o" (resumo means summary in Portuguese) |
| hirio   | Hire with an "-io" tail, light and open                       |
| hireva  | Hire with a soft "-va" tail                                   |
| hirevo  | Hire with a crisp "-vo" tail                                  |
| workvia | Work plus "via", a route to work                              |
| vacanta | Vacancy with a Latin tail                                     |
| hyre    | Hire spelled the short way                                    |
| hyrel   | Hyre plus "-el", a small name                                 |
| hirra   | Hire with a rolled tail                                       |
| cvio    | CV plus "-io", short and tidy                                 |
| applio  | Apply with an "-io" tail                                      |
| applyo  | Apply with an "o", easy to say                                |
| caree   | Career cut short                                              |
| empla   | Employ cut short, near the Spanish "emplear"                  |
| offra   | Offer cut short                                               |
| roleo   | Role with an "-eo" tail                                       |
| rolio   | Role with an "-io" tail                                       |
| postio  | Post with an "-io" tail                                       |
| shifto  | Shift with an "-o" tail                                       |
| shiftra | Shift with an "-ra" tail                                      |
| gigra   | Gig with an "-ra" tail                                        |
| leado   | Lead (a sales lead) with an "-o" tail                         |
| worka   | Work with an "-a" tail                                        |
| workly  | Work plus "-ly"                                               |
| vaca    | Vacancy cut short                                             |
| jobi    | Job with an "i", short                                        |
| joba    | Job with an "a", short                                        |
| jobly   | Job plus "-ly"                                                |
| gigo    | Gig with an "o"                                               |
| craftly | Craft plus "-ly"                                              |
| openo   | Opening with an "o"                                           |

#### (c) Real words and slang for a job or a search for one, English and Spanish (36)

Includes Mexican, Colombian, Costa Rican, Chilean, Brazilian and Spanish slang
for a job (`chamba`, `jale`, `brete`, `camello`, `pega`, `curro`, `trampo`,
`bico`) and words that work in both languages (`empleo`, `vacante`,
`candidato`, `oferta`, `vocation`).

| Name       | Why it fits                                         |
| ---------- | --------------------------------------------------- |
| empleo     | Spanish "employment"; English readers hear "employ" |
| vacante    | Spanish "vacancy"; English readers hear "vacant"    |
| vacancy    | A job opening in English, but also a hotel sign     |
| candidato  | Spanish "candidate", also read as a political one   |
| postular   | Spanish "to apply for a post"                       |
| vocation   | A calling, English                                  |
| chambita   | Mexican diminutive of "chamba", a small job         |
| contrata   | Spanish "hires" or "contract"                       |
| oficio     | Spanish trade or craft                              |
| chambear   | Mexican "to work"                                   |
| puesto     | Spanish "post" or "position"                        |
| oferta     | Spanish "offer"                                     |
| metier     | French "trade", used in English                     |
| laburo     | Rioplatense slang for a job                         |
| turno      | Spanish "shift"                                     |
| bico       | Brazilian Portuguese slang for a side job           |
| currela    | Spanish slang for a job                             |
| brete      | Costa Rican slang for a job                         |
| camello    | Colombian slang for a job, also a camel             |
| tajo       | Spanish slang for work, also a cut                  |
| chamba     | Mexican slang for a job                             |
| talento    | Spanish "talent"                                    |
| curro      | Spanish slang for a job                             |
| pega       | Chilean slang for a job                             |
| jale       | Mexican slang for a job                             |
| trampo     | Brazilian slang for work                            |
| plaza      | Spanish "position" in a team                        |
| trabajo    | Spanish "work"                                      |
| oficina    | Spanish "office"                                    |
| rol        | Spanish "role"                                      |
| curriculum | The CV as a whole word                              |
| graft      | British slang for hard work                         |
| billet     | A post or lodging                                   |
| stint      | A spell of work                                     |
| berth      | A job, a ship's place                               |
| calling    | A vocation                                          |

#### (d) Short verbs and nouns about getting hired (25)

| Name       | Why it fits                                      |
| ---------- | ------------------------------------------------ |
| hirable    | One who can be hired, from the job seeker's side |
| hired      | The result, said plainly                         |
| employable | Fit to be hired, a plain real word               |
| hiret      | "Hire it", short and active                      |
| takeon     | To take someone on                               |
| offered    | What a job seeker hopes to hear                  |
| hire       | The plain verb                                   |
| land       | To land a job                                    |
| snag       | To snag a role                                   |
| pitch      | To pitch for a role                              |
| lineup     | To line up interviews                            |
| onboard    | To start a new job                               |
| enlist     | To sign up                                       |
| secure     | To secure a role                                 |
| nab        | To nab a job                                     |
| clinch     | To clinch an offer                               |
| callback   | The call back after an interview                 |
| referral   | A way in through a person                        |
| vouch      | Someone speaks for you                           |
| intro      | An introduction to a hirer                       |
| engage     | To be engaged by a team                          |
| recruit    | To be recruited                                  |
| sign       | To sign a contract                               |
| book       | To book an interview                             |
| accepted   | An offer accepted                                |

#### (e) Very short, 4 to 6 letters, with a job cue (13)

Many names in other styles are also 4 to 6 letters (`jobkin`, `hirey`,
`hiret`, `jobu`). This list holds the names whose main idea is the short
shape.

| Name    | Why it fits                               |
| ------- | ----------------------------------------- |
| jobu    | Job in four letters, said "joe-boo"       |
| hirer   | The employer side of a hire, five letters |
| careo   | Career in five letters                    |
| gig     | A short job                               |
| jobs    | The plain plural                          |
| wrkr    | Worker without vowels                     |
| post    | A job post                                |
| shift   | A work shift                              |
| craft   | A trade                                   |
| apply   | To apply                                  |
| role    | A role                                    |
| work    | Work                                      |
| opening | An opening                                |

#### (f) Easy mascot or mark, with a job cue (21)

Plain generic creatures and objects only, never a copy of a real brand's
character. Names that are two words stuck together (`hirebee`, `jobeaver`,
`workant`, `gigant`) are listed because they came up, and fail the rule.

| Name      | Why it fits                                              |
| --------- | -------------------------------------------------------- |
| jobling   | A little job creature; "-ling" makes it a pet, easy mark |
| workling  | A small worker, a tidy creature                          |
| jobin     | Job plus robin, a small bird mark                        |
| hirin     | "Hirin'", the sign on the door, dropped g                |
| gigant    | Gig plus ant, a busy worker (a compound, so cut)         |
| workant   | Worker ant (a compound, so cut)                          |
| hirebee   | Busy bee that hires (a compound, so cut)                 |
| jobeaver  | Job plus beaver, the busy builder (a compound, so cut)   |
| deskie    | A friendly desk, a small square mark                     |
| badgie    | An ID badge as a mark                                    |
| briefy    | A briefcase, a plain rectangle mark                      |
| tieclip   | A tie clip as a mark                                     |
| rung      | A ladder rung, a career step                             |
| ladder    | The career ladder as a plain mark                        |
| hardhat   | A hard hat, a work icon                                  |
| lunchbox  | A lunchbox, a work icon                                  |
| nametag   | A name tag, a hello-my-name-is mark                      |
| stapler   | A desk stapler, a work icon                              |
| punchcard | A punch card, a clock-in mark                            |
| timecard  | A timecard, a work-hours mark                            |
| clocky    | A little clock, clock-in feel                            |

### Availability filter

Checked 2026-11-10 with the same method as earlier rounds: `npm view <name>
name`, `gh api repos/andryorelabs/<name>`, `gh api users/<name>`, RDAP for
`.dev` (`https://pubapi.registry.google/rdap/domain/<name>.dev`) and `.com`
(`https://rdap.verisign.com/com/v1/domain/<name>.com`); `rdap.org` was not
used. Lookups ran one name at a time with a pause between calls, and no 429
came back. A "free" npm result was confirmed as a 404 (E404) from the registry,
not just a failed command. The slug, account, `.dev` and `.com` lookups ran
only on names free on npm. Web collision is `gh search repos <name> --match
name` on every name free on npm that also reached Findability 7, plus a web
search on the finalists. `no record` is not a registrar quote, and `none` in
the account column means no GitHub account of that name. `gh search` is fuzzy,
so the top hit shown is the nearest repo, not always an exact match.

**67 of the 162 names are taken on npm and drop at once:** accepted, apply,
berth, billet, book, callback, calling, chamba, clinch, clocky, craft,
craftly, curriculum, curro, engage, enlist, gig, gigo, graft, hardhat, hire,
intro, jale, joba, jobee, jobi, jobly, jobs, ladder, land, lineup, lunchbox,
nab, nametag, oficina, onboard, openie, opening, openo, pega, pitch, plaza,
post, punchcard, recruit, referral, rol, role, rolly, rung, secure, shift,
sign, snag, stapler, stint, talento, timecard, trabajo, trampo, vaca, vouch,
work, worka, worklet, workly, wrkr. Almost every plain job word is gone,
including `hire`, `work`, `gig`, `chamba` and `talento`.

The other 95 passed npm and the GitHub slug (all 95 slugs are free). All 95
`.com` names are taken, so `.com` does not separate them; 62 have no `.dev`
record and 13 have no GitHub account of that name.

| Name       | npm  | slug | account      | .dev      | .com  | Web collision                             | Findability | Verdict                                                                                                                   |
| ---------- | ---- | ---- | ------------ | --------- | ----- | ----------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| appley     | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| applie     | free | free | User         | taken     | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| applio     | free | free | User         | taken     | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| applyo     | free | free | Organization | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| badgie     | free | free | User         | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| bico       | free | free | Organization | taken     | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| brete      | free | free | User         | no record | taken | not searched                              | 2           | cut: Findability 2                                                                                                        |
| briefy     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| camello    | free | free | User         | no record | taken | not searched                              | 2           | cut: Findability 2                                                                                                        |
| candidato  | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| caree      | free | free | User         | taken     | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| careerie   | free | free | none         | no record | taken | `nassdk/careeriest 0`                     | 8           | **finalist**                                                                                                              |
| careery    | free | free | none         | no record | taken | `5rodina/Careery 1`                       | 8           | survivor, not shortlisted: an AI career agent called Careery is listed online                                             |
| careo      | free | free | User         | taken     | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| careva     | free | free | User         | no record | taken | `carevalojesus/carevalojesus 11`          | 7           | survivor, not shortlisted: account held                                                                                   |
| chambear   | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| chambita   | free | free | User         | no record | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| contrata   | free | free | User         | taken     | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| craftie    | free | free | Organization | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| currela    | free | free | User         | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| cvee       | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| cvio       | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| deskie     | free | free | User         | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| empla      | free | free | Organization | no record | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| empleo     | free | free | Organization | taken     | taken | `developersdo/empleo-dot-net 209`         | 7           | **finalist**                                                                                                              |
| employable | free | free | Organization | taken     | taken | `jshamley/employable 2`                   | 8           | survivor, not shortlisted: .dev taken, account held                                                                       |
| gigant     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| gigette    | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| giggy      | free | free | Organization | taken     | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| gigling    | free | free | none         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| gigra      | free | free | User         | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| gigsie     | free | free | none         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| gigsy      | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| hirable    | free | free | User         | taken     | taken | `SumeetWajpe/XT_Hirable_Jan2022 3`        | 8           | survivor, not shortlisted: several products named Hirable (an AI career assistant, a hospitality hiring app, HR software) |
| hirebee    | free | free | User         | no record | taken | not searched                              | 8           | cut: compound (hire + bee)                                                                                                |
| hired      | free | free | User         | taken     | taken | `redis/hiredis 6692`                      | 8           | survivor, not shortlisted: redis/hiredis 6692 stars sits next to it, and "Hired" is a known hiring marketplace            |
| hirelet    | free | free | none         | no record | taken | `ramyaspov/hireLetter 0`                  | 8           | **finalist**                                                                                                              |
| hirelin    | free | free | Organization | no record | taken | `Zaphodious/hireling 12`                  | 7           | survivor, not shortlisted: sits next to "hireling", a word with a poor tone                                               |
| hirelo     | free | free | User         | no record | taken | `sibisiddharth8/HireLogic 13`             | 8           | survivor, not shortlisted: account held                                                                                   |
| hirely     | free | free | Organization | taken     | taken | `KareemSultanOfficial/Hirely 36`          | 8           | survivor, not shortlisted: .dev taken, account held                                                                       |
| hirer      | free | free | User         | no record | taken | `edlynjessica/HireReady 11`               | 8           | survivor, not shortlisted: the word means the employer, so it points at the wrong side                                    |
| hiret      | free | free | User         | no record | taken | `rajayogan/flutterui-hiretalent 81`       | 7           | **finalist**                                                                                                              |
| hireva     | free | free | User         | no record | taken | `netstaffle-tech/HireVault 1`             | 7           | survivor, not shortlisted: reads as HireVault or a hiring firm name                                                       |
| hirevo     | free | free | User         | no record | taken | `Hirevo/alexandrie 517`                   | 7           | survivor, not shortlisted: the Hirevo account owns a 517-star repo                                                        |
| hirey      | free | free | User         | taken     | taken | `MSakibR/HireYourWheels 4`                | 8           | survivor, not shortlisted: .dev taken, account held                                                                       |
| hirin      | free | free | User         | no record | taken | `poteto/hiring-without-whiteboards 53168` | 7           | survivor, not shortlisted: reads as the employer's "now hiring" sign, the wrong side                                      |
| hirio      | free | free | User         | no record | taken | `boquita/hirios 1`                        | 7           | survivor, not shortlisted: account held                                                                                   |
| hirra      | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| hyre       | free | free | Organization | taken     | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| hyrel      | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| jobbly     | free | free | User         | no record | taken | `BrAtUkA/Jobbly 4`                        | 9           | survivor, not shortlisted: account held                                                                                   |
| jobeaver   | free | free | none         | no record | taken | not searched                              | 8           | cut: compound (job + beaver)                                                                                              |
| jobette    | free | free | User         | no record | taken | `jobe14-19/programacionJobette 0`         | 9           | survivor, not shortlisted: account held                                                                                   |
| jobin      | free | free | User         | no record | taken | `jobin-404/debtbomb 79`                   | 8           | survivor, not shortlisted: two products named Jobin (a job-search assistant and a recruiting platform)                    |
| jobiva     | free | free | none         | no record | taken | `none`                                    | 8           | **finalist**                                                                                                              |
| jobkin     | free | free | none         | no record | taken | `Gafrilatif/Jobking 1`                    | 9           | **finalist**                                                                                                              |
| joblet     | free | free | User         | taken     | taken | `ehsaniara/joblet 26`                     | 8           | survivor, not shortlisted: held account, `.dev` taken, and Joblet is a 26-star job runner                                 |
| jobley     | free | free | none         | taken     | taken | `devesrawat/Jobley.fn 0`                  | 9           | survivor, not shortlisted: .dev taken                                                                                     |
| jobling    | free | free | User         | no record | taken | `fejao/joblinge_install 2`                | 9           | **finalist**                                                                                                              |
| jobsie     | free | free | User         | no record | taken | `Faisalnwz01/jobsies-webapp 3`            | 9           | survivor, not shortlisted: account held                                                                                   |
| jobu       | free | free | User         | no record | taken | `f-secure-foundry/jobun 15`               | 7           | **finalist**                                                                                                              |
| kareer     | free | free | Organization | taken     | taken | `team-kareer/kareer-client 9`             | 7           | survivor, not shortlisted: .dev taken, account held                                                                       |
| laburo     | free | free | Organization | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| leado      | free | free | Organization | no record | taken | not searched                              | -           | cut: Findability -                                                                                                        |
| metier     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| oferta     | free | free | Organization | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| offered    | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| offerie    | free | free | none         | no record | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| offra      | free | free | User         | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| oficio     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| postio     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| postlet    | free | free | User         | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| postular   | free | free | none         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| puesto     | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| resuma     | free | free | User         | taken     | taken | `23/resumable.js 4726`                    | 7           | survivor, not shortlisted: `resumable.js` (4726 stars) sits next to it                                                    |
| resumey    | free | free | Organization | no record | taken | `resumey-pro/markdown-resume-generator 4` | 8           | survivor, not shortlisted: account held                                                                                   |
| resumo     | free | free | Organization | taken     | taken | `leic-pt/resumos-leic 72`                 | 7           | survivor, not shortlisted: .dev taken, account held                                                                       |
| roleo      | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| rolio      | free | free | User         | no record | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| shiftie    | free | free | User         | taken     | taken | not searched                              | 4           | cut: Findability 4                                                                                                        |
| shifto     | free | free | User         | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| shiftra    | free | free | none         | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| tajo       | free | free | User         | taken     | taken | not searched                              | 2           | cut: Findability 2                                                                                                        |
| takeon     | free | free | User         | taken     | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| tieclip    | free | free | User         | no record | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| turno      | free | free | User         | taken     | taken | not searched                              | 3           | cut: Findability 3                                                                                                        |
| vacancy    | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| vacanta    | free | free | User         | no record | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| vacante    | free | free | User         | no record | taken | `404mqs/uade-vacantebot 5`                | 7           | survivor, not shortlisted: account held                                                                                   |
| vacky      | free | free | User         | no record | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| vocation   | free | free | Organization | taken     | taken | not searched                              | 6           | cut: Findability 6                                                                                                        |
| workant    | free | free | User         | taken     | taken | not searched                              | 5           | cut: Findability 5                                                                                                        |
| workette   | free | free | none         | no record | taken | `none`                                    | 8           | survivor, not shortlisted: weaker on sound or fit                                                                         |
| workling   | free | free | Organization | no record | taken | `ascarter/workling 11`                    | 8           | survivor, not shortlisted: an old Ruby background-jobs gem named Workling                                                 |
| workvia    | free | free | Organization | no record | taken | `Dime2552/Workvia 1`                      | 7           | survivor, not shortlisted: account held                                                                                   |

#### Survivors per style

A survivor is free on npm and slug, passes the one-word rule, and has
Findability 7 or more.

| Style                       | Candidates | Free on npm | Survivors |
| --------------------------- | ---------- | ----------- | --------- |
| (a) Diminutives             | 32         | 28          | 15        |
| (b) Invented from job roots | 35         | 26          | 9         |
| (c) Real words and slang    | 36         | 20          | 2         |
| (d) Getting hired           | 25         | 6           | 4         |
| (e) Very short              | 13         | 3           | 2         |
| (f) Mascot or mark          | 21         | 12          | 4         |
| **Total**                   | **162**    | **95**      | **36**    |

The 36 survivors are: jobkin, jobette, jobley, jobsie, jobbly, joblet, hirey,
hirely, hirelet, hirelin, hirelo, workette, careery, careerie, resumey (a);
jobiva, careva, kareer, resuma, resumo, hirio, hireva, hirevo, workvia (b);
empleo, vacante (c); hirable, hired, employable, hiret (d); jobu, hirer (e);
jobling, workling, jobin, hirin (f). 57 names were free on npm but cut on
Findability, and 2 more (`hirebee`, `jobeaver`) were cut as compounds.

What the numbers say:

- **Style (a) holds up best.** A made-up diminutive of `job` or `hire` is
  free on npm far more often than a real word, and it carries the cue in the
  first three letters.
- **Style (c) nearly collapses.** Of 36 real words and slang, 16 are taken on
  npm, and most of the rest are Spanish words that an English speaker reads
  as no cue at all. Only `empleo` and `vacante` reach 7, and only by averaging
  two audiences.
- **Style (d) is hollow.** The plain verbs (`hire`, `land`, `snag`, `pitch`,
  `onboard`) are all taken. What is left is a handful of near-words, and two of
  them (`hired`, `hirable`) belong to existing hiring products.
- **Names with a known owner were set aside.** `hired` sits beside the
  `redis/hiredis` library and a hiring marketplace, `hirable` is a product name
  four times over, `jobin` is two products, and `workling` is an old Ruby
  background-jobs gem. `hirer` and `hirin` face the employer, not the job
  seeker.

### Web collision on the finalists

Web search on the eight finalists found no software product of the same name
for `jobling`, `jobkin`, `hirelet`, `hiret`, `careerie` or `jobiva`. The
nearest hits were job apps with similar names (Jobble, Jooble, JobLin AI,
JobDiva, Jobvite, Jobeezy, Careerify), none of them the same word. A
`Careery` AI career agent is listed online, one letter off `careerie`.
`jobiva` sits next to the applicant-tracking systems JobDiva and Jobvite,
which is a real near-name risk in this exact space. For `empleo`, the nearest
products are Spanish job sites and apps (Elempleo, Tecnoempleo, Emplea), and a
209-star `empleo-dot-net` repo. For `jobu`, no product of that name came up,
only the nearby Jobulus and Jobble apps. Web search is not a trademark search,
and none was run.

### Round 5 finalists: scored /80

Eight finalists, one or more per style: `jobling` (f), `jobkin` and `hirelet`
(a), `jobiva` and `careerie` (b), `empleo` (c), `hiret` (d), `jobu` (e).
Every one has Findability 7 or more, and every style with survivors has at
least one finalist. Axes are the round 2 definitions (sound, registry
collision, brand collision, brief fit, headroom, warmth, overpromise risk,
findability, each 0 to 10), except Sound is "memorable and easy to say
aloud". This is directional judgment, not a formula.

| Axis               | jobling                               | jobkin                                | hirelet                               | jobiva                                       | careerie                              | empleo                                         | hiret                                 | jobu                                 |
| ------------------ | ------------------------------------- | ------------------------------------- | ------------------------------------- | -------------------------------------------- | ------------------------------------- | ---------------------------------------------- | ------------------------------------- | ------------------------------------ |
| Sound              | 8: two clear beats, a friendly ending | 7: easy, "kin" is a little flat       | 5: three beats, a clumsy ending       | 5: made-up, the "iva" ending sounds clinical | 6: "career-ee", the stress is unclear | 7: three easy syllables                        | 6: reads as "hire it" or "hiret"      | 8: four letters, two beats           |
| Registry collision | 8: npm, slug, `.dev` free, idle user  | 9: npm, slug, `.dev` free, no account | 9: npm, slug, `.dev` free, no account | 9: npm, slug, `.dev` free, no account        | 9: npm, slug, `.dev` free, no account | 5: `.dev` taken, account is an organization    | 8: npm, slug, `.dev` free, idle user  | 8: npm, slug, `.dev` free, idle user |
| Brand collision    | 8: no product, only a 2-star repo     | 8: no product, 1-star repo            | 8: no product, 0-star repo            | 7: next to JobDiva and Jobvite               | 8: one letter off the Careery agent   | 6: Spanish job sites with the same word inside | 8: no product, 81-star unrelated repo | 6: next to Jobulus and Jobble        |
| Brief fit          | 6: friendly more than calm            | 6: friendly more than calm            | 5: reads as small and light           | 5: reads as a generic HR brand               | 6: cute, less precise                 | 7: plain and calm, a formal word               | 5: reads as an employer verb          | 6: neutral, no image                 |
| Headroom           | 5: bound to jobs                      | 5: bound to jobs                      | 5: bound to hiring                    | 5: bound to jobs                             | 6: bound to careers, a little wider   | 6: bound to employment                         | 5: bound to hiring                    | 5: bound to jobs                     |
| Warmth             | 9: a small creature, a pet name       | 7: a family word, "kin"               | 6: small and light                    | 4: cold, made-up                             | 7: a pet name                         | 7: plain and human in Spanish                  | 5: neutral                            | 6: a short name, slightly odd        |
| Overpromise risk   | 10: nothing promised                  | 10: nothing promised                  | 10: nothing promised                  | 10: nothing promised                         | 10: nothing promised                  | 10: nothing promised                           | 10: nothing promised                  | 10: nothing promised                 |
| Findability        | 9: "job" is the first syllable        | 9: "job" is the first syllable        | 8: "hire" is the first syllable       | 8: "job" is the first syllable               | 8: "career" is clear                  | 7: Spanish readers 10, English readers 5       | 7: "hire" is clear, the "t" is odd    | 7: "job" is clear, the "u" is odd    |
| **Total /80**      | **63**                                | **61**                                | **56**                                | **53**                                       | **60**                                | **55**                                         | **54**                                | **56**                               |

Each total is the sum of its eight scores: jobling 8+8+8+6+5+9+10+9 = 63,
jobkin 7+9+8+6+5+7+10+9 = 61, hirelet 5+9+8+5+5+6+10+8 = 56, jobiva
5+9+7+5+5+4+10+8 = 53, careerie 6+9+8+6+6+7+10+8 = 60, empleo
7+5+6+7+6+7+10+7 = 55, hiret 6+8+8+5+5+5+10+7 = 54, jobu 8+8+6+6+5+6+10+7 = 56.

Headroom is low for every finalist, on purpose: the job cue binds the name to
jobs, and that was the maintainer's request. It is the price of Findability,
the way round 4 paid for headroom and warmth with Findability.

### How the Spanish words read

`chamba`, the Mexican slang for a job, was dropped at the first check because
it is taken on npm, as are `talento`, `jale`, `pega`, `curro` and `trampo`.
Two Spanish words reached Findability 7, and one more is worth saying
plainly. Their readings:

- **empleo** ("employment", the formal word for a job). To an **English
  speaker** it looks like a cousin of "employ" and "employee", so many will
  guess that it has to do with work, but not all will, and it has no warmth.
  To a **Latin American Spanish speaker** it is the standard word for a job or
  employment, the label on every job board, so the cue is clear at once. It is
  also formal and flat: nobody says "tengo un empleo" with the affection of
  "tengo una chamba". As `/empleo:sweep` it reads like a job board category.
- **vacante** ("vacancy", an open post). To an English speaker it reads as
  "vacant", which suggests empty, not jobs. To a Latin American Spanish speaker
  it is the plain word for an open job. It was not shortlisted: the empty
  feeling in English is the wrong signal.
- **chambita**, the Mexican diminutive of `chamba` ("a small job"), is free on
  npm and has the warmth the maintainer liked in "Jobbie". An English speaker
  reads it as no word at all, and a Spanish speaker outside Mexico may not
  know the slang, so Findability is 5 and the rule cut it. If the maintainer
  can accept a name that only part of the audience decodes, it is the warmest
  option in the round.

Neither survivor has the `jobbie` feel. `empleo` is the more usable, at 55.

### Rounds 1 to 5 compared

The round 5 finalists next to the previous best of rounds 1 to 4, on the same
/80 scale. The Sound axis is scored as "memorable and easy to say" in rounds 4
and 5.

| Rank | Name     | Round | Total /80 | Brief fit | Warmth | Findability |
| ---- | -------- | ----- | --------- | --------- | ------ | ----------- |
| 1    | jobling  | 5     | 63        | 6         | 9      | 9           |
| 2    | cobijo   | 4     | 61        | 8         | 9      | 2           |
| 2    | jobkin   | 5     | 61        | 6         | 7      | 9           |
| 4    | careerie | 5     | 60        | 6         | 7      | 8           |
| 5    | jobwren  | 3     | 59        | 6         | 8      | 7           |
| 5    | tallypal | 3     | 59        | 6         | 9      | 6           |
| 7    | jobtally | 2     | 58        | 7         | 6      | 9           |
| 8    | hirelet  | 5     | 56        | 5         | 6      | 8           |
| 8    | jobu     | 5     | 56        | 6         | 6      | 7           |
| 10   | empleo   | 5     | 55        | 7         | 7      | 7           |
| 11   | hiret    | 5     | 54        | 5         | 5      | 7           |
| 12   | jobiva   | 5     | 53        | 5         | 4      | 8           |

Reading it straight:

- **Eight names survived all the filters and the scoring, and the top three
  are within 2 points of the old best.** `jobling` leads `cobijo` by 2
  points, which is inside the noise of a judgment score, but it has a
  Findability of 9 where `cobijo` has 2.
- **Style (a) wins the round.** Diminutives of `job` are the style that keeps
  the `jobbie` feel and is free on npm and `.dev`.
- **The cost moved to Brief fit and Headroom.** The finalists score 5 or 6 on
  Brief fit where `cobijo` scores 8: small and friendly reads less calm and
  precise than "shelter". The maintainer put the job cue first, so that trade
  was expected.
- **No finalist is a plain real word,** because the plain words are taken.
  Every job word still free is an invented one, and `empleo` is Spanish.

### Round 5 recommendation

This is input for the maintainer, who decides.

1. **If the job cue is the main requirement, take `jobling`.** It leads the
   round at 63, has a Findability of 9, keeps the friendly single-word feel of
   `jobbie`, and has an easy mark (a small creature, a "job-ling"). It is free
   on npm, as a slug and on `.dev`, has an idle GitHub user account and no
   product of the same name found. It reads well as `/jobling:sweep`. Check
   the existing `jobling` account before relying on it.
2. **The second pick is `jobkin`** at 61, with a cleaner registry profile (no
   GitHub account, `.dev` free). It is a little flatter to say, and "kin"
   adds family warmth.
3. **`careerie`** at 60 is the pick if "career" matters more than "job", with
   a clean registry profile. It is cuter, its stress is unclear, and a
   `Careery` AI agent sits one letter away.
4. **Avoid `jobiva`.** It scores lowest, sounds clinical and sits next to
   JobDiva and Jobvite in the same space.
5. **Spanish names did not survive well.** If the maintainer wants Spanish,
   `empleo` is the only one with a usable reading, and it is formal. `chamba`
   itself is taken on npm, and `chambita` has the warmth but not the reach.
6. **Findability is paid for in calm.** A `-ling` or `-kin` name is cute. If
   that is too cute for "calm, precise, trustworthy", the next round should
   keep the job cue and the single word but move to a plainer form, such as
   `hirey`, `jobley` or `resumey` from the survivor list above.
7. **Confirm before acting.** RDAP "no record" is a signal, not a quote, and
   registrations change. Re-run the table and ask a registrar before any
   rename, and search for trademarks, which this research did not do beyond
   what the web search surfaced.

Nothing was bought or registered for this research.
