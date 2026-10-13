<?php

namespace App\Services\Pdf;

use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use App\Services\Pdf\Contracts\PdfWriter;
use App\Services\Pdf\Writers\MpdfWriter;
use Illuminate\Support\Facades\Storage;

/**
 * The shared PDF rendering engine (SRS REP-1g, REP-6, PLAN 6.1).
 *
 * Both D-062 and B-008 share this engine. Each form carries a `layout_schema` JSON
 * definition that lists the ordered sections and their configuration. The engine
 * walks the schema and dispatches each section to a renderer method named after
 * the section type, so adding a new form layout is a matter of editing the schema,
 * not writing new PHP.
 */
class ReportPdfRenderer
{
    public function __construct(
        protected ?ReportDocumentBuilder $documentBuilder = null,
        protected ?PdfWriter $pdfWriter = null,
    ) {
        $this->documentBuilder = $documentBuilder ?? new ReportDocumentBuilder;
        $this->pdfWriter = $pdfWriter ?? new MpdfWriter;
    }

    /**
     * Render the full HTML document for a report's PDF.
     *
     * Pre-loads all report data in <= 7 queries via ReportDocumentBuilder.
     */
    public function render(Report $report, ?array $document = null): string
    {
        $doc = $document ?? $this->documentBuilder->build($report);
        $schema = $this->resolveLayoutSchema($report);

        $sectionsHtml = '';
        foreach ($schema['sections'] as $sectionDef) {
            $sectionsHtml .= $this->renderSection($report, $sectionDef, $doc);
        }

        return $this->wrapDocument($report, $sectionsHtml, $schema, $doc);
    }

    /**
     * Build the complete HTML document with header, footer, watermark.
     */
    protected function wrapDocument(Report $report, string $sections, array $schema, ?array $doc = null): string
    {
        $doc = $doc ?? $this->documentBuilder->build($report);
        $footerFields = $schema['footer']['fields'] ?? [];
        $footerText = $this->buildFooterText($report, $footerFields);
        $styles = $this->documentStyles($schema);

        if (view()->exists('pdf.document')) {
            return view('pdf.document', [
                'report' => $report,
                'doc' => $doc,
                'schema' => $schema,
                'sections' => $sections,
                'styles' => $styles,
                'footerText' => $footerText,
            ])->render();
        }

        $isDraft = in_array($report->status, ['draft', 'in_progress', 'reopened'], true);
        $watermark = $isDraft ? ($schema['watermark']['draft_label'] ?? 'DRAFT') : '';

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{$styles}</style>
</head>
<body>
<div class="watermark">{$watermark}</div>
{$sections}
<div class="footer">{$footerText}</div>
</body>
</html>
HTML;
    }

    /**
     * Resolve the layout schema, falling back to a default per form code.
     */
    protected function resolveLayoutSchema(Report $report): array
    {
        $schema = $report->relationLoaded('form') ? $report->form->layout_schema : null;

        if (empty($schema)) {
            $schema = $this->defaultLayoutForForm($report->form->code ?? 'D-062');
        }

        return $schema;
    }

    /**
     * Default layout schema per form code. Used when the form has no layout_schema
     * column or it is empty (e.g. a fresh install before the seeder runs).
     */
    protected function defaultLayoutForForm(string $formCode): array
    {
        return $formCode === 'B-008'
            ? $this->defaultB008Layout()
            : $this->defaultD062Layout();
    }

    protected function defaultD062Layout(): array
    {
        return [
            'sections' => [
                ['type' => 'cover', 'title_key' => 'inspection_report'],
                ['type' => 'general_info', 'title' => 'Chapter 1 - General Information', 'components' => ['vessel_particulars', 'operations_grid', 'psc_drydock', 'open_items_table', 'internal_circulation']],
                ['type' => 'checklist_chapters', 'column_labels' => ['No.', 'Item', 'Yes', 'No', 'NS', 'NA']],
                ['type' => 'best_practices', 'chapter_no' => '14'],
                ['type' => 'summary_of_observations', 'chapter_no' => '15'],
                ['type' => 'report_summary', 'position' => 'after_chapter_15'],
                ['type' => 'photo_chapter', 'chapter_no' => '16'],
                ['type' => 'comparison_blocks'],
                ['type' => 'circulation'],
                ['type' => 'signature_lines'],
            ],
            'footer' => [
                'fields' => ['form_code', 'form_version', 'template_version', 'report_number', 'generation_date', 'page_number'],
            ],
            'watermark' => ['draft_label' => 'DRAFT'],
            'photo_appendix_threshold' => 100,
        ];
    }

    protected function defaultB008Layout(): array
    {
        return [
            'sections' => [
                ['type' => 'cover', 'title_key' => 'audit_report'],
                ['type' => 'audit_header', 'components' => ['audit_details', 'operations', 'followup']],
                ['type' => 'checklist_chapters', 'column_labels' => ['No.', 'Item', 'Yes', 'No', 'N/S']],
                ['type' => 'audit_summary'],
                ['type' => 'comparison_blocks'],
                ['type' => 'circulation'],
                ['type' => 'signature_lines'],
            ],
            'footer' => [
                'fields' => ['form_code', 'form_version', 'template_version', 'report_number', 'generation_date', 'page_number'],
            ],
            'watermark' => ['draft_label' => 'DRAFT'],
            'photo_appendix_threshold' => 100,
        ];
    }

    /**
     * Dispatch a section definition to its renderer method or Blade partial.
     *
     * The method name is derived from the section type:
     *   "checklist_chapters" -> renderChecklistChaptersSection()
     *   "general_info"       -> renderGeneralInfoSection()
     *
     * @param  array{type: string}  $sectionDef
     */
    protected function renderSection(Report $report, array $sectionDef, ?array $doc = null): string
    {
        $doc = $doc ?? $this->documentBuilder->build($report);
        $type = $sectionDef['type'] ?? '';
        $viewName = "pdf.sections.{$type}";

        if (view()->exists($viewName)) {
            return view($viewName, [
                'report' => $report,
                'doc' => $doc,
                'config' => $sectionDef,
            ])->render();
        }

        $method = 'render'.str_replace('_', '', ucwords($type, '_')).'Section';

        if (! method_exists($this, $method)) {
            return "<!-- Unsupported section type: {$type} -->\n";
        }

        /** @var string $method */
        /** @noinspection PhpPossiblePolymorphicMethodIsInvocationAllowedInspection */

        return $this->$method($report, $sectionDef);
    }

    // ------------------------------------------------------------------
    // Section renderers.  Each returns a string of HTML for one section.
    // Tasks 6.2–6.12 flesh out the bodies; 6.1 establishes the contract.
    // ------------------------------------------------------------------

    /**
     * Cover / title page (REP-1, REP-2).
     */
    protected function renderCoverSection(Report $report, array $config): string
    {
        $titleKey = $config['title_key'] ?? ($report->report_type === 'audit' ? 'audit_report' : 'inspection_report');
        $titles = [
            'inspection_report' => 'VESSEL INSPECTION REPORT',
            'audit_report' => 'VESSEL INTERNAL AUDIT CHECKLIST',
        ];
        $title = $titles[$titleKey] ?? $titles['inspection_report'];

        $formCode = $this->escape($report->form->code ?? '');
        $rawFormVersion = (string) ($report->form->form_version ?? '');
        $formVersion = $this->escape(str_starts_with($rawFormVersion, 'v') ? $rawFormVersion : 'v'.$rawFormVersion);
        $templateVersion = (int) ($report->template_version ?? 1);
        $reportRef = $this->escape($report->reference_number ?? '');
        $vesselName = $this->escape($report->vessel_name ?? '');
        $reportDate = $report->report_date?->format('d F Y') ?? now()->format('d F Y');
        $statusLabel = strtoupper(str_replace('_', ' ', (string) $report->status));

        return <<<HTML
<div class="page-break-after">
  <div class="cover">
    <h1 class="cover-title">{$title}</h1>
    <table class="cover-table">
      <tr><td class="cover-label">Report No.</td><td class="cover-value">{$reportRef}</td></tr>
      <tr><td class="cover-label">Form</td><td class="cover-value">{$formCode} ({$formVersion}, template v{$templateVersion})</td></tr>
      <tr><td class="cover-label">Vessel</td><td class="cover-value">{$vesselName}</td></tr>
      <tr><td class="cover-label">Date</td><td class="cover-value">{$reportDate}</td></tr>
      <tr><td class="cover-label">Status</td><td class="cover-value">{$statusLabel}</td></tr>
    </table>
  </div>
</div>
HTML;
    }

    /**
     * D-062 Chapter 1: General Information (INS-1, INS-2, INS-3, INS-4, REP-1).
     *
     * @param  array{title?: string, components?: string[], static_texts?: array}  $config
     */
    protected function renderGeneralInfoSection(Report $report, array $config): string
    {
        $title = $config['title'] ?? 'Chapter 1 - General Information';
        $parts = [];

        // Vessel particulars
        $parts[] = $this->renderVesselParticulars($report);

        // Operations grid (INS-2)
        $parts[] = $this->renderOperationsGrid($report);

        // PSC and dry dock (INS-3)
        $parts[] = $this->renderPscDrydock($report);

        // Open items table (INS-4)
        $parts[] = $this->renderOpenItemsTable($report);

        // Internal circulation (INS-18)
        $parts[] = $this->renderInternalCirculation($report);

        // Static text blocks (REP-1f)
        $staticTexts = $config['static_texts'] ?? [];
        if (! empty($staticTexts['fill_in_instructions'])) {
            $parts[] = $this->renderStaticText('FILL IN INSTRUCTIONS', $staticTexts['fill_in_instructions']);
        }
        if (! empty($staticTexts['open_items_note'])) {
            $parts[] = $this->renderStaticText(null, $staticTexts['open_items_note']);
        }

        $sections = implode("\n", $parts);

        return <<<HTML
<div class="section page-break-before">
  <h2 class="chapter-title">{$title}</h2>
  {$sections}
</div>
HTML;
    }

    /**
     * Audit header for B-008 (AUD-1, AUD-2, AUD-3, AUD-4).
     */
    protected function renderAuditHeaderSection(Report $report, array $config): string
    {
        $title = $config['title'] ?? 'General Information';
        $parts = [];

        $parts[] = $this->renderVesselParticulars($report);
        $parts[] = $this->renderOperationsGrid($report);

        // PSC block not used for B-008, but follow-up from previous audit (AUD-4)
        $parts[] = $this->renderFollowupBlock($report);

        $sections = implode("\n", $parts);

        return <<<HTML
<div class="section page-break-before">
  <h2 class="chapter-title">{$title}</h2>
  {$sections}
</div>
HTML;
    }

    /**
     * Checklist chapters — the core repeating structure (INS-5, INS-6, INS-7, INS-8).
     *
     * Renders all top-level report groups as chapter tables. The column labels
     * come from the layout schema so D-062 gets Yes/No/NS/NA and B-008 gets Yes/No/N/S.
     *
     * @param  array{column_labels?: string[], start_chapter?: string, end_chapter?: string}  $config
     */
    protected function renderChecklistChaptersSection(Report $report, array $config): string
    {
        $columnLabels = $config['column_labels'] ?? ['No.', 'Item', 'Yes', 'No', 'NS', 'NA', 'Remarks'];
        $isB008 = ($report->form->code ?? '') === 'B-008';

        // The answer columns depend on the form's answer_set
        $answerColumns = $this->answerColumnsForForm($report->form->answer_set ?? ($isB008 ? 'b008_yes_no_ns' : 'd062_yes_no_ns_na'));

        $html = '';
        $topGroups = $report->groups()->whereNull('parent_id')->orderBy('sort_order')->get();

        foreach ($topGroups as $group) {
            // Skip Chapter 1 which is rendered by renderGeneralInfoSection
            if ($group->chapter_no === '1' || $this->isChapterOne($group)) {
                continue;
            }

            $html .= $this->renderChecklistChapter($report, $group, $columnLabels, $answerColumns);
        }

        return $html;
    }

    /**
     * Render a single checklist chapter table with subgroups (REP-1, 6.3).
     */
    protected function renderChecklistChapter(Report $report, ReportGroup $group, array $columnLabels, array $answerColumns): string
    {
        $chapterNo = $this->escape((string) ($group->chapter_no ?? $group->sort_order));
        $title = $this->escape($group->title);
        $isApplicable = $group->is_applicable;
        $naReason = $this->escape($group->na_reason ?? '');

        $rows = '';
        $questionIndex = 0;

        // Direct questions
        $questions = $group->questions()->orderBy('sort_order')->get();
        foreach ($questions as $question) {
            $questionIndex++;
            $rows .= $this->renderQuestionRow($report, $question, $questionIndex, $answerColumns);
        }

        // Subgroups
        $subgroups = $group->subgroups()->orderBy('sort_order')->get();
        foreach ($subgroups as $subgroup) {
            $rows .= $this->renderSubgroupHeader($subgroup->title, $subgroup->na_reason ?? '');

            $subQuestions = $subgroup->questions()->orderBy('sort_order')->get();
            foreach ($subQuestions as $question) {
                $questionIndex++;
                $rows .= $this->renderQuestionRow($report, $question, $questionIndex, $answerColumns);
            }
        }

        $applicabilityNote = $isApplicable
            ? ''
            : '<div class="na-banner">NOT APPLICABLE: '.($naReason ?: 'N/A').'</div>';

        // Properly map each column label to its CSS class
        $headerThs = '';
        foreach ($columnLabels as $idx => $label) {
            $norm = strtolower(trim($label));
            $thClass = match ($norm) {
                'no.' => 'no-col',
                'item' => 'q-col',
                'remarks' => 'remarks-cell',
                default => 'ans-col text-center',
            };
            $headerThs .= "<th class=\"{$thClass}\">".$this->escape($label).'</th>';
        }

        $commentsHtml = '';
        if (! empty($group->comments)) {
            $commentsHtml = '<div class="chapter-comments"><strong>COMMENTS / REMARKS:</strong> '.$this->formatMultiline($group->comments).'</div>';
        }

        return <<<HTML
<div class="chapter" id="chapter-{$chapterNo}">
  <h3 class="chapter-header">Chapter {$chapterNo} - {$title}</h3>
  {$applicabilityNote}
  <table class="checklist-table">
    <thead>
      <tr>{$headerThs}</tr>
    </thead>
    <tbody>
      {$rows}
    </tbody>
  </table>
  {$commentsHtml}
</div>
HTML;
    }

    /**
     * Render a single question row with its answer.
     */
    protected function renderQuestionRow(Report $report, ReportQuestion $question, int $questionNumber, array $answerColumns): string
    {
        $num = $questionNumber;
        $text = $this->escape($question->question_text);
        $guidance = $question->guidance ? $this->escape($question->guidance) : '';
        $note = $this->formatMultiline($question->answer?->note ?? '');
        $extraValue = $this->escape($question->answer?->extra_value ?? '');

        $cells = '<td class="no-col">'.$num.'</td>';
        $cells .= '<td class="q-col">'.$text;
        if ($guidance) {
            $cells .= '<div class="guidance">'.$guidance.'</div>';
        }
        if ($extraValue && in_array($question->answer?->answer, ['yes', 'no', 'ns', 'na'], true)) {
            $cells .= '<div class="extra-value">'.$extraValue.'</div>';
        }
        $cells .= '</td>';

        foreach ($answerColumns as $colKey => $colLabel) {
            $answerVal = $question->answer?->answer;
            $checked = ($answerVal === $colKey) ? '●' : '';
            $cells .= '<td class="ans-col text-center">'.$checked.'</td>';
        }

        $cells .= '<td class="remarks-cell">'.$note.'</td>';

        return '<tr>'.$cells.'</tr>';
    }

    /**
     * Best practices free text (INS-14, REP-1).
     */
    protected function renderBestPracticesSection(Report $report, array $config): string
    {
        $chapterNo = $config['chapter_no'] ?? '14';
        $title = $config['title'] ?? "Chapter {$chapterNo} - Best Practices";
        $text = $this->formatMultiline($report->summary_data['best_practices'] ?? $report->summary_data['best_practices_text'] ?? '');

        return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$title}</h3>
  <div class="best-practices">{$text}</div>
</div>
HTML;
    }

    /**
     * Chapter 15: Summary of Observations (INS-9, REP-1, Task 4.1).
     */
    protected function renderSummaryOfObservationsSection(Report $report, array $config): string
    {
        $chapterNo = $config['chapter_no'] ?? '15';
        $title = $config['title'] ?? "Chapter {$chapterNo} - Summary of Observations";

        $rows = '';
        $sortOrder = 0;
        foreach ($report->findings as $finding) {
            $sortOrder++;
            $rows .= $this->renderObservationRow($finding, $sortOrder);
        }

        if ($rows === '') {
            $rows = '<tr><td colspan="7" class="empty-row text-center">No observations recorded.</td></tr>';
        }

        return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$title}</h3>
  <table class="findings-table">
    <thead>
      <tr>
        <th>No.</th>
        <th>Chapter</th>
        <th>VIQ / Paragraph</th>
        <th>Description</th>
        <th>Risk</th>
        <th>Job Order No.</th>
        <th>Target Date</th>
      </tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
</div>
HTML;
    }

    /**
     * The moved Report Summary (REP-1b, REP-1c, INS-10, INS-11, INS-12).
     *
     * Appears after Chapter 15, before Chapter 16. Renders the ratings matrix,
     * the calculated counts of High/Medium/Low observations, and the dynamic
     * executive text fields from summary_schema.
     */
    protected function renderReportSummarySection(Report $report, array $config): string
    {
        $heading = $config['heading'] ?? 'REPORT SUMMARY';
        $formCode = $report->form->code ?? 'D-062';
        $formVersion = $report->form->form_version ?? 'v01.01';

        $ratingsHtml = $this->renderRatingsMatrix($report);

        // Executive text fields from summary_schema.text_fields
        $textFieldsHtml = $this->renderSummaryTextFields($report);

        return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$heading}</h3>
  <div class="summary-notice" style="font-size:8pt;color:#666;margin-bottom:10pt;">
    (Printed after Chapter 15; shown in Chapter 1 of form {$formCode} {$formVersion})
  </div>
  {$ratingsHtml}
  {$textFieldsHtml}
</div>
HTML;
    }

    /**
     * Chapter 16: Photographic records / photo chapter (PHO-6, REP-3, REP-8).
     *
     * When the photo count exceeds the layout threshold (default 100), this
     * section signals the appendix split so the caller can generate a separate
     * photo appendix PDF.
     */
    protected function renderPhotoChapterSection(Report $report, array $config): string
    {
        $chapterNo = $config['chapter_no'] ?? '16';
        $title = $config['title'] ?? "Chapter {$chapterNo} - Photographic Records";

        $photos = $report->photos ?? collect();
        $threshold = $config['photo_appendix_threshold'] ?? 100;
        $shouldSplit = $photos->count() > $threshold;

        if ($shouldSplit) {
            $splitNote = '<div class="split-note">This report contains '.$photos->count().' photographs. Photographic appendix is compiled as a separate volume due to size limit.</div>';

            return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$title}</h3>
  {$splitNote}
</div>
HTML;
        }

        // Deterministic sort: item_no, sort_order, then id
        $sortedPhotos = $photos->sortBy(fn ($p) => [
            $p->item_no ?? 999999,
            $p->sort_order ?? 999999,
            $p->id,
        ]);

        $photoHtml = '';
        foreach ($sortedPhotos as $photo) {
            $photoHtml .= $this->renderPhotoItem($photo);
        }

        if ($photoHtml === '') {
            $photoHtml = '<div class="no-photos">No photographic records attached.</div>';
        }

        return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$title}</h3>
  {$photoHtml}
</div>
HTML;
    }

    /**
     * The two comparison blocks at the end (INS-19).
     */
    protected function renderComparisonBlocksSection(Report $report, array $config): string
    {
        $html = '';

        // Comparison with last 3 reports of the same vessel
        $html .= '<div class="section page-break-before">';
        $html .= '<h3 class="chapter-header">Comparison with Previous Reports</h3>';
        $html .= '<div class="comparison-block">Historical inspection comparison will be compiled once previous reports are completed.</div>';
        $html .= '</div>';

        // Comparison with last 3 reports by the same inspector
        $html .= '<div class="section page-break-before">';
        $html .= '<h3 class="chapter-header">Comparison with Previous Reports by Same Inspector</h3>';
        $html .= '<div class="comparison-block">Historical inspector comparison will be compiled once previous reports are completed.</div>';
        $html .= '</div>';

        return $html;
    }

    /**
     * Internal circulation table (INS-18, REP-1).
     */
    protected function renderCirculationSection(Report $report, array $config): string
    {
        return '<div class="section page-break-before"><h3 class="chapter-header">Internal Circulation</h3>'
            .'<table class="circulation-table"><tr><th>Role</th><th>Date Sent</th><th>Reviewed By</th><th>Date Reviewed</th></tr>'
            .'<tr><td colspan="4" class="empty-row">Not yet circulated.</td></tr>'
            .'</table></div>';
    }

    /**
     * Internal circulation table as a component inside a section (INS-18, REP-1).
     * Component-level renderer for the "internal_circulation" entry listed under
     * the general_info section's components array.
     */
    protected function renderInternalCirculation(Report $report): string
    {
        return '<h4 class="subsection-title">Internal Circulation</h4>'
            .'<table class="circulation-table"><tr><th>Role</th><th>Date Sent</th><th>Reviewed By</th><th>Date Reviewed</th></tr>'
            .'<tr><td colspan="4" class="empty-row">Not yet circulated.</td></tr>'
            .'</table>';
    }

    /**
     * B-008 Chapter 18: Audit Summary & NCRs (AUD-3).
     *
     * Renders findings as a summary table with NCR tracking columns,
     * plus a ratings matrix for the audit result.
     */
    protected function renderAuditSummarySection(Report $report, array $config): string
    {
        $chapterNo = $config['chapter_no'] ?? '18';
        $title = $config['title'] ?? 'Audit Summary & NCRs';

        $rows = '';
        $sortOrder = 0;
        foreach ($report->findings as $finding) {
            $sortOrder++;
            $rows .= $this->renderObservationRow($finding, $sortOrder);
        }

        if ($rows === '') {
            $rows = '<tr><td colspan="7" class="empty-row">No observations recorded.</td></tr>';
        }

        $ratingsHtml = $this->renderRatingsMatrix($report);

        return <<<HTML
<div class="section page-break-before">
  <h3 class="chapter-header">{$title}</h3>
  <table class="findings-table">
    <thead>
      <tr>
        <th>No.</th>
        <th>Chapter</th>
        <th>VIQ / Paragraph</th>
        <th>Description</th>
        <th>Risk</th>
        <th>Job Order No.</th>
        <th>Target Date</th>
      </tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
  {$ratingsHtml}
</div>
HTML;
    }

    /**
     * Blank signature lines (REP-2, AUD-14).
     */
    protected function renderSignatureLinesSection(Report $report, array $config): string
    {
        $isB008 = ($report->form->code ?? '') === 'B-008';
        $lines = $isB008
            ? [
                'Lead Auditor',
                'Auditor(s)',
                'Master / Chief Officer',
            ]
            : [
                'Inspector',
                'Master',
                'Chief Engineer',
                'Chief Officer',
                'Superintendent',
            ];

        $html = '<div class="section page-break-before"><h3 class="chapter-header">Signatures</h3>';
        $html .= '<div class="signature-lines">';
        foreach ($lines as $role) {
            $html .= "<div class=\"signature-line\"><span class=\"sig-label\">{$role}:</span> _________________________________ <span class=\"sig-date\">Date: ____/____/______</span></div>";
        }
        $html .= '</div></div>';

        return $html;
    }

    // ------------------------------------------------------------------
    // Sub-renderers for reusable content blocks
    // ------------------------------------------------------------------

    protected function renderVesselParticulars(Report $report): string
    {
        $fields = [
            'Vessel Name' => $report->vessel_name ?? '',
            'IMO No.' => $report->vessel_imo ?? '',
            'Flag' => $report->vessel_flag ?? '',
            'Gross Tonnage' => $report->vessel_gt ?? '',
            'Year Built' => $report->vessel_built ?? '',
            'Vessel Type' => $report->vesselType?->name ?? '',
            'Ice Class Vessel' => $report->vessel_ice_class ? 'Yes' : 'No',
            'Master' => $report->master_name ?? '',
            'Chief Engineer' => $report->chief_engineer_name ?? '',
            'Chief Officer' => $report->chief_officer_name ?? '',
            'Inspected By' => $report->inspected_by ?? '',
            'Port' => $report->port ?? '',
            'Report Date' => $report->report_date?->format('d F Y') ?? '',
        ];

        $rows = '';
        foreach ($fields as $label => $value) {
            $rows .= "<tr><td class=\"field-label\">{$label}</td><td class=\"field-value\">{$this->escape((string) $value)}</td></tr>";
        }

        $voyageHtml = $this->renderVoyageInfo($report);

        return "<table class=\"particulars-table\">{$rows}</table>\n{$voyageHtml}";
    }

    /**
     * Operations at time of inspection (INS-2, AUD-2).
     */
    protected function renderOperationsGrid(Report $report): string
    {
        $operations = $report->operations ?? [];
        if (! is_array($operations)) {
            $operations = [];
        }

        // Standard operation list for D-062 (INS-2) and B-008 (AUD-2)
        $allOps = [
            'loading' => 'Loading',
            'discharging' => 'Discharging',
            'bunkering' => 'Bunkering',
            'deballasting' => 'Deballasting',
            'ballasting' => 'Ballasting',
            'river_transit' => 'River transit',
            'igs_in_operation' => 'IGS in operation',
            'major_repairs' => 'Major repairs/Drydock',
            'cow_in_progress' => 'COW in progress',
            'repairs_under_way' => 'Repairs under way',
            'sts_operations' => 'STS operations',
            'idle' => 'Idle',
            'at_anchor' => 'At anchor',
            'at_sea' => 'At sea/Sailing',
            'other' => 'Other',
            'repairs_afloat' => 'Repairs afloat',
            'drydock' => 'Drydock',
        ];

        $selected = is_array($operations) ? array_map('strtolower', $operations) : [];

        $rows = '';
        foreach ($allOps as $key => $label) {
            $checked = in_array($key, $selected, true) ? '☒' : '☐';
            $rows .= "<tr><td>{$this->escape($label)}</td><td class=\"text-center\">{$checked}</td></tr>";
        }

        $header = ($report->form->code ?? '') === 'B-008'
            ? 'Operation at Time of Audit'
            : 'Operations at Time of Inspection';

        return "<h4 class=\"subsection-title\">{$header}</h4><table class=\"ops-table\">{$rows}</table>";
    }

    /**
     * Last PSC inspection and dry dock dates (INS-3).
     */
    protected function renderPscDrydock(Report $report): string
    {
        $fields = [
            'Port of Last PSC Inspection' => $report->psc_last_port ?? '',
            'Date of Last PSC Inspection' => $report->psc_last_date?->format('d F Y') ?? '',
            'Detained or Deficiencies Found' => $report->psc_detained_or_deficiencies ? 'Yes' : 'No',
            'Date of Last Dry Dock' => $report->drydock_last_date?->format('d F Y') ?? '',
            'Date of Next Dry Dock' => $report->drydock_next_date?->format('d F Y') ?? '',
        ];

        $rows = '';
        foreach ($fields as $label => $value) {
            $rows .= "<tr><td class=\"field-label\">{$label}</td><td class=\"field-value\">{$this->escape((string) $value)}</td></tr>";
        }

        return "<h4 class=\"subsection-title\">PSC Inspection and Dry Dock Dates</h4><table class=\"particulars-table\">{$rows}</table>";
    }

    /**
     * Open items, memoranda, conditions of class, recommendations, notations (INS-4).
     */
    protected function renderOpenItemsTable(Report $report): string
    {
        return '<h4 class="subsection-title">Open Items / Memoranda / Conditions of Class / Recommendations / Notations</h4>'
            .'<table class="findings-table">'
            .'<thead><tr><th>Kind</th><th>Description</th><th>Due Date</th><th>Close-out Schedule</th></tr></thead>'
            .'<tbody><tr><td colspan="4" class="empty-row">No open items recorded.</td></tr></tbody>'
            .'</table>';
    }

    /**
     * Sailing with vessel, from/to (INS-1 voyage data).
     */
    protected function renderVoyageInfo(Report $report): string
    {
        $rows = '';
        $rows .= '<tr><td class="field-label">Sailing With Vessel</td><td>'.($report->sailing_with_vessel ? 'Yes' : 'No').'</td></tr>';
        if ($report->sailing_from) {
            $rows .= "<tr><td class=\"field-label\">From</td><td>{$this->escape($report->sailing_from)}</td></tr>";
        }
        if ($report->sailing_to) {
            $rows .= "<tr><td class=\"field-label\">To</td><td>{$this->escape($report->sailing_to)}</td></tr>";
        }

        return "<h4 class=\"subsection-title\">Voyage Information</h4><table class=\"particulars-table\">{$rows}</table>";
    }

    /**
     * Follow-up from previous audit (AUD-4).
     */
    protected function renderFollowupBlock(Report $report): string
    {
        $rows = '';
        $rows .= '<tr><td class="field-label">Previous Audit Number</td><td class="field-value">-</td></tr>';
        $rows .= '<tr><td class="field-label">Previous NCR Count</td><td class="field-value">-</td></tr>';
        $rows .= '<tr><td class="field-label">Previous Observation Count</td><td class="field-value">-</td></tr>';
        $rows .= '<tr><td class="field-label">Close-out Verification</td><td class="field-value">-</td></tr>';

        return "<h4 class=\"subsection-title\">Follow-up from Previous Audit</h4><table class=\"particulars-table\">{$rows}</table>";
    }

    /**
     * A single photo item in the photo chapter (PHO-6, REP-3).
     */
    protected function renderPhotoItem($photo): string
    {
        $title = $this->escape($photo->title ?? '');
        $caption = $this->formatMultiline($photo->caption ?? '');
        $description = $this->formatMultiline($photo->description ?? '');
        $category = $this->escape($photo->category?->name ?? (string) ($photo->photo_category_id ?? ''));
        $location = $this->escape($photo->location ?? '');
        $itemNo = (int) ($photo->item_no ?? $photo->sort_order ?? 1);

        $localPath = null;
        if (! empty($photo->file_path)) {
            $candidate = storage_path('app/public/'.$photo->file_path);
            if (file_exists($candidate)) {
                $localPath = $candidate;
            }
        }

        if ($localPath) {
            $imgSrc = 'file:///'.str_replace('\\', '/', $localPath);
        } else {
            $imgSrc = $photo->file_url ?? '';
        }

        $imgTag = $imgSrc
            ? "<img src=\"{$imgSrc}\" class=\"photo-img\" alt=\"{$title}\" />"
            : '<div class="photo-placeholder">Photo file not available</div>';

        return <<<HTML
<div class="photo-item">
  <div class="photo-number">#{$itemNo}</div>
  {$imgTag}
  <div class="photo-meta">
    <div class="photo-title">{$title}</div>
    <div class="photo-caption">{$caption}</div>
    <div class="photo-description">{$description}</div>
    <div class="photo-category">Category: {$category}</div>
    <div class="photo-location">Location: {$location}</div>
  </div>
</div>
HTML;
    }

    /**
     * A findings/observation row in the Summary of Observations (INS-11, INS-9).
     */
    protected function renderObservationRow($finding, int $rowNum): string
    {
        $chapter = $this->escape($finding->chapter_label ?? $finding->group?->title ?? '');
        $viq = $this->escape($finding->viq_paragraph ?? '');
        $description = $this->formatMultiline($finding->description ?? '');
        $risk = $this->escape(ucfirst($finding->risk ?? $finding->severity ?? '-'));
        $jobOrder = $this->escape($finding->job_order_no ?? '-');
        $targetDate = $finding->target_date?->format('d F Y') ?? '-';

        return '<tr>'
            ."<td class=\"no-col\">{$rowNum}</td>"
            ."<td>{$chapter}</td>"
            ."<td>{$viq}</td>"
            ."<td>{$description}</td>"
            ."<td class=\"text-center\">{$risk}</td>"
            ."<td>{$jobOrder}</td>"
            ."<td>{$targetDate}</td>"
            .'</tr>';
    }

    /**
     * Render the ratings matrix (INS-10, REP-1c).
     */
    protected function renderRatingsMatrix(Report $report): string
    {
        $schema = $report->form->summary_schema ?? [];
        $ratingOptions = $schema['rating_options'] ?? [
            ['value' => 'very_good', 'label' => 'Very Good'],
            ['value' => 'satisfactory', 'label' => 'Satisfactory'],
            ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
        ];

        // Build the chapter list from report groups (skip Chapter 1)
        $topGroups = $report->groups()->whereNull('parent_id')->orderBy('sort_order')->get();
        $chapters = [];
        foreach ($topGroups as $group) {
            if ($this->isChapterOne($group)) {
                continue;
            }
            $chapters[] = [
                'no' => $group->chapter_no ?? $group->sort_order,
                'title' => $group->title,
                'rating' => $report->summary_ratings['chapter_'.$group->sort_order] ?? null,
            ];
        }

        $headerCells = implode('</th><th class="ans-col text-center">', array_map(fn ($opt) => $this->escape($opt['label']), $ratingOptions));

        $rows = '';
        foreach ($chapters as $ch) {
            $ratingCells = '';
            foreach ($ratingOptions as $opt) {
                $isChosen = ($ch['rating'] === $opt['value']);
                $ratingCells .= '<td class="ans-col text-center">'.($isChosen ? '●' : '').'</td>';
            }
            $rows .= "<tr><td class=\"no-col\">{$this->escape((string) $ch['no'])}</td><td>"
                .$this->escape($ch['title'])
                ."</td>{$ratingCells}</tr>";
        }

        // Calculated counts of No and NS answers per chapter (INS-10)
        $countsHtml = '<div class="counts-summary">';
        foreach ($chapters as $ch) {
            $group = $topGroups->firstWhere('chapter_no', (string) $ch['no']) ?? $topGroups->firstWhere('sort_order', (int) $ch['no']);
            if ($group) {
                $noCount = 0;
                $nsCount = 0;
                $allQuestions = $group->relationLoaded('questions')
                    ? $group->questions
                    : $group->questions()->with('answer')->get();
                foreach ($allQuestions as $q) {
                    $ans = strtolower(trim((string) ($q->answer?->answer ?? '')));
                    if ($ans === 'no') {
                        $noCount++;
                    } elseif ($ans === 'ns' || $ans === 'n/s') {
                        $nsCount++;
                    }
                }
                $countsHtml .= "<div class=\"chapter-counts\">Chapter {$this->escape((string) $ch['no'])}: {$noCount} No, {$nsCount} NS</div>";
            }
        }
        $countsHtml .= '</div>';

        $findings = $report->findings ?? collect();
        $highCount = $findings->where('risk', 'high')->count();
        $medCount = $findings->where('risk', 'medium')->count();
        $lowCount = $findings->where('risk', 'low')->count();

        return <<<HTML
<div class="ratings-section">
  <table class="ratings-table">
    <thead>
      <tr><th class="no-col">No.</th><th class="q-col">Item</th><th class="ans-col text-center">{$headerCells}</th></tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
  {$countsHtml}
  <div class="observation-counts">
    <div>High: {$highCount} observations</div>
    <div>Medium: {$medCount} observations</div>
    <div>Low: {$lowCount} observations</div>
  </div>
</div>
HTML;
    }

    /**
     * Render the dynamic executive text fields from summary_schema (INS-12).
     */
    protected function renderSummaryTextFields(Report $report): string
    {
        $schema = $report->form->summary_schema ?? [];
        $textFields = $schema['text_fields'] ?? [];

        if (empty($textFields)) {
            return '';
        }

        $html = '<div class="summary-text-fields">';
        foreach ($textFields as $field) {
            $key = $field['key'] ?? '';
            $label = $this->escape($field['label'] ?? $key);
            $value = '';

            // For D-062, the text fields map to specific report columns
            if ($report->form->code === 'D-062') {
                $value = $this->escape($report->{$key} ?? $report->summary_data[$key] ?? '');
            } else {
                $value = $this->escape($report->summary_data[$key] ?? '');
            }

            $html .= "<div class=\"summary-text-field\"><label>{$label}:</label><div class=\"summary-text-value\">{$value}</div></div>";
        }
        $html .= '</div>';

        return $html;
    }

    /**
     * Render a static text block (REP-1f).
     */
    protected function renderStaticText(?string $label, string $text): string
    {
        $labelHtml = $label ? "<h4 class=\"subsection-title\">{$this->escape($label)}</h4>" : '';

        return "{$labelHtml}<div class=\"static-text\">{$this->escape($text)}</div>";
    }

    protected function renderSubgroupHeader(string $title, string $naReason = ''): string
    {
        $naNote = $naReason ? "<span class=\"na-reason\">[NA: {$this->escape($naReason)}]</span>" : '';

        return "<tr><td colspan=\"100%\" class=\"subgroup-header\">{$this->escape($title)} {$naNote}</td></tr>";
    }

    /**
     * Build the footer text from the configured fields (REP-1a).
     */
    protected function buildFooterText(Report $report, array $fields): string
    {
        $parts = [];
        foreach ($fields as $field) {
            $parts[] = match ($field) {
                'form_code' => $this->escape($report->form->code ?? ''),
                'form_version' => $this->escape((string) ($report->form->form_version ?? '')),
                'template_version' => 'T'.((int) ($report->template_version ?? 1)),
                'report_number' => $this->escape($report->reference_number ?? ''),
                'generation_date' => now()->format('Y-m-d H:i').' UTC',
                default => '',
            };
        }

        return implode(' | ', array_filter($parts));
    }

    /**
     * Get the answer column keys for a form's answer_set.
     * D-062 uses yes|no|ns|na; B-008 uses yes|no|ns.
     */
    protected function answerColumnsForForm(string $answerSet): array
    {
        return match ($answerSet) {
            'd062_yes_no_ns_na' => ['yes' => 'Yes', 'no' => 'No', 'ns' => 'NS', 'na' => 'NA'],
            'b008_yes_no_ns' => ['yes' => 'Yes', 'no' => 'No', 'ns' => 'N/S'],
            default => ['yes' => 'Yes', 'no' => 'No', 'ns' => 'NS', 'na' => 'NA'],
        };
    }

    /**
     * Determine whether a group is "Chapter 1" (General Information) and should be
     * rendered by the general_info renderer, not the checklist chapters renderer.
     */
    protected function isChapterOne(ReportGroup $group): bool
    {
        return $group->chapter_no === '1'
            || $group->chapter_no === '1.0'
            || strtolower($group->title) === 'general information';
    }

    /**
     * Escape HTML special characters for safe output.
     */
    protected function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    /**
     * Format multi-line text safely with HTML escaping and preserved line breaks (R-18).
     */
    protected function formatMultiline(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return nl2br($this->escape($value));
    }

    /**
     * CSS styles for the PDF document. Keep them minimal — dompdf and mPDF support
     * a limited subset of CSS (SRS 13.1, REP-1).
     */
    protected function documentStyles(array $schema): string
    {
        return <<<'CSS'
body { font-family: "DejaVu Sans", "Helvetica Neue", Arial, sans-serif; font-size: 8.5pt; color: #111; margin: 0; padding: 0; }
tr { page-break-inside: avoid; }
.cover { text-align: center; padding: 100px 40px 0; }
.cover-title { font-size: 20pt; font-weight: bold; margin-bottom: 40px; }
.cover-table { margin: 20px auto; border-collapse: collapse; }
.cover-label { text-align: left; padding: 4px 12px 4px 0; font-weight: bold; }
.cover-value { text-align: left; padding: 4px 0; }
.section { padding: 16px 20px; }
.page-break-before { page-break-before: always; }
.page-break-after { page-break-after: always; }
.chapter { page-break-before: always; margin-bottom: 16pt; }
.chapter-title { font-size: 13pt; font-weight: bold; margin-bottom: 10pt; border-bottom: 1.5pt solid #000; padding-bottom: 4pt; }
.chapter-header { font-size: 11pt; font-weight: bold; margin-bottom: 8pt; border-bottom: 1pt solid #ccc; padding-bottom: 3pt; }
.subsection-title { font-size: 9.5pt; font-weight: bold; margin: 14pt 0 6pt; }
.checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 8pt; table-layout: fixed; }
.checklist-table th, .checklist-table td { border: 1pt solid #000; padding: 3pt 4pt; font-size: 8pt; vertical-align: top; }
.checklist-table th { background-color: #eee; font-weight: bold; }
.no-col { width: 5%; text-align: center; }
.q-col { width: 71%; }
.ans-col { width: 6%; text-align: center; }
.remarks-cell { width: 20%; }
.text-center { text-align: center; }
tr.subgroup-row { page-break-inside: avoid; page-break-after: avoid; }
.subgroup-header { font-weight: bold; background-color: #f1f5f9; padding: 4pt 6pt; border: 1pt solid #000; font-size: 8.5pt; }
.guidance { font-size: 7.5pt; color: #555; margin-top: 2pt; font-style: italic; }
.extra-value { font-size: 7.5pt; color: #111; margin-top: 2pt; font-family: monospace; }
.q-note { font-size: 7.5pt; color: #333; margin-top: 3pt; padding: 2pt 4pt; background-color: #f8f8f8; border-left: 2pt solid #666; }
.na-reason { font-size: 7.5pt; color: #c00; font-weight: normal; margin-left: 6pt; }
.chapter-comments { margin-top: 6pt; padding: 6pt 8pt; border: 1pt solid #ccc; background-color: #fafafa; font-size: 8pt; page-break-inside: avoid; }
.particulars-table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
.particulars-table td { border: 1pt solid #ccc; padding: 4pt 6pt; font-size: 8pt; }
.field-label { width: 40%; font-weight: bold; background-color: #fcfcfc; }
.field-value { width: 60%; }
.ops-table { width: 60%; border-collapse: collapse; margin-bottom: 12pt; }
.ops-table td { border: 1pt solid #ccc; padding: 3pt 6pt; font-size: 8pt; }
.ops-table td.text-center { width: 35px; text-align: center; }
.findings-table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
.findings-table th, .findings-table td { border: 1pt solid #000; padding: 3pt 4pt; font-size: 8pt; }
.findings-table th { background-color: #eee; font-weight: bold; }
.ratings-table { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
.ratings-table th, .ratings-table td { border: 1pt solid #000; padding: 3pt 4pt; font-size: 8pt; }
.ratings-table th { background-color: #eee; font-weight: bold; }
.counts-summary { margin-bottom: 8pt; font-size: 8pt; font-weight: bold; }
.chapter-counts { margin-bottom: 2pt; }
.observation-counts { margin-top: 6pt; padding: 6pt; background-color: #f0f0f0; border: 1pt solid #ccc; font-size: 8pt; font-weight: bold; }
.empty-row { text-align: center; color: #777; font-style: italic; padding: 8pt; }
.circulation-table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
.circulation-table th, .circulation-table td { border: 1pt solid #000; padding: 4pt 6pt; font-size: 8pt; }
.circulation-table th { background-color: #eee; font-weight: bold; }
.signature-lines { margin-top: 30px; }
.signature-line { margin-bottom: 20pt; }
.sig-label { display: inline-block; width: 130px; font-weight: bold; }
.na-banner { background-color: #ffeeee; border: 1pt dashed #cc0000; padding: 6pt; margin-bottom: 8pt; font-size: 8pt; }
.split-note { background-color: #eef2ff; border: 1pt dashed #4338ca; padding: 8pt; margin-bottom: 10pt; font-size: 8.5pt; }
.photo-item { page-break-inside: avoid; margin-bottom: 14pt; border: 1pt solid #e5e5e5; padding: 6pt; border-radius: 4pt; }
.photo-img { max-width: 100%; max-height: 480px; height: auto; display: block; margin: 0 auto; }
.photo-meta { padding: 6pt 2pt 2pt; font-size: 8pt; }
.photo-number { font-weight: bold; font-size: 9.5pt; margin-bottom: 3pt; color: #111; }
.photo-title { font-weight: bold; font-size: 9pt; }
.photo-caption { color: #333; margin-top: 2pt; }
.photo-description { color: #555; margin-top: 2pt; }
.photo-category, .photo-location { font-size: 7.5pt; color: #777; margin-top: 2pt; }
.photo-placeholder { border: 1pt dashed #ccc; padding: 40px; text-align: center; color: #999; }
.best-practices { padding: 6pt; border: 1pt solid #e5e5e5; background-color: #fafafa; font-size: 8.5pt; }
CSS;
    }

    // ------------------------------------------------------------------
    // Cache management & PDF Binary Generation (REP-6, MpdfWriter)
    // ------------------------------------------------------------------

    /**
     * Render the report directly to a PDF binary string using the configured PdfWriter (mPDF).
     */
    public function renderToPdf(Report $report, array $options = []): string
    {
        $schema = $this->resolveLayoutSchema($report);
        $footerFields = $schema['footer']['fields'] ?? [];
        $footerText = $this->buildFooterText($report, $footerFields);

        $html = $this->render($report);
        $isDraft = in_array($report->status, ['draft', 'in_progress', 'reopened'], true);

        $mergedOptions = array_merge([
            'watermark' => $isDraft ? ($schema['watermark']['draft_label'] ?? 'DRAFT') : null,
            'footer_text' => $footerText,
        ], $options);

        return $this->pdfWriter->write($html, $mergedOptions);
    }

    /**
     * Generate and cache the PDF file on disk. Returns the storage path (REP-6).
     */
    public function generatePdfFile(Report $report, bool $force = false): string
    {
        $targetPath = $this->pdfStoragePath($report);

        if (! $force && ! $this->isCacheStale($report) && Storage::disk('public')->exists($targetPath)) {
            return $report->pdf_path ?: $targetPath;
        }

        $pdfBinary = $this->renderToPdf($report);

        // Delete older cached PDFs for this report unless closed
        $this->cleanupPreviousPdfs($report);

        Storage::disk('public')->put($targetPath, $pdfBinary);
        $this->markPdfGenerated($report, $targetPath);

        return $targetPath;
    }

    /**
     * Clean up previous cached PDFs for this report to prevent disk bloat (REP-6).
     */
    protected function cleanupPreviousPdfs(Report $report): void
    {
        if ($report->status === ReportStatus::Closed->value) {
            return;
        }

        $dir = "reports/{$report->id}/pdf";
        if (Storage::disk('public')->exists($dir)) {
            $files = Storage::disk('public')->files($dir);
            foreach ($files as $file) {
                Storage::disk('public')->delete($file);
            }
        }
    }

    /**
     * Compute a cache fingerprint for this report's state (Section 5.5).
     */
    public function cacheFingerprint(Report $report): string
    {
        return hash('sha256', implode('|', [
            $report->id,
            $report->current_version,
            $report->status,
            $report->template_version,
            $report->form?->template_version ?? 1,
            $report->submitted_at?->timestamp ?? '',
            $report->closed_at?->timestamp ?? '',
            'mpdf_v1',
        ]));
    }

    /**
     * Determine whether the cached PDF is stale and needs regeneration.
     * REP-6: built once per report content version and cached; invalidated on edit or status change.
     */
    public function isCacheStale(Report $report): bool
    {
        if (empty($report->pdf_path) || empty($report->pdf_version)) {
            return true;
        }

        // Stale if content version differs
        if ((int) $report->pdf_version !== (int) $report->current_version) {
            return true;
        }

        // Stale if status transitioned between draft/reopened and submitted/reviewed/closed
        $path = (string) $report->pdf_path;
        if (str_contains($path, '-draft') || str_contains($path, '-final')) {
            $isDraftFile = str_contains($path, '-draft');
            $isCurrentlyDraft = in_array($report->status, ['draft', 'in_progress', 'reopened'], true);

            if ($isDraftFile !== $isCurrentlyDraft) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the storage path for a report's PDF, creating the directory if needed.
     */
    public function pdfStoragePath(Report $report): string
    {
        $dir = "reports/{$report->id}/pdf";
        $statusSlug = in_array($report->status, ['draft', 'in_progress', 'reopened'], true) ? 'draft' : 'final';
        $filename = "report-{$report->reference_number}-v{$report->current_version}-{$statusSlug}.pdf";

        Storage::disk('public')->makeDirectory($dir);

        return "{$dir}/{$filename}";
    }

    /**
     * Record the generated PDF path and version on the report (REP-6).
     */
    public function markPdfGenerated(Report $report, string $path): void
    {
        $report->forceFill([
            'pdf_path' => $path,
            'pdf_version' => $report->current_version,
        ])->saveQuietly();
    }
}
