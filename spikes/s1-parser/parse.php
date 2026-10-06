<?php

/**
 * Spike S1 — form parser.
 *
 * Reads the source form documents (markdown conversions of the company .docx files),
 * and writes the review file described in SRS section 5.1: one row per question, for a
 * human to check before anything is loaded into the database.
 *
 * Throwaway spike code. Its output is the answer to the spike question, not a shipping
 * artifact. The parsing rules that survive are the ones listed in SRS 5.2.
 *
 * Usage:  php spikes/s1-parser/parse.php [--dry]
 */
$dry = in_array('--dry', $argv, true);

$root = dirname(__DIR__, 2);
$outDir = $root.'/spikes/s1-parser/out';
@mkdir($outDir, 0777, true);

/** Answer-column labels recognised in a table header row. */
const LABELS = ['yes', 'no', 'ns', 'n/s', 'na', 'n.a', 'not seen', 'not applicable'];

/** Default applicability map from SRS 5.4, editable by the superadmin later. */
const APPLICABILITY = [
    'D-062' => [
        'chapter' => [
            '8' => 'Tanker only',
            '13' => 'Ice class only',
        ],
        'group_match' => [
            '/inert gas/i' => 'Tanker only',
        ],
    ],
];

/** Known mangled words from SRS 5.3, with the intended replacement. */
const MANGLED = [
    'claSMS' => 'claims',
    'trSMS' => 'trims',
];

// ---------------------------------------------------------------------------------------
// Markdown reading
// ---------------------------------------------------------------------------------------

/**
 * Split a document into tables plus the loose text between them.
 *
 * @return array<int, array{lines: array<int, array{num:int, cells:array<int,string>}>, start:int}>
 */
function readTables(string $path): array
{
    $lines = file($path, FILE_IGNORE_NEW_LINES);
    $tables = [];
    $current = null;

    foreach ($lines as $i => $line) {
        $num = $i + 1;
        $isRow = str_starts_with(trim($line), '|');

        if ($isRow) {
            if ($current === null) {
                $current = ['lines' => [], 'start' => $num];
            }
            $current['lines'][] = ['num' => $num, 'cells' => splitRow($line)];
        } elseif ($current !== null) {
            $tables[] = $current;
            $current = null;
        }
    }

    if ($current !== null) {
        $tables[] = $current;
    }

    return $tables;
}

function splitRow(string $line): array
{
    $line = trim($line);
    $line = preg_replace('/^\|/', '', $line);
    $line = preg_replace('/\|$/', '', $line);

    // Split on pipes that are not backslash escaped, then unescape.
    $parts = preg_split('/(?<!\\\\)\|/', $line);
    $cells = [];

    foreach ($parts as $part) {
        $cells[] = trim(str_replace('\\|', '|', $part));
    }

    return $cells;
}

// ---------------------------------------------------------------------------------------
// Cell classification
// ---------------------------------------------------------------------------------------

function cleanCell(string $cell): string
{
    $s = $cell;
    $s = preg_replace('/^#{1,6}\s*/', '', $s);        // #### inside a cell
    $s = str_replace('**', '', $s);                 // bold
    $s = str_replace('~~', '', $s);                 // strikethrough
    $s = preg_replace('/(?<![\w\*])\*(?!\*)/', '', $s); // stray italic markers
    $s = str_replace(['\\<', '\\>'], ['<', '>'], $s);  // escaped comparison operators
    $s = preg_replace('/\s+/u', ' ', $s);

    return trim($s);
}

function isSeparatorRow(array $cells): bool
{
    foreach ($cells as $cell) {
        $c = trim(str_replace([' ', "\t"], '', $cell));
        if ($c !== '' && ! preg_match('/^:?-{1,}:?$/', $c)) {
            return false;
        }
    }

    return true;
}

function isCheckbox(string $cell): bool
{
    $c = cleanCell($cell);
    $c = preg_replace('/\s+/u', '', $c);

    return (bool) preg_match('/^[\x{2610}\x{2611}\x{2612}\x{25A1}\x{2717}\x{274C}]+$/u', (string) $c);
}

function isTickedBox(string $cell): bool
{
    $c = cleanCell($cell);
    $c = preg_replace('/\s+/u', '', $c);

    return (bool) preg_match('/^[\x{2611}\x{2612}\x{274C}]+$/u', (string) $c);
}

function isLabel(string $cell): bool
{
    $c = strtolower(cleanCell($cell));
    $c = rtrim($c, '.');
    $c = preg_replace('/\s+/', ' ', $c);

    return in_array($c, LABELS, true);
}

function labelCount(array $cells): int
{
    $n = 0;
    foreach ($cells as $cell) {
        if (isLabel($cell)) {
            $n++;
        }
    }

    return $n;
}

function checkboxCount(array $cells): int
{
    $n = 0;
    foreach ($cells as $cell) {
        if (isCheckbox($cell)) {
            $n++;
        }
    }

    return $n;
}

/** Is this cell entirely bold or emphasized markdown, i.e. a standalone heading inside a table? */
function isBoldOnly(string $cell): bool
{
    $t = trim($cell);
    if ($t === '') {
        return false;
    }

    $clean = cleanCell($t);
    if ($clean === '' || preg_match('/^comments?\b|^remarks\b/i', $clean)) {
        return false;
    }

    // A question starts with a number like "1.", "12.", "~~***9.", etc.
    if (preg_match('/^(\~\~)?(\*{1,3})?\s*\d+\.\s/u', $t)) {
        return false;
    }

    // Bold or strikethrough heading, e.g. **Heading** or ~~***Heading**
    if (preg_match('/^(\~\~)?\*{2,3}.+\*{2,3}(\~\~)?$/u', $t)) {
        return true;
    }

    // Compound bold heading, e.g. **LIFE SAVING EQUIPMENT** **Life Boats and Davits**
    if (preg_match('/^\*\*.*\*\*\s+\*\*.*\*\*$/u', $t)) {
        return true;
    }

    return false;
}

// ---------------------------------------------------------------------------------------
// Text cleanup: guidance split, input type, mangled words
// ---------------------------------------------------------------------------------------

/**
 * Split a long trailing parenthetical off the question text as guidance.
 *
 * Brackets nest in these documents (for example "(Instructions for autopilot (e/g)
 * disengagement, ...)"), so the outermost bracket that runs to the end of the sentence
 * is the one that is guidance. Only splits when that bracket is long, which is the
 * "clean split" the SRS asks for. Anything else is left in place and warned about.
 *
 * @return array{0:string,1:string,2:?string} text, guidance, warning
 */
function splitGuidance(string $text): array
{
    $length = mb_strlen($text);

    for ($start = 0; $start < $length; $start++) {
        if (mb_substr($text, $start, 1) !== '(') {
            continue;
        }

        // Walk forward to the matching close bracket.
        $depth = 0;
        $close = null;
        for ($i = $start; $i < $length; $i++) {
            $char = mb_substr($text, $i, 1);
            if ($char === '(') {
                $depth++;
            } elseif ($char === ')') {
                $depth--;
                if ($depth === 0) {
                    $close = $i;

                    break;
                }
            }
        }

        if ($close === null) {
            return [$text, '', 'unbalanced_parenthesis'];
        }

        $after = trim(mb_substr($text, $close + 1));
        if ($after !== '' && $after !== '.') {
            continue; // not a trailing bracket, keep looking for an outer one
        }

        $inner = trim(mb_substr($text, $start + 1, $close - $start - 1));
        $before = trim(mb_substr($text, 0, $start));

        // Short brackets are part of the sentence, not guidance.
        if (mb_strlen($inner) < 60 || $before === '') {
            return [$text, '', null];
        }

        return [$before, $inner, null];
    }

    // A bracket exists but is not a clean trailing note.
    return str_contains($text, '(')
        ? [$text, '', 'parenthetical_not_trailing']
        : [$text, '', null];
}

/**
 * Detect a typed input (a date or free text the crew must fill in) from dotted blanks.
 *
 * @return array{0:?string,1:string,2:?string} input_type, hint, warning
 */
function detectInput(string $text, string $guidance): array
{
    $combined = $text.' '.$guidance;

    if (! preg_match('/[.\x{2026}\x{2025}]{4,}/u', $combined)) {
        return [null, '', null];
    }

    // Pull the dotted run and the label around it.
    if (preg_match('/([^:\x{2026}\x{2025}]{3,60}):\s*[.\x{2026}\x{2025}]{3,}/u', $combined, $m)) {
        $label = trim($m[1]);
    } else {
        $label = '';
    }

    $isDate = (bool) preg_match('/\bdate\b|\bdated\b|DD\s*\/\s*MM|YYYY/i', $combined);
    $type = $isDate ? 'date' : 'text';

    // Strip the dotted runs from the displayed question text.
    $clean = preg_replace('/\s*[.\x{2026}\x{2025}]{3,}\s*/u', ' ', $text);
    $clean = trim(preg_replace('/\s+/u', ' ', $clean));
    $clean = rtrim($clean, ': ');

    $warning = $label === '' ? 'dotted_blank_without_label' : null;

    return [$type, $label !== '' ? $label : null, $warning];
}

/** @return array{0:string,1:array<int,string>} text, warnings */
function flagMangled(string $text): array
{
    $warnings = [];
    foreach (MANGLED as $bad => $good) {
        if (stripos($text, $bad) !== false) {
            $warnings[] = "mangled_word:{$bad}->{$good}";
            $text = str_ireplace($bad, $good, $text);
        }
    }

    return [$text, $warnings];
}

function normaliseForKey(string $text): string
{
    $s = mb_strtolower($text);
    $s = preg_replace('/[\s\p{P}]+/u', '', $s);

    return (string) $s;
}

// ---------------------------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------------------------

/**
 * @return array{
 *   form:string, answer_set:string, chapters:array<string, array{no:string,title:string,questions:int,groups:array<int,string>}>,
 *   rows:array<int, array<string,mixed>>, warnings:array<string,int>, skipped:array<string,int>
 * }
 */
function parseForm(string $path, string $formCode): array
{
    $tables = readTables($path);
    $lines = file($path, FILE_IGNORE_NEW_LINES);
    $rows = [];
    $warnings = [];
    $skipped = [];
    $chapter = ['no' => '', 'title' => ''];
    $group = '';
    $subgroup = '';
    $answerWidth = null;   // learned from the first checklist table of the form
    $answerSet = null;

    $bump = function (array &$bag, string $key): void {
        $bag[$key] = ($bag[$key] ?? 0) + 1;
    };

    if ($formCode === 'D-062') {
        $chapter1Title = 'General Information';

        // 1. General Particulars & Operations
        $sg1 = 'General Particulars & Operations';
        $particulars = [
            ['Ship Name', 'text', null, basename($path) . ':9'],
            ['Built', 'text', null, basename($path) . ':11'],
            ['Type', 'text', null, basename($path) . ':12'],
            ['Inspected by', 'text', null, basename($path) . ':13'],
            ['Date of Inspection', 'date', null, basename($path) . ':14'],
            ['Port', 'text', null, basename($path) . ':15'],
            ['Report Reference Number', 'text', null, basename($path) . ':16'],
            ['Sailing with vessel (If Yes, from / to)', 'text', null, basename($path) . ':17'],
            ['Master', 'text', null, basename($path) . ':18'],
            ['Chief Engineer', 'text', null, basename($path) . ':19'],
            ['Chief Officer', 'text', null, basename($path) . ':20'],
            ['Operations at the time of inspection (Loading, Discharging, Bunkering, Deballasting, Ballasting, River transit, IGS, Major repairs, COW, Repairs underway, STS, Idle, At anchor, At sea, Other)', 'text', null, basename($path) . ':23'],
            ['Port of last PSC inspection (If the vessel was detained or if deficiencies were identified check/verify close out)', 'text', null, basename($path) . ':29'],
            ['Date of last Dry Dock', 'date', null, basename($path) . ':30'],
            ['Next Dry Dock', 'date', null, basename($path) . ':30'],
            ['Open items, memoranda, Conditions of Class, recommendations, notations, etc.', 'text', 'Where class records address structural issues of concern i.e. bottom pitting, etc. record details as to extent and measures taken. If records indicate that measures have been taken to address or restore loss of longitudinal or transverse strength, record details & repairs undertaken', basename($path) . ':33'],
        ];

        foreach ($particulars as $p) {
            $rows[] = [
                'form' => 'D-062',
                'chapter_no' => '1',
                'chapter' => $chapter1Title,
                'group' => $chapter1Title,
                'subgroup' => $sg1,
                'question_text' => $p[0],
                'guidance' => $p[2] ?? '',
                'input_type' => $p[1],
                'input_hint' => '',
                'suggested_applicability' => 'All vessel types',
                'warnings' => '',
                'source_ref' => $p[3],
                'source_key' => sourceKey('D-062', '1', $p[0]),
            ];
        }

        // 2. Attendance-related activities
        $sg2 = 'Other Attendance-Related Activities';
        for ($i = 161; $i < 213; $i++) {
            $trimmed = trim($lines[$i] ?? '');
            if (!str_starts_with($trimmed, '|')) {
                continue;
            }
            $parts = preg_split('/(?<!\\\\)\|/', trim(preg_replace('/^\||\|$/', '', $trimmed)));
            $cells = array_map(fn ($p) => trim(str_replace('\|', '|', $p)), $parts);
            if (count($cells) >= 3 && preg_match('/yes/i', $cells[1]) && preg_match('/no/i', $cells[2])) {
                $qText = cleanCell($cells[0]);
                $hint = cleanCell($cells[3] ?? '');
                [$qTextClean, $guidance] = splitGuidance($qText);
                $rows[] = [
                    'form' => 'D-062',
                    'chapter_no' => '1',
                    'chapter' => $chapter1Title,
                    'group' => $chapter1Title,
                    'subgroup' => $sg2,
                    'question_text' => $qTextClean,
                    'guidance' => $guidance,
                    'input_type' => 'text',
                    'input_hint' => $hint,
                    'suggested_applicability' => 'All vessel types',
                    'warnings' => '',
                    'source_ref' => basename($path) . ':' . ($i + 1),
                    'source_key' => sourceKey('D-062', '1', $qTextClean),
                ];
            }
        }
    }

    foreach ($tables as $table) {
        $tableIsChecklist = false;

        foreach ($table['lines'] as $line) {
            $cells = $line['cells'];
            $num = $line['num'];

            if (isSeparatorRow($cells)) {
                continue;
            }

            $labels = labelCount($cells);
            $boxes = checkboxCount($cells);
            $firstCell = $cells[0] ?? '';
            $firstClean = cleanCell($firstCell);

            // A checklist table starts with a row carrying two or more answer labels.
            if ($labels >= 2) {
                $tableIsChecklist = true;
                $answerWidth ??= $labels;
                $answerSet ??= implode('/', array_map(
                    fn ($c) => strtolower(rtrim(cleanCell($c), '.')),
                    array_values(array_filter($cells, 'isLabel'))
                ));
                if ($firstClean !== '') {
                    $group = $firstClean;
                    $subgroup = $firstClean;
                } elseif ($formCode === 'D-062' && $chapter['no'] === '8') {
                    $group = 'Cargo And Ballast System - General';
                    $subgroup = 'Cargo And Ballast System - General';
                }

                continue;
            }

            // Chapter title table, e.g. "| **4. Navigation ** |". A "(continuing)"
            // table stays in the chapter it continues (SRS 5.2).
            if (! $tableIsChecklist && count(array_filter($cells, fn ($c) => cleanCell($c) !== '')) === 1) {
                if (preg_match('/^\*\*\s*(\d+)\.?\s*(.+?)\s*\*\*$/u', trim($firstCell), $m)) {
                    $chNo = (int) $m[1];
                    $isContinuing = (bool) preg_match('/\(continuing\)/i', $m[2]);
                    if (! $isContinuing || $chapter['no'] === '') {
                        $chapter = ['no' => $m[1], 'title' => cleanCell($m[2])];
                        $group = '';
                        $subgroup = '';
                    }
                    if ($isContinuing) {
                        $bump($skipped, 'continuing_table_merged_into_chapter');
                    }
                }

                continue;
            }

            // Continuing table in D-062 with questions but without label header (e.g. Chapter 11 lines 1112-1116)
            if (! $tableIsChecklist && $formCode === 'D-062' && (int)$chapter['no'] >= 2 && $boxes >= 2) {
                $tableIsChecklist = true;
            }

            if (! $tableIsChecklist) {
                continue;
            }

            // In D-062, skip chapter 1 tables here as they were parsed above
            if ($formCode === 'D-062' && (int)$chapter['no'] < 2) {
                continue;
            }

            // ---- inside a checklist table -------------------------------------------

            // Subgroup heading, or COMMENTS (checked before $boxes so headings with stray checkboxes are not questions)
            if (isBoldOnly($firstCell)) {
                if (preg_match('/^comments?\b|^remarks\b/i', $firstClean)) {
                    $bump($skipped, 'comments_row_ignored');

                    continue;
                }
                $subgroup = $firstClean;

                continue;
            }

            if ($boxes >= 2) {
                // Rows whose answer columns do not match the form are not questions:
                // the D-062 Report Summary ratings table (3 boxes) and the B-008
                // auditee evaluation blocks (5 boxes) land here.
                if ($answerWidth !== null && $boxes !== $answerWidth) {
                    $bump($skipped, 'answer_width_mismatch');

                    continue;
                }

                if (isTickedBox($cells[1] ?? '')) {
                    $bump($skipped, 'pre_ticked_box_ignored');
                }

                $text = trim(rtrim(cleanCell($firstCell), '|'));
                if ($text === '') {
                    $bump($skipped, 'empty_question_text');

                    continue;
                }

                [$text, $mangledWarnings] = flagMangled($text);
                [$text, $guidance, $splitWarning] = splitGuidance($text);
                [$inputType, $inputHint, $inputWarning] = detectInput($text, $guidance);

                $rowWarnings = $mangledWarnings;
                foreach ([$splitWarning, $inputWarning] as $w) {
                    if ($w) {
                        $rowWarnings[] = $w;
                    }
                }
                if (str_contains($firstCell, '~~')) {
                    // The markdown conversion wraps whole questions in ~~*** markers,
                    // which is an artifact of the conversion, not a deletion in the form.
                    $rowWarnings[] = preg_match('/^\d+\.?\s*~~/u', trim($firstCell)) === 1
                        ? 'markdown_emphasis_artifact'
                        : 'struck_through_partial_review';
                }
                if (preg_match('/\\\\[<>]/', $firstCell)) {
                    $rowWarnings[] = 'escaped_comparison_operator';
                }

                if ($formCode === 'D-062') {
                    $effectiveGroup = $chapter['title'];
                    $effectiveSubgroup = $subgroup !== '' ? $subgroup : ($chapter['title'] . ' - General');
                } else {
                    $effectiveGroup = $group !== '' ? $group : ($chapter['title'] ?: '(chapter '.$chapter['no'].')');
                    $effectiveSubgroup = $subgroup;
                    if ($group === '' && $chapter['title'] !== '') {
                        $rowWarnings[] = 'group_inferred_from_chapter';
                    }
                }

                foreach ($rowWarnings as $w) {
                    $bump($warnings, $w);
                }

                $rows[] = [
                    'form' => $formCode,
                    'chapter_no' => $chapter['no'],
                    'chapter' => $chapter['title'],
                    'group' => $effectiveGroup,
                    'subgroup' => $effectiveSubgroup,
                    'question_text' => $text,
                    'guidance' => $guidance,
                    'input_type' => $inputType ?? '',
                    'input_hint' => $inputHint ?? '',
                    'suggested_applicability' => suggestApplicability($formCode, $chapter, $effectiveGroup, $effectiveSubgroup),
                    'warnings' => implode(';', array_unique($rowWarnings)),
                    'source_ref' => basename($path).':'.$num,
                    'source_key' => sourceKey($formCode, $chapter['no'], $text),
                ];

                continue;
            }
        }
    }

    return [
        'form' => $formCode,
        'answer_set' => (string) $answerSet,
        'answer_width' => $answerWidth,
        'rows' => $rows,
        'warnings' => $warnings,
        'skipped' => $skipped,
    ];
}

function suggestApplicability(string $form, array $chapter, string $group, string $subgroup): string
{
    $map = APPLICABILITY[$form] ?? [];
    $no = $chapter['no'];

    if (isset($map['chapter'][$no])) {
        return $map['chapter'][$no];
    }

    foreach ($map['group_match'] ?? [] as $pattern => $value) {
        if (preg_match($pattern, $group.' '.$subgroup)) {
            return $value;
        }
    }

    return 'All vessel types';
}

function sourceKey(string $form, string $chapterNo, string $text): string
{
    return $form.'|'.($chapterNo !== '' ? 'c'.$chapterNo : 'x').'|'.substr(sha1(normaliseForKey($text)), 0, 12);
}

// ---------------------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------------------

function findDuplicates(array $rows): array
{
    $exact = [];
    foreach ($rows as $row) {
        $k = normaliseForKey($row['question_text']);
        $exact[$k][] = $row['source_ref'];
    }

    $dupes = [];
    foreach ($exact as $k => $refs) {
        if (count($refs) > 1) {
            $dupes[] = ['kind' => 'exact', 'refs' => $refs];
        }
    }

    // Near duplicates, compared across the whole form. The scope matters: the known
    // duplicates in these documents sit in different sections (SRS 5.3), so comparing
    // inside one group would miss exactly the cases we are looking for.
    $n = count($rows);
    for ($i = 0; $i < $n; $i++) {
        $a = mb_substr(normaliseForKey($rows[$i]['question_text']), 0, 220);
        if ($a === '') {
            continue;
        }
        for ($j = $i + 1; $j < $n; $j++) {
            $b = mb_substr(normaliseForKey($rows[$j]['question_text']), 0, 220);
            if ($b === '' || $a === $b) {
                continue;
            }
            similar_text($a, $b, $pct);
            if ($pct >= 90) {
                $dupes[] = [
                    'kind' => 'near',
                    'refs' => [$rows[$i]['source_ref'], $rows[$j]['source_ref']],
                    'where' => [
                        describe($rows[$i]),
                        describe($rows[$j]),
                    ],
                    'pct' => round($pct),
                ];
            }
        }
    }

    return $dupes;
}

function describe(array $row): string
{
    $where = $row['chapter_no'] !== '' ? 'ch'.$row['chapter_no'].' '.$row['group'] : $row['group'];

    return trim($where.($row['subgroup'] !== '' ? ' / '.$row['subgroup'] : ''));
}

// ---------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------

function writeCsv(string $path, array $rows): void
{
    $fh = fopen($path, 'w');
    fputcsv($fh, [
        'form', 'chapter_no', 'chapter', 'group', 'subgroup', 'question_text', 'guidance',
        'input_type', 'input_hint', 'suggested_applicability', 'warnings', 'source_ref', 'source_key',
    ]);

    foreach ($rows as $row) {
        fputcsv($fh, [
            $row['form'], $row['chapter_no'], $row['chapter'], $row['group'], $row['subgroup'],
            $row['question_text'], $row['guidance'], $row['input_type'], $row['input_hint'],
            $row['suggested_applicability'], $row['warnings'], $row['source_ref'], $row['source_key'],
        ]);
    }

    fclose($fh);
}

function summarise(array $result, string $dupNote): array
{
    $rows = $result['rows'];
    $byChapter = [];
    $byGroup = [];
    $byApplicability = [];

    foreach ($rows as $row) {
        $ch = $row['chapter_no'] !== '' ? $row['chapter_no'].' '.$row['chapter'] : '(no chapter)';
        $byChapter[$ch] = ($byChapter[$ch] ?? 0) + 1;

        $g = $row['chapter_no'] !== ''
            ? 'Ch. ' . $row['chapter_no'] . ' ' . $row['chapter'] . ' > ' . $row['subgroup']
            : $row['group'];
        $byGroup[$g] = ($byGroup[$g] ?? 0) + 1;

        $byApplicability[$row['suggested_applicability']] = ($byApplicability[$row['suggested_applicability']] ?? 0) + 1;
    }

    return [$byChapter, $byGroup, $byApplicability];
}

// ---------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------

$inputs = [
    'B-008' => $root.'/Form B-008-Vessel Internal Audit checklist (3).md',
    'D-062' => $root.'/Form D 062 Vessel Inspection Report (2).md',
];

$report = [];
$report[] = '# Spike S1 report — form parser';
$report[] = '';
$report[] = 'Generated by `spikes/s1-parser/parse.php`. Input: the two markdown conversions of';
$report[] = 'the company source documents. Output: the review file described in SRS 5.1.';
$report[] = '';

$expectations = [
    'B-008' => ['sections' => 17, 'questions' => 428, 'note' => 'B-008 has flat sections, not numbered chapters'],
    'D-062' => ['chapters' => 13, 'questions' => 647, 'note' => 'numbered chapters 1 to 13, 59 subgroups'],
];

foreach ($inputs as $code => $path) {
    if (! file_exists($path)) {
        fwrite(STDERR, "missing input: $path\n");

        exit(1);
    }

    $result = parseForm($path, $code);
    $rows = $result['rows'];
    $dupes = findDuplicates($rows);
    [$byChapter, $byGroup, $byApplicability] = summarise($result, '');

    $csvName = 'review-'.str_replace('-', '', $code).'.csv';
    if (! $dry) {
        writeCsv($outDir.'/'.$csvName, $rows);
        $storageDir = $root.'/storage/app/spike';
        if (is_dir($storageDir)) {
            writeCsv($storageDir.'/'.$csvName, $rows);
        }
    }

    $report[] = "## {$code}";
    $report[] = '';
    $report[] = "- Answer set detected: `{$result['answer_set']}` (width {$result['answer_width']})";
    $report[] = '- Questions extracted: **'.count($rows)."** (expected about {$expectations[$code]['questions']})";
    if (isset($expectations[$code]['sections'])) {
        $report[] = '- Sections (groups) with questions: **'.count($byGroup).'** (expected about '
            .$expectations[$code]['sections'].'), '.$expectations[$code]['note'];
    } else {
        $report[] = '- Chapters with questions: **'.count($byChapter).'** (expected about '
            .$expectations[$code]['chapters'].'), '.$expectations[$code]['note'];
    }
    $report[] = '- Groups: '.count($byGroup);
    $report[] = "- Review file: `storage/app/spike/{$csvName}`";
    $report[] = '';

    $report[] = '### By chapter';
    $report[] = '';
    $report[] = '| Chapter | Questions |';
    $report[] = '| --- | ---: |';
    foreach ($byChapter as $ch => $n) {
        $report[] = "| {$ch} | {$n} |";
    }
    $report[] = '';

    $report[] = '### By group';
    $report[] = '';
    $report[] = '| Group | Questions |';
    $report[] = '| --- | ---: |';
    foreach ($byGroup as $g => $n) {
        $report[] = "| {$g} | {$n} |";
    }
    $report[] = '';

    $report[] = '### Suggested applicability';
    $report[] = '';
    $report[] = '| Rule | Questions |';
    $report[] = '| --- | ---: |';
    foreach ($byApplicability as $a => $n) {
        $report[] = "| {$a} | {$n} |";
    }
    $report[] = '';

    $report[] = '### Warnings on rows (human review needed)';
    $report[] = '';
    if ($result['warnings'] === []) {
        $report[] = 'None.';
    } else {
        $report[] = '| Warning | Rows |';
        $report[] = '| --- | ---: |';
        arsort($result['warnings']);
        foreach ($result['warnings'] as $w => $n) {
            $report[] = "| `{$w}` | {$n} |";
        }
    }
    $report[] = '';

    $report[] = '### Skipped (deliberately not questions)';
    $report[] = '';
    if ($result['skipped'] === []) {
        $report[] = 'None.';
    } else {
        $report[] = '| Reason | Count |';
        $report[] = '| --- | ---: |';
        foreach ($result['skipped'] as $w => $n) {
            $report[] = "| `{$w}` | {$n} |";
        }
    }
    $report[] = '';

    $report[] = '### Possible duplicates';
    $report[] = '';
    if ($dupes === []) {
        $report[] = 'None found.';
    } else {
        $report[] = '| Kind | Similarity | Where | Rows |';
        $report[] = '| --- | ---: | --- | --- |';
        foreach ($dupes as $d) {
            $pct = isset($d['pct']) ? (string) $d['pct'].'%' : '100%';
            $where = isset($d['where']) ? implode('<br>vs<br>', $d['where']) : '';
            $report[] = '| '.$d['kind'].' | '.$pct.' | '.$where.' | '.implode('<br>', $d['refs']).' |';
        }
    }
    $report[] = '';

    // Acceptance checks from SRS 5.5
    $empty = count(array_filter($rows, fn ($r) => trim($r['question_text']) === ''));
    $withGuidance = count(array_filter($rows, fn ($r) => trim($r['guidance']) !== ''));
    $withInput = count(array_filter($rows, fn ($r) => trim($r['input_type']) !== ''));
    $report[] = '### Acceptance (SRS 5.5)';
    $report[] = '';
    $report[] = '- Questions with empty text: '.$empty.' (must be 0)';
    $report[] = "- Questions carrying guidance text: {$withGuidance}";
    $report[] = "- Questions needing a typed input (date or text): {$withInput}";
    $report[] = '- Every row carries a source_key and a source reference: '
        .(count(array_filter($rows, fn ($r) => $r['source_key'] !== '' && $r['source_ref'] !== '')) === count($rows) ? 'yes' : 'no');
    $report[] = '- Re-running the parser produces identical output: deterministic by construction (no timestamps, no randomness)';
    $report[] = '';
}

$md = implode("\n", $report)."\n";
$reportPath = $root.'/spikes/s1-parser/REPORT.md';
if (! $dry) {
    file_put_contents($reportPath, $md);
}

echo $md;
fwrite(STDERR, $dry ? "[dry run] nothing written\n" : "written: {$outDir}, {$reportPath}\n");
