@php
    $heading = $config['heading'] ?? 'REPORT SUMMARY';
    $formCode = $doc['meta']['form_code'] ?? 'D-062';
    $formVersion = $doc['meta']['form_version'] ?? 'v01.01';

    $ratings = $doc['summary']['ratings'] ?? [];
    $ratingOptions = $doc['summary']['rating_options'] ?? [
        ['value' => 'very_good', 'label' => 'Very Good'],
        ['value' => 'satisfactory', 'label' => 'Satisfactory'],
        ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
    ];
    $counts = $doc['summary']['counts'] ?? ['high' => 0, 'medium' => 0, 'low' => 0, 'total_findings' => 0];
    $textFields = $doc['summary']['text_fields'] ?? [];
    $summaryData = $doc['summary']['summary_data'] ?? [];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{{ $heading }}</h3>
  <div class="summary-notice" style="font-size:8pt;color:#666;margin-bottom:10pt;">
    (Printed after Chapter 15; shown in Chapter 1 of form {{ $formCode }} {{ $formVersion }})
  </div>

  {{-- Counts summary --}}
  <div class="counts-summary">
    <div class="chapter-counts">Total Chapters: {{ count($ratings) }}</div>
    <div class="observation-counts">
      Observations: {{ $counts['total_findings'] }} (High: {{ $counts['high'] }}, Medium: {{ $counts['medium'] }}, Low: {{ $counts['low'] }})
    </div>
  </div>

  {{-- Ratings table --}}
  <table class="ratings-table">
    <thead>
      <tr>
        <th style="width: 28px;">No.</th>
        <th>Chapter Title</th>
        @foreach($ratingOptions as $opt)
          <th style="width: 80px;" class="text-center">{{ $opt['label'] }}</th>
        @endforeach
        <th style="width: 55px;" class="text-center">No Count</th>
        <th style="width: 55px;" class="text-center">NS Count</th>
      </tr>
    </thead>
    <tbody>
      @forelse($ratings as $row)
        <tr>
          <td class="text-center">{{ $row['no'] }}</td>
          <td>{{ $row['title'] }}</td>
          @foreach($ratingOptions as $opt)
            <td class="text-center">{{ ($row['rating'] === $opt['value']) ? '●' : '' }}</td>
          @endforeach
          <td class="text-center">{{ $row['no_count'] }}</td>
          <td class="text-center">{{ $row['ns_count'] }}</td>
        </tr>
      @empty
        <tr><td colspan="{{ 4 + count($ratingOptions) }}" class="empty-row text-center">No checklist chapters available.</td></tr>
      @endforelse
    </tbody>
  </table>

  {{-- Executive text fields --}}
  @foreach($textFields as $tf)
    @php
      $key = $tf['key'] ?? '';
      $val = $summaryData[$key] ?? '';
    @endphp
    @if(!empty($val))
      <div class="summary-text-block" style="margin-top:12pt;">
        <h4 style="margin:0 0 4pt;font-size:9pt;font-weight:bold;">{{ $tf['label'] ?? ucfirst($key) }}</h4>
        <div style="padding:6pt;border:1pt solid #ddd;background-color:#fafafa;font-size:8pt;">
          {!! nl2br(e($val)) !!}
        </div>
      </div>
    @endif
  @endforeach
</div>
