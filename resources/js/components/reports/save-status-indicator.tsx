import React from 'react';
import { AlertCircle, AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'retrying' | 'error' | 'conflict';

export interface SaveStatusIndicatorProps {
    status: SaveStatus;
    errorMessage?: string;
    className?: string;
}

export function SaveStatusIndicator({ status, errorMessage, className = '' }: SaveStatusIndicatorProps) {
    if (status === 'idle') {
        return null;
    }

    return (
        <span className={`inline-flex items-center gap-1 text-[11px] select-none transition-all duration-200 ${className}`}>
            {status === 'saving' && (
                <span className="inline-flex items-center gap-1 text-amber-500 animate-pulse font-medium">
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    <span>Saving...</span>
                </span>
            )}
            {status === 'saved' && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in duration-150">
                    <Check className="size-3 shrink-0" />
                    <span>Saved</span>
                </span>
            )}
            {status === 'retrying' && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <CloudOff className="size-3 shrink-0" />
                    <span>Queued (retrying)</span>
                </span>
            )}
            {status === 'error' && (
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium" title={errorMessage}>
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errorMessage || 'Save failed'}</span>
                </span>
            )}
            {status === 'conflict' && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="size-3 shrink-0 text-amber-600" />
                    <span>Conflict</span>
                </span>
            )}
        </span>
    );
}
