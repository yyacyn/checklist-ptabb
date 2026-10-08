<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Finding;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FindingController extends Controller
{
    /**
     * Store a new observation/finding for the report (Task 4.1, Form D-062 Chapter 15).
     */
    public function store(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'report_group_id' => ['nullable', 'exists:report_groups,id'],
            'chapter_label' => ['nullable', 'string', 'max:255'],
            'finding_kind' => ['nullable', 'string', 'in:observation,non_conformity'],
            'risk' => ['nullable', 'string', 'in:high,medium,low'],
            'severity' => ['nullable', 'string', 'max:50'],
            'description' => ['required', 'string', 'max:5000'],
            'viq_paragraph' => ['nullable', 'string', 'max:50'],
            'job_order_no' => ['nullable', 'string', 'max:50'],
            'target_date' => ['nullable', 'date'],
        ]);

        $maxSortOrder = (int) $report->findings()->max('sort_order');

        $finding = $report->findings()->create([
            'report_group_id' => $validated['report_group_id'] ?? null,
            'chapter_label' => $validated['chapter_label'] ?? null,
            'finding_kind' => $validated['finding_kind'] ?? 'observation',
            'risk' => $validated['risk'] ?? null,
            'severity' => $validated['severity'] ?? null,
            'description' => $validated['description'],
            'viq_paragraph' => $validated['viq_paragraph'] ?? null,
            'job_order_no' => $validated['job_order_no'] ?? null,
            'target_date' => $validated['target_date'] ?? null,
            'finding_status' => 'open',
            'sort_order' => $maxSortOrder + 1,
        ]);

        ActivityLog::record(
            $finding,
            'created',
            'description',
            null,
            $finding->description,
            $report->id
        );

        return response()->json([
            'status' => 'created',
            'finding' => $finding,
        ], 201);
    }

    /**
     * Update an observation/finding (Task 4.1).
     */
    public function update(Request $request, Report $report, Finding $finding): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($finding->report_id !== $report->id) {
            abort(404, 'Finding does not belong to this report.');
        }

        $validated = $request->validate([
            'report_group_id' => ['nullable', 'exists:report_groups,id'],
            'chapter_label' => ['nullable', 'string', 'max:255'],
            'finding_kind' => ['nullable', 'string', 'in:observation,non_conformity'],
            'risk' => ['nullable', 'string', 'in:high,medium,low'],
            'severity' => ['nullable', 'string', 'max:50'],
            'description' => ['required', 'string', 'max:5000'],
            'viq_paragraph' => ['nullable', 'string', 'max:50'],
            'job_order_no' => ['nullable', 'string', 'max:50'],
            'target_date' => ['nullable', 'date'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $before = $finding->only([
            'report_group_id',
            'chapter_label',
            'risk',
            'description',
            'viq_paragraph',
            'job_order_no',
            'target_date',
        ]);

        $finding->update($validated);

        ActivityLog::record(
            $finding,
            'updated',
            'attributes',
            $before,
            $finding->only(array_keys($before)),
            $report->id
        );

        return response()->json([
            'status' => 'updated',
            'finding' => $finding,
        ]);
    }

    /**
     * Delete an observation/finding (Task 4.1).
     */
    public function destroy(Report $report, Finding $finding): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($finding->report_id !== $report->id) {
            abort(404, 'Finding does not belong to this report.');
        }

        $deletedId = $finding->id;
        $description = $finding->description;

        ActivityLog::record(
            $finding,
            'deleted',
            'id',
            $deletedId,
            $description,
            $report->id
        );

        $finding->delete();

        return response()->json([
            'status' => 'deleted',
            'finding_id' => $deletedId,
        ]);
    }
}
