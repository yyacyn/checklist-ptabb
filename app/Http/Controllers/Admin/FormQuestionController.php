<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Task 2.2: Question editor (FM-1, FM-3, FM-6, FM-9).
 */
class FormQuestionController extends Controller
{
    /**
     * Store a newly created question in a group.
     */
    public function store(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'question_text' => ['required', 'string'],
            'guidance' => ['nullable', 'string'],
            'input_type' => ['required', 'in:none,date,text,number'],
        ]);

        DB::transaction(function () use ($group, $validated) {
            $nextOrder = (FormQuestion::query()
                ->where('group_id', $group->id)
                ->whereNull('archived_at')
                ->max('sort_order') ?? -1) + 1;

            FormQuestion::create([
                'group_id' => $group->id,
                'question_text' => $validated['question_text'],
                'guidance' => $validated['guidance'] ?? null,
                'input_type' => $validated['input_type'],
                'sort_order' => $nextOrder,
                'is_enabled' => true,
            ]);

            $group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Question created.');
    }

    /**
     * Update an existing question.
     * Note: wording edits do NOT bump template_version (SRS FM-12, PLAN 1.3).
     */
    public function update(Request $request, FormQuestion $question): RedirectResponse
    {
        $validated = $request->validate([
            'question_text' => ['required', 'string'],
            'guidance' => ['nullable', 'string'],
            'input_type' => ['required', 'in:none,date,text,number'],
        ]);

        $question->update([
            'question_text' => $validated['question_text'],
            'guidance' => $validated['guidance'] ?? null,
            'input_type' => $validated['input_type'],
        ]);

        return back()->with('success', 'Question updated.');
    }

    /**
     * Toggle the enabled/disabled status of a question (FM-2).
     */
    public function toggle(FormQuestion $question): RedirectResponse
    {
        $question->update(['is_enabled' => ! $question->is_enabled]);

        return back()->with('success', $question->is_enabled ? 'Question enabled.' : 'Question disabled.');
    }

    /**
     * Duplicate a question within the same group (FM-6).
     */
    public function duplicate(FormQuestion $question): RedirectResponse
    {
        DB::transaction(function () use ($question) {
            // Shift subsequent questions
            FormQuestion::query()
                ->where('group_id', $question->group_id)
                ->where('sort_order', '>', $question->sort_order)
                ->increment('sort_order');

            FormQuestion::create([
                'group_id' => $question->group_id,
                'question_text' => $question->question_text.' (Copy)',
                'guidance' => $question->guidance,
                'input_type' => $question->input_type,
                'sort_order' => $question->sort_order + 1,
                'is_enabled' => true,
            ]);

            $question->group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Question duplicated.');
    }

    /**
     * Reorder question up or down within its group.
     */
    public function reorder(Request $request, FormQuestion $question): RedirectResponse
    {
        $validated = $request->validate([
            'direction' => ['required', 'in:up,down'],
        ]);

        $direction = $validated['direction'];

        DB::transaction(function () use ($question, $direction) {
            $siblingQuery = FormQuestion::query()
                ->where('group_id', $question->group_id)
                ->whereNull('archived_at');

            if ($direction === 'up') {
                $target = $siblingQuery
                    ->where('sort_order', '<', $question->sort_order)
                    ->orderByDesc('sort_order')
                    ->first();
            } else {
                $target = $siblingQuery
                    ->where('sort_order', '>', $question->sort_order)
                    ->orderBy('sort_order')
                    ->first();
            }

            if ($target) {
                $tempOrder = $question->sort_order;
                $question->update(['sort_order' => $target->sort_order]);
                $target->update(['sort_order' => $tempOrder]);

                $question->group->form->bumpTemplateVersion();
            }
        });

        return back()->with('success', 'Question reordered.');
    }

    /**
     * Bulk move selected questions to a target group (FM-6).
     */
    public function bulkMove(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'question_ids' => ['required', 'array', 'min:1'],
            'question_ids.*' => ['integer', 'exists:form_questions,id'],
            'target_group_id' => ['required', 'integer', 'exists:form_groups,id'],
        ]);

        $targetGroup = FormGroup::with('form')->findOrFail($validated['target_group_id']);

        DB::transaction(function () use ($validated, $targetGroup) {
            $maxOrder = (int) $targetGroup->questions()->max('sort_order');
            $questions = FormQuestion::whereIn('id', $validated['question_ids'])->get();

            foreach ($questions as $question) {
                $maxOrder++;
                $question->update([
                    'group_id' => $targetGroup->id,
                    'sort_order' => $maxOrder,
                ]);
            }

            // Structural change bumps template_version
            $targetGroup->form->bumpTemplateVersion();
        });

        return back()->with('success', count($validated['question_ids']).' question(s) moved to '.$targetGroup->title);
    }

    /**
     * Update applicability rules for a question (FM-4).
     */
    public function updateApplicability(Request $request, FormQuestion $question): RedirectResponse
    {
        $validated = $request->validate([
            'vessel_type_ids' => ['array'],
            'vessel_type_ids.*' => ['exists:vessel_types,id'],
            'ice_class_only' => ['boolean'],
        ]);

        $vesselTypeIds = $validated['vessel_type_ids'] ?? [];
        $iceClassOnly = (bool) ($validated['ice_class_only'] ?? false);

        DB::transaction(function () use ($question, $vesselTypeIds, $iceClassOnly) {
            FormApplicability::where('form_question_id', $question->id)->delete();

            foreach ($vesselTypeIds as $vtId) {
                FormApplicability::create([
                    'form_question_id' => $question->id,
                    'vessel_type_id' => $vtId,
                    'ice_class_only' => false,
                ]);
            }

            if ($iceClassOnly) {
                FormApplicability::create([
                    'form_question_id' => $question->id,
                    'vessel_type_id' => null,
                    'ice_class_only' => true,
                ]);
            }

            $question->group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Question applicability updated.');
    }

    /**
     * Archive or delete a question (FM-9).
     * If used in any report, it is archived. If never used, it can be deleted.
     */
    public function destroy(FormQuestion $question): RedirectResponse
    {
        $form = $question->group->form;

        if ($question->isUsedInReports()) {
            $question->update(['archived_at' => now()]);
            $message = 'Question archived (kept for historical reports).';
        } else {
            $question->delete();
            $message = 'Question deleted.';
        }

        $form->bumpTemplateVersion();

        return back()->with('success', $message);
    }
}
