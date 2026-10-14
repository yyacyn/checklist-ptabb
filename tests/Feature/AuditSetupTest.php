<?php

namespace Tests\Feature;

use App\Models\AuditActivity;
use App\Models\Auditor;
use App\Models\Form;
use App\Models\Report;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 7, Task 7.1: Audit Set-up (SRS AUD-2, AUD-3).
 *
 * Verifies:
 * - Default audit_details and audit_activities are seeded on snapshot.
 * - Auditor can update audit type, dates, lead auditor, operations, activities, auditors, and auditees.
 * - Other audit type (D) and vessel header particulars are persisted.
 * - Authorization enforcement on updateAuditSetup.
 * - PDF renderer includes audit particulars, team, auditees, and AUD-2 operations.
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

    public function test_audit_report_snapshot_initializes_default_audit_details_and_activities(): void
    {
        [$user, $report] = $this->createAuditReport();

        $this->assertDatabaseHas('audit_details', [
            'report_id' => $report->id,
            'audit_type' => 'A',
            'start_date' => '2026-10-14',
            'end_date' => '2026-10-14',
        ]);

        $activities = AuditActivity::where('report_id', $report->id)->pluck('activity')->all();
        $this->assertContains('Bridge', $activities);
        $this->assertContains('Deck', $activities);
        $this->assertContains('Engine', $activities);
    }

    public function test_auditor_can_update_audit_setup(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'start_date' => '2026-10-15',
            'end_date' => '2026-10-17',
            'audit_type' => 'B',
            'lead_auditor' => 'Capt. John Auditor',
            'port' => 'Bojonegara Port',
            'master_name' => 'Capt. Haddock',
            'chief_engineer_name' => 'Eng. Calculus',
            'operations' => ['Loading', 'Bunkering', 'Repairs afloat'],
            'activities' => [
                ['activity' => 'Bridge', 'sort_order' => 1],
                ['activity' => 'Deck', 'sort_order' => 2],
                ['activity' => 'Engine', 'sort_order' => 3],
                ['activity' => 'Cargo Operations', 'sort_order' => 4],
            ],
            'auditors' => [
                ['name' => 'Capt. John Auditor', 'rank' => 'Lead Auditor', 'is_lead' => true, 'sort_order' => 1],
                ['name' => 'Jane Tech', 'rank' => 'Technical Auditor', 'is_lead' => false, 'sort_order' => 2],
            ],
            'auditees' => [
                ['name' => 'Capt. Haddock', 'rank' => 'Master', 'sort_order' => 1],
                ['name' => 'Eng. Calculus', 'rank' => 'Chief Engineer', 'sort_order' => 2],
                ['name' => 'Tintin', 'rank' => 'Chief Officer', 'sort_order' => 3],
            ],
        ];

        $response = $this->actingAs($user)
            ->putJson(route('reports.audit-setup.update', $report->id), $payload);

        $response->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('report.audit_detail.audit_type', 'B')
            ->assertJsonPath('report.audit_detail.lead_auditor', 'Capt. John Auditor');

        // Check audit details
        $this->assertDatabaseHas('audit_details', [
            'report_id' => $report->id,
            'audit_type' => 'B',
            'lead_auditor' => 'Capt. John Auditor',
        ]);

        // Check report header fields
        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'port' => 'Bojonegara Port',
            'master_name' => 'Capt. Haddock',
            'chief_engineer_name' => 'Eng. Calculus',
        ]);

        // Check activities
        $this->assertDatabaseCount('audit_activities', 4);
        $this->assertDatabaseHas('audit_activities', [
            'report_id' => $report->id,
            'activity' => 'Cargo Operations',
        ]);

        // Check auditors
        $this->assertDatabaseCount('auditors', 2);
        $this->assertDatabaseHas('auditors', [
            'report_id' => $report->id,
            'name' => 'Capt. John Auditor',
            'is_lead' => true,
        ]);

        // Check auditees
        $this->assertDatabaseCount('auditees', 3);
        $this->assertDatabaseHas('auditees', [
            'report_id' => $report->id,
            'name' => 'Tintin',
            'rank' => 'Chief Officer',
        ]);
    }

    public function test_update_audit_setup_supports_other_audit_type(): void
    {
        [$user, $report] = $this->createAuditReport();

        $payload = [
            'audit_type' => 'D',
            'audit_type_other' => 'Special Navigation Audit',
            'lead_auditor' => 'Inspector Gadget',
            'activities' => [
                ['activity' => 'Bridge'],
            ],
            'auditors' => [
                ['name' => 'Inspector Gadget', 'rank' => 'Senior Auditor', 'is_lead' => true],
            ],
            'auditees' => [],
        ];

        $response = $this->actingAs($user)
            ->putJson(route('reports.audit-setup.update', $report->id), $payload);

        $response->assertOk();

        $this->assertDatabaseHas('audit_details', [
            'report_id' => $report->id,
            'audit_type' => 'D',
            'audit_type_other' => 'Special Navigation Audit',
        ]);
    }

    public function test_unauthorized_user_cannot_update_audit_setup(): void
    {
        [$owner, $report] = $this->createAuditReport();
        $stranger = User::factory()->create(['role' => 'vessel', 'is_active' => true, 'vessel_name' => 'Different Vessel']);

        $response = $this->actingAs($stranger)
            ->putJson(route('reports.audit-setup.update', $report->id), [
                'audit_type' => 'B',
            ]);

        $response->assertForbidden();
    }

    public function test_pdf_renderer_includes_audit_details_team_and_auditees(): void
    {
        [$user, $report] = $this->createAuditReport();

        // Populate audit details
        $report->auditDetail()->updateOrCreate(
            ['report_id' => $report->id],
            [
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-16',
                'audit_type' => 'A',
                'lead_auditor' => 'Capt. Senior Lead',
            ]
        );

        $report->auditors()->create([
            'name' => 'Capt. Senior Lead',
            'rank' => 'Lead Auditor',
            'is_lead' => true,
            'sort_order' => 1,
        ]);

        $report->auditees()->create([
            'name' => 'Capt. Shipmaster',
            'rank' => 'Master',
            'sort_order' => 1,
        ]);

        $renderer = app(ReportPdfRenderer::class);
        $html = $renderer->render($report);

        $this->assertStringContainsString('Audit Details & Activities', $html);
        $this->assertStringContainsString('Capt. Senior Lead', $html);
        $this->assertStringContainsString('Auditors (Audit Team)', $html);
        $this->assertStringContainsString('Auditees (Vessel Crew)', $html);
        $this->assertStringContainsString('Capt. Shipmaster', $html);
        $this->assertStringContainsString('Operation at Time of Audit', $html);
    }
}
