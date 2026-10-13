@php
    $columnLabels = $config['column_labels'] ?? ['No.', 'Item', 'Yes', 'No', 'NS', 'NA'];

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
    $hasRemarksCol = in_array('remarks', array_map('strtolower', $columnLabels), true);

    // Explicit percentage widths (must sum to 100) - mPDF ignores table-layout: fixed.
    $noWidth = 6;
    $ansWidth = 7;
    $remarksWidth = $hasRemarksCol ? 22 : 0;
    $itemWidth = 100 - $noWidth - ($ansWidth * count($colMap)) - $remarksWidth;

    $widthFor = function (string $label) use ($noWidth, $ansWidth, $remarksWidth, $itemWidth): string {
        return match (strtolower(trim($label))) {
            'no.' => "{$noWidth}%",
            'item' => "{$itemWidth}%",
            'remarks' => "{$remarksWidth}%",
            default => "{$ansWidth}%",
        };
    };

    $stripNumber = fn (?string $text): string => preg_replace('/^\s*(\d+(\.\d+)*)[\.\)]\s*/u', '', (string) $text);
@endphp

@foreach($doc['chapters'] as $chapter)
  @if($chapter['is_chapter_one'])
    @continue
  @endif

  @if(isset($chapter['is_applicable']) && !$chapter['is_applicable'])
    @continue
  @endif

  @php
    $applicableDirectQuestions = array_filter($chapter['questions'] ?? [], fn($q) => !isset($q['is_applicable']) || $q['is_applicable']);
    $applicableSubgroups = [];
    foreach ($chapter['subgroups'] ?? [] as $sg) {
        if (isset($sg['is_applicable']) && !$sg['is_applicable']) {
            continue;
        }
        $appSgQuestions = array_filter($sg['questions'] ?? [], fn($q) => !isset($q['is_applicable']) || $q['is_applicable']);
        if (!empty($appSgQuestions)) {
            $sg['applicable_questions'] = $appSgQuestions;
            $applicableSubgroups[] = $sg;
        }
    }
    $rowGroups = [];
    if (!empty($applicableDirectQuestions)) {
        $rowGroups[] = ['title' => null, 'questions' => $applicableDirectQuestions];
    }
    foreach ($applicableSubgroups as $sg) {
        $rowGroups[] = ['title' => $sg['title'], 'questions' => $sg['applicable_questions']];
    }
  @endphp

  @if(empty($rowGroups))
    @continue
  @endif

  <div class="chapter" id="chapter-{{ $chapter['no'] }}">
    <h3 class="chapter-header">Chapter {{ $chapter['no'] }} - {{ $chapter['title'] }}</h3>

    <table class="checklist-table" width="100%">
      <thead>
        <tr>
          @foreach($columnLabels as $lbl)
            @php
              $norm = strtolower(trim($lbl));
              $thClass = match ($norm) {
                  'no.' => 'no-col text-center',
                  'item' => 'q-col',
                  'remarks' => 'remarks-cell',
                  default => 'ans-col text-center',
              };
            @endphp
            <th class="{{ $thClass }}" width="{{ $widthFor($lbl) }}">{{ $lbl }}</th>
          @endforeach
        </tr>
      </thead>
      <tbody>
        @foreach($rowGroups as $group)
          @if($group['title'])
            <tr class="subgroup-row">
              <td colspan="{{ $totalCols }}" class="subgroup-header">{{ $group['title'] }}</td>
            </tr>
          @endif
          @foreach($group['questions'] as $q)
            <tr>
              <td class="no-col text-center" width="{{ $noWidth }}%">{{ $q['display_no'] }}</td>
              <td class="q-col" width="{{ $itemWidth }}%">
                {{ $stripNumber($q['question_text']) }}
                @if(!empty($q['guidance']))
                  <div class="guidance">{{ $q['guidance'] }}</div>
                @endif
                @if(!empty($q['extra_value']) && in_array($q['answer'], ['yes', 'no', 'ns', 'na'], true))
                  <div class="extra-value">{{ $q['extra_value'] }}</div>
                @endif
                @if(!empty($q['note']) && !$hasRemarksCol)
                  <div class="q-note"><strong>Note:</strong> {{ $q['note'] }}</div>
                @endif
              </td>
              @foreach($colMap as $key => $lbl)
                <td class="ans-col text-center" width="{{ $ansWidth }}%">{{ ($q['answer'] === $key) ? '●' : '' }}</td>
              @endforeach
              @if($hasRemarksCol)
                <td class="remarks-cell" width="{{ $remarksWidth }}%">{!! !empty($q['note']) ? nl2br(e($q['note'])) : '' !!}</td>
              @endif
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
