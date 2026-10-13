@php
    $defaultTitleKey = match(true) {
        ($doc['meta']['form_type'] ?? '') === 'photo' => 'photo_report',
        ($doc['meta']['report_type'] ?? '') === 'audit' => 'audit_report',
        default => 'inspection_report',
    };
    $titleKey = $config['title_key'] ?? $defaultTitleKey;
    $titles = [
        'inspection_report' => 'VESSEL INSPECTION REPORT',
        'audit_report' => 'VESSEL INTERNAL AUDIT CHECKLIST',
        'photo_report' => 'PHOTOGRAPHIC RECORD REPORT',
    ];
    $title = $titles[$titleKey] ?? $titles['inspection_report'];

    $rawVersion = (string) ($doc['meta']['form_version'] ?? '');
    $formVersion = str_starts_with($rawVersion, 'v') ? $rawVersion : 'v' . $rawVersion;
@endphp

<div class="cover-wrapper">
  <div class="cover">
    <h1 class="cover-title">{{ $title }}</h1>
    <table class="cover-table">
      <tr><td class="cover-label">Report No.</td><td class="cover-value">{{ $doc['meta']['reference_number'] }}</td></tr>
      <tr><td class="cover-label">Form</td><td class="cover-value">{{ $doc['meta']['form_code'] }} ({{ $formVersion }}, template v{{ $doc['meta']['template_version'] }})</td></tr>
      <tr><td class="cover-label">Vessel</td><td class="cover-value">{{ $doc['vessel']['name'] }}</td></tr>
      <tr><td class="cover-label">Date</td><td class="cover-value">{{ $doc['meta']['report_date'] }}</td></tr>
      <tr><td class="cover-label">Status</td><td class="cover-value">{{ $doc['meta']['status_label'] }}</td></tr>
    </table>
  </div>
</div>
