@php
    $chapterNo = $config['chapter_no'] ?? null;
    $title = $config['title'] ?? ($chapterNo ? "Chapter {$chapterNo} - Photographic Records" : 'Photographic Records');
    $photos = $doc['photos'] ?? [];
    $photoSections = $doc['photo_sections'] ?? [];
    $additionalPhotos = $doc['additional_photos'] ?? [];
    $threshold = $config['photo_appendix_threshold'] ?? 100;
    $shouldSplit = count($photos) > $threshold;
@endphp

<div class="section page-break-before">
  <h3 class="chapter-header">{{ $title }}</h3>

  @if($shouldSplit)
    <div class="split-note">
      This report contains {{ count($photos) }} photographs. Photographic appendix is compiled as a separate volume due to size limit.
    </div>
  @elseif(!empty($photoSections))
    @foreach($photoSections as $sec)
      <div class="photo-section-block">
        {{-- Section Header --}}
        <div class="photo-section-header">
          <div class="photo-section-header-title">#{{ $sec['slot_no'] }}. {{ $sec['title'] }}</div>
          @if(!empty($sec['description']))
            <div class="photo-section-header-desc">{{ $sec['description'] }}</div>
          @endif
        </div>

        {{-- Section Comments / Remarks Box --}}
        <div class="photo-section-comment-box">
          <div class="photo-section-comment-label">Section Comments / Remarks:</div>
          @if(!empty($sec['comment']))
            <div class="photo-section-comment-text">{!! nl2br(e($sec['comment'])) !!}</div>
          @else
            <div class="photo-section-comment-empty">No comments recorded for this section.</div>
          @endif
        </div>

        {{-- Section Photos Grid --}}
        @if(empty($sec['photos']))
          <div class="no-photos" style="font-size:8pt;color:#888;font-style:italic;margin-bottom:10pt;">
            No photographic records attached for this section.
          </div>
        @else
          <table class="photo-grid-table">
            @foreach(array_chunk($sec['photos'], 2) as $row)
              <tr class="photo-grid-row">
                @foreach($row as $photo)
                  <td class="photo-grid-cell">
                    <div class="photo-card">
                      {{-- Metadata text ABOVE image --}}
                      <div class="photo-meta">
                        <div class="photo-title-line">
                          <span class="photo-number">#{{ $photo['item_no'] }}</span>
                          @if(!empty($photo['title']))
                            <span class="photo-title">{{ $photo['title'] }}</span>
                          @endif
                        </div>

                        @if(!empty($photo['category_name']) || !empty($photo['location']))
                          <div class="photo-subline">
                            @if(!empty($photo['category_name']))
                              <span class="photo-category"><strong>Category:</strong> {{ $photo['category_name'] }}</span>
                            @endif
                            @if(!empty($photo['category_name']) && !empty($photo['location']))
                              <span class="photo-sep">•</span>
                            @endif
                            @if(!empty($photo['location']))
                              <span class="photo-location"><strong>Location:</strong> {{ $photo['location'] }}</span>
                            @endif
                          </div>
                        @endif

                        @if(!empty($photo['caption']))
                          <div class="photo-caption">{{ $photo['caption'] }}</div>
                        @endif

                        @if(!empty($photo['description']))
                          <div class="photo-description">{!! nl2br(e($photo['description'])) !!}</div>
                        @endif
                      </div>

                      {{-- Scaled image box BELOW text --}}
                      <div class="photo-img-box">
                        @if(!empty($photo['local_path']) && file_exists($photo['local_path']))
                          <img src="{{ $photo['local_path'] }}" class="photo-img" alt="Photo #{{ $photo['item_no'] }}">
                        @elseif(!empty($photo['file_path']))
                          <div class="photo-placeholder">Image file: {{ $photo['file_path'] }}</div>
                        @else
                          <div class="photo-placeholder">No image file available</div>
                        @endif
                      </div>
                    </div>
                  </td>
                @endforeach
                @if(count($row) === 1)
                  <td class="photo-grid-cell-empty" style="width: 50%; border: none; background: transparent;">&nbsp;</td>
                @endif
              </tr>
            @endforeach
          </table>
        @endif
      </div>
    @endforeach

    {{-- Additional Photos not matched to any slot --}}
    @if(!empty($additionalPhotos))
      <div class="photo-section-block" style="margin-top:14pt;">
        <div class="photo-section-header" style="border-left-color: #475569;">
          <div class="photo-section-header-title" style="color: #334155;">Additional Photographic Records</div>
        </div>
        <table class="photo-grid-table">
          @foreach(array_chunk($additionalPhotos, 2) as $row)
            <tr class="photo-grid-row">
              @foreach($row as $photo)
                <td class="photo-grid-cell">
                  <div class="photo-card">
                    <div class="photo-meta">
                      <div class="photo-title-line">
                        <span class="photo-number">#{{ $photo['item_no'] }}</span>
                        @if(!empty($photo['title']))
                          <span class="photo-title">{{ $photo['title'] }}</span>
                        @endif
                      </div>

                      @if(!empty($photo['category_name']) || !empty($photo['location']))
                        <div class="photo-subline">
                          @if(!empty($photo['category_name']))
                            <span class="photo-category"><strong>Category:</strong> {{ $photo['category_name'] }}</span>
                          @endif
                          @if(!empty($photo['category_name']) && !empty($photo['location']))
                            <span class="photo-sep">•</span>
                          @endif
                          @if(!empty($photo['location']))
                            <span class="photo-location"><strong>Location:</strong> {{ $photo['location'] }}</span>
                          @endif
                        </div>
                      @endif

                      @if(!empty($photo['caption']))
                        <div class="photo-caption">{{ $photo['caption'] }}</div>
                      @endif

                      @if(!empty($photo['description']))
                        <div class="photo-description">{!! nl2br(e($photo['description'])) !!}</div>
                      @endif
                    </div>

                    <div class="photo-img-box">
                      @if(!empty($photo['local_path']) && file_exists($photo['local_path']))
                        <img src="{{ $photo['local_path'] }}" class="photo-img" alt="Photo #{{ $photo['item_no'] }}">
                      @elseif(!empty($photo['file_path']))
                        <div class="photo-placeholder">Image file: {{ $photo['file_path'] }}</div>
                      @else
                        <div class="photo-placeholder">No image file available</div>
                      @endif
                    </div>
                  </div>
                </td>
              @endforeach
              @if(count($row) === 1)
                <td class="photo-grid-cell-empty" style="width: 50%; border: none; background: transparent;">&nbsp;</td>
              @endif
            </tr>
          @endforeach
        </table>
      </div>
    @endif
  @else
    {{-- Fallback: Flat photo grid when no slots configured --}}
    @if(empty($photos))
      <div class="no-photos" style="font-size:8.5pt;color:#777;font-style:italic;">No photographic records attached.</div>
    @else
      <table class="photo-grid-table">
        @foreach(array_chunk($photos, 2) as $row)
          <tr class="photo-grid-row">
            @foreach($row as $photo)
              <td class="photo-grid-cell">
                <div class="photo-card">
                  {{-- Metadata text ABOVE image --}}
                  <div class="photo-meta">
                    <div class="photo-title-line">
                      <span class="photo-number">#{{ $photo['item_no'] }}</span>
                      @if(!empty($photo['title']))
                        <span class="photo-title">{{ $photo['title'] }}</span>
                      @endif
                    </div>

                    @if(!empty($photo['category_name']) || !empty($photo['location']))
                      <div class="photo-subline">
                        @if(!empty($photo['category_name']))
                          <span class="photo-category"><strong>Category:</strong> {{ $photo['category_name'] }}</span>
                        @endif
                        @if(!empty($photo['category_name']) && !empty($photo['location']))
                          <span class="photo-sep">•</span>
                        @endif
                        @if(!empty($photo['location']))
                          <span class="photo-location"><strong>Location:</strong> {{ $photo['location'] }}</span>
                        @endif
                      </div>
                    @endif

                    @if(!empty($photo['caption']))
                      <div class="photo-caption">{{ $photo['caption'] }}</div>
                    @endif

                    @if(!empty($photo['description']))
                      <div class="photo-description">{!! nl2br(e($photo['description'])) !!}</div>
                    @endif
                  </div>

                  {{-- Scaled image box BELOW text --}}
                  <div class="photo-img-box">
                    @if(!empty($photo['local_path']) && file_exists($photo['local_path']))
                      <img src="{{ $photo['local_path'] }}" class="photo-img" alt="Photo #{{ $photo['item_no'] }}">
                    @elseif(!empty($photo['file_path']))
                      <div class="photo-placeholder">Image file: {{ $photo['file_path'] }}</div>
                    @else
                      <div class="photo-placeholder">No image file available</div>
                    @endif
                  </div>
                </div>
              </td>
            @endforeach
            @if(count($row) === 1)
              <td class="photo-grid-cell-empty" style="width: 50%; border: none; background: transparent;">&nbsp;</td>
            @endif
          </tr>
        @endforeach
      </table>
    @endif
  @endif
</div>
