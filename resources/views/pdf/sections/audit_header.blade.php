@php
    $title = $config['title'] ?? 'General Information';
    $vessel = $doc['vessel'] ?? [];
    $particulars = $doc['particulars'] ?? [];
    $meta = $doc['meta'] ?? [];

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

  {{-- 2. Operations Grid --}}
  <h4 class="subsection-title">Operation at Time of Audit</h4>
  <table class="ops-table">
    @foreach($allOps as $key => $opLabel)
      @php $isChecked = in_array($key, $selectedOps, true); @endphp
      <tr>
        <td>{{ $opLabel }}</td>
        <td class="text-center">{{ $isChecked ? '☒' : '☐' }}</td>
      </tr>
    @endforeach
  </table>

  {{-- 3. Followup Block (AUD-4) --}}
  <h4 class="subsection-title">Follow-up from Previous Audit</h4>
  <table class="findings-table">
    <thead>
      <tr>
        <th style="width: 30px;">Item</th>
        <th style="width: 75px;">NCR No.</th>
        <th>Description</th>
        <th style="width: 85px;">Target Date</th>
        <th style="width: 65px;">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr><td colspan="5" class="empty-row text-center">No outstanding items from previous audit.</td></tr>
    </tbody>
  </table>
</div>
