<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\Report;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use App\Services\VesselName;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            'vessel_imo' => ['nullable', 'string', 'max:20'],
            'vessel_flag' => ['nullable', 'string', 'max:100'],
            'vessel_gt' => ['nullable', 'numeric', 'min:0'],
            'vessel_built' => ['nullable', 'integer', 'min:1900', 'max:'.(date('Y') + 1)],
            'vessel_type_id' => ['nullable', 'exists:vessel_types,id'],
            'vessel_ice_class' => ['boolean'],
            'report_date' => ['required', 'date'],
            'master_name' => ['nullable', 'string', 'max:255'],
            'chief_engineer_name' => ['nullable', 'string', 'max:255'],
            'chief_officer_name' => ['nullable', 'string', 'max:255'],
            'inspected_by' => ['nullable', 'string', 'max:255'],
            'port' => ['nullable', 'string', 'max:255'],
            'sailing_with_vessel' => ['nullable', 'string', 'max:255'],
        ]);

        $form = Form::findOrFail($validated['form_id']);
        $reportType = $form->code === 'D-062' ? 'inspection' : 'audit';

        // Authorize creation for this specific type
        Gate::authorize('create', [Report::class, $reportType]);

        // If vessel user, force their assigned vessel name (SRS §2)
        if ($user->role === 'vessel') {
            $validated['vessel_name'] = $user->vessel_name;
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
     * Display the report filling / viewing screen (Task 3.2).
     */
    public function show(Report $report): Response
    {
        Gate::authorize('view', $report);

        $report->load([
            'form:id,code,name,answer_set',
            'vesselType:id,name',
            'groups' => fn ($q) => $q->whereNull('parent_id')->orderBy('sort_order'),
            'groups.subgroups' => fn ($q) => $q->orderBy('sort_order'),
            'groups.questions' => fn ($q) => $q->orderBy('sort_order'),
            'groups.subgroups.questions' => fn ($q) => $q->orderBy('sort_order'),
        ]);

        return Inertia::render('reports/show', [
            'report' => $report,
        ]);
    }
}
