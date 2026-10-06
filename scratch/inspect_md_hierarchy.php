<?php

$lines = file('Form D 062 Vessel Inspection Report (2).md');

$currentChapter = null;
$chapters = [];

foreach ($lines as $lineNum => $line) {
    $trimmed = trim($line);
    // Check chapter
    if (preg_match('/^\|\s*\*\*\s*(\d+)\.\s*(.+?)\s*\*\*.*\|$/', $trimmed, $m)) {
        if (!preg_match('/\(continuing\)/i', $m[2])) {
            $chNo = (int) $m[1];
            if ($chNo <= 13) {
                $currentChapter = $chNo;
                if (!isset($chapters[$chNo])) {
                    $chapters[$chNo] = [
                        'no' => $chNo,
                        'title' => trim($m[2]),
                        'line' => $lineNum + 1,
                        'items' => []
                    ];
                }
            } else {
                $currentChapter = null;
            }
        }
        continue;
    }
    
    // Check bold sub-heading or cell headings
    if ($currentChapter) {
        $clean = preg_replace('/[~*]/', '', $trimmed);
        $clean = trim(trim($clean, '|'));
        
        // If it's a question row
        if (preg_match('/^(\d+)\.\s*(.+)/', $clean, $qm)) {
            $chapters[$currentChapter]['items'][] = [
                'type' => 'question',
                'no' => $qm[1],
                'text' => substr(trim($qm[2]), 0, 60),
                'line' => $lineNum + 1
            ];
        } elseif (preg_match('/^\|\s*(?:~~\*\*\*|\*\*)([^\*\|]+)(?:\*\*\*~~|\*\*)/', $trimmed, $hm)) {
            $text = trim($hm[1]);
            if (!in_array($text, ['Yes', 'No', 'NA', 'NS', 'Comments/Remarks', 'REPORT SUMMARY', 'FILL IN INSTRUCTIONS:']) 
                && !preg_match('/^\d+\./', $text)
                && !preg_match('/\(continuing\)/i', $text)) {
                $chapters[$currentChapter]['items'][] = [
                    'type' => 'heading',
                    'title' => $text,
                    'raw' => $trimmed,
                    'line' => $lineNum + 1
                ];
            }
        }
    }
}

foreach ($chapters as $chNo => $ch) {
    echo "=================================================================\n";
    echo "Chapter {$chNo}: {$ch['title']} (line {$ch['line']})\n";
    echo "=================================================================\n";
    foreach ($ch['items'] as $item) {
        if ($item['type'] === 'heading') {
            echo "   [SUBHEADING] {$item['title']} (line {$item['line']})\n";
        } elseif ($item['type'] === 'question' && ((int)$item['no'] === 1 || (int)$item['no'] === 18 || (int)$item['no'] === 24 || (int)$item['no'] === 38 || (int)$item['no'] === 41 || (int)$item['no'] === 56 || (int)$item['no'] === 60)) {
            echo "      q.{$item['no']}: {$item['text']}\n";
        }
    }
}
