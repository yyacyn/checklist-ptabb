@php
    $chapterNo = $config['chapter_no'] ?? '18';
    $title = $config['title'] ?? 'Audit Results';
    $findings = $doc['findings'] ?? [];
    $hasRatingsMatrix = $config['has_ratings_matrix'] ?? ($doc['summary']['has_ratings_matrix'] ?? false);

    $ratings = $doc['summary']['ratings'] ?? [];
    $ratingOptions = $doc['summary']['rating_options'] ?? [
        ['value' => 'very_good', 'label' => 'Very Good'],
        ['value' => 'satisfactory', 'label' => 'Satisfactory'],
        ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
    ];

    $ncrCount = $doc['audit']['current_ncr_count'] ?? $doc['summary']['counts']['ncr'] ?? 0;
    $obsCount = $doc['audit']['current_observation_count'] ?? $doc['summary']['counts']['observation'] ?? 0;
@endphp

<div class="section" id="chapter-{{ $chapterNo }}" style="margin-top: 14pt;">
  <div style="page-break-inside: avoid;">
    <h3 class="chapter-header">{!! $title !!}</h3>

    {{-- Audit Results Counts (Form B-008, AUD-9) --}}
    <table class="particulars-table" style="width: 50%; margin-bottom: 12pt;">
      <tr>
        <td class="field-label" style="width: 70%;">Number of Non-Conformities:</td>
        <td class="field-value" style="font-weight: bold; width: 30%;">{{ $ncrCount }}</td>
      </tr>
      <tr>
        <td class="field-label" style="width: 70%;">Number of Observations:</td>
        <td class="field-value" style="font-weight: bold; width: 30%;">{{ $obsCount }}</td>
      </tr>
    </table>
  </div>

  {{-- List of Non-Conformities and Observations (AUD-9, AUD-10) --}}
  <h4 class="subsection-title" style="margin-top: 10pt; margin-bottom: 4pt;">LIST OF NON-CONFORMITIES AND OBSERVATIONS</h4>
  <table class="findings-table">
    <thead>
      <tr>
        <th style="width: 110px;">N/C ID NUMBER</th>
        <th style="width: 90px;">DATE ISSUED</th>
        <th>BRIEF DESCRIPTION</th>
        <th style="width: 120px;">CLOSE OUT TARGET DATE</th>
      </tr>
    </thead>
    <tbody>
      @forelse($findings as $f)
        <tr>
          <td class="text-center" style="font-weight: bold;">{{ $f['finding_no'] ?: ($f['finding_kind'] === 'non_conformity' ? 'NC' : 'OBS') }}</td>
          <td class="text-center">{{ $f['issue_date'] ?: '—' }}</td>
          <td>{!! nl2br(e($f['description'])) !!}</td>
          <td class="text-center">{{ $f['target_date'] ?: '—' }}</td>
        </tr>
      @empty
        <tr><td colspan="4" class="empty-row text-center">No non-conformities or observations recorded.</td></tr>
      @endforelse
    </tbody>
  </table>

  @if($hasRatingsMatrix)
    {{-- Ratings table (only shown if form has ratings matrix configured) --}}
    <table class="ratings-table" style="margin-top:14pt;">
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
          @php $isApplicable = $row['is_applicable'] ?? true; @endphp
          <tr>
            <td class="text-center">{{ $row['no'] }}</td>
            <td>{{ $row['title'] }} {{ !$isApplicable ? '(N/A)' : '' }}</td>
            @if(!$isApplicable)
              <td colspan="{{ count($ratingOptions) }}" class="text-center" style="color: #777; font-style: italic;">N/A</td>
            @else
              @foreach($ratingOptions as $opt)
                <td class="text-center" style="font-weight: bold; font-size: 9pt;">{{ ($row['rating'] === $opt['value']) ? 'X' : '' }}</td>
              @endforeach
            @endif
            <td class="text-center">{{ $isApplicable ? $row['no_count'] : '-' }}</td>
            <td class="text-center">{{ $isApplicable ? $row['ns_count'] : '-' }}</td>
          </tr>
        @empty
          <tr><td colspan="{{ 4 + count($ratingOptions) }}" class="empty-row text-center">No checklist chapters available.</td></tr>
        @endforelse
      </tbody>
    </table>
  @endif
</div>
