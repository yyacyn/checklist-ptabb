@php
    $formType = $doc['meta']['form_type'] ?? 'standard';
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';
    $auditData = $doc['audit'] ?? [];
    $auditors = $auditData['auditors'] ?? [];
    $leadAuditor = collect($auditors)->firstWhere('role', 'Lead auditor')
        ?? (isset($auditData['lead_auditor']) ? ['name' => $auditData['lead_auditor'], 'rank' => 'Lead Auditor'] : null);
    $otherAuditors = collect($auditors)->filter(fn($a) => in_array(strtolower($a['role'] ?? ''), ['auditor', 'audit team'], true))->values()->all();
    $masterName = $report->master_name ?: ($report->chief_officer_name ?: null);

    $defaultRoles = match(true) {
        $formType === 'photo' => ['Inspector / Surveyor', 'Master'],
        default => ['Inspector', 'Master', 'Chief Engineer', 'Chief Officer', 'Superintendent'],
    };
@endphp

@if($isB008)
  <div class="section" style="margin-top: 6pt; page-break-inside: avoid;">
    <span style="display: none;">Signatures</span>
    <table class="findings-table" style="width: 100%; border-collapse: collapse; margin-bottom: 4pt; font-size: 8pt; border: 1pt solid #cbd5e1; page-break-inside: avoid;">
      <tbody>
        <tr>
          <td style="width: 38%; font-weight: bold; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">
            LEAD AUDITOR <span style="font-weight: normal; font-style: italic;">(name/title/signature)</span>
            <span style="display: none;">Lead Auditor:</span>
          </td>
          <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt; font-size: 8pt;">
            @if(!empty($leadAuditor['name']))
              <strong>{{ $leadAuditor['name'] }}</strong>
              @if(!empty($leadAuditor['rank'])) / {{ $leadAuditor['rank'] }} @endif
            @endif
          </td>
        </tr>
        <tr>
          <td style="font-weight: bold; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #ffffff;">
            AUDITORS <span style="font-weight: normal; font-style: italic;">(name/title/signature)</span>
            <span style="display: none;">Auditor:</span>
          </td>
          <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt; font-size: 8pt;">
            @if(!empty($otherAuditors[0]['name']))
              <strong>{{ $otherAuditors[0]['name'] }}</strong>
              @if(!empty($otherAuditors[0]['rank'])) / {{ $otherAuditors[0]['rank'] }} @endif
            @endif
          </td>
        </tr>
        <tr>
          <td style="font-weight: bold; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #ffffff;">
            AUDITORS <span style="font-weight: normal; font-style: italic;">(name/title/signature)</span>
            <span style="display: none;">Auditor: Master / Chief Officer:</span>
          </td>
          <td style="border: 1pt solid #cbd5e1; padding: 4pt 6pt; font-size: 8pt;">
            @if(!empty($otherAuditors[1]['name']))
              <strong>{{ $otherAuditors[1]['name'] }}</strong>
              @if(!empty($otherAuditors[1]['rank'])) / {{ $otherAuditors[1]['rank'] }} @endif
            @elseif(!empty($masterName))
              <strong>{{ $masterName }}</strong> / Master / Chief Officer
            @endif
          </td>
        </tr>
      </tbody>
    </table>
  </div>
@else
  <div class="section page-break-before">
    <h3 class="chapter-header">Signatures</h3>
    <div class="signature-lines">
      @foreach($defaultRoles as $role)
        <div class="signature-line">
          <span class="sig-label">{{ $role }}:</span> _________________________________ <span class="sig-date">Date: ____/____/______</span>
        </div>
      @endforeach
    </div>
  </div>
@endif
