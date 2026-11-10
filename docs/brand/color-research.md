# Colour research

Which colour conveys work for a job-search brand, what the category already uses, and six palettes to pick from. The name is jobship. Terms follow [GLOSSARY.md](../../GLOSSARY.md). The brief's avoid list and visual world are in [brief.md](brief.md); the field is mapped in [competitors.md](competitors.md) and the 44 category products come from section 5 of [naming-research.md](naming-research.md). The decisions table in `docs/brand/README.md` stays the source of truth for the palette pick. This document ranks and explains; it does not pick.

## How to read this document

- Every factual claim cites a source from the Sources list at the end (S1, S2 and so on). Claims that could not be sourced were dropped.
- **Judgment** marks a conclusion that is the author's, not a study's.
- Sources are labelled by how they were reached. "Read" means the page itself was opened. "Search summary" means the page was surfaced and summarised by a web search and not opened in full. All dates read are 2026-11-11.
- The hard filters from the ticket apply to every palette: no Claude orange or clay or sparks, no LinkedIn blue, no purple, no cyan or grey as the accent, nothing that reads as a hunting or weapon image.

## 1. What research supports about colour and meaning

**Short version.** Studies support a few narrow claims: hue affects brand personality perceptions in broad strokes, blue is the most liked hue in many countries, and lightness and saturation matter as much as hue. They do not support the popular claim that a given hue has a fixed meaning, or that a hue makes a product sell. Judgment: treat hue meaning as a weak prior that the product's own behaviour and copy override.

| Finding                                                                                                                                                                                                   | Study                                              | What it does not show                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colour can carry meaning and affect affect, cognition and behaviour, but the authors call the field "nascent" and ask for work on boundary conditions and real-world generalisability (S1).               | Elliot and Maier, 2014, review                     | Not a hue-by-hue meaning table. The abstract-level summary I could reach names achievement and attraction contexts, not brands.                                                      |
| Brand personality dimensions map to hue; red is linked to excitement and blue to competence, and saturation and brightness strengthen the traits (S2). The full text was not opened.                      | Labrecque and Milne, 2012                          | Based on controlled experiments with logos and packaging; no job-search category data. The red and blue claims are from secondary summaries of the paper.                            |
| Preferences and meanings across eight countries show both similarity and difference; blue, green and white tend to be shared, black and red vary by place (S3). Specifics are from secondary summaries.   | Madden, Hewett and Roth, 2000                      | The countries sampled are not Latin American Spanish-speaking markets as a group. The cross-country specifics were not confirmed against the paper.                                  |
| Colour emotion factors are activity, weight and heat; preference is affected most by how "clean" a colour feels (S4). Observers were British and Chinese.                                                 | Ou, Luo, Woodcock and Wright, 2004, Part I and III | Single colours on a screen, not logos; Part III says colour-combination preference was hard to predict from emotions alone.                                                          |
| Colour preference tracks how people feel about objects of that colour, which predicts about 80% of variance in average preference ratings (S5). 48 adults in the San Francisco Bay area rated 32 colours. | Palmer and Schloss, 2010                           | A US sample. It explains liking, not brand trust.                                                                                                                                    |
| Blue was the most popular colour in 10 countries in a 2015 survey, with a share between 23% and 33% (S6). Details are from secondary reports; the YouGov original was not opened.                         | YouGov, 2015                                       | The 10 countries are UK, Germany, USA, Australia, China, Hong Kong, Malaysia, Singapore, Thailand and Indonesia: none in Latin America. "Most liked" is not "most fitting for work". |
| Brief exposure to red before a test lowered scores in four experiments (S7). Later replication attempts, reported in conference posters, did not reproduce it (S8).                                       | Elliot et al., 2007; Steele et al., posters        | The effect is disputed. Do not use it to argue that red harms a job seeker. Treat red as a status colour, not as a mood lever.                                                       |

### Cultural variation, English and Latin American Spanish readers

- Cross-national work finds blue and green broadly shared and red and black variable (S3, secondary summary). Judgment: for a developer audience reading English, the safe reading of green is "go, ok, growth", of red "stop, error, danger", of amber "caution". Those are interface conventions as much as cultural ones.
- I found no study of emotional colour associations among Latin American Spanish speakers. The closest work is about colour naming: a 2017 study compared Uruguayan and Spanish speakers on blue shades (celeste versus azul) (S9), and a 2018 study compared Castilian, Mexican and Uruguayan colour terms (S10). These show naming differences, not a different meaning of green or yellow. Gap, stated plainly: no sourced claim is made here about how Latin American readers read a given hue.
- Colour-vision differences matter more than culture for a developer tool. About 8% of men and 0.5% of women of Northern European descent have red-green deficiency (S11, secondary). Section 4 shows what that does to the status colours.

### What this means for jobship (Judgment)

The research supports choosing by contrast, lightness and distinctiveness inside the category, not by a hue's supposed meaning. It does support avoiding colours whose conventional meaning contradicts the product: red or urgency tones for a brand whose brief says "no pressure, urgency or fear".

## 2. Category colour audit

The 44 products of naming-research.md section 5, plus the maintainer's five kits. "Basis" says how the colour was reached, and it limits how far to trust the row:

- **P-meta**: the brand's own page declares it (a `theme-color` meta tag or a named brand token in its CSS), read 2026-11-11 (S12 to S25).
- **P-css**: the most frequent saturated colour in the brand's own homepage CSS, found with a small script. This is a heuristic: it can pick a framework default or a secondary colour.
- **P-doc**: the brand's own published guideline (Indeed's UI guidelines PDF, S26, search summary).
- **S**: a third-party palette or logo site, or trade press, surfaced by web search (S27 to S33). Indicative only.
- **U**: not verified. The site blocked automated reads (HTTP 403), was unreachable, or the sources conflicted. Not counted.

17 of 44 products are U. That is a real limit of this audit: the colour of 27 products is sourced, not 44. The kit rows are read from the maintainer's own tokens files (S37), with oklch values converted to hex.

| #   | Product                    | Colour as found                                                           | Hue family       | Basis  |
| --- | -------------------------- | ------------------------------------------------------------------------- | ---------------- | ------ |
| 1   | Indeed                     | Indeed Blue #003A9B, with Ink Blue #00123C                                | Blue             | P-doc  |
| 2   | LinkedIn                   | #0A66C2 (older #0077B5 still circulates)                                  | Blue             | S      |
| 3   | Glassdoor                  | #0caa41 (`theme-color`)                                                   | Green            | P-meta |
| 4   | Monster                    | A purple flag mark, kept through the 2014 and 2022 rebrands; no hex found | Purple           | S      |
| 5   | CareerBuilder              | Navy #183C8C with orange #F37937                                          | Blue             | S      |
| 6   | ZipRecruiter               | #6cc04a, most frequent saturated colour                                   | Green            | P-css  |
| 7   | SimplyHired                | Sources conflict: magenta #9D2067 or orange-red #E15D29                   | Unclear          | U      |
| 8   | Adzuna                     | #279B37                                                                   | Green            | S      |
| 9   | AfterCollege               | #337ab7 and #16a085; likely framework defaults                            | Unclear          | U      |
| 10  | Wellfound (AngelList)      | `--accent` #d11f68                                                        | Pink             | P-meta |
| 11  | CareerArc                  | #451f90 most frequent, with pink #e54f6d                                  | Purple           | P-css  |
| 12  | CV-Library                 | #014694                                                                   | Blue             | P-css  |
| 13  | Dice                       | #cc0000 (`theme-color`)                                                   | Red              | P-meta |
| 14  | Freelancer                 | #1976d2 (`theme-color`)                                                   | Blue             | P-meta |
| 15  | Guru                       | Site blocked the read                                                     | Unknown          | U      |
| 16  | HackerRank                 | `--cv6-brand-green` #20d761                                               | Green            | P-meta |
| 17  | IAESTE                     | #1a84d7                                                                   | Blue             | P-css  |
| 18  | Internshala                | `theme-color` is white; no brand colour read                              | Unknown          | U      |
| 19  | Jobindex                   | #b41018 (`theme-color`)                                                   | Red              | P-meta |
| 20  | JobServe                   | #116633, with cyan #00aeef                                                | Green            | P-css  |
| 21  | JobStreet                  | Site blocked the read                                                     | Unknown          | U      |
| 22  | JobTiger                   | Site unreachable                                                          | Unknown          | U      |
| 23  | Kalibrr                    | #006DFF (`theme-color`)                                                   | Blue             | P-meta |
| 24  | Kijiji                     | Cyan and amber both frequent; no clear primary                            | Unclear          | U      |
| 25  | Naukri                     | #3d68d9 and its scale                                                     | Blue             | P-css  |
| 26  | Oodle                      | Page not found                                                            | Unknown          | U      |
| 27  | PageGroup                  | Site unreachable                                                          | Unknown          | U      |
| 28  | PeoplePerHour              | #FF7300 (`theme-color`)                                                   | Orange           | P-meta |
| 29  | Reed                       | Blue, green and magenta all frequent; no clear primary                    | Unclear          | U      |
| 30  | Rozee                      | Site blocked the read                                                     | Unknown          | U      |
| 31  | SEEK                       | Navy #221F73                                                              | Blue             | S      |
| 32  | Craigslist                 | No brand colour read                                                      | Unknown          | U      |
| 33  | Snagajob                   | #F47A20                                                                   | Orange           | S      |
| 34  | TheLadders                 | Site blocked the read                                                     | Unknown          | U      |
| 35  | The Muse                   | `--color-accent` #1d2d5a                                                  | Blue (navy)      | P-meta |
| 36  | WayUp                      | #16D8ED (`theme-color`)                                                   | Cyan             | P-meta |
| 37  | Workopolis                 | Site blocked the read                                                     | Unknown          | U      |
| 38  | XING                       | Green and mint tokens, but pink-red is the most frequent colour           | Unclear          | U      |
| 39  | Huntr                      | #6a4feb most frequent                                                     | Purple           | P-css  |
| 40  | Simplify                   | `--color-primary-400` #12a1c0                                             | Cyan             | P-meta |
| 41  | LazyApply                  | #007bff, the Bootstrap default                                            | Unclear          | U      |
| 42  | Jobscan                    | `--color-primary` #006edc, accent #ff9300                                 | Blue             | P-meta |
| 43  | Careerflow                 | `--primary-1` #4285f4, `--primary-2` #0fbf95                              | Blue             | P-meta |
| 44  | Jobbie                     | Not read                                                                  | Unknown          | U      |
| K1  | emet kit                   | accent oklch(0.7 0.135 135), about #79b157                                | Yellow-green     | Kit    |
| K2  | aokit kit                  | No accent: soot mono, the ink is the accent                               | Neutral          | Kit    |
| K3  | snug kit                   | primary oklch(0.789 0.161 65.7), about #ffa230                            | Amber            | Kit    |
| K4  | animated-fluent-emojis kit | primary oklch(0.736 0.132 172.1), about #2fc4a0                           | Mint, teal-green | Kit    |
| K5  | streamboss kit             | primary #E5202E                                                           | Red              | Kit    |

### Count per hue family

Counted over the 27 products with a sourced colour (P or S). The kits are listed separately.

| Hue family | Products | Names                                                                                                                 |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| Blue       | 12       | Indeed, LinkedIn, CareerBuilder, CV-Library, Freelancer, IAESTE, Kalibrr, Naukri, SEEK, The Muse, Jobscan, Careerflow |
| Green      | 5        | Glassdoor, ZipRecruiter, Adzuna, HackerRank, JobServe                                                                 |
| Purple     | 3        | Monster, CareerArc, Huntr                                                                                             |
| Red        | 2        | Dice, Jobindex                                                                                                        |
| Orange     | 2        | PeoplePerHour, Snagajob                                                                                               |
| Cyan       | 2        | WayUp, Simplify                                                                                                       |
| Pink       | 1        | Wellfound                                                                                                             |
| Yellow     | 0        |                                                                                                                       |

Kits: one yellow-green (emet), one neutral (aokit), one amber (snug), one mint (animated-fluent-emojis), one red (streamboss).

### Where the open space is (Judgment)

- **Blue is the category's default, 12 of 27 (44%).** It is where trust is bought, and where jobship would be indistinguishable. The brief already bans LinkedIn blue.
- **Green is second, 5 of 27 (19%)**, and clustered on the large boards (Glassdoor, ZipRecruiter, Adzuna) and a coding-test brand (HackerRank). A green jobship is findable but crowded; a yellow-leaning green or a blue-leaning green sits away from those greens.
- **Yellow is empty, 0 of 27.** It is also the hardest hue to use: a light yellow fails on a white ground (section 4). Citron below is a test of whether a darker accent-text can carry it.
- **Pink, red and orange hold 5 of 27 together.** Red and orange read as urgency and fall under the brief's avoid list for tone; orange is also the Claude neighbourhood.
- **Cyan and purple are out by the maintainer's own filters.**
- **Position against the maintainer's kits.** Yellow-green (emet), amber (snug), mint (animated-fluent-emojis) and red (streamboss) are taken inside the portfolio. A jobship in the same family would read as a sibling of that kit. This is a consideration, not a rule; the decision is the maintainer's.

## 3. What each hue family signals for work

Only the blue and red readings below have a study behind them, and a weak one (red excites, blue reads as competent, S2). The rest is the conventional reading in software interfaces and in the category audit above, and is **Judgment**. Use it to rank, not to prove.

| Hue family              | Trust                 | Growth                 | Energy                | Warmth | Risk signal                        | Fit for jobship (Judgment)                                                                                                     |
| ----------------------- | --------------------- | ---------------------- | --------------------- | ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Blue                    | High (S2: competence) | Low                    | Low                   | Low    | None                               | Reads as work and trust, and is exactly what 44% of the sourced category already is. LinkedIn blue is on the avoid list.       |
| Green                   | Medium                | High: progress, go, ok | Medium                | Medium | Collides with the ok status colour | Conveys steady progress. Fits the line and trail metaphor (a path that moves forward). Crowded among large boards.             |
| Yellow-green and citron | Low to medium         | High                   | High                  | Medium | Close to the warn status colour    | Open in the category (0 of 27). Fresh and distinct; the hardest to keep legible as text on white.                              |
| Yellow and gold         | Low                   | Low                    | High                  | High   | Warn colour; caution               | Already shown and rejected as Gold and Sun yellow.                                                                             |
| Orange and amber        | Low                   | Low                    | High                  | High   | Warn and urgency                   | Claude orange and clay territory. Excluded.                                                                                    |
| Red                     | Low                   | None                   | High (S2: excitement) | Low    | Error, danger, urgency             | Contradicts "no pressure, urgency or fear". Keep only as the error status colour.                                              |
| Pink and rose           | Low                   | Low                    | Medium                | High   | None                               | Warm, but reads as consumer or lifestyle brand and runs against "precise, calm, trustworthy". Rose and Hot pink already shown. |
| Purple                  | Medium                | Low                    | Medium                | Medium | None                               | Excluded by the brief. 3 of 27 sourced products use it.                                                                        |
| Cyan and teal           | Medium                | Medium                 | Medium                | Low    | None                               | Cyan rejected by the maintainer. Teal already shown.                                                                           |
| Grey and ink            | Medium                | None                   | None                  | None   | None                               | Rejected as the accent by the maintainer. Fine as the ground.                                                                  |

Risk colours (error, urgency, warning) belong to status tokens, not to the brand accent. A jobship whose accent is red or amber would make every successful state look like a problem and every problem look like the brand.

## 4. Technical constraints

### Contrast, computed with the WCAG formula

The contrast ratio is (L1 + 0.05) / (L2 + 0.05), where L is relative luminance, with sRGB channels linearised and weighted 0.2126, 0.7152 and 0.0722 (S34). Thresholds: 4.5:1 for normal text at level AA, 7:1 at level AAA, and 3:1 for user-interface components and graphics (S34). The ticket sets body text to 7:1 and accent text to 4.5:1 in both themes. Every ratio in section 6 was recomputed from the hex values shown, with that formula, in a throwaway script that is not committed. Colours were authored in oklch and gamut-clipped to sRGB.

### How a bright accent survives on white

A saturated mid-light accent has the same luminance problem on a light ground. The accents in section 6 against their own light backgrounds:

| Accent  | Hex     | Ratio on its light bg | Passes 3:1 as a shape | Passes 4.5:1 as text |
| ------- | ------- | --------------------- | --------------------- | -------------------- |
| Citron  | #e0e132 | 1.34                  | No                    | No                   |
| Lime    | #7bd957 | 1.69                  | No                    | No                   |
| Jade    | #2cce99 | 1.94                  | No                    | No                   |
| Emerald | #3ec873 | 2.08                  | No                    | No                   |
| Cobalt  | #297cef | 3.84                  | Yes                   | No                   |
| Pine    | #418d59 | 3.91                  | Yes                   | No                   |

Consequence (Judgment): a vivid green or yellow-green accent cannot be one colour in both themes. Each palette therefore has two extra values: an **accent-text** that is darkened on the light theme until it reaches 4.5:1, and a **light-theme mark fill** darkened until it reaches 3:1 against the light background. The vivid accent stays for dark-theme text, fills, focus rings on dark, and buttons whose label is the dark on-accent ink. This is the cost of vivid greens: on white they get darker and read closer to "restrained".

### 16-colour ANSI

The original 8-colour standard only named the colours and left the shades to the implementation; the 90 to 97 and 100 to 107 bright codes came later, and the same codes render with different RGB values across terminals and themes (S35). So an ANSI mapping cannot depend on an exact hex: it can only say which slot carries which meaning. 24-bit colour via `ESC[38;2;r;g;bm` is widely supported, and `NO_COLOR` is a convention for turning colour off (S35). Judgment, applied to every palette:

| Slot                                              | Use                                                        |
| ------------------------------------------------- | ---------------------------------------------------------- |
| 2 green, 10 bright green                          | ok and success; also the accent when the accent is a green |
| 3 yellow, 11 bright yellow                        | warn; also the accent for Citron                           |
| 1 red, 9 bright red                               | error only                                                 |
| 4 blue, 12 bright blue                            | info; also the accent for Cobalt                           |
| 0 black, 7 white, 8 bright black, 15 bright white | ground, body text, muted                                   |
| 5 magenta, 6 cyan, 13, 14                         | unused (purple and cyan are avoided)                       |

For a green or yellow-green accent the accent and the ok colour share a slot (2 and 10 or 3 and 11). That is a real cost: in a 16-colour terminal, accent and success are indistinguishable. Cobalt is the only candidate whose accent has its own slot (4 and 12) apart from ok, warn and error.

### Colour-blind safety

Simulating deuteranopia with the published severity-1.0 matrix of Machado, Oliveira and Fernandes (S36; the page does not state the colour space, so it was applied to linearised sRGB, the usual practice), the dark-theme ok #68ca80 and error #fe7f78 become #bdb285 and #bcaf75, a contrast ratio of 1.04:1; the light-theme ok #057836 and error #b02a2d become #6d643b and #746828, 1.06:1. In plain vision the same pairs are 1.21:1 and 1.17:1 in luminance, so they differ only by hue. Consequences (Judgment): ok and error must never be told apart by colour alone; every status needs a word or glyph (ok, error, warn), and `huntline` output already prints words. A blue accent survives the simulation (Cobalt #297cef becomes #0076ed); green and yellow-green accents shift to khaki (Jade #2cce99 becomes #b6b19d, Emerald #3ec873 becomes #b7ac79), which is fine as long as they never encode status.

## 5. Ranked recommendation

All of this is **Judgment**, built on sections 2 to 4. The study evidence in section 1 is too weak to rank hues by meaning, so the ranking uses three tests: does the hue say "work" in a calm way, is it open in the category, and does it survive on white and in 16-colour ANSI.

1. **Green, specifically a blue-leaning or yellow-leaning green rather than the board-green.** It is the only family that reads as progress and as a path moving forward, which matches the brief's line and trail metaphor, and it is not blue. It is crowded (5 of 27), but the big-board greens are mid greens (Glassdoor #0caa41, Adzuna #279B37, ZipRecruiter #6cc04a), so a jade at hue 165 or an emerald deeper than those can still be told apart. Weaknesses: on white the vivid shade fails text contrast and must be darkened (section 4), and the accent shares an ANSI slot with ok. Palettes: Jade, Emerald, Pine.
2. **Yellow-green to citron.** The only wholly open hue in the audit (yellow 0 of 27), clearly not blue, and fresh without being warm-orange. Weaknesses: the hardest on white (1.34:1), so it is a dark-first accent, and the kit emet already holds a yellow-green (about #79b157), so jobship would read as a relative of emet. Palettes: Citron, Lime to emerald.
3. **A blue that is not LinkedIn blue.** Blue is the most-liked hue in the 2015 survey (S6) and reads as competence (S2), so it is the strongest signal of work. It is last because it is the category default (12 of 27 sourced products), the brief bans LinkedIn blue, and a saturated blue at hue 258 drifts toward the purple the brief also bans. Its practical strength: it is the only candidate whose accent has its own ANSI slot and survives colour-blind simulation. Palette: Cobalt.

### Vivid versus restrained

The brief says "restrained", "cool" and "calm", with a single accent. The maintainer's reaction was that the muted palettes (Ice, grey, Sage and similar) looked dull, and that the vivid set was not decisive either. Section 4 shows why both reactions are expected: a vivid accent is easy to see on dark but fails on white, and a muted accent that passes on white looks dull on dark. Judgment, as a way to square the brief with the reaction:

- Restrained applies to the grounds, the type and the number of colours: near-black and near-white grounds with a faint hue tint, one accent, and status colours kept separate.
- Vivid applies to the one accent in the dark theme and in the mark, where it has the most room. On the light theme the accent steps down only as far as contrast requires (section 4), instead of making the whole palette muted.
- Pine is included as the restrained foil. Its accent passes 3:1 as a shape on both grounds with no darkening, but its dark-theme contrast is only 4.7:1, which is the "dull" the maintainer reacted to. It tests whether a deeper green is enough or whether vivid is needed.

### Which already-shown vivid options the research supports

| Shown option               | Supported by the research?       | Why (Judgment)                                                                                                                                 |
| -------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Emerald                    | Yes, with the light-theme caveat | Green family, ranked first; mid-green board colours are close but Emerald can be placed away from them.                                        |
| Lime to emerald (gradient) | Yes, for the mark                | Spans the open yellow-green and the progress-green; a gradient shows the line metaphor. Needs a solid fallback for 16 px and for the terminal. |
| Lime                       | Partly                           | Open in the category but a sibling of emet's yellow-green.                                                                                     |
| Sun yellow                 | No                               | Yellow is open but fails on white and sits beside the warn colour and amber. Already rejected as Gold.                                         |
| Hot pink                   | No                               | Reads consumer; warmth without trust; not calm.                                                                                                |
| Coral red                  | No                               | Red is the error colour and the urgency signal the brief rejects; close to the Claude clay neighbourhood.                                      |

Already shown and rejected: Teal, Ice, Slate, Rose, Gold, Sage. The research gives no reason to reopen them: Teal and Ice sit near the cyan the maintainer rejected, Slate and Sage are the muted greys that read dull, Rose is a warm pink, Gold is the yellow-orange neighbour of amber.

## 6. Palette brief

Six candidates. Four use hues the maintainer has not seen (Jade, Cobalt, Citron, Pine); two are shown-and-still-candidate vivid options (Emerald, Lime to emerald). None is picked here. All values are hex, authored in oklch and gamut-clipped, with the ratios recomputed from the hex.

Conventions, the same in all six:

- **Grounds** tint toward the accent hue at oklch chroma 0.010 to 0.014, never pure black or white. Dark bg L 0.17, surface L 0.215; light bg L 0.985, surface L 0.955.
- **fg** is at least 7:1 on bg and on surface in both themes (every fg row below is at 16.5 or higher).
- **muted** is at least 4.5:1 on bg.
- **accent-text** is the accent darkened or lightened until it reaches 4.5:1 on the bg of its theme.
- **on-accent** is the better of near-black #0b0f0d and white on the accent fill.
- **Status colours** are shared by all six: ok hue 150, warn hue 80, error hue 25, each at least 4.5:1 on bg. The accent greens share a hue region with ok; see the ANSI note in section 4.
- **Solid shape fill** is how the logo looks as a flat fill. On dark it is the accent. On light it is the accent darkened to 3:1 against the light bg (section 4), and the ratio is shown.

Status values (all six palettes, dark / light):

| Status | Dark hex (ratio on dark bg) | Light hex (ratio on light bg) |
| ------ | --------------------------- | ----------------------------- |
| ok     | #68ca80 (about 9.4)         | #057836 (about 5.4)           |
| warn   | #e6ac3d (about 9.4)         | #825b01 (about 5.8)           |
| error  | #fe7f78 (about 7.7)         | #b02a2d (about 6.3)           |

The status ratios vary in the second decimal between palettes because each ground differs slightly; the exact figure per palette is in its tables.

### P1. Jade (hue 165, unseen)

Rationale: a green leaning toward blue-green, between the shown Emerald (152) and the rejected Teal and cyan. It keeps green's progress reading and sits away from the board greens (Glassdoor 0caa41 and ZipRecruiter 6cc04a are yellower). Risk: close enough to cyan-teal that a printed or dimmed rendering may read as the rejected teal.

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #0b110e  |                     | #f3fdf8   |                     |
| surface     | #131c18  | 15.14 fg on surface | #e8f3ee   | 15.22 fg on surface |
| fg          | #e9f1ed  | 16.60               | #161c19   | 16.65               |
| muted       | #94a39b  | 7.24                | #596760   | 5.72                |
| accent      | #2cce99  | 9.44                | #2cce99   | 1.94                |
| accent-text | #2cce99  | 9.44                | #047554   | 5.50                |
| on-accent   | #0b0f0d  | 9.55 on accent      | #0b0f0d   | 9.55 on accent      |
| ok          | #68ca80  | 9.40                | #057836   | 5.40                |
| warn        | #e6ac3d  | 9.39                | #825b01   | 5.87                |
| error       | #fe7f78  | 7.74                | #b02a2d   | 6.29                |

Solid shape fill: dark #2cce99 (9.44 on bg); light #08a578 (3.03 on bg).

### P2. Cobalt (hue 258, unseen)

Rationale: a saturated blue that is not LinkedIn blue (#0A66C2 is hue 210 and calmer). Carries "competence" (S2) and the world's most liked hue (S6). Risk: it is the category's default family (12 of 27), it leans toward violet, which the brief bans, and the maintainer may read it as LinkedIn-adjacent regardless. Strength: it is the only candidate with its own ANSI slot (4 and 12) and it survives deuteranopia.

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #0c1015  |                     | #f7faff   |                     |
| surface     | #151a20  | 15.13 fg on surface | #eaf1fa   | 15.19 fg on surface |
| fg          | #eaeff5  | 16.50               | #181b1f   | 16.52               |
| muted       | #979fab  | 7.14                | #5c646f   | 5.72                |
| accent      | #297cef  | 4.75                | #297cef   | 3.84                |
| accent-text | #377ee3  | 4.78                | #145ec1   | 5.90                |
| on-accent   | #0b0f0d  | 4.80 on accent      | #0b0f0d   | 4.80 on accent      |
| ok          | #68ca80  | 9.40                | #057836   | 5.36                |
| warn        | #e6ac3d  | 9.39                | #825b01   | 5.82                |
| error       | #fe7f78  | 7.74                | #b02a2d   | 6.24                |

Solid shape fill: dark #297cef (4.75 on bg); light #4590fd (3.01 on bg). White on the accent is 4.02:1, so the label must be the dark ink.

### P3. Citron (hue 110, unseen)

Rationale: a yellow-green, between the shown Lime (130) and Sun yellow (95). It takes the one empty slot in the category audit (yellow, 0 of 27) and is clearly not blue, cyan or purple. Risks: 1.34:1 on the light ground, so on light it is a mark and a dark-ink button, never text; the accent sits close to the warn colour (hue 80 against 110); and emet's kit already holds a yellow-green.

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #10100a  |                     | #fafbf2   |                     |
| surface     | #1a1a13  | 15.14 fg on surface | #f0f1e7   | 15.18 fg on surface |
| fg          | #efefe8  | 16.52               | #1b1b16   | 16.58               |
| muted       | #9fa092  | 7.19                | #646457   | 5.75                |
| accent      | #e0e132  | 13.62               | #e0e132   | 1.34                |
| accent-text | #dfe044  | 13.52               | #676804   | 5.66                |
| on-accent   | #0b0f0d  | 13.77 on accent     | #0b0f0d   | 13.77 on accent     |
| ok          | #68ca80  | 9.40                | #057836   | 5.38                |
| warn        | #e6ac3d  | 9.39                | #825b01   | 5.85                |
| error       | #fe7f78  | 7.74                | #b02a2d   | 6.27                |

Solid shape fill: dark #e0e132 (13.62 on bg); light #959604 (3.03 on bg), an olive that reads far less fresh than the dark version.

### P4. Emerald (hue 152, shown vivid, supported)

Rationale: the pure progress-green. Supported by the research (section 5, rank 1). Risk: nearest of the six to the board greens, and to the ok colour.

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #0c110d  |                     | #f4fdf6   |                     |
| surface     | #151b16  | 15.13 fg on surface | #eaf3ec   | 15.24 fg on surface |
| fg          | #eaf0eb  | 16.49               | #171c18   | 16.64               |
| muted       | #96a298  | 7.19                | #5b675e   | 5.70                |
| accent      | #3ec873  | 8.82                | #3ec873   | 2.08                |
| accent-text | #3ec873  | 8.82                | #07773c   | 5.45                |
| on-accent   | #0b0f0d  | 8.93 on accent      | #0b0f0d   | 8.93 on accent      |
| ok          | #68ca80  | 9.39                | #057836   | 5.40                |
| warn        | #e6ac3d  | 9.38                | #825b01   | 5.87                |
| error       | #fe7f78  | 7.74                | #b02a2d   | 6.29                |

Solid shape fill: dark #3ec873 (8.82 on bg); light #10a757 (3.02 on bg).

### P5. Lime to emerald (hue 138, shown vivid gradient, supported for the mark)

Rationale: the line metaphor as a colour, a trail that moves from yellow-green into green, spanning two of the open or lightly used families. The table is the single accent used for UI (a mid lime); the gradient is for the mark only. Risk: gradients fail at 16 px and in 16-colour ANSI, so the mark needs a solid fallback, and a lime start is a sibling of emet's yellow-green.

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #0d110c  |                     | #f6fcf4   |                     |
| surface     | #161b15  | 15.13 fg on surface | #ecf3e9   | 15.25 fg on surface |
| fg          | #ebf0ea  | 16.49               | #181c17   | 16.55               |
| muted       | #99a296  | 7.22                | #5e665b   | 5.71                |
| accent      | #7bd957  | 10.80               | #7bd957   | 1.69                |
| accent-text | #84d765  | 10.78               | #307608   | 5.42                |
| on-accent   | #0b0f0d  | 10.94 on accent     | #0b0f0d   | 10.94 on accent     |
| ok          | #68ca80  | 9.39                | #057836   | 5.38                |
| warn        | #e6ac3d  | 9.37                | #825b01   | 5.85                |
| error       | #fe7f78  | 7.73                | #b02a2d   | 6.27                |

Solid shape fill: dark gradient #c0f447 to #22c373 (14.76 and 8.27 on bg). Light gradient #699f08 to #168b49 (3.07 and 4.18 on bg); the dark pair on a light ground would be 1.24 and 2.21, which fail. Solid fallback: #7bd957 on dark, #48a515 on light (3.02).

### P6. Pine (hue 152, low chroma, unseen)

Rationale: the restrained foil. A deeper, less saturated green than Emerald, aimed at "calm and trustworthy" and at a light theme that needs no step-down. Risk: it is the nearest to the muted, dull look the maintainer rejected (Sage), and its dark-theme contrast is the lowest of the six (4.70:1).

| Role        | Dark hex | Dark ratio          | Light hex | Light ratio         |
| ----------- | -------- | ------------------- | --------- | ------------------- |
| bg          | #0c110d  |                     | #f4fdf6   |                     |
| surface     | #151b16  | 15.13 fg on surface | #eaf3ec   | 15.24 fg on surface |
| fg          | #eaf0eb  | 16.49               | #171c18   | 16.64               |
| muted       | #96a298  | 7.19                | #5b675e   | 5.70                |
| accent      | #418d59  | 4.70                | #418d59   | 3.91                |
| accent-text | #418d59  | 4.70                | #267543   | 5.46                |
| on-accent   | #0b0f0d  | 4.76 on accent      | #0b0f0d   | 4.76 on accent      |
| ok          | #68ca80  | 9.39                | #057836   | 5.40                |
| warn        | #e6ac3d  | 9.38                | #825b01   | 5.87                |
| error       | #fe7f78  | 7.74                | #b02a2d   | 6.29                |

Solid shape fill: dark #418d59 (4.70 on bg); light #539f6a (3.10 on bg).

### Summary

| Palette         | Hue             | Seen by the maintainer | Research rank         | Main trade-off                    |
| --------------- | --------------- | ---------------------- | --------------------- | --------------------------------- |
| Jade            | 165             | No                     | 1 (green)             | Near the rejected teal and cyan   |
| Cobalt          | 258             | No                     | 3 (blue)              | Category default; leans violet    |
| Citron          | 110             | No                     | 2 (yellow-green)      | Fails on white; sibling of emet   |
| Emerald         | 152             | Yes, vivid             | 1 (green)             | Closest to board greens and to ok |
| Lime to emerald | 138 to 155      | Yes, vivid             | 2 (yellow-green)      | Gradient needs a solid fallback   |
| Pine            | 152, low chroma | No                     | 1 (green), restrained | Lowest contrast; may read dull    |

## Dead ends and gaps

- Colour for 17 of the 44 products could not be sourced (sites returned HTTP 403, were unreachable or the evidence conflicted); the audit counts only the 27 sourced rows. A browser-based read of each brand's own style guide would close most of the gap.
- The P-css rows use a heuristic over homepage CSS and can pick a framework default. LinkedIn, CareerBuilder, SEEK, Adzuna, Snagajob and Monster rest on third-party sites or trade press, because their own brand pages were not reachable by this method.
- Labrecque and Milne, Madden, Hewett and Roth, and YouGov were not read in full; the findings are as reported by secondary summaries (S2, S3, S6).
- No study of emotional colour associations among Latin American Spanish speakers was found (section 1).
- Not reproduced: the claim that red impairs performance (S7, S8).

## Sources

All read on 2026-11-11. "Search summary" means the page was surfaced and summarised by a web search and not opened in full. "Read" means the page was fetched.

- S1. Elliot and Maier, "Color psychology: effects of perceiving color on psychological functioning in humans", Annual Review of Psychology 65, 2014, https://pubmed.ncbi.nlm.nih.gov/23808916/ (search summary of the abstract)
- S2. Labrecque and Milne, "Exciting red and competent blue: the importance of color in marketing", Journal of the Academy of Marketing Science 40(5), 2012, https://link.springer.com/content/pdf/10.1007/s11747-010-0245-y.pdf (search summary; findings via secondary descriptions)
- S3. Madden, Hewett and Roth, "Managing images in different cultures: a cross-national study of color meanings and preferences", Journal of International Marketing 8(4), 2000, https://www.econbiz.de/Record/managing-images-in-different-cultures-a-cross-national-study-of-color-meanings-and-preferences/10003785591 (search summary; specifics from secondary summaries)
- S4. Ou, Luo, Woodcock and Wright, "A study of colour emotion and colour preference", Parts I to III, Color Research and Application 29, 2004, https://pureportal.coventry.ac.uk/en/publications/a-study-of-colour-emotion-and-colour-preference-part-iii-colour-p/ (search summary)
- S5. Palmer and Schloss, "An ecological valence theory of human color preference", PNAS 107(19), 2010, https://pmc.ncbi.nlm.nih.gov/articles/PMC2889342 (search summary)
- S6. YouGov, "Why is blue the world's favorite color?", 2015, https://au.yougov.com/news/2015/05/13/why-blue-worlds-favorite-color (search summary; figures from secondary reports)
- S7. Elliot, Maier, Moller, Friedman and Meinhardt, "Color and psychological functioning: the effect of red on performance attainment", Journal of Experimental Psychology: General 136(1), 2007, https://bibbase.org/network/publication/elliot-maier-moller-friedman-meinhardt-colorandpsychologicalfunctioningtheeffectofredonperformanceattainment-2007 (search summary)
- S8. Steele and colleagues, Psychonomic Society posters 2015 to 2017, https://www.appstate.edu/~steelekm/documents/Psychonomic2017Poster_Steele.pdf (search summary; conference posters, not peer reviewed)
- S9. Frontiers in Communication, 2017, Uruguayan and Spanish blue categories, https://www.frontiersin.org/articles/10.3389/fcomm.2017.00018/full (search summary)
- S10. Frontiers in Psychology, 2018, Castilian, Mexican and Uruguayan basic colour terms, https://pmc.ncbi.nlm.nih.gov/articles/PMC5968181 (search summary)
- S11. Prevalence of red-green colour blindness, as reported by https://www.news-medical.net/health/Color-Blindness-Prevalence.aspx and https://www.color-blindness.com/what-is-color (search summary; the National Eye Institute page was not reached)
- S12. Glassdoor homepage meta theme-color, https://www.glassdoor.com (read)
- S13. Dice homepage meta theme-color, https://www.dice.com (read)
- S14. Freelancer homepage meta theme-color, https://www.freelancer.com (read)
- S15. Jobindex homepage meta theme-color, https://www.jobindex.dk (read)
- S16. Kalibrr homepage meta theme-color, https://www.kalibrr.com (read)
- S17. PeoplePerHour homepage meta theme-color, https://www.peopleperhour.com (read)
- S18. WayUp homepage meta theme-color, https://wayup.com (read)
- S19. The Muse homepage CSS custom property `--color-accent`, https://www.themuse.com (read)
- S20. Wellfound homepage CSS custom property `--accent`, https://wellfound.com (read)
- S21. HackerRank homepage CSS custom property `--cv6-brand-green`, https://www.hackerrank.com (read)
- S22. Simplify homepage CSS custom properties `--color-primary-*`, https://simplify.jobs (read)
- S23. Jobscan homepage CSS custom properties `--color-primary` and `--color-accent`, https://www.jobscan.co (read)
- S24. Careerflow homepage CSS custom properties `--primary-*`, https://www.careerflow.ai (read)
- S25. Homepage CSS frequency heuristic for ZipRecruiter, CareerArc, CV-Library, IAESTE, JobServe, Naukri and Huntr, at https://www.ziprecruiter.com, https://www.careerarc.com, https://www.cv-library.co.uk, https://www.iaeste.org, https://www.jobserve.com, https://www.naukri.com and https://huntr.co (read)
- S26. Indeed, UI guidelines PDF naming Brand Blue #003a9b, https://docs.indeed.com/ja/assets/files/ui-guidelines-1bd89436a9759f9bd130fc2047cc51b3.pdf (search summary)
- S27. LinkedIn Blue #0A66C2, third-party palettes, https://www.brandcolorcode.com/linkedin (search summary; LinkedIn's own guidelines were not reached)
- S28. Monster rebrand, The Branding Journal, https://www.thebrandingjournal.com/2014/07/new-services-logo-brand-identity-leading-employment-website-monster-com/ ; and Storyboard18, https://cms.storyboard18.com/?p=3800 (search summary)
- S29. CareerBuilder logo colours, https://whatthelogo.com/logo/career-builder/281704 (search summary)
- S30. Adzuna colour palette, https://www.designpieces.com/palette/adzuna-color-palette-hex-and-rgb/ (search summary)
- S31. SEEK logo colours, https://whatthelogo.com/logo/seek/214520 (search summary)
- S32. Snagajob colour palette, https://www.designpieces.com/palette/snagajob-color-palette-hex-and-rgb/ (search summary)
- S33. SimplyHired colours, https://www.brandcolorcode.com/simply-hired and https://whatthelogo.com/logo/simply-hired/282234 (search summary; the two sources conflict)
- S34. W3C, "Web Content Accessibility Guidelines (WCAG) 2.2", success criteria 1.4.3, 1.4.6 and 1.4.11, https://www.w3.org/TR/WCAG22/ (read, first 100,000 characters; the luminance weights are the published formula, not shown in the excerpt)
- S35. Wikipedia, "ANSI escape code", https://en.wikipedia.org/wiki/ANSI_escape_code (read, first 100,000 characters)
- S36. Machado, Oliveira and Fernandes, "A physiologically-based model for simulation of color vision deficiency", IEEE TVCG 15(6), 2009, matrices at https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html (read)
- S37. The maintainer's kits, read-only: ~/code/emet/docs/brand/tokens.css, ~/code/aokit/docs/brand/tokens.css, ~/code/snug/docs/brand/tokens.css, ~/code/animated-fluent-emojis/docs/brand/tokens.css, ~/code/streamboss/brand/tokens.css
- S38. This repository, docs/brand/brief.md, docs/brand/competitors.md, docs/brand/naming-research.md
