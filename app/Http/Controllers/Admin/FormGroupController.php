<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\FormGroup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Task 2.1: Group and subgroup tree management (FM-1, FM-2, FM-9).
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

            FormGroup::create([
                'form_id' => $form->id,
                'parent_id' => $parentId,
                'title' => $validated['title'],
                'chapter_no' => $validated['chapter_no'] ?? null,
                'sort_order' => $nextOrder,
                'is_enabled' => true,
                'ice_class_only' => (bool) ($validated['ice_class_only'] ?? false),
            ]);

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

        $group->update([
            'title' => $validated['title'],
            'chapter_no' => $validated['chapter_no'] ?? null,
            'ice_class_only' => (bool) ($validated['ice_class_only'] ?? false),
        ]);

        return back()->with('success', 'Group updated successfully.');
    }

    /**
     * Toggle the enabled/disabled status of a group (FM-2).
     */
    public function toggle(FormGroup $group): RedirectResponse
    {
        $group->update(['is_enabled' => ! $group->is_enabled]);

        return back()->with('success', $group->is_enabled ? 'Group enabled.' : 'Group disabled.');
    }

    /**
     * Bulk enable or disable all questions within a group (FM-6).
     */
    public function bulkToggle(Request $request, FormGroup $group): RedirectResponse
    {
        $validated = $request->validate([
            'enable' => ['required', 'boolean'],
        ]);

        $enable = (bool) $validated['enable'];

        DB::transaction(function () use ($group, $enable) {
            $group->update(['is_enabled' => $enable]);
            $group->questions()->update(['is_enabled' => $enable]);

            foreach ($group->subgroups as $subgroup) {
                $subgroup->update(['is_enabled' => $enable]);
                $subgroup->questions()->update(['is_enabled' => $enable]);
            }
        });

        return back()->with('success', $enable ? 'All questions in group enabled.' : 'All questions in group disabled.');
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

                $group->form->bumpTemplateVersion();
            }
        });

        return back()->with('success', 'Group reordered.');
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
            $message = 'Group archived (kept for historical reports).';
        } else {
            $group->delete();
            $message = 'Group deleted.';
        }

        $form->bumpTemplateVersion();

        return back()->with('success', $message);
    }
}
