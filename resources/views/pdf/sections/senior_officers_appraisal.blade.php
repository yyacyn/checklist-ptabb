@php
    $title = $config['title'] ?? 'Appraisals of Senior Officers';
    $appraisals = $doc['senior_officers_appraisal'] ?? [];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{{ $title }}</h3>
  <div style="font-size: 8pt; font-style: italic; color: #475569; margin-top: -6pt; margin-bottom: 8pt;">
    (To be briefly indicated along with Appraisal Report C1-013 &amp; 014)
  </div>

  <table class="findings-table" style="width: 100%;">
    <thead>
      <tr style="background-color: #f1f5f9;">
        <th style="width: 18%; text-align: left;">Rank</th>
        <th style="width: 22%; text-align: left;">Name</th>
        <th style="text-align: left;">Comments <span style="font-weight: normal; font-size: 7pt; color: #64748b;">(Familiarity with on-board systems and equipment verified)</span></th>
        <th style="width: 16%; text-align: center;">Appraised<br><span style="font-size: 7pt;">Yes &nbsp;&nbsp;&nbsp; No</span></th>
      </tr>
    </thead>
    <tbody>
      @forelse($appraisals as $officer)
        @php
          $isAppraised = !empty($officer['appraised']) && $officer['appraised'] !== 'no' && $officer['appraised'] !== false;
        @endphp
        <tr>
          <td style="font-weight: bold; font-size: 8pt;">{{ $officer['rank'] ?? '—' }}</td>
          <td style="font-size: 8pt;">{{ $officer['name'] ?? '—' }}</td>
          <td style="font-size: 8pt;">{{ $officer['comments'] ?? '—' }}</td>
          <td class="text-center" style="font-weight: bold; font-size: 9pt;">
            <span style="display: inline-block; width: 45%;">{{ $isAppraised ? 'X' : '☐' }}</span>
            <span style="display: inline-block; width: 45%; color: #94a3b8;">{{ !$isAppraised ? 'X' : '☐' }}</span>
          </td>
        </tr>
      @empty
        <tr><td colspan="4" class="empty-row text-center">No senior officers appraisals recorded.</td></tr>
      @endforelse
    </tbody>
  </table>

  <div style="font-size: 7.5pt; font-style: italic; color: #64748b; margin-top: 6pt;">
    To be kept in Technical Dpt filing system.
  </div>
</div>
