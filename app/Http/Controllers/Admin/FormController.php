<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use App\Models\VesselType;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FormController extends Controller
{
    /**
     * Display a listing of form templates.
     */
    public function index(Request $request): Response
    {
        $forms = Form::query()
            ->withCount([
                'groups' => fn ($q) => $q->whereNull('archived_at'),
                'questions' => fn ($q) => $q->whereNull('form_questions.archived_at'),
            ])
            ->get()
            ->map(fn (Form $form) => [
                'id' => $form->id,
                'code' => $form->code,
                'name' => $form->name,
                'form_version' => $form->form_version,
                'template_version' => $form->template_version,
                'answer_set' => $form->answer_set,
                'groups_count' => $form->groups_count,
                'questions_count' => $form->questions_count,
            ]);

        return Inertia::render('forms/index', [
            'forms' => $forms,
        ]);
    }

    /**
     * Display the full group/question tree editor for a form template (SRS section 4).
     */
    public function show(Request $request, Form $form): Response
    {
        // Get counts of reports using groups/questions to avoid N+1 queries
        $usedGroupIds = ReportGroup::query()
            ->whereNotNull('source_group_id')
            ->selectRaw('source_group_id, count(*) as count')
            ->groupBy('source_group_id')
            ->pluck('count', 'source_group_id')
            ->all();

        $usedQuestionIds = ReportQuestion::query()
            ->whereNotNull('source_question_id')
            ->selectRaw('source_question_id, count(*) as count')
            ->groupBy('source_question_id')
            ->pluck('count', 'source_question_id')
            ->all();

        // Load applicability rules
        $groupApplicabilities = FormApplicability::query()
            ->whereNotNull('form_group_id')
            ->get()
            ->groupBy('form_group_id');

        $questionApplicabilities = FormApplicability::query()
            ->whereNotNull('form_question_id')
            ->get()
            ->groupBy('form_question_id');

        $vesselTypes = VesselType::query()
            ->where('is_active', true)
            ->get(['id', 'name']);

        // Load chapters (top-level groups)
        $chapters = $form->groups()
            ->whereNull('parent_id')
            ->whereNull('archived_at')
            ->with([
                'subgroups' => fn ($q) => $q->whereNull('archived_at')->orderBy('sort_order'),
                'subgroups.questions' => fn ($q) => $q->whereNull('archived_at')->orderBy('sort_order'),
                'questions' => fn ($q) => $q->whereNull('archived_at')->orderBy('sort_order'),
            ])
            ->orderBy('sort_order')
            ->get()
            ->map(function ($chapter) use ($usedGroupIds, $usedQuestionIds, $groupApplicabilities, $questionApplicabilities) {
                $groupRules = $groupApplicabilities->get($chapter->id, collect());

                return [
                    'id' => $chapter->id,
                    'title' => $chapter->title,
                    'chapter_no' => $chapter->chapter_no,
                    'sort_order' => $chapter->sort_order,
                    'is_enabled' => (bool) $chapter->is_enabled,
                    'ice_class_only' => (bool) $chapter->ice_class_only || $groupRules->contains('ice_class_only', true),
                    'vessel_type_ids' => $groupRules->pluck('vessel_type_id')->filter()->values()->all(),
                    'reports_count' => $usedGroupIds[$chapter->id] ?? 0,
                    'questions' => $chapter->questions->map(function ($q) use ($usedQuestionIds, $questionApplicabilities) {
                        $qRules = $questionApplicabilities->get($q->id, collect());

                        return [
                            'id' => $q->id,
                            'group_id' => $q->group_id,
                            'question_text' => $q->question_text,
                            'guidance' => $q->guidance,
                            'input_type' => $q->input_type,
                            'sort_order' => $q->sort_order,
                            'is_enabled' => (bool) $q->is_enabled,
                            'ice_class_only' => $qRules->contains('ice_class_only', true),
                            'vessel_type_ids' => $qRules->pluck('vessel_type_id')->filter()->values()->all(),
                            'reports_count' => $usedQuestionIds[$q->id] ?? 0,
                        ];
                    }),
                    'subgroups' => $chapter->subgroups->map(function ($sub) use ($usedGroupIds, $usedQuestionIds, $groupApplicabilities, $questionApplicabilities) {
                        $subRules = $groupApplicabilities->get($sub->id, collect());

                        return [
                            'id' => $sub->id,
                            'parent_id' => $sub->parent_id,
                            'title' => $sub->title,
                            'chapter_no' => $sub->chapter_no,
                            'sort_order' => $sub->sort_order,
                            'is_enabled' => (bool) $sub->is_enabled,
                            'ice_class_only' => (bool) $sub->ice_class_only || $subRules->contains('ice_class_only', true),
                            'vessel_type_ids' => $subRules->pluck('vessel_type_id')->filter()->values()->all(),
                            'reports_count' => $usedGroupIds[$sub->id] ?? 0,
                            'questions' => $sub->questions->map(function ($q) use ($usedQuestionIds, $questionApplicabilities) {
                                $qRules = $questionApplicabilities->get($q->id, collect());

                                return [
                                    'id' => $q->id,
                                    'group_id' => $q->group_id,
                                    'question_text' => $q->question_text,
                                    'guidance' => $q->guidance,
                                    'input_type' => $q->input_type,
                                    'sort_order' => $q->sort_order,
                                    'is_enabled' => (bool) $q->is_enabled,
                                    'ice_class_only' => $qRules->contains('ice_class_only', true),
                                    'vessel_type_ids' => $qRules->pluck('vessel_type_id')->filter()->values()->all(),
                                    'reports_count' => $usedQuestionIds[$q->id] ?? 0,
                                ];
                            }),
                        ];
                    }),
                ];
            });

        $flatGroups = $form->groups()
            ->whereNull('archived_at')
            ->orderBy('sort_order')
            ->get(['id', 'title', 'chapter_no', 'parent_id']);

        return Inertia::render('forms/show', [
            'form' => [
                'id' => $form->id,
                'code' => $form->code,
                'name' => $form->name,
                'form_version' => $form->form_version,
                'template_version' => $form->template_version,
                'answer_set' => $form->answer_set,
                'summary_schema' => $form->summary_schema,
            ],
            'chapters' => $chapters,
            'all_groups' => $flatGroups,
            'flat_groups' => $flatGroups,
            'vessel_types' => $vesselTypes,
        ]);
    }

    /**
     * Update the form's summary schema (SRS FM-7b, Task 4.1).
     */
    public function updateSummarySchema(Request $request, Form $form)
    {
        $payload = $request->has('summary_schema') && is_array($request->input('summary_schema'))
            ? $request->input('summary_schema')
            : $request->all();

        $validated = \Illuminate\Support\Facades\Validator::make($payload, [
            'enabled' => ['required', 'boolean'],
            'title' => ['required', 'string', 'max:255'],
            'has_ratings_matrix' => ['nullable', 'boolean'],
            'rating_options' => ['nullable', 'array'],
            'rating_options.*.value' => ['required_with:rating_options', 'string'],
            'rating_options.*.label' => ['required_with:rating_options', 'string'],
            'rating_options.*.color' => ['nullable', 'string'],
            'text_fields' => ['nullable', 'array'],
            'text_fields.*.key' => ['required_with:text_fields', 'string'],
            'text_fields.*.label' => ['required_with:text_fields', 'string'],
            'text_fields.*.placeholder' => ['nullable', 'string'],
            'text_fields.*.rows' => ['nullable', 'integer', 'min:1', 'max:12'],
            'text_fields.*.span' => ['nullable', 'string', 'in:full,half'],
            'text_fields.*.description' => ['nullable', 'string'],
            'has_findings_register' => ['nullable', 'boolean'],
        ])->validate();

        $form->update([
            'summary_schema' => $validated,
        ]);

        $form->bumpTemplateVersion();

        if ($request->wantsJson()) {
            return response()->json([
                'status' => 'saved',
                'summary_schema' => $form->summary_schema,
                'template_version' => $form->template_version,
            ]);
        }

        return back()->with('success', 'Summary chapter settings updated successfully.');
    }
}
