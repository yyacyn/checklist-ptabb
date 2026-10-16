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

        // Two-pass rendering when Table of Contents placeholders are present
        if (str_contains($html, '<!--TOC_P:')) {
            $html = $this->resolveTocPages($html, $options, $tempDir);
        }

        $mpdf = $this->createMpdf($options, $tempDir);
        $this->configureMpdf($mpdf, $options);
        $mpdf->WriteHTML($html);

        return $mpdf->Output('', 'S');
    }

    /**
     * Resolve dynamic Table of Contents page numbers using an initial pass.
     *
     * @param  array<string, mixed>  $options
     */
    protected function resolveTocPages(string $html, array $options, string $tempDir): string
    {
        $pass1Mpdf = $this->createMpdf($options, $tempDir);
        $this->configureMpdf($pass1Mpdf, $options);
        $pass1Mpdf->WriteHTML($html);

        $pageMap = [];
        try {
            $ref = new \ReflectionProperty($pass1Mpdf, 'tableOfContents');
            $ref->setAccessible(true);
            $tocObj = $ref->getValue($pass1Mpdf);

            if (! empty($tocObj->_toc) && is_array($tocObj->_toc)) {
                foreach ($tocObj->_toc as $entry) {
                    if (preg_match('/^toc_ch_(\d+)$/', (string) ($entry['t'] ?? ''), $m)) {
                        $pageMap[(int) $m[1]] = (int) $entry['p'];
                    }
                }
            }
        } catch (\Throwable) {
            // Graceful fallback if reflection fails
        }

        unset($pass1Mpdf);

        return (string) preg_replace_callback('/<!--TOC_P:(\d+)-->.*?<!--\/TOC_P-->/', function ($matches) use ($pageMap) {
            $ch = (int) $matches[1];
            if (isset($pageMap[$ch])) {
                return sprintf('%02d', $pageMap[$ch]);
            }

            return 'N/A';
        }, $html);
    }

    /**
     * Create a configured mPDF instance.
     *
     * @param  array<string, mixed>  $options
     */
    protected function createMpdf(array $options, string $tempDir): Mpdf
    {
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
            'use_kwt' => true,
        ]);

        $mpdf->autoPageBreak = true;
        $mpdf->use_kwt = true;

        return $mpdf;
    }

    /**
     * Configure watermark and footer options on an mPDF instance.
     *
     * @param  array<string, mixed>  $options
     */
    protected function configureMpdf(Mpdf $mpdf, array $options): void
    {
        if (! empty($options['watermark'])) {
            $mpdf->SetWatermarkText((string) $options['watermark']);
            $mpdf->showWatermarkText = true;
            $mpdf->watermarkTextAlpha = 0.08;
        }

        if (! empty($options['footer_text'])) {
            $footerText = htmlspecialchars((string) $options['footer_text']);
            $mpdf->SetHTMLFooter('<div style="text-align:center;font-size:7.5pt;color:#666;font-family:DejaVu Sans;">'.$footerText.' | Page {PAGENO} of {nbpg}</div>');
        }
    }
}
