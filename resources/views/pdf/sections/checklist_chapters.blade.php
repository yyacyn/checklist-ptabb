@php
    $columnLabels = $config['column_labels'] ?? ['No.', 'Item', 'Yes', 'No', 'NS', 'NA', 'Remarks'];
    $isB008 = ($doc['meta']['form_code'] ?? '') === 'B-008';

    // Map answer columns
    $colMap = [];
    foreach ($columnLabels as $lbl) {
        $norm = strtolower(trim($lbl));
        if ($norm === 'yes') {
            $colMap['yes'] = $lbl;
        } elseif ($norm === 'no') {
            $colMap['no'] = $lbl;
        } elseif ($norm === 'ns' || $norm === 'n/s') {
            $colMap['ns'] = $lbl;
        } elseif ($norm === 'na' || $norm === 'n/a') {
            $colMap['na'] = $lbl;
        }
    }
    $totalCols = count($columnLabels);
@endphp

@foreach($doc['chapters'] as $chapter)
  @if($chapter['is_chapter_one'])
    @continue
  @endif

  <div class="chapter" id="chapter-{{ $chapter['no'] }}">
    <h3 class="chapter-header">Chapter {{ $chapter['no'] }} - {{ $chapter['title'] }}</h3>

    @if(!$chapter['is_applicable'])
      <div class="na-banner">NOT APPLICABLE: {{ $chapter['na_reason'] ?: 'N/A' }}</div>
    @endif

    <table class="checklist-table">
      <thead>
        <tr>
          @foreach($columnLabels as $lbl)
            @php
              $norm = strtolower(trim($lbl));
              $thClass = match ($norm) {
                  'no.' => 'no-col',
                  'item' => 'q-col',
                  'remarks' => 'remarks-cell',
                  default => 'ans-col text-center',
              };
            @endphp
            <th class="{{ $thClass }}">{{ $lbl }}</th>
          @endforeach
        </tr>
      </thead>
      <tbody>
        {{-- Direct Questions --}}
        @foreach($chapter['questions'] as $q)
          <tr>
            <td class="no-col">{{ $q['display_no'] }}</td>
            <td class="q-col">
              {{ $q['question_text'] }}
              @if(!empty($q['guidance']))
                <div class="guidance">{{ $q['guidance'] }}</div>
              @endif
              @if(!empty($q['extra_value']) && in_array($q['answer'], ['yes', 'no', 'ns', 'na'], true))
                <div class="extra-value">{{ $q['extra_value'] }}</div>
              @endif
            </td>
            @foreach($colMap as $key => $lbl)
              <td class="ans-col text-center">{{ ($q['answer'] === $key) ? '●' : '' }}</td>
            @endforeach
            <td class="remarks-cell">{!! !empty($q['note']) ? nl2br(e($q['note'])) : '' !!}</td>
          </tr>
        @endforeach

        {{-- Subgroups --}}
        @foreach($chapter['subgroups'] as $sg)
          <tr class="subgroup-row">
            <td colspan="{{ $totalCols }}" class="subgroup-header">
              {{ $sg['title'] }}
              @if(!$sg['is_applicable'] && !empty($sg['na_reason']))
                <span class="na-reason">(N/A: {{ $sg['na_reason'] }})</span>
              @endif
            </td>
          </tr>
          @foreach($sg['questions'] as $q)
            <tr>
              <td class="no-col">{{ $q['display_no'] }}</td>
              <td class="q-col">
                {{ $q['question_text'] }}
                @if(!empty($q['guidance']))
                  <div class="guidance">{{ $q['guidance'] }}</div>
                @endif
                @if(!empty($q['extra_value']) && in_array($q['answer'], ['yes', 'no', 'ns', 'na'], true))
                  <div class="extra-value">{{ $q['extra_value'] }}</div>
                @endif
              </td>
              @foreach($colMap as $key => $lbl)
                <td class="ans-col text-center">{{ ($q['answer'] === $key) ? '●' : '' }}</td>
              @endforeach
              <td class="remarks-cell">{!! !empty($q['note']) ? nl2br(e($q['note'])) : '' !!}</td>
            </tr>
          @endforeach
        @endforeach
      </tbody>
    </table>

    @if(!empty($chapter['comments']))
      <div class="chapter-comments"><strong>COMMENTS / REMARKS:</strong> {!! nl2br(e($chapter['comments'])) !!}</div>
    @endif
  </div>
@endforeach
