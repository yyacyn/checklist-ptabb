<?php

namespace App\Http\Controllers;

use App\Enums\ReportStatus;
use App\Models\ActivityLog;
use App\Models\Form;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\ReportDataset;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportDatasetRegistry;
use App\Services\ReportSnapshot;
use App\Services\ReportStatusService;
use App\Services\VesselName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    /**
     * Display a listing of reports scoped by user role & permissions.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $query = Report::query()
            ->with(['form:id,code,name', 'vesselType:id,name']);

        // Scoping by role (SRS §2, PLAN 1.10)
        if ($user->role === 'vessel') {
            $query->where('report_type', 'audit')
                ->where('vessel_name', VesselName::normalize($user->vessel_name));
        } elseif ($request->filled('vessel_name') && $request->input('vessel_name') !== 'all') {
            $vesselFilter = VesselName::normalize($request->input('vessel_name'));
            $query->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower($vesselFilter)]);
        }

        // Search: reference_number, vessel_name, vessel_imo, port, inspected_by
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('reference_number', 'like', "%{$search}%")
                    ->orWhere('vessel_name', 'like', "%{$search}%")
                    ->orWhere('vessel_imo', 'like', "%{$search}%")
                    ->orWhere('port', 'like', "%{$search}%")
                    ->orWhere('inspected_by', 'like', "%{$search}%");
            });
        }

        // Filter: Status
        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        // Filter: Report Type (inspection | audit)
        if ($request->filled('report_type') && $request->input('report_type') !== 'all') {
            $query->where('report_type', $request->input('report_type'));
        }

        // Filter: Form Code
        if ($request->filled('form_code') && $request->input('form_code') !== 'all') {
            $formCode = $request->input('form_code');
            $query->whereHas('form', fn ($fq) => $fq->where('code', $formCode));
        }

        // Filter: Date range
        if ($request->filled('date_from')) {
            $query->whereDate('report_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('report_date', '<=', $request->input('date_to'));
        }

        // Sorting
        $allowedSorts = ['report_date', 'reference_number', 'vessel_name', 'status', 'created_at'];
        $sortBy = in_array($request->input('sort_by'), $allowedSorts, true) ? $request->input('sort_by') : 'report_date';
        $sortDir = strtolower($request->input('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $query->orderBy($sortBy, $sortDir)->orderBy('id', 'desc');

        $perPage = (int) $request->input('per_page', 15);
        if (! in_array($perPage, [10, 15, 25, 50, 100], true)) {
            $perPage = 15;
        }

        $reports = $query->paginate($perPage)->withQueryString()->through(fn (Report $report) => [
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

        $forms = Form::query()->orderBy('code')->get(['id', 'code', 'name']);
        $knownVessels = $user->role === 'vessel'
            ? [VesselName::normalize($user->vessel_name)]
            : VesselName::knownNames();

        return Inertia::render('reports/index', [
            'reports' => $reports,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', 'all'),
                'report_type' => $request->input('report_type', 'all'),
                'form_code' => $request->input('form_code', 'all'),
                'vessel_name' => $request->input('vessel_name', 'all'),
                'date_from' => $request->input('date_from', ''),
                'date_to' => $request->input('date_to', ''),
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
                'per_page' => $perPage,
            ],
            'forms' => $forms,
            'known_vessels' => $knownVessels,
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
        $canCreatePhoto = Gate::allows('create', [Report::class, 'photo']);

        if (! $canCreateInspection && ! $canCreateAudit && ! $canCreatePhoto) {
            abort(403, 'You do not have permission to create reports.');
        }

        $forms = Form::query()
            ->get(['id', 'code', 'form_type', 'name', 'template_version', 'form_version'])
            ->filter(function (Form $form) use ($canCreateInspection, $canCreateAudit, $canCreatePhoto) {
                if ($form->form_type === 'photo') {
                    return $canCreatePhoto;
                }
                if ($form->code === 'D-062') {
                    return $canCreateInspection;
                }
                if ($form->code === 'B-008') {
                    return $canCreateAudit;
                }

                return $canCreateInspection || $canCreateAudit;
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
        $reportType = $form->form_type === 'photo' ? 'photo' : ($form->code === 'D-062' ? 'inspection' : 'audit');

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
            'form:id,code,name,answer_set,summary_schema,photo_schema,layout_schema,form_type',
            'vesselType:id,name',
            'lockOwner:id,name',
            'groups' => fn ($q) => $q->whereNull('parent_id')->orderBy('sort_order'),
            'groups.subgroups' => fn ($q) => $q->orderBy('sort_order'),
            'groups.questions' => fn ($q) => $q->orderBy('sort_order'),
            'groups.questions.answer.answeredBy:id,name',
            'groups.questions.photos' => fn ($q) => $q->with(['category:id,name,code', 'uploader:id,name'])->orderBy('sort_order'),
            'groups.subgroups.questions' => fn ($q) => $q->orderBy('sort_order'),
            'groups.subgroups.questions.answer.answeredBy:id,name',
            'groups.subgroups.questions.photos' => fn ($q) => $q->with(['category:id,name,code', 'uploader:id,name'])->orderBy('sort_order'),
            'findings' => fn ($q) => $q->with(['photos' => fn ($pq) => $pq->with(['category:id,name,code', 'uploader:id,name'])->orderBy('sort_order')])->orderBy('sort_order')->orderBy('id'),
            'photos' => fn ($q) => $q->with(['category:id,name,code', 'uploader:id,name'])->orderBy('sort_order')->orderBy('item_no')->orderBy('id'),
            'auditDetail',
            'auditees',
            'auditors',
            'auditActivities',
            'datasets',
        ]);

        $photoCategories = PhotoCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'code']);

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
            'can_submit' => in_array($report->status, ['draft', 'in_progress'], true) && $isEditable,
            'initial_lock' => $activeLock,
            'can_delete' => Gate::allows('delete', $report),
            'photo_categories' => $photoCategories,
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
        // refuse only if the answer was modified by ANOTHER user and the base_row_version is stale.
        // Sequential/rapid saves or offline retries by the same user should not trigger false edit conflicts.
        if ($existing && array_key_exists('base_row_version', $validated) && $validated['base_row_version'] !== null) {
            $lastAnsweredBy = $existing->answered_by;
            $currentUserId = $request->user()->id;

            if ($lastAnsweredBy !== null && (int) $lastAnsweredBy !== (int) $currentUserId && (int) $validated['base_row_version'] !== (int) $existing->row_version) {
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
     * Save comment/remarks for a photo section/slot in photo reports.
     */
    public function savePhotoSectionComment(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'section_key' => ['required', 'string', 'max:100'],
            'comment' => ['nullable', 'string', 'max:5000'],
        ]);

        $summaryData = $report->summary_data ?? [];
        $comments = $summaryData['photo_section_comments'] ?? [];

        if (empty($validated['comment']) && $validated['comment'] !== '0') {
            unset($comments[$validated['section_key']]);
        } else {
            $comments[$validated['section_key']] = $validated['comment'];
        }

        $summaryData['photo_section_comments'] = $comments;
        $report->update(['summary_data' => $summaryData]);

        return response()->json([
            'status' => 'saved',
            'section_key' => $validated['section_key'],
            'comment' => $validated['comment'] ?? '',
            'photo_section_comments' => $comments,
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
     * Update audit set-up particulars for B-008 internal audits (AUD-2, AUD-3, Task 7.1).
     */
    public function updateAuditSetup(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'report_date' => ['nullable', 'date'],
            'port' => ['nullable', 'string', 'max:255'],
            'master_name' => ['nullable', 'string', 'max:255'],
            'chief_engineer_name' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'audit_type' => ['nullable', 'string', 'max:50'],
            'audit_type_other' => ['nullable', 'string', 'max:255'],
            'lead_auditor' => ['nullable', 'string', 'max:255'],
            'operations' => ['nullable', 'array'],
            'operations.*' => ['string', 'max:100'],
            'activities' => ['nullable', 'array'],
            'activities.*.activity' => ['required', 'string', 'max:255'],
            'activities.*.sort_order' => ['nullable', 'integer'],
            'auditees' => ['nullable', 'array'],
            'auditees.*.name' => ['required', 'string', 'max:255'],
            'auditees.*.rank' => ['required', 'string', 'max:255'],
            'auditees.*.user_id' => ['nullable', 'exists:users,id'],
            'auditees.*.sort_order' => ['nullable', 'integer'],
            'auditors' => ['nullable', 'array'],
            'auditors.*.name' => ['required', 'string', 'max:255'],
            'auditors.*.rank' => ['required', 'string', 'max:255'],
            'auditors.*.is_lead' => ['nullable', 'boolean'],
            'auditors.*.user_id' => ['nullable', 'exists:users,id'],
            'auditors.*.sort_order' => ['nullable', 'integer'],
        ]);

        DB::transaction(function () use ($report, $validated) {
            // 0. Report header fields
            $reportUpdates = [];
            foreach (['report_date', 'port', 'master_name', 'chief_engineer_name'] as $field) {
                if (array_key_exists($field, $validated)) {
                    $reportUpdates[$field] = (is_null($validated[$field]) || trim((string) $validated[$field]) === '') ? null : $validated[$field];
                }
            }
            if (array_key_exists('operations', $validated)) {
                $reportUpdates['operations'] = $validated['operations'] ?? [];
            }
            if (! empty($reportUpdates)) {
                $report->update($reportUpdates);
            }

            // 1. Audit Detail (dates, type, lead auditor)
            $detailData = [
                'start_date' => $validated['start_date'] ?? null,
                'end_date' => $validated['end_date'] ?? null,
                'audit_type' => $validated['audit_type'] ?? null,
                'audit_type_other' => $validated['audit_type_other'] ?? null,
                'lead_auditor' => $validated['lead_auditor'] ?? null,
            ];

            $report->auditDetail()->updateOrCreate(
                ['report_id' => $report->id],
                $detailData
            );

            // 2. Activities (AUD-3)
            if (array_key_exists('activities', $validated)) {
                $report->auditActivities()->delete();
                foreach ($validated['activities'] as $idx => $act) {
                    $report->auditActivities()->create([
                        'activity' => $act['activity'],
                        'sort_order' => $act['sort_order'] ?? ($idx + 1),
                    ]);
                }
            }

            // 4. Auditees (AUD-3)
            if (array_key_exists('auditees', $validated)) {
                $report->auditees()->delete();
                foreach ($validated['auditees'] as $idx => $a) {
                    $report->auditees()->create([
                        'name' => $a['name'],
                        'rank' => $a['rank'],
                        'user_id' => $a['user_id'] ?? null,
                        'sort_order' => $a['sort_order'] ?? ($idx + 1),
                    ]);
                }
            }

            // 5. Auditors (AUD-3)
            if (array_key_exists('auditors', $validated)) {
                $report->auditors()->delete();
                foreach ($validated['auditors'] as $idx => $a) {
                    $report->auditors()->create([
                        'name' => $a['name'],
                        'rank' => $a['rank'],
                        'is_lead' => (bool) ($a['is_lead'] ?? false),
                        'user_id' => $a['user_id'] ?? null,
                        'sort_order' => $a['sort_order'] ?? ($idx + 1),
                    ]);
                }
            }

            $report->increment('current_version');
        });

        $report->load([
            'auditDetail',
            'auditees',
            'auditors',
            'auditActivities',
        ]);

        return response()->json([
            'status' => 'saved',
            'report' => $report,
            'audit_detail' => $report->auditDetail,
            'auditees' => $report->auditees,
            'auditors' => $report->auditors,
            'audit_activities' => $report->auditActivities,
        ]);
    }

    /**
     * Update a repeating dataset on a report (SRS 14.4, NFR-1, NFR-2, NFR-15, Task 7.1).
     */
    public function updateDataset(Request $request, Report $report, string $key): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'rows' => ['required', 'array'],
            'client_save_id' => ['nullable', 'string', 'max:100'],
            'base_row_version' => ['nullable', 'integer'],
        ]);

        // Validate row shape using ReportDatasetRegistry
        $sanitizedRows = ReportDatasetRegistry::validate($key, $validated['rows']);

        $existing = ReportDataset::where('report_id', $report->id)
            ->where('dataset_key', $key)
            ->first();

        // Idempotency check (NFR-2)
        if (! empty($validated['client_save_id']) && $existing && $existing->client_save_id === $validated['client_save_id']) {
            return response()->json([
                'status' => 'saved',
                'dataset' => $existing,
            ]);
        }

        // Stale row_version conflict detection (NFR-15)
        if ($existing && array_key_exists('base_row_version', $validated) && $validated['base_row_version'] !== null) {
            if ($existing->row_version > (int) $validated['base_row_version']) {
                return response()->json([
                    'status' => 'conflict',
                    'message' => 'Dataset was modified by another save.',
                    'server_dataset' => [
                        'id' => $existing->id,
                        'dataset_key' => $existing->dataset_key,
                        'rows' => $existing->rows,
                        'row_version' => $existing->row_version,
                    ],
                ], 409);
            }
        }

        $nextVersion = $existing ? ($existing->row_version + 1) : 1;

        $dataset = ReportDataset::updateOrCreate(
            [
                'report_id' => $report->id,
                'dataset_key' => $key,
            ],
            [
                'rows' => $sanitizedRows,
                'row_version' => $nextVersion,
                'client_save_id' => $validated['client_save_id'] ?? null,
            ]
        );

        $report->increment('current_version');

        return response()->json([
            'status' => 'saved',
            'dataset' => $dataset,
        ]);
    }

    /**
     * Update scalar summary_data fields on a report (SRS 14.4, Task 7.1).
     */
    public function updateFields(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'fields' => ['required', 'array'],
        ]);

        $currentSummary = $report->summary_data ?? [];
        $newSummary = array_merge($currentSummary, $validated['fields']);

        $report->update([
            'summary_data' => $newSummary,
        ]);

        $report->increment('current_version');

        return response()->json([
            'status' => 'saved',
            'summary_data' => $report->summary_data,
        ]);
    }

    /**
     * Update Report Summary ratings and text blocks (Form D-062 Report Summary, INS-10, INS-12).
     */
    public function updateSummary(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'summary_ratings' => ['nullable', 'array'],
            'summary_data' => ['nullable', 'array'],
            'summary_comments_no' => ['nullable', 'string'],
            'summary_safety_meetings' => ['nullable', 'string'],
            'summary_participants' => ['nullable', 'string'],
            'summary_concept_understanding' => ['nullable', 'string'],
            'summary_training_needs' => ['nullable', 'string'],
        ]);

        $report->update($validated);

        return response()->json([
            'status' => 'saved',
            'report' => $report->fresh(),
        ]);
    }

    /**
     * Upload an attachment for a question (Form D-062).
     */
    public function uploadAttachment(Request $request, Report $report, ReportQuestion $question): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($question->report_id !== $report->id) {
            abort(404, 'Question does not belong to this report.');
        }

        $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25MB max
        ]);

        $file = $request->file('file');
        $filename = time().'_'.preg_replace('/[^a-zA-Z0-9._-]/', '_', $file->getClientOriginalName());
        $path = $file->storeAs("attachments/{$report->id}", $filename, 'public');

        return response()->json([
            'status' => 'uploaded',
            'url' => asset("storage/{$path}"),
            'path' => $path,
            'name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
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

    /**
     * Submit/finish a report (RLS-2, RLS-3, RLS-4).
     */
    public function submit(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        // Release any active lock on submission
        if ($report->lock_owner_id === $request->user()->id) {
            $report->update([
                'lock_owner_id' => null,
                'lock_expires_at' => null,
            ]);
        }

        $oldStatus = $report->status;
        $report = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $request->user());

        ActivityLog::record(
            entity: $report,
            action: 'report_submitted',
            field: 'status',
            before: $oldStatus,
            after: 'submitted',
            reportId: $report->id
        );

        return response()->json([
            'status' => 'success',
            'message' => "Report {$report->reference_number} has been submitted successfully.",
            'report_status' => $report->status,
            'submitted_at' => $report->submitted_at?->toIso8601String(),
        ]);
    }

    /**
     * View/stream the report's PDF in browser (inline).
     */
    public function viewPdf(Report $report, ReportPdfRenderer $renderer): BinaryFileResponse
    {
        Gate::authorize('view', $report);

        $isClosed = $report->status === ReportStatus::Closed->value;
        $path = $renderer->generatePdfFile($report, force: ! $isClosed);
        $fullPath = Storage::disk('public')->path($path);

        return response()->file($fullPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="report-'.$report->reference_number.'.pdf"',
        ]);
    }

    /**
     * Download the report's PDF as attachment.
     */
    public function downloadPdf(Report $report, ReportPdfRenderer $renderer): BinaryFileResponse
    {
        Gate::authorize('view', $report);

        $isClosed = $report->status === ReportStatus::Closed->value;
        $path = $renderer->generatePdfFile($report, force: ! $isClosed);
        $fullPath = Storage::disk('public')->path($path);

        return response()->download($fullPath, 'report-'.$report->reference_number.'.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
