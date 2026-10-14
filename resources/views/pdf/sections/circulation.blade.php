@php
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';
@endphp

@if($isB008)
  <div class="section page-break-before">
    <h3 class="chapter-header">DISTRIBUTION LIST</h3>

    <table class="circulation-table" style="width: 100%; font-size: 8pt; border-collapse: collapse; margin-top: 6pt;">
      <tbody>
        <tr>
          <td style="width: 18%; font-weight: bold; font-style: italic; border: none; padding: 4pt 6pt;">Distribution:</td>
          <td style="width: 41%; font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Managing Director</td>
          <td style="width: 41%; font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Technical Department</td>
        </tr>
        <tr>
          <td style="border: none;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">DPA</td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Crew Department</td>
        </tr>
        <tr>
          <td style="border: none;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Marine, Ops, Assurance Department</td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Other</td>
        </tr>
        <tr>
          <td style="border: none;"></td>
          <td style="font-style: italic; border: 1pt solid #cbd5e1; padding: 4pt 6pt; background-color: #f8fafc;">Master / Chief Engineer</td>
          <td style="border: none;"></td>
        </tr>
      </tbody>
    </table>
  </div>
@endif
