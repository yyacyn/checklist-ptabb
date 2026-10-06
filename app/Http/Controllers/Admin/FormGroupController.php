<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Form;
use App\Models\FormApplicability;
use App\Models\FormGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Task 2.1, 2.3, 2.4, 2.5, 2.6: Group & subgroup management.
 */
class FormGroupController extends Controller
{
    /**
     * Store a newly created group or subgroup.
     */
    public function store(Request $request, Form $form): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'chapter_no' => ['nullable', 'string', 'max:8'],
            'parent_id' => ['nullable', 'exists:form_groups,id'],
            'ice_class_only' => ['boolean'],
        ]);

        $parentId = $validated['parent_id'] ?? null;

        DB::transaction(function () use ($form, $validated, $parentId) {
            $nextOrder = (FormGroup::query()
                ->where('form_id', $form->id)
                ->where('parent_id', $parentId)
                ->whereNull('archived_at')
                ->max('sort_order') ?? -1) + 1;

            $group = FormGroup::create([
                'form_id' => $form->id,
                'parent_id' => $parentId,
                'title' => $validated['title'],
                'chapter_no' => $validated['chapter_no'] ?? null,
                'sort_order' => $nextOrder,
                'is_enabled' => true,
                'ice_class_only' => (bool) ($validated['ice_class_only'] ?? false),
            ]);

            ActivityLog::record($group, 'created', 'title', null, $group->title);

            $form->bumpTemplateVersion();
        });

        return back()->with('success', 'Group created successfully.');
    }

    /**
     * Update an existing group.
     */
    public function update(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'chapter_no' => ['nullable', 'string', 'max:8'],
            'ice_class_only' => ['boolean'],
        ]);

        $before = ['title' => $group->title, 'chapter_no' => $group->chapter_no, 'ice_class_only' => $group->ice_class_only];

        $group->update([
            'title' => $validated['title'],
            'chapter_no' => $validated['chapter_no'] ?? null,
            'ice_class_only' => (bool) ($validated['ice_class_only'] ?? false),
        ]);

        ActivityLog::record($group, 'updated', 'attributes', $before, $validated);

        return back()->with('success', 'Group updated successfully.');
    }

    /**
     * Toggle the enabled/disabled status of a group (FM-2).
     */
    public function toggle(FormGroup $group): RedirectResponse
    {
        $before = $group->is_enabled;
        $group->update(['is_enabled' => ! $group->is_enabled]);

        ActivityLog::record($group, 'toggled', 'is_enabled', $before, $group->is_enabled);

        return back()->with('success', $group->is_enabled ? 'Group enabled.' : 'Group disabled.');
    }

    /**
     * Bulk toggle all questions in a group (FM-6).
     */
    public function bulkToggle(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'enable' => ['required', 'boolean'],
        ]);

        $enable = (bool) $validated['enable'];

        DB::transaction(function () use ($group, $enable) {
            $group->update(['is_enabled' => $enable]);
            $group->questions()->whereNull('archived_at')->update(['is_enabled' => $enable]);

            foreach ($group->subgroups as $subgroup) {
                $subgroup->update(['is_enabled' => $enable]);
                $subgroup->questions()->whereNull('archived_at')->update(['is_enabled' => $enable]);
            }

            ActivityLog::record($group, 'bulk_toggled', 'questions_enabled', null, $enable);
            $group->form->bumpTemplateVersion();
        });

        return back()->with('success', $enable ? 'Group and all questions enabled.' : 'Group and all questions disabled.');
    }

    /**
     * Update applicability rules for a group (FM-4).
     */
    public function updateApplicability(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'vessel_type_ids' => ['array'],
            'vessel_type_ids.*' => ['exists:vessel_types,id'],
            'ice_class_only' => ['boolean'],
        ]);

        $vesselTypeIds = $validated['vessel_type_ids'] ?? [];
        $iceClassOnly = (bool) ($validated['ice_class_only'] ?? false);

        DB::transaction(function () use ($group, $vesselTypeIds, $iceClassOnly) {
            $beforeRules = FormApplicability::where('form_group_id', $group->id)->get()->toArray();

            FormApplicability::where('form_group_id', $group->id)->delete();

            $group->update(['ice_class_only' => $iceClassOnly]);

            foreach ($vesselTypeIds as $vtId) {
                FormApplicability::create([
                    'form_group_id' => $group->id,
                    'vessel_type_id' => $vtId,
                    'ice_class_only' => false,
                ]);
            }

            if ($iceClassOnly) {
                FormApplicability::create([
                    'form_group_id' => $group->id,
                    'vessel_type_id' => null,
                    'ice_class_only' => true,
                ]);
            }

            $afterRules = FormApplicability::where('form_group_id', $group->id)->get()->toArray();
            ActivityLog::record($group, 'applicability_updated', 'rules', $beforeRules, $afterRules);

            $group->form->bumpTemplateVersion();
        });

        return back()->with('success', 'Group applicability updated.');
    }

    /**
     * Reorder group up or down among siblings.
     */
    public function reorder(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'direction' => ['required', 'in:up,down'],
        ]);

        $direction = $validated['direction'];

        DB::transaction(function () use ($group, $direction) {
            $siblingQuery = FormGroup::query()
                ->where('form_id', $group->form_id)
                ->where('parent_id', $group->parent_id)
                ->whereNull('archived_at');

            if ($direction === 'up') {
                $target = $siblingQuery
                    ->where('sort_order', '<', $group->sort_order)
                    ->orderByDesc('sort_order')
                    ->first();
            } else {
                $target = $siblingQuery
                    ->where('sort_order', '>', $group->sort_order)
                    ->orderBy('sort_order')
                    ->first();
            }

            if ($target) {
                $tempOrder = $group->sort_order;
                $group->update(['sort_order' => $target->sort_order]);
                $target->update(['sort_order' => $tempOrder]);

                ActivityLog::record($group, 'reordered', 'sort_order', $tempOrder, $group->sort_order);

                $group->form->bumpTemplateVersion();
            }
        });

        return back()->with('success', 'Group reordered.');
    }

    /**
     * Change history for this group (FM-7).
     */
    public function history(FormGroup $group): JsonResponse
    {
        $logs = ActivityLog::query()
            ->where('entity_type', $group->getMorphClass())
            ->where('entity_id', $group->id)
            ->with('user:id,name,role')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($logs);
    }

    /**
     * Archive or delete a group (FM-9).
     * If used in any report, it is archived. If never used, it can be deleted.
     */
    public function destroy(FormGroup $group): RedirectResponse
    {
        $form = $group->form;

        if ($group->isUsedInReports()) {
            $group->update(['archived_at' => now()]);
            ActivityLog::record($group, 'archived', 'archived_at', null, now()->toDateTimeString());
            $message = 'Group archived (kept for historical reports).';
        } else {
            ActivityLog::record($group, 'deleted', 'id', $group->id, null);
            $group->delete();
            $message = 'Group deleted.';
        }

        $form->bumpTemplateVersion();

        return back()->with('success', $message);
    }
}
