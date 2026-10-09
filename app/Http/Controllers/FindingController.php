<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Finding;
use App\Models\Form;
use App\Models\Report;
use App\Services\VesselName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class FindingController extends Controller
{
    /**
     * Display a listing of findings/observations across reports, scoped by user role (FND-2).
     */
    public function index(Request $request): InertiaResponse
    {
        $user = $request->user();

        $query = Finding::query()
            ->with([
                'report' => function ($q) {
                    $q->select('id', 'reference_number', 'vessel_name', 'report_date', 'form_id', 'status')
                        ->with('form:id,code,name');
                },
            ])
            ->orderByDesc('id');

        // Scoping by role (FND-2, SRS §2.1)
        if ($user->role === 'vessel') {
            $normalizedVessel = VesselName::normalize($user->vessel_name);
            $query->whereHas('report', function ($q) use ($normalizedVessel) {
                $q->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower($normalizedVessel)]);
            });
        } elseif ($request->filled('vessel_name')) {
            $vesselFilter = VesselName::normalize($request->input('vessel_name'));
            $query->whereHas('report', function ($q) use ($vesselFilter) {
                $q->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower($vesselFilter)]);
            });
        }

        // Search across description, VIQ, Job order, Chapter, Reference number, Vessel
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('chapter_label', 'like', "%{$search}%")
                    ->orWhere('viq_paragraph', 'like', "%{$search}%")
                    ->orWhere('job_order_no', 'like', "%{$search}%")
                    ->orWhereHas('report', function ($rq) use ($search) {
                        $rq->where('reference_number', 'like', "%{$search}%")
                            ->orWhere('vessel_name', 'like', "%{$search}%");
                    });
            });
        }

        // Filter: Risk level
        if ($request->filled('risk') && in_array($request->input('risk'), ['high', 'medium', 'low'])) {
            $query->where('risk', $request->input('risk'));
        }

        // Filter: Finding Status (open, action_submitted, verified, closed)
        if ($request->filled('finding_status') && in_array($request->input('finding_status'), ['open', 'action_submitted', 'verified', 'closed'])) {
            $query->where('finding_status', $request->input('finding_status'));
        }

        // Filter: Finding Kind (observation, non_conformity)
        if ($request->filled('finding_kind') && in_array($request->input('finding_kind'), ['observation', 'non_conformity'])) {
            $query->where('finding_kind', $request->input('finding_kind'));
        }

        // Filter: Form Code (e.g. D-062, B-008)
        if ($request->filled('form_code')) {
            $formCode = $request->input('form_code');
            $query->whereHas('report.form', function ($fq) use ($formCode) {
                $fq->where('code', $formCode);
            });
        }

        // Filter: Date range based on report date
        if ($request->filled('date_from')) {
            $query->whereHas('report', function ($rq) use ($request) {
                $rq->whereDate('report_date', '>=', $request->input('date_from'));
            });
        }
        if ($request->filled('date_to')) {
            $query->whereHas('report', function ($rq) use ($request) {
                $rq->whereDate('report_date', '<=', $request->input('date_to'));
            });
        }

        // High-level overview stats based on base user scope
        $baseScopedQuery = Finding::query();
        if ($user->role === 'vessel') {
            $normalizedVessel = VesselName::normalize($user->vessel_name);
            $baseScopedQuery->whereHas('report', fn ($q) => $q->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower($normalizedVessel)]));
        }
        $stats = [
            'total' => (clone $baseScopedQuery)->count(),
            'open' => (clone $baseScopedQuery)->where('finding_status', 'open')->count(),
            'high_risk' => (clone $baseScopedQuery)->where('risk', 'high')->count(),
            'medium_risk' => (clone $baseScopedQuery)->where('risk', 'medium')->count(),
            'low_risk' => (clone $baseScopedQuery)->where('risk', 'low')->count(),
        ];

        // Available vessel filter list
        $knownVessels = $user->role === 'vessel'
            ? [VesselName::normalize($user->vessel_name)]
            : Report::query()->select('vessel_name')->distinct()->whereNotNull('vessel_name')->orderBy('vessel_name')->pluck('vessel_name')->all();

        $formCodes = Form::query()->select('code', 'name')->orderBy('code')->get();

        $findings = $query->paginate(20)->withQueryString()->through(fn (Finding $finding) => [
            'id' => $finding->id,
            'report_id' => $finding->report_id,
            'report_reference' => $finding->report?->reference_number,
            'report_status' => $finding->report?->status,
            'report_date' => $finding->report?->report_date?->toDateString(),
            'vessel_name' => $finding->report?->vessel_name,
            'form_code' => $finding->report?->form?->code,
            'form_name' => $finding->report?->form?->name,
            'chapter_label' => $finding->chapter_label,
            'finding_kind' => $finding->finding_kind,
            'risk' => $finding->risk,
            'severity' => $finding->severity,
            'description' => $finding->description,
            'viq_paragraph' => $finding->viq_paragraph,
            'job_order_no' => $finding->job_order_no,
            'target_date' => $finding->target_date?->toDateString(),
            'finding_status' => $finding->finding_status,
            'created_at' => $finding->created_at?->toIso8601String(),
        ]);

        return Inertia::render('findings/index', [
            'findings' => $findings,
            'stats' => $stats,
            'known_vessels' => $knownVessels,
            'form_codes' => $formCodes,
            'filters' => [
                'search' => $request->input('search', ''),
                'vessel_name' => $request->input('vessel_name', ''),
                'risk' => $request->input('risk', ''),
                'finding_status' => $request->input('finding_status', ''),
                'finding_kind' => $request->input('finding_kind', ''),
                'form_code' => $request->input('form_code', ''),
                'date_from' => $request->input('date_from', ''),
                'date_to' => $request->input('date_to', ''),
            ],
            'user_role' => $user->role,
        ]);
    }
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
