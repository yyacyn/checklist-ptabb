@php
    $title = $config['title'] ?? 'General Information';
    $vessel = $doc['vessel'] ?? [];
    $particulars = $doc['particulars'] ?? [];
    $meta = $doc['meta'] ?? [];
    $audit = $doc['audit'] ?? [];

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
        'Report Date' => $meta['report_date'] ?? '',
    ];

    $auditTypeLabel = $audit['audit_type_label'] ?? 'A - Internal';
    if (!empty($audit['audit_type_other'])) {
        $auditTypeLabel .= " ({$audit['audit_type_other']})";
    }

    $auditDateRange = '';
    if (!empty($audit['start_date']) && !empty($audit['end_date'])) {
        $auditDateRange = $audit['start_date'] === $audit['end_date'] 
            ? $audit['start_date'] 
            : $audit['start_date'] . ' — ' . $audit['end_date'];
    } elseif (!empty($audit['start_date'])) {
        $auditDateRange = $audit['start_date'];
    } elseif (!empty($audit['end_date'])) {
        $auditDateRange = $audit['end_date'];
    } else {
        $auditDateRange = $meta['report_date'] ?? '';
    }

    $auditDetails = [
        'Audit Type' => $auditTypeLabel,
        'Audit Dates' => $auditDateRange,
        'Lead Auditor' => $audit['lead_auditor'] ?? '—',
        'Activities Audited' => !empty($audit['activities']) ? implode(', ', $audit['activities']) : 'Bridge, Deck, Engine',
    ];

    $allOps = [
        'loading' => 'Loading',
        'discharging' => 'Discharging',
        'bunkering' => 'Bunkering',
        'repairs_afloat' => 'Repairs afloat',
        'deballasting' => 'Deballasting',
        'ballasting' => 'Ballasting',
        'idle' => 'Idle',
        'river_transit' => 'River transit',
        'at_anchor' => 'At anchor',
        'at_sea' => 'At sea/Sailing',
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

  {{-- 2. Audit Details (AUD-3) --}}
  <h4 class="subsection-title">Audit Details & Activities</h4>
  <table class="particulars-table">
    @foreach($auditDetails as $label => $val)
      <tr>
        <td class="field-label">{{ $label }}</td>
        <td class="field-value">{{ $val }}</td>
      </tr>
    @endforeach
  </table>

  {{-- 3. Audit Team & Auditees (AUD-3) --}}
  <table style="width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 8pt;">
    <tr>
      {{-- Left Column: Auditors --}}
      <td style="width: 49%; vertical-align: top; padding-right: 6pt;">
        <h4 class="subsection-title" style="margin-top: 0; margin-bottom: 4pt;">Auditors (Audit Team)</h4>
        <table class="findings-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Name</th>
              <th style="width: 80px;">Rank</th>
              <th style="width: 65px; text-align: center;">Role</th>
            </tr>
          </thead>
          <tbody>
            @forelse($audit['auditors'] ?? [] as $auditor)
              <tr>
                <td>{{ $auditor['name'] }}</td>
                <td>{{ $auditor['rank'] }}</td>
                <td style="text-align: center; font-size: 7.5pt;">
                  @if(!empty($auditor['is_lead']))
                    <strong style="color: #1a365d;">Lead</strong>
                  @else
                    Auditor
                  @endif
                </td>
              </tr>
            @empty
              <tr>
                <td colspan="3" class="empty-row text-center" style="font-size: 8pt; color: #777;">
                  {{ !empty($audit['lead_auditor']) ? $audit['lead_auditor'] . ' (Lead Auditor)' : 'No auditors specified.' }}
                </td>
              </tr>
            @endforelse
          </tbody>
        </table>
      </td>

      {{-- Right Column: Auditees --}}
      <td style="width: 49%; vertical-align: top; padding-left: 6pt;">
        <h4 class="subsection-title" style="margin-top: 0; margin-bottom: 4pt;">Auditees (Vessel Crew)</h4>
        <table class="findings-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Name</th>
              <th style="width: 90px;">Rank</th>
            </tr>
          </thead>
          <tbody>
            @forelse($audit['auditees'] ?? [] as $auditee)
              <tr>
                <td>{{ $auditee['name'] }}</td>
                <td>{{ $auditee['rank'] }}</td>
              </tr>
            @empty
              <tr>
                <td colspan="2" class="empty-row text-center" style="font-size: 8pt; color: #777;">
                  No auditees listed.
                </td>
              </tr>
            @endforelse
          </tbody>
        </table>
      </td>
    </tr>
  </table>

  {{-- 4. Operations Grid (AUD-2) --}}
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

  {{-- 5. Followup Block (AUD-4) --}}
  <div style="page-break-inside: avoid;">
    <h4 class="subsection-title">Follow-up from Previous Audit</h4>
    <table class="particulars-table" style="margin-bottom: 6pt;">
      <tr>
        <td class="field-label">Previous Audit Date</td>
        <td class="field-value">{{ !empty($audit['previous_audit_date']) ? \Carbon\Carbon::parse($audit['previous_audit_date'])->format('d F Y') : '—' }}</td>
      </tr>
      <tr>
        <td class="field-label">Previous Non-Conformities (NCs)</td>
        <td class="field-value">{{ $audit['previous_ncr_count'] ?? 0 }}</td>
      </tr>
      <tr>
        <td class="field-label">Previous Observations</td>
        <td class="field-value">{{ $audit['previous_observation_count'] ?? 0 }}</td>
      </tr>
      @if(!empty($audit['closeout_notes']))
        <tr>
          <td class="field-label">Close-out Verification Notes</td>
          <td class="field-value">{{ $audit['closeout_notes'] }}</td>
        </tr>
      @endif
    </table>
  </div>
</div>
