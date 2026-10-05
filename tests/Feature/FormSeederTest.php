<?php

namespace Tests\Feature;

use App\Models\EvaluationCriterion;
use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use App\Models\VesselType;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 1 group 1: the template catalogue, and the seeder that fills it from the
 * reviewed files produced by spike S1 (SRS section 5).
 */
class FormSeederTest extends TestCase
{
    use RefreshDatabase;

    private function seedForms(): void
    {
        $this->seed(FormSeeder::class);
    }

    public function test_it_loads_both_forms(): void
    {
        $this->seedForms();

        $this->assertDatabaseHas('forms', ['code' => 'D-062', 'answer_set' => 'd062_yes_no_ns_na', 'form_version' => 'v01.01']);
        $this->assertDatabaseHas('forms', ['code' => 'B-008', 'answer_set' => 'b008_yes_no_ns', 'form_version' => 'v00.00']);
    }

    public function test_it_loads_the_expected_number_of_questions(): void
    {
        $this->seedForms();

        // Measured by spike S1: 428 in 17 sections, 616 across chapters 2 to 13.
        $this->assertSame(428, FormQuestion::query()->whereHas(
            'group',
            fn ($q) => $q->whereHas('form', fn ($f) => $f->where('code', 'B-008'))
        )->count());

        $this->assertSame(616, FormQuestion::query()->whereHas(
            'group',
            fn ($q) => $q->whereHas('form', fn ($f) => $f->where('code', 'D-062'))
        )->count());

        $this->assertSame(17, FormGroup::query()
            ->whereNull('parent_id')
            ->whereHas('form', fn ($f) => $f->where('code', 'B-008'))
            ->count());
    }

    public function test_it_loads_d062_chapters_two_to_thirteen_only(): void
    {
        $this->seedForms();

        $chapters = FormGroup::query()
            ->whereNull('parent_id')
            ->whereHas('form', fn ($f) => $f->where('code', 'D-062'))
            ->pluck('chapter_no')
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();

        // Chapter 1 (general information) and 14 to 16 are not checklists.
        $this->assertSame(['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'], $chapters);
    }

    public function test_running_it_twice_changes_nothing(): void
    {
        $this->seedForms();
        $before = FormQuestion::query()->count();
        $groupsBefore = FormGroup::query()->count();

        $this->seed(FormSeeder::class);

        $this->assertSame($before, FormQuestion::query()->count(), 're-running must not duplicate questions');
        $this->assertSame($groupsBefore, FormGroup::query()->count(), 're-running must not duplicate groups');
    }

    public function test_every_question_is_traceable_to_the_source_document(): void
    {
        $this->seedForms();

        $this->assertSame(0, FormQuestion::query()->whereNull('source_key')->count());
        $this->assertSame(0, FormQuestion::query()->whereNull('source_ref')->count());

        // source_key is the de-duplication key, so it must be unique.
        $this->assertSame(
            FormQuestion::query()->count(),
            FormQuestion::query()->distinct()->count('source_key')
        );
    }

    public function test_no_question_has_empty_text(): void
    {
        $this->seedForms();

        $this->assertSame(0, FormQuestion::query()->where('question_text', '')->count());
        $this->assertSame(0, FormQuestion::query()->whereNull('question_text')->count());
    }

    public function test_chapter_eight_is_tanker_only_and_thirteen_is_ice_class(): void
    {
        $this->seedForms();

        $cargo = FormGroup::query()
            ->where('chapter_no', '8')
            ->whereNull('parent_id')
            ->firstOrFail();

        $ice = FormGroup::query()
            ->where('chapter_no', '13')
            ->whereNull('parent_id')
            ->firstOrFail();

        $tanker = VesselType::query()->where('name', 'Tanker')->firstOrFail();

        $this->assertTrue(FormApplicability::query()
            ->where('form_group_id', $cargo->id)
            ->where('vessel_type_id', $tanker->id)
            ->exists(), 'chapter 8 must be Tanker only');

        $this->assertTrue(FormApplicability::query()
            ->where('form_group_id', $ice->id)
            ->whereNull('vessel_type_id')
            ->where('ice_class_only', true)
            ->exists(), 'chapter 13 must be ice class only');
    }

    public function test_applicability_resolution(): void
    {
        $this->seedForms();

        $cement = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();
        $tanker = VesselType::query()->where('name', 'Tanker')->firstOrFail();

        $cargo = FormGroup::query()->where('chapter_no', '8')->whereNull('parent_id')->firstOrFail();
        $ice = FormGroup::query()->where('chapter_no', '13')->whereNull('parent_id')->firstOrFail();
        $navigation = FormGroup::query()->where('chapter_no', '4')->whereNull('parent_id')->firstOrFail();

        // A cement carrier is not a tanker, so chapter 8 does not apply.
        $this->assertFalse(FormApplicability::appliesToGroup($cargo, [$cement->id], false));
        $this->assertTrue(FormApplicability::appliesToGroup($cargo, [$tanker->id], false));

        // Ice operations need the class notation.
        $this->assertFalse(FormApplicability::appliesToGroup($ice, [$cement->id], false));
        $this->assertTrue(FormApplicability::appliesToGroup($ice, [$cement->id], true));

        // A chapter with no rules always applies.
        $this->assertTrue(FormApplicability::appliesToGroup($navigation, [$cement->id], false));
    }

    public function test_the_seven_b008_evaluation_criteria_are_seeded(): void
    {
        $this->seedForms();

        $form = Form::query()->where('code', 'B-008')->firstOrFail();

        $this->assertCount(7, EvaluationCriterion::query()->where('form_id', $form->id)->get());
    }

    public function test_a_question_using_the_known_input_type_is_typed(): void
    {
        $this->seedForms();

        $typed = FormQuestion::query()->whereNotNull('input_type')->where('input_type', '!=', 'none')->get();

        $this->assertGreaterThan(0, $typed->count(), 'the dotted blank rows should have produced typed inputs');
        $this->assertContains('date', $typed->pluck('input_type')->all());

        foreach ($typed as $question) {
            $this->assertContains($question->input_type, FormQuestion::INPUT_TYPES);
        }
    }

    public function test_guidance_is_stored_in_its_own_column(): void
    {
        $this->seedForms();

        $withGuidance = FormQuestion::query()->whereNotNull('guidance')->get();

        $this->assertGreaterThan(0, $withGuidance->count());

        foreach ($withGuidance as $question) {
            // The guidance text must not also be left sitting in the question.
            $this->assertStringNotContainsString($question->guidance, $question->question_text);
        }

        // A known nested-bracket case: the whole parenthetical must come off as guidance.
        $steering = FormQuestion::query()
            ->where('question_text', 'like', '%STEERING WHEEL%')
            ->firstOrFail();

        $this->assertNotNull($steering->guidance);
        $this->assertStringNotContainsString('Instructions for autopilot', $steering->question_text);
        $this->assertStringContainsString('Instructions for autopilot', $steering->guidance);
    }
}
