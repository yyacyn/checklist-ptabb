<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\Report;
use App\Models\ReportDataset;
use App\Models\User;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 7, Task 7.1 (New Plan): Generic storage for repeating datasets and summary fields (SRS 14.4).
 *
 * Verifies:
 * - Dataset save & update with row_version increments.
 * - Idempotency with client_save_id (NFR-2).
 * - Stale save conflict detection (409 Conflict) with base_row_version (NFR-15).
 * - Validation of dataset keys and row shapes.
 * - PUT reports/{report}/fields merging into summary_data.
 * - Refusal on submitted/closed reports and unauthorized users.
 */
class ReportDatasetTest extends TestCase
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
            'operations' => ['Loading', 'At anchor'],
        ], $overrides));

        return [$user, $report];
    }

    public function test_can_save_and_update_dataset_rows(): void
    {
        [$user, $report] = $this->createAuditReport();

        $rows = [
            ['person_or_function' => 'Bridge Team', 'date' => '2026-10-14', 'start_time' => '09:00', 'end_time' => '11:00', 'topics' => 'Passage planning', 'sort_order' => 1],
        ];

        // 1. First save (creation)
        $response = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => $rows,
            ]);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.dataset_key', 'audit_execution_log')
            ->assertJsonPath('dataset.row_version', 1);

        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_execution_log',
            'row_version' => 1,
        ]);

        // 2. Second save (update)
        $updatedRows = array_merge($rows, [
            ['person_or_function' => 'Engine Team', 'date' => '2026-10-14', 'start_time' => '11:00', 'end_time' => '13:00', 'topics' => 'Oil record book', 'sort_order' => 2],
        ]);

        $response2 = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => $updatedRows,
                'base_row_version' => 1,
            ]);

        $response2->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.row_version', 2);

        $this->assertDatabaseHas('report_datasets', [
            'report_id' => $report->id,
            'dataset_key' => 'audit_execution_log',
            'row_version' => 2,
        ]);
    }

    public function test_dataset_idempotency_via_client_save_id(): void
    {
        [$user, $report] = $this->createAuditReport();

        $clientSaveId = 'save-uuid-12345';
        $rows = [
            ['person_or_function' => 'Superintendent', 'topics' => 'Opening meeting', 'sort_order' => 1],
        ];

        $response1 = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => $rows,
                'client_save_id' => $clientSaveId,
            ]);

        $response1->assertOk()
            ->assertJsonPath('dataset.row_version', 1);

        // Resend identical request with same client_save_id
        $response2 = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => $rows,
                'client_save_id' => $clientSaveId,
            ]);

        $response2->assertOk()
            ->assertJsonPath('dataset.row_version', 1);

        $this->assertEquals(1, ReportDataset::where('report_id', $report->id)->where('dataset_key', 'audit_execution_log')->count());
    }

    public function test_dataset_conflict_detection_returns_409(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Ensure dataset is at version 2
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_people'],
            [
                'rows' => [
                    ['name' => 'Capt. Current', 'rank' => 'Master', 'role' => 'Auditee'],
                ],
                'row_version' => 2,
            ]
        );

        // Client attempts to save based on stale version 1
        $response = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => 'Capt. Stale', 'rank' => 'Master', 'role' => 'Auditee'],
                ],
                'base_row_version' => 1,
            ]);

        $response->assertStatus(409)
            ->assertJsonPath('status', 'conflict')
            ->assertJsonPath('server_dataset.row_version', 2);
    }

    public function test_dataset_conflict_resolution_by_overwriting_with_server_version(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Server dataset is at version 3
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_people'],
            [
                'rows' => [
                    ['name' => 'Capt. Original', 'rank' => 'Master', 'role' => 'Auditee'],
                ],
                'row_version' => 3,
            ]
        );

        // 1. Client attempts to save with stale version 2 -> returns 409
        $conflictResponse = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => 'Capt. Overwritten', 'rank' => 'Master', 'role' => 'Auditee'],
                ],
                'base_row_version' => 2,
            ]);

        $conflictResponse->assertStatus(409)
            ->assertJsonPath('server_dataset.row_version', 3);

        // 2. Client chooses "Overwrite Server", resending with base_row_version = 3
        $overwriteResponse = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => 'Capt. Overwritten', 'rank' => 'Master', 'role' => 'Auditee'],
                ],
                'base_row_version' => 3,
            ]);

        $overwriteResponse->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.row_version', 4)
            ->assertJsonPath('dataset.rows.0.name', 'Capt. Overwritten');
    }

    public function test_dataset_rejects_unsupported_key_or_malformed_rows(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Unknown key
        $response1 = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'unknown_dataset']), [
                'rows' => [],
            ]);

        $response1->assertUnprocessable();

        // Malformed row for audit_people (missing 'role')
        $response2 = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => 'Only Name', 'rank' => 'Master'],
                ],
            ]);

        $response2->assertUnprocessable();
    }

    public function test_can_update_scalar_fields_in_summary_data(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'fields' => [
                'audit_type' => 'B',
                'audit_end_date' => '2026-10-16',
                'previous_ncr_count' => 3,
                'previous_observation_count' => 1,
                'positive_comments' => 'Good bridge team resource management.',
            ],
        ];

        $response = $this->actingAs($user)
            ->putJson(route('reports.fields.update', $report->id), $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('summary_data.audit_type', 'B')
            ->assertJsonPath('summary_data.previous_ncr_count', 3);

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
        ]);

        $report->refresh();
        $this->assertEquals('B', $report->summary_data['audit_type']);
        $this->assertEquals(3, $report->summary_data['previous_ncr_count']);
        $this->assertEquals('Good bridge team resource management.', $report->summary_data['positive_comments']);
    }

    public function test_refuses_dataset_update_on_submitted_report(): void
    {
        [$user, $report] = $this->createAuditReport(['status' => 'submitted']);

        $response = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => 'Auditor', 'rank' => 'Rank', 'role' => 'Lead auditor'],
                ],
            ]);

        $response->assertForbidden();

        $fieldsResponse = $this->actingAs($user)
            ->putJson(route('reports.fields.update', $report->id), [
                'fields' => ['positive_comments' => 'Blocked update'],
            ]);

        $fieldsResponse->assertForbidden();
    }

    public function test_refuses_unauthorized_user(): void
    {
        [$owner, $report] = $this->createAuditReport();
        $stranger = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'Different Vessel',
            'is_active' => true,
        ]);

        $response = $this->actingAs($stranger)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [],
            ]);

        $response->assertForbidden();
    }
}
