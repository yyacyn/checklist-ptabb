@php
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';
@endphp

@if($isB008)
  <div class="section" style="margin-top: 6pt;">
    <span style="display: none;">DISTRIBUTION LIST</span>

    <table class="circulation-table" style="width: 100%; font-size: 8pt; border-collapse: collapse; margin-top: 4pt; border: 1pt solid #cbd5e1;">
      <tbody>
        <tr>
          <td style="width: 18%; font-weight: bold; font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Distribution:</td>
          <td style="width: 41%; font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Managing Director</td>
          <td style="width: 41%; font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Technical Department</td>
        </tr>
        <tr>
          <td style="border: 1pt solid #cbd5e1; padding: 3pt 6pt;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">DPA</td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Crew Department</td>
        </tr>
        <tr>
          <td style="border: 1pt solid #cbd5e1; padding: 3pt 6pt;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Marine, Ops, Assurance Department</td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Other</td>
        </tr>
        <tr>
          <td style="border: 1pt solid #cbd5e1; padding: 3pt 6pt;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 3pt 6pt; background-color: #ffffff;">Master / Chief Engineer</td>
          <td style="border: 1pt solid #cbd5e1; padding: 3pt 6pt;"></td>
        </tr>
      </tbody>
    </table>

    {{-- Form B-008 Scoring Guide (AUD-11 / Image 1) --}}
    <div style="margin-top: 10pt; font-size: 8pt;">
      <div style="font-weight: bold; margin-bottom: 3pt; font-size: 8.5pt;">SCORING &mdash; SMS CONFORMANCE SCORING DEFINITIONS (1 TO 5)</div>
      <p style="margin: 0 0 4pt 0; font-size: 8pt;">The granted scores should reflect the following:</p>
      <div style="margin-bottom: 3pt; font-size: 7.5pt; line-height: 1.35;">
        • <strong>5 “excellent”</strong> means that the auditee’s conformance with SMS is outstanding and/or the rate of SMS implementation within the department is maintained at a level much higher than is usually expected.
      </div>
      <div style="margin-bottom: 3pt; font-size: 7.5pt; line-height: 1.35;">
        • <strong>4 “above expectations”</strong> means that the auditee’s conformance with SMS is high and/or the rate of SMS implementation within the department is significantly better than what would normally scored as acceptable.
      </div>
      <div style="margin-bottom: 3pt; font-size: 7.5pt; line-height: 1.35;">
        • <strong>3 “satisfactory”</strong> means that the auditee’s conformance with SMS is in line with normal expectation and/or the rate of SMS implementation within the department is satisfactory.
      </div>
      <div style="margin-bottom: 3pt; font-size: 7.5pt; line-height: 1.35;">
        • <strong>2 “fair”</strong> means that the auditee’s conformance with SMS is below expectations and/or the rate of SMS implementation within the department is not satisfactory but with the proper training in certain areas the auditees can be in satisfactory level.
      </div>
      <div style="margin-bottom: 3pt; font-size: 7.5pt; line-height: 1.35;">
        • <strong>1 “unsatisfactory”</strong> means that the auditee’s capacity is inadequate in the area(s) being audited and/or the rate of SMS implementation within the department is poor and the possibility for the persons to be sufficiently improved, even with additional training, the improvement is uncertain.
      </div>
    </div>
  </div>
@endif
