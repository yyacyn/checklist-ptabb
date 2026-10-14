<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Form;
use App\Models\User;
use App\Services\Pdf\ReportDocumentBuilder;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
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
        $response->assertInertia(fn (AssertableInertia $page) => $page
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
        $response->assertInertia(fn (AssertableInertia $page) => $page
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
        $responseAttempt->assertInertia(fn (AssertableInertia $page) => $page
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
        $resRisk->assertInertia(fn (AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.risk', 'high')
        );

        // Filter by search='Emergency generator'
        $resSearch = $this->actingAs($corporate)->get(route('findings.index', ['search' => 'Emergency generator']));
        $resSearch->assertOk();
        $resSearch->assertInertia(fn (AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.job_order_no', 'JO-991')
        );

        // Filter by status=closed
        $resStatus = $this->actingAs($corporate)->get(route('findings.index', ['finding_status' => 'closed']));
        $resStatus->assertOk();
        $resStatus->assertInertia(fn (AssertableInertia $page) => $page
            ->has('findings.data', 1)
            ->where('findings.data.0.risk', 'low')
        );
    }

    public function test_audit_findings_auto_generate_finding_numbers_and_issue_dates(): void
    {
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MT Star Pioneer',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'B-008')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MT Star Pioneer',
            'report_date' => now()->toDateString(),
            'created_by' => $vesselUser->id,
            'status' => 'draft',
        ]);

        // 1. Create first non_conformity without finding_no and issue_date
        $res1 = $this->actingAs($vesselUser)->postJson(route('reports.findings.store', $report->id), [
            'finding_kind' => 'non_conformity',
            'description' => 'First non-conformity finding on bridge procedures.',
            'risk' => 'high',
        ]);
        $res1->assertCreated();
        $this->assertEquals('NC-01', $res1->json('finding.finding_no'));
        $this->assertStringStartsWith(now()->toDateString(), $res1->json('finding.issue_date'));

        // 2. Create second non_conformity
        $res2 = $this->actingAs($vesselUser)->postJson(route('reports.findings.store', $report->id), [
            'finding_kind' => 'non_conformity',
            'description' => 'Second non-conformity finding on cargo operations.',
            'risk' => 'medium',
        ]);
        $res2->assertCreated();
        $this->assertEquals('NC-02', $res2->json('finding.finding_no'));

        // 3. Create first observation
        $res3 = $this->actingAs($vesselUser)->postJson(route('reports.findings.store', $report->id), [
            'finding_kind' => 'observation',
            'description' => 'First observation regarding galley cleanliness.',
            'risk' => 'low',
        ]);
        $res3->assertCreated();
        $this->assertEquals('OBS-01', $res3->json('finding.finding_no'));

        // 4. Create explicit custom finding number & issue date
        $res4 = $this->actingAs($vesselUser)->postJson(route('reports.findings.store', $report->id), [
            'finding_no' => 'CUSTOM-99',
            'issue_date' => '2026-05-15',
            'finding_kind' => 'observation',
            'description' => 'Specific custom finding.',
        ]);
        $res4->assertCreated();
        $this->assertEquals('CUSTOM-99', $res4->json('finding.finding_no'));
        $this->assertStringStartsWith('2026-05-15', $res4->json('finding.issue_date'));
    }

    public function test_audit_summary_pdf_contains_b008_results_table_and_hides_ratings_matrix(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'B-008')->firstOrFail();
        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MT Star Pioneer',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        Finding::create([
            'report_id' => $report->id,
            'finding_no' => 'NC-01',
            'finding_kind' => 'non_conformity',
            'issue_date' => '2026-10-10',
            'description' => 'Bridge passage plan not updated.',
            'target_date' => '2026-11-10',
            'finding_status' => 'open',
        ]);

        Finding::create([
            'report_id' => $report->id,
            'finding_no' => 'OBS-01',
            'finding_kind' => 'observation',
            'issue_date' => '2026-10-12',
            'description' => 'Lifeboat muster drill signage fading.',
            'target_date' => '2026-10-25',
            'finding_status' => 'open',
        ]);

        $docBuilder = app(ReportDocumentBuilder::class);
        $doc = $docBuilder->build($report);

        // Assert builder counts
        $this->assertEquals(1, $doc['summary']['counts']['ncr']);
        $this->assertEquals(1, $doc['summary']['counts']['observation']);
        $this->assertEquals(1, $doc['audit']['current_ncr_count']);
        $this->assertEquals(1, $doc['audit']['current_observation_count']);
        $this->assertFalse($doc['summary']['has_ratings_matrix']);

        // Render blade view
        $html = view('pdf.sections.audit_summary', [
            'report' => $report,
            'doc' => $doc,
            'config' => ['type' => 'audit_summary'],
        ])->render();

        $this->assertStringContainsString('Number of Non-Conformities:', $html);
        $this->assertStringContainsString('Number of Observations:', $html);
        $this->assertStringContainsString('LIST OF NON-CONFORMITIES AND OBSERVATIONS', $html);
        $this->assertStringContainsString('N/C ID NUMBER', $html);
        $this->assertStringContainsString('DATE ISSUED', $html);
        $this->assertStringContainsString('BRIEF DESCRIPTION', $html);
        $this->assertStringContainsString('CLOSE OUT TARGET DATE', $html);
        $this->assertStringContainsString('NC-01', $html);
        $this->assertStringContainsString('OBS-01', $html);
        $this->assertStringContainsString('Bridge passage plan not updated.', $html);
        $this->assertStringNotContainsString('ratings-table', $html);
    }
}
