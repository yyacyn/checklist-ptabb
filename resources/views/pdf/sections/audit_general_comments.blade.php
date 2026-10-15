@php
    $positiveComments = $doc['positive_comments'] ?? $doc['audit']['positive_comments'] ?? ($report->summary_data['positive_comments'] ?? '');
    $negativeComments = $doc['negative_comments'] ?? $doc['audit']['negative_comments'] ?? ($report->summary_data['negative_comments'] ?? '');
@endphp

<div class="section" style="margin-top: 8pt; page-break-inside: avoid;">
  <span style="display: none;">AUDITOR(S) GENERAL COMMENTS</span>
  <table class="findings-table" style="width: 100%; border-collapse: collapse; margin-bottom: 6pt; font-size: 8pt; border: 1pt solid #cbd5e1;">
    <thead>
      <tr style="background-color: #f1f5f9;">
        <th style="text-align: left; padding: 3pt 6pt; font-size: 8.5pt; color: #0f172a; text-transform: uppercase;">
          AUDITOR(S) GENERAL COMMENTS (both positive and negative)
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 4pt 6pt; font-size: 8pt; line-height: 1.35; border: 1pt solid #cbd5e1; background-color: #ffffff;">
          @if(!empty(trim((string) $positiveComments)))
            <div style="margin-bottom: 3pt;">
              <strong style="color: #047857;">Positive Comments / Commendable Observations:</strong>
              <span style="color: #0f172a;">{!! nl2br(e($positiveComments)) !!}</span>
            </div>
          @endif
          @if(!empty(trim((string) $negativeComments)))
            <div>
              <strong style="color: #be123c;">Negative Comments / Areas for Improvement:</strong>
              <span style="color: #0f172a;">{!! nl2br(e($negativeComments)) !!}</span>
            </div>
          @endif
          @if(empty(trim((string) $positiveComments)) && empty(trim((string) $negativeComments)))
            <span style="color: #94a3b8; font-style: italic;">No specific comments recorded.</span>
          @endif
        </td>
      </tr>
    </tbody>
  </table>
</div>
