<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\User;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 1 tasks 1.3 - 1.6:
 * - forms.template_version bump rule (Task 1.3)
 * - Report and snapshot tables (Task 1.4)
 * - ReportSnapshot service (Task 1.5)
 * - The Critical Immutability Test (Task 1.6, SRS FM-8, FM-9, FM-12)
 */
class ReportSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private function seedCatalogue(): void
    {
        $this->seed(FormSeeder::class);
    }

    public function test_template_version_bump_rule(): void
    {
        $this->seedCatalogue();

        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $this->assertSame(1, $form->template_version);

        $newVersion = $form->bumpTemplateVersion();

        $this->assertSame(2, $newVersion);
        $this->assertSame(2, $form->fresh()->template_version);
    }

    public function test_report_snapshot_copies_all_questions_and_groups_for_d062(): void
    {
        $this->seedCatalogue();

        $user = User::factory()->create(['role' => 'corporate']);
        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MV Oceanic Pioneer',
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-06',
            'status' => 'draft',
        ]);

        $this->assertInstanceOf(Report::class, $report);
        $this->assertSame('inspection', $report->report_type);
        $this->assertSame(1, $report->template_version);
        $this->assertSame('MV Oceanic Pioneer', $report->vessel_name);

        // All 647 questions from chapters 1 to 13 must be copied
        $this->assertSame(647, $report->questions()->count());

        // Subgroups must link to their parent report group
        $subgroups = $report->groups()->whereNotNull('parent_id')->get();
        $this->assertGreaterThan(0, $subgroups->count());
        foreach ($subgroups as $subgroup) {
            $this->assertNotNull($subgroup->parent);
            $this->assertSame($report->id, $subgroup->parent->report_id);
        }

        // Top-level groups exist with empty comments box ready (FM-7a)
        $topLevel = $report->topLevelGroups()->get();
        $this->assertCount(13, $topLevel); // Chapters 1 to 13
        foreach ($topLevel as $group) {
            $this->assertNull($group->comments);
        }
    }

    public function test_report_snapshot_copies_all_questions_and_sections_for_b008(): void
    {
        $this->seedCatalogue();

        $user = User::factory()->create(['role' => 'vessel', 'vessel_name' => 'MV Cement Star']);
        $form = Form::query()->where('code', 'B-008')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MV Cement Star',
            'report_date' => '2026-10-06',
        ]);

        $this->assertSame('audit', $report->report_type);
        $this->assertSame(428, $report->questions()->count());
        $this->assertSame(17, $report->topLevelGroups()->count());
    }

    public function test_applicability_is_resolved_and_locked_to_na_with_reason(): void
    {
        $this->seedCatalogue();

        $user = User::factory()->create(['role' => 'corporate']);
        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $cement = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();

        $snapshotService = new ReportSnapshot;

        // 1. Non-tanker, non-ice class report
        $report = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MV Cement Carrier',
            'vessel_type_id' => $cement->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-06',
        ]);

        // Chapter 8 (Cargo & Ballast - Tanker only) must be marked not applicable
        $chapter8 = $report->groups()->where('chapter_no', '8')->whereNull('parent_id')->firstOrFail();
        $this->assertFalse($chapter8->is_applicable);
        $this->assertStringContainsString('Tanker only', (string) $chapter8->na_reason);

        // All questions inside Chapter 8 (including in its subgroups) must also be marked not applicable
        $ch8GroupIds = $report->groups()->where(fn ($q) => $q->where('id', $chapter8->id)->orWhere('parent_id', $chapter8->id))->pluck('id');
        $ch8Questions = $report->questions()->whereIn('report_group_id', $ch8GroupIds)->get();
        $this->assertGreaterThan(0, $ch8Questions->count());
        foreach ($ch8Questions as $q) {
            $this->assertFalse($q->is_applicable);
            $this->assertStringContainsString('Tanker only', (string) $q->applicable_reason);
        }

        // Chapter 13 (Ice Operations) must be not applicable
        $chapter13 = $report->groups()->where('chapter_no', '13')->whereNull('parent_id')->firstOrFail();
        $this->assertFalse($chapter13->is_applicable);
        $this->assertStringContainsString('Ice class only', (string) $chapter13->na_reason);

        // Chapter 4 (Navigation) has no restrictions, so it must apply
        $chapter4 = $report->groups()->where('chapter_no', '4')->whereNull('parent_id')->firstOrFail();
        $this->assertTrue($chapter4->is_applicable);
        $this->assertNull($chapter4->na_reason);

        // 2. Tanker with Ice class notation
        $tanker = VesselType::query()->where('name', 'Tanker')->firstOrFail();
        $tankerReport = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MT Polar Tanker',
            'vessel_type_id' => $tanker->id,
            'vessel_ice_class' => true,
            'report_date' => '2026-10-06',
        ]);

        $tankerCh8 = $tankerReport->groups()->where('chapter_no', '8')->whereNull('parent_id')->firstOrFail();
        $this->assertTrue($tankerCh8->is_applicable);

        $tankerCh13 = $tankerReport->groups()->where('chapter_no', '13')->whereNull('parent_id')->firstOrFail();
        $this->assertTrue($tankerCh13->is_applicable);
    }

    /**
     * THE CRITICAL TEST (PLAN task 1.6, SRS FM-8, FM-9).
     *
     * Edit, disable, archive, reorder questions and groups in the live template,
     * add new questions, bump the template version.
     * Assert that the existing report's groups, questions, texts, sort orders,
     * and applicability remain 100% byte-identical afterwards.
     */
    public function test_the_critical_immutability_test(): void
    {
        $this->seedCatalogue();

        $user = User::factory()->create(['role' => 'corporate']);
        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MV Benchmark Alpha',
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-06',
        ]);

        // Capture full serialized state of all groups and questions
        $extractSnapshot = function (Report $r): array {
            return $r->groups()
                ->with(['questions' => fn ($q) => $q->orderBy('sort_order')])
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($g) => [
                    'title' => $g->title,
                    'chapter_no' => $g->chapter_no,
                    'sort_order' => $g->sort_order,
                    'is_applicable' => $g->is_applicable,
                    'na_reason' => $g->na_reason,
                    'questions' => $g->questions->map(fn ($q) => [
                        'text' => $q->question_text,
                        'guidance' => $q->guidance,
                        'input_type' => $q->input_type,
                        'sort_order' => $q->sort_order,
                        'is_applicable' => $q->is_applicable,
                        'applicable_reason' => $q->applicable_reason,
                    ])->all(),
                ])
                ->all();
        };

        $snapshotBefore = $extractSnapshot($report);
        $totalQuestionsBefore = $report->questions()->count();

        // --- PERFORM DESTRUCTIVE ACTIONS ON THE LIVE TEMPLATE ---

        // 1. Edit text and guidance of a template question
        $navQuestion = FormQuestion::query()
            ->whereHas('group', fn ($g) => $g->where('chapter_no', '4'))
            ->firstOrFail();
        $originalNavText = $navQuestion->question_text;
        $navQuestion->update([
            'question_text' => 'COMPLETELY ALTERED QUESTION TEXT THAT MUST NOT LEAK INTO OLD REPORT',
            'guidance' => 'ALTERED GUIDANCE TEXT',
        ]);

        // 2. Disable an active question
        $disabledQuestion = FormQuestion::query()
            ->where('id', '!=', $navQuestion->id)
            ->firstOrFail();
        $disabledQuestion->update(['is_enabled' => false]);

        // 3. Archive an active question
        $archivedQuestion = FormQuestion::query()
            ->whereNotIn('id', [$navQuestion->id, $disabledQuestion->id])
            ->firstOrFail();
        $archivedQuestion->update(['archived_at' => now()]);

        // 4. Invert sort orders in a group
        $questionsInNav = FormQuestion::query()->where('group_id', $navQuestion->group_id)->get();
        foreach ($questionsInNav as $idx => $q) {
            $q->update(['sort_order' => 9999 - $idx]);
        }

        // 5. Disable an entire chapter
        $chapter5 = FormGroup::query()->where('chapter_no', '5')->whereNull('parent_id')->firstOrFail();
        $chapter5->update(['is_enabled' => false, 'title' => 'DISABLED CHAPTER 5']);

        // 6. Rename a chapter
        $chapter4 = FormGroup::query()->where('chapter_no', '4')->whereNull('parent_id')->firstOrFail();
        $chapter4->update(['title' => 'BRAND NEW CHAPTER 4 TITLE']);

        // 7. Add a brand new question to the template
        FormQuestion::create([
            'group_id' => $chapter4->id,
            'question_text' => 'A BRAND NEW QUESTION ADDED TO V2',
            'sort_order' => 10000,
            'is_enabled' => true,
        ]);

        // 8. Bump the template version (structural change)
        $form->bumpTemplateVersion();

        // --- ASSERT EXISTING REPORT IS COMPLETELY UNTOUCHED ---

        $snapshotAfter = $extractSnapshot($report->fresh());

        // Byte-for-byte identical comparison
        $this->assertSame($snapshotBefore, $snapshotAfter, 'Existing report changed after template edits!');
        $this->assertSame($totalQuestionsBefore, $report->fresh()->questions()->count());
        $this->assertSame(1, $report->fresh()->template_version);

        // Verify specific question text in existing report did NOT change to altered text
        $this->assertDatabaseMissing('report_questions', [
            'report_id' => $report->id,
            'question_text' => 'COMPLETELY ALTERED QUESTION TEXT THAT MUST NOT LEAK INTO OLD REPORT',
        ]);
        $this->assertDatabaseHas('report_questions', [
            'report_id' => $report->id,
            'question_text' => $originalNavText,
        ]);

        // --- ASSERT A NEW REPORT TAKES THE UPDATED TEMPLATE ---

        $newReport = $snapshotService->createReport($form->fresh(), [
            'created_by' => $user->id,
            'vessel_name' => 'MV Benchmark Beta',
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-07',
        ]);

        $this->assertSame(2, $newReport->template_version);

        // New report has the altered text
        $this->assertDatabaseHas('report_questions', [
            'report_id' => $newReport->id,
            'question_text' => 'COMPLETELY ALTERED QUESTION TEXT THAT MUST NOT LEAK INTO OLD REPORT',
        ]);

        // New report has the brand new question
        $this->assertDatabaseHas('report_questions', [
            'report_id' => $newReport->id,
            'question_text' => 'A BRAND NEW QUESTION ADDED TO V2',
        ]);

        // New report does NOT include the disabled chapter 5
        $this->assertDatabaseMissing('report_groups', [
            'report_id' => $newReport->id,
            'chapter_no' => '5',
        ]);

        // New report does NOT include the disabled or archived questions
        $this->assertDatabaseMissing('report_questions', [
            'report_id' => $newReport->id,
            'source_question_id' => $disabledQuestion->id,
        ]);
        $this->assertDatabaseMissing('report_questions', [
            'report_id' => $newReport->id,
            'source_question_id' => $archivedQuestion->id,
        ]);
    }

    public function test_answers_carry_client_save_id_and_row_version(): void
    {
        $this->seedCatalogue();

        $user = User::factory()->create();
        $form = Form::query()->where('code', 'D-062')->firstOrFail();
        $vesselType = VesselType::query()->where('name', 'Cement Carrier')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($form, [
            'created_by' => $user->id,
            'vessel_name' => 'MV Test Vessel',
            'vessel_type_id' => $vesselType->id,
            'report_date' => '2026-10-06',
        ]);

        $firstQuestion = $report->questions()->firstOrFail();
        $clientSaveId = Str::uuid()->toString();

        $answer = ReportAnswer::create([
            'report_question_id' => $firstQuestion->id,
            'report_id' => $report->id,
            'answer' => 'yes',
            'note' => 'Inspected and verified in order',
            'answered_by' => $user->id,
            'answered_at' => now(),
            'client_save_id' => $clientSaveId,
            'row_version' => 1,
        ]);

        $this->assertInstanceOf(ReportAnswer::class, $answer);
        $this->assertSame('yes', $firstQuestion->fresh()->answer->answer);
        $this->assertSame($clientSaveId, $answer->client_save_id);
        $this->assertSame(1, $answer->row_version);
    }
}
