import {
    Camera,
    Check,
    CheckCircle2,
    Image as ImageIcon,
    Loader2,
    Maximize2,
    MessageSquare,
    Plus,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { compressImage } from '@/lib/image-compressor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface PhotoRecord {
    id: number;
    report_id: number;
    source_photo_id?: number | null;
    report_reference?: string;
    report_date?: string;
    vessel_name?: string;
    item_no: number;
    title: string | null;
    caption: string | null;
    description: string | null;
    location?: string | null;
    photo_category_id?: number | null;
    category_id?: number | null;
    category?: {
        id: number;
        name: string;
        code: string;
    } | null;
    category_name?: string;
    file_path?: string;
    thumbnail_path?: string;
    file_url?: string;
    thumbnail_url?: string;
    original_filename?: string;
    file_size?: number;
    sort_order?: number;
    report_question_id?: number | null;
    question_item_no?: string | null;
    finding_id?: number | null;
    finding_no?: string | null;
    uploaded_by?: string | null;
    created_at?: string;
}

export function getPhotoThumbnailSrc(photo: PhotoRecord): string {
    if (photo.thumbnail_url) return photo.thumbnail_url;
    if (photo.file_url) return photo.file_url;
    if (photo.thumbnail_path) return `/storage/${photo.thumbnail_path}`;
    if (photo.file_path) return `/storage/${photo.file_path}`;
    return '';
}

export function getPhotoFullSrc(photo: PhotoRecord): string {
    if (photo.file_url) return photo.file_url;
    if (photo.thumbnail_url) return photo.thumbnail_url;
    if (photo.file_path) return `/storage/${photo.file_path}`;
    if (photo.thumbnail_path) return `/storage/${photo.thumbnail_path}`;
    return '';
}

export interface PhotoCategoryItem {
    id: number;
    name: string;
    code: string;
}

export interface QuestionOptionItem {
    id: number;
    item_number: string | null;
    question_text: string;
}

export interface FindingOptionItem {
    id: number;
    finding_no: string;
    description: string;
}

interface PhotoChapterSectionProps {
    reportId: number;
    title?: string;
    description?: string;
    isPhotoForm?: boolean;
    isEditable?: boolean;
    photos: PhotoRecord[];
    schemaItems?: Array<{ id?: string; title: string; description?: string }>;
    initialComments?: Record<string, string>;
    categories?: PhotoCategoryItem[];
    allowedCategoryCodes?: string[];
    questions?: QuestionOptionItem[];
    findings?: FindingOptionItem[];
    onPhotosChange?: (updatedPhotos: PhotoRecord[]) => void;
}

export function PhotoChapterSection({
    reportId,
    title = 'Photographic Records',
    description = 'Photographic evidence and vessel condition records.',
    isPhotoForm = false,
    isEditable = true,
    photos = [],
    schemaItems = [],
    initialComments = {},
    onPhotosChange,
}: PhotoChapterSectionProps) {
    const [photoList, setPhotoList] = useState<PhotoRecord[]>(photos);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    // Keep photoList in sync with props
    React.useEffect(() => {
        setPhotoList(photos);
    }, [photos]);

    // Lightbox / Image Preview Modal
    const [previewPhoto, setPreviewPhoto] = useState<PhotoRecord | null>(null);

    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const freeformFileInputRef = useRef<HTMLInputElement | null>(null);

    const [sectionComments, setSectionComments] = useState<Record<string, string>>(initialComments || {});
    const [savingStatus, setSavingStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
    const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const lastSavedComments = useRef<Record<string, string>>(initialComments || {});

    React.useEffect(() => {
        if (initialComments) {
            setSectionComments(initialComments);
            lastSavedComments.current = initialComments;
        }
    }, [initialComments]);

    const saveSectionComment = async (sectionKey: string, comment: string) => {
        if (!isEditable) return;
        setSavingStatus((prev) => ({ ...prev, [sectionKey]: 'saving' }));
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/reports/${reportId}/photo-section-comment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ section_key: sectionKey, comment }),
            });
            if (res.ok) {
                setSavingStatus((prev) => ({ ...prev, [sectionKey]: 'saved' }));
                setTimeout(() => {
                    setSavingStatus((prev) => {
                        const next = { ...prev };
                        delete next[sectionKey];
                        return next;
                    });
                }, 2000);
            } else {
                setSavingStatus((prev) => ({ ...prev, [sectionKey]: 'error' }));
            }
        } catch {
            setSavingStatus((prev) => ({ ...prev, [sectionKey]: 'error' }));
        }
    };

    const handleCommentChange = (sectionKey: string, text: string) => {
        setSectionComments((prev) => ({ ...prev, [sectionKey]: text }));
        if (debounceTimers.current[sectionKey]) {
            clearTimeout(debounceTimers.current[sectionKey]);
        }
        debounceTimers.current[sectionKey] = setTimeout(() => {
            if (text !== (lastSavedComments.current[sectionKey] ?? '')) {
                lastSavedComments.current[sectionKey] = text;
                saveSectionComment(sectionKey, text);
            }
        }, 1200);
    };

    const handleCommentBlur = (sectionKey: string) => {
        const text = sectionComments[sectionKey] ?? '';
        if (debounceTimers.current[sectionKey]) {
            clearTimeout(debounceTimers.current[sectionKey]);
        }
        if (text !== (lastSavedComments.current[sectionKey] ?? '')) {
            lastSavedComments.current[sectionKey] = text;
            saveSectionComment(sectionKey, text);
        }
    };

    const handleUploadForSlot = async (slotNo: number, slotTitle: string, files: FileList | File[]) => {
        const fileArr = Array.from(files);
        if (fileArr.length === 0) return;

        setIsUploading(true);
        setUploadingSlot(slotNo);
        setUploadProgress(`Optimizing ${fileArr.length} photo(s) for "${slotTitle}"...`);

        try {
            const formData = new FormData();
            for (let i = 0; i < fileArr.length; i++) {
                try {
                    const { file: optimizedFile } = await compressImage(fileArr[i], {
                        maxEdge: 2000,
                        quality: 0.8,
                        onStatus: (status) => setUploadProgress(`${status} (${i + 1}/${fileArr.length})`),
                    });
                    formData.append('files[]', optimizedFile);
                } catch {
                    formData.append('files[]', fileArr[i]);
                }
            }

            setUploadProgress(`Uploading ${fileArr.length} photo(s)...`);
            formData.append('title', slotTitle);
            formData.append('caption', slotTitle);
            formData.append('item_no', String(slotNo));

            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/photos`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || `Upload failed with status ${response.status}`);
            }

            const data = await response.json();
            const newPhotos: PhotoRecord[] = data.photos || (data.photo ? [data.photo] : []);
            if (newPhotos.length > 0) {
                const updatedList = [...photoList, ...newPhotos];
                setPhotoList(updatedList);
                onPhotosChange?.(updatedList);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            alert(err?.message || 'Failed to upload photo(s). Please try again.');
        } finally {
            setIsUploading(false);
            setUploadingSlot(null);
            setUploadProgress(null);
            if (fileInputRefs.current[slotNo]) {
                fileInputRefs.current[slotNo]!.value = '';
            }
        }
    };

    const handleUploadFreeform = async (files: FileList | File[]) => {
        const fileArr = Array.from(files);
        if (fileArr.length === 0) return;

        setIsUploading(true);
        setUploadProgress(`Optimizing ${fileArr.length} photo(s)...`);

        try {
            const formData = new FormData();
            for (let i = 0; i < fileArr.length; i++) {
                try {
                    const { file: optimizedFile } = await compressImage(fileArr[i], {
                        maxEdge: 2000,
                        quality: 0.8,
                        onStatus: (status) => setUploadProgress(`${status} (${i + 1}/${fileArr.length})`),
                    });
                    formData.append('files[]', optimizedFile);
                } catch {
                    formData.append('files[]', fileArr[i]);
                }
            }

            const nextItemNo = photoList.length + 1;
            formData.append('item_no', String(nextItemNo));
            formData.append('title', `Photo #${nextItemNo}`);
            formData.append('caption', `Photo #${nextItemNo}`);

            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/photos`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || `Upload failed with status ${response.status}`);
            }

            const data = await response.json();
            const newPhotos: PhotoRecord[] = data.photos || (data.photo ? [data.photo] : []);
            if (newPhotos.length > 0) {
                const updatedList = [...photoList, ...newPhotos];
                setPhotoList(updatedList);
                onPhotosChange?.(updatedList);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            alert(err?.message || 'Failed to upload photo(s). Please try again.');
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
            if (freeformFileInputRef.current) {
                freeformFileInputRef.current.value = '';
            }
        }
    };

    const handleDeletePhoto = async (photoId: number) => {
        if (!confirm('Are you sure you want to delete this photo?')) return;

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/photos/${photoId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ delete_reason: 'Removed by user' }),
            });

            if (!response.ok) {
                throw new Error('Delete failed');
            }

            const updatedList = photoList.filter((p) => p.id !== photoId);
            setPhotoList(updatedList);
            onPhotosChange?.(updatedList);
        } catch (err) {
            console.error('Delete photo error:', err);
            alert('Failed to delete photo.');
        }
    };

    const hasConfiguredSlots = Boolean(schemaItems && schemaItems.length > 0);

    const matchedPhotoIds = new Set<number>();
    if (hasConfiguredSlots) {
        schemaItems.forEach((slot, idx) => {
            const slotNo = idx + 1;
            const matchedList = photoList.filter(
                (p) => p.item_no === slotNo || (p.title && p.title.toLowerCase() === slot.title.toLowerCase())
            );
            matchedList.forEach((p) => matchedPhotoIds.add(p.id));
        });
    }
    const additionalPhotos = hasConfiguredSlots ? photoList.filter((p) => !matchedPhotoIds.has(p.id)) : [];

    return (
        <Card id="photo-chapter" className="gap-0 overflow-hidden py-0 border shadow-sm">
            {/* Header: Title and Photo Count + Optional Link Button */}
            <CardHeader className="bg-muted/30 border-b p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Camera className="size-5 text-primary shrink-0" />
                            <CardTitle className="text-lg font-bold">{title}</CardTitle>
                            <Badge variant="secondary" className="font-mono text-xs">
                                {photoList.length} Photo{photoList.length !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-1">{description}</p>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
                {uploadProgress && (
                    <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center gap-3">
                        <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">{uploadProgress}</span>
                    </div>
                )}

                {/* Case 1: Template has defined Photo Fields (Slots configured in Forms page) */}
                {hasConfiguredSlots ? (
                    <div className="space-y-4">
                        {schemaItems.map((slot, idx) => {
                            const slotNo = idx + 1;
                            const slotKey = slot.id || String(slotNo);
                            const matchedPhotos = photoList.filter(
                                (p) => p.item_no === slotNo || (p.title && p.title.toLowerCase() === slot.title.toLowerCase())
                            );

                            return (
                                <div
                                    key={slot.id || idx}
                                    className="rounded-xl border bg-card overflow-hidden shadow-2xs flex flex-col"
                                >
                                    {/* Row 1: Title, Description, Status, and Direct Upload */}
                                    <div className="p-3.5 sm:p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                            <Badge variant="outline" className="text-xs font-mono shrink-0 mt-0.5">
                                                #{slotNo}
                                            </Badge>
                                            <div className="space-y-0.5 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold text-sm text-foreground">
                                                        {slot.title}
                                                    </h4>
                                                    {matchedPhotos.length > 0 ? (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] font-medium">
                                                            {matchedPhotos.length} {matchedPhotos.length === 1 ? 'Photo' : 'Photos'}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground border-border text-[10px] font-medium">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </div>
                                                {slot.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {slot.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 1 Upload Action */}
                                        {isEditable && (
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                <input
                                                    ref={(el) => { fileInputRefs.current[slotNo] = el; }}
                                                    type="file"
                                                    multiple
                                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 0) {
                                                            handleUploadForSlot(slotNo, slot.title, e.target.files);
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={uploadingSlot === slotNo}
                                                    onClick={() => fileInputRefs.current[slotNo]?.click()}
                                                    className="h-8 gap-1.5 text-xs font-medium"
                                                >
                                                    <UploadCloud className="size-3.5 text-primary" />
                                                    <span>{uploadingSlot === slotNo ? 'Uploading...' : matchedPhotos.length > 0 ? '+ Add More Photos' : 'Upload Photos'}</span>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 2: Photos Only — Thumbnails with Enlarge & Delete */}
                                    <div className="p-3.5 sm:p-4 bg-card">
                                        {matchedPhotos.length > 0 ? (
                                            <div className="flex flex-wrap items-center gap-3">
                                                {matchedPhotos.map((photo) => (
                                                    <div
                                                        key={photo.id}
                                                        className="relative rounded-lg overflow-hidden border bg-muted/30 group shadow-xs hover:border-primary/50 transition-all shrink-0"
                                                    >
                                                        <img
                                                            src={getPhotoThumbnailSrc(photo)}
                                                            alt={photo.title || slot.title}
                                                            className="h-28 w-28 sm:h-32 sm:w-32 object-cover rounded-lg group-hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                                                            onClick={() => setPreviewPhoto(photo)}
                                                            title={photo.title || slot.title}
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                className="h-7 w-7 p-0 rounded-full text-white bg-black/60 hover:bg-black/80"
                                                                onClick={() => setPreviewPhoto(photo)}
                                                                title="Enlarge"
                                                            >
                                                                <Maximize2 className="size-3.5" />
                                                            </Button>
                                                            {isEditable && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-7 w-7 p-0 rounded-full text-white bg-destructive/80 hover:bg-destructive"
                                                                    onClick={() => handleDeletePhoto(photo.id)}
                                                                    title="Delete Photo"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                {isEditable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRefs.current[slotNo]?.click()}
                                                        disabled={uploadingSlot === slotNo}
                                                        className="h-28 w-28 sm:h-32 sm:w-32 border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-muted-foreground hover:text-foreground shrink-0"
                                                        title="Add more photos to this title"
                                                    >
                                                        <Plus className="size-5 text-primary" />
                                                        <span className="text-[11px] font-medium">Add Photo</span>
                                                    </button>
                                                )}
                                            </div>
                                        ) : isEditable ? (
                                            <div
                                                onClick={() => fileInputRefs.current[slotNo]?.click()}
                                                className="w-full border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 rounded-lg py-5 px-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3"
                                            >
                                                <div className="p-2 bg-background rounded-full border shadow-2xs shrink-0">
                                                    <UploadCloud className="size-4 text-primary" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-xs font-medium text-foreground">
                                                        {uploadingSlot === slotNo ? 'Uploading...' : 'Click to Upload Photos for this title (select multiple)'}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        JPG, PNG, WEBP, or HEIC — select multiple files
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-muted-foreground text-xs italic">
                                                No photo uploaded for this item.
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 3: Section Comments / Remarks */}
                                    <div className="p-3.5 sm:p-4 border-t bg-muted/10 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                <MessageSquare className="size-3.5 text-muted-foreground" />
                                                <span>Comments / Remarks</span>
                                            </label>
                                            {savingStatus[slotKey] === 'saving' && (
                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                    <Loader2 className="size-3 animate-spin" /> Saving...
                                                </span>
                                            )}
                                            {savingStatus[slotKey] === 'saved' && (
                                                <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                                                    <Check className="size-3" /> Saved
                                                </span>
                                            )}
                                            {savingStatus[slotKey] === 'error' && (
                                                <span className="text-[11px] text-destructive">Failed to save</span>
                                            )}
                                        </div>
                                        <textarea
                                            rows={2}
                                            value={sectionComments[slotKey] ?? ''}
                                            disabled={!isEditable}
                                            onChange={(e) => handleCommentChange(slotKey, e.target.value)}
                                            onBlur={() => handleCommentBlur(slotKey)}
                                            placeholder={`Enter observations, notes, or remarks for ${slot.title}...`}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 resize-y min-h-[56px]"
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Additional Photos (photos not mapped to a slot) */}
                        {additionalPhotos.length > 0 && (
                            <div className="pt-6 border-t space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                        <span>Additional Photos</span>
                                        <Badge variant="secondary" className="text-xs font-mono">
                                            {additionalPhotos.length}
                                        </Badge>
                                    </h4>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {additionalPhotos.map((photo) => (
                                        <div
                                            key={photo.id}
                                            className="relative rounded-lg overflow-hidden border bg-muted/30 group shadow-xs hover:border-primary/50 transition-all shrink-0"
                                        >
                                            <img
                                                src={getPhotoThumbnailSrc(photo)}
                                                alt={photo.title || `Photo #${photo.item_no}`}
                                                className="h-28 w-28 sm:h-32 sm:w-32 object-cover rounded-lg group-hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                                                onClick={() => setPreviewPhoto(photo)}
                                                title={photo.title || `Photo #${photo.item_no}`}
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-7 w-7 p-0 rounded-full text-white bg-black/60 hover:bg-black/80"
                                                    onClick={() => setPreviewPhoto(photo)}
                                                    title="Enlarge"
                                                >
                                                    <Maximize2 className="size-3.5" />
                                                </Button>
                                                {isEditable && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-7 w-7 p-0 rounded-full text-white bg-destructive/80 hover:bg-destructive"
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        title="Delete Photo"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Case 2: Freeform Photos (No predefined slots in template) */
                    <div>
                        {isEditable && (
                            <input
                                ref={freeformFileInputRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        handleUploadFreeform(e.target.files);
                                    }
                                }}
                            />
                        )}

                        {photoList.length === 0 ? (
                            <div
                                onClick={() => {
                                    if (isEditable) freeformFileInputRef.current?.click();
                                }}
                                className={`border-2 border-dashed rounded-xl py-12 px-6 text-center transition-all ${
                                    isEditable
                                        ? 'border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 cursor-pointer'
                                        : 'border-border/40 bg-muted/5'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                                    <UploadCloud className="size-6" />
                                </div>
                                <h4 className="text-sm font-semibold text-foreground">No photos uploaded yet</h4>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                    Click to select and upload multiple photographic records for this report.
                                </p>
                                {isEditable && (
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="gap-1.5 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                freeformFileInputRef.current?.click();
                                            }}
                                        >
                                            <UploadCloud className="size-4" />
                                            <span>Upload Photos (Multi-select)</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    {photoList.map((photo) => (
                                        <div
                                            key={photo.id}
                                            className="relative rounded-lg overflow-hidden border bg-muted/30 group shadow-xs hover:border-primary/50 transition-all shrink-0"
                                        >
                                            <img
                                                src={getPhotoThumbnailSrc(photo)}
                                                alt={photo.title || `Photo #${photo.item_no}`}
                                                className="h-28 w-28 sm:h-32 sm:w-32 object-cover rounded-lg group-hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                                                onClick={() => setPreviewPhoto(photo)}
                                                title={photo.title || `Photo #${photo.item_no}`}
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-7 w-7 p-0 rounded-full text-white bg-black/60 hover:bg-black/80"
                                                    onClick={() => setPreviewPhoto(photo)}
                                                    title="Enlarge"
                                                >
                                                    <Maximize2 className="size-3.5" />
                                                </Button>
                                                {isEditable && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-7 w-7 p-0 rounded-full text-white bg-destructive/80 hover:bg-destructive"
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        title="Delete Photo"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isEditable && (
                                        <button
                                            type="button"
                                            onClick={() => freeformFileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="h-28 w-28 sm:h-32 sm:w-32 border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-muted-foreground hover:text-foreground shrink-0"
                                            title="Add more photos"
                                        >
                                            <Plus className="size-5 text-primary" />
                                            <span className="text-[11px] font-medium">Add Photo</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Lightbox / Preview Modal */}
            {previewPhoto && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
                    onClick={() => setPreviewPhoto(null)}
                >
                    <button
                        type="button"
                        onClick={() => setPreviewPhoto(null)}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full bg-white/10"
                    >
                        <X className="size-6" />
                    </button>
                    <img
                        src={getPhotoFullSrc(previewPhoto)}
                        alt={previewPhoto.title || `Photo #${previewPhoto.item_no}`}
                        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
                    />
                    <div className="mt-4 text-center text-white space-y-1 max-w-lg">
                        <div className="font-semibold text-base">
                            #{previewPhoto.item_no} {previewPhoto.title || previewPhoto.caption}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
