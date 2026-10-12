import {
    Camera,
    CheckCircle2,
    Image as ImageIcon,
    Link2,
    Loader2,
    Maximize2,
    Plus,
    RefreshCw,
    Trash2,
    Unlink,
    UploadCloud,
    X,
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { compressImage } from '@/lib/image-compressor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { AvailablePhotoReport } from '@/types';

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
    photoFormCode?: string;
    photos: PhotoRecord[];
    schemaItems?: Array<{ id?: string; title: string; description?: string }>;
    categories?: PhotoCategoryItem[];
    allowedCategoryCodes?: string[];
    questions?: QuestionOptionItem[];
    findings?: FindingOptionItem[];
    onPhotosChange?: (updatedPhotos: PhotoRecord[]) => void;
    linkedReport?: {
        id: number;
        reference_number: string;
        vessel_name: string;
        report_date?: string | null;
        status?: string;
        form?: { code?: string; name?: string; form_type?: string } | null;
    } | null;
    availableReports?: AvailablePhotoReport[];
    onLinkedReportChange?: (linkedReport: any) => void;
}

export function PhotoChapterSection({
    reportId,
    title = 'Photographic Records',
    description = 'Photographic evidence and vessel condition records.',
    isPhotoForm = false,
    isEditable = true,
    photoFormCode = 'P-001',
    photos = [],
    schemaItems = [],
    onPhotosChange,
    linkedReport = null,
    availableReports = [],
    onLinkedReportChange,
}: PhotoChapterSectionProps) {
    const [photoList, setPhotoList] = useState<PhotoRecord[]>(photos);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    const [currentLinkedReport, setCurrentLinkedReport] = useState(linkedReport || null);
    React.useEffect(() => {
        setCurrentLinkedReport(linkedReport || null);
    }, [linkedReport]);

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [availableReportsList, setAvailableReportsList] = useState<AvailablePhotoReport[]>(availableReports || []);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [dismissedSetupPrompt, setDismissedSetupPrompt] = useState(false);

    React.useEffect(() => {
        if (availableReports && availableReports.length > 0) {
            setAvailableReportsList(availableReports);
        }
    }, [availableReports]);

    const handleOpenImportDialog = async () => {
        setIsImportDialogOpen(true);
        if (availableReportsList.length === 0) {
            setIsLoadingReports(true);
            try {
                const res = await fetch(`/reports/${reportId}/available-photo-reports`, {
                    headers: { Accept: 'application/json' },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.reports) {
                        setAvailableReportsList(data.reports);
                    }
                }
            } catch (err) {
                console.error('Fetch available reports error:', err);
            } finally {
                setIsLoadingReports(false);
            }
        }
    };

    const handleLinkReport = async (sourceReportId: number) => {
        setIsLinking(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/link-photo-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ source_report_id: sourceReportId }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || `Failed to link report (${response.status})`);
            }

            const data = await response.json();
            if (data.photos) {
                setPhotoList(data.photos);
                onPhotosChange?.(data.photos);
            }
            if (data.linked_photo_report) {
                setCurrentLinkedReport(data.linked_photo_report);
                onLinkedReportChange?.(data.linked_photo_report);
            }
            setIsImportDialogOpen(false);
        } catch (err: any) {
            console.error('Link report error:', err);
            alert(err?.message || 'Failed to link photo report.');
        } finally {
            setIsLinking(false);
        }
    };

    const handleUnlinkReport = async (removePhotos: boolean) => {
        setIsLinking(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/unlink-photo-report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ remove_photos: removePhotos }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.message || `Failed to unlink report (${response.status})`);
            }

            const data = await response.json();
            if (data.photos) {
                setPhotoList(data.photos);
                onPhotosChange?.(data.photos);
            }
            setCurrentLinkedReport(null);
            onLinkedReportChange?.(null);
            setIsUnlinkDialogOpen(false);
        } catch (err: any) {
            console.error('Unlink report error:', err);
            alert(err?.message || 'Failed to unlink photo report.');
        } finally {
            setIsLinking(false);
        }
    };

    // Keep photoList in sync with props
    React.useEffect(() => {
        setPhotoList(photos);
    }, [photos]);

    // Lightbox / Image Preview Modal
    const [previewPhoto, setPreviewPhoto] = useState<PhotoRecord | null>(null);

    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const freeformFileInputRef = useRef<HTMLInputElement | null>(null);

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

                    {!isPhotoForm && (
                        <div className="flex items-center gap-1.5 self-start sm:self-center">
                            <span className="text-xs text-muted-foreground font-medium">Template:</span>
                            <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                                {photoFormCode || 'P-001'}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
                {uploadProgress && (
                    <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center gap-3">
                        <Loader2 className="size-5 animate-spin text-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">{uploadProgress}</span>
                    </div>
                )}

                {/* Banner when a photo report is linked */}
                {currentLinkedReport && (
                    <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                <Link2 className="size-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-foreground">
                                        Linked Photo Form:
                                    </span>
                                    <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-background">
                                        {currentLinkedReport.form?.code || 'PHOTO'} • {currentLinkedReport.reference_number}
                                    </Badge>
                                    {currentLinkedReport.report_date && (
                                        <span className="text-[11px] text-muted-foreground">
                                            ({currentLinkedReport.report_date})
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    Photographic records are linked to this source form.
                                </p>
                            </div>
                        </div>
                        {isEditable && (
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenImportDialog}
                                    disabled={isLinking}
                                    className="h-7 px-2.5 text-xs bg-background gap-1"
                                >
                                    <RefreshCw className="size-3 text-muted-foreground" />
                                    <span>Change Form</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsUnlinkDialogOpen(true)}
                                    disabled={isLinking}
                                    className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                >
                                    <Unlink className="size-3" />
                                    <span>Unlink</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Initial Setup Choice: Prompt user when arriving at empty photo chapter in normal form */}
                {!isPhotoForm && !currentLinkedReport && photoList.length === 0 && !dismissedSetupPrompt && isEditable && (
                    <div className="mb-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Link2 className="size-4 text-primary" />
                                <h4 className="text-sm font-bold text-foreground">Set Up Photographic Evidence</h4>
                            </div>
                            <p className="text-xs text-muted-foreground max-w-xl">
                                Would you like to use and link photos from an existing photo report for this vessel (e.g. {photoFormCode || 'P-001'}), or start clean and upload photos directly?
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={handleOpenImportDialog}
                                className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                            >
                                <Link2 className="size-3.5" />
                                <span>Use Photos from Existing Form</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDismissedSetupPrompt(true)}
                                className="h-8 gap-1.5 text-xs bg-background"
                            >
                                <Plus className="size-3.5 text-muted-foreground" />
                                <span>Start Clean</span>
                            </Button>
                        </div>
                    </div>
                )}

                {/* Case 1: Template has defined Photo Fields (Slots configured in Forms page) */}
                {hasConfiguredSlots ? (
                    <div className="space-y-4">
                        {schemaItems.map((slot, idx) => {
                            const slotNo = idx + 1;
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
            {/* Import / Link Photos Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Link2 className="size-5 text-primary" />
                            <DialogTitle className="text-base font-bold">Use Photos from Existing Form</DialogTitle>
                        </div>
                        <DialogDescription className="text-xs">
                            Select an existing photo report for this vessel to link and import its photographic records.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {isLoadingReports ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="size-6 animate-spin text-primary" />
                                <span className="text-xs">Finding photo reports for this vessel...</span>
                            </div>
                        ) : availableReportsList.length === 0 ? (
                            <div className="py-10 text-center space-y-3">
                                <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                                    <ImageIcon className="size-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">No Photo Reports Found</p>
                                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                        There are no reports with photos available to import yet.
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsImportDialogOpen(false)}
                                    className="text-xs"
                                >
                                    Close
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground">
                                    Available Reports ({availableReportsList.length}):
                                </p>
                                {availableReportsList.map((r) => {
                                    const isCurrent = currentLinkedReport?.id === r.id;
                                    return (
                                        <div
                                            key={r.id}
                                            className={`rounded-xl border p-4 transition-all flex flex-col gap-3 ${
                                                isCurrent
                                                    ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                                                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/10'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="outline" className="font-mono text-xs font-bold text-foreground">
                                                            {r.form_code || 'PHOTO'}
                                                        </Badge>
                                                        <span className="font-bold text-sm text-foreground">
                                                            {r.reference_number}
                                                        </span>
                                                        <Badge variant="secondary" className="text-[11px] font-mono">
                                                            {r.photos_count} photo{r.photos_count !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-[11px] font-medium">
                                                            {r.vessel_name}
                                                        </Badge>
                                                        {r.is_same_vessel && (
                                                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-[10px] font-semibold">
                                                                This Vessel
                                                            </Badge>
                                                        )}
                                                        {isCurrent && (
                                                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/40 text-[10px] font-semibold">
                                                                Currently Linked
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                        <span>{r.form_name}</span>
                                                        {r.report_date && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{r.report_date}</span>
                                                            </>
                                                        )}
                                                        <span>•</span>
                                                        <span className="capitalize">{r.status.replace('_', ' ')}</span>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isCurrent ? 'outline' : 'default'}
                                                    disabled={isLinking || isCurrent}
                                                    onClick={() => handleLinkReport(r.id)}
                                                    className="shrink-0 gap-1.5 text-xs font-semibold"
                                                >
                                                    {isLinking ? (
                                                        <Loader2 className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <Link2 className="size-3.5" />
                                                    )}
                                                    <span>{isCurrent ? 'Already Linked' : 'Link & Use Photos'}</span>
                                                </Button>
                                            </div>

                                            {/* Preview thumbnails strip */}
                                            {r.preview_photos && r.preview_photos.length > 0 && (
                                                <div className="flex items-center gap-2 pt-2 border-t border-border/50 overflow-x-auto">
                                                    {r.preview_photos.map((p) => (
                                                        <div
                                                            key={p.id}
                                                            className="size-14 rounded-md overflow-hidden border bg-muted/30 shrink-0"
                                                        >
                                                            {p.thumbnail_url ? (
                                                                <img
                                                                    src={p.thumbnail_url}
                                                                    alt={p.title || 'Preview'}
                                                                    className="size-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="size-full flex items-center justify-center text-muted-foreground">
                                                                    <ImageIcon className="size-4" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {r.photos_count > r.preview_photos.length && (
                                                        <span className="text-[11px] text-muted-foreground pl-1 font-mono shrink-0">
                                                            +{r.photos_count - r.preview_photos.length} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setIsImportDialogOpen(false);
                                setDismissedSetupPrompt(true);
                            }}
                            className="text-xs text-muted-foreground"
                        >
                            Start Clean Instead
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImportDialogOpen(false)}
                            className="text-xs"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unlink Confirmation Dialog */}
            <Dialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">Unlink Photo Form</DialogTitle>
                        <DialogDescription className="text-xs">
                            Are you sure you want to unlink from{' '}
                            <span className="font-semibold text-foreground">
                                {currentLinkedReport?.reference_number}
                            </span>
                            ?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-xs text-muted-foreground space-y-2">
                        <p>You can choose what to do with the photos currently in this report:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>
                                <strong>Keep Photos</strong>: Retain photos in this report as independent copies.
                            </li>
                            <li>
                                <strong>Remove Imported Photos</strong>: Clear the imported photos from this report.
                            </li>
                        </ul>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsUnlinkDialogOpen(false)}
                            disabled={isLinking}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleUnlinkReport(true)}
                            disabled={isLinking}
                            className="text-xs gap-1.5"
                        >
                            <Trash2 className="size-3.5" />
                            <span>Remove & Unlink</span>
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleUnlinkReport(false)}
                            disabled={isLinking}
                            className="text-xs gap-1.5"
                        >
                            <Unlink className="size-3.5" />
                            <span>Keep Photos & Unlink</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
