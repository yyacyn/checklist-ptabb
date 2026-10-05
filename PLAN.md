# Implementation Plan — Vessel Audit & Inspection App

Version 1.0
Derived from `SRS.md` v0.5 and `ERD.md` v1.0. Read those two first; this file is only the order of work.

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

| # | Spike | Question it answers | Method | Output |
| --- | --- | --- | --- | --- |
| S1 | **Form parser** | Can the two documents be parsed reliably enough that nobody types questions by hand? | Parse both `.docx` (via `python-docx`-equivalent table walking in PHP, or the provided markdown conversions) into the §5 review file | Group and question counts per form vs the SRS numbers (B-008 ≈ 430 in 17 sections, D-062 chapters 2–13 ≈ 600). Warning list: duplicates, unsplittable guidance, dotted blanks, mangled words (`claSMS`, `trSMS`), "(continuing)" merges, subgroup detection |
| S2 | **PDF renderer** | dompdf or mPDF? Does the faithful layout fit in host limits? | Build one 600-row checklist chapter + the moved Report Summary + 30 photos in both renderers on the target host | Wall time, peak memory, file size, whether chapter table headers repeat across pages correctly |
| S3 | **Photo pipeline** | Does a 20 MB phone photo survive the whole trip on shared PHP? | Browser resize → upload → queued optimise → thumbnail, at 20 MB and at 40 MP | Wall time, peak memory, final file size against the 300–800 KB target (IMG-8) |

**GATE 1** — before any feature code:
- S1 result decides whether §5 stays as written, or the importer is replaced by "one person types the questions over a week".
- S2 result fixes the renderer and tells us whether the photo chapter needs the REP-8 appendix split.
- S3 result either confirms the current design or forces a client-side-only pipeline with a smaller server image cap.

---

## Phase 1 — Schema, roles, and the snapshot (6 to 8 days)

The point of this phase is the correctness rule, not the tables.

| # | Task | Notes |
| --- | --- | --- |
| 1.1 | Migrations group 1: reference and templates | ERD §2. `users`, `vessel_types`, `forms`, `form_groups`, `form_questions`, `form_applicability`, `evaluation_criteria` |
| 1.2 | Models, factories, seeders | Vessel types seeded: Cement Carrier, Tanker. B-008 evaluation criteria seeded from the form's 1–5 definitions |
| 1.3 | `forms.template_version` bump rule | Bumped only on structural change (question added, removed, regrouped), never on a wording typo |
| 1.4 | Migrations group 2: reports, groups, questions, answers | ERD §3, including `client_save_id` and `row_version` |
| 1.5 | **`ReportSnapshot` service** | On creation: copy enabled groups and questions, resolve applicability from the typed vessel type and ice class, stamp `template_version`, insert group comment boxes (FM-7a) |
| 1.6 | **The critical test** | Edit, disable and archive a question in the template, then assert an existing report's text, order and applicability are byte-identical afterwards (FM-8, FM-9) |
| 1.7 | `ReportStatus` + policy | Section 10 state machine, server-side transition validation, flush-before-transition guard (RLS-3) |
| 1.8 | `ReportNumberService` | Transactional sequence, unique index, year rollover (RLS-7) |
| 1.9 | Vessel name normalisation + `KnownVesselNames` lookup | SRS 2.1: normalise on write, distinct-name lookup for autocomplete |
| 1.10 | Policies and access matrix | Role × module × action, including vessel-name scoping and the evaluation-scores restriction |

**GATE 2** — the snapshot test passes, and a report can be created, answered, submitted,
reopened and closed through the console with no UI.

---

## Phase 2 — Form management (5 to 7 days)

| # | Task | Ref |
| --- | --- | --- |
| 2.1 | Group and subgroup tree: add, rename, reorder (drag and up/down), disable, archive | FM-1, FM-2 |
| 2.2 | Question editor: text, guidance, input type, enable/disable, duplicate, archive | FM-1, FM-3, FM-6 |
| 2.3 | Bulk actions: disable a whole group, move questions between groups | FM-6 |
| 2.4 | Applicability editor: vessel types, ice class, at group and question level | FM-4 |
| 2.5 | "Used in N reports" warning on delete, archive instead of delete | FM-9 |
| 2.6 | Change history per group and question | FM-7, FM-12 |
| 2.7 | `forms:import` command with dry run and the reviewed-file loader | §5 |
| 2.8 | Tests: import idempotency, archive rules, reorder stability | §5.5 |

---

## Phase 3 — Data entry, the VSAT-critical path (10 to 12 days)

This is the phase users feel. Budget it properly.

| # | Task | Ref |
| --- | --- | --- |
| 3.1 | Report creation: typed vessel particulars, known-name autocomplete, type and ice class, reference number | INS-1, AUD-1, SRS 2.1 |
| 3.2 | One group per screen, sticky chapter nav, progress per group, unanswered filter, search-jump | NFR-3, INS-8, INS-22 |
| 3.3 | Answer row: Yes/No/NS/NA (D-062) or Yes/No/N/S (B-008), note, typed extra input, guidance expander | INS-5, AUD-6, AUD-7, FM-3 |
| 3.4 | **Autosave engine**: debounce, flush on blur / 5s / group exit, saved-saving-retrying indicator | NFR-1, NFR-2 |
| 3.5 | **Browser retry queue** in IndexedDB, idempotent `client_save_id`, reconcile on reconnect | NFR-2 |
| 3.6 | Conflict handling: stale `row_version` refused and surfaced, advisory edit lock with "X is editing" | NFR-15 |
| 3.7 | Inapplicable items shown as locked `NA` with reason, overridable | FM-4, FM-4a |
| 3.8 | Group comments box with the NS/NA hint | INS-6, FM-7a |
| 3.9 | `No` requires a comment and a risk level, with optional VIQ paragraph and job order | INS-9 |
| 3.10 | Undo of a recent answer | INS-23 |
| 3.11 | Tests: payload sizes, one-answer-per-request, retry does not duplicate, never posts a whole chapter | NFR-13, cPanel check 4 |

---

## Phase 4 — Findings, v1 subset (3 to 4 days)

| # | Task | Ref |
| --- | --- | --- |
| 4.1 | Finding created from a `No` answer, with chapter and question reference | FND-1, INS-9, AUD-9 |
| 4.2 | Findings list per vessel name with filters, scoped by role | FND-2 |
| 4.3 | Evidence placeholders, wired for real in Phase 5 | PHO-5 |

---

## Phase 5 — Photos (8 to 10 days)

| # | Task | Ref |
| --- | --- | --- |
| 5.1 | Category CRUD, seeded with the seven categories | §8.1 |
| 5.2 | Capture and multi-upload with the browser queue: queued, uploading, processing, done, failed, retry | PHO-1, IMG-7 |
| 5.3 | Client resize and orientation fix, longest edge 2000 px, quality 80 | IMG-2 |
| 5.4 | HEIC conversion in the browser; unsupported files refused with a message | IMG-2a, IMG-4 |
| 5.5 | Upload endpoint: 20–25 MB accepted, checksum, dedupe | IMG-1 |
| 5.6 | Queued optimiser job: auto-orient, resize, recompress, strip metadata, 400 px thumbnail, discard original | IMG-3, IMG-5, IMG-6 |
| 5.7 | Gallery with vessel, category, date and report filters; role scoping | PHO-4, PHO-8 |
| 5.8 | Attach to question or finding in one action | PHO-5, AUD-10 |
| 5.9 | Chapter 16 selection by the inspector | PHO-6, REP-3 |
| 5.10 | Soft delete with reason, locked at `submitted` | PHO-7, RLS-4 |
| 5.11 | Tests against the S3 numbers | IMG-8 |

---

## Phase 6 — PDF (8 to 10 days)

| # | Task | Ref |
| --- | --- | --- |
| 6.1 | Layout definition per form, one shared engine | REP-1g |
| 6.2 | D-062: Chapter 1 header, operations grid, PSC and dry dock, open items table, INTERNAL CIRCULATION | REP-1 |
| 6.3 | D-062: chapters 2–13 with each chapter's own column set, repeating table headers | REP-1 |
| 6.4 | Chapter 14 best practices, Chapter 15 Summary of Observations, **then the moved Report Summary** | REP-1b, REP-1c |
| 6.5 | Chapter 16 photographic records, grouped by category with captions, appendix split if large | REP-3, REP-8 |
| 6.6 | The two comparison blocks at the end | INS-19 |
| 6.7 | Generated index with real page numbers; footer with form code, version, report number, page x of y | REP-1a, REP-1e |
| 6.8 | Static text blocks: FILL IN INSTRUCTIONS, the notes under each table, "add or remove lines" | REP-1f |
| 6.9 | Queued generation, cached per `current_version`, progress state, invalidated on edit | REP-6 |
| 6.10 | DRAFT watermark; blank signature lines | REP-4, REP-2 |
| 6.11 | Print stylesheet fallback | REP-7 |
| 6.12 | B-008 layout from its own document | REP-1 |

---

## Phase 7 — Audit specifics (4 to 5 days)

| # | Task | Ref |
| --- | --- | --- |
| 7.1 | Audit set-up: operations, activities, type, dates, auditees, auditors, lead auditor | AUD-2, AUD-3 |
| 7.2 | Follow-up from the previous audit, with auto-pulled counts | AUD-4 |
| 7.3 | Auditee evaluation blocks, minimum four, scores 1–5 with help text, hidden from other vessel users | AUD-11, §2 |
| 7.4 | Execution log, general comments, distribution list on the PDF | AUD-12, AUD-13, AUD-15 |
| 7.5 | Corporate review and "mark as reviewed" | AUD-16, RLS-6 |

---

## Phase 8 — Administration and audit trail (4 to 5 days)

| # | Task | Ref |
| --- | --- | --- |
| 8.1 | Users: create, role, vessel name, activate, deactivate | §2 |
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
previous-report comparison (INS-19), 12-month coverage view (INS-20), template layout
refinement once real reports exist.

Kept out of v1 on purpose: notifications, because v1 has no notification requirement and
adding it late is cheap, whereas building a notification system early and getting the trigger
rules wrong is expensive.

---

## 2. Decisions that block work

These are needed at specific points. Late answers cost rework, not just delay.

| Needed by | Decision | Currently |
| --- | --- | --- |
| Phase 1, task 1.4 | Status list correct, and may a `closed` report be reopened? (OQ-2) | Drafted in SRS §10, unconfirmed |
| Phase 1, task 1.8 | Report numbering convention (OQ-7) | Assumed `D062-2026-0001` and `AUD-003/2026` |
| Phase 1, task 1.10 | Does the DPA accept crew-run internal audits? (OQ-4) | Open, does not block Phase 1 |
| Phase 6 | cPanel results: PHP version, memory limit, Imagick or GD, cron, disk quota (OQ-5) | Unknown. **Blocks the PDF renderer decision** |
| Phase 9 | 5 year retention confirmed (OQ-6) | Assumed |

---

## 3. Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Parser misses questions or mis-merges "(continuing)" tables | Whole app built on a wrong template | S1 first, human review of the review file, source keys for traceability |
| PDF layout does not fit host limits | v1 slips by weeks | S2 first, REP-8 appendix split, clean-layout fallback behind a flag |
| VSAT too slow to be usable in the field | Users go back to Word | NFR-13 measured on a throttled link before v1 ships, not after |
| Photo pipeline exceeds shared memory | Uploads fail on the ship | S3 first, megapixel cap with a clear message, client-side resize doing most of the work |
| Vessel name typos break access control | Crew cannot see their own records | Pick-from-list for vessel users, normalisation, superadmin notified on unmatched names |
| Scope creep into v1.1 features | v1 never ships | The non-goals list in SRS §16.1 exists to be quoted back |
| Findings close-out loop has no notification | Findings pile up unclosed | Explicitly accepted for v1; the dashboard surfaces them (REP-5, v1.1) |

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

Phase 0, S1, the form parser. It needs the two source documents, it has no dependencies, and
its result changes the shape of everything after it. Output is a review file the document
owner can open, plus a written count of what was and was not extracted.