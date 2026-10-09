import {
    ArrowDown,
    ArrowUp,
    Camera,
    Check,
    Edit2,
    ExternalLink,
    FileImage,
    Image as ImageIcon,
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
    item_no: number;
    title: string | null;
    caption: string | null;
    description: string | null;
    location: string | null;
    photo_category_id?: number | null;
    category?: {
        id: number;
        name: string;
        code: string;
    } | null;
    file_url?: string;
    thumbnail_url?: string;
    file_size?: number;
    sort_order: number;
    report_question_id?: number | null;
    finding_id?: number | null;
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

    // Freeform Add Photo Modal State (when no schemaItems)
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addFile, setAddFile] = useState<File | null>(null);

    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const generalFileInputRef = useRef<HTMLInputElement>(null);

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

    const handleAddFreeformPhoto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addFile || !addTitle.trim()) return;

        setIsUploading(true);
        setUploadProgress('Optimizing image for VSAT bandwidth...');

        try {
            const { file: optimizedFile, compressedSize, savingsPercent } = await compressImage(addFile, {
                maxEdge: 2000,
                quality: 0.8,
                onStatus: (status) => setUploadProgress(status),
            });

            setUploadProgress(`Uploading ${formatFileSize(compressedSize)} (${savingsPercent}% saved)...`);

            const nextItemNo = photoList.length + 1;
            const formData = new FormData();
            formData.append('file', optimizedFile);
            formData.append('title', addTitle.trim());
            formData.append('caption', addTitle.trim());
            formData.append('item_no', String(nextItemNo));

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
                const updatedList = [...photoList, data.photo];
                setPhotoList(updatedList);
                onPhotosChange?.(updatedList);
                setAddModalOpen(false);
                setAddTitle('');
                setAddFile(null);
            }
        } catch (err: any) {
            console.error('Photo upload error:', err);
            alert(err?.message || 'Failed to upload photo.');
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
            if (generalFileInputRef.current) {
                generalFileInputRef.current.value = '';
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

    return (
        <Card id="photo-chapter" className="gap-0 overflow-hidden py-0 border shadow-sm">
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

                    {isEditable && !hasConfiguredSlots && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => setAddModalOpen(true)}
                            className="gap-1.5 text-xs shadow-xs"
                        >
                            <Plus className="size-4" />
                            <span>Add Photo</span>
                        </Button>
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
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-[10px] font-medium">
                                                            Uploaded
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
                                                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
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
                    </div>
                ) : (
                    /* Case 2: Freeform Photos (No predefined slots) */
                    <div>
                        {photoList.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground space-y-3">
                                <ImageIcon className="size-10 mx-auto opacity-40" />
                                <p className="text-sm font-medium">No photos uploaded yet.</p>
                                {isEditable && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setAddModalOpen(true)}
                                        className="gap-1.5"
                                    >
                                        <Plus className="size-4" />
                                        <span>Add Photo</span>
                                    </Button>
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
                                                    <h4 className="font-semibold text-sm text-foreground">
                                                        {photo.title || `Photo #${idx + 1}`}
                                                    </h4>
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
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Simple Freeform Add Photo Modal */}
            <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                <DialogContent className="max-w-sm sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Photo</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleAddFreeformPhoto} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="add_photo_title">Photo Title / Label</Label>
                            <Input
                                id="add_photo_title"
                                placeholder="e.g. Engine Room Overview"
                                value={addTitle}
                                onChange={(e) => setAddTitle(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add_photo_file">Image File</Label>
                            <Input
                                id="add_photo_file"
                                ref={generalFileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setAddFile(e.target.files[0]);
                                    }
                                }}
                                required
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isUploading}
                                onClick={() => setAddModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isUploading || !addFile || !addTitle.trim()}
                            >
                                {isUploading ? 'Uploading...' : 'Upload Photo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Simple Edit Caption Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-sm sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Photo Caption</DialogTitle>
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
                                    {isSavingEdit ? 'Saving...' : 'Save'}
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
