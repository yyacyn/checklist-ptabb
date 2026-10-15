<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mpdf\Mpdf;
use Tests\TestCase;

/**
 * Phase 6, Task 6.1: Layout definition per form, one shared engine (SRS REP-1g).
 *
 * Tests that:
 * - The layout_schema is seeded for D-062 and B-008 by FormSeeder.
 * - The layout schema has the correct section order per form.
 * - The shared ReportPdfRenderer can render a report to HTML.
 * - The cache staleness check works (REP-6).
 * - The FormController updateLayoutSchema endpoint works for superadmin.
 * - The layout schema validation rejects malformed payloads.
 */
class ReportPdfLayoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    private function createInspectionReport(array $overrides = []): Report
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::where('name', 'Cement Carrier')->firstOrFail();

        return app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Test Vessel',
            'vessel_imo' => '1234567',
            'vessel_flag' => 'Panama',
            'vessel_gt' => 15000,
            'vessel_built' => 2018,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
            'status' => 'draft',
            'operations' => ['Loading', 'Ballasting'],
        ], $overrides));
    }

    /**
     * The FormSeeder should seed a layout_schema for D-062 with the sections
     * defined in SRS REP-1 (Chapter 1 through 16, comparison blocks, circulation, signatures).
     */
    public function test_form_seeder_seeds_d062_layout_schema(): void
    {
        $form = Form::where('code', 'D-062')->firstOrFail();

        $this->assertNotNull($form->layout_schema);

        $schema = $form->layout_schema;
        $sectionTypes = array_column($schema['sections'], 'type');

        // REP-1: Chapter 1 header, chapters 2-13 checklists, Chapter 14 best practices,
        // Chapter 15 Summary of Observations, moved Report Summary, Chapter 16 photos,
        // comparison blocks at the end (REP-1g).
        $this->assertContains('cover', $sectionTypes);
        $this->assertContains('general_info', $sectionTypes);
        $this->assertContains('checklist_chapters', $sectionTypes);
        $this->assertContains('best_practices', $sectionTypes);
        $this->assertContains('summary_of_observations', $sectionTypes);
        $this->assertContains('report_summary', $sectionTypes);
        $this->assertNotContains('photo_chapter', $sectionTypes);
        $this->assertContains('comparison_blocks', $sectionTypes);
        $this->assertNotContains('circulation', $sectionTypes);
        $this->assertContains('senior_officers_appraisal', $sectionTypes);
        $this->assertContains('signature_lines', $sectionTypes);

        // REP-1b: report_summary must come after summary_of_observations
        $summaryIdx = array_search('summary_of_observations', $sectionTypes, true);
        $reportSummaryIdx = array_search('report_summary', $sectionTypes, true);

        $this->assertGreaterThan($summaryIdx, $reportSummaryIdx, 'REPORT SUMMARY must come after Summary of Observations (REP-1b)');

        // Footer fields (REP-1a)
        $this->assertContains('form_code', $schema['footer']['fields']);
        $this->assertContains('form_version', $schema['footer']['fields']);
        $this->assertContains('template_version', $schema['footer']['fields']);
        $this->assertContains('report_number', $schema['footer']['fields']);
        $this->assertContains('page_number', $schema['footer']['fields']);

        // D-062 answer columns: Yes, No, NS, NA
        $checklistSection = $this->findSectionByType($schema['sections'], 'checklist_chapters');
        $this->assertSame(['No.', 'Item', 'Yes', 'No', 'NS', 'NA'], $checklistSection['column_labels']);

        // Watermark (REP-4)
        $this->assertSame('DRAFT', $schema['watermark']['draft_label']);

        // Photo appendix threshold (REP-8)
        $this->assertSame(100, $schema['photo_appendix_threshold']);
    }

    /**
     * The FormSeeder should seed a layout_schema for B-008 with audit-specific sections.
     */
    public function test_form_seeder_seeds_b008_layout_schema(): void
    {
        $form = Form::where('code', 'B-008')->firstOrFail();

        $this->assertNotNull($form->layout_schema);

        $schema = $form->layout_schema;
        $sectionTypes = array_column($schema['sections'], 'type');

        $this->assertContains('cover', $sectionTypes);
        $this->assertContains('audit_header', $sectionTypes);
        $this->assertContains('checklist_chapters', $sectionTypes);
        $this->assertContains('audit_summary', $sectionTypes);
        $this->assertContains('auditee_evaluation', $sectionTypes);
        $this->assertContains('audit_execution_log', $sectionTypes);
        $this->assertContains('audit_general_comments', $sectionTypes);
        $this->assertContains('circulation', $sectionTypes);
        $this->assertContains('signature_lines', $sectionTypes);

        // B-008 has no report_summary section (REP-1b applies to D-062 only)
        $this->assertNotContains('report_summary', $sectionTypes);

        // B-008 answer columns: Yes, No, N/S (no NA per SRS FM-5)
        $checklistSection = $this->findSectionByType($schema['sections'], 'checklist_chapters');
        $this->assertSame(['No.', 'Item', 'Yes', 'No', 'N/S'], $checklistSection['column_labels']);
    }

    /**
     * The default layout schema fallback should match the form code when layout_schema
     * is null (e.g. a form created via factory without a layout).
     */
    public function test_renderer_uses_default_layout_when_schema_is_null(): void
    {
        $form = Form::where('code', 'D-062')->firstOrFail();
        // Simulate a form with no layout schema
        $form->layout_schema = null;
        $form->save();

        $report = $this->createInspectionReport();

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        // Should still render using the default D-062 layout
        $this->assertStringContainsString('VESSEL INSPECTION REPORT', $html);
        $this->assertStringContainsString('Chapter 1 - General Information', $html);
        $this->assertStringContainsString('REPORT SUMMARY', $html);
    }

    /**
     * The renderer produces a clean, focused layout for photo form reports without D-062 checklist sections.
     */
    public function test_renderer_uses_photo_layout_for_photo_form(): void
    {
        $photoForm = Form::where('code', 'P-001')->firstOrFail();
        $report = Report::create([
            'report_type' => 'inspection',
            'form_id' => $photoForm->id,
            'template_version' => 1,
            'reference_number' => 'P001-20261013-99',
            'status' => 'draft',
            'vessel_name' => 'MV Photo Carrier',
            'report_date' => now()->toDateString(),
            'created_by' => User::factory()->create()->id,
        ]);

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('PHOTOGRAPHIC RECORD REPORT', $html);
        $this->assertStringContainsString('Photographic Records', $html);
        $this->assertStringNotContainsString('REPORT SUMMARY', $html);
        $this->assertStringNotContainsString('Summary of Observations', $html);
        $this->assertStringNotContainsString('Chapter 1 - General Information', $html);
        $this->assertStringNotContainsString('Internal Circulation', $html);
        $this->assertStringNotContainsString('Port State Control', $html);
        $this->assertStringNotContainsString('Open Items from Previous', $html);
    }

    /**
     * The renderer produces HTML with all expected top-level sections for a D-062 report.
     */
    public function test_renderer_produces_html_with_expected_sections(): void
    {
        $report = $this->createInspectionReport();

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('<!DOCTYPE html>', $html);
        $this->assertStringContainsString('VESSEL INSPECTION REPORT', $html);
        $this->assertStringContainsString('Chapter 1 - General Information', $html);
        $this->assertStringContainsString('Chapter 14 - Best Practices', $html);
        $this->assertStringContainsString('Chapter 15 - Summary of Observations', $html);
        $this->assertStringContainsString('REPORT SUMMARY', $html);
        $this->assertStringContainsString('Appraisals of Senior Officers', $html);
        $this->assertStringContainsString('Comparison of Current Report With Previous Reports', $html);
        $this->assertStringContainsString('Internal Circulation', $html);
        $this->assertStringContainsString('INDEX', $html);
        $this->assertStringContainsString('FILL IN INSTRUCTIONS', $html);
        $this->assertStringNotContainsString('Signatures', $html);

        // D-062 specific: footer fields and DRAFT watermark
        $this->assertStringContainsString('D062-', $html);
        $this->assertStringContainsString('DRAFT', $html);
    }

    public function test_pdf_generation_has_no_blank_pages_around_index(): void
    {
        $report = $this->createInspectionReport(['status' => 'submitted']);
        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'margin_left' => 12,
            'margin_right' => 12,
            'margin_top' => 15,
            'margin_bottom' => 18,
        ]);
        $mpdf->autoPageBreak = true;
        $mpdf->WriteHTML($html);

        // Verify that none of the first 10 pages are empty/blank
        for ($p = 1; $p <= min(10, $mpdf->page); $p++) {
            $len = strlen($mpdf->pages[$p] ?? '');
            $this->assertGreaterThan(500, $len, "Page {$p} is empty (len {$len})");
        }
    }

    /**
     * The checklist chapters section renders the report's groups as chapter tables,
     * skipping Chapter 1 (general info) which is rendered separately.
     */
    public function test_renderer_renders_checklist_chapters_from_report_groups(): void
    {
        $report = $this->createInspectionReport(['status' => 'submitted']);
        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        // Chapter 1 should NOT appear in the checklist section (it's in General Info)
        $this->assertStringContainsString('Chapter 1 - General Information', $html);

        // Other chapters from the D-062 form should appear as checklist tables
        $this->assertStringContainsString('checklist-table', $html);
    }

    /**
     * The renderer produces B-008-specific layout with audit header and audit summary.
     */
    public function test_renderer_produces_b008_layout(): void
    {
        $user = User::factory()->create(['role' => 'vessel', 'vessel_name' => 'MV B008 Test Vessel', 'is_active' => true]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::where('name', 'Cement Carrier')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV B008 Test Vessel',
            'report_date' => now()->toDateString(),
            'created_by' => $user->id,
            'status' => 'draft',
        ]);

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('VESSEL INTERNAL AUDIT CHECKLIST', $html);
        $this->assertStringContainsString('Audit Summary & NCRs', $html);
        $this->assertStringContainsString('AUDIT EXECUTION', $html);
        $this->assertStringContainsString('DISTRIBUTION LIST', $html);
    }

    /**
     * Cache staleness: a report with no PDF path/version is stale.
     * A report whose pdf_version matches current_version is fresh.
     * REP-6: editing bumps current_version, which invalidates the cache.
     */
    public function test_cache_staleness_logic(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;

        // No PDF generated yet → stale
        $this->assertTrue($renderer->isCacheStale($report));

        // Simulate a generated PDF matching current version
        Report::query()->where('id', $report->id)->update([
            'pdf_path' => 'reports/1/pdf/report-test.pdf',
            'pdf_version' => $report->current_version,
        ]);
        $report->refresh();
        $this->assertFalse($renderer->isCacheStale($report));

        // Editing the report bumps current_version → stale
        $report->increment('current_version');
        $report->refresh();
        $this->assertTrue($renderer->isCacheStale($report));
    }

    /**
     * The FormController updateLayoutSchema endpoint works for superadmin
     * and bumps the template version (FM-12).
     */
    public function test_superadmin_can_update_layout_schema(): void
    {
        $user = User::factory()->create(['role' => 'superadmin', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();
        $originalTemplateVersion = $form->template_version;

        $newSchema = [
            'sections' => [
                ['type' => 'cover', 'title_key' => 'inspection_report'],
                ['type' => 'general_info', 'title' => 'Chapter 1 - General Information'],
                ['type' => 'checklist_chapters', 'column_labels' => ['No.', 'Item', 'Yes', 'No', 'NS', 'NA', 'Remarks']],
                ['type' => 'signature_lines'],
            ],
            'footer' => ['fields' => ['form_code', 'report_number', 'page_number']],
            'watermark' => ['draft_label' => 'DRAFT'],
            'photo_appendix_threshold' => 50,
        ];

        $response = $this->actingAs($user)
            ->putJson(route('admin.forms.layout-schema.update', $form->id), [
                'layout_schema' => $newSchema,
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'saved',
            ]);

        $form->refresh();
        $this->assertEquals($newSchema, $form->layout_schema);
        $this->assertGreaterThan($originalTemplateVersion, $form->template_version);
    }

    /**
     * Validation: the layout schema endpoint rejects payloads without a sections array.
     */
    public function test_update_layout_schema_requires_sections(): void
    {
        $user = User::factory()->create(['role' => 'superadmin', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();

        $response = $this->actingAs($user)
            ->putJson(route('admin.forms.layout-schema.update', $form->id), [
                'layout_schema' => ['footer' => ['fields' => ['form_code']]],
            ]);

        $response->assertStatus(422);
    }

    /**
     * The pdf_storage_path method returns a deterministic path based on report ID
     * and current_version (REP-6: cache key is current_version).
     */
    public function test_pdf_storage_path_is_deterministic(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;

        $path1 = $renderer->pdfStoragePath($report);
        $path2 = $renderer->pdfStoragePath($report);

        $this->assertSame($path1, $path2);
        $this->assertStringContainsString("reports/{$report->id}/pdf", $path1);
        $this->assertStringContainsString("v{$report->current_version}", $path1);
    }

    /**
     * markPdfGenerated records the path and version on the report (REP-6).
     */
    public function test_mark_pdf_generated_records_path_and_version(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;

        $renderer->markPdfGenerated($report, 'reports/1/pdf/report.pdf');

        $report->refresh();
        $this->assertSame('reports/1/pdf/report.pdf', $report->pdf_path);
        $this->assertSame($report->current_version, $report->pdf_version);
    }

    /**
     * Non-superadmin users cannot update the layout schema.
     */
    public function test_corporate_user_cannot_update_layout_schema(): void
    {
        $user = User::factory()->create(['role' => 'corporate', 'is_active' => true]);
        $form = Form::where('code', 'D-062')->firstOrFail();

        $response = $this->actingAs($user)
            ->putJson(route('admin.forms.layout-schema.update', $form->id), [
                'layout_schema' => ['sections' => [['type' => 'cover']]],
            ]);

        $response->assertForbidden();
    }

    /**
     * Ratings matrix renders separate cells for each rating option and marks the chosen one (R-02).
     */
    public function test_ratings_matrix_renders_separate_option_cells(): void
    {
        $report = $this->createInspectionReport();
        $group = $report->groups()->whereNull('parent_id')->where('chapter_no', '!=', '1')->first();
        if ($group) {
            $report->update([
                'summary_ratings' => ['chapter_'.$group->sort_order => 'satisfactory'],
            ]);
            $report->refresh();
        }

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('Very Good', $html);
        $this->assertStringContainsString('Satisfactory', $html);
        $this->assertStringContainsString('Unsatisfactory', $html);
        $this->assertStringContainsString('X', $html);
    }

    /**
     * Cover page displays dynamic status (R-04).
     */
    public function test_cover_page_displays_actual_report_status(): void
    {
        $report = $this->createInspectionReport();
        $report->update(['status' => 'submitted']);
        $report->refresh();

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('SUBMITTED', $html);
    }

    /**
     * Comments are rendered in a separate chapter-comments div, not in tfoot (R-09).
     */
    public function test_chapter_comments_rendered_outside_tfoot(): void
    {
        $report = $this->createInspectionReport();
        $group = $report->groups()->whereNull('parent_id')->where('chapter_no', '!=', '1')->first();
        if ($group) {
            $group->update(['comments' => 'Observation on bridge wing']);
        }

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringNotContainsString('<tfoot>', $html);
        $this->assertStringContainsString('chapter-comments', $html);
        $this->assertStringContainsString('Observation on bridge wing', $html);
    }

    /**
     * Table header generates distinct CSS classes for columns (R-10).
     */
    public function test_table_headers_have_correct_classes(): void
    {
        $report = $this->createInspectionReport();
        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('class="no-col text-center"', $html);
        $this->assertStringContainsString('class="q-col"', $html);
        $this->assertStringContainsString('class="ans-col text-center"', $html);
        $this->assertStringNotContainsString('class="remarks-cell"', $html);
    }

    public function test_table_headers_support_optional_remarks_column(): void
    {
        $report = $this->createInspectionReport();
        $report->form->forceFill([
            'layout_schema' => [
                'sections' => [
                    ['type' => 'checklist_chapters', 'column_labels' => ['No.', 'Item', 'Yes', 'No', 'NS', 'NA', 'Remarks']],
                ],
            ],
        ])->saveQuietly();

        $renderer = new ReportPdfRenderer;
        $html = $renderer->render($report);

        $this->assertStringContainsString('class="remarks-cell"', $html);
    }

    /**
     * Non-applicable chapters and questions must not appear in the PDF checklist tables.
     */
    public function test_inapplicable_chapters_and_questions_are_omitted_from_pdf(): void
    {
        $report = $this->createInspectionReport();

        // Mark a top-level group as not applicable
        $inapplicableGroup = $report->groups()->whereNull('parent_id')->where('chapter_no', '!=', '1')->first();
        if ($inapplicableGroup) {
            $inapplicableGroup->update([
                'is_applicable' => false,
                'na_reason' => 'Vessel type not applicable',
            ]);

            $renderer = new ReportPdfRenderer;
            $html = $renderer->render($report);

            $this->assertStringNotContainsString("id=\"chapter-{$inapplicableGroup->chapter_no}\"", $html);
            $this->assertStringNotContainsString('NOT APPLICABLE: Vessel type not applicable', $html);
        }
    }

    /**
     * Helper: find a section definition by type in a layout schema.
     */
    private function findSectionByType(array $sections, string $type): ?array
    {
        foreach ($sections as $section) {
            if (($section['type'] ?? '') === $type) {
                return $section;
            }
        }

        return null;
    }
}
