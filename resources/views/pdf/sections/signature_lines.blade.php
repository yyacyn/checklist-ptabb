@php
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';
    $roles = $isB008
        ? ['Lead Auditor', 'Auditor(s)', 'Master / Chief Officer']
        : ['Inspector', 'Master', 'Chief Engineer', 'Chief Officer', 'Superintendent'];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">Signatures</h3>
  <div class="signature-lines">
    @foreach($roles as $role)
      <div class="signature-line">
        <span class="sig-label">{{ $role }}:</span> _________________________________ <span class="sig-date">Date: ____/____/______</span>
      </div>
    @endforeach
  </div>
</div>
