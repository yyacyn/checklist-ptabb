<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Finding;
use App\Models\Photo;
use App\Models\PhotoCategory;
use App\Models\Report;
use App\Models\ReportQuestion;
use App\Services\ImageOptimizer;
use App\Services\VesselName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PhotoController extends Controller
{
    /**
     * Display a paginated, filterable fleet photo gallery (Task 5.8, PHO-4, PHO-8).
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $query = Photo::query()
            ->with([
                'category:id,name,code',
                'report:id,reference_number,vessel_name,report_date,status,report_type',
                'question:id,question_text,item_number',
                'finding:id,finding_no,description,risk_level',
                'uploader:id,name',
            ])
            ->orderByDesc('id');

        // Scoping by role (SRS §2.1, PHO-8)
        if ($user->role === 'vessel') {
            $query->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower(VesselName::normalize($user->vessel_name))]);
        } elseif ($request->filled('vessel_name')) {
            $query->whereRaw('LOWER(vessel_name) = ?', [mb_strtolower(VesselName::normalize($request->input('vessel_name')))]);
        }

        if ($request->filled('category_id')) {
            $query->where('photo_category_id', $request->input('category_id'));
        }

        if ($request->filled('report_id')) {
            $query->where('report_id', $request->input('report_id'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                    ->orWhere('caption', 'like', $search)
                    ->orWhere('description', 'like', $search)
                    ->orWhere('vessel_name', 'like', $search);
            });
        }

        $photos = $query->paginate(24)->withQueryString()->through(fn (Photo $photo) => [
            'id' => $photo->id,
            'report_id' => $photo->report_id,
            'report_reference' => $photo->report?->reference_number,
            'report_date' => $photo->report?->report_date?->toDateString(),
            'vessel_name' => $photo->vessel_name,
            'item_no' => $photo->item_no,
            'title' => $photo->title,
            'caption' => $photo->caption,
            'description' => $photo->description,
            'category_id' => $photo->photo_category_id,
            'category_name' => $photo->category?->name,
            'category_code' => $photo->category?->code,
            'file_url' => asset('storage/' . $photo->file_path),
            'thumbnail_url' => $photo->thumbnail_path ? asset('storage/' . $photo->thumbnail_path) : asset('storage/' . $photo->file_path),
            'original_filename' => $photo->original_filename,
            'file_size' => $photo->file_size,
            'created_at' => $photo->created_at->toIso8601String(),
            'uploaded_by' => $photo->uploader?->name,
            'report_question_id' => $photo->report_question_id,
            'question_item_no' => $photo->question?->item_number,
            'finding_id' => $photo->finding_id,
            'finding_no' => $photo->finding?->finding_no,
        ]);

        $categories = PhotoCategory::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'code']);

        $knownVessels = $user->role === 'vessel'
            ? [VesselName::normalize($user->vessel_name)]
            : VesselName::knownNames();

        return Inertia::render('photos/index', [
            'photos' => $photos,
            'categories' => $categories,
            'known_vessels' => $knownVessels,
            'filters' => $request->only(['vessel_name', 'category_id', 'report_id', 'search']),
        ]);
    }

    /**
     * Store a newly uploaded photo record for a report (Tasks 5.3, 5.6, PHO-1, IMG-1, IMG-7).
     */
    public function store(Request $request, Report $report, ImageOptimizer $optimizer): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:25600', 'mimes:jpeg,jpg,png,webp,heic,heif'],
            'item_no' => ['nullable', 'integer', 'min:1'],
            'title' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'location' => ['nullable', 'string', 'max:255'],
            'photo_category_id' => ['nullable', 'exists:photo_categories,id'],
            'report_question_id' => ['nullable', 'exists:report_questions,id'],
            'finding_id' => ['nullable', 'exists:findings,id'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $file = $request->file('file');
        $optimized = $optimizer->storeAndOptimize($file, $report->id);

        // Auto-determine next item_no if not provided
        $itemNo = $validated['item_no'] ?? ((int) $report->photos()->max('item_no') + 1);
        $sortOrder = $validated['sort_order'] ?? ((int) $report->photos()->max('sort_order') + 1);

        $photo = Photo::create([
            'report_id' => $report->id,
            'report_question_id' => $validated['report_question_id'] ?? null,
            'finding_id' => $validated['finding_id'] ?? null,
            'photo_category_id' => $validated['photo_category_id'] ?? null,
            'vessel_name' => $report->vessel_name,
            'item_no' => $itemNo,
            'title' => $validated['title'] ?? null,
            'caption' => $validated['caption'] ?? $validated['title'] ?? null,
            'description' => $validated['description'] ?? null,
            'location' => $validated['location'] ?? null,
            'original_filename' => $file->getClientOriginalName(),
            'file_path' => $optimized['file_path'],
            'thumbnail_path' => $optimized['thumbnail_path'],
            'file_size' => $optimized['file_size'],
            'mime_type' => $optimized['mime_type'],
            'checksum' => $optimized['checksum'],
            'uploaded_by' => $request->user()->id,
            'sort_order' => $sortOrder,
        ]);

        $photo->load(['category:id,name,code', 'uploader:id,name']);

        ActivityLog::record(
            $photo,
            'photo_uploaded',
            'file_path',
            null,
            $photo->file_path,
            $report->id
        );

        return response()->json([
            'status' => 'success',
            'photo' => [
                'id' => $photo->id,
                'report_id' => $photo->report_id,
                'item_no' => $photo->item_no,
                'title' => $photo->title,
                'caption' => $photo->caption,
                'description' => $photo->description,
                'location' => $photo->location,
                'category_id' => $photo->photo_category_id,
                'category' => $photo->category,
                'file_url' => asset('storage/' . $photo->file_path),
                'thumbnail_url' => $photo->thumbnail_path ? asset('storage/' . $photo->thumbnail_path) : asset('storage/' . $photo->file_path),
                'file_size' => $photo->file_size,
                'sort_order' => $photo->sort_order,
                'report_question_id' => $photo->report_question_id,
                'finding_id' => $photo->finding_id,
                'uploaded_by' => $photo->uploader?->name,
                'created_at' => $photo->created_at->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * Update photo metadata (caption, category, description, links) (Task 5.3, 5.9).
     */
    public function update(Request $request, Report $report, Photo $photo): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($photo->report_id !== $report->id) {
            abort(404, 'Photo does not belong to this report.');
        }

        $validated = $request->validate([
            'item_no' => ['nullable', 'integer', 'min:1'],
            'title' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'location' => ['nullable', 'string', 'max:255'],
            'photo_category_id' => ['nullable', 'exists:photo_categories,id'],
            'report_question_id' => ['nullable', 'exists:report_questions,id'],
            'finding_id' => ['nullable', 'exists:findings,id'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $photo->update($validated);
        $photo->load(['category:id,name,code', 'uploader:id,name']);

        return response()->json([
            'status' => 'success',
            'photo' => [
                'id' => $photo->id,
                'report_id' => $photo->report_id,
                'item_no' => $photo->item_no,
                'title' => $photo->title,
                'caption' => $photo->caption,
                'description' => $photo->description,
                'location' => $photo->location,
                'category_id' => $photo->photo_category_id,
                'category' => $photo->category,
                'file_url' => asset('storage/' . $photo->file_path),
                'thumbnail_url' => $photo->thumbnail_path ? asset('storage/' . $photo->thumbnail_path) : asset('storage/' . $photo->file_path),
                'file_size' => $photo->file_size,
                'sort_order' => $photo->sort_order,
                'report_question_id' => $photo->report_question_id,
                'finding_id' => $photo->finding_id,
                'uploaded_by' => $photo->uploader?->name,
                'created_at' => $photo->created_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Soft delete a photo record (Task 5.11, PHO-7).
     */
    public function destroy(Request $request, Report $report, Photo $photo): JsonResponse
    {
        Gate::authorize('update', $report);

        if ($photo->report_id !== $report->id) {
            abort(404, 'Photo does not belong to this report.');
        }

        $reason = $request->input('delete_reason', 'Deleted by user');
        $photo->update(['delete_reason' => $reason]);
        $photo->delete();

        ActivityLog::record(
            $photo,
            'photo_deleted',
            'delete_reason',
            null,
            $reason,
            $report->id
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Photo deleted successfully.',
        ]);
    }

    /**
     * Reorder photos within a report (Task 5.10, PHO-6).
     */
    public function reorder(Request $request, Report $report): JsonResponse
    {
        Gate::authorize('update', $report);

        $validated = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['integer', 'exists:photos,id'],
        ]);

        foreach ($validated['order'] as $index => $photoId) {
            Photo::where('id', $photoId)
                ->where('report_id', $report->id)
                ->update(['sort_order' => $index + 1]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Photo order updated.',
        ]);
    }
}
