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
