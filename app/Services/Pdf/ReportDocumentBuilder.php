<?php

namespace App\Services\Pdf;

use App\Models\Report;
use App\Models\ReportGroup;
use App\Models\ReportQuestion;
use Database\Seeders\FormSeeder;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Builds a normalized, query-optimized plain array representation of a report (ReportDocument)
 * for PDF rendering (Tasks 6.1, 6.2, REP-1g).
 *
 * Guaranteed query count: <= 6 queries total (well under the 12 query target).
 */
class ReportDocumentBuilder
{
    /**
     * Build the ReportDocument array from the given report.
     *
     * @return array<string, mixed>
     *
     * @throws InvalidArgumentException
     */
    public function build(Report $report): array
    {
        $this->validateRequiredFields($report);

        // 1. Eager load single/direct relations
        $report->loadMissing([
            'form',
            'vesselType',
            'findings' => fn ($q) => $q->orderBy('id'),
            'photos' => fn ($q) => $q->orderBy('item_no')->orderBy('sort_order')->orderBy('id'),
            'photos.category',
            'datasets',
        ]);

        // 2. Fetch all groups and questions in 2 bulk queries
        $allGroups = ReportGroup::query()
            ->where('report_id', $report->id)
            ->orderBy('sort_order')
            ->get();

        $allQuestions = ReportQuestion::query()
            ->where('report_id', $report->id)
            ->with('answer')
            ->orderBy('sort_order')
            ->get();

        $questionsByGroupId = $allQuestions->groupBy('report_group_id');
        $subgroupsByParentId = $allGroups->whereNotNull('parent_id')->groupBy('parent_id');
        $topLevelGroups = $allGroups->whereNull('parent_id')->sortBy('sort_order');

        // 3. Assemble structured chapters
        $chapters = [];
        $chapterAnswerCounts = [];

        foreach ($topLevelGroups as $group) {
            $isCh1 = $this->isChapterOne($group);
            $groupDirectQuestions = $questionsByGroupId->get($group->id, collect());
            $groupSubgroups = $subgroupsByParentId->get($group->id, collect());

            $formattedQuestions = [];
            $noCount = 0;
            $nsCount = 0;

            foreach ($groupDirectQuestions as $q) {
                $ansVal = strtolower(trim((string) ($q->answer?->answer ?? '')));
                if ($ansVal === 'no') {
                    $noCount++;
                } elseif ($ansVal === 'ns' || $ansVal === 'n/s') {
                    $nsCount++;
                }

                $cleanQuestionText = preg_replace('/^\s*(\d+(\.\d+)*)[\.\)]\s*/u', '', (string) $q->question_text);

                $formattedQuestions[] = [
                    'id' => $q->id,
                    'display_no' => $q->display_no ?: (string) ($q->sort_order + 1),
                    'question_text' => $cleanQuestionText,
                    'guidance' => $q->guidance,
                    'input_type' => $q->input_type,
                    'is_applicable' => (bool) $q->is_applicable,
                    'applicable_reason' => $q->applicable_reason,
                    'answer' => $ansVal,
                    'note' => $q->answer?->note,
                    'extra_value' => $q->answer?->extra_value,
                ];
            }

            $formattedSubgroups = [];
            foreach ($groupSubgroups as $sg) {
                $sgQuestions = $questionsByGroupId->get($sg->id, collect());
                $formattedSgQuestions = [];

                foreach ($sgQuestions as $q) {
                    $ansVal = strtolower(trim((string) ($q->answer?->answer ?? '')));
                    if ($ansVal === 'no') {
                        $noCount++;
                    } elseif ($ansVal === 'ns' || $ansVal === 'n/s') {
                        $nsCount++;
                    }

                    $cleanSgQuestionText = preg_replace('/^\s*(\d+(\.\d+)*)[\.\)]\s*/u', '', (string) $q->question_text);

                    $formattedSgQuestions[] = [
                        'id' => $q->id,
                        'display_no' => $q->display_no ?: (string) ($q->sort_order + 1),
                        'question_text' => $cleanSgQuestionText,
                        'guidance' => $q->guidance,
                        'input_type' => $q->input_type,
                        'is_applicable' => (bool) $q->is_applicable,
                        'applicable_reason' => $q->applicable_reason,
                        'answer' => $ansVal,
                        'note' => $q->answer?->note,
                        'extra_value' => $q->answer?->extra_value,
                    ];
                }

                $formattedSubgroups[] = [
                    'id' => $sg->id,
                    'title' => $sg->title,
                    'display_no' => $sg->display_no,
                    'is_applicable' => (bool) $sg->is_applicable,
                    'na_reason' => $sg->na_reason,
                    'questions' => $formattedSgQuestions,
                ];
            }

            $chKey = (string) ($group->chapter_no ?: $group->sort_order);
            $chapterAnswerCounts[$chKey] = [
                'no_count' => $noCount,
                'ns_count' => $nsCount,
            ];

            $chapters[] = [
                'id' => $group->id,
                'no' => $chKey,
                'display_no' => $group->display_no ?: $chKey,
                'title' => $group->title,
                'is_chapter_one' => $isCh1,
                'is_applicable' => (bool) $group->is_applicable,
                'na_reason' => $group->na_reason,
                'comments' => $group->comments,
                'questions' => $formattedQuestions,
                'subgroups' => $formattedSubgroups,
                'no_count' => $noCount,
                'ns_count' => $nsCount,
            ];
        }

        // 4. Observations & Findings summary counts
        $findings = $report->findings ?? collect();
        $findingsData = [];
        $highCount = 0;
        $medCount = 0;
        $lowCount = 0;

        $ncrCount = 0;
        $obsCount = 0;

        foreach ($findings as $f) {
            $risk = strtolower(trim((string) ($f->risk ?? $f->severity ?? '')));
            if ($risk === 'high') {
                $highCount++;
            } elseif ($risk === 'medium') {
                $medCount++;
            } elseif ($risk === 'low') {
                $lowCount++;
            }

            if ($f->finding_kind === 'non_conformity') {
                $ncrCount++;
            } else {
                $obsCount++;
            }

            $findingsData[] = [
                'id' => $f->id,
                'finding_no' => $f->finding_no,
                'finding_kind' => $f->finding_kind ?? 'observation',
                'chapter_label' => $f->chapter_label,
                'viq_paragraph' => $f->viq_paragraph,
                'description' => $f->description,
                'risk' => ucfirst($risk ?: '-'),
                'job_order_no' => $f->job_order_no ?: '-',
                'target_date' => $f->target_date?->format('d F Y') ?: '-',
                'issue_date' => $f->issue_date?->format('d F Y') ?: ($f->created_at?->format('d F Y') ?: '-'),
            ];
        }

        // 5. Photos normalization
        $photos = $report->photos ?? collect();
        $photosData = [];
        foreach ($photos as $p) {
            $localPath = null;
            if (! empty($p->file_path)) {
                $candidate = storage_path('app/public/'.$p->file_path);
                if (file_exists($candidate)) {
                    $localPath = $candidate;
                }
            }

            $photosData[] = [
                'id' => $p->id,
                'item_no' => (int) ($p->item_no ?? $p->sort_order ?? 1),
                'title' => $p->title,
                'caption' => $p->caption,
                'description' => $p->description,
                'category_name' => $p->category?->name,
                'location' => $p->location,
                'file_path' => $p->file_path,
                'local_path' => $localPath,
                'file_url' => $p->file_url,
            ];
        }

        $photoSchema = $report->form->photo_schema ?? [];
        $photoSchemaItems = $photoSchema['items'] ?? [];
        $photoSectionComments = $report->summary_data['photo_section_comments'] ?? [];

        $photoSections = [];
        $additionalPhotos = [];

        if (! empty($photoSchemaItems) && is_array($photoSchemaItems)) {
            $matchedPhotoIds = [];
            foreach ($photoSchemaItems as $idx => $slot) {
                $slotNo = $idx + 1;
                $slotId = (string) ($slot['id'] ?? $slotNo);
                $slotTitle = (string) ($slot['title'] ?? '');
                $slotDescription = $slot['description'] ?? null;
                $comment = $photoSectionComments[$slotId] ?? $photoSectionComments[(string) $slotNo] ?? null;

                $matchedPhotos = [];
                foreach ($photosData as $pData) {
                    $matches = ($pData['item_no'] === $slotNo) ||
                        (! empty($pData['title']) && strtolower(trim((string) $pData['title'])) === strtolower(trim($slotTitle)));
                    if ($matches) {
                        $matchedPhotos[] = $pData;
                        $matchedPhotoIds[$pData['id']] = true;
                    }
                }

                $photoSections[] = [
                    'slot_no' => $slotNo,
                    'id' => $slotId,
                    'title' => $slotTitle,
                    'description' => $slotDescription,
                    'comment' => $comment,
                    'photos' => $matchedPhotos,
                ];
            }

            foreach ($photosData as $pData) {
                if (! isset($matchedPhotoIds[$pData['id']])) {
                    $additionalPhotos[] = $pData;
                }
            }
        } else {
            $additionalPhotos = $photosData;
        }

        // 5b. Audit particulars normalization (B-008, SRS 14.4, Task 7.2)
        $summary = $report->summary_data ?? [];
        $datasets = $report->relationLoaded('datasets') ? $report->datasets : $report->datasets()->get();
        $auditPeopleDataset = $datasets->firstWhere('dataset_key', 'audit_people');
        $peopleRows = $auditPeopleDataset?->rows ?? [];

        $auditors = [];
        $auditees = [];
        foreach ($peopleRows as $person) {
            $roleLower = strtolower($person['role'] ?? '');
            if (str_contains($roleLower, 'auditor')) {
                $auditors[] = [
                    'name' => $person['name'] ?? '',
                    'rank' => $person['rank'] ?? '',
                    'role' => $person['role'] ?? 'Auditor',
                    'is_lead' => $roleLower === 'lead auditor' || $roleLower === 'lead_auditor' || ! empty($person['is_lead']),
                ];
            } else {
                $auditees[] = [
                    'name' => $person['name'] ?? '',
                    'rank' => $person['rank'] ?? '',
                    'role' => $person['role'] ?? 'Auditee',
                ];
            }
        }

        $auditTypeLabels = [
            'A' => 'A - Internal',
            'B' => 'B - Independent',
            'C' => 'C - Unscheduled',
            'D' => 'D - Other',
        ];
        $rawAuditType = $summary['audit_type'] ?? 'A';
        $auditTypeLabel = $auditTypeLabels[$rawAuditType] ?? $rawAuditType ?? 'A - Internal';

        $startDateStr = $report->report_date?->format('d F Y');
        $endDateRaw = $summary['audit_end_date'] ?? $report->report_date?->toDateString();
        $endDateStr = $endDateRaw ? Carbon::parse($endDateRaw)->format('d F Y') : $startDateStr;

        $auditData = [
            'start_date' => $startDateStr,
            'end_date' => $endDateStr,
            'start_date_raw' => $report->report_date?->toDateString(),
            'end_date_raw' => $endDateRaw,
            'audit_type' => $rawAuditType,
            'audit_type_label' => $auditTypeLabel,
            'audit_type_other' => $summary['audit_type_other'] ?? null,
            'lead_auditor' => $summary['lead_auditor'] ?? null,
            'activities' => $summary['activities_audited'] ?? ['Bridge', 'Deck', 'Engine'],
            'auditees' => $auditees,
            'auditors' => $auditors,
            'previous_audit_date' => $summary['previous_audit_date'] ?? null,
            'previous_ncr_count' => $summary['previous_ncr_count'] ?? 0,
            'previous_observation_count' => $summary['previous_observation_count'] ?? 0,
            'closeout_notes' => $summary['closeout_notes'] ?? null,
        ];

        // 5c. Auditee evaluation (AUD-11, Task 7.6)
        $auditEvaluationDataset = $datasets->firstWhere('dataset_key', 'audit_evaluation');
        $evalRows = $auditEvaluationDataset?->rows ?? [];
        $evalCriteria = $summary['evaluation_criteria'] ?? [];
        if (empty($evalCriteria) && $report->form) {
            $evalCriteria = $report->form->evaluationCriteria()->orderBy('sort_order')->get()->map(fn ($c) => [
                'criterion_key' => $c->criterion_key,
                'label' => $c->label,
                'description' => $c->description,
                'sort_order' => $c->sort_order,
            ])->values()->all();
        }
        if (empty($evalCriteria)) {
            $evalCriteria = FormSeeder::defaultEvaluationCriteria();
        }

        $auditEvaluationData = [
            'criteria' => $evalCriteria,
            'definitions' => FormSeeder::SCORE_DEFINITIONS,
            'rows' => $evalRows,
        ];

        // 5d. Audit execution log & general comments (AUD-12, AUD-13, Task 7.7)
        $auditExecutionDataset = $datasets->firstWhere('dataset_key', 'audit_execution_log');
        $executionLogRows = $auditExecutionDataset?->rows ?? [];
        $positiveComments = $summary['positive_comments'] ?? '';
        $negativeComments = $summary['negative_comments'] ?? '';

        // 6. Summary ratings matrix
        $summarySchema = $report->form->summary_schema ?? [];
        $ratingOptions = $summarySchema['rating_options'] ?? [
            ['value' => 'very_good', 'label' => 'Very Good'],
            ['value' => 'satisfactory', 'label' => 'Satisfactory'],
            ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
        ];

        $ratingsRows = [];
        foreach ($chapters as $ch) {
            if ($ch['is_chapter_one']) {
                continue;
            }
            $chOrder = $ch['no'];
            $ratingVal = $report->summary_ratings['chapter_'.$chOrder]
                ?? $report->summary_ratings['chapter_'.$ch['display_no']]
                ?? null;

            $ratingsRows[] = [
                'no' => $ch['display_no'],
                'title' => $ch['title'],
                'is_applicable' => (bool) ($ch['is_applicable'] ?? true),
                'rating' => $ratingVal,
                'no_count' => $ch['no_count'],
                'ns_count' => $ch['ns_count'],
            ];
        }

        // 7. Status and watermarking
        $isDraft = in_array($report->status, ['draft', 'in_progress', 'reopened'], true);
        $statusLabel = strtoupper(str_replace('_', ' ', (string) $report->status));

        return [
            'meta' => [
                'report_id' => $report->id,
                'reference_number' => $report->reference_number,
                'form_id' => $report->form_id,
                'form_code' => $report->form->code ?? '',
                'form_name' => $report->form->name ?? '',
                'form_type' => $report->form->form_type ?? 'standard',
                'form_version' => $report->form->form_version ?? '',
                'template_version' => $report->template_version ?? 1,
                'report_type' => $report->report_type,
                'report_date' => $report->report_date->format('d F Y'),
                'report_date_raw' => $report->report_date->toDateString(),
                'status' => $report->status,
                'status_label' => $statusLabel,
                'is_draft' => $isDraft,
                'watermark' => $isDraft ? 'DRAFT' : '',
                'current_version' => $report->current_version,
                'generated_at' => now()->format('Y-m-d H:i').' UTC',
            ],
            'vessel' => [
                'name' => $report->vessel_name,
                'imo' => $report->vessel_imo,
                'flag' => $report->vessel_flag,
                'gt' => $report->vessel_gt,
                'built' => $report->vessel_built,
                'type_name' => $report->vesselType?->name,
                'ice_class' => (bool) $report->vessel_ice_class,
                'master_name' => $report->master_name,
                'chief_engineer_name' => $report->chief_engineer_name,
                'chief_officer_name' => $report->chief_officer_name,
            ],
            'particulars' => [
                'inspected_by' => $report->inspected_by,
                'port' => $report->port,
                'operations' => is_array($report->operations) ? $report->operations : [],
                'psc' => [
                    'last_port' => $report->psc_last_port,
                    'last_date' => $report->psc_last_date?->format('d F Y'),
                    'detained_or_deficiencies' => (bool) $report->psc_detained_or_deficiencies,
                ],
                'drydock' => [
                    'last_date' => $report->drydock_last_date?->format('d F Y'),
                    'next_date' => $report->drydock_next_date?->format('d F Y'),
                ],
                'voyage' => [
                    'sailing_with_vessel' => (bool) $report->sailing_with_vessel,
                    'from' => $report->sailing_from,
                    'to' => $report->sailing_to,
                ],
            ],
            'chapters' => $chapters,
            'summary' => [
                'has_ratings_matrix' => (bool) ($summarySchema['has_ratings_matrix'] ?? false),
                'rating_options' => $ratingOptions,
                'ratings' => $ratingsRows,
                'best_practices' => $report->summary_data['best_practices'] ?? $report->summary_data['best_practices_text'] ?? '',
                'counts' => [
                    'high' => $highCount,
                    'medium' => $medCount,
                    'low' => $lowCount,
                    'ncr' => $ncrCount,
                    'observation' => $obsCount,
                    'total_findings' => count($findingsData),
                ],
                'text_fields' => $summarySchema['text_fields'] ?? [],
                'summary_data' => $report->summary_data ?? [],
            ],
            'findings' => $findingsData,
            'photos' => $photosData,
            'photo_sections' => $photoSections,
            'additional_photos' => $additionalPhotos,
            'audit' => array_merge($auditData, [
                'current_ncr_count' => $ncrCount,
                'current_observation_count' => $obsCount,
                'execution_log' => $executionLogRows,
                'positive_comments' => $positiveComments,
                'negative_comments' => $negativeComments,
            ]),
            'evaluation' => $auditEvaluationData,
            'execution_log' => $executionLogRows,
            'positive_comments' => $positiveComments,
            'negative_comments' => $negativeComments,
        ];
    }

    /**
     * Validate that mandatory fields exist on the report.
     */
    protected function validateRequiredFields(Report $report): void
    {
        if (empty($report->reference_number)) {
            throw new InvalidArgumentException("Report {$report->id} is missing a reference number.");
        }

        if (empty($report->vessel_name)) {
            throw new InvalidArgumentException("Report {$report->id} is missing a vessel name.");
        }

        if (empty($report->report_date)) {
            throw new InvalidArgumentException("Report {$report->id} is missing a report date.");
        }
    }

    protected function isChapterOne(ReportGroup $group): bool
    {
        return $group->chapter_no === '1'
            || $group->chapter_no === '1.0'
            || strtolower($group->title) === 'general information';
    }
}
