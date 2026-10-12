import {
    ArrowDown,
    ArrowUp,
    Camera,
    Check,
    Edit2,
    ExternalLink,
    FileImage,
    Image as ImageIcon,
    Link2,
    Loader2,
    Maximize2,
    Plus,
    Tag,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import React, { useState, useRef } from 'react';
import { compressImage, formatFileSize } from '@/lib/image-compressor';
import { MultiPhotoUploadDialog } from '@/components/multi-photo-upload-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PhotoRecord {
    id: number;
    report_id: number;
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
    category_code?: string;
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
    categories = [],
    allowedCategoryCodes,
    questions = [],
    findings = [],
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

    // Edit Caption Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingPhoto, setEditingPhoto] = useState<PhotoRecord | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Multi-photo Upload Dialog State
    const [isMultiUploadOpen, setIsMultiUploadOpen] = useState(false);
    const [initialMultiFiles, setInitialMultiFiles] = useState<File[]>([]);
    const [isCardDragOver, setIsCardDragOver] = useState(false);

    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    const handleUploadForSlot = async (slotNo: number, slotTitle: string, file: File) => {
        setIsUploading(true);
        setUploadingSlot(slotNo);
        setUploadProgress(`Optimizing photo for "${slotTitle}"...`);

        try {
            const { file: optimizedFile, originalSize, compressedSize, savingsPercent } = await compressImage(file, {
                maxEdge: 2000,
                quality: 0.8,
                onStatus: (status) => setUploadProgress(status),
            });

            setUploadProgress(`Uploading ${formatFileSize(compressedSize)} (${savingsPercent}% saved)...`);

            const formData = new FormData();
            formData.append('file', optimizedFile);
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
            if (data.photo) {
                const existingIndex = photoList.findIndex((p) => p.item_no === slotNo || (p.title && p.title === slotTitle));
                let updatedList: PhotoRecord[];
                if (existingIndex >= 0) {
                    updatedList = [...photoList];
                    updatedList[existingIndex] = data.photo;
                } else {
                    updatedList = [...photoList, data.photo];
                }
                setPhotoList(updatedList);
                onPhotosChange?.(updatedList);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            alert(err?.message || 'Failed to upload photo. Please try again.');
        } finally {
            setIsUploading(false);
            setUploadingSlot(null);
            setUploadProgress(null);
            if (fileInputRefs.current[slotNo]) {
                fileInputRefs.current[slotNo]!.value = '';
            }
        }
    };


    const handleOpenEdit = (photo: PhotoRecord) => {
        setEditingPhoto({ ...photo });
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingPhoto) return;
        setIsSavingEdit(true);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/reports/${reportId}/photos/${editingPhoto.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    item_no: editingPhoto.item_no,
                    title: editingPhoto.title,
                    caption: editingPhoto.caption,
                    description: editingPhoto.description,
                    photo_category_id: editingPhoto.photo_category_id ?? null,
                    report_question_id: editingPhoto.report_question_id ?? null,
                    finding_id: editingPhoto.finding_id ?? null,
                }),
            });

            if (!response.ok) {
                throw new Error(`Update failed with status ${response.status}`);
            }

            const data = await response.json();
            const updatedList = photoList.map((p) => (p.id === editingPhoto.id ? data.photo : p));
            setPhotoList(updatedList);
            onPhotosChange?.(updatedList);
            setEditModalOpen(false);
        } catch (err) {
            console.error('Update photo error:', err);
            alert('Failed to update photo.');
        } finally {
            setIsSavingEdit(false);
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
            const matched = photoList.find((p) => p.item_no === slotNo || (p.title && p.title.toLowerCase() === slot.title.toLowerCase()));
            if (matched) {
                matchedPhotoIds.add(matched.id);
            }
        });
    }
    const additionalPhotos = hasConfiguredSlots ? photoList.filter((p) => !matchedPhotoIds.has(p.id)) : [];

    return (
        <Card
            id="photo-chapter"
            className={`gap-0 overflow-hidden py-0 border shadow-sm transition-all ${
                isCardDragOver ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
            }`}
            onDragOver={(e) => {
                if (isEditable) {
                    e.preventDefault();
                    setIsCardDragOver(true);
                }
            }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsCardDragOver(false);
                }
            }}
            onDrop={(e) => {
                e.preventDefault();
                setIsCardDragOver(false);
                if (!isEditable) return;
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    setInitialMultiFiles(Array.from(e.dataTransfer.files));
                    setIsMultiUploadOpen(true);
                }
            }}
        >
            <CardHeader className="bg-muted/30 border-b p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Camera className="size-5 text-primary shrink-0" />
                            <CardTitle className="text-lg font-bold">{title}</CardTitle>
                            <Badge variant="secondary" className="font-mono text-xs">
                                {photoList.length}{hasConfiguredSlots ? ` / ${schemaItems.length}` : ''} Photo{photoList.length !== 1 ? 's' : ''}
                            </Badge>
                        </div>
                        {description && (
                            <p className="text-xs text-muted-foreground mt-1">{description}</p>
                        )}
                    </div>

                    {isEditable && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                    setInitialMultiFiles([]);
                                    setIsMultiUploadOpen(true);
                                }}
                                className="gap-1.5 text-xs shadow-xs"
                            >
                                <UploadCloud className="size-4" />
                                <span>Upload Photos</span>
                            </Button>
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

                {/* Case 1: Template has defined Photo Fields (Slots) */}
                {hasConfiguredSlots ? (
                    <div className="space-y-4">
                        {schemaItems.map((slot, idx) => {
                            const slotNo = idx + 1;
                            const matchedPhoto = photoList.find((p) => p.item_no === slotNo || (p.title && p.title.toLowerCase() === slot.title.toLowerCase()));

                            return (
                                <div
                                    key={slot.id || idx}
                                    className="rounded-xl border bg-card overflow-hidden shadow-2xs flex flex-col"
                                >
                                    {/* Row 1: Information, status, and action buttons */}
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
                                                    {matchedPhoto ? (
                                                        <>
                                                            <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] font-medium">
                                                                Uploaded
                                                            </Badge>
                                                            {matchedPhoto.category && (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {matchedPhoto.category.name}
                                                                </Badge>
                                                            )}
                                                            {matchedPhoto.report_question_id && (
                                                                <Badge variant="outline" className="text-primary border-primary/30 text-[10px] gap-1">
                                                                    <Link2 className="size-2.5" /> Q Linked
                                                                </Badge>
                                                            )}
                                                            {matchedPhoto.finding_id && (
                                                                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                                                    <Link2 className="size-2.5" /> Obs Linked
                                                                </Badge>
                                                            )}
                                                        </>
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
                                                {matchedPhoto?.caption && matchedPhoto.caption !== matchedPhoto.title && (
                                                    <p className="text-xs text-muted-foreground italic mt-0.5">
                                                        Caption: {matchedPhoto.caption}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions on Row 1 */}
                                        {isEditable && (
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                <input
                                                    ref={(el) => { fileInputRefs.current[slotNo] = el; }}
                                                    type="file"
                                                    multiple
                                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files.length > 1) {
                                                            setInitialMultiFiles(Array.from(e.target.files));
                                                            setIsMultiUploadOpen(true);
                                                        } else if (e.target.files && e.target.files[0]) {
                                                            handleUploadForSlot(slotNo, slot.title, e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                                {matchedPhoto ? (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 text-xs"
                                                            disabled={isUploading}
                                                            onClick={() => fileInputRefs.current[slotNo]?.click()}
                                                        >
                                                            Replace Photo
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-xs px-2"
                                                            onClick={() => handleOpenEdit(matchedPhoto)}
                                                            title="Edit Caption"
                                                        >
                                                            <Edit2 className="size-3.5 mr-1" />
                                                            <span>Caption</span>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeletePhoto(matchedPhoto.id)}
                                                            title="Delete Photo"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={uploadingSlot === slotNo}
                                                        onClick={() => fileInputRefs.current[slotNo]?.click()}
                                                        className="h-8 gap-1.5 text-xs font-medium"
                                                    >
                                                        <UploadCloud className="size-3.5 text-primary" />
                                                        <span>{uploadingSlot === slotNo ? 'Uploading...' : 'Upload Photo'}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 2: Dedicated Image Preview Only */}
                                    <div className="p-3.5 sm:p-4 bg-card flex items-center justify-center sm:justify-start">
                                        {matchedPhoto ? (
                                            <div
                                                onClick={() => setPreviewPhoto(matchedPhoto)}
                                                className="relative rounded-lg overflow-hidden border bg-muted/30 group cursor-pointer shadow-xs hover:border-primary/50 transition-all max-w-sm"
                                                title="Click to view full size photo"
                                            >
                                                <img
                                                    src={matchedPhoto.thumbnail_url || matchedPhoto.file_url}
                                                    alt={matchedPhoto.title || slot.title}
                                                    className="h-44 w-auto max-w-full object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                                                    <Maximize2 className="size-4" />
                                                    <span>Click to Enlarge</span>
                                                </div>
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
                                                        {uploadingSlot === slotNo ? 'Uploading...' : 'Click to Upload Photo for this slot'}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        JPG, PNG, WEBP, or HEIC
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

                        {/* Additional Photos that don't match the predefined schemaItems */}
                        {additionalPhotos.length > 0 && (
                            <div className="pt-6 border-t space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                        <span>Additional Photos & Evidence</span>
                                        <Badge variant="secondary" className="text-xs font-mono">
                                            {additionalPhotos.length}
                                        </Badge>
                                    </h4>
                                </div>
                                <div className="space-y-4">
                                    {additionalPhotos.map((photo, extraIdx) => (
                                        <div
                                            key={photo.id}
                                            className="rounded-xl border bg-card overflow-hidden shadow-2xs flex flex-col"
                                        >
                                            {/* Row 1: Info and Actions */}
                                            <div className="p-3.5 sm:p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                    <Badge variant="outline" className="text-xs font-mono shrink-0 mt-0.5">
                                                        #{schemaItems.length + extraIdx + 1}
                                                    </Badge>
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-semibold text-sm text-foreground">
                                                                {photo.title || `Photo #${schemaItems.length + extraIdx + 1}`}
                                                            </h4>
                                                            {photo.category && (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    {photo.category.name}
                                                                </Badge>
                                                            )}
                                                            {photo.report_question_id && (
                                                                <Badge variant="outline" className="text-primary border-primary/30 text-[10px] gap-1">
                                                                    <Link2 className="size-2.5" /> Q Linked
                                                                </Badge>
                                                            )}
                                                            {photo.finding_id && (
                                                                <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                                                    <Link2 className="size-2.5" /> Obs Linked
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {photo.caption && photo.caption !== photo.title && (
                                                            <p className="text-xs text-muted-foreground italic">
                                                                Caption: {photo.caption}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {isEditable && (
                                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-xs px-2"
                                                            onClick={() => handleOpenEdit(photo)}
                                                            title="Edit Caption"
                                                        >
                                                            <Edit2 className="size-3.5 mr-1" />
                                                            <span>Caption</span>
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeletePhoto(photo.id)}
                                                            title="Delete Photo"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Row 2: Image Preview Only */}
                                            <div className="p-3.5 sm:p-4 bg-card flex items-center justify-center sm:justify-start">
                                                <div
                                                    onClick={() => setPreviewPhoto(photo)}
                                                    className="relative rounded-lg overflow-hidden border bg-muted/30 group cursor-pointer shadow-xs hover:border-primary/50 transition-all max-w-sm"
                                                    title="Click to view full size photo"
                                                >
                                                    <img
                                                        src={photo.thumbnail_url || photo.file_url}
                                                        alt={photo.title || `Photo #${schemaItems.length + extraIdx + 1}`}
                                                        className="h-44 w-auto max-w-full object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                                                        <Maximize2 className="size-4" />
                                                        <span>Click to Enlarge</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Batch upload button below slots */}
                        {isEditable && (
                            <div className="pt-2 flex items-center justify-center sm:justify-start">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setInitialMultiFiles([]);
                                        setIsMultiUploadOpen(true);
                                    }}
                                    className="gap-1.5 text-xs shadow-xs"
                                >
                                    <UploadCloud className="size-4 text-primary" />
                                    <span>Upload Additional Photos (Multi-select)</span>
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Case 2: Freeform Photos (No predefined slots) */
                    <div>
                        {photoList.length === 0 ? (
                            <div
                                onClick={() => {
                                    if (isEditable) {
                                        setInitialMultiFiles([]);
                                        setIsMultiUploadOpen(true);
                                    }
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
                                    Click or drag & drop multiple photos to start uploading photographic records for this report.
                                </p>
                                {isEditable && (
                                    <div className="mt-4">
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="gap-1.5 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setInitialMultiFiles([]);
                                                setIsMultiUploadOpen(true);
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
                                {photoList.map((photo, idx) => (
                                    <div
                                        key={photo.id}
                                        className="rounded-xl border bg-card overflow-hidden shadow-2xs flex flex-col"
                                    >
                                        {/* Row 1: Info and Actions */}
                                        <div className="p-3.5 sm:p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                <Badge variant="outline" className="text-xs font-mono shrink-0 mt-0.5">
                                                    #{idx + 1}
                                                </Badge>
                                                <div className="space-y-0.5 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-semibold text-sm text-foreground">
                                                            {photo.title || `Photo #${idx + 1}`}
                                                        </h4>
                                                        {photo.category && (
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                {photo.category.name}
                                                            </Badge>
                                                        )}
                                                        {photo.report_question_id && (
                                                            <Badge variant="outline" className="text-primary border-primary/30 text-[10px] gap-1">
                                                                <Link2 className="size-2.5" /> Q Linked
                                                            </Badge>
                                                        )}
                                                        {photo.finding_id && (
                                                            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                                                <Link2 className="size-2.5" /> Obs Linked
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {photo.caption && photo.caption !== photo.title && (
                                                        <p className="text-xs text-muted-foreground italic">
                                                            Caption: {photo.caption}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {isEditable && (
                                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs px-2"
                                                        onClick={() => handleOpenEdit(photo)}
                                                        title="Edit Caption"
                                                    >
                                                        <Edit2 className="size-3.5 mr-1" />
                                                        <span>Caption</span>
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        title="Delete Photo"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Row 2: Image Preview Only */}
                                        <div className="p-3.5 sm:p-4 bg-card flex items-center justify-center sm:justify-start">
                                            <div
                                                onClick={() => setPreviewPhoto(photo)}
                                                className="relative rounded-lg overflow-hidden border bg-muted/30 group cursor-pointer shadow-xs hover:border-primary/50 transition-all max-w-sm"
                                                title="Click to view full size photo"
                                            >
                                                <img
                                                    src={photo.thumbnail_url || photo.file_url}
                                                    alt={photo.title || `Photo #${idx + 1}`}
                                                    className="h-44 w-auto max-w-full object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                                                    <Maximize2 className="size-4" />
                                                    <span>Click to Enlarge</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isEditable && (
                                    <div className="pt-2 flex items-center justify-center sm:justify-start">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setInitialMultiFiles([]);
                                                setIsMultiUploadOpen(true);
                                            }}
                                            className="gap-1.5 text-xs shadow-xs"
                                        >
                                            <UploadCloud className="size-4 text-primary" />
                                            <span>Upload More Photos</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Multi-Photo Batch Upload Modal */}
            <MultiPhotoUploadDialog
                open={isMultiUploadOpen}
                onOpenChange={setIsMultiUploadOpen}
                reportId={reportId}
                categories={categories}
                nextItemNo={photoList.length + 1}
                initialFiles={initialMultiFiles}
                onUploadSuccess={(newPhotos) => {
                    const updated = [...photoList, ...newPhotos];
                    setPhotoList(updated);
                    onPhotosChange?.(updated);
                }}
            />

            {/* Simple Edit Caption Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Photo & Evidence Links</DialogTitle>
                    </DialogHeader>

                    {editingPhoto && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit_title">Photo Title / Caption</Label>
                                <Input
                                    id="edit_title"
                                    value={editingPhoto.title || ''}
                                    onChange={(e) =>
                                        setEditingPhoto((prev) => prev ? { ...prev, title: e.target.value, caption: e.target.value } : null)
                                    }
                                    required
                                />
                            </div>

                            {/* Category Selector */}
                            {categories.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Photo Category</Label>
                                    <Select
                                        value={editingPhoto.photo_category_id ? String(editingPhoto.photo_category_id) : 'none'}
                                        onValueChange={(val) =>
                                            setEditingPhoto((prev) =>
                                                prev ? { ...prev, photo_category_id: val === 'none' ? null : Number(val) } : null
                                            )
                                        }
                                    >
                                        <SelectTrigger className="text-xs h-9">
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Category</SelectItem>
                                            {categories.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Link to Checklist Question */}
                            {questions.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Link as Evidence to Checklist Question</Label>
                                    <Select
                                        value={editingPhoto.report_question_id ? String(editingPhoto.report_question_id) : 'none'}
                                        onValueChange={(val) =>
                                            setEditingPhoto((prev) =>
                                                prev ? { ...prev, report_question_id: val === 'none' ? null : Number(val) } : null
                                            )
                                        }
                                    >
                                        <SelectTrigger className="text-xs h-9">
                                            <SelectValue placeholder="Select Question to link" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not linked to a question</SelectItem>
                                            {questions.map((q) => (
                                                <SelectItem key={q.id} value={String(q.id)}>
                                                    {q.item_number ? `#${q.item_number} - ` : ''}{q.question_text.slice(0, 75)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Link to Observation / Finding */}
                            {findings.length > 0 && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Link as Proof to Observation / Finding</Label>
                                    <Select
                                        value={editingPhoto.finding_id ? String(editingPhoto.finding_id) : 'none'}
                                        onValueChange={(val) =>
                                            setEditingPhoto((prev) =>
                                                prev ? { ...prev, finding_id: val === 'none' ? null : Number(val) } : null
                                            )
                                        }
                                    >
                                        <SelectTrigger className="text-xs h-9">
                                            <SelectValue placeholder="Select Observation to link" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Not linked to an observation</SelectItem>
                                            {findings.map((f) => (
                                                <SelectItem key={f.id} value={String(f.id)}>
                                                    Obs #{f.finding_no}: {f.description.slice(0, 65)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditModalOpen(false)}
                                    disabled={isSavingEdit}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit}
                                >
                                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

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
                        src={previewPhoto.file_url || previewPhoto.thumbnail_url}
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
