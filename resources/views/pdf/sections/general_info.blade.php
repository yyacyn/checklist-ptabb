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
  <h4 class="subsection-title">Port State Control &amp; Dry Dock History</h4>
  <table class="particulars-table" style="width: 100%;">
    <tr>
      <td style="width: 65%;">
        <strong>Port of last PSC inspection:</strong> {{ $particulars['psc']['last_port'] ?: '—' }}
        <div style="font-size: 7pt; font-style: italic; color: #555; margin-top: 2pt;">
          If the vessel was detained or if deficiencies were identified check/verify close out.
          @if(!empty($particulars['psc']['detained_or_deficiencies']))
            <strong style="color: #b91c1c;">(Detained / Deficiencies: YES)</strong>
          @endif
        </div>
      </td>
      <td style="width: 35%;">
        <strong>Date:</strong> {{ $particulars['psc']['last_date'] ?: '—' }}
      </td>
    </tr>
    <tr>
      <td>
        <strong>Date of last Dry Dock:</strong> {{ $particulars['drydock']['last_date'] ?: '—' }}
      </td>
      <td>
        <strong>Next Dry Dock:</strong> {{ $particulars['drydock']['next_date'] ?: '—' }}
      </td>
    </tr>
    <tr>
      <td colspan="2" style="font-size: 7.5pt; background-color: #fafafa; padding: 5pt 6pt; line-height: 1.35;">
        <strong>Important Note: Discussion to be performed with the senior officers, prior commencement of the inspection, to discuss safety related aspects.</strong> (Lead by example, don't demotivate, inspire. Get and provide feedback, follow through on actions, communicate (ask questions/sincere conversation), hear from seafarers and what they say.
      </td>
    </tr>
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

  {{-- 6. Document Index & Fill In Instructions (flows after Internal Circulation) --}}
  @php
    $defaultIndex = [
        ['no' => '1.', 'title' => 'General Information & Report Summary', 'page' => '01'],
        ['no' => '2.', 'title' => 'Certification and Documentation', 'page' => '04'],
        ['no' => '3.', 'title' => 'Crew Management', 'page' => '04'],
        ['no' => '4.', 'title' => 'Navigation', 'page' => '05'],
        ['no' => '5.', 'title' => 'Safety Management', 'page' => '07'],
        ['no' => '6.', 'title' => 'Pollution Prevention', 'page' => '13'],
        ['no' => '7.', 'title' => 'Structural Condition', 'page' => '15'],
        ['no' => '8.', 'title' => 'Cargo & Ballast Systems', 'page' => '16'],
        ['no' => '9.', 'title' => 'Mooring', 'page' => '22'],
        ['no' => '10.', 'title' => 'Communications', 'page' => '25'],
        ['no' => '11.', 'title' => 'Engine & Steering Compartments', 'page' => '26'],
        ['no' => '12.', 'title' => 'General Appearance and Condition', 'page' => '34'],
        ['no' => '13.', 'title' => 'Ice Operations', 'page' => '36'],
        ['no' => '14.', 'title' => 'Best Practices', 'page' => '36'],
        ['no' => '15.', 'title' => 'Summary of Observations', 'page' => '37'],
    ];

    $instructionsText = $staticTexts['fill_in_instructions'] ?? "1. Read carefully and go through each chapter carefully.\n2. For items not seen enter on the comments section the Not Seen items.\n3. For items not available onboard enter on the comments section below the Not Applicable Items.\n4. For inspections of tanks, etc. please attach form D 024 to this report.\n5. In case of negative observations or job orders raised for notified deficiencies, relevant remarks must have cross-reference to the breached relevant numerical item on the Chapter the deficiency has been identified as applicable.\n6. Vessels should be inspected at least annually by both shore staff and vessel’s designated personnel, according to this form. During these inspections, the designated Officers (on behalf of the vessel) and the Company’s Superintendents (on behalf of the Company) may inspect as many fields included in this form as possible, depending on their expertise and the available time or the vessel’s operational status.\n7. The completion of all parts of this form may be affected during several such inspections.\n8. The Master (regarding the inspections carried out by ship Officers) and the Technical Manager (regarding the inspections carried out by shore staff) are responsible to ensure that all parts of this form are reviewed within a period of one year.";
  @endphp

  <div style="margin-top: 14pt;">
    <div style="font-weight: bold; font-size: 10pt; margin-bottom: 5pt; text-transform: uppercase; letter-spacing: 0.5px;">INDEX</div>
    <table class="findings-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12pt;">
      <tbody>
        @foreach($defaultIndex as $item)
          <tr>
            <td style="width: 6%; text-align: center; font-weight: bold; padding: 2pt 4pt; font-size: 7.5pt;">{{ $item['no'] }}</td>
            <td style="width: 86%; padding: 2pt 6pt; font-size: 7.5pt;">{{ $item['title'] }}</td>
            <td style="width: 8%; text-align: center; padding: 2pt 4pt; font-size: 7.5pt;">{{ $item['page'] }}</td>
          </tr>
        @endforeach
      </tbody>
    </table>

    @if(!empty($instructionsText))
      <div class="static-text" style="font-size: 8pt; line-height: 1.35;">
        <div style="font-weight: bold; margin-bottom: 4pt; font-size: 8.5pt;">FILL IN INSTRUCTIONS:</div>
        <div style="color: #000;">{!! nl2br(e($instructionsText)) !!}</div>
      </div>
    @endif
  </div>

  {{-- 7. Other Attendance-Related Activities (INS-13) --}}
  @php
    $ch1 = collect($doc['chapters'] ?? [])->firstWhere('is_chapter_one', true);
    $attendanceSg = null;
    if ($ch1 && !empty($ch1['subgroups'])) {
        $attendanceSg = collect($ch1['subgroups'])->first(function($sg) {
            return str_contains(strtolower($sg['title'] ?? ''), 'attendance');
        });
    }
  @endphp

  @if($attendanceSg && !empty($attendanceSg['questions']))
    <div style="margin-top: 14pt;">
      <h3 class="chapter-header">Other Attendance-Related Activities</h3>
      <table class="findings-table" style="width: 100%; margin-top: 6pt;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="width: 48%; text-align: left;">Activity / Verification Item</th>
            <th style="width: 8%; text-align: center;">Yes</th>
            <th style="width: 8%; text-align: center;">No</th>
            <th style="text-align: left;">Details / Comments / Specific Type</th>
          </tr>
        </thead>
        <tbody>
          @foreach($attendanceSg['questions'] as $q)
            @php
              $ans = strtolower(trim((string)($q['answer'] ?? '')));
              $isYes = in_array($ans, ['yes', 'y'], true);
              $isNo = in_array($ans, ['no', 'n'], true);
              $details = $q['note'] ?: ($q['extra_value'] ?: '—');
            @endphp
            <tr>
              <td style="font-size: 8pt;">{{ $q['question_text'] }}</td>
              <td class="text-center" style="font-weight: bold; font-size: 9pt;">{{ $isYes ? 'X' : '' }}</td>
              <td class="text-center" style="font-weight: bold; font-size: 9pt;">{{ $isNo ? 'X' : '' }}</td>
              <td style="font-size: 8pt;">{{ $details }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>

      @if(!empty($staticTexts['open_items_note']))
        <div class="static-text" style="margin-top:10pt;font-size:8pt;color:#555;">
          <div>{!! nl2br(e($staticTexts['open_items_note'])) !!}</div>
        </div>
      @endif
    </div>
  @endif
</div>
