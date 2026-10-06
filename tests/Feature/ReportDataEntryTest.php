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

    public function test_answer_save_with_client_save_id_is_idempotent_on_retry(): void
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
        $clientSaveId = 'save-uuid-12345-abcde';

        // First attempt saves
        $response1 = $this->actingAs($corporate)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
                'note' => 'Equipment tested OK.',
                'client_save_id' => $clientSaveId,
            ]);

        $response1->assertOk()
            ->assertJson([
                'status' => 'saved',
                'answer' => [
                    'answer' => 'yes',
                    'client_save_id' => $clientSaveId,
                    'row_version' => 1,
                ],
            ]);

        // Second attempt with exact same client_save_id (browser retry simulation on dropped VSAT)
        $response2 = $this->actingAs($corporate)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
                'note' => 'Equipment tested OK.',
                'client_save_id' => $clientSaveId,
            ]);

        $response2->assertOk()
            ->assertJson([
                'status' => 'saved',
                'answer' => [
                    'answer' => 'yes',
                    'client_save_id' => $clientSaveId,
                    'row_version' => 1,
                ],
            ]);

        // Assert strictly only ONE record was created, not duplicate rows
        $this->assertEquals(
            1,
            ReportAnswer::where('report_id', $report->id)
                ->where('report_question_id', $question->id)
                ->count()
        );
    }

    public function test_stale_row_version_is_refused_with_409_conflict(): void
    {
        $userA = User::factory()->create([
            'role' => 'corporate',
            'name' => 'Inspector A',
            'is_active' => true,
        ]);

        $userB = User::factory()->create([
            'role' => 'corporate',
            'name' => 'Inspector B',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Conflict Test',
            'report_date' => now()->toDateString(),
            'created_by' => $userA->id,
            'status' => 'in_progress',
        ]);

        $question = $report->questions()->where('is_applicable', true)->firstOrFail();

        // Initial answer saved by User A (row_version = 1)
        $respA1 = $this->actingAs($userA)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
                'note' => 'Original note by A',
                'base_row_version' => null,
            ]);
        $respA1->assertOk();
        $this->assertEquals(1, $respA1->json('answer.row_version'));

        // User A updates answer again (row_version becomes 2)
        $respA2 = $this->actingAs($userA)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'no',
                'note' => 'Updated to No by A',
                'base_row_version' => 1,
            ]);
        $respA2->assertOk();
        $this->assertEquals(2, $respA2->json('answer.row_version'));

        // User B attempts to save with stale base_row_version = 1
        $respB = $this->actingAs($userB)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
                'note' => 'Concurrent edit from B',
                'base_row_version' => 1,
            ]);

        // Stale row_version must be refused with 409 Conflict (NFR-15)
        $respB->assertStatus(409)
            ->assertJson([
                'error' => 'conflict',
                'server_answer' => [
                    'report_question_id' => $question->id,
                    'answer' => 'no',
                    'note' => 'Updated to No by A',
                    'row_version' => 2,
                    'answered_by_name' => 'Inspector A',
                ],
            ]);

        // Database value must remain unchanged as User A's answer
        $this->assertDatabaseHas('report_answers', [
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'answer' => 'no',
            'row_version' => 2,
        ]);
    }

    public function test_overwriting_answer_with_matching_row_version_succeeds(): void
    {
        $userA = User::factory()->create([
            'role' => 'corporate',
            'name' => 'Inspector A',
            'is_active' => true,
        ]);

        $userB = User::factory()->create([
            'role' => 'corporate',
            'name' => 'Inspector B',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Overwrite Test',
            'report_date' => now()->toDateString(),
            'created_by' => $userA->id,
            'status' => 'in_progress',
        ]);

        $question = $report->questions()->where('is_applicable', true)->firstOrFail();

        // User A saves answer (row_version = 1)
        $this->actingAs($userA)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'yes',
                'note' => 'User A note',
            ])->assertOk();

        // User B accepts server row_version = 1 and consciously overwrites
        $respB = $this->actingAs($userB)
            ->postJson(route('reports.answers.save', [$report->id, $question->id]), [
                'answer' => 'na',
                'note' => 'Overwritten by User B',
                'base_row_version' => 1,
            ]);

        $respB->assertOk()
            ->assertJson([
                'status' => 'saved',
                'answer' => [
                    'answer' => 'na',
                    'note' => 'Overwritten by User B',
                    'row_version' => 2,
                ],
            ]);

        $this->assertDatabaseHas('report_answers', [
            'report_id' => $report->id,
            'report_question_id' => $question->id,
            'answer' => 'na',
            'note' => 'Overwritten by User B',
            'row_version' => 2,
        ]);
    }

    public function test_advisory_edit_lock_lifecycle_and_takeover(): void
    {
        $userA = User::factory()->create([
            'role' => 'corporate',
            'name' => 'First Editor',
            'is_active' => true,
        ]);

        $userB = User::factory()->create([
            'role' => 'corporate',
            'name' => 'Second Editor',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'D-062')->firstOrFail();

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Lock Test',
            'report_date' => now()->toDateString(),
            'created_by' => $userA->id,
            'status' => 'draft',
        ]);

        // User A acquires lock
        $respA = $this->actingAs($userA)
            ->postJson(route('reports.lock.acquire', $report->id));

        $respA->assertOk()
            ->assertJson([
                'status' => 'acquired',
                'lock' => [
                    'is_locked' => true,
                    'is_owner' => true,
                    'owner_id' => $userA->id,
                    'owner_name' => 'First Editor',
                ],
            ]);

        $report->refresh();
        $this->assertEquals($userA->id, $report->lock_owner_id);
        $this->assertTrue($report->lock_expires_at->isFuture());

        // User B attempts to acquire lock (without force)
        $respB = $this->actingAs($userB)
            ->postJson(route('reports.lock.acquire', $report->id));

        $respB->assertOk()
            ->assertJson([
                'status' => 'held_by_other',
                'lock' => [
                    'is_locked' => true,
                    'is_owner' => false,
                    'owner_id' => $userA->id,
                    'owner_name' => 'First Editor',
                ],
            ]);

        // User B takes over editing with force = true
        $respTakeover = $this->actingAs($userB)
            ->postJson(route('reports.lock.acquire', $report->id), [
                'force' => true,
            ]);

        $respTakeover->assertOk()
            ->assertJson([
                'status' => 'acquired',
                'lock' => [
                    'is_locked' => true,
                    'is_owner' => true,
                    'owner_id' => $userB->id,
                    'owner_name' => 'Second Editor',
                ],
            ]);

        $report->refresh();
        $this->assertEquals($userB->id, $report->lock_owner_id);

        // User B releases lock
        $respRelease = $this->actingAs($userB)
            ->deleteJson(route('reports.lock.release', $report->id));

        $respRelease->assertOk()
            ->assertJson(['status' => 'released']);

        $report->refresh();
        $this->assertNull($report->lock_owner_id);
        $this->assertNull($report->lock_expires_at);
    }
}
