# Vessel Audit & Inspection App: SRS / PRD

Version 0.6
Source forms: B-008 Vessel Internal Audit Checklist (v00.00, 25-Aug-23), D-062 Vessel Inspection Report (v01.01, 01-Jul-23), PT. Amarin Ship Management

**0.6: answers received.** `closed` is final and a closed report can never be reopened (RLS-9). Report numbers are form code plus date plus a daily sequence (RLS-7). The host offers PHP up to 8.8 and **inherited INI only** (section 13.1). Five year retention confirmed (NFR-17).

**0.5: the PDF follows the D-062 layout, with the Report Summary moved to the back.** REP-1 to REP-1g.

**0.4: the vessel master table is removed.** There is no `vessels` entity. Vessel particulars are typed by the user on each report, and a vessel user carries one vessel name on their account. Every rule that previously depended on a vessel record now matches on that name (sections 2, 2.1, FM-4, INS-1, AUD-1, PHO-2, PHO-4, PHO-8, FND-2, section 14).

Changes in 0.3: report status state machine (section 10, was missing), applicability made visible instead of silently dropped (FM-4), template version stamped on reports (FM-12), deterministic import keys (section 5), batched autosave (NFR-1), HEIC handling made consistent (IMG-2a, IMG-4), v1 PDF scope reduced and generation queued (REP-1, REP-6), performance targets and a bundle budget (NFR-13, NFR-14), concurrency, timezone and retention rules (NFR-15 to NFR-17), data model completed for sections 6 and 7 (section 14), non-goals and open questions added (sections 16 and 17).

---

## 1. Summary

A web app that replaces the Word versions of two company forms:

- **D-062 Vessel Inspection Report**: filled in by corporate staff who visit a vessel.
- **B-008 Vessel Internal Audit Checklist**: filled in by vessel crew onboard.

Plus a **photographic records** module for hull, deck, engine room, bridge, navigational equipment, and safety equipment photos.

The question lists are not hardcoded. They are imported once from the two Word files, then managed by a superadmin (add, edit, delete, disable, enable, reorder, group).

Stack: Inertia + React (Laravel assumed), hosted on cPanel. The UI is plain and functional. No custom design work.

Scope numbers, from the files: B-008 has roughly 430 questions in 17 sections. D-062 has roughly 600 items in chapters 2 to 13, plus header data, summary tables, appraisals, and comparisons.

---

## 2. Roles

| Role | Who | Access |
| --- | --- | --- |
| Superadmin | Document owner / IT | Everything. Manages users/vessel accounts, vessel types, form groups and questions, photo categories, and settings. |
| Corporate User | Superintendents, managers | Creates and completes D-062 inspections on any vessel. Views all B-008 audits (read only), all photos, and exports PDFs. Can mark reports as reviewed. |
| Vessel Account | Dedicated shipboard account (one per vessel) | Shared ship account tied permanently to a vessel (e.g. `mv.amarin-glory@vessel.local`). Sees only records whose vessel name matches the account's assigned vessel name (see 2.1). Creates and completes B-008 audits for that vessel. Uploads photos for that vessel. |

Rules:

- Vessel accounts are provisioned per vessel (one account per ship, e.g. for the ship's cargo office / bridge workstation) rather than creating and maintaining individual accounts for rotating crew members. This eliminates IT overhead during frequent crew changes.
- Actual inspector, auditor, and auditee identities are recorded as typed particulars on each report (name, rank, master, chief engineer), ensuring non-repudiation and legal audit evidence without requiring individual login accounts per seafarer.
- Auditee evaluation scores (B-008 Chapter 14) are visible to Corporate Users and the authoring Vessel Account. Other vessels never see them.
- If a vessel is renamed or decommissioned, the vessel account can be updated or deactivated by the Superadmin without losing historical report integrity.

### 2.1 Vessel identity without a vessel table

There is no vessel master record. Vessel particulars are entered by the user each time, and matching for "own vessel" is done on a text name.

- Vessel particulars typed on a report: vessel name, IMO, flag, gross tonnage, year built, vessel type (chosen from the vessel type list), ice class yes/no. A vessel user has one vessel name on their account, set by the superadmin when the account is created.
- Names are normalised on save: trimmed, collapsed spaces, compared case-insensitively. `MV MUMBAI`, `Mv Mumbai` and `mv  mumbai` are the same vessel.
- The name list offered in the vessel name field is not stored anywhere. It is built on the fly from the distinct vessel names already in use across reports and user accounts, so it fills itself in as the fleet is worked with and nobody has to maintain a list.
- Vessel users pick their vessel name from that list rather than typing it, so a typo cannot lock a crew member out of their own records. Free typing is still allowed; if a name is typed that matches no account, the report is still saved and the superadmin is notified so the account can be corrected.
- Consequence accepted: renames and name corrections are data work, not CRUD. The superadmin can rename a vessel across all its reports, photos, findings and accounts in one action, which is logged.
- Consequence accepted: two vessels with the same name are one vessel as far as the app is concerned. Vessel names are kept unique per owner.
- Vessel types stay as a small managed list, because applicability (FM-4) needs them. Ice class is a per-report flag entered by the user, since there is no vessel record to hold it.

---

## 3. Modules

| Module | Purpose |
| --- | --- |
| A. Inspection | D-062, used by Corporate Users |
| B. Audit | B-008, used by Vessel Users |
| C. Photographic records | Photo capture, optimization, categories, gallery |
| D. Form management | Superadmin editor for groups and questions |
| E. Initial import | One-time load of both forms from the Word files |
| F. Findings | Observations and non-conformities, tracked to closure |
| G. Reports | PDF and Excel export |
| H. Administration | Users, vessel types, known vessel names, settings |

---

## 4. Form management (superadmin)

### 4.1 Structure

```
Form (D-062 or B-008)
  Group / chapter          e.g. "Navigation", "Mooring and Anchoring"
    Subgroup (optional)    e.g. "Bridge/Navigation Equipment"
      Question
```

This follows the files. B-008 groups are flat sections. D-062 has chapters with subgroups.

### 4.2 Superadmin actions

- FM-1: Add, edit, delete, reorder (drag or up/down) groups, subgroups, and questions.
- FM-2: **Disable / enable** any group, subgroup, or question. Disabled items do not appear in new reports.
- FM-3: Question fields: text, guidance text (the bracketed notes in the forms, shown as expandable help), answer set, optional extra input (date, text, number), enabled flag, applicability.
- FM-4: **Applicability by vessel type.** Each group/question applies to all vessel types or a chosen list. Vessel types are managed in admin, starting with: Cement Carrier, Tanker. A group can also be marked "ice class only". Applicability is resolved when the report is created, from the vessel type and the ice class flag the user typed in the report header (section 2.1), not from a vessel record. Items **not** applicable are still copied into the report but are locked to `NA` with an automatic reason ("Tanker only", "Ice class vessels only"). They are never deleted from the report, because a reader must be able to see that the chapter was skipped for a reason rather than missed by the inspector. Progress counts always read "answered of applicable", and the applicable total is shown next to it.
- FM-4a: An inspector may override an inapplicable item to a real answer, and may mark an applicable item as `NA` with their own reason. Both are recorded in the activity log.
- FM-5: Answer sets are fixed per form: D-062 uses Yes / No / NS / NA. B-008 uses Yes / No / N/S (no N/A, as decided).
- FM-6: Bulk actions: disable a whole group, move questions between groups, duplicate a question.
- FM-7: Template change history (who changed what, when).
- FM-7a: Every group has a built-in comments/remarks box, as in both forms. It is not a question, so it is not edited in the question list. It appears automatically on every group in every report. One box per group or chapter, shown after its questions. Subgroups do not get their own box, matching the form.

### 4.3 Rules to protect old reports (important)

- FM-8: When a report is created, the applicable enabled questions are **copied into the report** (text, guidance, order, group name). Editing, disabling, or deleting a question later never changes a report that already exists.
- FM-9: A question that has been used in any report cannot be hard-deleted. "Delete" archives it (hidden from the editor and new reports, kept for old reports). Never-used questions can be hard-deleted.
- FM-10: Reports in progress keep their copied question list. New questions only appear in new reports. (Optional later: a "sync new questions" button.)
- FM-11: No approval workflow for changes. Superadmin edits go live immediately.
- FM-12: Every report stores the template version it was created from. The form editor shows, per question and group, whether it has been used in reports and which template versions. A report always displays the template version it was built on, so a PDF from two years ago is unambiguous about which wording it used.

---

## 5. Initial form import

Goal: nobody types ~1,000 questions by hand.

### 5.1 Approach

1. A script reads the two `.docx` files and writes a **review file** (CSV or XLSX) with one row per question: form, group, subgroup, question text, guidance, detected extra field, suggested applicability, warnings.
2. The superadmin (or document owner) opens the review file, fixes obvious problems, and saves it.
3. A seeder (`database/seeders/FormSeeder.php`) loads the reviewed file into the database. It has a **dry run** mode (`FORMS_SEED_DRY=1`) that reports the counts without saving, and it is safe to re-run: matching is on `source_key`, a stable identifier the parser writes for each question (form code plus a hash of the normalised question text, plus the source table and row number). Order is never used as a key, because reordering the Word file would then create duplicates instead of updating them. Groups are matched on form, parent and title for the same reason.
4. Why a seeder and not a migration or a command: migrations are for schema, not data, and re-running them for data is slow and unreviewable. An artisan command would duplicate what the seeder already does. The dry run the command would have provided already exists one step earlier, as the parser's own report. A later import screen in the UI is a nice-to-have; nothing in v1 needs it.

### 5.2 Parsing rules (based on how the files are built)

- Each checklist table has a header row with the group title and the answer column labels. That row starts a **group**.
- D-062 tables titled "(continuing)" belong to the same group as the previous table. They are merged, not duplicated.
- In D-062, rows with a single merged cell and bold text (for example "Bridge/Navigation Equipment", "Life Rafts") start a **subgroup**.
- Any row with answer checkboxes is a **question**. The first cell is the question text.
- "COMMENTS" rows are ignored. Every group gets a comment box automatically.
- Text in trailing brackets is split off as guidance when the split is clean. Unclear cases keep the full text in the question and get a warning.
- Rows containing dotted blanks (for example "Date of last OWS test: ……") are flagged as questions that need a **date** or **text** input.
- Pre-ticked boxes (a few cells in D-062 are marked with a cross) are ignored.
- **A table is a checklist only if its header row carries two or more answer labels** (Yes / No / NS / NA / N/S). Nothing else is a checklist. This one rule keeps the general information block, the index, the instructions, the appraisal tables, the circulation table and the comparison blocks out, with no hardcoded section names. Proven by spike S1.
- **A question row must carry exactly as many checkboxes as the form's answer width.** Rows that do not match are not questions: this excludes the D-062 Report Summary ratings table (3 boxes in a 4 box form) and the B-008 auditee evaluation blocks (5 boxes in a 3 box form). Proven by spike S1.
- A chapter table titled "(continuing)" merges into the chapter it continues. Seventeen such tables exist in D-062.
- A checklist table with no group header of its own inherits the chapter title as its group, and every such row is flagged so the superadmin can name or merge it.
- Markdown emphasis markers, strikethrough wrappers and escaped comparison operators are cleaned out of the question text, and every cleanup is flagged on the row.
- Near-duplicate detection compares across the **whole form**, not inside one group, because the known duplicates sit in different sections (the EnMS and SEEMP questions appear in both the General and the Environmental sections). Threshold 90% similarity.
- The supplied markdown conversions lose emphasis fidelity: 97 D-062 questions arrive wrapped in `~~***…***`, which is a converter artifact rather than a deletion in the form. **Struck-through text cannot be distinguished from bold text in these files.** If the original `.docx` becomes available, parse that instead.
- Not imported as questions: header and vessel particulars, report summary and rating tables, findings tables, appraisal tables, circulation tables, scoring tables, signature blocks, and the sample data in the D-062 header (the MV Mumbai / Rendy entries). These are built into the app as proper fields (sections 6 and 7).

### 5.3 Cleanup flagged by the importer

The files contain problems that should be fixed during review, or by the superadmin editor afterwards:

- Mangled words in B-008: "claSMS" (claims) and "trSMS" (trims).
- Duplicates in B-008: the EnMS and SEEMP questions appear in both the General and Environmental sections, and the engineer's call alarm appears twice in the Engine Room section.
- Duplicate in D-062: Master Standing Orders/Night Orders appears twice in Navigation.
- The importer detects exact and near-duplicate questions within a form and lists them. It does not delete them. The superadmin disables or deletes them in the editor.

### 5.4 Default applicability set by the importer

Because the fleet is mostly cement carriers with some tankers, the importer applies a small, editable config map:

- D-062 chapter 8 (Cargo and Ballast System, petroleum): **Tanker only**
- D-062 chapter 13 (Ice Operations): **ice class only**
- D-062 chapter 11 sub-groups for inert gas plant: **Tanker only**
- Everything else: all vessel types

Superadmin can change any of it afterwards. Tanker-specific B-008 questions are left for the superadmin to review in the editor.

### 5.5 Import acceptance

- Group count and question count per form match the review file.
- Zero questions imported with an empty text.
- Dry run output lists every warning (duplicates, unsplit guidance, dotted blanks).
- Every imported question keeps its `source_key` and source table/row reference, so any question in the app can be traced back to a row of the original Word file.
- Re-running the import over the same reviewed file changes nothing (verified by row counts before and after).

Loading is done by a seeder, not a migration: `php artisan db:seed --class=FormSeeder`, dry run with `FORMS_SEED_DRY=1`. The form editor (section 4) is how the templates are changed after that, with an audit trail (FM-7), and edits made in the editor are never overwritten by re-seeding, because the seeder only writes questions it still finds by `source_key` and leaves archived rows alone.

Measured in spike S1 against the source documents:

| Check | B-008 | D-062 |
| --- | --- | --- |
| Questions extracted | 428 (expected ~430) | 616 (expected ~600) |
| Structure found | 17 sections (expected 17) | 12 chapters, 2 to 13 |
| Questions with empty text | 0 | 0 |
| Rows carrying guidance | 63 | 263 |
| Rows needing a typed input | 2 | 10 |
| Known defects in 5.3 found by the parser | all 6 | 1 of 1 |

Read with `spikes/s1-parser/FINDINGS.md`, which lists what still needs a human decision before import.

---

## 6. Inspection module (D-062, Corporate Users)

### 6.1 Header and general information

- INS-1: Create an inspection. The user types the vessel particulars on the report header: vessel name (picked from the known names list, section 2.1), IMO, flag, gross tonnage, year built, vessel type, ice class yes/no. Nothing is pre-filled from a vessel record, because there is none; a Corporate User typing the same ship twice types it twice. Entered per inspection: inspected by (defaults to the logged-in user), date, port, report reference number (auto-generated), sailing with vessel (yes/no, from, to), Master, Chief Engineer, Chief Officer.
- INS-2: Operations at time of inspection, multi-select: loading, discharging, bunkering, deballasting, ballasting, river transit, IGS in operation, major repairs/drydock, COW in progress, repairs under way, STS operations, idle, at anchor, at sea/sailing, other.
- INS-3: Port and date of last PSC inspection, flag to verify close-out if detained or deficiencies were found. Date of last dry dock and next dry dock.
- INS-4: Repeating table: open items, memoranda, Conditions of Class, recommendations, notations (description, due date, time schedule for close-out).

### 6.2 Checklist

- INS-5: Chapters 2 to 13 come from the managed form structure (section 4). Each question: Yes / No / NS / NA, optional note.
- INS-6: One comments/remarks box per group (the form's "Comments/Remarks"). The form tells inspectors to list Not Seen and Not Applicable items here, so the app shows a hint under the box when any item in the group is marked NS or NA.
- INS-7: Extra typed inputs (dates, spaces protected) where the question has them.
- INS-8: Progress per group (answered / total) and a filter for unanswered.
- INS-9: Checklist questions (Chapters 2 to 13) remain streamlined with direct Yes / No / NS / NA choices. Chapter 15 ("Summary of Observations") operates as a dedicated findings section where observation rows (Chapter, VIQ paragraph, Observation description, Risk mitigation High/Medium/Low, Job Order No.) are recorded and managed directly, faithful to Form D-062.

### 6.3 Summary and sign-off

- INS-10: Report Summary: each chapter 1 to 13 gets a rating (Very Good / Satisfactory / Unsatisfactory). **Chosen manually by the inspector.** The app shows the count of No and NS answers next to each chapter as information only.
- INS-11: Counts of High / Medium / Low observations calculated automatically.
- INS-12: Text sections: comments on items marked No, safety meetings/interviews/drills held, participants, understanding of safety and environmental excellence, training needs identified.
- INS-13: Ten attendance questions (safety meeting held, safety drill conducted, training seminars, PMS training, PMS records compared with actual condition, critical equipment tested, work/rest hours cross-checked, risk assessments reviewed, near misses identified, crew appraisals attached, verification of pending works). Each is Yes/No plus detail.
- INS-14: Best practices (free text).
- INS-15: Appraisal of Senior Officers: Master, Chief Engineer, Chief Officer, Second Engineer. Appraised yes/no, name, comments, optional file attachment.
- INS-16: Attachments: upload files (PDF, images, Word) to the report. This is how D-024 (tank inspection) and other referenced forms are handled in v1.
- INS-17: Chapter 16 photographic records generated from the photo module (section 8).
- INS-18: Internal circulation: record date sent and reviewed-by (name, date) per role on the form's list. **Signature lines are left blank on the PDF for manual signing.**
- INS-19 (v1.1): Comparison with previous reports: auto-show findings from the last 3 reports of the vessel and last 3 by the same inspector.
- INS-20 (v1.1): Coverage view: which chapters were inspected for each vessel in the last 12 months, and by whom. The form makes managers responsible for covering every part within a year.

### 6.4 Multi-visit inspections

- INS-21: An inspection can be left as a draft and finished later, in more than one session, on more than one device. Each answer stores who answered and when. Only one report per vessel visit, so no merging logic needed in v1.
- INS-22: Long checklists need navigation, not scrolling. Each chapter shows its own progress, the chapter list is sticky on desktop and a dropdown on a phone, unanswered items can be filtered, and there is a search box that jumps to a question by text within the report.
- INS-23: An answer can be undone. Autosave must not make a mis-click permanent: the last change to an answer is reversible from the answer row for a short period, and any change of a `No` answer is logged with before and after values.

---

## 7. Audit module (B-008, Vessel Users)

### 7.1 Set-up

- AUD-1: Create an audit. Audit number and year auto-generated (for example `AUD-003/2026`). Vessel name defaults to the vessel name on the user's account and vessel particulars (IMO, GT, flag, built, type) are typed or corrected by the user (section 2.1). Entered: date, Master name, Chief Engineer name.
- AUD-2: Operation at time of audit, multi-select: loading, discharging, bunkering, repairs afloat, deballasting, ballasting, idle, river transit, at anchor, at sea, drydock.
- AUD-3: Audit details: activities audited (Bridge, Deck, Engine, plus extra rows), audit type (A Internal, B Independent, C Unscheduled, D Other with specify), audit dates, auditees (name, rank), auditors (name, rank), lead auditor.
- AUD-4: Follow-up from previous audit: date, number of NCRs and observations pulled from the vessel's last audit. Text field for verification of close-out and implementation of actions.

### 7.2 Checklist

- AUD-5: Sections come from the managed form structure (17 groups at import).
- AUD-6: Each question: Yes / No / N/S, optional note. One comments box per group, as in the form.
- AUD-7: Typed inputs where the question has them (for example date of last unannounced D&A test, date of last OWS test).
- AUD-8: Progress per group and unanswered filter.
- AUD-9: Answering No lets the user raise it as a Non-Conformity or an Observation. NCs get an auto ID, issue date, description, and close-out target date. Totals are calculated.
- AUD-10: Attach photos or files as evidence to a question or a finding.

### 7.3 Evaluation and results

- AUD-11: Auditee evaluation: one block per auditee (allow at least 4, add more if needed). Seven criteria from the form, each scored 1 to 5, plus overall status. The 1 to 5 definitions (excellent to unsatisfactory) show as help text.
- AUD-12: Audit execution log (repeating rows): person/function, date, start time, end time, topics.
- AUD-13: Auditors' general comments (positive and negative).
- AUD-14: Signature lines (lead auditor, auditors) **left blank for manual signing** on the PDF.
- AUD-15: Distribution list from the form printed on the PDF. Not tracked digitally in v1.
- AUD-16: Corporate Users can view, filter, and export all audits, and mark an audit as reviewed.

Note on the audit design: B-008 is built around independent auditors and auditees. Here the vessel crew fill it in, so the person completing it may be auditing colleagues, or the Master. Check with the DPA that this satisfies the company's SMS requirement for internal audit independence. The app supports it either way.

---

## 8. Photographic records

### 8.1 Categories

Managed by the superadmin (add, rename, disable). Seeded with:

1. Hull condition
2. Deck condition
3. Engine room condition
4. Room condition (any room: cabins, galley, mess, steering gear room, stores, and so on)
5. Bridge condition
6. Navigational equipment
7. Safety equipment

"Room condition" has no matching section in the forms, so it is a photo-only category. Which room it is goes in the photo's location field (free text, see PHO-2).

### 8.2 Requirements

- PHO-1: Capture from the phone camera or upload from the device. Multiple photos per upload.
- PHO-2: Each photo has a vessel name, a category, and a caption. The vessel name comes from the report the photo is taken for, or is typed when a photo is uploaded on its own. Optional links: an inspection or audit, a specific question, a finding, and a location on the ship (free text, for example "port side aft").
- PHO-3: Capture time and uploader are recorded automatically and cannot be edited.
- PHO-4: Gallery filtered by vessel name, category, date range, and report.
- PHO-5: Photos attach to findings as evidence in one action.
- PHO-6: For an inspection, the inspector chooses which photos go into chapter 16 of the PDF. Photos are grouped by category with captions. Audit findings can include photos as an appendix.
- PHO-7: When a report is submitted, its photos are locked (see the lifecycle in section 10). Before that, deletion is a soft delete and is logged.
- PHO-8: Vessel Users can only upload and view photos whose vessel name matches their own account (section 2.1). Corporate Users see all.

### 8.3 Image optimizer

VSAT is slow and costs money, and cPanel storage is limited, so photos must be shrunk before and after upload.

- IMG-1: **The browser accepts original photos of at least 20 MB** (configurable, default 25 MB). Phone photos are often 5 to 12 MB, and some cameras produce more. Because the host inherits its INI values and the upload limit cannot be raised (section 13.1), the file that crosses the wire is the **resized** image, normally under 1 MB. What the user experiences is "I can take a 20 MB photo", which is what this requirement is really about; what the server receives is small. If client-side processing fails entirely, the upload is refused with a clear message rather than attempting a transfer the host will reject.
- IMG-2: **Client-side resize first** (in the browser, before upload): longest edge 2000 px, JPEG quality about 80, orientation fixed. This is what saves VSAT bandwidth.
- IMG-2a: HEIC is converted in the browser, not on the server. Chrome cannot decode HEIC with `createImageBitmap`, so a WASM decoder (libheif-js) is used when `createImageBitmap` fails. If the conversion fails for any reason, the file is **not** silently uploaded as the original; the user is told the format is unsupported and the camera setting to use JPEG is suggested. This closes the gap where an unprocessable file would arrive at the server as HEIC, which shared-hosting PHP usually cannot decode (see IMG-4).
- IMG-3: **Server-side optimize always**, even if the client already did it: auto-orient, resize to a maximum of 2000 px, recompress JPEG at about 80, strip metadata except capture time, and create a 400 px thumbnail. Original is discarded after processing (superadmin setting to keep originals, off by default).
- IMG-4: Accepted formats: JPEG, PNG, WebP. HEIC/HEIF is accepted as well **only if** the browser converts it (IMG-2a) or the host has Imagick built with libheif. Everything is stored as JPEG. If an unconverted HEIC reaches the server and cannot be decoded, it is rejected with a clear message rather than stored unreadable.
- IMG-5: Server processing runs as a queued job so the upload request returns quickly. The photo shows "processing" until ready.
- IMG-6: Memory protection. A 40 MP original needs roughly 150 to 200 MB to decode, which the host's inherited memory limit may not allow (section 13.1). Therefore the server only ever decodes an image the browser has already resized, which needs well under 100 MB. A megapixel cap still applies as a second line of defence, and anything above it is rejected with a message that tells the user to retake the photo rather than an error code.
- IMG-7: Upload queue in the browser: files upload one at a time with status (queued, uploading, processing, done, failed) and retry on failure. A dropped VSAT connection must not lose the photo.
- IMG-8: Result target: roughly 300 KB to 800 KB per photo. Rough planning figure: 10,000 photos at 0.5 MB is about 5 GB. Check the cPanel disk quota against that.

---

## 9. Findings

Observations (D-062) and observations/NCs (B-008) are stored in one table.

- FND-1 (v1): Findings are created from "No" answers with the fields in sections 6 and 7 and appear in the PDF.
- FND-2 (v1): List findings per vessel name with filters (open/closed, risk, form, date). Vessel Users see findings whose vessel name matches their own account only.
- FND-3 (v1.1): Lifecycle: Open, Action submitted (by vessel), Verified and Closed (by corporate), Reopened. Target date, owner, overdue flag.
- FND-4 (v1.1): Excel export of findings.

---

## 10. Report lifecycle and status

`reports.status` is a controlled list. Every other rule in this document that refers to "submitted" or "reviewed" (photo locking, watermarking, coverage counting) refers to these values.

| Status | Meaning | Who sets it | What it locks |
| --- | --- | --- | --- |
| `draft` | Created, question structure snapshotted, nothing answered yet | Creator | Nothing. Editable, PDF watermarked DRAFT |
| `in_progress` | Being filled, possibly over several sessions and devices | Creator | Nothing, but shown as active work |
| `submitted` | Content frozen and sent for review | Creator | Answers, ratings, appraisals, photo selection, findings |
| `reviewed` | A Corporate User has checked it | Corporate User | Same as submitted, and records reviewer and date |
| `closed` | Final | Corporate User | All content. Findings continue their own lifecycle (section 9) |
| `reopened` | Returned to the creator for correction | Corporate User | Unlocks editing; the activity log keeps the previous values |

Rules:

- RLS-1: `draft` and `in_progress` are editable in the same way. A report moves to `in_progress` on its first saved answer, so "my work in progress" is a reliable list.
- RLS-2: `submitted` requires every **applicable** question answered. The submit screen lists what is missing and blocks submission until it is resolved or explicitly marked NS/NA.
- RLS-3: Autosave runs only in `draft` and `in_progress`. Before any status change the browser flushes its queue; if the flush fails, the status change is refused rather than silently discarding answers.
- RLS-4: Photos attached to a report are locked at `submitted`.
- RLS-5: `reopened` requires a reason, written to the activity log. Reopening is a normal part of the review loop, not an exception.
- RLS-6: Only `submitted`, `reviewed`, and `closed` reports count in the coverage view (INS-20) and in the previous-report comparison (INS-19).
- RLS-7: Report numbers are assigned at creation and never change. Format is **form code, date, daily sequence**: `D062-20261005-01`, `B008-20261005-02`. The daily sequence is required, because form code plus date alone collides as soon as a superintendent writes two inspections of the same form on the same day, and a duplicate reference number on audit evidence is not acceptable. The sequence is generated in a transaction behind a unique index, so simultaneous creations cannot collide. The date is the report date entered by the inspector, not the creation timestamp, so a report written up the next morning keeps the visit date. This replaces the `AUD-003/2026` numbering shown on form B-008.
- RLS-8: Only a `draft` or `in_progress` report may be deleted, and only by soft delete with a reason in the activity log. Anything that reached `submitted` is never deleted.
- RLS-9: **`closed` is final. A closed report can never be reopened.** If something must change afterwards, a new report is created and the closed one is left alone as the record of what was known at the time. `reopened` exists only to return a `submitted` report to its author for correction, and can be used any number of times before submission is final.

## 11. Reports and output

- REP-1: **The PDF follows the layout of the source form, chapter for chapter and table for table.** For D-062 this means the same order and the same visual blocks as the source document: Chapter 1 General Information (vessel particulars, operations at the time of inspection, last PSC and dry dock dates, the open items / memoranda / Conditions of Class / recommendations / notations table, INTERNAL CIRCULATION), Chapters 2 to 13 checklists with their own column sets, Chapter 14 best practices, Chapter 15 Summary of Observations, Chapter 16 photographic records, and the two comparison blocks at the end. The B-008 audit is built the same way from its own source document.
- REP-1b: **One deliberate change to the D-062 layout: the Report Summary moves from the front to near the end.** In the source document the Report Summary sits inside Chapter 1, right after the header block, and the index reads "1. General Information & Report Summary". In this app the inspector cannot honestly rate chapters 1 to 13 until the checklist is filled in, so the summary is rated last and printed **after Chapter 15 Summary of Observations and before Chapter 16 photographic records**, under the heading `REPORT SUMMARY`. Photographs stay last because they are an appendix.
- REP-1c: The summary keeps its original three-column rating table (No, Item, Very Good, Satisfactory, Unsatisfactory) for chapters 1 to 13, plus the calculated counts of High, Medium and Low observations required by INS-11, which the source form does not have.
- REP-1d: **Chapter numbers are not renumbered.** The moved summary carries no chapter number of its own. Findings already cross-refer to chapter numbers (INS-9, chapter 15), and shifting 15 to 16 would break every job order, VIQ cross-reference and the printed index. The heading says where it came from: `REPORT SUMMARY (printed after Chapter 15; shown in Chapter 1 of form D-062 v01.01)`.
- REP-1e: The printed index at the front is generated from the document's real page numbers, not typed in as fixed text as it is in the source document, where it goes stale as soon as one chapter grows.
- REP-1f: Static text from the form is reproduced as written: the FILL IN INSTRUCTIONS block, the note under the open items table, the notes under the Summary of Observations table, and the "Add or remove lines respectively" instruction. Repeating rows (open items, summary of observations, attendance) add as many rows as needed instead of being clipped to the paper row count.
- REP-1g: Because the layout is now a faithful reproduction, it is the largest single item in v1 and it is template driven: one layout definition per form, both forms sharing the same rendering engine. The spike in section 15 must run before the report UI is built.
- REP-1a: Form code, form version, template version, report number, generation date, and page numbers in the footer of every page.
- REP-2: Signature lines blank. Everything else filled, including each group's comments/remarks under its table.
- REP-3: Inspection PDF includes chapter 16 photos.
- REP-4: Reports are viewable on screen and exportable at any status. Drafts are watermarked "DRAFT".
- REP-5 (v1.1): Dashboard: per vessel, last inspection and audit dates, open findings by risk, overdue close-outs.
- REP-6: PDF generation is a queued job with a visible progress state, built once per report content version and cached. Editing the report invalidates the cache. A web request never waits on a PDF build.
- REP-7: A print stylesheet for printing from the browser, as the fallback when PDF generation fails.
- REP-8: Reports above a size threshold (for example 300 photos) generate a document-only PDF, with photos as a separate appendix PDF, so one file cannot exhaust the host memory limit.

---

## 12. Non-functional requirements

### 11.1 VSAT and connectivity

Ships have VSAT: connected most of the time but slow, high latency, and sometimes dropping. Inertia is a server-driven, online-first approach, so this has to be designed for:

- NFR-1: **Autosave per answer, batched.** An answer is saved with a small background request. No whole-page or whole-chapter submits. The browser queues changes and flushes on blur of the answer control, at most every 5 seconds while typing, and immediately when leaving a group. A full D-062 therefore costs tens of requests instead of six hundred, which is what makes VSAT latency workable.
- NFR-2: Retry queue in the browser (IndexedDB or localStorage) for failed answer saves and photo uploads. A visible "saved / saving / not saved, retrying" indicator. Each queued save carries a client-generated id, so a retry never creates a duplicate answer.
- NFR-3: Load one group at a time, not the whole 430-question form. Keep payloads small.
- NFR-4: Do not depend on large JavaScript bundles. Code-split and keep dependencies minimal.
- NFR-5: Full offline use (open the app and fill a form with no connection at all) is **not** a v1 requirement. NFR-2 covers temporary drops. If vessels turn out to have long dead periods, a later phase can add a service worker.

### 11.2 Other

- NFR-6: Works on phones, tablets, and desktop browsers, including older ship PCs (current and previous major versions of Chrome, Edge, Firefox, Safari).
- NFR-7: UI is plain and functional: default component styling, simple forms and tables. No custom design system, no animations.
- NFR-8: HTTPS only (cPanel AutoSSL). Passwords hashed. Role and vessel checks on every request on the server, not just in the UI.
- NFR-9: Audit log: who changed answers, ratings, findings, status, and template content, with timestamps. Not editable from the app.
- NFR-10: English only for v1.
- NFR-11: Daily database backup and file backup, with at least one copy off the server. Test a restore once.
- NFR-12: Expected size: 30+ vessels. User count and report frequency unknown. Planning assumption: about 200 users, a few reports per vessel per year. Revisit when real numbers are known.
- NFR-13: **Performance targets**, measured over a 2 Mbps link with 600 ms round-trip time, which is a fair worst case for VSAT: a checklist group page under 300 KB transferred and interactive within 3 seconds; an autosave request under 5 KB acknowledged within 2 seconds; a 20 MB photo upload never blocking the UI; report list and gallery pages under 200 KB.
- NFR-14: **Bundle budget.** Measured baseline on this project before feature work: roughly 170 KB gzip of shared JavaScript on every page, of which about 110 KB gzip is the HTTP client shipped inside Inertia. Rule: no new shared dependency above 15 KB gzip without a written reason, per-page chunks under 120 KB gzip, and a bundle report on every build.
- NFR-15: **Concurrency.** Two users may open the same report. Each answer save carries the row version it was based on; a save that would overwrite a newer answer is refused and shown as a conflict rather than silently applied. At report level, one user may hold an advisory edit lock that expires on inactivity, and other users are shown who is editing.
- NFR-16: **Time.** All timestamps are stored in UTC. A record belonging to a vessel is displayed in the vessel's local time; corporate review actions are displayed in office time. Dates a user types (date of last dry dock, target date) are calendar dates and are stored as dates, never as timestamps.
- NFR-17: **Retention.** Reports, answers, findings, and their photos are kept 5 years from closure and then archived, never hard deleted. The activity log is kept for the life of the database. Photos soft deleted before submission are purged after 30 days.

---

## 13. Tech stack and cPanel notes

- Laravel + Inertia + React, MySQL/MariaDB (assumed. Tell me if the backend is not Laravel).
- Image processing: Intervention Image with GD or Imagick (check which is available on the host).
- PDF: dompdf or mPDF (pure PHP, works on cPanel). Headless Chrome is not an option on shared hosting.
- Queue: database queue driver, run by a cron job every minute. Use `queue:work --stop-when-empty --tries=2` with a timeout inside the host's `max_execution_time`, and give the image and PDF jobs their own queue so a slow PDF cannot block a photo. Image and PDF jobs must fit inside the **inherited** memory limit, which is why the browser does the heavy image work and why REP-8 may be mandatory.
- Front end: build assets on a local machine or CI and upload the `public/build` folder. Do not plan on running Node on shared cPanel.

### 13.1 Host facts already known

| Fact | Value | Consequence |
| --- | --- | --- |
| PHP version | up to **8.8** | Satisfies Laravel 13 (`php ^8.3`). Composer resolves against it, so a dependency that does not declare 8.8 support must be caught at install time, not in production |
| INI settings | **inherited only**, cannot be edited per account or per domain | `upload_max_filesize`, `post_max_size`, `memory_limit`, `max_execution_time` and `max_input_vars` are whatever the host sets, and the app must live inside them |

What inherited INI forces on the design:

- **The browser must resize before upload** (IMG-2, IMG-2a), because the host upload limit cannot be raised to 25M. This is now a hard requirement, not a bandwidth optimisation. Target: a file under 1 MB on the wire.
- **The server never decodes a 40 MP original** (IMG-6). Only the already-resized image arrives.
- **Every long operation is queued and every request is small** (NFR-1, NFR-3), because a request that renders 600 rows in one go is a request that can hit `max_execution_time`.
- **`max_input_vars` is untouchable**, which is the original reason answers save one at a time and never post a whole chapter (NFR-1).
- **The PDF must fit the inherited memory limit.** If spike S2 shows neither dompdf nor mPDF can render a full D-062 with photos inside it, the REP-8 split becomes mandatory rather than optional: a document PDF plus a photo appendix.
- **If a photo job is killed by the host**, the photo stays `failed` and the upload queue offers a retry that resends the resized file. Nothing is lost, because the original never left the phone.

Recorded host INI values are kept in `docs/host-ini.md` and read before the spikes run. The design assumes nothing is raised.

### 13.2 Still to confirm on the host

1. PHP version actually selected per domain (MultiPHP Manager), and that it is 8.8 and not lower.
2. SSH access and Composer availability. Without SSH, deployment is much harder, and without Composer on the host the route becomes "build locally, upload `vendor` and `public/build`".
3. The **actual inherited values** of `upload_max_filesize`, `post_max_size`, `memory_limit`, `max_execution_time`, `max_input_vars`. They cannot be changed, so the design has to fit them (section 13.1).
4. PHP `max_input_vars` defaults to 1000, which is another reason to save answers one at a time and never post a whole chapter in one form.
5. GD or Imagick enabled, with HEIC support if possible (often missing). With inherited INI this is the only image backend available.
6. Disk quota and inode limit (thousands of photos plus thumbnails use many files).
7. Cron jobs allowed at a one-minute interval.
8. Document root points to `public/`, never the project root.
9. Resource limits on shared hosting (CPU, RAM, processes). If PDF generation with many photos hits them, a VPS with cPanel is the fix. This is now a live risk, not a contingency: section 13.1 caps the memory the PDF job may use.

---

## 14. Data model (outline)

Naming: `report_*` tables are copies or children of a report, created when the report is created. Template tables (`form_*`) are the live superadmin catalogue.

### 14.1 Identity and reference

There is no `vessels` table. See section 2.1.

| Entity | Notes |
| --- | --- |
| users | role (superadmin / corporate / vessel), **vessel_name** (vessel users only, matched case-insensitively after normalisation), active, name, email |
| vessel_types | name (Cement Carrier, Tanker, ...). Small managed list, needed by applicability (FM-4). Ice class is not here: it is a per-report flag the user types |
| known_vessel_names | **not a table.** A distinct-name lookup built from `users.vessel_name` and `reports.vessel_name`, used for autocomplete only |

### 14.2 Templates (superadmin catalogue)

| Entity | Notes |
| --- | --- |
| forms | code (D-062, B-008), name, form_version, answer set |
| form_groups | form_id, parent_id (subgroup), title, order, enabled, ice_class_only, archived_at |
| form_questions | group_id, text, guidance, input_type (none/date/text/number), order, enabled, archived_at, **source_key** (import traceability, FM-12) |
| form_applicability | one table for both levels: group_id or question_id (nullable), vessel_type_id, or the ice-class flag. Avoids the current mix of a column plus a join table |
| evaluation_criteria | audit only: key, label, description (the 1 to 5 definitions from B-008), order. Config, not code, so wording can change later |

### 14.3 Reports and answers

| Entity | Notes |
| --- | --- |
| reports | type (inspection/audit), **vessel_name** plus typed particulars (vessel_imo, vessel_flag, vessel_gt, vessel_built, vessel_type_id, vessel_ice_class), **status** (section 10), **template_version**, reference number, report date, created_by, submitted_at/by, reviewed_at/by, closed_at, current_version, lock_owner, lock_expires_at, soft_deleted_at + reason |
| report_groups / report_questions | **copies** of group/question text taken when the report is created. report_groups also holds the group comments/remarks text |
| report_questions | plus applicable (bool), **na_reason** (auto or user), answer_allowed values |
| report_answers | question, answer, note, extra value, answered_by, answered_at, **client_save_id** (idempotency, NFR-2), **row_version** (conflict detection, NFR-15) |
| report_operations | report, operation code (from the INS-2 / AUD-2 lists), one row per selected operation. List is configuration, not free text |
| report_voyage | report, sailing_with_vessel, from, to, port |
| report_psc | report, last_port, last_psc_date, detained, deficiencies_found, last_drydock_date, next_drydock_date |
| report_open_items | report, kind (open item / memorandum / condition of class / recommendation / notation), description, due_date, closeout_schedule |
| report_ratings | report, chapter, rating (Very Good / Satisfactory / Unsatisfactory), rated_by, rated_at. Counts of No/NS are computed, never stored |
| report_text_sections | report, section key (comments on No answers, safety meetings, participants, safety and environmental understanding, training needs, best practices, positive comments, negative comments), body |
| report_attendance | report, question key (the ten in INS-13), answer yes/no, detail |
| report_appraisals | report, rank (Master / Chief Engineer / Chief Officer / Second Engineer), appraised yes/no, officer name, comments, attachment_id |
| report_circulation | report, role, date_sent, reviewer_name, date_reviewed |
| report_photo_selections | report, photo_id, included (chapter 16 selection, PHO-6) |

### 14.4 Audit specifics

| Entity | Notes |
| --- | --- |
| auditees | report, name, rank, user_id (nullable link to a vessel user) |
| auditors | report, name, rank, is_lead, user_id nullable |
| audit_activities | report, activity (Bridge/Deck/Engine + extra rows) |
| audit_dates | report, start_date, end_date, audit_type (A/B/C/D + specify), activities covered |
| audit_followup | report, previous_audit_id, previous_ncr_count, previous_observation_count, closeout_notes |
| audit_execution_log | report, person_or_function, date, start_time, end_time, topics |
| auditee_evaluations | audit report, auditee, 7 criteria scores (one row per criterion so criteria are configurable), overall status. **Read restricted**: authors of the audit and Corporate Users only |
| report_signatures | lead auditor / auditors / inspected by / circulation. Name and date captured, **image never uploaded** (signatures stay manual, section 2) |

### 14.5 Findings, photos, audit trail

| Entity | Notes |
| --- | --- |
| findings | report, report_question_id, kind (observation / non-conformity), risk or severity, description, viq_paragraph, job_order_no, target_date, status, owner, action_submitted_at/by, verified_at/by, closed_at, reopened_count. Lifecycle rules in FND-3 |
| photos | **vessel_name**, category, caption, location (free text), report nullable, report_question_id nullable, finding_id nullable, captured_at, uploaded_by, status (processing/ready/failed), original path (nullable), path, thumb_path, width, height, bytes, checksum, soft_deleted_at |
| photo_categories | name, enabled, order |
| attachments | report, file path, label, mime, bytes, uploaded_by |
| activity_log | append only: user, report or template entity, action, field, before, after, at, ip. Never updated or deleted from the app (NFR-9, NFR-17) |
| autosave_queue is **not** a table. The retry queue lives in the browser (NFR-2); the server keeps only the acknowledgement

---

## 15. Phasing

**Spikes first (before any feature build, one or two days each)**
- Parse the two real Word files end to end and produce the review file. Confirms or kills section 5.
- Generate one PDF with a 600-row checklist plus 30 photos through dompdf and through mPDF on the target host, reproducing the D-062 layout including the moved Report Summary, and record time and memory. Decides the renderer for REP-1.
- Push one 20 MB photo from a phone through client resize, upload, queued server processing, and thumbnail. Confirms IMG-1 to IMG-8 and section 13 item 3.

**v1**
- Login, roles, vessel types, known vessel names, users (superadmin)
- Report status and transition policy (section 10), because it governs editing, locking, PDF, and audit log
- Initial import (script, review file, artisan command)
- Form management (groups, questions, enable/disable, applicability)
- Inspection module and audit module with batched autosave and retry queue
- Photo module with the image optimizer
- Findings created and listed
- PDF export, queued and cached

**v1.1**
- Findings lifecycle and Excel export
- Dashboard
- Previous-report comparison and 12-month coverage view
- Layout refinement of the two form templates once real reports exist

**Later (if needed)**
- Full offline mode
- Email notifications
- Photo comparison over time
- Indonesian language
- Import screen in the UI

---

## 16. Decisions made and assumptions

Decided by the project owner:

- D-062 is for corporate, B-008 is for vessel crew.
- Questions are grouped like the files, and the superadmin can add, edit, delete, disable, and enable questions and groups.
- No N/A option on B-008.
- Auditee scores are not shown to other users.
- Signatures stay blank and manual.
- Start clean. No old reports are migrated.
- Superadmin edits templates, no approval step.
- Hosting on cPanel, stack Inertia + React.
- VSAT connectivity, 30+ vessels.

Added in 0.3, to be confirmed by the project owner:

- Report statuses are draft, in_progress, submitted, reviewed, closed, reopened (section 10).
- Inapplicable questions stay in the report as auto-NA with a reason, rather than disappearing (FM-4).
- The PDF reproduces the D-062 and B-008 layouts, with the Report Summary moved to after Chapter 15 (REP-1, REP-1b). Chapter numbers are not renumbered.
- HEIC is converted in the browser; the server does not depend on libheif (IMG-2a).
- Answers autosave in batches, flushed on blur, every 5 seconds, and on leaving a group (NFR-1).
- Records are retained 5 years from closure, archived, never hard deleted (NFR-17).
- No vessel master table. Vessel particulars are typed by the user; vessel users are scoped by a normalised vessel name (section 2.1).
- A closed report is final and is never reopened (RLS-9).
- Report numbers are form code, date, daily sequence (RLS-7).
- The host runs PHP 8.8 with inherited INI only, so client-side resizing and small requests are architecture, not optimisation (section 13.1).
- Five year retention confirmed (NFR-17).

### 16.1 Non-goals for v1

Not in v1, so that scope creep has to be a decision rather than a drift:

- No correction to an old report's printed layout. A report's PDF is regenerated from the template version it was created with, and that layout is frozen; later template changes affect new reports only.
- No full offline mode, and no service worker.
- No email or push notifications. Nothing tells Corporate that an action was submitted; they see it on the dashboard. Revisit when FND-3 lands, because the close-out loop is weak without it.
- No approval workflow of any kind, including for findings close-out by corporate.
- No digital signatures. Name and date are recorded, the wet signature stays on paper.
- No crew appraisal workflow. Appraisal is a set of fields on the inspection report (INS-15).
- No photo annotation, comparison, or before/after in v1.
- No multi-language.
- No per-user vessel restriction for Corporate Users, and no external sharing links.
- No mobile app. Responsive web only.

Assumptions in this draft (change them if wrong):

1. Corporate Users can see all vessels (no per-user vessel assignment in v1).
2. Vessel Users can see observations on records matching their own vessel name, but not D-062 appraisals or chapter ratings.
3. D-024, C1-013/014, E-004, and B-001 are not built as forms. They can be uploaded as attachments to a report.
4. "Image optimizer (20 MB min)" means accepting originals of at least 20 MB, not limiting uploads to 20 MB.
5. Originals are discarded after optimization.
6. Laravel is the backend.
7. About 200 users as a planning figure.
8. "Room condition" is a photo category that covers any room. The specific room is recorded in the photo's location field.
9. The cPanel host allows SSH, one-minute cron, and enough disk and memory (section 13 checklist).
10. Five years retention matches the company's ISM record obligations.

---

## 17. Open questions

Each item needs an owner and a date. The first one blocks the data model.

| # | Question | Blocks | Owner |
| --- | --- | --- | --- |
| OQ-1 | **RESOLVED in 0.4.** The `vessels` entity is removed. Vessel particulars are typed per report and vessel users are scoped by a normalised vessel name on their account (section 2.1). Consequences accepted: name typos are the main access risk, name changes are a logged bulk rename, and vessel names are treated as unique. | Closed | Closed |
| OQ-2 | **RESOLVED in 0.6.** Status list accepted. `closed` is final and can never be reopened (RLS-9); `reopened` only returns a `submitted` report to its author for correction. | Closed | Closed |
| OQ-3 | **RESOLVED in 0.5.** The PDF follows the D-062 layout, with the Report Summary moved to after Chapter 15 (REP-1, REP-1b). | Closed | Closed |
| OQ-4 | Does the DPA accept crew-completed internal audits where the Master may audit a colleague? (section 7 note) | Section 7 | DPA |
| OQ-5 | **PARTLY RESOLVED in 0.6.** PHP up to 8.8, INI inherited and unchangeable. Still need the actual inherited INI values, GD or Imagick, cron, disk quota, SSH. | Phase 0 spikes | IT |
| OQ-6 | **RESOLVED in 0.6.** Five year retention confirmed (NFR-17). | Closed | Closed |
| OQ-7 | **RESOLVED in 0.6.** Form code plus date plus a daily sequence, for example `D062-20261005-01`. The daily sequence was added because form code plus date alone collides on a busy day (RLS-7). Note this replaces the `AUD-003/2026` numbering printed on form B-008. | Closed | Closed |
| OQ-8 | Real user count and report frequency, to replace the 200 user planning figure. | NFR-12 | Project owner |
