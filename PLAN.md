# Implementation Plan — Vessel Audit & Inspection App

Version 1.1
Derived from `SRS.md` v0.7 and `ERD.md` (section for the audit needs updating, task 7.2). Read those two first; this file is only the order of work.

**1.1:** Phase 7 rewritten for the simplified audit (SRS 0.7, sections 7 and 14.4). The four audit tables built under the old 7.1 are replaced by `summary_data` plus a generic `report_datasets` table, so Phase 7 now starts with a rework, not with new screens. Phase 10, the decisions table, the risk register, and the last section are adjusted to match.

Estimates are working days for one developer and are deliberately rough. They exist to show
sequencing, not to promise dates.

---

## 1. Shape of the work

Three things dominate everything else:

1. **The forms are imported, not typed.** ~1,000 questions come out of two Word documents.
   If the parser is wrong, every screen after it is wrong too. Hence the spikes.
2. **VSAT is the environment, not an edge case.** Autosave, retries and small payloads are
   not polish, they are the product working at all.
3. **PDF layout is a whole project on its own** now that REP-1 reproduces the source form.

Everything else (roles, galleries, findings) is ordinary Laravel work and is not interesting.

```
Phase 0  Spikes ─────────────► GATE 1
Phase 1  Schema + snapshot ───► GATE 2
Phase 2  Form management
Phase 3  Data entry (VSAT)
Phase 4  Findings (v1 subset)
Phase 5  Photos
Phase 6  PDF
Phase 7  Audit specifics
Phase 8  Admin + audit log
Phase 9  Hardening + deploy ──► v1 release
Phase 10 v1.1
```

Phases 2 to 7 are not strictly sequential in code, but they are sequential in review: each
phase ends with something a real user can be shown.

---

## Phase 0 — Spikes (3 to 5 days)

Throwaway code. Nothing here ships. Each spike ends in a written answer, not a merged branch.

| # | Spike | Question it answers | Method | Output | Result |
| --- | --- | --- | --- | --- | --- |
| S1 | **Form parser** | Can the two documents be parsed reliably enough that nobody types questions by hand? | Parse both source documents into the §5 review file | Group and question counts per form vs the SRS numbers, warning list, duplicates | **DONE. 428 questions in 17 sections (B-008), 616 across chapters 2 to 13 (D-062). All 6 known defects in SRS 5.3 found. See `spikes/s1-parser/FINDINGS.md`** |
| S2 | **PDF renderer** | dompdf or mPDF? Does the faithful layout fit the inherited memory limit? | Build one 600-row checklist chapter + the moved Report Summary + 30 photos in both renderers, measuring peak memory against the host's actual `memory_limit` | Wall time, peak memory vs limit, file size, whether chapter table headers repeat across pages correctly, and whether the REP-8 appendix split is mandatory |
| S3 | **Photo pipeline** | Does a 20 MB phone photo survive the trip when INI cannot be raised? | Browser resize → upload → queued optimise → thumbnail, at 20 MB and 40 MP, against the host's real `upload_max_filesize` | Wall time, peak memory vs limit, final size against the 300–800 KB target (IMG-8), and what the user sees when the original is too big for the host |

**GATE 1** — before any feature code:
- S1 result: **parsing works.** Counts match the SRS predictions, and the two parsing rules that matter (answer-label detection, answer-width matching) are now written into SRS 5.2. Nothing about §5 needs rewriting. The import in task 2.7 loads the review file rather than re-parsing.
- S2 result fixes the renderer and tells us whether the photo chapter needs the REP-8 appendix split. With inherited INI, if neither renderer fits, a document-only PDF plus a photo appendix is the plan, not a fallback.
- S3 result confirms or replaces the client-first pipeline. Because `upload_max_filesize` cannot be raised, a browser that cannot resize means an upload that cannot happen, so the spike also tests the failure message the user would see.

---

## Phase 1 — Schema, roles, and the snapshot (6 to 8 days)

The point of this phase is the correctness rule, not the tables.

| # | Task | Notes |
| --- | --- | --- |
| 1.1 | Migrations group 1: reference and templates | ERD §2. `users` role/vessel_name/is_active, `vessel_types`, `forms`, `form_groups`, `form_questions`, `form_applicability`, `evaluation_criteria` — **done** |
| 1.2 | Models, factories, seeders | **done**: 6 models, 6 factories, `FormSeeder` loads 1,044 questions in 47 groups, 11 tests |
| 1.3 | `forms.template_version` bump rule | **done**: `Form::bumpTemplateVersion()`, bumped only on structural change (question added, removed, regrouped), never on a wording typo |
| 1.4 | Migrations group 2: reports, groups, questions, answers | **done**: ERD §3, including `client_save_id` and `row_version`, 4 models, 4 factories |
| 1.5 | **`ReportSnapshot` service** | **done**: On creation: copy enabled groups and questions, resolve applicability from the typed vessel type and ice class, stamp `template_version`, insert group comment boxes (FM-7a) |
| 1.6 | **The critical test** | **done**: `ReportSnapshotTest`, asserts existing report's text, order and applicability are byte-identical after template edits, disables, archives, reordering, and additions (FM-8, FM-9) |
| 1.7 | `ReportStatus` + policy | **done**: Section 10 state machine, server-side transition validation, flush-before-transition & RLS-2 missing answer guards |
| 1.8 | `ReportNumberService` | **done**: Transactional sequence, unique index, daily & form rollover (`FORMCODE-YYYYMMDD-NN`, RLS-7) |
| 1.9 | Vessel name normalisation + `KnownVesselNames` lookup | **done**: SRS 2.1: normalise on write, distinct-name lookup for autocomplete |
| 1.10 | Policies and access matrix | **done**: `ReportPolicy` (Role × module × action, vessel-name scoping, auditee evaluation & appraisal privacy) |

**GATE 2 PASSED** — the snapshot test passes, and reports can be created, answered, submitted,
reopened and closed through the console with complete transition validation and access control.

---

## Phase 2 — Form management (5 to 7 days)

| # | Task | Ref |
| --- | --- | --- |
| 2.1 | Group and subgroup tree: add, rename, reorder (drag and up/down), disable, archive | **done**: `FormGroupController`, tree UI in `forms/show.tsx`, reorder, toggle, archive-if-used (FM-1, FM-2, FM-9) |
| 2.2 | Question editor: text, guidance, input type, enable/disable, duplicate, archive | **done**: `FormQuestionController`, wording edit vs structural bump rule, duplication, reorder, archive-if-used (FM-1, FM-3, FM-6, FM-9, FM-12) |
| 2.3 | Bulk actions: disable a whole group, move questions between groups | **done**: bulk-toggle group/subgroups/questions, bulk-move questions between groups with order append and template version bump (FM-6) |
| 2.4 | Applicability editor: vessel types, ice class, at group and question level | **done**: vessel types and ice class rules on groups and questions with live filter dialog and template bump (FM-4) |
| 2.5 | "Used in N reports" warning on delete, archive instead of delete | **done**: "Used in N reports" warning dialog on deletion, soft-archive if used in historical reports vs hard-delete if never used (FM-9) |
| 2.6 | Change history per group and question | **done**: append-only `activity_log` audit trail, recording group & question mutations, history modal viewer (FM-7, FM-12) |
| 2.7 | Template catalogue seeded from the reviewed CSV | `FormSeeder`, dry run via `FORMS_SEED_DRY=1`. Already built in Phase 1 |
| 2.8 | Tests: seed idempotency, archive rules, reorder stability | §5.5, done for the seed; the rest lands with the editor |

---

## Phase 3 — Data entry, the VSAT-critical path (10 to 12 days)

This is the phase users feel. Budget it properly.

| # | Task | Ref |
| --- | --- | --- |
| 3.1 | Report creation: typed vessel particulars, known-name autocomplete, type and ice class, reference number | **done**: `ReportController`, `reports/create.tsx`, `reports/index.tsx`, `ReportCreationTest` (INS-1, AUD-1, SRS 2.1) |
| 3.2 | One group per screen, sticky chapter nav, progress per group, unanswered filter, search-jump | **done**: `reports/show.tsx` single-chapter screen, sticky sidebar, progress counters, unanswered filter, search-jump (NFR-3, INS-8, INS-22) |
| 3.3 | Answer row: Yes/No/NS/NA (D-062) or Yes/No/N/S (B-008), note, typed extra input, guidance expander | **done**: segmented answer pills, expandable guidance panel, inline note textarea, typed extra inputs (INS-5, AUD-6, AUD-7, FM-3) |
| 3.4 | **Autosave engine**: debounce, flush on blur / 5s / group exit, saved-saving-retrying indicator | **done**: debounced autosave, blur & chapter exit flush, status indicator in `reports/show.tsx` (NFR-1, NFR-2) |
| 3.5 | **Browser retry queue** in IndexedDB, idempotent `client_save_id`, reconcile on reconnect | **done**: native IndexedDB retry queue in `resources/js/lib/autosave-queue.ts`, idempotent backend in `ReportController.php`, reconnect reconciler (NFR-2) |
| 3.6 | Conflict handling: stale `row_version` refused and surfaced, advisory edit lock with "X is editing" | **done**: optimistic locking via `row_version` & HTTP 409 conflict UI, report advisory lock endpoints & banner in `reports/show.tsx` (NFR-15) |
| 3.7 | Inapplicable items shown as locked `NA` with reason, overridable | **done**: frozen snapshot flags `is_applicable=false`, rendered as locked `NA` with applicability badge (FM-4, FM-4a) |
| 3.8 | Group comments box with the NS/NA hint | **done**: Chapter remarks textarea with NS/NA explanation prompt and auto-save endpoint (INS-6, FM-7a) |
| 3.9 | Streamlined checklist; dedicated Chapter 15 Summary of Observations section (Chapter, VIQ, Description, Risk Level, Job Order) | **done**: Streamlined Yes/No/NS/NA choices without popups; dedicated Chapter 15 section matching Form D-062 (INS-9, REP-1) |
| 3.10 | Undo of a recent answer | **done**: transient inline Undo button with 8s window in `QuestionAnswerCard`, logs changes from/to `No` in `activity_log` (INS-23) |
| 3.11 | Tests: payload sizes, one-answer-per-request, retry does not duplicate, never posts a whole chapter | **done**: isolated payload tests, ActivityLog tests, idempotency retry tests in `ReportDataEntryTest.php` (NFR-13, cPanel check 4) |

---

## Phase 4 — Chapter 15 Summary & Findings (3 to 4 days)

| # | Task | Ref |
| --- | --- | --- |
| 4.1 | **Schema-Driven Summary Chapter & Findings**: (1) Dynamic `forms.summary_schema` defining form-specific summary layout (ratings matrix, custom executive textareas, findings register, custom titles), (2) Observation rows CRUD (Chapter, VIQ, Description, Risk Level High/Med/Low, Job Order No.), (3) Flexible `reports.summary_data` (JSON) storage with debounced autosave, (4) In-tree Summary Chapter Builder in Form Editor | **done**: dynamic schema configuration on `Form`, in-tree summary chapter card in Form Editor (`forms/show.tsx`), dynamic summary renderer in `reports/show.tsx`, `findings` table, `FindingController`, `updateSummary` endpoint, ActivityLog audit (INS-10, INS-11, INS-12, FND-1, INS-9, AUD-9, FM-7b) |
| 4.2 | Findings list per vessel name with filters, scoped by role | **done**: centralized Findings Register (`/findings`), role-scoping for vessel users (`SRS §2.1`), filters (vessel, risk, status, form, dates, search), KPI summary cards, sidebar navigation (FND-2) |
| 4.3 | Photo & Evidence schema: `photos` entity with report, question, and finding relations; schema-driven Photo Chapter definition on forms | **done**: `photo_categories` and `photos` database migrations, `Photo` & `PhotoCategory` Eloquent models with cross-form relations (`Report`, `ReportQuestion`, `Finding`), `forms.photo_schema` JSON column, `PhotoCategorySeeder` (PHO-0, PHO-2, PHO-5) |

---

## Phase 5 — Photo Chapter & Photographic Records Engine (8 to 10 days)

| # | Task | Ref |
| --- | --- | --- |
| 5.1 | Photo Category CRUD (Hull, Deck, Engine Room, Bridge, Navigational, Safety, Room, etc.), seeded with standard categories | **done**: `photo_categories` migration and `PhotoCategorySeeder` with standard 8 maritime categories (§8.1) |
| 5.2 | **Composable Photo Form Builder in Form Editor**: (1) First-class Photo Form template support (`forms.form_type = 'photo'`), (2) Superadmin can attach and configure an existing Photo Form into any parent Form (e.g. Chapter 16 Photographic Records in D-062), (3) Standalone Photo Form seed `P-001` | **done**: `forms.photo_schema` & `form_type`, Photo Chapter Card in Form Editor (`forms/show.tsx`), Table of Chapters sidebar navigation, `PUT admin/forms/{form}/photo-schema` endpoint, category selection pills, template version bumping (PHO-0) |
| 5.3 | **Multi-Photo Structured Form & Upload Queue**: User can create standalone photo reports and fill embedded photo chapters with structured inputs (Number, Title/Caption, Category, Description/Remarks) | **done**: standalone & embedded photo report chapters in `photo-chapter-section.tsx`, slot mapping & custom additions (PHO-1, IMG-7) |
| 5.4 | Client-side image resize & auto-orient (longest edge 2000 px, quality 80) to protect VSAT satellite bandwidth | **done**: `image-compressor.ts`, `createImageBitmap` EXIF auto-orient, canvas 2000px downscale & 80% JPEG compression (IMG-2) |
| 5.5 | In-browser HEIC to JPEG conversion for mobile Safari / iOS photos; clear rejection for unsupported files | **done**: `heic2any` integration in `image-compressor.ts`, unsupported file validation & graceful error alerts (IMG-2a, IMG-4) |
| 5.6 | Upload API endpoint: 20–25 MB client accept, checksum deduplication, and payload protection | **done**: `PhotoController@store` with 25MB limit, sha256 checksum hashing & payload validation (IMG-1) |
| 5.7 | Queued optimizer job: auto-orient, recompress, metadata strip, 400 px thumbnail generation | **done**: `ImageOptimizer` service with GD auto-orient, recompression, EXIF strip & 400px thumbnail generator (IMG-3, IMG-5, IMG-6) |
| 5.8 | **Fleet Photo Gallery (`/photos`)**: Browse, search, and filter photos by vessel, category, date, and report; role-scoped for vessel users | **done**: `resources/js/pages/photos/index.tsx`, role scoping for vessel users, filters, lightbox inspection (PHO-4, PHO-8) |
| 5.9 | **Cross-Form Attachment**: 1-click attach/link photo records to checklist questions (as evidence) or findings (as defect/closeout proof) | **removed**: `PhotoEvidenceDialog` & `PhotoEvidenceStrip` components removed from `question-answer-card.tsx` and `observations-section.tsx`; photo evidence attachment feature dropped from the report show page |
| 5.10 | **Automatic Photo Appendix Sequencing**: all photos attached to the Photo Chapter are rendered sequentially by item number/category into the PDF appendix (manual include/exclude toggle dropped as unnecessary friction) | **done**: automatic sequential ordering by item_no/slot in Photo Chapter (PHO-6, REP-3) |
| 5.11 | Soft delete with reason, photo record locking at `submitted` status | **done**: `SoftDeletes` with `delete_reason` on `Photo`, activity log audit trail, `ReportPolicy` locks photo add/edit/delete/reorder/unlink on `submitted` and `closed` (PHO-7, RLS-4) |
| 5.12 | Comprehensive test suite (upload limits, multi-upload queues, thumbnail generation, role scoping, locking) | **done**: 17 `PhotoTest` suite cases verifying upload constraints, thumbnails, role scoping, and submit locking (IMG-8) |

---

## Phase 6 — PDF (Adopted Review & Fix Plan, 10 to 13 days)

*Adopted from `ReportPdfRenderer_Review_and_Fix_Plan.md` against SRS v0.6 and codebase reality.*

| Sub-Phase | Focus & Tasks | Ref | Status |
| --- | --- | --- | --- |
| **6A: S2 Spike** | Benchmark mPDF vs dompdf on host limits (512MB memory_limit) with 600-question report + 30 photos. Verify table header repeat, page x of y, index generation, and UTF-8 glyphs. | S2, REP-1e | **Done** |
| **6B: Data Builder** | (1) `display_no` migration & snapshot persistence on `report_groups` and `report_questions`, (2) `ReportDocumentBuilder` eager-loading all report data in <=12 queries (actual 7), (3) Required-field validation. | REP-1g | **Done** |
| **6C: Critical Renderer Patches** | Immediate fixes to renderer: R-02 (ratings column alignment), R-04 (dynamic cover status & watermark cache invalidation), R-05 (remove phantom photo_status, sort by item_no, local storage path), R-09 (move comments out of `<tfoot>`), R-10 (fix table header CSS class width), R-12 (page tokens), R-18 (`nl2br` for multiline text), R-21 (CSS styles & `@page`), R-24 (dedup generation date), R-27 (strip internal IDs). | R-01–R-27 | **Done** |
| **6D: Section Views** | Blade-driven section templates (`pdf/sections/*.blade.php`): Cover/Footer, Particulars/Voyage/Operations/PSC, Checklist with typed values & auto-NA banners, Best Practices & Findings register, Attendance/Appraisals, Signatures, B-008 dedicated layout & standalone Photo Form layout. | REP-1, AUD-1..15 | **Done** |
| **6E: Photos & Appendix** | Ordered grid photo layout, local storage path loading, threshold appendix split notice. | REP-3, REP-8, PHO-6 | **Done** |
| **6F: Job & Fingerprint Cache** | Queued PDF generation job `GenerateReportPdf` on dedicated queue (`--timeout=300`), robust cache fingerprint, previous PDF cleanup, `reports.pdf.view` and `reports.pdf.download` controller endpoints, and frontend export button. | REP-6 | **Done** |
| **6G: Verification Suite** | Golden fixture tests, query count assertion (<= 12 queries), XSS escaping tests, status transition watermark tests, PDF binary verification (`%PDF-`). | REP-1 | **Done** |

*Note (1.1): the B-008 views and `audit_header.blade.php` built in 6D read the four audit tables that Phase 7 removes. Task 7.2 repoints them. The renderer, cache, and the other sections are not affected.*

---

## Phase 7 — Audit specifics (3 to 4 days)

B-008 is the checklist plus fill-in pages (SRS 7.1): fields, repeating rows, and text boxes, on the same blocks as the inspection. Findings, photos, the checklist engine, and the status flow already exist from Phases 3 to 6. What is new is one generic table, two generic UI blocks, and the audit pages built from them.

The old 7.1 (audit set-up with `audit_details`, `auditees`, `auditors`, `audit_activities`) was finished against the previous SRS. It is reworked first, in 7.2, so that there are never two sources of truth.

| # | Task | Ref | Status |
| --- | --- | --- | --- |
| 7.1 | **Generic storage.** `report_datasets` migration, model, factory (report, dataset key, rows JSON, `row_version`). Dataset registry: key to allowed row shape, validated server-side from the form's layout config. Endpoint `PUT reports/{report}/datasets/{key}` that follows the autosave rules (`client_save_id`, `row_version`, 409 on a stale save). Endpoint `PUT reports/{report}/fields` for the `summary_data` keys. Both editable only in `draft`, `in_progress`, `reopened` | SRS 14.4, NFR-1, NFR-2, NFR-15 | **done**: `report_datasets` migration, `ReportDataset` model & factory, `ReportDatasetRegistry` validator, `PUT reports/{report}/datasets/{key}` with idempotency & 409 conflict checks, `PUT reports/{report}/fields` for `summary_data`, 7 passing tests in `ReportDatasetTest` |
| 7.2 | **Rework the finished audit set-up (was 7.1, marked done).** Copy any existing rows from `audit_details`, `auditees`, `auditors`, `audit_activities` into `summary_data` keys and the `audit_people` dataset, then drop the four tables in the same migration. Replace `PUT reports/{report}/audit-setup` with the two endpoints from 7.1. Repoint `audit_header.blade.php`, the B-008 views from 6D, and the B-008 Chapter 1 UI in `general-info-section.tsx` to the new sources. Update `AuditSetupTest`. Update the audit section of `ERD.md` | SRS 14.4 | Pending (rework of a done task) |
| 7.3 | **Generic UI blocks.** `fields-block` and `rows-block` (add and remove rows, typed columns: text, date, time, number, select). Both use the existing autosave queue (3.5) with debounce and the same saved / saving / retrying indicator. They are not audit-specific, so D-062 can use them later | AUD-2 to AUD-4, AUD-11, AUD-12 | Pending |
| 7.4 | **Pages 1 to 3.** Audit details (dates, audit type with text for D, activities, operations from the configured list, Master, Chief Engineer), people (one list, name, rank, role, at least one Lead auditor), previous audit (four typed fields). Pre-filling from the last audit is v1.1 | AUD-2, AUD-3, AUD-4 | Pending |
| 7.5 | **NCs and observations.** Confirm the Phase 4 findings table covers this with no second table: kind (NC or observation), description, target date, issue date, numbering per audit (NC-01, OBS-01), totals shown in the audit results. Evidence photo link already exists (5.9) | AUD-9, AUD-10, FND-1 | Pending |
| 7.6 | **Auditee evaluation.** Copy the criteria into `summary_data.evaluation_criteria` when the audit is created, so later edits never change an old audit. Page of rows: one per auditee (at least four), seven criteria scored 1 to 5 with the definitions as help text, overall status. **Restricted:** stripped from every response except the audit's own page and its PDF. Never in lists, search, exports, or the findings register | AUD-11, SRS 2 | Pending |
| 7.7 | **Execution log, general comments, printed-only items.** Execution log rows, positive and negative comments (two `summary_data` keys), and the signature lines and distribution list printed from the B-008 PDF layout as fixed text, with names and ranks from the people list | AUD-12 to AUD-15 | Pending |
| 7.8 | **Audit submit guard** in the status transition policy, next to RLS-2: audit start date, audit type, a Lead auditor, every applicable question answered. Kept in one place so changing it after OQ-9 is a single edit | RLS-2, OQ-9 | Pending, rules unconfirmed |
| 7.9 | Corporate review and "mark as reviewed" | AUD-16, RLS-6 | Pending |
| 7.10 | **Tests.** Dataset shape validation, stale-save conflict on a dataset, restricted scores (every list, search, export, and findings endpoint asserted not to contain scores), B-008 golden fixture (every audit page value appears in the PDF HTML), the four old tables are gone, query count stays at 12 or fewer with datasets loaded, submit guard refusals | NFR-8, REP-1 | Pending |

**Phase 7 is done when** a vessel user can fill a whole B-008 from the pages above, a corporate user can read it and mark it reviewed, and the PDF prints every page of it.

---

## Phase 8 — Administration and audit trail (4 to 5 days)

| # | Task | Ref |
| --- | --- | --- |
| 8.1 | Users & Vessel Accounts: create, role (superadmin, corporate, vessel), vessel name, activate, deactivate | §2 |
| 8.2 | Vessel types | FM-4 |
| 8.3 | Vessel rename across reports, photos, findings and accounts, logged | SRS 2.1 |
| 8.4 | Settings: limits, keep-originals flag, chapters, criteria wording | IMG-1, IMG-3 |
| 8.5 | Activity log viewer, read only, filterable | NFR-9 |
| 8.6 | Fortify hardening: 2FA, passkeys, rate limits | NFR-8 |

---

## Phase 9 — Hardening and deploy (5 to 7 days)

| # | Task | Ref |
| --- | --- | --- |
| 9.1 | Measure against NFR-13 on a throttled link; fix what misses | NFR-13 |
| 9.2 | Bundle audit against the budget; trim shared dependencies | NFR-14 |
| 9.3 | Queue and scheduler cron config, `--timeout=300`, separate queue for images and PDFs | §13 |
| 9.4 | Security pass: every policy exercised by a test, mass assignment, upload validation | NFR-8 |
| 9.5 | Browser pass: current and previous Chrome, Edge, Firefox, Safari, plus a low-end Android | NFR-6 |
| 9.6 | Backups: daily database and files, off-server copy, **one tested restore** | NFR-11 |
| 9.7 | cPanel deployment: document root, INI values, SSL, cron, asset upload | §13 |
| 9.8 | Pilot: one vessel, one inspection, one audit, end to end with real users | — |

**v1 release gate:** every P0 item in the SRS v1 list demonstrably works, the pilot is signed
off, and a restore has been rehearsed.

---

## Phase 10 — v1.1, separately (10 to 12 days)

Findings lifecycle with close-out (FND-3), Excel export (FND-4), dashboard (REP-5),
previous-report comparison (INS-19), 12-month coverage view (INS-20), pre-filling the previous
audit follow-up from the last audit with the same IMO number (AUD-4), template layout
refinement once real reports exist.

Kept out of v1 on purpose: notifications, because v1 has no notification requirement and
adding it late is cheap, whereas building a notification system early and getting the trigger
rules wrong is expensive.

---

## 2. Decisions that block work

These are needed at specific points. Late answers cost rework, not just delay.

| Needed by | Decision | Currently |
| --- | --- | --- |
| Phase 0, before S2 and S3 run | The **actual inherited INI values** (OQ-5): `upload_max_filesize`, `post_max_size`, `memory_limit`, `max_execution_time`, `max_input_vars`, and whether GD or Imagick exists | PHP 8.8 and inherited INI known; the values are not |
| Phase 1, task 1.7 | ~~Status list, reopening~~ | **Resolved:** `closed` is final, never reopened |
| Phase 1, task 1.8 | ~~Report numbering~~ | **Resolved:** form code, date, daily sequence |
| Phase 1, task 1.10 | Does the DPA accept crew-run internal audits? (OQ-4) | Open, does not block Phase 1 |
| Phase 7, before 7.2 | Do the four old audit tables hold any real audit reports, or only test data? | Assumed test data only (the project starts clean). Confirm before the drop |
| Phase 7, task 7.8 | Audit submit rules (OQ-9) | Proposed in SRS 7.2, unconfirmed |
| Phase 9 | ~~Retention~~ | **Resolved:** five years |
| Phase 9 | Real user and report counts (OQ-8) | 200 users assumed |

---

## 3. Risk register

| Risk                                                                    | Impact                              | Mitigation                                                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parser misses questions or mis-merges "(continuing)" tables             | Whole app built on a wrong template | S1 first, human review of the review file, source keys for traceability                                                                            |
| PDF layout does not fit host limits                                     | v1 slips by weeks                   | S2 first. REP-8 appendix split is pre-approved, not a debate                                                                                       |
| `upload_max_filesize` smaller than a resized photo                      | Uploads fail at sea                 | S3 first. Client-side resize is already mandatory (SRS 13.1); the spike measures the real ceiling and sets target edge and quality to fit under it |
| A queue job killed by the host's `memory_limit` or `max_execution_time` | Photo stuck in `processing`         | Separate queue, explicit `failed` state with retry. Nothing is lost because the original never left the phone                                      |
| Photo pipeline exceeds shared memory                                    | Uploads fail on the ship            | S3 first, megapixel cap with a clear message, client-side resize doing all the heavy work                                                          |
| Vessel name typos break access control                                  | Crew cannot see their own records   | Pick-from-list for vessel users, normalisation, superadmin notified on unmatched names                                                             |
| VSAT too slow to be usable in the field                                 | Users go back to Word               | NFR-13 measured on a throttled link before v1 ships, not after                                                                                     |
| Scope creep into v1.1 features                                          | v1 never ships                      | The non-goals list in SRS §16.1 exists to be quoted back                                                                                           |
| Audit set-up rework leaves two sources of truth (old tables and `report_datasets`) | Reports show different data in the UI and the PDF | Migrate and drop the four old tables in one change (7.2), and a test asserts they no longer exist |
| Evaluation scores leak through a list, export, or the findings register | Scores of named crew seen by the wrong people | The scores have their own dataset key, are stripped in one place, and 7.10 asserts it for every list and export endpoint |
| Findings close-out loop has no notification                             | Findings pile up unclosed           | Explicitly accepted for v1; the dashboard surfaces them (REP-5, v1.1)                                                                              |

---

## 4. Definition of done, per task

A task is finished when:

1. Migration, model, factory and policy exist where applicable.
2. Feature test covers the happy path and the refusal path (wrong role, wrong vessel, wrong status).
3. Nothing secret or environment specific is committed.
4. The SRS or ERD is updated if the task changed either.
5. `php artisan test` passes and `npm run types` is clean.

---

## 5. Where to start tomorrow

Phases 0 to 6 are done. Start with Phase 7, tasks 7.1 and 7.2 together: add `report_datasets`, then move the finished audit set-up onto it and drop the four old tables in the same change, so there is never a moment with two sources of truth. Everything after that in Phase 7 is built on the generic blocks from 7.3. First, confirm that the old audit tables hold test data only (decisions table).
