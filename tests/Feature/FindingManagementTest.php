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
}
