@php
    $executionRows = $doc['execution_log'] ?? $doc['audit']['execution_log'] ?? [];
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">AUDIT EXECUTION</h3>

  <table class="findings-table" style="width: 100%; margin-bottom: 12pt;">
    <thead>
      <tr style="background-color: #f1f5f9;">
        <th style="width: 25%; text-align: left;">Person / Function</th>
        <th style="width: 15%; text-align: center;">Date</th>
        <th style="width: 12%; text-align: center;">Start Time</th>
        <th style="width: 12%; text-align: center;">End Time</th>
        <th style="text-align: left;">Topics</th>
      </tr>
    </thead>
    <tbody>
      @forelse($executionRows as $row)
        <tr>
          <td><strong>{{ $row['person_or_function'] ?? '—' }}</strong></td>
          <td class="text-center">{{ !empty($row['date']) ? $row['date'] : '—' }}</td>
          <td class="text-center">{{ !empty($row['start_time']) ? $row['start_time'] : '—' }}</td>
          <td class="text-center">{{ !empty($row['end_time']) ? $row['end_time'] : '—' }}</td>
          <td>{{ $row['topics'] ?? '—' }}</td>
        </tr>
      @empty
        <tr>
          <td colspan="5" class="empty-row text-center" style="font-size: 8pt; color: #777; font-style: italic; padding: 10pt;">
            No audit execution records logged.
          </td>
        </tr>
      @endforelse
    </tbody>
  </table>
</div>
