<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use App\Models\Report;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use App\Models\User;
use App\Models\VesselType;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 2 Tasks 2.1 & 2.2: Form Management
 * - Task 2.1: Group and subgroup tree (FM-1, FM-2, FM-9)
 * - Task 2.2: Question editor (FM-1, FM-3, FM-6, FM-9, FM-12)
 */
class FormManagementTest extends TestCase
{
    use RefreshDatabase;

    private function seedCatalogue(): void
    {
        $this->seed(FormSeeder::class);
    }

    public function test_non_superadmin_cannot_access_form_management(): void
    {
        $corporate = User::factory()->create(['role' => 'corporate']);
        $vessel = User::factory()->create(['role' => 'vessel']);

        $this->actingAs($corporate)->get(route('admin.forms.index'))->assertForbidden();
        $this->actingAs($vessel)->get(route('admin.forms.index'))->assertForbidden();
    }

    public function test_superadmin_can_view_forms_catalogue_and_detail(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $d062 = Form::query()->where('code', 'D-062')->firstOrFail();

        $this->actingAs($superadmin)
            ->get(route('admin.forms.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('forms/index')->has('forms', 2));

        $this->actingAs($superadmin)
            ->get(route('admin.forms.show', $d062))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('forms/show')
                ->has('chapters')
                ->where('form.code', 'D-062')
            );
    }

    public function test_group_creation_bumps_template_version(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $versionBefore = $form->template_version;

        $response = $this->actingAs($superadmin)->post(route('admin.groups.store', $form), [
            'title' => 'New Inspection Chapter',
            'chapter_no' => '17',
            'ice_class_only' => false,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('form_groups', [
            'form_id' => $form->id,
            'title' => 'New Inspection Chapter',
            'chapter_no' => '17',
            'parent_id' => null,
        ]);
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);
    }

    public function test_subgroup_creation_under_chapter(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $chapter4 = FormGroup::query()->where('chapter_no', '4')->whereNull('parent_id')->firstOrFail();
        $form = $chapter4->form;
        $versionBefore = $form->template_version;

        $response = $this->actingAs($superadmin)->post(route('admin.groups.store', $form), [
            'title' => 'New Electronic Navigation Subgroup',
            'parent_id' => $chapter4->id,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('form_groups', [
            'form_id' => $form->id,
            'title' => 'New Electronic Navigation Subgroup',
            'parent_id' => $chapter4->id,
        ]);
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);
    }

    public function test_group_reorder_swaps_positions_and_bumps_version(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $ch2 = FormGroup::query()->where('chapter_no', '2')->whereNull('parent_id')->firstOrFail();
        $ch3 = FormGroup::query()->where('chapter_no', '3')->whereNull('parent_id')->firstOrFail();
        $form = $ch2->form;
        $versionBefore = $form->template_version;

        $order2 = $ch2->sort_order;
        $order3 = $ch3->sort_order;
        $this->assertLessThan($order3, $order2);

        // Move ch3 up
        $this->actingAs($superadmin)->post(route('admin.groups.reorder', $ch3), ['direction' => 'up'])
            ->assertRedirect();

        $this->assertSame($order2, $ch3->fresh()->sort_order);
        $this->assertSame($order3, $ch2->fresh()->sort_order);
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);
    }

    public function test_group_toggle_enables_and_disables(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->firstOrFail();

        $this->assertTrue((bool) $group->is_enabled);

        $this->actingAs($superadmin)->post(route('admin.groups.toggle', $group))->assertRedirect();
        $this->assertFalse((bool) $group->fresh()->is_enabled);

        $this->actingAs($superadmin)->post(route('admin.groups.toggle', $group))->assertRedirect();
        $this->assertTrue((bool) $group->fresh()->is_enabled);
    }

    public function test_group_destroy_archives_if_used_in_reports(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->firstOrFail();

        // Simulate usage in a report
        ReportGroup::factory()->create(['source_group_id' => $group->id]);

        $this->assertTrue($group->isUsedInReports());

        $this->actingAs($superadmin)->delete(route('admin.groups.destroy', $group))->assertRedirect();

        // Must NOT be hard deleted, must be archived
        $this->assertNotNull($group->fresh()->archived_at);
        $this->assertDatabaseHas('form_groups', ['id' => $group->id]);
    }

    public function test_question_creation_and_wording_edit_rule(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->firstOrFail();
        $form = $group->form;

        // 1. Creation bumps template version
        $versionBefore = $form->template_version;
        $this->actingAs($superadmin)->post(route('admin.questions.store', $group), [
            'question_text' => 'Are emergency fire pumps tested weekly?',
            'guidance' => 'Verify pressure logs on the bridge',
            'input_type' => 'none',
        ])->assertRedirect();

        $this->assertDatabaseHas('form_questions', [
            'group_id' => $group->id,
            'question_text' => 'Are emergency fire pumps tested weekly?',
            'input_type' => 'none',
        ]);
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);

        // 2. Wording edit does NOT bump template version (SRS FM-12, PLAN 1.3)
        $question = FormQuestion::query()->where('question_text', 'Are emergency fire pumps tested weekly?')->firstOrFail();
        $versionAfterCreate = $form->fresh()->template_version;

        $this->actingAs($superadmin)->put(route('admin.questions.update', $question), [
            'question_text' => 'Are emergency fire pumps tested weekly and logged?',
            'guidance' => 'Verify bridge & engine room logs',
            'input_type' => 'none',
        ])->assertRedirect();

        $this->assertSame('Are emergency fire pumps tested weekly and logged?', $question->fresh()->question_text);
        // Version must remain unchanged
        $this->assertSame($versionAfterCreate, $form->fresh()->template_version);

        // 3. Multi-input types (e.g. Date + File) can be stored together
        $this->actingAs($superadmin)->post(route('admin.questions.store', $group), [
            'question_text' => 'Attach bunker delivery note copy and record delivery date',
            'guidance' => 'Upload scanned PDF or photo and select delivery date',
            'input_type' => 'date,file',
        ])->assertRedirect();

        $this->assertDatabaseHas('form_questions', [
            'group_id' => $group->id,
            'question_text' => 'Attach bunker delivery note copy and record delivery date',
            'input_type' => 'date,file',
        ]);
    }

    public function test_question_duplication(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $question = FormQuestion::query()->firstOrFail();
        $form = $question->group->form;
        $versionBefore = $form->template_version;

        $this->actingAs($superadmin)->post(route('admin.questions.duplicate', $question))->assertRedirect();

        $this->assertDatabaseHas('form_questions', [
            'group_id' => $question->group_id,
            'question_text' => $question->question_text.' (Copy)',
            'sort_order' => $question->sort_order + 1,
        ]);
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);
    }

    public function test_question_reorder(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->has('questions', '>=', 2)->firstOrFail();
        $questions = $group->questions()->orderBy('sort_order')->take(2)->get();
        $q1 = $questions[0];
        $q2 = $questions[1];

        $order1 = $q1->sort_order;
        $order2 = $q2->sort_order;

        $this->actingAs($superadmin)->post(route('admin.questions.reorder', $q2), ['direction' => 'up'])->assertRedirect();

        $this->assertSame($order1, $q2->fresh()->sort_order);
        $this->assertSame($order2, $q1->fresh()->sort_order);
    }

    public function test_question_destroy_archives_if_used_in_reports(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $question = FormQuestion::query()->firstOrFail();

        // Simulate usage in a report
        ReportQuestion::factory()->create(['source_question_id' => $question->id]);

        $this->assertTrue($question->isUsedInReports());

        $this->actingAs($superadmin)->delete(route('admin.questions.destroy', $question))->assertRedirect();

        // Must NOT be hard deleted, must be archived
        $this->assertNotNull($question->fresh()->archived_at);
        $this->assertDatabaseHas('form_questions', ['id' => $question->id]);
    }

    public function test_question_destroy_hard_deletes_if_never_used(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->firstOrFail();
        $question = FormQuestion::create([
            'group_id' => $group->id,
            'question_text' => 'Brand new unused question',
            'input_type' => 'none',
            'sort_order' => 999,
        ]);

        $this->actingAs($superadmin)->delete(route('admin.questions.destroy', $question))
            ->assertRedirect();

        $this->assertDatabaseMissing('form_questions', ['id' => $question->id]);
    }

    public function test_group_destroy_hard_deletes_if_never_used(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $form = Form::query()->firstOrFail();
        $group = FormGroup::create([
            'form_id' => $form->id,
            'title' => 'Brand new unused group',
            'sort_order' => 999,
        ]);

        $this->actingAs($superadmin)->delete(route('admin.groups.destroy', $group))
            ->assertRedirect();

        $this->assertDatabaseMissing('form_groups', ['id' => $group->id]);
    }

    public function test_bulk_toggle_questions_in_group(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->has('questions', '>=', 3)->firstOrFail();

        // Disable all
        $this->actingAs($superadmin)->post(route('admin.groups.bulk-toggle', $group), ['enable' => false])
            ->assertRedirect();

        $this->assertFalse((bool) $group->fresh()->is_enabled);
        $this->assertSame(0, $group->questions()->where('is_enabled', true)->count());

        // Enable all
        $this->actingAs($superadmin)->post(route('admin.groups.bulk-toggle', $group), ['enable' => true])
            ->assertRedirect();

        $this->assertTrue((bool) $group->fresh()->is_enabled);
        $this->assertGreaterThan(0, $group->questions()->where('is_enabled', true)->count());
    }

    public function test_bulk_move_questions_between_groups(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $sourceGroup = FormGroup::query()->has('questions', '>=', 2)->firstOrFail();
        $targetGroup = FormGroup::query()->where('id', '!=', $sourceGroup->id)->where('form_id', $sourceGroup->form_id)->firstOrFail();

        $questionsToMove = $sourceGroup->questions()->take(2)->get();
        $questionIds = $questionsToMove->pluck('id')->all();
        $targetCountBefore = $targetGroup->questions()->count();
        $form = $sourceGroup->form;
        $versionBefore = $form->template_version;

        $this->actingAs($superadmin)->post(route('admin.questions.bulk-move'), [
            'question_ids' => $questionIds,
            'target_group_id' => $targetGroup->id,
        ])->assertRedirect();

        $this->assertSame($targetCountBefore + 2, $targetGroup->fresh()->questions()->count());
        foreach ($questionIds as $qid) {
            $this->assertSame($targetGroup->id, FormQuestion::find($qid)->group_id);
        }
        $this->assertSame($versionBefore + 1, $form->fresh()->template_version);
    }

    public function test_group_applicability_update(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $group = FormGroup::query()->firstOrFail();
        $tanker = VesselType::query()->where('name', 'Tanker')->firstOrFail();

        $this->actingAs($superadmin)->put(route('admin.groups.applicability', $group), [
            'vessel_type_ids' => [$tanker->id],
            'ice_class_only' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('form_applicability', [
            'form_group_id' => $group->id,
            'vessel_type_id' => $tanker->id,
            'ice_class_only' => false,
        ]);
        $this->assertDatabaseHas('form_applicability', [
            'form_group_id' => $group->id,
            'vessel_type_id' => null,
            'ice_class_only' => true,
        ]);
    }

    public function test_question_applicability_update(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $question = FormQuestion::query()->firstOrFail();
        $cement = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();

        $this->actingAs($superadmin)->put(route('admin.questions.applicability', $question), [
            'vessel_type_ids' => [$cement->id],
            'ice_class_only' => false,
        ])->assertRedirect();

        $this->assertDatabaseHas('form_applicability', [
            'form_question_id' => $question->id,
            'vessel_type_id' => $cement->id,
            'ice_class_only' => false,
        ]);
    }

    public function test_activity_log_records_changes_and_history_endpoint(): void
    {
        $this->seedCatalogue();
        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $question = FormQuestion::query()->firstOrFail();

        // Edit question
        $this->actingAs($superadmin)->put(route('admin.questions.update', $question), [
            'question_text' => 'New audited text for activity log test',
            'guidance' => 'Updated guidance',
            'input_type' => 'none',
        ])->assertRedirect();

        // Query history endpoint
        $response = $this->actingAs($superadmin)->get(route('admin.questions.history', $question));
        $response->assertOk();

        $data = $response->json();
        $this->assertIsArray($data);
        $this->assertNotEmpty($data);
        $this->assertSame('updated', $data[0]['action']);
        $this->assertSame($superadmin->id, $data[0]['user_id']);
    }
}
