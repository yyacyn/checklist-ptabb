<?php

namespace App\Services\Pdf\Contracts;

interface PdfWriter
{
    /**
     * Render the given HTML string into a PDF binary string.
     *
     * @param  array<string, mixed>  $options
     * @return string Raw PDF binary data
     */
    public function write(string $html, array $options = []): string;
}
