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

<div class="section page-break-before">
  <h3 class="chapter-header">Signatures</h3>
  <div class="signature-lines">
    @if($isB008)
      {{-- Lead Auditor signature line (AUD-14) --}}
      <div class="signature-line" style="margin-bottom: 12pt;">
        <span class="sig-label">Lead Auditor:</span>
        <strong>{{ $leadAuditor['name'] ?? '_____________________' }}</strong>
        @if(!empty($leadAuditor['rank']))
          <span style="font-size: 8pt; color: #475569;">({{ $leadAuditor['rank'] }})</span>
        @endif
        &nbsp;&nbsp;&nbsp;&nbsp;Signature: _________________________
        <span class="sig-date" style="float: right;">Date: ____/____/______</span>
      </div>

      {{-- Auditor(s) signature lines (AUD-14) --}}
      @forelse($otherAuditors as $aud)
        <div class="signature-line" style="margin-bottom: 12pt;">
          <span class="sig-label">Auditor:</span>
          <strong>{{ $aud['name'] }}</strong>
          @if(!empty($aud['rank']))
            <span style="font-size: 8pt; color: #475569;">({{ $aud['rank'] }})</span>
          @endif
          &nbsp;&nbsp;&nbsp;&nbsp;Signature: _________________________
          <span class="sig-date" style="float: right;">Date: ____/____/______</span>
        </div>
      @empty
        <div class="signature-line" style="margin-bottom: 12pt;">
          <span class="sig-label">Auditor:</span>
          _________________________
          &nbsp;&nbsp;&nbsp;&nbsp;Signature: _________________________
          <span class="sig-date" style="float: right;">Date: ____/____/______</span>
        </div>
      @endforelse

      {{-- Master / Chief Officer signature line --}}
      <div class="signature-line" style="margin-bottom: 12pt;">
        <span class="sig-label">Master / Chief Officer:</span>
        <strong>{{ $masterName ?? '_____________________' }}</strong>
        &nbsp;&nbsp;&nbsp;&nbsp;Signature: _________________________
        <span class="sig-date" style="float: right;">Date: ____/____/______</span>
      </div>
    @else
      @foreach($defaultRoles as $role)
        <div class="signature-line">
          <span class="sig-label">{{ $role }}:</span> _________________________________ <span class="sig-date">Date: ____/____/______</span>
        </div>
      @endforeach
    @endif
  </div>
</div>
