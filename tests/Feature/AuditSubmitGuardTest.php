<?php

namespace Tests\Feature;

use App\Enums\ReportStatus;
use App\Models\Form;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\User;
use App\Models\VesselType;
use App\Services\ReportSnapshot;
use App\Services\ReportStatusService;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 7, Task 7.8: Audit submit guard in status transition policy (RLS-2, OQ-9).
 *
 * Verifies:
 * - Audit start date (report_date) is required.
 * - Audit type (summary_data.audit_type) is required.
 * - Audit type 'D' (Other) requires audit_type_other description.
 * - At least one Lead Auditor with a name is required in audit_people register (AUD-3).
 * - Every applicable question answered (RLS-2).
 * - Evaluation, execution log, and comments are optional (SRS section 7.2).
 * - POST /reports/{report}/submit returns 422 with status errors on refusal.
 */
class AuditSubmitGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    private function createAuditReport(array $overrides = []): array
    {
        $user = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Oceanic Pioneer',
            'is_active' => true,
        ]);
        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::firstOrCreate(['name' => 'Bulk Carrier'], ['is_active' => true]);

        $report = app(ReportSnapshot::class)->createReport($form, array_merge([
            'vessel_name' => 'MV Oceanic Pioneer',
            'vessel_imo' => '9123456',
            'vessel_flag' => 'Marshall Islands',
            'vessel_gt' => 25000,
            'vessel_built' => 2018,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'audit',
            'master_name' => 'Capt. John Silver',
            'chief_officer_name' => 'C/O Jim Hawkins',
            'chief_engineer_name' => 'C/E Billy Bones',
            'inspected_by' => 'Lead Auditor Alexander',
        ], $overrides));

        return [$user, $report, $form];
    }

    private function answerAllApplicableQuestions(Report $report, User $user): void
    {
        $applicableQuestions = $report->questions()->where('is_applicable', true)->get();
        foreach ($applicableQuestions as $question) {
            ReportAnswer::create([
                'report_question_id' => $question->id,
                'report_id' => $report->id,
                'answer' => 'yes',
                'answered_by' => $user->id,
                'answered_at' => now(),
            ]);
        }
    }

    public function test_audit_submit_succeeds_when_all_guard_conditions_are_met(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        $this->assertTrue(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $submitted = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);

        $this->assertSame('submitted', $submitted->status);
        $this->assertNotNull($submitted->submitted_at);
    }

    public function test_audit_submit_refused_when_applicable_questions_unanswered(): void
    {
        [$user, $report] = $this->createAuditReport();
        // Do NOT answer questions

        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('RLS-2');

        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    public function test_audit_submit_refused_when_audit_start_date_is_missing(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        // Set in memory to simulate missing report_date
        $report->report_date = null;

        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('audit start date is required');

        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    public function test_audit_submit_refused_when_audit_type_is_missing(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        $summary = $report->summary_data ?? [];
        unset($summary['audit_type']);
        $report->update(['summary_data' => $summary]);

        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('audit type is required');

        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    public function test_audit_submit_refused_when_audit_type_is_other_without_description(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        $summary = $report->summary_data ?? [];
        $summary['audit_type'] = 'D';
        $summary['audit_type_other'] = '';
        $report->update(['summary_data' => $summary]);

        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('audit type description is required when audit type is Other (D)');

        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    public function test_audit_submit_succeeds_when_audit_type_is_other_with_description(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        $summary = $report->summary_data ?? [];
        $summary['audit_type'] = 'D';
        $summary['audit_type_other'] = 'Annual Pre-PSC Verification Audit';
        $report->update(['summary_data' => $summary]);

        $this->assertTrue(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $submitted = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
        $this->assertSame('submitted', $submitted->status);
    }

    public function test_audit_submit_refused_when_no_lead_auditor_has_a_name(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        $report->update(['inspected_by' => null]);

        $summary = $report->summary_data ?? [];
        unset($summary['lead_auditor']);
        $report->update(['summary_data' => $summary]);

        $peopleDataset = $report->datasets()->where('dataset_key', 'audit_people')->first();
        $peopleDataset->update([
            'rows' => [
                [
                    'name' => '',
                    'rank' => 'Lead Auditor',
                    'role' => 'Lead auditor',
                    'sort_order' => 1,
                ],
                [
                    'name' => 'Capt. John Silver',
                    'rank' => 'Master',
                    'role' => 'Auditee',
                    'sort_order' => 2,
                ],
            ],
        ]);

        $this->assertFalse(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessage('at least one Lead Auditor with a name must be registered (AUD-3)');

        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    public function test_evaluation_execution_log_and_comments_are_optional_for_submission(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        // Delete optional datasets: evaluation and execution log
        $report->datasets()->whereIn('dataset_key', ['audit_evaluation', 'audit_execution_log'])->delete();

        // Clear general comments
        $summary = $report->summary_data ?? [];
        $summary['positive_comments'] = '';
        $summary['negative_comments'] = '';
        $report->update(['summary_data' => $summary]);

        $this->assertTrue(ReportStatusService::canTransitionTo($report, ReportStatus::Submitted, $user));

        $submitted = ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
        $this->assertSame('submitted', $submitted->status);
    }

    public function test_submit_endpoint_returns_422_with_validation_error_when_guard_fails(): void
    {
        [$user, $report] = $this->createAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        // Force guard failure: clear audit type in summary_data
        $summary = $report->summary_data ?? [];
        unset($summary['audit_type']);
        $report->update(['summary_data' => $summary]);

        $response = $this->actingAs($user)
            ->postJson("/reports/{$report->id}/submit");

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $errorMsg = $response->json('errors.status.0');
        $this->assertStringContainsString('audit type is required', $errorMsg);
    }
}
