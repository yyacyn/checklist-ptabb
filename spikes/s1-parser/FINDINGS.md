# Spike S1 findings — form parser

Date: 2026-10-05
Code: `spikes/s1-parser/parse.php`
Generated data: `spikes/s1-parser/REPORT.md`, `storage/app/spike/review-B008.csv`, `storage/app/spike/review-D062.csv`

**Verdict: S1 passes.** Both forms parse from the source documents without anybody typing a
question by hand. The counts land where the SRS predicted, and every known defect in SRS 5.3
was found by the parser rather than by luck.

---

## 1. Numbers

| | B-008 | D-062 |
| --- | ---: | ---: |
| Questions extracted | **428** (SRS said ~430) | **616** (SRS said ~600) |
| Structure | 17 sections (SRS said 17) | 12 chapters, 2 to 13 (SRS said chapters 2–13) |
| Groups | 17 | 39 (including subgroups) |
| Answer set detected | `yes / no / n/s` | `yes / no / ns / na` |
| Rows with guidance text | 63 | 263 |
| Rows needing a typed input | 2 | 10 |
| Rows with empty text | 0 | 0 |

Applicability defaults landed where SRS 5.4 says they should: chapter 8 (116 questions)
Tanker only, chapter 13 (12 questions) ice class only, the rest all vessel types.

## 2. The rule that did the heavy lifting

A table is a checklist only if its header row carries **two or more answer labels**
(Yes / No / NS / NA / N/S). Everything else is not a checklist, and that single rule
excluded the general information block, the index, the instructions, the appraisal tables,
the circulation table and the comparison blocks, with no hardcoded section names.

The second rule that saved us: **a question row must have exactly as many checkboxes as the
form's answer width.** This is what stopped three tables from becoming fake questions:

| Table | Boxes | Form width | Outcome |
| --- | --- | --- | --- |
| D-062 Report Summary ratings (chapter 1) | 3 | 4 | skipped, 4 rows |
| B-008 auditee evaluation blocks (4 auditees) | 5 | 3 | skipped, 28 rows |
| D-062 operations checkbox grid | mixed | 4 | skipped, not a checklist |

Without that rule, chapter 1 would have gained 13 phantom questions and the audit form 28
evaluation rows.

## 3. Every known defect in SRS 5.3 was found

| Known defect | Found by the parser |
| --- | --- |
| `claSMS` (claims) | yes, 1 row, auto-corrected and flagged |
| `trSMS` (trims) | yes, 1 row, auto-corrected and flagged |
| EnMS in both General and Environmental | yes, rows 29 vs 505 and 550, 96% similar |
| SEEMP in both General and Environmental | yes, rows 30 vs 551 and 32 vs 553 |
| Engineer's call alarm twice in Engine Room | yes, rows 386 vs 435, 92% similar |
| D-062 Master Standing Orders twice in Navigation | yes, rows 271 vs 300, 98% similar |

Duplicate detection is scoped to the **whole form**, not to one group. That matters: the
SEEMP and EnMS duplicates sit in different sections, so a per-group comparison would have
missed exactly the cases we were looking for. Total: **8 duplicate pairs in B-008, 13 in
D-062**.

## 4. What still needs a human, before import

| Item | Rows | What to do |
| --- | ---: | --- |
| `group_inferred_from_chapter` | 324 | Over half of D-062 has no group header of its own; the group was inferred from the chapter. Name or merge these in the editor |
| `markdown_emphasis_artifact` | 97 | Conversion artifact, see below. No action, but read one to be sure |
| `parenthetical_not_trailing` | 18 | A bracket exists but is not a clean trailing note, so it stayed in the question text. Confirm they read correctly |
| `escaped_comparison_operator` | 19 | Markdown escaped `<` and `>`; unescaped and flagged, spot-check a few |
| `struck_through_partial_review` | 6 | Real partial strikethrough in the source. Decide whether these items still apply |
| `dotted_blank_without_label` | 1 | A fill-in blank with no label; needs a human to say what it is |

## 5. Three findings that were not in the SRS

1. **The markdown conversion loses emphasis fidelity.** 97 D-062 questions arrive wrapped in
   `~~***…***`, for example `9. ~~***Condition Assessment Scheme if available**`. That is the
   converter's marker, not a deletion in the form. Consequence: **we cannot tell struck-through
   text from bold text in these files.** If the real `.docx` is available later, parse that
   instead and the question disappears. Where it matters, the reviewer must open the original.

2. **Chapter 9 and chapter 11 have two parallel group structures.** Chapter 9 yields both
   "Mooring & Anchoring Equipment" (13 questions) and an inferred "Mooring" (13 questions).
   Same pattern in chapter 11. The document genuinely breaks these chapters into two blocks,
   and the superadmin should decide whether that is two groups or one.

3. **Guidance is heavy in D-062: 263 of 616 questions.** 43% of the checklist needs an
   expandable help panel (FM-3). This is a UI requirement, not a data footnote, and it is
   why guidance must live in its own column rather than being appended to the question text.

## 6. Changes made to the SRS as a result

SRS 5.2 gained six parsing rules that the spike proved necessary:

- a checklist table is detected by its answer labels, never by a hardcoded section name
- a question row must have exactly the form's answer width
- a chapter titled "(continuing)" merges into the chapter it continues (17 such tables in D-062)
- a table with no group header inherits the chapter as its group, and says so
- cross-reference markers and escaped operators are cleaned, and flagged
- near-duplicate detection runs across the whole form at 90% similarity

## 7. Recommendation

Proceed. The review file is the human gate the SRS asked for, and it exists:
`storage/app/spike/review-D062.csv` and `review-B008.csv`, one row per question, with
`source_ref` pointing at the exact line in the source document so any row can be traced back.

Next: the `forms:import` artisan command in Phase 2.7 loads the reviewed file with a dry run
and is keyed on `source_key`, so re-running it after a review is safe.