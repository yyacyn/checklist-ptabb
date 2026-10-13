@php
    $formType = $doc['meta']['form_type'] ?? 'standard';
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';
    $roles = match(true) {
        $formType === 'photo' => ['Inspector / Surveyor', 'Master'],
        $isB008 => ['Lead Auditor', 'Auditor(s)', 'Master / Chief Officer'],
        default => ['Inspector', 'Master', 'Chief Engineer', 'Chief Officer', 'Superintendent'],
    };
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
