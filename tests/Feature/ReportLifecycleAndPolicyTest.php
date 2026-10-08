<?php

namespace Tests\Feature;

use App\Enums\ReportStatus;
use App\Models\Form;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\User;
use App\Services\ReportNumberService;
use App\Services\ReportSnapshot;
use App\Services\ReportStatusService;
use App\Services\VesselName;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 1 Tasks 1.7 - 1.10 & GATE 2:
 * - Task 1.7: ReportStatus state machine, server-side validation, RLS-2, RLS-5, RLS-9
 * - Task 1.8: ReportNumberService daily sequence, collision safety, year rollover
 * - Task 1.9: Vessel name normalisation and KnownVesselNames distinct query
 * - Task 1.10: Policies and access matrix
 * - GATE 2: Full console lifecycle (create, answer, submit, reopen, close)
 */
class ReportLifecycleAndPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function seedCatalogue(): void
    {
        $this->seed(FormSeeder::class);
    }

    /**
     * Task 1.9: Vessel name normalisation and autocomplete list (SRS 2.1).
     */
    public function test_vessel_name_normalisation_and_lookup(): void
    {
        // 1. Normalisation collapses spaces and trims
        $raw = "   MV   Pacific    Trader   \t ";
        $normalized = VesselName::normalize($raw);
        $this->assertSame('MV Pacific Trader', $normalized);

        // 2. Case-insensitive matching
        $this->assertTrue(VesselName::matches('MV MUMBAI', 'mv  mumbai'));
        $this->assertTrue(VesselName::matches('Mv Mumbai', 'MV MUMBAI'));
        $this->assertFalse(VesselName::matches('MV Mumbai', 'MV Delhi'));

        // 3. Model auto-normalisation on save
        $user = User::factory()->create(['vessel_name' => '  mv   southern   cross  ']);
        $this->assertSame('mv southern cross', $user->vessel_name);

        // 4. Known names query retrieves distinct list across users and reports
        $d062 = Form::factory()->create(['code' => 'D-062']);
        Report::factory()->create([
            'form_id' => $d062->id,
            'vessel_name' => 'MV Northern Light',
        ]);

        $known = VesselName::knownNames();
        $this->assertContains('mv southern cross', $known);
        $this->assertContains('MV Northern Light', $known);
    }

    /**
     * Task 1.8: ReportNumberService daily sequential numbers with rollovers (SRS RLS-7).
     */
    public function test_report_number_service_generates_sequential_daily_numbers(): void
    {
        $this->seedCatalogue();

        $d062 = Form::query()->where('code', 'D-062')->firstOrFail();
        $b008 = Form::query()->where('code', 'B-008')->firstOrFail();

        // 1. First report on 2026-10-06 is -01
        $ref1 = ReportNumberService::nextReferenceNumber($d062, '2026-10-06');
        $this->assertSame('D062-20261006-01', $ref1);

        // Simulate save
        Report::factory()->create([
            'form_id' => $d062->id,
            'reference_number' => $ref1,
            'report_date' => '2026-10-06',
        ]);

        // 2. Second report on the same date increments to -02
        $ref2 = ReportNumberService::nextReferenceNumber($d062, '2026-10-06');
        $this->assertSame('D062-20261006-02', $ref2);

        // 3. Different form has its own daily sequence
        $refB1 = ReportNumberService::nextReferenceNumber($b008, '2026-10-06');
        $this->assertSame('B008-20261006-01', $refB1);

        // 4. Different date resets sequence to -01
        $refNextDay = ReportNumberService::nextReferenceNumber($d062, '2026-10-07');
        $this->assertSame('D062-20261007-01', $refNextDay);
    }

    /**
     * Task 1.7 & GATE 2:
     * Full console lifecycle: create, answer, submit guard (RLS-2), review,
     * reopen with reason (RLS-5), resubmit, review, close (RLS-9: final).
     */
    public function test_gate_two_full_lifecycle_state_machine_and_guards(): void
    {
        $this->seedCatalogue();

        $corporate = User::factory()->create(['role' => 'corporate']);
        $b008 = Form::query()->where('code', 'B-008')->firstOrFail();
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Cement Carrier',
        ]);

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($b008, [
            'created_by' => $vesselUser->id,
            'vessel_name' => 'MV Cement Carrier',
            'report_date' => '2026-10-06',
        ]);

        // 1. Initial status is draft
        $this->assertSame('draft', $report->status);

        // 2. Transition to in_progress
        $report = ReportStatusService::transitionTo($report, ReportStatus::InProgress, $vesselUser);
        $this->assertSame('in_progress', $report->status);

        // 3. RLS-2 Guard: Submitting with unanswered questions is REFUSED
        $this->expectException(ValidationException::class);
        try {
            ReportStatusService::transitionTo($report, ReportStatus::Submitted, $vesselUser);
        } catch (ValidationException $e) {
            $this->assertStringContainsString('RLS-2', $e->getMessage());
            throw $e;
        }
    }

    public function test_gate_two_complete_flow_to_closed_and_finality(): void
    {
        $this->seedCatalogue();

        $corporate = User::factory()->create(['role' => 'corporate']);
        $vesselUser = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Audited Vessel',
        ]);
        $b008 = Form::query()->where('code', 'B-008')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($b008, [
            'created_by' => $vesselUser->id,
            'vessel_name' => 'MV Audited Vessel',
            'report_date' => '2026-10-06',
        ]);

        // Answer all applicable questions to satisfy RLS-2
        $applicableQuestions = $report->questions()->where('is_applicable', true)->get();
        foreach ($applicableQuestions as $question) {
            ReportAnswer::create([
                'report_question_id' => $question->id,
                'report_id' => $report->id,
                'answer' => 'yes',
                'answered_by' => $vesselUser->id,
                'answered_at' => now(),
            ]);
        }

        // 1. Submit successfully
        $report = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $vesselUser);
        $this->assertSame('submitted', $report->status);
        $this->assertNotNull($report->submitted_at);

        // 2. Vessel user cannot review or close
        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Reviewed, $vesselUser));
        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Closed, $vesselUser));

        // 3. Corporate user reopens with missing reason fails (RLS-5)
        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Reopened, $corporate, ''));

        // 4. Corporate user reopens with reason
        $report = ReportStatusService::transitionTo(
            $report,
            ReportStatus::Reopened,
            $corporate,
            'Chapter 3 evidence requires clarification'
        );
        $this->assertSame('reopened', $report->status);

        // 5. Author resubmits
        $report = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $vesselUser);
        $this->assertSame('submitted', $report->status);

        // 6. Corporate user marks reviewed
        $report = ReportStatusService::transitionTo($report, ReportStatus::Reviewed, $corporate);
        $this->assertSame('reviewed', $report->status);
        $this->assertSame($corporate->id, $report->reviewed_by);

        // 7. Corporate user closes report
        $report = ReportStatusService::transitionTo($report, ReportStatus::Closed, $corporate);
        $this->assertSame('closed', $report->status);
        $this->assertNotNull($report->closed_at);

        // 8. RLS-9: Closed is final, NEVER reopened
        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Reopened, $corporate, 'Attempt'));
        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Draft, $corporate));
    }

    /**
     * Task 1.10: Policies and access matrix.
     */
    public function test_report_policy_access_matrix(): void
    {
        $this->seedCatalogue();

        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $corporate = User::factory()->create(['role' => 'corporate']);
        $vesselUserA = User::factory()->create(['role' => 'vessel', 'vessel_name' => 'MV Alpha']);
        $vesselUserB = User::factory()->create(['role' => 'vessel', 'vessel_name' => 'MV Beta']);

        $d062 = Form::query()->where('code', 'D-062')->firstOrFail();
        $b008 = Form::query()->where('code', 'B-008')->firstOrFail();

        $snapshotService = new ReportSnapshot;

        // Inspection on MV Alpha
        $inspection = $snapshotService->createReport($d062, [
            'created_by' => $corporate->id,
            'vessel_name' => 'MV Alpha',
            'report_date' => '2026-10-06',
        ]);

        // Audit on MV Alpha created by vesselUserA
        $auditA = $snapshotService->createReport($b008, [
            'created_by' => $vesselUserA->id,
            'vessel_name' => 'MV Alpha',
            'report_date' => '2026-10-06',
        ]);

        // 1. Creation permissions
        $this->assertTrue(Gate::forUser($corporate)->allows('create', [Report::class, 'inspection']));
        $this->assertFalse(Gate::forUser($corporate)->allows('create', [Report::class, 'audit']));

        $this->assertFalse(Gate::forUser($vesselUserA)->allows('create', [Report::class, 'inspection']));
        $this->assertTrue(Gate::forUser($vesselUserA)->allows('create', [Report::class, 'audit']));

        // 2. View permissions and vessel scoping
        $this->assertTrue(Gate::forUser($corporate)->allows('view', $inspection));
        $this->assertTrue(Gate::forUser($corporate)->allows('view', $auditA));

        // vesselUserA matches MV Alpha
        $this->assertTrue(Gate::forUser($vesselUserA)->allows('view', $auditA));

        // vesselUserB is on MV Beta, cannot view MV Alpha
        $this->assertFalse(Gate::forUser($vesselUserB)->allows('view', $auditA));
        $this->assertFalse(Gate::forUser($vesselUserB)->allows('view', $inspection));

        // 3. Edit / Update permissions
        $this->assertTrue(Gate::forUser($corporate)->allows('update', $inspection));
        $this->assertFalse(Gate::forUser($corporate)->allows('update', $auditA)); // Audits read-only for corporate

        $this->assertTrue(Gate::forUser($vesselUserA)->allows('update', $auditA));
        $this->assertFalse(Gate::forUser($vesselUserA)->allows('update', $inspection));

        // 4. Auditee evaluation privacy (SRS section 2, AUD-11)
        // Corporate can view
        $this->assertTrue(Gate::forUser($corporate)->allows('viewAuditeeEvaluations', $auditA));
        // Author vesselUserA can view
        $this->assertTrue(Gate::forUser($vesselUserA)->allows('viewAuditeeEvaluations', $auditA));
        // Another vessel user CANNOT view auditee scores
        $otherVesselUserOnAlpha = User::factory()->create(['role' => 'vessel', 'vessel_name' => 'MV Alpha']);
        $this->assertFalse(Gate::forUser($otherVesselUserOnAlpha)->allows('viewAuditeeEvaluations', $auditA));

        // 5. Senior officer appraisals privacy (SRS section 2)
        $this->assertTrue(Gate::forUser($corporate)->allows('viewAppraisals', $inspection));
        $this->assertFalse(Gate::forUser($vesselUserA)->allows('viewAppraisals', $inspection));

        // 6. Delete Draft permissions (RLS-8)
        // Corporate can delete inspection draft
        $this->assertTrue(Gate::forUser($corporate)->allows('delete', $inspection));
        // Corporate cannot delete vessel audit draft
        $this->assertFalse(Gate::forUser($corporate)->allows('delete', $auditA));

        // Author vesselUserA can delete own audit draft on MV Alpha
        $this->assertTrue(Gate::forUser($vesselUserA)->allows('delete', $auditA));
        // vesselUserB cannot delete audit draft of MV Alpha
        $this->assertFalse(Gate::forUser($vesselUserB)->allows('delete', $auditA));
        // vesselUserA cannot delete inspection draft
        $this->assertFalse(Gate::forUser($vesselUserA)->allows('delete', $inspection));

        // Superadmin can delete drafts
        $this->assertTrue(Gate::forUser($superadmin)->allows('delete', $inspection));
        $this->assertTrue(Gate::forUser($superadmin)->allows('delete', $auditA));
    }

    /**
     * Test deleting a draft report via endpoint (RLS-8).
     */
    public function test_authorized_user_can_delete_draft_report_with_activity_log(): void
    {
        $this->seedCatalogue();

        $corporate = User::factory()->create(['role' => 'corporate']);
        $d062 = Form::query()->where('code', 'D-062')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($d062, [
            'created_by' => $corporate->id,
            'vessel_name' => 'MV Oceanic Star',
            'report_date' => '2026-10-06',
        ]);

        $this->assertSame('draft', $report->status);

        $response = $this->actingAs($corporate)->delete(route('reports.destroy', $report), [
            'delete_reason' => 'Created in error during testing',
        ]);

        $response->assertRedirect(route('reports.index'));
        $response->assertSessionHas('success');

        $this->assertSoftDeleted('reports', [
            'id' => $report->id,
            'delete_reason' => 'Created in error during testing',
        ]);

        $this->assertDatabaseHas('activity_log', [
            'report_id' => $report->id,
            'action' => 'delete_draft',
            'field' => 'deleted_at',
        ]);
    }

    /**
     * Test that submitted or closed reports cannot be deleted by anyone (RLS-8).
     */
    public function test_cannot_delete_submitted_or_closed_report_even_as_superadmin(): void
    {
        $this->seedCatalogue();

        $superadmin = User::factory()->create(['role' => 'superadmin']);
        $corporate = User::factory()->create(['role' => 'corporate']);
        $d062 = Form::query()->where('code', 'D-062')->firstOrFail();

        $snapshotService = new ReportSnapshot;
        $report = $snapshotService->createReport($d062, [
            'created_by' => $corporate->id,
            'vessel_name' => 'MV Polar Star',
            'report_date' => '2026-10-06',
        ]);

        // Change status to submitted
        $report->update(['status' => 'submitted', 'submitted_at' => now()]);

        // Neither corporate nor superadmin can delete a submitted report (RLS-8)
        $this->assertFalse(Gate::forUser($corporate)->allows('delete', $report));
        $this->assertFalse(Gate::forUser($superadmin)->allows('delete', $report));

        $response = $this->actingAs($superadmin)->delete(route('reports.destroy', $report));
        $response->assertForbidden();

        $this->assertNotSoftDeleted('reports', ['id' => $report->id]);
    }
}

