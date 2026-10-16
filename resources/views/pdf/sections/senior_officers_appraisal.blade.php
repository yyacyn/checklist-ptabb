@php
    $appraisals = $doc['senior_officers_appraisal'] ?? [];

    $defaultRanks = ['Master', 'Chief Engineer', 'Chief Officer', 'Second Engineer'];
    $rows = [];
    if (!empty($appraisals) && is_array($appraisals)) {
        $rows = $appraisals;
    } else {
        foreach ($defaultRanks as $r) {
            $rows[] = ['rank' => $r, 'name' => '', 'comments' => '', 'appraised' => null];
        }
    }
@endphp

<div class="section" style="margin-top: 14pt; page-break-inside: avoid;">
  <h3 class="chapter-header" style="text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 8pt; text-transform: uppercase; letter-spacing: 0.5px; page-break-after: avoid;">
    APPRAISAL OF SENIOR OFFICERS
  </h3>

  <table class="findings-table" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
    <thead>
      <tr>
        <th colspan="3" style="border: 1px solid #000; padding: 4pt 6pt; text-align: left; background-color: #f8fafc;">
          <span style="font-weight: bold; font-size: 8.5pt; text-decoration: underline;">Appraisals of Senior Officers</span><br>
          <span style="font-weight: normal; font-size: 7.5pt; font-style: italic; color: #334155;">(To be briefly indicated along with Appraisal Report C1-013 &amp; 014)</span>
        </th>
        <th colspan="2" style="border: 1px solid #000; padding: 4pt 6pt; text-align: center; vertical-align: middle; background-color: #f8fafc; font-weight: bold; font-size: 8.5pt;">
          Appraised
        </th>
      </tr>
      <tr>
        <th style="width: 16%; border: 1px solid #000; padding: 4pt 6pt; text-align: left; background-color: #f1f5f9; font-size: 8pt;">
          Rank
        </th>
        <th style="width: 20%; border: 1px solid #000; padding: 4pt 6pt; text-align: left; background-color: #f1f5f9; font-size: 8pt;">
          Name
        </th>
        <th style="width: 48%; border: 1px solid #000; padding: 4pt 6pt; text-align: left; background-color: #f1f5f9; font-size: 8pt;">
          Comments<br>
          <span style="font-weight: normal; font-size: 6.8pt; color: #475569; line-height: 1.1;">
            The familiarity of all officers with the on-board systems and equipment related to their area of care must be confirmed and duly verified. Any positive-negative comments to be entered
          </span>
        </th>
        <th style="width: 8%; border: 1px solid #000; padding: 4pt 2pt; text-align: center; vertical-align: middle; background-color: #f1f5f9; font-size: 8pt;">
          Yes
        </th>
        <th style="width: 8%; border: 1px solid #000; padding: 4pt 2pt; text-align: center; vertical-align: middle; background-color: #f1f5f9; font-size: 8pt;">
          No
        </th>
      </tr>
    </thead>
    <tbody>
      @foreach($rows as $officer)
        @php
          $rawAppraised = $officer['appraised'] ?? null;
          $hasAnswer = $rawAppraised !== null && $rawAppraised !== '';
          $isYes = $hasAnswer && ($rawAppraised === true || $rawAppraised === 'yes' || $rawAppraised === 1 || $rawAppraised === '1');
          $isNo = $hasAnswer && ($rawAppraised === false || $rawAppraised === 'no' || $rawAppraised === 0 || $rawAppraised === '0');
        @endphp
        <tr>
          <td style="border: 1px solid #000; padding: 6pt; font-weight: bold; font-size: 8pt; vertical-align: top;">
            {{ $officer['rank'] ?? '—' }}
          </td>
          <td style="border: 1px solid #000; padding: 6pt; font-size: 8pt; vertical-align: top;">
            {{ $officer['name'] ?? '' }}
          </td>
          <td style="border: 1px solid #000; padding: 6pt; font-size: 8pt; vertical-align: top;">
            {{ $officer['comments'] ?? '' }}
          </td>
          <td style="border: 1px solid #000; padding: 6pt 2pt; text-align: center; vertical-align: middle; font-weight: bold; font-size: 10pt;">
            {{ $isYes ? 'X' : '☐' }}
          </td>
          <td style="border: 1px solid #000; padding: 6pt 2pt; text-align: center; vertical-align: middle; font-weight: bold; font-size: 10pt;">
            {{ $isNo ? 'X' : '☐' }}
          </td>
        </tr>
      @endforeach
      <tr>
        <td colspan="5" style="border: 1px solid #000; padding: 4pt 6pt; font-size: 7.5pt; font-style: italic; color: #334155; background-color: #ffffff;">
          To be kept in Technical Dpt filling system.
        </td>
      </tr>
    </tbody>
  </table>
</div>

