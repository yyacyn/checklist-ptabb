import { router } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormGroupData } from './types';

export interface GroupModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingGroup: FormGroupData | null;
    parentId: number | null;
    formId: number;
    suggestedChapterNo?: string;
}

export function GroupModalDialog({
    open,
    onOpenChange,
    editingGroup,
    parentId,
    formId,
    suggestedChapterNo,
}: GroupModalDialogProps) {
    const [title, setTitle] = useState('');
    const [chapterNo, setChapterNo] = useState('');
    const [iceClass, setIceClass] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (editingGroup) {
                setTitle(editingGroup.title);
                setChapterNo(editingGroup.chapter_no || '');
                setIceClass(editingGroup.ice_class_only);
            } else {
                setTitle('');
                setChapterNo(parentId ? '' : suggestedChapterNo || '');
                setIceClass(false);
            }
        }
    }, [open, editingGroup, parentId, suggestedChapterNo]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        if (editingGroup) {
            router.put(
                `/admin/groups/${editingGroup.id}`,
                {
                    title,
                    chapter_no: chapterNo || null,
                    ice_class_only: iceClass,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setSubmitting(false);
                        onOpenChange(false);
                    },
                    onError: () => setSubmitting(false),
                }
            );
        } else {
            router.post(
                `/admin/forms/${formId}/groups`,
                {
                    title,
                    chapter_no: chapterNo || null,
                    parent_id: parentId,
                    ice_class_only: iceClass,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setSubmitting(false);
                        onOpenChange(false);
                    },
                    onError: () => setSubmitting(false),
                }
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {editingGroup
                            ? 'Edit Chapter / Subgroup'
                            : parentId
                            ? 'Add Subgroup'
                            : 'Add Chapter'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!parentId && (
                        <div className="space-y-1">
                            <Label htmlFor="dlg_chapter_no">Chapter Number (Optional)</Label>
                            <Input
                                id="dlg_chapter_no"
                                value={chapterNo}
                                onChange={(e) => setChapterNo(e.target.value)}
                                placeholder="e.g. 1, 2, 16 (Optional)"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Leave blank to automatically number chapters in sequence.
                            </p>
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="dlg_group_title">
                            {parentId ? 'Subgroup Title' : 'Chapter Title'}
                        </Label>
                        <Input
                            id="dlg_group_title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={parentId ? 'e.g. Navigational Equipment' : 'e.g. Navigation & Bridge'}
                            required
                            autoFocus
                        />
                    </div>
                    {!parentId && (
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="dlg_ice_class"
                                checked={iceClass}
                                onChange={(e) => setIceClass(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            />
                            <Label htmlFor="dlg_ice_class" className="cursor-pointer text-xs">
                                Ice Class Only (Only applies to vessels with ice class notation)
                            </Label>
                        </div>
                    )}
                    <DialogFooter className="pt-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
