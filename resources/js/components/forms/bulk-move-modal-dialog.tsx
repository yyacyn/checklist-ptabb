import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { FormGroupOption } from './types';

export interface BulkMoveModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedCount: number;
    groupsList: FormGroupOption[];
    targetGroupId: string;
    onTargetGroupIdChange: (id: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export function BulkMoveModalDialog({
    open,
    onOpenChange,
    selectedCount,
    groupsList,
    targetGroupId,
    onTargetGroupIdChange,
    onSubmit,
}: BulkMoveModalDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move {selectedCount} Question(s)</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="target_group">Destination Group / Subgroup</Label>
                        <Select value={targetGroupId} onValueChange={onTargetGroupIdChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select destination group" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {groupsList.map((g) => (
                                    <SelectItem key={g.id} value={String(g.id)}>
                                        {g.parent_id ? `↳ ${g.title}` : g.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!targetGroupId}>
                            Move Questions
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
