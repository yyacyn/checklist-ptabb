<?php

$lines = file('Form D 062 Vessel Inspection Report (2).md');
foreach ($lines as $i => $line) {
    if (preg_match('/^\|\s*\*\*([^\*]+)\*\*/', $line, $m)) {
        $text = trim($m[1]);
        if (!in_array($text, ['Yes', 'No', 'NA', 'NS', 'REPORT SUMMARY', 'COMMENTS / REMARKS FOR ITEMS MARKED “NO”:'])) {
            echo ($i + 1) . ': ' . $text . PHP_EOL;
        }
    }
}
