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
  </div>
@endif
