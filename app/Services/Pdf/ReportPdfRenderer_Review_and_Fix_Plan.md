# ReportPdfRenderer: Review and Fix Plan

Reviewed: `App\Services\Pdf\ReportPdfRenderer`, against SRS v0.6 (sections 6, 7, 8, 10, 11, 13) and the Implementation Plan (Phase 6).

---

## 1. Verdict

The skeleton is good. The content layer is not shippable.

**Keep:** one engine for both forms, a per-form list of sections, HTML turned into a PDF by a queued job, a cache keyed on report version, a DRAFT watermark rule, auto-NA banners, and a photo appendix for large reports.

**Not shippable:** the renderer prints made-up text where real data should be, drops data the inspector entered, and has several bugs that only show up in a real PDF (wrong table widths, missing glyphs, comments repeated on every page). On an inspection or audit record, a PDF that says "No open items recorded" when there are open items is worse than a PDF missing the section.

There are 30 findings below: 13 blockers, 10 high, 7 medium or low. The plan in section 6 fixes them in an order that avoids rework.

### What I could and could not check

I only have this file, the SRS, and the plan. I do not have the models, migrations, controllers, or the other services. Each finding is tagged:

- **Confirmed**: visible in the code you sent.
- **Check**: depends on something I cannot see. Section 8 lists every property name to verify.

---

## 2. Blockers: wrong or missing content on the record

### R-01 Placeholder text is printed as if it were data. (Confirmed)
- Open items table always says "No open items recorded." The `report_open_items` table is never read.
- Circulation always says "Not yet circulated." It is printed twice in D-062: once inside `general_info` and again as its own `circulation` section.
- Follow-up from previous audit prints "-" for every field.
- Report summary prints "High: 0 observations", "Medium: 0", "Low: 0", and "0 No, 0 NS" per chapter. The counting loop body is an empty comment.
- Comparison blocks print one sentence each ("Findings from the last 3 reports of this vessel (INS-19).") with no data.

**Fix:** every block reads real data or is left out. A section with no data source yet (comparison blocks, until v1.1) is removed from the default layout, not printed as a placeholder.

### R-02 The report summary does not show which rating was chosen. (Confirmed)
The table header has three columns (Very Good, Satisfactory, Unsatisfactory). The body has one cell per row containing a single "●" with no column. A reader cannot tell Very Good from Unsatisfactory. This is the headline result of an inspection.

**Fix:** one cell per rating option, mark the chosen one.

### R-03 Chapter 1 data and several required blocks never print. (Confirmed, plus Check)
- Master, Chief Engineer, Chief Officer, and report reference number are not in the particulars table (INS-1).
- `renderVoyageInfo()` (sailing with vessel, from, to) is never called.
- Attendance questions (INS-13), appraisal of senior officers (INS-15), the summary text sections (INS-12), and the attachment list (INS-16) have no section in the layout.
- "FILL IN INSTRUCTIONS" and the table notes print only if a `static_texts` entry exists in the schema, and the default layout has none (REP-1f).
- Many values are read as `$report->psc_last_port ?? ''`, `$report->inspected_by ?? ''`, `$report->port ?? ''`, `$report->operations ?? []`. If a property does not exist, `??` turns the miss into a blank cell with no error. Data typed in the app can silently never reach the PDF.

**Fix:** a data builder (section 5.1) that reads each field explicitly, plus a test that every value in a full fixture appears in the HTML.

### R-04 Status handling is wrong in three places. (Confirmed, plus Check)
- The cover always prints `Status: DRAFT`, even for a closed report.
- `$isClosed` is computed in `wrapDocument()` and never used.
- `status` is compared against a string list in one place and against `ReportStatus::Closed->value` in another. If the model casts `status` to the enum, the strict `in_array(..., true)` never matches and the DRAFT watermark never prints.
- The cache key (R-19) ignores status, so a PDF built while the report was a draft can still be served, watermark and all, after it is submitted.

**Fix:** one helper that returns a status label and whether to watermark, used everywhere. Status goes into the cache key.

### R-05 The photo chapter has four independent problems. (Confirmed, plus Check)
- The filter reads `$p->photo_status`, but the SRS column is `status`. Because of `?? 'ready'`, every photo passes, including ones still processing or failed, whose files may not exist.
- Photos are not ordered. `$itemNo = $photo->item_no ?? 1` means unnumbered photos all print as "1".
- The image source is `$photo->file_url`. The PDF library must fetch it over HTTP, which needs remote loading enabled, is slow, and fails if the URL needs a login.
- When the count is over the threshold (REP-8), the code prints "Photo appendix generated separately" and then prints every photo anyway. The split does nothing.

**Fix:** read `status`, order by `item_no` then `id`, embed from a local file (R-23), and make the split real (section 6, phase E).

### R-06 User-controlled text goes into the HTML unescaped. (Confirmed)
The cover (`$reportRef`, `$vesselName`, `$formCode`), the footer, group titles, the NA reason, the chapter number, and `$photoUrl` are interpolated raw. The vessel name is typed by users. If remote loading is on, text like `<img src="http://...">` makes the server fetch arbitrary URLs.

**Fix:** use Blade, which escapes by default (section 5.2). Remote loading stays off.

### R-07 The answer marks may not render at all. (Confirmed code, Check in the output)
The document font is "Times New Roman", which both libraries map to a core font with Latin-1 only. The characters used for answers and checkboxes (`●`, `☒`, `☐`) are outside it. The usual result is `?` or empty boxes in the Yes/No/NS/NA columns.

**Fix:** set a Unicode font (DejaVu Sans ships with both libraries) and use plain ASCII for the answer cell: an `X` in the chosen column. The S2 spike should extract the text of the output to prove it.

### R-08 B-008 is missing most of its form and prints inspection fields. (Confirmed)
- The default B-008 layout has no auditee evaluation (the 1 to 5 scores), no auditors/auditees list, no execution log, no general comments, and no distribution list (AUD-3, AUD-11 to AUD-15).
- `audit_header` lists `components`, but the renderer ignores that list and prints inspection particulars ("Inspected By", "Port") and the operations list for both forms.
- The audit summary reuses the D-062 observation columns (VIQ paragraph, Risk, Job order). A B-008 non-conformity has an ID, issue date, kind, and close-out target date, and the form also has totals of NCs and observations.
- It calls the chapter ratings matrix unconditionally. B-008 has no chapter ratings.
- Operations are one shared list of 17 items. D-062 gets "Repairs afloat" and "Drydock" and B-008 gets "IGS in operation" and "COW in progress", none of which are on those forms.

**Fix:** per-form operation lists from config, and dedicated B-008 sections (phase D).

### R-09 Comments/remarks are in `<tfoot>`, which can repeat on every page. (Confirmed code, Check in the output)
In an HTML table, `tfoot` is a repeating footer group. A chapter that spans three pages can print the same comments three times.

**Fix:** put the comments in a separate block after the table.

### R-10 The header row gets the wrong CSS class. (Confirmed)
`implode('</th><th class="q-col">', $columnLabels)` puts `q-col` (width 45%) on every header cell after the first. The Yes/No/NS/NA headers get the same 45% width as the Item column.

**Fix:** build the header cells from the answer columns individually, each with the right class.

### R-11 Question and chapter numbering is wrong. (Confirmed, plus Check)
- `$sortOrder++` also runs for subgroup header rows, so question numbers skip.
- The printed question text still starts with the old Word number ("61. CO2 ..."), because the import left it in `question_text`. The row then shows its own number next to it: `17 | 61. CO2 ...`.
- B-008 groups have no `chapter_no`, so the code falls back to `sort_order`, which starts at 0 in the imported data. The first section prints as "Chapter 0 - General". B-008 also calls them sections, not chapters.
- Ratings are saved under `chapter_` + `sort_order`, but the table shows `chapter_no`. Two different numbers for one thing.

**Fix:** freeze a `display_no` on report groups and questions when the report is created, and print that. Never count in the renderer.

### R-12 No page numbers, no index. (Confirmed)
The footer prints a literal `{PAGE}`. That token means nothing to dompdf, and mPDF's tokens are `{PAGENO}` and `{nbpg}`. REP-1e (generated index with real page numbers) and REP-1a ("page x of y") are not implemented.

**Fix:** use the library's own page-number mechanism, and for the index use mPDF's TOC support (decision in phase A).

### R-13 About 650+ queries per PDF. (Confirmed)
The docblock says relations must be pre-loaded, but the code calls `$group->questions()`, `$group->subgroups()`, and `$subgroup->questions()` as query builders inside loops. That bypasses eager loading. Then `$question->answer` lazy-loads once per question. `renderRatingsMatrix()` runs the groups query again, and the checklist and the summaries each run it separately.

**Fix:** load once with a fixed query set (section 5.1) and test the query count.

---

## 3. High

### R-14 The "schema-driven" claim is not true. (Confirmed)
- The `components` array is ignored (`general_info` and `audit_header` hardcode their parts).
- `position: after_chapter_15` is ignored.
- `summary_schema` (title, ratings matrix on/off, text fields, findings register) is ignored, despite FM-7b. The code branches on `$isB008` and `$report->form->code === 'D-062'` instead.
- Chapter numbers 14, 15, 16, and 18, signature roles, and the cover titles are hardcoded.
- `column_labels` in the schema and `answer_set` on the form can disagree, and the table would be wrong.

**Fix:** a typed layout contract validated when saved (section 5.3), and section views that read their config.

### R-15 Applicability is only half shown. (Confirmed)
The banner works for a group. A question that is auto-NA gets no marker or reason. A whole inapplicable chapter still prints every row as an empty table.

**Fix:** mark auto-NA questions with the reason, and print an inapplicable chapter as its title plus a banner only (decision D-2).

### R-16 Failures are silent. (Confirmed)
- An unsupported section type returns an HTML comment, so a typo in the schema silently drops a section.
- A missing report date falls back to `now()` and prints today's date on the record.
- `?? ''` hides missing data everywhere (R-03).

**Fix:** unknown section types and missing required fields throw. The job fails visibly and the user sees "PDF failed".

### R-17 Typed answers have no output path. (Confirmed, plus Check)
`extra_value` prints only when the answer is yes/no/ns/na, and prints raw. If it holds JSON for several inline fields, the PDF shows the JSON. Questions whose type is date or text have no answer in the Yes/No columns, so their value does not print at all. Chapter 1 questions (port, PSC, dry dock dates) are skipped by the checklist renderer.

**Fix:** a formatter that turns each question's typed values into labelled text under the question.

### R-18 Multi-line text collapses. (Confirmed)
Comments, best practices, and summary text go through `htmlspecialchars` only. Line breaks disappear and a three-paragraph note prints as one run-on line.

**Fix:** `nl2br(e(...))` in a shared helper, plus `word-wrap: break-word` for long strings.

### R-19 The cache is unreliable. (Confirmed, plus Check)
- `isCacheStale()` compares only `pdf_version !== current_version`. It ignores status, reviewer, closed date, layout changes, and renderer changes. It also uses strict comparison, so an int vs a string version always reads stale.
- `markPdfGenerated()` uses `update()`. If `pdf_path` and `pdf_version` are not in `$fillable`, the write is silently ignored. If a model observer bumps `current_version` on any update, the PDF is stale the instant it is saved.
- The file name contains the version, so every version stays on disk. On a quota-limited cPanel host that adds up.
- `pdfStoragePath()` says it creates the directory and does not. `Storage` is imported and unused.
- Who bumps `current_version` on each autosave is not visible here. It needs to happen without an extra write on the hot path.

**Fix:** a fingerprint (section 5.5), a `forceFill` or query-builder update that bypasses observers, deletion of the previous PDF after a successful build, and a test that proves the cache invalidates.

### R-20 The findings table is thin and guesses column names. (Confirmed, plus Check)
- It prints the chapter title only. The D-062 rule is to cross-reference the item, so the chapter number and item number are needed.
- `$finding->risk ?? $finding->severity ?? '-'` guesses two column names. `$finding->chapter_label ?? $finding->group?->title` guesses another. Findings link to a question, not a group.
- The D-062 table prints an empty header with no rows. The audit table prints "No observations recorded."

**Fix:** read the real columns, add an "Item" column from `display_no`, and show one consistent empty state.

### R-21 The CSS has gaps. (Confirmed)
- Classes used in the HTML but not defined: `chapter-header`, `chapter`, `text-center`, `guidance`, `extra-value`, `subgroup-header`, `na-reason`, `ratings-table`, `counts-summary`, `empty-row`, `photo-meta`, `photo-title`, `photo-number`. So answer marks are not centered, subgroup headings look like normal rows, and chapter headings are unstyled.
- No `@page` rule. No margins, no reserved footer space, so the fixed footer overlaps the last lines of each page.
- The watermark is a fixed element with `z-index: 9999` and `transform: rotate(-30deg)`. It sits over the text in solid light grey, and CSS transforms are unreliable in both libraries.
- No `tr { page-break-inside: avoid }`, so a row can split across pages.

**Fix:** a stylesheet that defines every class used, an `@page` block, and the library's native watermark.

### R-22 The ratings table may skip a chapter. (Check)
The summary lists chapters 1 to 13 (REP-1c). The code skips chapter 1 (`isChapterOne`), giving 12 rows. Confirm against the form.

### R-23 Memory. (Confirmed)
dompdf decodes images at full size. 30 photos at 2000 x 1500 px can need roughly 350 MB. The whole document is also built as one string. S2 has not been run, and the host `memory_limit` is unknown.

**Fix:** a PDF-sized photo copy and chunked output (sections 5.4 and 6, phases A and E).

---

## 4. Medium and low

- **R-24 Time.** `now()` is used in the footer and the cover, in server timezone, with no zone label (NFR-16). The footer also prints the generation date twice: once from the `generation_date` field in `buildFooterText()` and again with `Generated:` in `wrapDocument()`.
- **R-25 Dead code.** `renderVoyageInfo()`, `$isClosed`, the third parameter of `renderSubgroupHeader()`, the `$schema` argument of `documentStyles()`, and unused imports (`Storage`, `HtmlString`, `VesselName`).
- **R-26 Version prefix.** The code adds `v` before `form_version` in the cover and footer, but the default string elsewhere is `'v01.01'`. If the stored value already has a `v`, it prints `vv01.01`. (Check)
- **R-27 Internal codes on the printed page.** "(INS-19)" and "(REP-8)" appear in output text. Requirement IDs belong in the SRS, not on a legal document.
- **R-28 Wasted pages.** Circulation, signatures, and each comparison block each force a page break. A signature block alone on a page is easy to lose.
- **R-29 Unvalidated layout JSON.** Keys are inconsistent (`title_key` vs `title`, `photo_appendix_threshold` at top level but read from the section config, so the default of 100 always wins).
- **R-30 No tests.** Nothing here is covered by a test, including the query count.

---

## 5. Target design

```
ReportDocumentBuilder::build(Report): ReportDocument   (plain arrays, no Eloquent)
SectionRegistry:   section type => Blade view + required data keys
ReportPdfRenderer::chunks(ReportDocument, layout): array<string>   (HTML per section)
PdfWriter (interface): MpdfWriter | DompdfWriter       (chosen by S2)
GenerateReportPdf job: build -> render -> write -> record path + fingerprint
```

### 5.1 Data layer
- One builder loads the report once with a fixed set of queries: groups, questions with answers, findings, photos, ratings, circulation, open items, attendance, appraisals, and the audit extras for B-008. Target: 12 queries or fewer for a 600-question report. A test asserts it.
- Output is a plain array (a `ReportDocument`). The Blade views see only that. This also makes the renderer testable without a database.
- `display_no` is frozen on `report_groups` and `report_questions` at creation. This is a small migration plus a change to the snapshot service.
- Required fields are checked here. A missing report date, vessel type, or reference number fails the build.

### 5.2 Views
- One Blade partial per section type, for example `pdf/sections/checklist.blade.php`. Blade escapes by default, which removes R-06.
- Shared partials for the table header, the answer cell, the comments block, and `nl2br(e())`.
- The layout schema lists sections and their config. The registry rejects unknown types.

### 5.3 Layout contract (validated on save)

```json
{
  "page": {"size": "A4", "margins_mm": [18, 14, 20, 14]},
  "footer": ["form_code", "form_version", "report_number", "page_x_of_y"],
  "sections": [
    {"type": "cover"},
    {"type": "fields", "title": "Vessel particulars", "keys": ["vessel_name", "vessel_imo", "vessel_flag"]},
    {"type": "choice_list", "key": "operations"},
    {"type": "table", "dataset": "open_items", "columns": ["kind", "description", "due_date"]},
    {"type": "checklist", "chapters": "2..13"},
    {"type": "text_block", "key": "best_practices", "title": "Best Practices"},
    {"type": "findings", "columns": ["item", "viq", "description", "risk", "job_order"]},
    {"type": "score_matrix", "key": "chapter_ratings", "options": ["Very Good", "Satisfactory", "Unsatisfactory"]},
    {"type": "photos", "appendix_threshold": 100},
    {"type": "signatures", "roles": ["Inspector", "Master"]}
  ]
}
```
Chapter numbers, titles, signature roles, and operation lists come from here or from the form, never from PHP.

### 5.4 Photos
- The optimizer job (task 5.7) also writes a third copy: about 1000 px on the long edge, JPEG, around 150 KB, stored as `pdf_path`. The PDF reads that file from disk. No URL.
- A one-time command backfills the copy for existing photos.
- The writer prints two or four photos per page in a fixed grid, so memory use per page is predictable.

### 5.5 Output and cache
- Fonts: DejaVu Sans, plus ASCII `X` for answers. The S2 test extracts the text and checks it.
- Page numbers, "page x of y", and the index use the library's own tokens.
- Watermark: the library's native watermark, not CSS.
- Cache fingerprint: report id, `current_version`, status, reviewer and closed timestamps, form `template_version`, layout hash, and a renderer version constant. Stored as a string, compared with `!==` on strings.
- After a successful build, delete the previous PDF. Keep closed reports' final PDF.
- Time: footer and cover show UTC with the label, or the office timezone with the label. One rule (decision D-6).

### 5.6 Keeping it form-agnostic

Rule: the PHP never mentions D-062 or B-008. A new form is a form record plus a layout JSON, with no code change. The renderer only knows a fixed set of generic section types:

| Type | What it prints | D-062 uses it for | B-008 uses it for |
| --- | --- | --- | --- |
| `cover` | Title from the form name, reference, vessel, date, status | Cover | Cover |
| `fields` | Labelled values from a list of keys in the config | Particulars, PSC and dry dock, voyage | Audit details, previous audit follow-up |
| `choice_list` | Multi-select from a config list | Operations | Operations |
| `table` | Repeating rows from a named dataset, columns from config | Open items, circulation, attendance, appraisals | Auditees, auditors, execution log, distribution |
| `score_matrix` | Rows against a set of score options | Chapter ratings (3 options) | Auditee evaluation (criteria against 1 to 5) |
| `text_block` | Titled text from a key | Best practices, summary text | General comments |
| `checklist` | Chapters and questions from the report snapshot | Chapters 2 to 13 | 17 sections |
| `findings` | Findings with configured columns | Observations (VIQ, risk, job order) | NCs (ID, issue date, kind, target date) |
| `photos` | Photo chapter or appendix | Chapter 16 | Optional |
| `signatures` | Blank lines for roles from config | Inspector, Master | Lead auditor, auditors |

What this means in practice:
- Chapter numbers, titles, column sets, operation lists, signature roles, and static texts live in the layout JSON or the form, never in PHP.
- A third form (say a pre-arrival checklist) is a new form record, imported questions, and a layout using these types.
- Something truly new (a chart, a map) is one new section type with a Blade view. It does not touch the others.

Where it is not yet form-agnostic: the SRS data model (sections 14.3 and 14.4) gives each repeating block its own table (`report_open_items`, `auditees`, `audit_execution_log`, and so on). Those tables are specific to these two forms, so a new form with a new repeating block needs a migration. The alternative is one generic `report_datasets` table (report id, dataset key, rows as JSON) for form-specific repeaters, with real tables kept only for what is queried across reports (answers, findings, photos). That trade is decision D-8.

---

## 6. Fix plan, in order

Durations are rough working days for one developer, to show sequence, not to promise dates.

### Phase A: S2 spike (1 to 2 days). Do this first.
Your plan already gates feature work on it, and the result is still blank. Build a harness that renders one 100-row D-062 chapter, the report summary, and 30 photos (using the 1000 px copies) through mPDF and dompdf on the real host. Record peak memory against the real `memory_limit`, wall time, file size, header repeat across pages, and the text extracted from the PDF (glyphs, page numbers). My expectation is mPDF, because of the index and page x of y, but the number decides.

**Output:** one chosen library, and a yes or no on whether the REP-8 appendix split is mandatory.

### Phase B: Builder and snapshot (2 days)
- `display_no` migration and snapshot change.
- `ReportDocumentBuilder` with the fixed queries and required-field checks.
- Test: query count, and one full fixture report.

### Phase C: Patch what is broken regardless (1 to 2 days)
These do not depend on the rewrite and can ship to the current file today if you want fixes early: R-02 (ratings cell), R-04 (cover status), R-05 (photo `status` column, ordering), R-09 (comments out of `tfoot`), R-10 (header classes), R-12 (page-number token), R-18 (`nl2br`), R-21 (missing CSS and `@page`), R-24 (duplicate generation date), R-27 (requirement IDs on the page).

### Phase D: Sections (4 to 5 days)
In this order, each with its test:
1. Cover and footer.
2. Report header: particulars (including master, chief engineer, chief officer, reference, voyage), operations, PSC and dry dock, open items from the table.
3. Checklist chapters with answer columns, typed values, auto-NA reasons, the comments block, and compact inapplicable chapters.
4. Best practices, findings summary with item references, and the ratings summary with real counts.
5. Attendance, text sections, appraisals, attachments list.
6. Circulation (once) and signatures.
7. B-008, built as layout config using the generic types in 5.6 (`fields`, `table`, `score_matrix`, `text_block`, `findings`), not as new PHP: audit details, auditees, auditors, follow-up from the previous audit, auditee evaluation, execution log, general comments, NC and observation list with totals, distribution list.
8. Comparison blocks: hidden until INS-19 ships in v1.1.

### Phase E: Photos and appendix (1 to 2 days)
- `pdf_path` copy in the optimizer, backfill command.
- Ordered, grid-based photo chapter. Skip anything not `ready`.
- Real REP-8 split: when over the threshold, a separate appendix PDF, the main document links to it by name.

### Phase F: Job, cache, and failure handling (1 to 2 days)
- Queued job on its own queue with `--timeout` inside `max_execution_time`.
- Fingerprint cache, previous-PDF cleanup, `forceFill` update.
- Visible states: queued, building, ready, failed with a retry.
- If the PDF cannot be built within the host limits, the print stylesheet fallback (REP-7) stays available.

### Phase G: Tests (running through all phases, about 2 days total)
- Golden fixture: every value entered appears in the HTML.
- Query count of 12 or fewer.
- Escape test: a vessel name containing `<script>` or `<img src="http://x">` is printed as text.
- Draft report has the watermark and closed does not. A status change invalidates the cache.
- Each of the three ratings prints in the right column.
- Counts match the findings.
- A processing or failed photo is not printed, and photos print in `item_no` order.
- A text extraction of the real PDF shows the answer marks, no `?` boxes, and "Page 1 of N".
- A B-008 fixture includes the evaluation, execution log, and NC list.
- Peak memory and time on the host are inside the S2 limits.

**Total, roughly 10 to 13 working days**, against the plan's 8 to 10 for Phase 6. The difference is the B-008 sections and the data builder, which the plan did not size.

---

## 7. Decisions needed

| # | Decision | My recommendation |
| --- | --- | --- |
| D-1 | Answer column order. The source D-062 uses Yes/No/NS/NA in some chapters and Yes/No/NA/NS in others. REP-1 says reproduce the layout. | Print one normalised order. The meaning is in the label, not the position, and the app stores answers by label. |
| D-2 | An inapplicable chapter: print every row as NA, or a title and a banner only? | Banner only. A reader still sees it was skipped with a reason, and the PDF stays short. |
| D-3 | Comparison blocks in v1 | Hide until INS-19 has data. |
| D-4 | Operations lists per form | Store as config per form, not the union of both lists. |
| D-5 | Ratings table rows: chapters 1 to 13 or 2 to 13? | Check the source form and match it. |
| D-6 | Time on the PDF | Show UTC with the label for the generation time, and the vessel's local date for the report date. |
| D-7 | Photos per page | Two per page for ordinary reports, four per page when the appendix is large. |
| D-8 | Form-specific repeating data: a dedicated table per block (as the SRS has now) or one generic `report_datasets` JSON table? | Generic datasets if you expect more forms. Dedicated tables if you only ever have these two and want to query them in SQL. |

---

## 8. Things to verify in the code I cannot see

Each of these is read by the renderer. If a name does not exist, `??` hides it.

- `reports`: `inspected_by`, `port`, `operations`, `vessel_ice_class`, `vessel_imo`, `vessel_flag`, `vessel_gt`, `vessel_built`, `psc_last_port`, `psc_last_date`, `psc_detained_or_deficiencies`, `drydock_last_date`, `drydock_next_date`, `sailing_with_vessel`, `sailing_from`, `sailing_to`, `summary_ratings`, `summary_data`, `pdf_path`, `pdf_version`, `current_version`, `status` (string or enum cast).
- Whether `pdf_path` and `pdf_version` are in `$fillable`, and whether an observer bumps `current_version` on update.
- `forms`: `layout_schema`, `summary_schema`, `form_version` (does it already start with `v`?), `answer_set`.
- `photos`: the status column name (`status` vs `photo_status`), `item_no`, `file_url`, `category`, `title`, `description`.
- `findings`: the real risk column, `chapter_label`, whether a `group` relation exists, `target_date` cast.
- Where `report_open_items`, `report_circulation`, `report_attendance`, `report_appraisals`, `auditees`, `auditors`, `audit_execution_log`, `auditee_evaluations` actually exist as tables, or whether any of that data lives in JSON on `reports`.
- The host's `memory_limit`, `max_execution_time`, and which of GD or Imagick is loaded.

---

## 9. Definition of done

1. Every value in the golden fixture appears in the HTML and in the extracted PDF text.
2. No placeholder text, no requirement IDs, and no hardcoded zero counts in any output.
3. Query count of 12 or fewer for a 600-question report.
4. Draft, in-progress, and reopened reports carry the watermark. Submitted, reviewed, and closed reports do not. Changing status invalidates the cache.
5. D-062 and B-008 both print every block their source form has, in the SRS order, with the Report Summary after Chapter 15.
6. The S2 numbers for memory and time are met on the real host with a full 600-question report and 30 photos.
7. A report above the photo threshold produces a document PDF and an appendix PDF.
