@php
    $chapterNo = $config['chapter_no'] ?? '15';
    $title = $config['title'] ?? "Chapter {$chapterNo} - Summary of Observations";
    $findings = $doc['findings'] ?? [];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{{ $title }}</h3>
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
</div>
