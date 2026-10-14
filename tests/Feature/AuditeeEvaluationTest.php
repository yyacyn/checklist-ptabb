<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\ReportDataset;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportDocumentBuilder;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 7, Task 7.6: Auditee evaluation (AUD-11, SRS §2, SRS §14.4).
 *
 * Verifies:
 * - Snapshots criteria into summary_data.evaluation_criteria upon creation.
 * - Initial auditee evaluation dataset created with at least 4 auditees.
 * - Saves scores (1-5), overall status, and comments via PUT reports/{report}/datasets/audit_evaluation.
 * - Restricted access: evaluation scores excluded from reports list (index) and findings register.
 * - ReportController@show loads datasets for the audit's own page.
 * - PDF generation includes auditee evaluation section with criteria definitions and auditee ratings.
 */
class AuditeeEvaluationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    private function createAuditReport(array $overrides = []): array
    {
        $user = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Amarin Glory',
            'is_active' => true,
        ]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::firstOrCreate(['name' => 'Cement Carrier'], ['is_active' => true]);

        $report = app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Amarin Glory',
            'vessel_imo' => '9876543',
            'vessel_flag' => 'Indonesia',
            'vessel_gt' => 8000,
            'vessel_built' => 2020,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'audit',
            'master_name' => 'Capt. Haddock',
            'chief_engineer_name' => 'Eng. Calculus',
            'inspected_by' => 'Lead Auditor Tintin',
        ], $overrides));

        return [$user, $report, $form];
    }

    public function test_audit_creation_snapshots_evaluation_criteria_and_initial_rows(): void
    {
        [$user, $report] = $this->createAuditReport();

        $this->assertNotEmpty($report->summary_data);
        $this->assertArrayHasKey('evaluation_criteria', $report->summary_data);
        $criteria = $report->summary_data['evaluation_criteria'];
        $this->assertCount(7, $criteria);
        $this->assertSame('sms_knowledge', $criteria[0]['criterion_key']);

        // Check initial dataset in DB
        $dataset = $report->datasets()->where('dataset_key', 'audit_evaluation')->first();
        $this->assertNotNull($dataset);
        $this->assertIsArray($dataset->rows);
        $this->assertGreaterThanOrEqual(4, count($dataset->rows));

        // Check master and chief engineer are mapped from crew
        $this->assertSame('Capt. Haddock', $dataset->rows[0]['name']);
        $this->assertSame('Master', $dataset->rows[0]['rank']);
        $this->assertSame('Eng. Calculus', $dataset->rows[1]['name']);
        $this->assertSame('Chief Engineer', $dataset->rows[1]['rank']);
    }

    public function test_can_save_auditee_evaluation_scores_and_status(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'rows' => [
                [
                    'name' => 'Capt. Haddock',
                    'rank' => 'Master',
                    'scores' => [
                        'sms_knowledge' => 5,
                        'safety_emergency_equipment' => 4,
                        'international_regulations' => 5,
                    ],
                    'overall_status' => 'Satisfactory',
                    'comments' => 'Demonstrated excellent leadership during drill.',
                    'sort_order' => 1,
                ],
                [
                    'name' => 'Eng. Calculus',
                    'rank' => 'Chief Engineer',
                    'scores' => [
                        'sms_knowledge' => 4,
                        'safety_emergency_equipment' => 4,
                        'bunkering_procedures' => 5,
                    ],
                    'overall_status' => 'Satisfactory',
                    'comments' => 'Well maintained engine room logs.',
                    'sort_order' => 2,
                ],
                [
                    'name' => 'John Doe',
                    'rank' => 'Chief Officer',
                    'scores' => [
                        'sms_knowledge' => 3,
                    ],
                    'overall_status' => 'Satisfactory',
                    'sort_order' => 3,
                ],
                [
                    'name' => 'Jane Smith',
                    'rank' => 'Second Engineer',
                    'scores' => [
                        'sms_knowledge' => 4,
                    ],
                    'overall_status' => 'Satisfactory',
                    'sort_order' => 4,
                ],
            ],
            'client_save_id' => 'save-eval-001',
        ];

        $response = $this->actingAs($user)
            ->putJson("/reports/{$report->id}/datasets/audit_evaluation", $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.dataset_key', 'audit_evaluation');

        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_evaluation',
        ]);

        $dataset = ReportDataset::where('report_id', $report->id)
            ->where('dataset_key', 'audit_evaluation')
            ->first();

        $this->assertSame('Demonstrated excellent leadership during drill.', $dataset->rows[0]['comments']);
        $this->assertSame(5, $dataset->rows[0]['scores']['sms_knowledge']);
    }

    public function test_evaluation_scores_are_excluded_from_reports_index_and_findings_index(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Save scores
        $dataset = $report->datasets()->where('dataset_key', 'audit_evaluation')->first();
        $dataset->update([
            'rows' => [
                [
                    'name' => 'Capt. Haddock',
                    'rank' => 'Master',
                    'scores' => ['sms_knowledge' => 5],
                    'overall_status' => 'Satisfactory',
                ],
            ],
        ]);

        // 1. Check reports index response
        $indexResponse = $this->actingAs($user)->get('/reports');
        $indexResponse->assertOk();
        $indexResponse->assertDontSee('sms_knowledge');
        $indexResponse->assertDontSee('Capt. Haddock');

        // 2. Check findings index response
        $findingsResponse = $this->actingAs($user)->get('/findings');
        $findingsResponse->assertOk();
        $findingsResponse->assertDontSee('sms_knowledge');
    }

    public function test_report_show_loads_evaluation_dataset_for_audit_page(): void
    {
        [$user, $report] = $this->createAuditReport();

        $response = $this->actingAs($user)->get("/reports/{$report->id}");
        $response->assertOk();

        $pageProps = $response->original->getData()['page']['props'];
        $this->assertArrayHasKey('report', $pageProps);
        $this->assertArrayHasKey('datasets', $pageProps['report']);

        $evaluationDataset = collect($pageProps['report']['datasets'])->firstWhere('dataset_key', 'audit_evaluation');
        $this->assertNotNull($evaluationDataset);
    }

    public function test_pdf_builder_includes_auditee_evaluation_and_renders_html(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Update dataset with specific known scores
        $dataset = $report->datasets()->where('dataset_key', 'audit_evaluation')->first();
        $dataset->update([
            'rows' => [
                [
                    'name' => 'Capt. Haddock',
                    'rank' => 'Master',
                    'scores' => ['sms_knowledge' => 5],
                    'overall_status' => 'Satisfactory',
                    'comments' => 'Top performing captain',
                    'sort_order' => 1,
                ],
                [
                    'name' => 'Eng. Calculus',
                    'rank' => 'Chief Engineer',
                    'scores' => ['sms_knowledge' => 4],
                    'overall_status' => 'Satisfactory',
                    'comments' => 'Solid technical knowledge',
                    'sort_order' => 2,
                ],
                [
                    'name' => 'John Doe',
                    'rank' => 'Chief Officer',
                    'scores' => ['sms_knowledge' => 3],
                    'overall_status' => 'Satisfactory',
                    'sort_order' => 3,
                ],
                [
                    'name' => 'Jane Smith',
                    'rank' => 'Second Engineer',
                    'scores' => ['sms_knowledge' => 4],
                    'overall_status' => 'Satisfactory',
                    'sort_order' => 4,
                ],
            ],
        ]);

        $builder = app(ReportDocumentBuilder::class);
        $doc = $builder->build($report);

        $this->assertArrayHasKey('evaluation', $doc);
        $this->assertNotEmpty($doc['evaluation']);
        $this->assertSame('Capt. Haddock', $doc['evaluation']['rows'][0]['name']);
        $this->assertSame(5, $doc['evaluation']['rows'][0]['scores']['sms_knowledge']);

        // Test PDF HTML renderer includes evaluation
        $renderer = app(ReportPdfRenderer::class);
        $html = $renderer->render($report);

        $this->assertStringContainsString('AUDITEE EVALUATION', $html);
        $this->assertStringContainsString('Capt. Haddock', $html);
        $this->assertStringContainsString('Top performing captain', $html);
        $this->assertStringContainsString('SMS CONFORMANCE SCORING DEFINITIONS', $html);
    }
}
