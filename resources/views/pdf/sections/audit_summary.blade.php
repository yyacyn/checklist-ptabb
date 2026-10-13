@php
    $chapterNo = $config['chapter_no'] ?? '18';
    $title = $config['title'] ?? 'Audit Summary & NCRs';
    $findings = $doc['findings'] ?? [];

    $ratings = $doc['summary']['ratings'] ?? [];
    $ratingOptions = $doc['summary']['rating_options'] ?? [
        ['value' => 'very_good', 'label' => 'Very Good'],
        ['value' => 'satisfactory', 'label' => 'Satisfactory'],
        ['value' => 'unsatisfactory', 'label' => 'Unsatisfactory'],
    ];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{!! $title !!}</h3>
  <table class="findings-table">
    <thead>
      <tr>
        <th style="width: 28px;">No.</th>
        <th style="width: 85px;">Chapter</th>
        <th style="width: 85px;">VIQ / Paragraph</th>
        <th>Description</th>
        <th style="width: 60px;">Risk</th>
        <th style="width: 70px;">Job Order No.</th>
        <th style="width: 80px;">Target Date</th>
      </tr>
    </thead>
    <tbody>
      @forelse($findings as $idx => $f)
        <tr>
          <td class="text-center">{{ $f['finding_no'] ?: ($idx + 1) }}</td>
          <td>{{ $f['chapter_label'] }}</td>
          <td>{{ $f['viq_paragraph'] }}</td>
          <td>{!! nl2br(e($f['description'])) !!}</td>
          <td class="text-center">{{ $f['risk'] }}</td>
          <td class="text-center">{{ $f['job_order_no'] }}</td>
          <td class="text-center">{{ $f['target_date'] }}</td>
        </tr>
      @empty
        <tr><td colspan="7" class="empty-row text-center">No observations recorded.</td></tr>
      @endforelse
    </tbody>
  </table>

  {{-- Ratings table --}}
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
              <td class="text-center">{{ ($row['rating'] === $opt['value']) ? '●' : '' }}</td>
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
</div>
