import { ArrowDown, ArrowUp, Camera, Plus, Save, Trash2 } from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PhotoSchema } from './types';

export interface StandalonePhotoEditorProps {
    form: {
        code: string;
        name: string;
        template_version: number;
    };
    photoFormState: PhotoSchema;
    setPhotoFormState: React.Dispatch<React.SetStateAction<PhotoSchema>>;
    isSavingPhoto: boolean;
    onSavePhotoSchema: () => void;
}

export function StandalonePhotoEditor({
    form,
    photoFormState,
    setPhotoFormState,
    isSavingPhoto,
    onSavePhotoSchema,
}: StandalonePhotoEditorProps) {
    const handleAddPhotoItem = () => {
        setPhotoFormState((prev) => {
            const current = prev.items || [];
            return {
                ...prev,
                items: [
                    ...current,
                    {
                        id: String(Date.now()),
                        title: `Photo Item #${current.length + 1}`,
                    },
                ],
            };
        });
    };

    const handleUpdatePhotoItem = (
        idx: number,
        field: 'title' | 'description',
        value: string
    ) => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            if (list[idx]) {
                list[idx] = { ...list[idx], [field]: value };
            }
            return { ...prev, items: list };
        });
    };

    const handleRemovePhotoItem = (idx: number) => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            list.splice(idx, 1);
            return { ...prev, items: list };
        });
    };

    const handleMovePhotoItem = (idx: number, direction: 'up' | 'down') => {
        setPhotoFormState((prev) => {
            const list = [...(prev.items || [])];
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= list.length) return prev;
            const temp = list[idx];
            list[idx] = list[targetIdx];
            list[targetIdx] = temp;
            return { ...prev, items: list };
        });
    };

    return (
        <div className="flex h-full flex-1 flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center pb-4 border-b">
                <div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-sm font-bold">
                            {form.code}
                        </Badge>
                        <Badge variant="secondary">Photo Form</Badge>
                        <span className="text-xs text-muted-foreground">
                            v{form.template_version}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight mt-1">
                        {form.name}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Add and manage photo fields for this form.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={onSavePhotoSchema}
                        disabled={isSavingPhoto}
                        className="flex items-center gap-1.5"
                    >
                        <Save className="size-4" />
                        <span>{isSavingPhoto ? 'Saving...' : 'Save Changes'}</span>
                    </Button>
                </div>
            </div>

            {/* Form Details */}
            <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <CardHeader className="p-4 bg-muted/20 border-b">
                    <h3 className="font-semibold text-base">Form Details</h3>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="photo_form_title">Form Name / Title</Label>
                        <Input
                            id="photo_form_title"
                            value={photoFormState.title || form.name}
                            onChange={(e) =>
                                setPhotoFormState((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                }))
                            }
                            placeholder="e.g. Photographic Record Form"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="photo_form_desc">
                            Instructions / Notes (Optional)
                        </Label>
                        <textarea
                            id="photo_form_desc"
                            value={photoFormState.description || ''}
                            onChange={(e) =>
                                setPhotoFormState((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="Instructions for uploading photos..."
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Photos List */}
            <Card className="gap-0 overflow-hidden py-0 shadow-xs">
                <CardHeader className="p-4 bg-muted/20 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="size-5 text-primary" />
                        <h3 className="font-semibold text-base">Photo Fields</h3>
                        <Badge variant="outline">
                            {(photoFormState.items || []).length} Photos
                        </Badge>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleAddPhotoItem}
                        className="flex items-center gap-1.5"
                    >
                        <Plus className="size-4" />
                        <span>Add Photo</span>
                    </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    {!photoFormState.items || photoFormState.items.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-lg">
                            <Camera className="size-10 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm font-medium">No photo fields yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Add photo items to define what photos should be taken.
                            </p>
                            <Button
                                size="sm"
                                onClick={handleAddPhotoItem}
                                className="mt-4"
                            >
                                <Plus className="size-4 mr-1.5" /> Add Photo
                            </Button>
                        </div>
                    ) : (
                        photoFormState.items.map((item, idx) => (
                            <div
                                key={item.id || idx}
                                className="flex items-start gap-3 p-3.5 rounded-lg border bg-card shadow-2xs transition-all hover:border-border"
                            >
                                <div className="flex items-center justify-center size-8 rounded-md bg-muted text-xs font-bold shrink-0 mt-1">
                                    #{idx + 1}
                                </div>

                                <div className="flex-1 min-w-0 space-y-2">
                                    <div>
                                        <Label className="text-xs font-semibold text-muted-foreground">
                                            Title
                                        </Label>
                                        <Input
                                            value={item.title}
                                            onChange={(e) =>
                                                handleUpdatePhotoItem(
                                                    idx,
                                                    'title',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Photo title (e.g. General View / Overview)"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">
                                            Guide / Instructions (Optional)
                                        </Label>
                                        <Input
                                            value={item.description || ''}
                                            onChange={(e) =>
                                                handleUpdatePhotoItem(
                                                    idx,
                                                    'description',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Optional guidance for taking this photo"
                                            className="text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 shrink-0 pt-5">
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            disabled={idx === 0}
                                            onClick={() =>
                                                handleMovePhotoItem(idx, 'up')
                                            }
                                            title="Move Up"
                                        >
                                            <ArrowUp className="size-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            disabled={
                                                idx ===
                                                (photoFormState.items?.length || 1) - 1
                                            }
                                            onClick={() =>
                                                handleMovePhotoItem(idx, 'down')
                                            }
                                            title="Move Down"
                                        >
                                            <ArrowDown className="size-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                            onClick={() =>
                                                handleRemovePhotoItem(idx)
                                            }
                                            title="Delete"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {(photoFormState.items || []).length > 0 && (
                        <div className="pt-3 flex items-center justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddPhotoItem}
                                className="flex items-center gap-1.5"
                            >
                                <Plus className="size-4" />
                                <span>Add Photo</span>
                            </Button>

                            <Button
                                type="button"
                                onClick={onSavePhotoSchema}
                                disabled={isSavingPhoto}
                            >
                                {isSavingPhoto ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
