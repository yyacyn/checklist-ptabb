<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\ReportDataset;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Phase 7, Task 7.2: Reworked Audit Set-up (SRS AUD-2, AUD-3, SRS v0.7 14.4).
 *
 * Verifies:
 * - Default audit scalar fields and activities are seeded in summary_data on snapshot.
 * - Default audit_people dataset is initialized on snapshot.
 * - Auditor can update audit type, dates, lead auditor, operations, activities via /fields.
 * - Auditor can update audit team and auditees via /datasets/audit_people.
 * - Other audit type (D) and vessel header particulars are persisted.
 * - Authorization enforcement on update.
 * - PDF renderer includes audit particulars, team, auditees, and AUD-2 operations.
 * - Obsolete dedicated audit tables (audit_details, auditors, auditees, audit_activities) are dropped.
 */
class AuditSetupTest extends TestCase
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
            'vessel_name' => 'MV Audit Vessel',
            'is_active' => true,
        ]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::firstOrCreate(['name' => 'Cement Carrier'], ['is_active' => true]);

        $report = app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Audit Vessel',
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
            'operations' => ['Loading', 'At anchor'],
        ], $overrides));

        return [$user, $report];
    }

    public function test_old_audit_tables_do_not_exist(): void
    {
        $this->assertFalse(Schema::hasTable('audit_details'));
        $this->assertFalse(Schema::hasTable('auditors'));
        $this->assertFalse(Schema::hasTable('auditees'));
        $this->assertFalse(Schema::hasTable('audit_activities'));
    }

    public function test_audit_report_snapshot_initializes_default_audit_details_and_activities(): void
    {
        [$user, $report] = $this->createAuditReport();

        $report->refresh();

        // 1. Scalar summary_data checks
        $this->assertIsArray($report->summary_data);
        $this->assertEquals('A', $report->summary_data['audit_type'] ?? null);
        $this->assertEquals('2026-10-14', $report->summary_data['audit_end_date'] ?? null);
        $this->assertEquals(['Bridge', 'Deck', 'Engine'], $report->summary_data['activities_audited'] ?? null);

        // 2. audit_people dataset initialized
        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_people',
        ]);

        $dataset = ReportDataset::where('report_id', $report->id)
            ->where('dataset_key', 'audit_people')
            ->firstOrFail();

        $this->assertNotEmpty($dataset->rows);
        $this->assertContains('Lead auditor', array_column($dataset->rows, 'role'));
    }

    public function test_auditor_can_update_audit_setup(): void
    {
        [$user, $report] = $this->createAuditReport();

        // 1. Update scalar fields & header particulars via PUT /fields
        $fieldsPayload = [
            'fields' => [
                'report_date' => '2026-10-15',
                'audit_end_date' => '2026-10-17',
                'audit_type' => 'B',
                'lead_auditor' => 'Capt. John Auditor',
                'port' => 'Bojonegara Port',
                'master_name' => 'Capt. Haddock',
                'chief_engineer_name' => 'Eng. Calculus',
                'operations' => ['Loading', 'Bunkering', 'Repairs afloat'],
                'activities_audited' => ['Bridge', 'Deck', 'Engine', 'Cargo Operations'],
            ],
        ];

        $fieldsResponse = $this->actingAs($user)
            ->putJson(route('reports.fields.update', $report->id), $fieldsPayload);

        $fieldsResponse->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('report.port', 'Bojonegara Port')
            ->assertJsonPath('report.master_name', 'Capt. Haddock')
            ->assertJsonPath('summary_data.audit_type', 'B')
            ->assertJsonPath('summary_data.lead_auditor', 'Capt. John Auditor');

        // Check report header fields persisted on reports table
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'port' => 'Bojonegara Port',
            'master_name' => 'Capt. Haddock',
            'chief_engineer_name' => 'Eng. Calculus',
        ]);

        // Check summary_data
        $report->refresh();
        $this->assertEquals('B', $report->summary_data['audit_type']);
        $this->assertEquals('Capt. John Auditor', $report->summary_data['lead_auditor']);
        $this->assertEquals(['Bridge', 'Deck', 'Engine', 'Cargo Operations'], $report->summary_data['activities_audited']);

        // 2. Update audit team and auditees via PUT /datasets/audit_people
        $datasetPayload = [
            'rows' => [
                ['name' => 'Capt. John Auditor', 'rank' => 'Lead Auditor', 'role' => 'Lead auditor', 'sort_order' => 1],
                ['name' => 'Jane Tech', 'rank' => 'Technical Auditor', 'role' => 'Auditor', 'sort_order' => 2],
                ['name' => 'Capt. Haddock', 'rank' => 'Master', 'role' => 'Auditee', 'sort_order' => 3],
                ['name' => 'Eng. Calculus', 'rank' => 'Chief Engineer', 'role' => 'Auditee', 'sort_order' => 4],
                ['name' => 'Tintin', 'rank' => 'Chief Officer', 'role' => 'Auditee', 'sort_order' => 5],
            ],
        ];

        $datasetResponse = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), $datasetPayload);

        $datasetResponse->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.dataset_key', 'audit_people');

        $dataset = ReportDataset::where('report_id', $report->id)
            ->where('dataset_key', 'audit_people')
            ->firstOrFail();

        $this->assertCount(5, $dataset->rows);
        $names = array_column($dataset->rows, 'name');
        $this->assertContains('Capt. John Auditor', $names);
        $this->assertContains('Tintin', $names);
    }

    public function test_update_audit_setup_supports_other_audit_type(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'fields' => [
                'audit_type' => 'D',
                'audit_type_other' => 'Special Navigation Audit',
                'lead_auditor' => 'Inspector Gadget',
                'activities_audited' => ['Bridge'],
            ],
        ];

        $response = $this->actingAs($user)
            ->putJson(route('reports.fields.update', $report->id), $payload);

        $response->assertOk();

        $report->refresh();
        $this->assertEquals('D', $report->summary_data['audit_type']);
        $this->assertEquals('Special Navigation Audit', $report->summary_data['audit_type_other']);
        $this->assertEquals('Inspector Gadget', $report->summary_data['lead_auditor']);
    }

    public function test_unauthorized_user_cannot_update_audit_setup(): void
    {
        [$owner, $report] = $this->createAuditReport();
        $stranger = User::factory()->create(['role' => 'vessel', 'is_active' => true, 'vessel_name' => 'Different Vessel']);

        $response = $this->actingAs($stranger)
            ->putJson(route('reports.fields.update', $report->id), [
                'fields' => [
                    'audit_type' => 'B',
                ],
            ]);

        $response->assertForbidden();

        $datasetResponse = $this->actingAs($stranger)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [],
            ]);

        $datasetResponse->assertForbidden();
    }

    public function test_pdf_renderer_includes_audit_details_team_and_auditees(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Populate summary_data
        $summary = $report->summary_data ?? [];
        $summary['audit_type'] = 'A';
        $summary['audit_end_date'] = '2026-10-16';
        $summary['lead_auditor'] = 'Capt. Senior Lead';
        $summary['activities_audited'] = ['Bridge', 'Deck', 'Engine'];
        $summary['previous_audit_date'] = '2025-11-20';
        $summary['previous_ncr_count'] = 2;
        $summary['previous_observation_count'] = 5;
        $summary['closeout_notes'] = 'All prior CAP items have been physically verified on board.';
        $report->summary_data = $summary;
        $report->save();

        // Populate audit_people dataset
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_people'],
            [
                'rows' => [
                    ['name' => 'Capt. Senior Lead', 'rank' => 'Lead Auditor', 'role' => 'Lead auditor', 'sort_order' => 1],
                    ['name' => 'Capt. Shipmaster', 'rank' => 'Master', 'role' => 'Auditee', 'sort_order' => 2],
                ],
                'row_version' => 1,
            ]
        );

        $report->load('datasets');

        $renderer = app(ReportPdfRenderer::class);
        $html = $renderer->render($report);

        $this->assertStringContainsString('Audit Details & Activities', $html);
        $this->assertStringContainsString('Capt. Senior Lead', $html);
        $this->assertStringContainsString('Auditors (Audit Team)', $html);
        $this->assertStringContainsString('Auditees (Vessel Crew)', $html);
        $this->assertStringContainsString('Capt. Shipmaster', $html);
        $this->assertStringContainsString('Operation at Time of Audit', $html);
        $this->assertStringContainsString('Follow-up from Previous Audit', $html);
        $this->assertStringContainsString('20 November 2025', $html);
        $this->assertStringContainsString('All prior CAP items have been physically verified on board.', $html);
    }

    public function test_auditor_can_update_previous_audit_fields(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'fields' => [
                'previous_audit_date' => '2025-11-20',
                'previous_ncr_count' => 2,
                'previous_observation_count' => 5,
                'closeout_notes' => 'All prior CAP items have been physically verified on board.',
            ],
        ];

        $response = $this->actingAs($user)
            ->putJson(route('reports.fields.update', $report->id), $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('summary_data.previous_audit_date', '2025-11-20')
            ->assertJsonPath('summary_data.previous_ncr_count', 2)
            ->assertJsonPath('summary_data.previous_observation_count', 5);

        $report->refresh();
        $this->assertEquals('2025-11-20', $report->summary_data['previous_audit_date']);
        $this->assertEquals(2, $report->summary_data['previous_ncr_count']);
        $this->assertEquals(5, $report->summary_data['previous_observation_count']);
        $this->assertEquals('All prior CAP items have been physically verified on board.', $report->summary_data['closeout_notes']);
    }
}
