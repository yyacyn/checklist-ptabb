<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportDocumentBuilder;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 7, Task 7.7: Audit execution log, general comments, signatures, and distribution (AUD-12 to AUD-15).
 *
 * Verifies:
 * - Snapshots initial positive_comments, negative_comments, and audit_execution_log on creation.
 * - Saves timetable log via PUT reports/{report}/datasets/audit_execution_log.
 * - Saves positive_comments and negative_comments via PUT reports/{report}/fields.
 * - Document builder extracts execution log, general comments, signatures, and distribution.
 * - PDF renderer generates sections with execution log table, comments boxes, signature lines, and company distribution.
 */
class AuditExecutionAndCommentsTest extends TestCase
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
            'vessel_name' => 'MV Oceanic Pioneer',
            'is_active' => true,
        ]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::firstOrCreate(['name' => 'Bulk Carrier'], ['is_active' => true]);

        $report = app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Oceanic Pioneer',
            'vessel_imo' => '9123456',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 25000,
            'vessel_built' => 2018,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'audit',
            'master_name' => 'Capt. John Silver',
            'chief_officer_name' => 'C/O Jim Hawkins',
            'chief_engineer_name' => 'C/E Billy Bones',
            'inspected_by' => 'Lead Auditor Alexander',
        ], $overrides));

        return [$user, $report, $form];
    }

    public function test_audit_creation_initializes_comments_and_execution_log(): void
    {
        [$user, $report] = $this->createAuditReport();

        $this->assertNotEmpty($report->summary_data);
        $this->assertArrayHasKey('positive_comments', $report->summary_data);
        $this->assertArrayHasKey('negative_comments', $report->summary_data);

        $executionLogDataset = $report->datasets()->where('dataset_key', 'audit_execution_log')->first();
        $this->assertNotNull($executionLogDataset);
        $this->assertIsArray($executionLogDataset->rows);
        $this->assertCount(1, $executionLogDataset->rows);
        $this->assertSame('Opening Meeting & SMS Review', $executionLogDataset->rows[0]['person_or_function']);
    }

    public function test_can_update_audit_execution_log_dataset(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'rows' => [
                [
                    'person_or_function' => 'Opening Meeting',
                    'date' => '2026-10-14',
                    'start_time' => '08:30',
                    'end_time' => '09:30',
                    'topics' => 'Meeting with Master, C/E, C/O to agree audit plan and safety rounds.',
                    'sort_order' => 1,
                ],
                [
                    'person_or_function' => 'Chief Officer - Bridge & Navigation',
                    'date' => '2026-10-14',
                    'start_time' => '09:45',
                    'end_time' => '12:00',
                    'topics' => 'SMS Ch. 2 Navigation procedures, passage planning, ECDIS management, charts.',
                    'sort_order' => 2,
                ],
                [
                    'person_or_function' => 'Chief Engineer - Engine Room & Environmental',
                    'date' => '2026-10-14',
                    'start_time' => '13:00',
                    'end_time' => '15:30',
                    'topics' => 'Engine log book, MARPOL Annex I/VI, oily water separator, PMS records.',
                    'sort_order' => 3,
                ],
                [
                    'person_or_function' => 'Closing Meeting',
                    'date' => '2026-10-14',
                    'start_time' => '16:00',
                    'end_time' => '17:00',
                    'topics' => 'Presentation of observations, deficiencies, positive feedback and corrective actions.',
                    'sort_order' => 4,
                ],
            ],
            'base_row_version' => 1,
        ];

        $response = $this->actingAs($user)
            ->putJson("/reports/{$report->id}/datasets/audit_execution_log", $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.row_version', 2);

        $savedDataset = $report->datasets()->where('dataset_key', 'audit_execution_log')->first();
        $this->assertCount(4, $savedDataset->rows);
        $this->assertSame('Opening Meeting', $savedDataset->rows[0]['person_or_function']);
        $this->assertSame('Closing Meeting', $savedDataset->rows[3]['person_or_function']);
    }

    public function test_can_save_general_comments_via_fields_endpoint(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'fields' => [
                'positive_comments' => "Excellent housekeeping on bridge and in engine room.\nCrew exhibited thorough familiarisation with emergency steering drills.",
                'negative_comments' => "Hot work permit checklist had missing signatures for fire-watch.\nCalibration certificate for portable gas detector expired two weeks prior.",
            ],
        ];

        $response = $this->actingAs($user)
            ->putJson("/reports/{$report->id}/fields", $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved');

        $report->refresh();
        $this->assertStringContainsString('Excellent housekeeping', $report->summary_data['positive_comments']);
        $this->assertStringContainsString('Hot work permit checklist', $report->summary_data['negative_comments']);
    }

    public function test_pdf_builder_and_renderer_contain_execution_log_general_comments_signatures_and_circulation(): void
    {
        [$user, $report] = $this->createAuditReport();

        // 1. Populate audit_people with team members
        $peopleDataset = $report->datasets()->where('dataset_key', 'audit_people')->first();
        $peopleDataset->update([
            'rows' => [
                [
                    'name' => 'Alexander Lead',
                    'rank' => 'Senior Lead Auditor',
                    'role' => 'Lead auditor',
                    'sort_order' => 1,
                ],
                [
                    'name' => 'David Assistant',
                    'rank' => 'Marine Superintendent',
                    'role' => 'Auditor',
                    'sort_order' => 2,
                ],
                [
                    'name' => 'Capt. John Silver',
                    'rank' => 'Master',
                    'role' => 'Auditee',
                    'sort_order' => 3,
                ],
            ],
        ]);

        // 2. Populate audit_execution_log
        $executionLogDataset = $report->datasets()->where('dataset_key', 'audit_execution_log')->first();
        $executionLogDataset->update([
            'rows' => [
                [
                    'person_or_function' => 'Opening Conference',
                    'date' => '2026-10-14',
                    'start_time' => '08:30',
                    'end_time' => '09:00',
                    'topics' => 'Formal opening and scope verification',
                    'sort_order' => 1,
                ],
                [
                    'person_or_function' => 'Deck Department & Bridge',
                    'date' => '2026-10-14',
                    'start_time' => '09:00',
                    'end_time' => '12:00',
                    'topics' => 'Charts, passage plans, navigational logs',
                    'sort_order' => 2,
                ],
            ],
        ]);

        // 3. Populate general comments
        $summary = $report->summary_data ?? [];
        $summary['positive_comments'] = 'Commendable crew morale and pristine bridge conditions.';
        $summary['negative_comments'] = 'Minor lapses in paint locker PPE enforcement.';
        $report->update(['summary_data' => $summary]);

        // 4. Test DocumentBuilder output
        $builder = app(ReportDocumentBuilder::class);
        $doc = $builder->build($report);

        $this->assertArrayHasKey('execution_log', $doc);
        $this->assertCount(2, $doc['execution_log']);
        $this->assertSame('Opening Conference', $doc['execution_log'][0]['person_or_function']);

        $this->assertArrayHasKey('positive_comments', $doc);
        $this->assertStringContainsString('Commendable crew morale', $doc['positive_comments']);
        $this->assertArrayHasKey('negative_comments', $doc);
        $this->assertStringContainsString('paint locker PPE', $doc['negative_comments']);

        // 5. Test PDF HTML rendering
        $renderer = app(ReportPdfRenderer::class);
        $html = $renderer->render($report);

        // Audit execution timetable
        $this->assertStringContainsString('AUDIT EXECUTION', $html);
        $this->assertStringContainsString('Opening Conference', $html);
        $this->assertStringContainsString('Deck Department &amp; Bridge', $html);
        $this->assertStringContainsString('08:30', $html);
        $this->assertStringContainsString('Charts, passage plans', $html);

        // General comments
        $this->assertStringContainsString('AUDITOR(S) GENERAL COMMENTS', $html);
        $this->assertStringContainsString('Commendable crew morale and pristine bridge conditions.', $html);
        $this->assertStringContainsString('Minor lapses in paint locker PPE enforcement.', $html);

        // Signatures (AUD-14)
        $this->assertStringContainsString('Signatures', $html);
        $this->assertStringContainsString('Lead Auditor:', $html);
        $this->assertStringContainsString('Alexander Lead', $html);
        $this->assertStringContainsString('Senior Lead Auditor', $html);
        $this->assertStringContainsString('Auditor:', $html);
        $this->assertStringContainsString('David Assistant', $html);
        $this->assertStringContainsString('Master / Chief Officer:', $html);
        $this->assertStringContainsString('Capt. John Silver', $html);

        // Distribution list (AUD-15)
        $this->assertStringContainsString('DISTRIBUTION LIST', $html);
        $this->assertStringContainsString('Managing Director', $html);
        $this->assertStringContainsString('Technical Department', $html);
        $this->assertStringContainsString('DPA', $html);
        $this->assertStringContainsString('Crew Department', $html);
        $this->assertStringContainsString('Marine, Ops, Assurance Department', $html);
        $this->assertStringContainsString('Master / Chief Engineer', $html);
    }
}
