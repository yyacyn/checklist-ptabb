<?php

namespace App\Services;

use App\Models\Finding;
use App\Models\Form;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\ReportAnswer;
use App\Models\ReportDataset;
use App\Models\ReportPhoto;
use Database\Seeders\FormSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AutoFillReportService
{
    /**
     * Completely fill all fields, questions, summary data, datasets, and findings on a report.
     */
    public function fill(Report $report): Report
    {
        return DB::transaction(function () use ($report) {
            $user = auth()->user() ?? $report->creator;
            $userId = $user?->id ?? $report->created_by;

            // 1. General Particulars
            $reportDate = $report->report_date ? Carbon::parse($report->report_date) : now();

            $report->update([
                'report_date' => $reportDate->toDateString(),
                'port' => $report->port ?: 'Singapore Anchorage',
                'master_name' => $report->master_name ?: 'Capt. Jonathan Archer',
                'chief_engineer_name' => $report->chief_engineer_name ?: 'C/E Charles Tucker',
                'chief_officer_name' => $report->chief_officer_name ?: "C/O T'Pol",
                'inspected_by' => $report->inspected_by ?: 'Capt. Malcolm Reed',
                'sailing_with_vessel' => true,
                'sailing_from' => $report->sailing_from ?: 'Port Klang',
                'sailing_to' => $report->sailing_to ?: 'Tokyo',
                'psc_last_port' => $report->psc_last_port ?: 'Shanghai',
                'psc_last_date' => $report->psc_last_date ?: $reportDate->copy()->subMonths(3)->toDateString(),
                'psc_detained_or_deficiencies' => false,
                'drydock_last_date' => $report->drydock_last_date ?: '2024-05-15',
                'drydock_next_date' => $report->drydock_next_date ?: '2027-05-15',
                'operations' => ! empty($report->operations) ? $report->operations : ['Bunkering', 'Loading'],
            ]);

            // 2. Questions & Answers
            $report->loadMissing(['questions.answer', 'form']);
            $questions = $report->questions;

            foreach ($questions as $index => $q) {
                if (! $q->is_applicable) {
                    continue;
                }

                $answerVal = 'yes';
                $extraValue = null;

                if ($q->input_type === 'text') {
                    $extraValue = 'Verified and compliant with onboard SMS documentation.';
                } else {
                    // Spread realistic variation across questions
                    if ($index % 17 === 0) {
                        $answerVal = 'no';
                    } elseif ($index % 23 === 0) {
                        $answerVal = ($report->form?->code === 'B-008') ? 'ns' : 'na';
                    }
                }

                ReportAnswer::updateOrCreate(
                    [
                        'report_id' => $report->id,
                        'report_question_id' => $q->id,
                    ],
                    [
                        'answer' => $answerVal,
                        'note' => null,
                        'extra_value' => $extraValue,
                        'answered_by' => $userId,
                        'answered_at' => now(),
                    ]
                );
            }

            // 2b. Chapter-Level Comments / Remarks
            $report->loadMissing('groups');
            foreach ($report->groups->whereNull('parent_id') as $chapterGroup) {
                if ($chapterGroup->chapter_no === '1' || strtolower($chapterGroup->title) === 'general information') {
                    continue;
                }
                if (empty($chapterGroup->comments)) {
                    $chapterGroup->update([
                        'comments' => 'All inspected items verified in satisfactory order and in accordance with company safety management standards.',
                    ]);
                }
            }

            // 3. Form-Specific Filling
            $formCode = $report->form?->code ?? ($report->report_type === 'audit' ? 'B-008' : 'D-062');

            if ($formCode === 'B-008' || $report->report_type === 'audit') {
                $this->fillB008Audit($report, $reportDate, $userId);
            } elseif ($formCode === 'D-062') {
                $this->fillD062Inspection($report, $userId);
            } elseif ($formCode === 'P-001' || $report->form?->form_type === 'photo') {
                $this->fillP001Photo($report, $userId);
            }

            $report->increment('current_version');

            return $report->fresh();
        });
    }

    protected function fillB008Audit(Report $report, Carbon $reportDate, ?int $userId): void
    {
        $currentSummary = $report->summary_data ?? [];

        $evaluationCriteria = $currentSummary['evaluation_criteria'] ?? [];
        if (empty($evaluationCriteria) && $report->form) {
            $evaluationCriteria = $report->form->evaluationCriteria()->orderBy('sort_order')->get()->map(fn ($c) => [
                'criterion_key' => $c->criterion_key,
                'label' => $c->label,
                'description' => $c->description,
                'sort_order' => $c->sort_order,
            ])->values()->all();
        }
        if (empty($evaluationCriteria)) {
            $evaluationCriteria = FormSeeder::defaultEvaluationCriteria();
        }

        $summaryData = array_merge($currentSummary, [
            'audit_type' => 'A',
            'audit_type_other' => null,
            'audit_end_date' => $reportDate->copy()->addDays(2)->toDateString(),
            'activities_audited' => ['Navigation watch', 'Mooring operations', 'Engine room maintenance'],
            'previous_audit_date' => $reportDate->copy()->subYear()->toDateString(),
            'previous_ncr_count' => 2,
            'previous_observation_count' => 4,
            'closeout_notes' => 'All previous findings verified and closed out during this audit.',
            'positive_comments' => 'Exceptional engine room cleanliness, strong safety culture demonstrated during fire drill, and well-maintained bridge logbooks.',
            'negative_comments' => 'Minor cosmetic paint peeling in forecastle store requires scheduled touch-up. Emergency steering drill communication protocol can be streamlined.',
            'evaluation_criteria' => $evaluationCriteria,
        ]);

        $report->update(['summary_data' => $summaryData]);

        // Datasets
        // 1. audit_people
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_people'],
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
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_evaluation'],
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
                        'comments' => 'Systematic record-keeping and passage planning.',
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
        ReportDataset::updateOrCreate(
            ['report_id' => $report->id, 'dataset_key' => 'audit_execution_log'],
            [
                'rows' => [
                    [
                        'person_or_function' => 'Opening Meeting',
                        'date' => $reportDate->toDateString(),
                        'start_time' => '08:30',
                        'end_time' => '09:30',
                        'topics' => 'Scope, audit plan, and introductory briefing with Master & Officers',
                        'sort_order' => 1,
                    ],
                    [
                        'person_or_function' => 'Bridge Team',
                        'date' => $reportDate->toDateString(),
                        'start_time' => '10:00',
                        'end_time' => '12:30',
                        'topics' => 'ECDIS, Passage planning, and navigation voyage records',
                        'sort_order' => 2,
                    ],
                    [
                        'person_or_function' => 'Engine Team',
                        'date' => $reportDate->copy()->addDay()->toDateString(),
                        'start_time' => '09:00',
                        'end_time' => '12:00',
                        'topics' => 'Oil record book, bilge alarm test, and auxiliary generator test',
                        'sort_order' => 3,
                    ],
                    [
                        'person_or_function' => 'Closing Meeting',
                        'date' => $reportDate->copy()->addDays(2)->toDateString(),
                        'start_time' => '14:00',
                        'end_time' => '15:30',
                        'topics' => 'Presentation of audit results, NCR debrief, and corrective action timetable',
                        'sort_order' => 4,
                    ],
                ],
                'row_version' => 1,
            ]
        );

        // Findings
        if ($report->findings()->count() === 0) {
            Finding::create([
                'report_id' => $report->id,
                'finding_kind' => 'non_conformity',
                'finding_no' => 'NC-01',
                'description' => 'Lifeboat painter line deteriorated and requires renewal.',
                'target_date' => $reportDate->copy()->addMonth()->toDateString(),
                'issue_date' => $reportDate->copy()->addDay()->toDateString(),
                'finding_status' => 'open',
                'risk' => 'high',
                'sort_order' => 1,
                'created_by' => $userId,
            ]);

            Finding::create([
                'report_id' => $report->id,
                'finding_kind' => 'observation',
                'finding_no' => 'OBS-01',
                'description' => 'Safety warning placard in workshop slightly faded.',
                'target_date' => $reportDate->copy()->addMonths(2)->toDateString(),
                'issue_date' => $reportDate->copy()->addDay()->toDateString(),
                'finding_status' => 'open',
                'risk' => 'low',
                'sort_order' => 2,
                'created_by' => $userId,
            ]);
        }
    }

    protected function fillD062Inspection(Report $report, ?int $userId): void
    {
        // Ratings matrix
        $ratings = [];
        for ($i = 2; $i <= 13; $i++) {
            $ratings["chapter_{$i}"] = ($i % 3 === 0) ? 'very_good' : 'satisfactory';
        }

        $currentSummary = $report->summary_data ?? [];
        $summaryData = array_merge($currentSummary, [
            'best_practices' => 'Crew demonstrated exceptional housekeeping in galley and engine room workshop. Maintenance logbooks for all deck winches are in exemplary order.',
            'summary_safety_meetings' => 'Safety meeting and emergency steering drill debrief held on board with all officers and deck crew.',
            'summary_participants' => 'Master, Chief Engineer, Chief Officer, 2nd Engineer, Bosun, ABs.',
            'summary_concept_understanding' => 'Crew demonstrated thorough understanding and commitment to company safety policies and pollution prevention protocols.',
            'summary_training_needs' => 'Refresher training recommended for ECDIS route validation and automated voyage planning features.',
            'senior_officers_appraisal' => [
                [
                    'rank' => 'Master',
                    'name' => $report->master_name ?: 'Capt. Jonathan Archer',
                    'comments' => 'The familiarity with on-board safety systems and equipment confirmed in good order.',
                    'appraised' => true,
                ],
                [
                    'rank' => 'Chief Engineer',
                    'name' => $report->chief_engineer_name ?: 'C/E Charles Tucker',
                    'comments' => 'High standard of engine room procedures and environmental compliance verified.',
                    'appraised' => true,
                ],
                [
                    'rank' => 'Chief Officer',
                    'name' => $report->chief_officer_name ?: "C/O T'Pol",
                    'comments' => 'Navigation oversight and cargo equipment handling verified satisfactory.',
                    'appraised' => true,
                ],
                [
                    'rank' => 'Second Engineer',
                    'name' => '2/E Trip Smith',
                    'comments' => 'Watchkeeping and auxiliary machinery maintenance confirmed in order.',
                    'appraised' => true,
                ],
            ],
        ]);

        $report->update([
            'summary_ratings' => $ratings,
            'summary_data' => $summaryData,
        ]);

        // Findings
        if ($report->findings()->count() === 0) {
            Finding::create([
                'report_id' => $report->id,
                'finding_kind' => 'observation',
                'chapter_label' => 'Chapter 5 - Safety Management',
                'viq_paragraph' => '5.2.1',
                'description' => 'Emergency fire pump suction valve handle stiff to operate. Needs lubrication.',
                'target_date' => now()->addDays(14)->toDateString(),
                'issue_date' => now()->toDateString(),
                'finding_status' => 'open',
                'risk' => 'medium',
                'sort_order' => 1,
                'created_by' => $userId,
            ]);

            Finding::create([
                'report_id' => $report->id,
                'finding_kind' => 'observation',
                'chapter_label' => 'Chapter 4 - Bridge & Navigation',
                'viq_paragraph' => '4.1.3',
                'description' => 'Secondary ECDIS backup power unit display contrast dim.',
                'target_date' => now()->addDays(30)->toDateString(),
                'issue_date' => now()->toDateString(),
                'finding_status' => 'open',
                'risk' => 'low',
                'sort_order' => 2,
                'created_by' => $userId,
            ]);
        }
    }

    protected function fillP001Photo(Report $report, ?int $userId): void
    {
        $schema = $report->form?->photo_schema ?? [];
        $items = $schema['items'] ?? [];
        $category = PhotoCategory::first();

        foreach ($items as $idx => $slot) {
            $slotNo = $idx + 1;
            if (! $report->photos()->where('item_no', $slotNo)->exists()) {
                ReportPhoto::create([
                    'report_id' => $report->id,
                    'item_no' => $slotNo,
                    'title' => $slot['title'] ?? "Photo Item #{$slotNo}",
                    'caption' => "Inspection record photograph for {$slot['title']}",
                    'description' => 'Photo taken during vessel inspection showing normal operating condition.',
                    'file_path' => 'photos/placeholder.jpg',
                    'file_size' => 10240,
                    'mime_type' => 'image/jpeg',
                    'sort_order' => $slotNo,
                    'uploaded_by' => $userId,
                    'photo_category_id' => $category?->id,
                ]);
            }
        }
    }
}
