@php
    $positiveComments = $doc['positive_comments'] ?? $doc['audit']['positive_comments'] ?? ($report->summary_data['positive_comments'] ?? '');
    $negativeComments = $doc['negative_comments'] ?? $doc['audit']['negative_comments'] ?? ($report->summary_data['negative_comments'] ?? '');
@endphp

<div class="section" style="margin-top: 14pt;">
  <h3 class="chapter-header">AUDITOR(S) GENERAL COMMENTS</h3>

  <div style="margin-bottom: 10pt;">
    <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #1e293b; background-color: #f1f5f9; padding: 4pt 6pt; border-left: 3pt solid #10b981; margin-bottom: 4pt;">
      Positive Comments / Commendable Observations:
    </div>
    <div style="border: 1pt solid #cbd5e1; padding: 6pt 8pt; font-size: 8pt; line-height: 1.4; min-height: 40pt; background-color: #ffffff;">
      @if(!empty(trim((string) $positiveComments)))
        {!! nl2br(e($positiveComments)) !!}
      @else
        <span style="color: #94a3b8; font-style: italic;">No specific positive comments recorded.</span>
      @endif
    </div>
  </div>

  <div style="margin-bottom: 12pt;">
    <div style="font-size: 8pt; font-weight: bold; text-transform: uppercase; color: #1e293b; background-color: #f1f5f9; padding: 4pt 6pt; border-left: 3pt solid #f43f5e; margin-bottom: 4pt;">
      Negative Comments / Areas for Improvement:
    </div>
    <div style="border: 1pt solid #cbd5e1; padding: 6pt 8pt; font-size: 8pt; line-height: 1.4; min-height: 40pt; background-color: #ffffff;">
      @if(!empty(trim((string) $negativeComments)))
        {!! nl2br(e($negativeComments)) !!}
      @else
        <span style="color: #94a3b8; font-style: italic;">No specific negative comments recorded.</span>
      @endif
    </div>
  </div>
</div>
