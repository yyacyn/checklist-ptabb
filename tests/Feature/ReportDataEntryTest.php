<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\ReportAnswer;
use App\Models\User;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportDataEntryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    public function test_user_can_view_report_show_screen(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Test Vessel',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        $this->actingAs($corporate)
            ->get(route('reports.show', $report->id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('reports/show')
                ->has('report')
                ->has('is_editable')
            );
    }

    public function test_user_can_save_answer_and_transitions_report_to_in_progress(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Test Vessel',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'draft',
        ]);

        $question = $report->questions()->where('is_applicable', true)->firstOrFail();

        $response = $this->actingAs($corporate)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'no',
                'note' => 'Found minor corrosion on bracket.',
                'extra_value' => 'Sample detail',
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'saved',
                'answer' => [
                    'report_question_id' => $question->id,
                    'answer' => 'no',
                    'note' => 'Found minor corrosion on bracket.',
                    'extra_value' => 'Sample detail',
                ],
            ]);

        $this->assertDatabaseHas('report_answers', [
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'answer' => 'no',
            'note' => 'Found minor corrosion on bracket.',
            'extra_value' => 'Sample detail',
            'answered_by' => $corporate->id,
        ]);

        // Report status should transition from draft to in_progress
        $report->refresh();
        $this->assertEquals('in_progress', $report->status);
    }

    public function test_user_can_update_existing_answer(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Test Vessel',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'in_progress',
        ]);

        $question = $report->questions()->where('is_applicable', true)->firstOrFail();

        // Save initial answer
        ReportAnswer::create([
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'answer' => 'yes',
            'answered_by' => $corporate->id,
        ]);

        // Update answer to 'ns' with notes
        $response = $this->actingAs($corporate)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'ns',
                'note' => 'Equipment temporarily not sighted during transit.',
            ]);

        $response->assertOk();

        $this->assertDatabaseHas('report_answers', [
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'answer' => 'ns',
            'note' => 'Equipment temporarily not sighted during transit.',
        ]);

        $this->assertEquals(1, ReportAnswer::where('report_id', $report->id)->where('report_question_id', $question->id)->count());
    }

    public function test_user_can_save_group_comments(): void
    {
        $corporate = User::factory()->create([
            'role' => 'corporate',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Test Vessel',
            'report_date' => now()->toDateString(),
            'created_by' => $corporate->id,
            'status' => 'in_progress',
        ]);

        $chapter = $report->groups()->whereNull('parent_id')->firstOrFail();

        $response = $this->actingAs($corporate)
            ->postJson(route('reports.groups.comments', [$report->id, $chapter->id]), [
                'comments' => 'General inspection of Chapter 1 completed satisfactorily.',
            ]);

        $response->assertOk()
            ->assertJson([
                'status' => 'saved',
                'comments' => 'General inspection of Chapter 1 completed satisfactorily.',
            ]);

        $this->assertDatabaseHas('report_groups', [
            'id' => $chapter->id,
            'comments' => 'General inspection of Chapter 1 completed satisfactorily.',
        ]);
    }

    public function test_vessel_user_cannot_answer_other_vessels_report(): void
    {
        $vesselA = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'Ship Alpha',
            'is_active' => true,
        ]);

        $b008 = Form::where('code', 'B-008')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($b008, [
            'vessel_name' => 'Ship Beta',
            'report_date' => now()->toDateString(),
            'created_by' => $vesselA->id,
            'status' => 'draft',
        ]);

        $question = $report->questions()->firstOrFail();

        $this->actingAs($vesselA)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
            ])
            ->assertForbidden();
    }
}
