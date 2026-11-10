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
