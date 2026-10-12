import {
    ArrowDown,
    ArrowUp,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Eye,
    EyeOff,
    Plus,
    Trash2,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { PhotoFormOption, PhotoSchema } from './types';

export interface PhotoSchemaEditorProps {
    isPhotoForm: boolean;
    formName: string;
    photoFormState: PhotoSchema;
    setPhotoFormState: React.Dispatch<React.SetStateAction<PhotoSchema>>;
    availablePhotoForms?: PhotoFormOption[];
    isSavingPhoto: boolean;
    onSavePhotoSchema: () => void;
    onRemovePhotoChapter?: () => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    prevTab: { id: number | 'summary' | 'photo'; title: string } | null;
    nextTab: { id: number | 'summary' | 'photo'; title: string } | null;
    onSelectTab: (tabId: number | 'summary' | 'photo') => void;
}

export function PhotoSchemaEditor({
    isPhotoForm,
    formName,
    photoFormState,
    setPhotoFormState,
    availablePhotoForms = [],
    isSavingPhoto,
    onSavePhotoSchema,
    onRemovePhotoChapter,
    collapsed,
    onToggleCollapse,
    prevTab,
    nextTab,
    onSelectTab,
}: PhotoSchemaEditorProps) {
    const handleAddPhotoItem = () => {
        setPhotoFormState((prev) => {
            const current = prev.items || [];
            return {
                ...prev,
                items: [
                    ...current,
                    {
                        id: String(Date.now()),
                        title: `Photo ${current.length + 1}`,
                        description: '',
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
            const current = [...(prev.items || [])];
            if (!current[idx]) return prev;
            current[idx] = { ...current[idx], [field]: value };
            return { ...prev, items: current };
        });
    };

    const handleRemovePhotoItem = (idx: number) => {
        setPhotoFormState((prev) => {
            const current = [...(prev.items || [])];
            current.splice(idx, 1);
            return { ...prev, items: current };
        });
    };

    const handleMovePhotoItem = (idx: number, direction: 'up' | 'down') => {
        setPhotoFormState((prev) => {
            const current = [...(prev.items || [])];
            const target = direction === 'up' ? idx - 1 : idx + 1;
            if (target < 0 || target >= current.length) return prev;
            const temp = current[idx];
            current[idx] = current[target];
            current[target] = temp;
            return { ...prev, items: current };
        });
    };

    const attachedPhotoForm = availablePhotoForms.find(
        (pf) => pf.id === photoFormState.attached_form_id
    );
    const attachedItems = attachedPhotoForm?.photo_schema?.items || [];

    return (
        <Card
            id="photo-chapter"
            className={`gap-0 overflow-hidden py-0 shadow-xs ${
                !photoFormState.enabled && !isPhotoForm
                    ? 'opacity-70 bg-muted/20'
                    : 'border-primary/40'
            }`}
        >
            <CardHeader className="border-b bg-muted/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                            title={collapsed ? 'Expand Chapter' : 'Collapse Chapter'}
                        >
                            {collapsed ? (
                                <ChevronRight className="size-4" />
                            ) : (
                                <ChevronDown className="size-4" />
                            )}
                        </button>
                        <h3
                            className="font-semibold text-lg cursor-pointer select-none"
                            onClick={onToggleCollapse}
                        >
                            {photoFormState.title ||
                                (isPhotoForm ? formName : 'Photographic Records')}
                        </h3>
                        {!photoFormState.enabled && !isPhotoForm && (
                            <Badge variant="destructive">Disabled</Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            size="sm"
                            variant="ghost"
                            title={photoFormState.enabled ? 'Disable' : 'Enable'}
                            onClick={() =>
                                setPhotoFormState((prev) => ({ ...prev, enabled: !prev.enabled }))
                            }
                        >
                            {photoFormState.enabled ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4 text-muted-foreground" />
                            )}
                        </Button>

                        <Button
                            size="sm"
                            onClick={onSavePhotoSchema}
                            disabled={isSavingPhoto}
                            className="text-xs h-8"
                        >
                            {isSavingPhoto ? 'Saving...' : 'Save Photo Settings'}
                        </Button>

                        {!isPhotoForm && onRemovePhotoChapter && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10 text-xs h-8"
                                onClick={onRemovePhotoChapter}
                                disabled={isSavingPhoto}
                                title="Remove Photo Chapter"
                            >
                                <Trash2 className="size-4 mr-1" />
                                <span>Remove Chapter</span>
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="p-5 space-y-6">
                    <div className="flex flex-col gap-1 rounded-lg border p-3 bg-card">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="photo_enabled"
                                checked={photoFormState.enabled}
                                onCheckedChange={(checked) =>
                                    setPhotoFormState((prev) => ({
                                        ...prev,
                                        enabled: Boolean(checked),
                                    }))
                                }
                            />
                            <Label htmlFor="photo_enabled" className="text-sm font-semibold cursor-pointer">
                                Include Photo Form / Records in this Report
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                            When enabled, this report will include photo inputs and print photo records in the
                            report.
                        </p>
                    </div>

                    {photoFormState.enabled && (
                        <>
                            <div className="space-y-4 pt-2 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="photo_title">Section Title</Label>
                                        <Input
                                            id="photo_title"
                                            value={photoFormState.title || ''}
                                            onChange={(e) =>
                                                setPhotoFormState((prev) => ({
                                                    ...prev,
                                                    title: e.target.value,
                                                }))
                                            }
                                            placeholder="e.g. Chapter 16 - Photographic Records"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="photo_attach_form">
                                            Attach Photo Form Template
                                        </Label>
                                        <Select
                                            value={
                                                photoFormState.attached_form_id
                                                    ? String(photoFormState.attached_form_id)
                                                    : 'custom'
                                            }
                                            onValueChange={(val) =>
                                                setPhotoFormState((prev) => ({
                                                    ...prev,
                                                    attached_form_id: val === 'custom' ? null : Number(val),
                                                }))
                                            }
                                        >
                                            <SelectTrigger id="photo_attach_form">
                                                <SelectValue placeholder="Select a photo form..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="custom">
                                                    Custom Photo List (Custom to this form)
                                                </SelectItem>
                                                {availablePhotoForms.map((pf) => (
                                                    <SelectItem key={pf.id} value={String(pf.id)}>
                                                        {pf.code} - {pf.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="photo_description">
                                        Instructions / Notes (Optional)
                                    </Label>
                                    <textarea
                                        id="photo_description"
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
                            </div>

                            {photoFormState.attached_form_id ? (
                                <div className="space-y-4 pt-3 border-t">
                                    {/* Attached Template Summary Card */}
                                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-bold text-xs bg-background"
                                                    >
                                                        {attachedPhotoForm?.code || 'PHOTO'}
                                                    </Badge>
                                                    <span className="font-semibold text-sm text-foreground">
                                                        {attachedPhotoForm?.name || 'Photo Form Template'}
                                                    </span>
                                                    {attachedPhotoForm?.form_version && (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            v{attachedPhotoForm.form_version}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {attachedItems.length} photo slot
                                                    {attachedItems.length !== 1 ? 's' : ''} configured in this
                                                    template.
                                                </p>
                                            </div>

                                            {attachedPhotoForm && (
                                                <a
                                                    href={`/admin/forms/${attachedPhotoForm.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium shrink-0 bg-background/80 hover:bg-background border rounded-md px-2.5 py-1.5 shadow-2xs transition-colors"
                                                >
                                                    <span>Edit Master Template</span>
                                                    <ExternalLink className="size-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Live Visual Preview of Photo Form Template */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Camera className="size-4 text-primary" />
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Preview: Photo Slots in Reports
                                                </h4>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                {attachedItems.length} Photo Field
                                                {attachedItems.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>

                                        {attachedItems.length === 0 ? (
                                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-card/50">
                                                <Camera className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                                                <p className="text-sm font-medium text-muted-foreground">
                                                    No photo slots configured yet in this template
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Click "Edit Master Template" above to add photo slots to{' '}
                                                    {attachedPhotoForm?.code || 'this template'}.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {attachedItems.map((item, idx) => (
                                                    <div
                                                        key={item.id || idx}
                                                        className="rounded-lg border bg-card p-3 flex flex-col justify-between gap-3 shadow-2xs transition-all hover:border-primary/40"
                                                    >
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] font-mono shrink-0"
                                                                >
                                                                    #{idx + 1}
                                                                </Badge>
                                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                                    Photo Slot
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-semibold text-foreground line-clamp-2">
                                                                {item.title}
                                                            </p>
                                                            {item.description && (
                                                                <p className="text-[11px] text-muted-foreground line-clamp-2">
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="rounded border border-dashed bg-muted/30 p-3 flex flex-col items-center justify-center text-center gap-1 min-h-[75px]">
                                                            <Camera className="size-4 text-muted-foreground/60" />
                                                            <span className="text-[10px] text-muted-foreground">
                                                                Inspector Photo Upload
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 pt-3 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">Photo Fields</Label>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs cursor-pointer"
                                            onClick={handleAddPhotoItem}
                                        >
                                            <Plus className="size-3.5 mr-1" /> Add Photo
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {!photoFormState.items || photoFormState.items.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic py-2 text-center">
                                                No photo fields added yet. Click "Add Photo" to add one.
                                            </p>
                                        ) : (
                                            photoFormState.items.map((item, idx) => (
                                                <div
                                                    key={item.id || idx}
                                                    className="flex items-center gap-2 p-2.5 rounded-md border bg-card"
                                                >
                                                    <span className="text-xs font-mono text-muted-foreground shrink-0 w-6">
                                                        #{idx + 1}
                                                    </span>
                                                    <Input
                                                        value={item.title}
                                                        onChange={(e) =>
                                                            handleUpdatePhotoItem(idx, 'title', e.target.value)
                                                        }
                                                        placeholder="Photo Title / Label"
                                                        className="flex-1 text-xs h-8"
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        disabled={idx === 0}
                                                        onClick={() => handleMovePhotoItem(idx, 'up')}
                                                        title="Move Up"
                                                    >
                                                        <ArrowUp className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0"
                                                        disabled={
                                                            idx ===
                                                            (photoFormState.items?.length || 1) - 1
                                                        }
                                                        onClick={() => handleMovePhotoItem(idx, 'down')}
                                                        title="Move Down"
                                                    >
                                                        <ArrowDown className="size-3.5" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRemovePhotoItem(idx)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="pt-2 flex justify-end">
                        <Button
                            type="button"
                            onClick={onSavePhotoSchema}
                            disabled={isSavingPhoto}
                        >
                            {isSavingPhoto ? 'Saving Photo Settings...' : 'Save Photo Settings'}
                        </Button>
                    </div>
                </CardContent>
            )}

            <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
                {prevTab ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectTab(prevTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <ChevronLeft className="size-4" />
                        <span className="truncate max-w-[200px]">{prevTab.title}</span>
                    </Button>
                ) : (
                    <div />
                )}
                {nextTab ? (
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => onSelectTab(nextTab.id)}
                        className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    >
                        <span className="truncate max-w-[200px]">{nextTab.title}</span>
                        <ChevronRight className="size-4" />
                    </Button>
                ) : (
                    <div />
                )}
            </CardFooter>
        </Card>
    );
}
