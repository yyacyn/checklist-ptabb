<?php

namespace App\Http\Controllers;

use App\Enums\ReportStatus;
use App\Models\ActivityLog;
use App\Models\Form;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use App\Models\User;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use App\Services\VesselName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    /**
     * Display a listing of reports scoped by user role & permissions.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $query = Report::query()
            ->with(['form:id,code,name', 'vesselType:id,name'])
            ->orderByDesc('report_date')
            ->orderByDesc('id');

        // Scoping by role (SRS §2, PLAN 1.10)
        if ($user->role === 'vessel') {
            $query->where('report_type', 'audit')
                ->where('vessel_name', VesselName::normalize($user->vessel_name));
        }

        $reports = $query->paginate(15)->through(fn (Report $report) => [
            'id' => $report->id,
            'report_type' => $report->report_type,
            'reference_number' => $report->reference_number,
            'status' => $report->status,
            'vessel_name' => $report->vessel_name,
            'vessel_imo' => $report->vessel_imo,
            'vessel_type' => $report->vesselType?->name,
            'report_date' => $report->report_date->toDateString(),
            'form_code' => $report->form->code,
            'form_name' => $report->form->name,
            'created_at' => $report->created_at->toIso8601String(),
            'can_delete' => Gate::allows('delete', $report),
        ]);

        return Inertia::render('reports/index', [
            'reports' => $reports,
        ]);
    }

    /**
     * Show the form for creating a new inspection or audit report (Task 3.1).
     */
    public function create(Request $request): Response
    {
        $user = $request->user();

        // Check if user is allowed to create reports
        $canCreateInspection = Gate::allows('create', [Report::class, 'inspection']);
        $canCreateAudit = Gate::allows('create', [Report::class, 'audit']);

        if (! $canCreateInspection && ! $canCreateAudit) {
            abort(403, 'You do not have permission to create reports.');
        }

        $forms = Form::query()
            ->whereIn('code', ['D-062', 'B-008'])
            ->get(['id', 'code', 'name', 'template_version', 'form_version'])
            ->filter(function (Form $form) use ($canCreateInspection, $canCreateAudit) {
                if ($form->code === 'D-062') {
                    return $canCreateInspection;
                }
                if ($form->code === 'B-008') {
                    return $canCreateAudit;
                }

                return false;
            })
            ->values();

        $vesselTypes = VesselType::query()
            ->where('is_active', true)
            ->get(['id', 'name']);

        $knownVessels = VesselName::knownNames();

        return Inertia::render('reports/create', [
            'forms' => $forms,
            'vessel_types' => $vesselTypes,
            'known_vessels' => $knownVessels,
            'default_vessel_name' => $user->role === 'vessel' ? ($user->vessel_name ?? '') : '',
            'default_inspector_name' => $user->name,
        ]);
    }

    /**
     * Store a newly created report and take an immutable snapshot (Task 3.1, SRS INS-1, AUD-1, FM-8).
     */
    public function store(Request $request, ReportSnapshot $snapshot): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'form_id' => ['required', 'exists:forms,id'],
            'vessel_name' => ['required', 'string', 'max:255'],
            'vessel_imo' => ['required', 'string', 'max:20'],
            'vessel_flag' => ['required', 'string', 'max:100'],
            'vessel_gt' => ['required', 'numeric', 'min:0'],
            'vessel_built' => ['required', 'integer', 'min:1900', 'max:'.(date('Y') + 1)],
            'vessel_type_id' => ['required', 'exists:vessel_types,id'],
            'vessel_ice_class' => ['boolean'],
            'report_date' => ['required', 'date'],
            'master_name' => ['nullable', 'string', 'max:255'],
            'chief_engineer_name' => ['nullable', 'string', 'max:255'],
            'chief_officer_name' => ['nullable', 'string', 'max:255'],
            'inspected_by' => ['nullable', 'string', 'max:255'],
            'port' => ['nullable', 'string', 'max:255'],
            'sailing_with_vessel' => ['nullable', 'boolean'],
            'sailing_from' => ['nullable', 'string', 'max:255'],
            'sailing_to' => ['nullable', 'string', 'max:255'],
            'psc_last_port' => ['nullable', 'string', 'max:255'],
            'psc_last_date' => ['nullable', 'date'],
            'psc_detained_or_deficiencies' => ['nullable', 'boolean'],
            'drydock_last_date' => ['nullable', 'date'],
            'drydock_next_date' => ['nullable', 'date'],
            'operations' => ['nullable', 'array'],
            'operations.*' => ['string', 'max:100'],
        ]);

        $form = Form::findOrFail($validated['form_id']);
        $reportType = $form->code === 'D-062' ? 'inspection' : 'audit';

        // Authorize creation for this specific type
        Gate::authorize('create', [Report::class, $reportType]);

        // If vessel user, force their assigned vessel name (SRS §2)
        if ($user->role === 'vessel') {
            $validated['vessel_name'] = $user->vessel_name;
        }

        // Clean & normalise nullable fields from empty strings to null
        $nullableFields = [
            'vessel_imo',
            'vessel_flag',
            'vessel_gt',
            'vessel_built',
            'vessel_type_id',
            'master_name',
            'chief_engineer_name',
            'chief_officer_name',
            'inspected_by',
            'port',
            'sailing_from',
            'sailing_to',
            'psc_last_port',
            'psc_last_date',
            'drydock_last_date',
            'drydock_next_date',
        ];
        foreach ($nullableFields as $field) {
            if (array_key_exists($field, $validated) && (is_null($validated[$field]) || trim((string) $validated[$field]) === '')) {
                $validated[$field] = null;
            }
        }

        if (array_key_exists('sailing_with_vessel', $validated)) {
            $validated['sailing_with_vessel'] = (bool) $validated['sailing_with_vessel'];
        }

        if (array_key_exists('psc_detained_or_deficiencies', $validated) && $validated['psc_detained_or_deficiencies'] !== null) {
            $validated['psc_detained_or_deficiencies'] = (bool) $validated['psc_detained_or_deficiencies'];
        }

        // Clean & normalise vessel name
        $validated['vessel_name'] = VesselName::normalize($validated['vessel_name']);
        $validated['created_by'] = $user->id;
        $validated['report_type'] = $reportType;

        // Perform snapshot & create report
        $report = $snapshot->createReport($form, $validated);

        return redirect()->route('reports.show', $report->id)
            ->with('success', "Report {$report->reference_number} created successfully.");
    }

    /**
     * Display the report filling / viewing screen (Task 3.2, 3.3, 3.6).
     */
    public function show(Request $request, Report $report): Response
    {
        Gate::authorize('view', $report);

        $report->load([
            'form:id,code,name,answer_set',
            'vesselType:id,name',
            'lockOwner:id,name',
            'groups' => fn ($q) => $q->whereNull('parent_id')->orderBy('sort_order'),
            'groups.subgroups' => fn ($q) => $q->orderBy('sort_order'),
            'groups.questions' => fn ($q) => $q->orderBy('sort_order'),
            'groups.questions.answer.answeredBy:id,name',
            'groups.subgroups.questions' => fn ($q) => $q->orderBy('sort_order'),
            'groups.subgroups.questions.answer.answeredBy:id,name',
        ]);

        $isEditable = Gate::allows('update', $report);

        $user = $request->user();
        $activeLock = null;
        if ($report->lock_owner_id && $report->lock_expires_at && $report->lock_expires_at->isFuture()) {
            $activeLock = [
                'is_locked' => true,
                'is_owner' => $report->lock_owner_id === $user->id,
                'owner_id' => $report->lock_owner_id,
                'owner_name' => $report->lockOwner?->name ?? 'Another user',
                'expires_at' => $report->lock_expires_at->toIso8601String(),
            ];
        }

        return Inertia::render('reports/show', [
            'report' => $report,
            'is_editable' => $isEditable,
            'initial_lock' => $activeLock,
            'can_delete' => Gate::allows('delete', $report),
        ]);
    }

    /**
     * Save an individual answer granularly with idempotency and conflict detection (Task 3.3, 3.4, 3.5, 3.6).
     */
    public function saveAnswer(Request $request, Report $report, ReportQuestion $question): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($question->report_id !== $report->id) {
            abort(404, 'Question does not belong to this report.');
        }

        $validated = $request->validate([
            'answer' => ['nullable', 'string', 'in:yes,no,ns,na'],
            'note' => ['nullable', 'string'],
            'extra_value' => ['nullable', 'string', 'max:1000'],
            'client_save_id' => ['nullable', 'string', 'max:100'],
            'base_row_version' => ['nullable', 'integer'],
        ]);

        $existing = ReportAnswer::with('answeredBy:id,name')
            ->where('report_question_id', $question->id)
            ->first();

        // Idempotent retry check (NFR-2): If request with this client_save_id was already persisted, return it
        if (! empty($validated['client_save_id'])) {
            if ($existing && $existing->client_save_id === $validated['client_save_id']) {
                return response()->json([
                    'status' => 'saved',
                    'answer' => [
                        'id' => $existing->id,
                        'report_question_id' => $existing->report_question_id,
                        'answer' => $existing->answer,
                        'note' => $existing->note,
                        'extra_value' => $existing->extra_value,
                        'client_save_id' => $existing->client_save_id,
                        'row_version' => $existing->row_version,
                        'answered_at' => $existing->answered_at?->toIso8601String(),
                    ],
                ]);
            }
        }

        // Stale row_version conflict detection (NFR-15):
        // If an answer already exists in the database and the client provided base_row_version,
        // refuse if the client's base_row_version is different from the current row_version on the server.
        if ($existing && array_key_exists('base_row_version', $validated) && $validated['base_row_version'] !== null) {
            if ((int) $validated['base_row_version'] !== (int) $existing->row_version) {
                return response()->json([
                    'error' => 'conflict',
                    'message' => 'Conflict detected: this question was modified by another user or session.',
                    'server_answer' => [
                        'id' => $existing->id,
                        'report_question_id' => $existing->report_question_id,
                        'answer' => $existing->answer,
                        'note' => $existing->note,
                        'extra_value' => $existing->extra_value,
                        'client_save_id' => $existing->client_save_id,
                        'row_version' => $existing->row_version,
                        'answered_by_name' => $existing->answeredBy?->name ?? 'Another user',
                        'answered_at' => $existing->answered_at?->toIso8601String(),
                    ],
                ], 409);
            }
        }

        $answer = DB::transaction(function () use ($report, $question, $validated, $request, $existing) {
            $answerRecord = $existing ?? new ReportAnswer([
                'report_question_id' => $question->id,
                'report_id' => $report->id,
            ]);

            // INS-23: Log before/after values whenever a 'No' answer is changed or created
            if ($existing && ($existing->answer === 'no' || ($validated['answer'] ?? null) === 'no') && $existing->answer !== ($validated['answer'] ?? null)) {
                ActivityLog::record(
                    $report,
                    'answer_changed',
                    "question_{$question->id}",
                    $existing->answer ?? 'unanswered',
                    $validated['answer'] ?? 'unanswered'
                );
            }

            $answerRecord->answer = $validated['answer'] ?? null;
            $answerRecord->note = $validated['note'] ?? null;
            $answerRecord->extra_value = $validated['extra_value'] ?? null;
            $answerRecord->client_save_id = $validated['client_save_id'] ?? null;
            $answerRecord->answered_by = $request->user()->id;
            $answerRecord->answered_at = now();
            $answerRecord->row_version = ($answerRecord->row_version ?? 0) + 1;
            $answerRecord->save();

            // Refresh/extend advisory lock for the user on answer save
            if (! $report->lock_expires_at || $report->lock_expires_at->isPast() || $report->lock_owner_id === $request->user()->id) {
                $report->update([
                    'lock_owner_id' => $request->user()->id,
                    'lock_expires_at' => now()->addMinutes(5),
                ]);
            }

            // Automatically transition status from 'draft' to 'in_progress' on first answer
            if ($report->status === 'draft') {
                $report->update(['status' => 'in_progress']);
            }

            return $answerRecord;
        });

        return response()->json([
            'status' => 'saved',
            'answer' => [
                'id' => $answer->id,
                'report_question_id' => $answer->report_question_id,
                'answer' => $answer->answer,
                'note' => $answer->note,
                'extra_value' => $answer->extra_value,
                'client_save_id' => $answer->client_save_id,
                'row_version' => $answer->row_version,
                'answered_at' => $answer->answered_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Acquire or refresh an advisory edit lock on the report (NFR-15).
     */
    public function acquireLock(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $user = $request->user();
        $force = $request->boolean('force');

        $isCurrentlyLocked = $report->lock_owner_id !== null
            && $report->lock_expires_at !== null
            && $report->lock_expires_at->isFuture();

        // If locked by someone else and not forced, return advisory status
        if ($isCurrentlyLocked && $report->lock_owner_id !== $user->id && ! $force) {
            $owner = User::find($report->lock_owner_id);

            return response()->json([
                'status' => 'held_by_other',
                'lock' => [
                    'is_locked' => true,
                    'is_owner' => false,
                    'owner_id' => $report->lock_owner_id,
                    'owner_name' => $owner?->name ?? 'Another user',
                    'expires_at' => $report->lock_expires_at->toIso8601String(),
                ],
            ]);
        }

        // Acquire or extend lock for 5 minutes
        $expiresAt = now()->addMinutes(5);
        $report->update([
            'lock_owner_id' => $user->id,
            'lock_expires_at' => $expiresAt,
        ]);

        return response()->json([
            'status' => 'acquired',
            'lock' => [
                'is_locked' => true,
                'is_owner' => true,
                'owner_id' => $user->id,
                'owner_name' => $user->name,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
        ]);
    }

    /**
     * Release advisory edit lock on the report (NFR-15).
     */
    public function releaseLock(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $user = $request->user();

        if ($report->lock_owner_id === $user->id) {
            $report->update([
                'lock_owner_id' => null,
                'lock_expires_at' => null,
            ]);
        }

        return response()->json([
            'status' => 'released',
        ]);
    }

    /**
     * Save remarks/comments for a report group (Task 3.2, 3.8).
     */
    public function saveGroupComments(Request $request, Report $report, ReportGroup $group): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($group->report_id !== $report->id) {
            abort(404, 'Group does not belong to this report.');
        }

        $validated = $request->validate([
            'comments' => ['nullable', 'string'],
        ]);

        $group->update([
            'comments' => $validated['comments'] ?? null,
        ]);

        return response()->json([
            'status' => 'saved',
            'comments' => $group->comments,
        ]);
    }

    /**
     * Update report General Information particulars (Task 3.1, Form D-062 Chapter 1).
     */
    public function updateGeneralInfo(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'report_date' => ['nullable', 'date'],
            'port' => ['nullable', 'string', 'max:255'],
            'inspected_by' => ['nullable', 'string', 'max:255'],
            'master_name' => ['nullable', 'string', 'max:255'],
            'chief_engineer_name' => ['nullable', 'string', 'max:255'],
            'chief_officer_name' => ['nullable', 'string', 'max:255'],
            'sailing_with_vessel' => ['nullable', 'boolean'],
            'sailing_from' => ['nullable', 'string', 'max:255'],
            'sailing_to' => ['nullable', 'string', 'max:255'],
            'psc_last_port' => ['nullable', 'string', 'max:255'],
            'psc_last_date' => ['nullable', 'date'],
            'psc_detained_or_deficiencies' => ['nullable', 'boolean'],
            'drydock_last_date' => ['nullable', 'date'],
            'drydock_next_date' => ['nullable', 'date'],
            'operations' => ['nullable', 'array'],
            'operations.*' => ['string', 'max:100'],
        ]);

        $nullableStrings = [
            'report_date',
            'port',
            'inspected_by',
            'master_name',
            'chief_engineer_name',
            'chief_officer_name',
            'sailing_from',
            'sailing_to',
            'psc_last_port',
            'psc_last_date',
            'drydock_last_date',
            'drydock_next_date',
        ];

        foreach ($nullableStrings as $field) {
            if (array_key_exists($field, $validated) && (is_null($validated[$field]) || trim((string) $validated[$field]) === '')) {
                $validated[$field] = null;
            }
        }

        if (array_key_exists('sailing_with_vessel', $validated)) {
            $validated['sailing_with_vessel'] = (bool) $validated['sailing_with_vessel'];
        }

        if (array_key_exists('psc_detained_or_deficiencies', $validated) && $validated['psc_detained_or_deficiencies'] !== null) {
            $validated['psc_detained_or_deficiencies'] = (bool) $validated['psc_detained_or_deficiencies'];
        }

        $report->update($validated);

        return response()->json([
            'status' => 'saved',
            'report' => $report->fresh(),
        ]);
    }

    /**
     * Delete a draft or in_progress report (RLS-8).
     */
    public function destroy(Request $request, Report $report): RedirectResponse
    {
        Gate::authorize('delete', $report);

        $validated = $request->validate([
            'delete_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reason = ! empty($validated['delete_reason']) ? $validated['delete_reason'] : 'Deleted by user';

        DB::transaction(function () use ($report, $reason) {
            $report->update(['delete_reason' => $reason]);
            $report->delete();

            ActivityLog::record(
                entity: $report,
                action: 'delete_draft',
                field: 'deleted_at',
                before: null,
                after: now()->toIso8601String(),
                reportId: $report->id
            );
        });

        return redirect()->route('reports.index')->with('success', "Draft report {$report->reference_number} deleted successfully.");
    }
}
