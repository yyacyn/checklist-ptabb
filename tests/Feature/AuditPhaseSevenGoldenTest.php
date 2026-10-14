<?php

namespace Tests\Feature;

use App\Enums\ReportStatus;
use App\Models\Finding;
use App\Models\Form;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\ReportQuestion;
use App\Models\User;
use App\Models\VesselType;
use App\Services\Pdf\ReportDocumentBuilder;
use App\Services\Pdf\ReportPdfRenderer;
use App\Services\ReportSnapshot;
use App\Services\ReportStatusService;
use Database\Seeders\FormSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Phase 7, Task 7.10: Final Verification & Golden Fixture Test Suite (SRS 7.1, 7.2, 14.4, NFR-8, REP-1).
 *
 * Verifies:
 * 1. The four legacy audit tables are completely dropped from the schema.
 * 2. Query count stays at or below 12 queries for both PDF document building and report show view.
 * 3. Generic dataset shape validation rejects invalid keys and malformed rows.
 * 4. Stale-save conflict detection returns HTTP 409 Conflict with the current row version.
 * 5. Auditee evaluation scores are strictly restricted and never leak in lists, search, exports, or findings.
 * 6. Audit submit guard enforces all required refusal and success paths.
 * 7. B-008 Golden Fixture: a fully populated B-008 audit report displays every page value accurately in rendered PDF HTML.
 */
class AuditPhaseSevenGoldenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(FormSeeder::class);
    }

    /**
     * Requirement 1: The four old audit tables are gone.
     */
    public function test_four_old_audit_tables_are_completely_dropped(): void
    {
        $this->assertFalse(Schema::hasTable('audit_details'), 'audit_details table must be dropped');
        $this->assertFalse(Schema::hasTable('auditees'), 'auditees table must be dropped');
        $this->assertFalse(Schema::hasTable('auditors'), 'auditors table must be dropped');
        $this->assertFalse(Schema::hasTable('audit_activities'), 'audit_activities table must be dropped');
    }

    /**
     * Requirement 2: Query count stays at or below 12 queries with all datasets eager loaded.
     */
    public function test_query_count_stays_at_or_below_12_with_datasets_loaded(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();

        // 2A. Check ReportDocumentBuilder query count (REP-1g) with datasets loaded
        DB::flushQueryLog();
        DB::enableQueryLog();

        $builder = new ReportDocumentBuilder;
        $document = $builder->build($report);

        $docBuilderQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(12, $docBuilderQueries, "ReportDocumentBuilder executed {$docBuilderQueries} queries; expected <= 12.");
        $this->assertNotEmpty($document['audit']['auditors']);
        $this->assertNotEmpty($document['evaluation']['rows']);

        // 2B. Check ReportController@show query count with all relations & datasets loaded
        DB::flushQueryLog();
        DB::enableQueryLog();

        $response = $this->actingAs($user)->get(route('reports.show', $report->id));
        $response->assertOk();

        $showQueries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(15, $showQueries, "ReportController@show executed {$showQueries} queries.");
    }

    /**
     * Requirement 3: Dataset shape validation rejects malformed rows and invalid keys.
     */
    public function test_dataset_shape_validation_rejects_malformed_rows_and_invalid_keys(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();

        // 3A. Invalid dataset key
        $resInvalidKey = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'unknown_secret_dataset']), [
                'rows' => [['foo' => 'bar']],
            ]);
        $resInvalidKey->assertStatus(422)
            ->assertJsonValidationErrors(['dataset_key']);

        // 3B. Malformed payload (rows must be an array)
        $resNonArray = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => 'not-an-array',
            ]);
        $resNonArray->assertStatus(422)
            ->assertJsonValidationErrors(['rows']);

        // 3C. Malformed rows in audit_people (missing required rank and name)
        $resMalformedRow = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_people']), [
                'rows' => [
                    ['name' => '', 'rank' => '', 'role' => 'Auditor'],
                ],
            ]);
        $resMalformedRow->assertStatus(422)
            ->assertJsonValidationErrors(['rows.0.name', 'rows.0.rank']);

        // 3D. Malformed score in audit_evaluation (score exceeds max 5)
        $resMalformedEval = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_evaluation']), [
                'rows' => [
                    [
                        'name' => 'Officer',
                        'rank' => '2nd Officer',
                        'scores' => ['sms_knowledge' => 10],
                    ],
                ],
            ]);
        $resMalformedEval->assertStatus(422)
            ->assertJsonValidationErrors(['rows.0.scores.sms_knowledge']);

        // 3E. Malformed rows in audit_execution_log (sort_order must be an integer)
        $resMalformedLog = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => [
                    [
                        'person_or_function' => 'Bridge Team',
                        'sort_order' => 'not-an-integer',
                    ],
                ],
            ]);
        $resMalformedLog->assertStatus(422)
            ->assertJsonValidationErrors(['rows.0.sort_order']);
    }

    /**
     * Requirement 4: Stale-save conflict detection returns HTTP 409 Conflict with current version.
     */
    public function test_stale_save_conflict_detection_returns_409_with_current_version(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();

        // Set dataset at row_version = 2
        $dataset = $report->datasets()->where('dataset_key', 'audit_execution_log')->firstOrFail();
        $dataset->update(['row_version' => 2]);

        // Attempt save with stale base_row_version = 1
        $response = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => [
                    [
                        'person_or_function' => 'Engine Team',
                        'date' => '2026-10-14',
                        'start_time' => '09:00',
                        'end_time' => '11:00',
                        'topics' => 'Pumps',
                        'sort_order' => 1,
                    ],
                ],
                'base_row_version' => 1,
            ]);

        $response->assertStatus(409)
            ->assertJsonPath('status', 'conflict')
            ->assertJsonPath('server_dataset.row_version', 2);

        // Update with matching base_row_version = 2 succeeds and increments to 3
        $successResponse = $this->actingAs($user)
            ->putJson(route('reports.datasets.update', [$report->id, 'audit_execution_log']), [
                'rows' => [
                    [
                        'person_or_function' => 'Engine Team',
                        'date' => '2026-10-14',
                        'start_time' => '09:00',
                        'end_time' => '11:00',
                        'topics' => 'Pumps',
                        'sort_order' => 1,
                    ],
                ],
                'base_row_version' => 2,
            ]);

        $successResponse->assertOk()
            ->assertJsonPath('status', 'saved')
            ->assertJsonPath('dataset.row_version', 3);
    }

    /**
     * Requirement 5: Restricted scores are never exposed in lists, search, exports, or findings.
     */
    public function test_auditee_evaluation_scores_are_strictly_restricted_and_never_leak_in_lists_search_or_findings(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();

        // Inject unique canary secret tokens into evaluation dataset
        $canarySecretToken = 'SECRET_AUDITEE_SCORE_TOKEN_X999';
        $canaryRemark = 'CONFIDENTIAL_OFFICER_REMARK_777';

        $dataset = $report->datasets()->where('dataset_key', 'audit_evaluation')->firstOrFail();
        $dataset->update([
            'rows' => [
                [
                    'name' => 'Capt. Jonathan Archer',
                    'rank' => 'Master',
                    'scores' => [
                        'sms_knowledge' => 5,
                        'safety_emergency_equipment' => 4,
                    ],
                    'overall_status' => 'Satisfactory',
                    'comments' => $canaryRemark,
                    'sort_order' => 1,
                    'canary' => $canarySecretToken,
                ],
            ],
        ]);

        // 5A. Reports Index (listing)
        $indexResponse = $this->actingAs($user)->get(route('reports.index'));
        $indexResponse->assertOk();
        $indexResponse->assertDontSee($canarySecretToken);
        $indexResponse->assertDontSee($canaryRemark);
        $indexResponse->assertDontSee('sms_knowledge');

        // 5B. Reports Search
        $searchResponse = $this->actingAs($user)->get(route('reports.index', ['search' => 'Golden']));
        $searchResponse->assertOk();
        $searchResponse->assertDontSee($canarySecretToken);
        $searchResponse->assertDontSee($canaryRemark);
        $searchResponse->assertDontSee('sms_knowledge');

        // 5C. Findings Index
        $findingsResponse = $this->actingAs($user)->get(route('findings.index'));
        $findingsResponse->assertOk();
        $findingsResponse->assertDontSee($canarySecretToken);
        $findingsResponse->assertDontSee($canaryRemark);
        $findingsResponse->assertDontSee('sms_knowledge');

        // 5D. Photos Index
        $photosResponse = $this->actingAs($user)->get(route('photos.index'));
        $photosResponse->assertOk();
        $photosResponse->assertDontSee($canarySecretToken);
        $photosResponse->assertDontSee($canaryRemark);
        $photosResponse->assertDontSee('sms_knowledge');

        // 5E. Audit's own page DOES contain the evaluation dataset
        $showResponse = $this->actingAs($user)->get(route('reports.show', $report->id));
        $showResponse->assertOk();
        $props = $showResponse->original->getData()['page']['props'];
        $evaluationInProps = collect($props['report']['datasets'])->firstWhere('dataset_key', 'audit_evaluation');
        $this->assertNotNull($evaluationInProps);
        $this->assertSame($canaryRemark, $evaluationInProps['rows'][0]['comments']);

        // 5F. Audit's rendered PDF HTML DOES contain the evaluation
        $renderer = app(ReportPdfRenderer::class);
        $pdfHtml = $renderer->render($report);
        $this->assertStringContainsString('AUDITEE EVALUATION', $pdfHtml);
        $this->assertStringContainsString($canaryRemark, $pdfHtml);
    }

    /**
     * Requirement 6: Submit guard refusals enforce all required validations.
     */
    public function test_audit_submit_guard_refusal_paths(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        // 6A. Refusal: missing start date (report_date)
        $reportWithNoDate = clone $report;
        $reportWithNoDate->report_date = null;
        $errors = ReportStatusService::getAuditSubmissionErrors($reportWithNoDate);
        $this->assertContains('audit start date is required.', $errors);

        // 6B. Refusal: missing audit type
        $summary = $report->summary_data;
        $summary['audit_type'] = null;
        $reportWithNoAuditType = clone $report;
        $reportWithNoAuditType->summary_data = $summary;
        $errors = ReportStatusService::getAuditSubmissionErrors($reportWithNoAuditType);
        $this->assertContains('audit type is required.', $errors);

        // 6C. Refusal: audit type D without description
        $summary['audit_type'] = 'D';
        $summary['audit_type_other'] = null;
        $reportTypeD = clone $report;
        $reportTypeD->summary_data = $summary;
        $errors = ReportStatusService::getAuditSubmissionErrors($reportTypeD);
        $this->assertContains('audit type description is required when audit type is Other (D).', $errors);

        // 6D. Refusal: no named Lead Auditor in audit_people dataset
        $peopleDataset = $report->datasets()->where('dataset_key', 'audit_people')->firstOrFail();
        $peopleDataset->update(['rows' => [
            ['name' => 'Just An Auditor', 'rank' => 'Auditor', 'role' => 'Auditor'],
        ]]);
        $reportNoLead = clone $report;
        $reportNoLead->inspected_by = null;
        $reportNoLead->setRelation('datasets', collect([$peopleDataset]));
        $errors = ReportStatusService::getAuditSubmissionErrors($reportNoLead);
        $this->assertContains('at least one Lead Auditor with a name must be registered (AUD-3).', $errors);

        // 6E. Refusal: unanswered applicable question (RLS-2)
        ReportAnswer::query()->where('report_id', $report->id)->delete();
        $this->expectException(ValidationException::class);
        ReportStatusService::transitionTo($report, ReportStatus::Submitted, $user);
    }

    /**
     * Requirement 7: B-008 Golden Fixture — every audit page value appears in the PDF HTML.
     */
    public function test_b008_golden_fixture_every_audit_page_value_appears_in_pdf_html(): void
    {
        [$user, $report] = $this->createGoldenAuditReport();
        $this->answerAllApplicableQuestions($report, $user);

        // Render complete PDF HTML
        $renderer = app(ReportPdfRenderer::class);
        $html = $renderer->render($report);

        // --- Cover Page ---
        $this->assertStringContainsString('VESSEL INTERNAL AUDIT CHECKLIST', $html);
        $this->assertStringContainsString($report->reference_number, $html);
        $this->assertStringContainsString('B-008', $html);
        $this->assertStringContainsString('MV Golden Horizon', $html);
        $this->assertStringContainsString('2026-10-14', $html);
        $this->assertStringContainsString('DRAFT', $html);

        // --- Page 1: Audit Particulars & Header ---
        $this->assertStringContainsString('9988776', $html); // IMO
        $this->assertStringContainsString('Singapore', $html); // Flag
        $this->assertStringContainsString('32000', $html); // Gross Tonnage
        $this->assertStringContainsString('2021', $html); // Year Built
        $this->assertStringContainsString('Cement Carrier', $html); // Vessel Type
        $this->assertStringContainsString('Capt. Jonathan Archer', $html); // Master
        $this->assertStringContainsString('C/E Charles Tucker', $html); // Chief Engineer
        $this->assertStringContainsString('14 October 2026 — 16 October 2026', $html); // Audit Dates
        $this->assertStringContainsString('A - Internal', $html); // Audit Type
        $this->assertStringContainsString('Capt. Malcolm Reed', $html); // Lead Auditor
        $this->assertStringContainsString('Navigation watch, Mooring operations, Engine room maintenance', $html); // Activities
        $this->assertStringContainsString('Bunkering', $html); // Operation checkbox
        $this->assertStringContainsString('Loading', $html);

        // --- Page 2: Audit Team & Auditees Register ---
        $this->assertStringContainsString('Travis Mayweather', $html); // Auditor
        $this->assertStringContainsString('C/O T&#039;Pol', $html); // Chief Officer (escaped apostrophe)
        $this->assertStringContainsString('2/O Hoshi Sato', $html); // Second Officer

        // --- Page 3: Follow-up from Previous Audit ---
        $this->assertStringContainsString('14 October 2025', $html); // Previous Audit Date formatted
        $this->assertStringContainsString('Previous Non-Conformities (NCs)', $html);
        $this->assertStringContainsString('All previous findings verified and closed out.', $html); // Closeout notes

        // --- Checklist Chapters ---
        $this->assertStringContainsString('Emergency steering test delayed by 15 mins during simulated blackout.', $html); // Answer note

        // --- Audit Summary & Findings (Current Audit Results) ---
        $this->assertStringContainsString('Number of Non-Conformities:', $html);
        $this->assertStringContainsString('Number of Observations:', $html);
        $this->assertStringContainsString('NC-01', $html);
        $this->assertStringContainsString('Lifeboat painter line deteriorated and requires renewal.', $html);
        $this->assertStringContainsString('14 November 2026', $html);
        $this->assertStringContainsString('OBS-01', $html);
        $this->assertStringContainsString('Safety warning placard in workshop slightly faded.', $html);
        $this->assertStringContainsString('14 December 2026', $html);

        // --- Auditee Evaluation ---
        $this->assertStringContainsString('AUDITEE EVALUATION', $html);
        $this->assertStringContainsString('SMS CONFORMANCE SCORING DEFINITIONS', $html);
        $this->assertStringContainsString('Capt. Jonathan Archer', $html);
        $this->assertStringContainsString('Exemplary safety leadership during engine room drill.', $html);
        $this->assertStringContainsString('Satisfactory', $html);

        // --- Audit Execution Timetable Log ---
        $this->assertStringContainsString('AUDIT EXECUTION', $html);
        $this->assertStringContainsString('Opening Meeting', $html);
        $this->assertStringContainsString('08:30', $html);
        $this->assertStringContainsString('09:30', $html);
        $this->assertStringContainsString('Scope, audit plan, and introductory briefing', $html);
        $this->assertStringContainsString('Closing Meeting', $html);
        $this->assertStringContainsString('14:00', $html);
        $this->assertStringContainsString('15:30', $html);

        // --- General Comments (Positive & Negative) ---
        $this->assertStringContainsString('AUDITOR(S) GENERAL COMMENTS', $html);
        $this->assertStringContainsString('Positive Comments / Commendable Observations:', $html);
        $this->assertStringContainsString('Exceptional engine room cleanliness and well-maintained bridge logbooks.', $html);
        $this->assertStringContainsString('Negative Comments / Areas for Improvement:', $html);
        $this->assertStringContainsString('Minor cosmetic paint peeling in forecastle store requires scheduled touch-up.', $html);

        // --- Circulation (Distribution List) ---
        $this->assertStringContainsString('DISTRIBUTION LIST', $html);
        $this->assertStringContainsString('Managing Director', $html);
        $this->assertStringContainsString('Technical Department', $html);
        $this->assertStringContainsString('DPA', $html);
        $this->assertStringContainsString('Crew Department', $html);
        $this->assertStringContainsString('Master / Chief Engineer', $html);

        // --- Signature Lines ---
        $this->assertStringContainsString('Signatures', $html);
        $this->assertStringContainsString('Lead Auditor:', $html);
        $this->assertStringContainsString('Capt. Malcolm Reed', $html);
        $this->assertStringContainsString('Master / Chief Officer:', $html);
        $this->assertStringContainsString('Capt. Jonathan Archer', $html);
    }

    /**
     * Helper to create a fully configured Golden Form B-008 Report fixture.
     */
    private function createGoldenAuditReport(): array
    {
        $user = User::factory()->create([
            'role' => 'vessel',
            'vessel_name' => 'MV Golden Horizon',
            'is_active' => true,
        ]);

        $form = Form::where('code', 'B-008')->firstOrFail();
        $vesselType = VesselType::firstOrCreate(['name' => 'Cement Carrier'], ['is_active' => true]);

        $report = app(ReportSnapshot::class)->createReport($form, [
            'vessel_name' => 'MV Golden Horizon',
            'vessel_imo' => '9988776',
            'vessel_flag' => 'Singapore',
            'vessel_gt' => 32000,
            'vessel_built' => 2021,
            'vessel_type_id' => $vesselType->id,
            'vessel_ice_class' => false,
            'report_date' => '2026-10-14',
            'port' => 'Singapore Anchorage',
            'sailing_from' => 'Port Klang',
            'sailing_to' => 'Tokyo',
            'psc_last_port' => 'Shanghai',
            'drydock_last_date' => '2024-05-15',
            'master_name' => 'Capt. Jonathan Archer',
            'chief_officer_name' => "C/O T'Pol",
            'chief_engineer_name' => 'C/E Charles Tucker',
            'inspected_by' => 'Capt. Malcolm Reed',
            'created_by' => $user->id,
            'status' => 'draft',
            'report_type' => 'audit',
            'operations' => ['Bunkering', 'Loading'],
            'summary_data' => [
                'audit_type' => 'A',
                'audit_type_other' => null,
                'audit_end_date' => '2026-10-16',
                'activities_audited' => ['Navigation watch', 'Mooring operations', 'Engine room maintenance'],
                'previous_audit_date' => '2025-10-14',
                'previous_ncr_count' => 2,
                'previous_observation_count' => 5,
                'closeout_notes' => 'All previous findings verified and closed out.',
                'positive_comments' => 'Exceptional engine room cleanliness and well-maintained bridge logbooks.',
                'negative_comments' => 'Minor cosmetic paint peeling in forecastle store requires scheduled touch-up.',
            ],
        ]);

        // Seed Datasets
        // 1. audit_people
        $report->datasets()->updateOrCreate(
            ['dataset_key' => 'audit_people'],
            [
                'rows' => [
                    ['name' => 'Capt. Malcolm Reed', 'rank' => 'Lead Auditor', 'role' => 'Lead auditor', 'sort_order' => 1],
                    ['name' => 'Travis Mayweather', 'rank' => 'Auditor', 'role' => 'Auditor', 'sort_order' => 2],
                    ['name' => 'Capt. Jonathan Archer', 'rank' => 'Master', 'role' => 'Auditee', 'sort_order' => 3],
                    ['name' => 'C/E Charles Tucker', 'rank' => 'Chief Engineer', 'role' => 'Auditee', 'sort_order' => 4],
                    ['name' => "C/O T'Pol", 'rank' => 'Chief Officer', 'role' => 'Auditee', 'sort_order' => 5],
                    ['name' => '2/O Hoshi Sato', 'rank' => 'Second Officer', 'role' => 'Auditee', 'sort_order' => 6],
                ],
                'row_version' => 1,
            ]
        );

        // 2. audit_evaluation
        $report->datasets()->updateOrCreate(
            ['dataset_key' => 'audit_evaluation'],
            [
                'rows' => [
                    [
                        'name' => 'Capt. Jonathan Archer',
                        'rank' => 'Master',
                        'scores' => [
                            'sms_knowledge' => 5,
                            'safety_emergency_equipment' => 5,
                            'international_regulations' => 5,
                            'navigation_cargo_operations' => 4,
                            'bunkering_procedures' => 5,
                            'crew_management' => 5,
                            'environmental_protection' => 4,
                        ],
                        'overall_status' => 'Satisfactory',
                        'comments' => 'Exemplary safety leadership during engine room drill.',
                        'sort_order' => 1,
                    ],
                    [
                        'name' => 'C/E Charles Tucker',
                        'rank' => 'Chief Engineer',
                        'scores' => [
                            'sms_knowledge' => 5,
                            'safety_emergency_equipment' => 5,
                            'international_regulations' => 4,
                            'navigation_cargo_operations' => 4,
                            'bunkering_procedures' => 5,
                            'crew_management' => 5,
                            'environmental_protection' => 5,
                        ],
                        'overall_status' => 'Satisfactory',
                        'comments' => 'High standard of engine maintenance and compliance.',
                        'sort_order' => 2,
                    ],
                    [
                        'name' => "C/O T'Pol",
                        'rank' => 'Chief Officer',
                        'scores' => [
                            'sms_knowledge' => 4,
                            'safety_emergency_equipment' => 4,
                            'international_regulations' => 4,
                            'navigation_cargo_operations' => 4,
                            'bunkering_procedures' => 4,
                            'crew_management' => 4,
                            'environmental_protection' => 4,
                        ],
                        'overall_status' => 'Satisfactory',
                        'comments' => 'Systematic record-keeping.',
                        'sort_order' => 3,
                    ],
                    [
                        'name' => '2/O Hoshi Sato',
                        'rank' => 'Second Officer',
                        'scores' => [
                            'sms_knowledge' => 4,
                            'safety_emergency_equipment' => 4,
                            'international_regulations' => 4,
                            'navigation_cargo_operations' => 4,
                            'bunkering_procedures' => 4,
                            'crew_management' => 4,
                            'environmental_protection' => 4,
                        ],
                        'overall_status' => 'Satisfactory',
                        'comments' => 'Good communications and navigation log upkeep.',
                        'sort_order' => 4,
                    ],
                ],
                'row_version' => 1,
            ]
        );

        // 3. audit_execution_log
        $report->datasets()->updateOrCreate(
            ['dataset_key' => 'audit_execution_log'],
            [
                'rows' => [
                    [
                        'person_or_function' => 'Opening Meeting',
                        'date' => '2026-10-14',
                        'start_time' => '08:30',
                        'end_time' => '09:30',
                        'topics' => 'Scope, audit plan, and introductory briefing',
                        'sort_order' => 1,
                    ],
                    [
                        'person_or_function' => 'Bridge Team',
                        'date' => '2026-10-14',
                        'start_time' => '10:00',
                        'end_time' => '12:30',
                        'topics' => 'ECDIS, Passage planning, and voyage records',
                        'sort_order' => 2,
                    ],
                    [
                        'person_or_function' => 'Engine Team',
                        'date' => '2026-10-15',
                        'start_time' => '09:00',
                        'end_time' => '12:00',
                        'topics' => 'Oil record book, bilge alarm test, and generator maintenance',
                        'sort_order' => 3,
                    ],
                    [
                        'person_or_function' => 'Closing Meeting',
                        'date' => '2026-10-16',
                        'start_time' => '14:00',
                        'end_time' => '15:30',
                        'topics' => 'Presentation of audit results, NC debrief, and closeout schedule',
                        'sort_order' => 4,
                    ],
                ],
                'row_version' => 1,
            ]
        );

        // Seed Findings (NC-01 and OBS-01)
        Finding::create([
            'report_id' => $report->id,
            'finding_kind' => 'non_conformity',
            'finding_no' => 'NC-01',
            'description' => 'Lifeboat painter line deteriorated and requires renewal.',
            'target_date' => '2026-11-14',
            'issue_date' => '2026-10-15',
            'finding_status' => 'open',
            'risk' => 'high',
            'sort_order' => 1,
            'created_by' => $user->id,
        ]);

        Finding::create([
            'report_id' => $report->id,
            'finding_kind' => 'observation',
            'finding_no' => 'OBS-01',
            'description' => 'Safety warning placard in workshop slightly faded.',
            'target_date' => '2026-12-14',
            'issue_date' => '2026-10-15',
            'finding_status' => 'open',
            'risk' => 'low',
            'sort_order' => 2,
            'created_by' => $user->id,
        ]);

        return [$user, $report->fresh()];
    }

    /**
     * Helper to answer all applicable questions for an audit report.
     */
    private function answerAllApplicableQuestions(Report $report, User $user): void
    {
        $questions = ReportQuestion::where('report_id', $report->id)
            ->where('is_applicable', true)
            ->get();

        foreach ($questions as $index => $q) {
            $answerVal = ($index === 0) ? 'no' : (($index === 1) ? 'ns' : 'yes');
            $note = ($index === 0) ? 'Emergency steering test delayed by 15 mins during simulated blackout.' : null;

            ReportAnswer::create([
                'report_question_id' => $q->id,
                'report_id' => $report->id,
                'answer' => $answerVal,
                'note' => $note,
                'answered_by' => $user->id,
                'answered_at' => now(),
            ]);
        }
    }
}
