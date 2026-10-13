@php
    $title = $config['title'] ?? 'Chapter 1 - General Information';
    $vessel = $doc['vessel'] ?? [];
    $particulars = $doc['particulars'] ?? [];
    $meta = $doc['meta'] ?? [];
    $staticTexts = $config['static_texts'] ?? [];

    $fields = [
        'Vessel Name' => $vessel['name'] ?? '',
        'IMO No.' => $vessel['imo'] ?? '',
        'Flag' => $vessel['flag'] ?? '',
        'Gross Tonnage' => $vessel['gt'] ?? '',
        'Year Built' => $vessel['built'] ?? '',
        'Vessel Type' => $vessel['type_name'] ?? '',
        'Ice Class Vessel' => (!empty($vessel['ice_class'])) ? 'Yes' : 'No',
        'Master' => $vessel['master_name'] ?? '',
        'Chief Engineer' => $vessel['chief_engineer_name'] ?? '',
        'Chief Officer' => $vessel['chief_officer_name'] ?? '',
        'Inspected By' => $particulars['inspected_by'] ?? '',
        'Port' => $particulars['port'] ?? '',
        'Report Date' => $meta['report_date'] ?? '',
    ];

    $allOps = [
        'loading' => 'Loading',
        'discharging' => 'Discharging',
        'bunkering' => 'Bunkering',
        'deballasting' => 'Deballasting',
        'ballasting' => 'Ballasting',
        'river_transit' => 'River transit',
        'igs_in_operation' => 'IGS in operation',
        'major_repairs' => 'Major repairs/Drydock',
        'cow_in_progress' => 'COW in progress',
        'repairs_under_way' => 'Repairs under way',
        'sts_operations' => 'STS operations',
        'idle' => 'Idle',
        'at_anchor' => 'At anchor',
        'at_sea' => 'At sea/Sailing',
        'other' => 'Other',
        'repairs_afloat' => 'Repairs afloat',
        'drydock' => 'Drydock',
    ];
    $selectedOps = array_map('strtolower', $particulars['operations'] ?? []);
@endphp

<div class="section page-break-before">
  <h2 class="chapter-title">{{ $title }}</h2>

  {{-- 1. Vessel Particulars --}}
  <table class="particulars-table">
    @foreach($fields as $label => $val)
      <tr>
        <td class="field-label">{{ $label }}</td>
        <td class="field-value">{{ $val }}</td>
      </tr>
    @endforeach
  </table>

  @if(!empty($particulars['voyage']['sailing_with_vessel']))
    <h4 class="subsection-title">Voyage Details (Inspector Sailing with Vessel)</h4>
    <table class="particulars-table">
      <tr><td class="field-label">Sailing From</td><td class="field-value">{{ $particulars['voyage']['from'] ?: '-' }}</td></tr>
      <tr><td class="field-label">Sailing To</td><td class="field-value">{{ $particulars['voyage']['to'] ?: '-' }}</td></tr>
    </table>
  @endif

  {{-- 2. Operations Grid --}}
  <h4 class="subsection-title">Operations at Time of Inspection</h4>
  <table class="ops-table">
    @foreach($allOps as $key => $opLabel)
      @php $isChecked = in_array($key, $selectedOps, true); @endphp
      <tr>
        <td>{{ $opLabel }}</td>
        <td class="text-center">{{ $isChecked ? '☒' : '☐' }}</td>
      </tr>
    @endforeach
  </table>

  {{-- 3. PSC and Drydock --}}
  <h4 class="subsection-title">Port State Control & Dry Dock History</h4>
  <table class="particulars-table">
    <tr><td class="field-label">Last PSC Inspection Port</td><td class="field-value">{{ $particulars['psc']['last_port'] ?: '-' }}</td></tr>
    <tr><td class="field-label">Last PSC Inspection Date</td><td class="field-value">{{ $particulars['psc']['last_date'] ?: '-' }}</td></tr>
    <tr><td class="field-label">Detained / Deficiencies</td><td class="field-value">{{ !empty($particulars['psc']['detained_or_deficiencies']) ? 'Yes' : 'No' }}</td></tr>
    <tr><td class="field-label">Last Dry Dock Date</td><td class="field-value">{{ $particulars['drydock']['last_date'] ?: '-' }}</td></tr>
    <tr><td class="field-label">Next Scheduled Dry Dock</td><td class="field-value">{{ $particulars['drydock']['next_date'] ?: '-' }}</td></tr>
  </table>

  {{-- 4. Open Items Table --}}
  <h4 class="subsection-title">Open Items from Previous Inspections</h4>
  <table class="findings-table">
    <thead>
      <tr>
        <th style="width: 30px;">Item</th>
        <th style="width: 75px;">Type</th>
        <th>Description</th>
        <th style="width: 85px;">Due Date</th>
        <th style="width: 65px;">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="5" class="empty-row text-center">No open items recorded.</td></tr>
    </tbody>
  </table>

  {{-- 5. Internal Circulation --}}
  <h4 class="subsection-title">Internal Circulation</h4>
  <table class="circulation-table">
    <thead>
      <tr><th>Role</th><th>Date Sent</th><th>Reviewed By</th><th>Date Reviewed</th></tr>
    </thead>
    <tbody>
      <tr><td colspan="4" class="empty-row text-center">Not yet circulated.</td></tr>
    </tbody>
  </table>

  {{-- 6. Static texts --}}
  @if(!empty($staticTexts['fill_in_instructions']))
    <div class="static-text" style="margin-top:12pt;padding:8pt;border:1pt solid #ddd;background-color:#f9f9f9;font-size:8pt;">
      <h4 style="margin:0 0 4pt;font-size:8.5pt;">FILL IN INSTRUCTIONS</h4>
      <div>{!! nl2br(e($staticTexts['fill_in_instructions'])) !!}</div>
    </div>
  @endif

  @if(!empty($staticTexts['open_items_note']))
    <div class="static-text" style="margin-top:10pt;font-size:8pt;color:#555;">
      <div>{!! nl2br(e($staticTexts['open_items_note'])) !!}</div>
    </div>
  @endif
</div>
