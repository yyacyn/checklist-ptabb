import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { FormHistoryItem } from './types';

export interface HistoryModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    loading: boolean;
    items: FormHistoryItem[];
}

export function HistoryModalDialog({
    open,
    onOpenChange,
    title,
    loading,
    items,
}: HistoryModalDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Change History</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground line-clamp-1 mb-2 font-medium">
                    {title}
                </p>

                <div className="overflow-y-auto flex-1 space-y-3 pr-2">
                    {loading && (
                        <p className="text-sm text-muted-foreground">Loading history log...</p>
                    )}
                    {!loading && items.length === 0 && (
                        <p className="text-sm text-muted-foreground italic py-4 text-center">
                            No change history recorded yet.
                        </p>
                    )}
                    {!loading &&
                        items.map((item) => (
                            <div
                                key={item.id}
                                className="rounded border bg-muted/20 p-2.5 text-xs space-y-1"
                            >
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="font-semibold text-foreground uppercase tracking-wider">
                                        {item.action}
                                    </span>
                                    <span>{new Date(item.created_at).toLocaleString()}</span>
                                </div>
                                <div className="text-muted-foreground">
                                    By:{' '}
                                    <span className="text-foreground font-medium">
                                        {item.user?.name || 'System'}
                                    </span>{' '}
                                    ({item.user?.role || 'admin'})
                                </div>
                                {item.field && (
                                    <div className="text-muted-foreground">
                                        Field: <span className="font-mono">{item.field}</span>
                                    </div>
                                )}
                                {item.before_value !== null && (
                                    <div className="rounded bg-destructive/10 p-1 font-mono text-[11px] text-destructive">
                                        - {item.before_value}
                                    </div>
                                )}
                                {item.after_value !== null && (
                                    <div className="rounded bg-emerald-500/10 p-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                        + {item.after_value}
                                    </div>
                                )}
                            </div>
                        ))}
                </div>

                <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
