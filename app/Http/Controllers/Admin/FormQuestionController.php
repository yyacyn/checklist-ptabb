<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use App\Models\FormQuestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Task 2.2, 2.3, 2.4, 2.5, 2.6: Question editor & bulk actions.
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
            'input_type' => [
                'required',
                'string',
                'max:255',
                function ($attribute, $value, $fail) {
                    $tokens = array_filter(array_map('trim', explode(',', $value)));
                    $allowed = ['none', 'choices', 'no_choices', 'text', 'date', 'number', 'file', 'text_only', 'date_only', 'number_only', 'file_only'];
                    foreach ($tokens as $token) {
                        if (! in_array($token, $allowed, true)) {
                            $fail("Invalid input type token: {$token}");
                        }
                    }
                },
            ],
        ]);

        DB::transaction(function () use ($group, $validated) {
            $nextOrder = (FormQuestion::query()
                ->where('group_id', $group->id)
                ->whereNull('archived_at')
                ->max('sort_order') ?? -1) + 1;

            $question = FormQuestion::create([
                'group_id' => $group->id,
                'question_text' => $validated['question_text'],
                'guidance' => $validated['guidance'] ?? null,
                'input_type' => $validated['input_type'],
                'sort_order' => $nextOrder,
                'is_enabled' => true,
            ]);

            ActivityLog::record($question, 'created', 'question_text', null, $question->question_text);

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
            'input_type' => [
                'required',
                'string',
                'max:255',
                function ($attribute, $value, $fail) {
                    $tokens = array_filter(array_map('trim', explode(',', $value)));
                    $allowed = ['none', 'choices', 'no_choices', 'text', 'date', 'number', 'file', 'text_only', 'date_only', 'number_only', 'file_only'];
                    foreach ($tokens as $token) {
                        if (! in_array($token, $allowed, true)) {
                            $fail("Invalid input type token: {$token}");
                        }
                    }
                },
            ],
        ]);

        $before = [
            'question_text' => $question->question_text,
            'guidance' => $question->guidance,
            'input_type' => $question->input_type,
        ];

        $question->update([
            'question_text' => $validated['question_text'],
            'guidance' => $validated['guidance'] ?? null,
            'input_type' => $validated['input_type'],
        ]);

        ActivityLog::record($question, 'updated', 'text_fields', $before, $validated);

        return back()->with('success', 'Question updated.');
    }

    /**
     * Toggle the enabled/disabled status of a question (FM-2).
     */
    public function toggle(FormQuestion $question): RedirectResponse
    {
        $before = $question->is_enabled;
        $question->update(['is_enabled' => ! $question->is_enabled]);

        ActivityLog::record($question, 'toggled', 'is_enabled', $before, $question->is_enabled);

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

            $copy = FormQuestion::create([
                'group_id' => $question->group_id,
                'question_text' => $question->question_text.' (Copy)',
                'guidance' => $question->guidance,
                'input_type' => $question->input_type,
                'sort_order' => $question->sort_order + 1,
                'is_enabled' => true,
            ]);

            ActivityLog::record($copy, 'duplicated', 'source_question_id', $question->id, $copy->id);

            $question->group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Question duplicated.');
    }

    /**
     * Move questions between groups (Task 2.3, FM-6).
     */
    public function bulkMove(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'question_ids' => ['required', 'array', 'min:1'],
            'question_ids.*' => ['exists:form_questions,id'],
            'target_group_id' => ['required', 'exists:form_groups,id'],
        ]);

        $targetGroup = FormGroup::findOrFail($validated['target_group_id']);
        $questionIds = $validated['question_ids'];

        DB::transaction(function () use ($targetGroup, $questionIds) {
            $maxOrder = (FormQuestion::query()
                ->where('group_id', $targetGroup->id)
                ->whereNull('archived_at')
                ->max('sort_order') ?? -1);

            $questions = FormQuestion::whereIn('id', $questionIds)->get();

            foreach ($questions as $question) {
                $oldGroupId = $question->group_id;
                $maxOrder++;

                $question->update([
                    'group_id' => $targetGroup->id,
                    'sort_order' => $maxOrder,
                ]);

                ActivityLog::record($question, 'moved', 'group_id', $oldGroupId, $targetGroup->id);
            }

            $targetGroup->form->bumpTemplateVersion();
        });

        return back()->with('success', sprintf('Moved %d question(s) to %s.', count($questionIds), $targetGroup->title));
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
            $beforeRules = FormApplicability::where('form_question_id', $question->id)->get()->toArray();

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

            $afterRules = FormApplicability::where('form_question_id', $question->id)->get()->toArray();
            ActivityLog::record($question, 'applicability_updated', 'rules', $beforeRules, $afterRules);

            $question->group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Question applicability updated.');
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

                ActivityLog::record($question, 'reordered', 'sort_order', $tempOrder, $question->sort_order);

                $question->group->form->bumpTemplateVersion();
            }
        });

        return back()->with('success', 'Question reordered.');
    }

    /**
     * Change history for this question (FM-7).
     */
    public function history(FormQuestion $question): JsonResponse
    {
        $logs = ActivityLog::query()
            ->where('entity_type', $question->getMorphClass())
            ->where('entity_id', $question->id)
            ->with('user:id,name,role')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($logs);
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
            ActivityLog::record($question, 'archived', 'archived_at', null, now()->toDateTimeString());
            $message = 'Question archived (kept for historical reports).';
        } else {
            ActivityLog::record($question, 'deleted', 'id', $question->id, null);
            $question->delete();
            $message = 'Question deleted.';
        }

        $form->bumpTemplateVersion();

        return back()->with('success', $message);
    }
}
