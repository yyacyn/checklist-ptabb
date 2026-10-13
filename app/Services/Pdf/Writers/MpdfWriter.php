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
            'margin_bottom' => $options['margin_bottom'] ?? 18,
            'margin_header' => 0,
            'margin_footer' => 8,
            'default_font' => 'dejavusans',
            'autoScriptToLang' => false,
            'autoLangToFont' => false,
        ]);

        $mpdf->autoPageBreak = true;

        if (! empty($options['watermark'])) {
            $mpdf->SetWatermarkText((string) $options['watermark']);
            $mpdf->showWatermarkText = true;
            $mpdf->watermarkTextAlpha = 0.08;
        }

        if (! empty($options['footer_text'])) {
            $footerText = htmlspecialchars((string) $options['footer_text']);
            $mpdf->SetHTMLFooter('<div style="text-align:center;font-size:7.5pt;color:#666;font-family:DejaVu Sans;">'.$footerText.' | Page {PAGENO} of {nbpg}</div>');
        }

        $mpdf->WriteHTML($html);

        return $mpdf->Output('', 'S');
    }
}
