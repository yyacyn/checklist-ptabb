<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Finding;
use App\Models\Form;
use App\Models\User;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FindingManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    public function test_user_can_add_chapter_15_observation(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        $response = $this->actingAs($corporate)
            ->postJson(route('reports.findings.store', $report->id), [
                'chapter_label' => 'Chapter 6 - Navigation',
                'viq_paragraph' => '6.34',
                'description' => 'ECDIS backup power test record missing on bridge.',
                'risk' => 'medium',
                'job_order_no' => 'JO-2026-089',
            ]);

        $response->assertCreated()
            ->assertJson([
                'status' => 'created',
                'finding' => [
                    'chapter_label' => 'Chapter 6 - Navigation',
                    'viq_paragraph' => '6.34',
                    'description' => 'ECDIS backup power test record missing on bridge.',
                    'risk' => 'medium',
                    'job_order_no' => 'JO-2026-089',
                    'finding_kind' => 'observation',
                    'finding_status' => 'open',
                ],
            ]);

        $this->assertDatabaseHas('findings', [
            'report_id' => $report->id,
            'chapter_label' => 'Chapter 6 - Navigation',
            'viq_paragraph' => '6.34',
            'risk' => 'medium',
            'job_order_no' => 'JO-2026-089',
            'finding_kind' => 'observation',
        ]);

        $this->assertDatabaseHas('activity_log', [
            'entity_type' => Finding::class,
            'action' => 'created',
            'report_id' => $report->id,
        ]);
    }

    public function test_user_can_update_observation(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'in_progress',
        ]);

        $finding = Finding::create([
            'report_id' => $report->id,
            'chapter_label' => 'Chapter 4',
            'viq_paragraph' => '4.12',
            'description' => 'Initial observation note.',
            'risk' => 'low',
            'finding_kind' => 'observation',
            'finding_status' => 'open',
        ]);

        $response = $this->actingAs($corporate)
            ->putJson(route('reports.findings.update', [$report->id, $finding->id]), [
                'chapter_label' => 'Chapter 4 - Crew Management',
                'viq_paragraph' => '4.15',
                'description' => 'Updated observation note with more detail.',
                'risk' => 'high',
                'job_order_no' => 'JO-1122',
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'updated',
                'finding' => [
                    'id' => $finding->id,
                    'chapter_label' => 'Chapter 4 - Crew Management',
                    'viq_paragraph' => '4.15',
                    'description' => 'Updated observation note with more detail.',
                    'risk' => 'high',
                    'job_order_no' => 'JO-1122',
                ],
            ]);

        $finding->refresh();
        $this->assertEquals('Chapter 4 - Crew Management', $finding->chapter_label);
        $this->assertEquals('high', $finding->risk);
        $this->assertEquals('JO-1122', $finding->job_order_no);

        $this->assertDatabaseHas('activity_log', [
            'entity_type' => Finding::class,
            'entity_id' => $finding->id,
            'action' => 'updated',
            'report_id' => $report->id,
        ]);
    }

    public function test_user_can_delete_observation(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'in_progress',
        ]);

        $finding = Finding::create([
            'report_id' => $report->id,
            'chapter_label' => 'Chapter 8',
            'viq_paragraph' => '8.01',
            'description' => 'Observation to be deleted.',
            'risk' => 'low',
            'finding_kind' => 'observation',
            'finding_status' => 'open',
        ]);

        $response = $this->actingAs($corporate)
            ->deleteJson(route('reports.findings.destroy', [$report->id, $finding->id]));

        $response->assertOk()
            ->assertJson([
                'status' => 'deleted',
                'finding_id' => $finding->id,
            ]);

        $this->assertDatabaseMissing('findings', ['id' => $finding->id]);

        $this->assertDatabaseHas('activity_log', [
            'entity_type' => Finding::class,
            'entity_id' => $finding->id,
            'action' => 'deleted',
            'report_id' => $report->id,
        ]);
    }

    public function test_store_validation_requires_mandatory_fields(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        $response = $this->actingAs($corporate)
            ->postJson(route('reports.findings.store', $report->id), [
                'description' => '',
                'risk' => 'invalid-risk',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['description', 'risk']);
    }

    public function test_corporate_user_can_view_findings_index_across_vessels(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $formD062 = Form::where('code', 'D-062')->firstOrFail();
        $formB008 = Form::where('code', 'B-008')->firstOrFail();

        $reportA = app(ReportSnapshot::class)->createReport($formD062, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => '2026-10-01',
            'created_by' => $corporate->id,
            'status' => 'submitted',
        ]);

        $reportB = app(ReportSnapshot::class)->createReport($formB008, [
            'vessel_name' => 'MT Pacific Pioneer',
            'report_date' => '2026-10-05',
            'created_by' => $corporate->id,
            'status' => 'reviewed',
        ]);

        Finding::create([
            'report_id' => $reportA->id,
            'chapter_label' => 'Chapter 5',
            'viq_paragraph' => '5.02',
            'description' => 'Oceanic Star high risk safety barrier defect.',
            'risk' => 'high',
            'finding_kind' => 'observation',
            'finding_status' => 'open',
        ]);

        Finding::create([
            'report_id' => $reportB->id,
            'chapter_label' => 'Chapter 2',
            'viq_paragraph' => '2.15',
            'description' => 'Pacific Pioneer medium risk SMS non-conformity.',
            'risk' => 'medium',
            'finding_kind' => 'non_conformity',
            'finding_status' => 'action_submitted',
        ]);

        $response = $this->actingAs($corporate)->get(route('findings.index'));

        $response->assertOk();
        $response->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component('findings/index')
            ->has('findings.data', 2)
            ->where('stats.total', 2)
            ->where('stats.high_risk', 1)
            ->where('stats.medium_risk', 1)
            ->where('stats.open', 1)
            ->has('known_vessels')
        );
    }

    public function test_vessel_user_findings_are_strictly_scoped_to_assigned_vessel(): void
    {
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Oceanic Star',
            'is_active' => true,
        ]);

        $corporate = User::factory()->create(['role' => 'corporate']);
        $form = Form::where('code', 'D-062')->firstOrFail();

        $reportMyVessel = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV OCEANIC STAR', // Case insensitivity check
            'report_date' => '2026-10-01',
            'created_by' => $corporate->id,
        ]);

        $reportOtherVessel = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MT Pacific Pioneer',
            'report_date' => '2026-10-02',
            'created_by' => $corporate->id,
        ]);

        Finding::create([
            'report_id' => $reportMyVessel->id,
            'description' => 'Finding for my vessel.',
            'risk' => 'low',
            'finding_status' => 'open',
        ]);

        Finding::create([
            'report_id' => $reportOtherVessel->id,
            'description' => 'Finding for other vessel should not be visible.',
            'risk' => 'high',
            'finding_status' => 'open',
        ]);

        // Access index without filter
        $response = $this->actingAs($vesselUser)->get(route('findings.index'));

        $response->assertOk();
        $response->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component('findings/index')
            ->has('findings.data', 1)
            ->where('findings.data.0.vessel_name', 'MV OCEANIC STAR')
            ->where('stats.total', 1)
            ->where('stats.high_risk', 0)
            ->where('stats.low_risk', 1)
        );

        // Attempting to query another vessel by query parameter should still be scoped
        $responseAttempt = $this->actingAs($vesselUser)->get(route('findings.index', ['vessel_name' => 'MT Pacific Pioneer']));
        $responseAttempt->assertOk();
        $responseAttempt->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component('findings/index')
            ->has('findings.data', 1)
            ->where('findings.data.0.vessel_name', 'MV OCEANIC STAR')
        );
    }

    public function test_filtering_findings_by_risk_status_and_search_query(): void
    {
        $corporate = User::factory()->create(['role' => 'corporate']);
        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => '2026-10-01',
            'created_by' => $corporate->id,
        ]);

        Finding::create([
            'report_id' => $report->id,
            'chapter_label' => 'Chapter 3',
            'viq_paragraph' => '3.12',
            'job_order_no' => 'JO-991',
            'description' => 'Emergency generator test procedure unposted.',
            'risk' => 'high',
            'finding_status' => 'open',
            'finding_kind' => 'observation',
        ]);

        Finding::create([
            'report_id' => $report->id,
            'chapter_label' => 'Chapter 4',
            'viq_paragraph' => '4.20',
            'job_order_no' => 'JO-992',
            'description' => 'Navigation charts up to date.',
            'risk' => 'low',
            'finding_status' => 'closed',
            'finding_kind' => 'observation',
        ]);

        // Filter by risk=high
        $resRisk = $this->actingAs($corporate)->get(route('findings.index', ['risk' => 'high']));
        $resRisk->assertOk();
        $resRisk->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.risk', 'high')
        );

        // Filter by search='Emergency generator'
        $resSearch = $this->actingAs($corporate)->get(route('findings.index', ['search' => 'Emergency generator']));
        $resSearch->assertOk();
        $resSearch->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.job_order_no', 'JO-991')
        );

        // Filter by status=closed
        $resStatus = $this->actingAs($corporate)->get(route('findings.index', ['finding_status' => 'closed']));
        $resStatus->assertOk();
        $resStatus->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.risk', 'low')
        );
    }
}
