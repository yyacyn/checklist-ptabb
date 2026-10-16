@php
    $chapterNo = $config['chapter_no'] ?? '14';
    $title = $config['title'] ?? "Chapter {$chapterNo} - Best Practices";
    $text = $doc['summary']['best_practices'] ?? '';
@endphp

<div class="section" id="chapter-{{ $chapterNo }}" style="margin-top: 14pt; page-break-inside: avoid;">
  <tocentry content="toc_ch_{{ $chapterNo }}" />
  <h3 class="chapter-header">{{ $title }}</h3>
  <div class="best-practices">{!! !empty($text) ? nl2br(e($text)) : '<span style="color:#777;font-style:italic;">No best practices recorded.</span>' !!}</div>
</div>
