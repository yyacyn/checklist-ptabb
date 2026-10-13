<?php

namespace App\Services\Pdf\Writers;

use App\Services\Pdf\Contracts\PdfWriter;
use Mpdf\Mpdf;

class MpdfWriter implements PdfWriter
{
    /**
     * Render HTML to PDF using mPDF.
     *
     * @param  array<string, mixed>  $options
     */
    public function write(string $html, array $options = []): string
    {
        $tempDir = storage_path('app/temp/mpdf');
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        $mpdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => $options['format'] ?? 'A4',
            'tempDir' => $tempDir,
            'margin_left' => $options['margin_left'] ?? 12,
            'margin_right' => $options['margin_right'] ?? 12,
            'margin_top' => $options['margin_top'] ?? 15,
            'margin_bottom' => $options['margin_bottom'] ?? 15,
            'margin_header' => 0,
            'margin_footer' => 8,
            'default_font' => 'dejavusans',
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
        ]);

        $mpdf->autoPageBreak = true;

        // Header / Footer page numbering tokens:
        // mPDF automatically resolves {PAGENO} and {nbpg}
        $mpdf->WriteHTML($html);

        return $mpdf->Output('', 'S');
    }
}
