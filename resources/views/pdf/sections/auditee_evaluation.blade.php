@php
    $evalData = $doc['evaluation'] ?? [];
    $criteria = $evalData['criteria'] ?? [];
    $rows = $evalData['rows'] ?? [];
    $definitions = $evalData['definitions'] ?? [];
@endphp

<div class="section" style="margin-top: 14pt;">
  <div style="page-break-inside: avoid;">
    <h3 class="chapter-header">AUDITEE EVALUATION</h3>

    {{-- Scoring Definitions Guide (AUD-11) --}}
    <div style="background-color: #f8fafc; border: 1pt solid #cbd5e1; padding: 6pt 8pt; margin-bottom: 12pt; font-size: 7.5pt; line-height: 1.35;">
      <div style="font-weight: bold; margin-bottom: 3pt; text-transform: uppercase; color: #1e293b;">
        SMS CONFORMANCE SCORING DEFINITIONS (1 TO 5):
      </div>
      <div style="margin-bottom: 2pt;"><strong>5 “Excellent”:</strong> Conformance with SMS is outstanding and maintained at a level much higher than usually expected.</div>
      <div style="margin-bottom: 2pt;"><strong>4 “Above Expectations”:</strong> Conformance with SMS is high and significantly better than normally scored as acceptable.</div>
      <div style="margin-bottom: 2pt;"><strong>3 “Satisfactory”:</strong> Conformance with SMS is in line with normal expectation and satisfactory.</div>
      <div style="margin-bottom: 2pt;"><strong>2 “Fair”:</strong> Conformance is below expectations; with proper training in certain areas can be at satisfactory level.</div>
      <div><strong>1 “Unsatisfactory”:</strong> Capacity is inadequate in the audited areas and improvement is uncertain even with additional training.</div>
    </div>
  </div>

  @forelse($rows as $idx => $auditee)
    <table class="findings-table" style="margin-bottom: 14pt;">
      <thead>
        <tr style="background-color: #f1f5f9;">
          <th style="text-align: left; width: 62%; font-size: 8.5pt;">
            AUDITEE #{{ $idx + 1 }}:
            <strong>{{ !empty($auditee['name']) ? $auditee['name'] : '—' }}</strong>
            <span style="font-weight: normal; color: #475569;">
              ({{ !empty($auditee['rank']) ? $auditee['rank'] : 'Rank not specified' }})
            </span>
          </th>
          <th colspan="5" class="text-center" style="width: 38%; font-size: 8.5pt;">
            OVERALL STATUS:
            <strong style="text-transform: uppercase; color: {{ strtolower($auditee['overall_status'] ?? '') === 'unsatisfactory' ? '#e11d48' : '#0f172a' }};">
              {{ !empty($auditee['overall_status']) ? $auditee['overall_status'] : '—' }}
            </strong>
          </th>
        </tr>
        <tr>
          <th style="text-align: left;">Evaluation Criteria</th>
          <th style="width: 35px;" class="text-center">1</th>
          <th style="width: 35px;" class="text-center">2</th>
          <th style="width: 35px;" class="text-center">3</th>
          <th style="width: 35px;" class="text-center">4</th>
          <th style="width: 35px;" class="text-center">5</th>
        </tr>
      </thead>
      <tbody>
        @foreach($criteria as $cIdx => $crit)
          @php
            $critKey = $crit['criterion_key'];
            $score = $auditee['scores'][$critKey] ?? null;
          @endphp
          <tr>
            <td>{{ $cIdx + 1 }}. {{ $crit['label'] }}</td>
            @for($s = 1; $s <= 5; $s++)
              <td class="text-center" style="font-size: 9pt; {{ (int)$score === $s ? 'font-weight: bold; background-color: #e2e8f0;' : 'color: #94a3b8;' }}">
                {{ (int)$score === $s ? 'X' : '☐' }}
              </td>
            @endfor
          </tr>
        @endforeach
        @if(!empty($auditee['comments']))
          <tr>
            <td colspan="6" style="font-size: 7.5pt; color: #334155; background-color: #f8fafc; padding: 4pt 6pt;">
              <strong>Remarks / Comments:</strong> {{ $auditee['comments'] }}
            </td>
          </tr>
        @endif
      </tbody>
    </table>
  @empty
    <div style="font-size: 8pt; color: #777; font-style: italic; padding: 12pt; text-align: center; border: 1pt dashed #ccc;">
      No auditee evaluations recorded.
    </div>
  @endforelse
</div>
