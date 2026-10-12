import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    Camera,
    Check,
    CloudOff,
    File,
    FileText,
    HelpCircle,
    Info,
    Loader2,
    Paperclip,
    RotateCcw,
    Upload,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoEvidenceDialog, PhotoEvidenceStrip } from '@/components/photo-evidence-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { csrfHeaders } from '@/lib/autosave-queue';
import {
    formatExtraDisplay,
    getQuestionInputMeta,
    parseQuestionInputType,
} from '@/lib/question-utils';
import type {
    AnswerData,
    ConflictData,
    PhotoCategoryItem,
    PhotoRecord,
    QuestionData,
} from '@/types';

export interface QuestionAnswerCardProps {
    reportId: number;
    question: QuestionData;
    currentAnswer?: AnswerData;
    isB008?: boolean;
    answerChoices: { value: string; label: string; color: string }[];
    isExpandedGuidance?: boolean;
    saveStatus?: string;
    isEditable: boolean;
    onToggleGuidance?: () => void;
    onSelectAnswer: (val: string) => void;
    onSaveExtraValue: (val: string) => void;
    conflict?: ConflictData;
    onAcceptServerAnswer?: (serverAnswer: ConflictData['server_answer']) => void;
    onOverwriteAnswer?: (serverRowVersion: number) => void;
    reportPhotos?: PhotoRecord[];
    onPhotosUpdated?: (photos: PhotoRecord[]) => void;
    photoCategories?: PhotoCategoryItem[];
}

export function QuestionAnswerCard({
    reportId,
    question,
    currentAnswer,
    answerChoices,
    isExpandedGuidance = false,
    saveStatus,
    isEditable,
    onToggleGuidance,
    onSelectAnswer,
    onSaveExtraValue,
    conflict,
    onAcceptServerAnswer,
    onOverwriteAnswer,
    reportPhotos,
    onPhotosUpdated,
    photoCategories,
}: QuestionAnswerCardProps) {
    const selectedAnswer = currentAnswer?.answer;
    const isLockedNA = !question.is_applicable;
    const flags = parseQuestionInputType(question.input_type);
    const extraCount = (flags.hasDate ? 1 : 0) + (flags.hasFile ? 1 : 0) + (flags.hasText ? 1 : 0);
    const hasAnyExtra = extraCount > 0;
    const inputMeta = getQuestionInputMeta(question);

    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const attachedPhotos = (reportPhotos || []).filter((p) => p.report_question_id === question.id);

    const handleDetachPhoto = async (photo: PhotoRecord) => {
        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const res = await fetch(`/reports/${reportId}/photos/${photo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ report_question_id: null }),
            });
            if (res.ok) {
                const data = await res.json();
                onPhotosUpdated?.(
                    (reportPhotos || []).map((p) => (p.id === photo.id ? data.photo : p))
                );
            }
        } catch (err) {
            console.error('Failed to detach photo:', err);
        }
    };

    // Internal buffered inputs for extra values with debounced autosave (NFR-1)
    const [extraBuffer, setExtraBuffer] = useState(currentAnswer?.extra_value || '');
    const extraDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedExtra = useRef(currentAnswer?.extra_value || '');
    const extraBufferRef = useRef(extraBuffer);
    extraBufferRef.current = extraBuffer;
    const onSaveExtraValueRef = useRef(onSaveExtraValue);
    onSaveExtraValueRef.current = onSaveExtraValue;

    useEffect(() => {
        setExtraBuffer(currentAnswer?.extra_value || '');
        lastSavedExtra.current = currentAnswer?.extra_value || '';
    }, [currentAnswer?.extra_value]);

    const flushExtra = useCallback(() => {
        if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
        if (extraBuffer !== lastSavedExtra.current) {
            lastSavedExtra.current = extraBuffer;
            onSaveExtraValue(extraBuffer);
        }
    }, [extraBuffer, onSaveExtraValue]);

    const handleExtraChange = (val: string) => {
        setExtraBuffer(val);
        if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
        extraDebounceTimer.current = setTimeout(() => {
            if (val !== lastSavedExtra.current) {
                lastSavedExtra.current = val;
                onSaveExtraValue(val);
            }
        }, 1500);
    };

    const parseExtraData = (raw: string): Record<string, string> => {
        if (!raw) return {};
        if (raw.startsWith('{')) {
            try {
                return JSON.parse(raw) as Record<string, string>;
            } catch {
                return { text: raw };
            }
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
            return { date: raw.trim() };
        }
        if (flags.hasDate && !flags.hasFile && !flags.hasText) return { date: raw };
        if (flags.hasFile && !flags.hasDate && !flags.hasText) return { file: raw };
        return { text: raw };
    };

    const getFieldValue = (key: 'text' | 'date' | 'file') => {
        const data = parseExtraData(extraBuffer);
        return data[key] || '';
    };

    const setFieldValue = (key: 'text' | 'date' | 'file', val: string) => {
        if (extraCount <= 1) {
            handleExtraChange(val);
        } else {
            const current = parseExtraData(extraBuffer);
            const next = { ...current, [key]: val };
            const hasAny = Object.values(next).some((v) => Boolean(v && v.trim()));
            handleExtraChange(hasAny ? JSON.stringify(next) : '');
        }
    };

    const [undoTarget, setUndoTarget] = useState<string | null | undefined>(undefined);
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleAnswerClick = (val: string) => {
        if (val === selectedAnswer) return;
        flushExtra();
        const prev = selectedAnswer ?? null;
        setUndoTarget(prev);
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
            setUndoTarget(undefined);
        }, 8000);
        onSelectAnswer(val);
    };

    const handleUndo = () => {
        if (undoTarget === undefined) return;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        const target = undoTarget;
        setUndoTarget(undefined);
        onSelectAnswer(target ?? '');
    };

    // Unmount-only flush
    useEffect(() => {
        return () => {
            if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            if (extraBufferRef.current !== lastSavedExtra.current) {
                lastSavedExtra.current = extraBufferRef.current;
                onSaveExtraValueRef.current(extraBufferRef.current);
            }
        };
    }, []);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        setIsUploadingFile(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/reports/${reportId}/questions/${question.id}/attachment`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: formData,
            });

            const fileName = res.ok ? (await res.json()).name || file.name : file.name;

            if (extraCount <= 1 && flags.hasFile && !flags.hasDate && !flags.hasText) {
                setExtraBuffer(fileName);
                lastSavedExtra.current = fileName;
                if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
                onSaveExtraValue(fileName);
            } else {
                const current = parseExtraData(extraBuffer);
                const next = { ...current, file: fileName };
                const newExtra = JSON.stringify(next);
                setExtraBuffer(newExtra);
                lastSavedExtra.current = newExtra;
                if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
                onSaveExtraValue(newExtra);
            }
        } catch {
            const fileName = file.name;
            const current = parseExtraData(extraBuffer);
            const next = { ...current, file: fileName };
            const newExtra = JSON.stringify(next);
            setExtraBuffer(newExtra);
            lastSavedExtra.current = newExtra;
            if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
            onSaveExtraValue(newExtra);
        } finally {
            setIsUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = () => {
        if (extraCount <= 1 && flags.hasFile && !flags.hasDate && !flags.hasText) {
            setExtraBuffer('');
            lastSavedExtra.current = '';
            if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
            onSaveExtraValue('');
        } else {
            const current = parseExtraData(extraBuffer);
            const next = { ...current, file: '' };
            const hasAny = Object.values(next).some((v) => Boolean(v && v.trim()));
            const newExtra = hasAny ? JSON.stringify(next) : '';
            setExtraBuffer(newExtra);
            lastSavedExtra.current = newExtra;
            if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
            onSaveExtraValue(newExtra);
        }
    };

    return (
        <div
            className={`rounded-lg border p-4 transition-colors ${
                isLockedNA
                    ? 'bg-muted/30 border-muted opacity-75'
                    : selectedAnswer === 'no'
                    ? 'bg-rose-50/30 border-rose-200 dark:bg-rose-950/10 dark:border-rose-900/40'
                    : 'bg-card border-border hover:border-muted-foreground/30'
            }`}
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                {/* Question Text & Badges */}
                <div className="space-y-1.5 flex-1 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground leading-snug">
                            {question.question_text}
                        </span>

                        {isLockedNA && (
                            <Badge variant="outline" className="text-[10px] text-slate-500">
                                Locked NA: {question.applicable_reason || 'Inapplicable'}
                            </Badge>
                        )}

                        {undoTarget !== undefined && isEditable && !isLockedNA && (
                            <button
                                type="button"
                                onClick={handleUndo}
                                className="text-[10px] text-primary hover:text-primary/80 font-semibold flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded transition-all cursor-pointer shadow-2xs"
                                title="Undo recent answer change"
                            >
                                <RotateCcw className="size-2.5" />
                                <span>Undo</span>
                            </button>
                        )}

                        {saveStatus === 'saving' && (
                            <span className="text-[10px] text-amber-500 animate-pulse flex items-center gap-1">
                                <Loader2 className="size-2.5 animate-spin" /> Saving...
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                <Check className="size-3" /> Saved
                            </span>
                        )}
                        {saveStatus === 'retrying' && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <CloudOff className="size-3" /> Queued (retrying)
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-[10px] text-rose-600 flex items-center gap-0.5">
                                <AlertCircle className="size-3" /> Save failed
                            </span>
                        )}
                        {saveStatus === 'conflict' && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />{' '}
                                Conflict
                            </span>
                        )}
                    </div>
                </div>

                {/* Answer Choice Buttons & Guidance Toggle */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    {question.guidance && onToggleGuidance && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onToggleGuidance}
                            className={`h-8 w-8 p-0 flex items-center justify-center ${
                                isExpandedGuidance
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Inspection guidance notes"
                            aria-label="Toggle inspection guidance"
                        >
                            <HelpCircle className="size-4" />
                        </Button>
                    )}

                    {flags.hasChoices && (
                        <div className="inline-flex rounded-md border p-0.5 bg-muted/30">
                            {answerChoices.map((choice) => {
                                const isSelected = selectedAnswer === choice.value;

                                return (
                                    <button
                                        key={choice.value}
                                        type="button"
                                        disabled={!isEditable || isLockedNA}
                                        onClick={() => handleAnswerClick(choice.value)}
                                        className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                                            isSelected
                                                ? `${choice.color} shadow-xs font-bold ring-1`
                                                : 'text-muted-foreground hover:text-foreground'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                        {choice.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Additional Input Fields (Date, File, Text) */}
            {hasAnyExtra && (
                <div className="mt-3 pt-2.5 border-t border-border/40 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                        {flags.hasDate && (
                            <div className="space-y-1 w-44 shrink-0">
                                <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                    <Calendar className="size-3.5 text-primary shrink-0" />
                                    <span>Date:</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={getFieldValue('date')}
                                    disabled={!isEditable || isLockedNA}
                                    onChange={(e) => setFieldValue('date', e.target.value)}
                                    onBlur={flushExtra}
                                    className="h-8 text-xs w-full bg-background"
                                />
                            </div>
                        )}

                        {flags.hasFile && (
                            <div className="space-y-1 min-w-[220px] flex-1">
                                <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                    <Paperclip className="size-3.5 text-primary shrink-0" />
                                    <span>File / Attachment:</span>
                                </Label>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={!isEditable || isLockedNA || isUploadingFile}
                                />

                                {getFieldValue('file') ? (
                                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1 text-xs h-8">
                                        <File className="size-3.5 text-primary shrink-0" />
                                        <span
                                            className="font-medium text-foreground truncate max-w-[220px]"
                                            title={getFieldValue('file')}
                                        >
                                            {getFieldValue('file')}
                                        </span>
                                        {isEditable && !isLockedNA && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveFile}
                                                className="ml-auto text-muted-foreground hover:text-destructive p-0.5 cursor-pointer"
                                                title="Remove file"
                                            >
                                                <X className="size-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!isEditable || isLockedNA || isUploadingFile}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-8 text-xs gap-1.5 w-full justify-start text-muted-foreground hover:text-foreground"
                                    >
                                        {isUploadingFile ? (
                                            <>
                                                <Loader2 className="size-3.5 animate-spin text-primary" />
                                                <span>Uploading file...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="size-3.5 text-primary" />
                                                <span>Choose File / Document to Attach</span>
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}

                        {flags.hasText && (
                            <div className="space-y-1 w-full">
                                <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                    <FileText className="size-3.5 text-primary shrink-0" />
                                    <span>{inputMeta.label}</span>
                                </Label>
                                <Input
                                    type="text"
                                    value={getFieldValue('text')}
                                    disabled={!isEditable || isLockedNA}
                                    onChange={(e) => setFieldValue('text', e.target.value)}
                                    onBlur={flushExtra}
                                    className="h-8 text-xs w-full bg-background"
                                    placeholder={inputMeta.placeholder}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Expandable Guidance Panel */}
            {isExpandedGuidance && question.guidance && (
                <div className="mt-3 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground border border-border/60">
                    <div className="flex items-start gap-2">
                        <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="font-semibold text-foreground">Inspection Guidance:</p>
                            <p className="leading-relaxed whitespace-pre-line">{question.guidance}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Conflict Resolution Banner (NFR-15) */}
            {conflict && onAcceptServerAnswer && onOverwriteAnswer && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-xs dark:border-amber-700/60 dark:bg-amber-950/40 space-y-2">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                            <p className="font-semibold text-amber-900 dark:text-amber-200">
                                Edit Conflict Detected
                            </p>
                            <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                                This answer was modified by{' '}
                                <strong>{conflict.server_answer.answered_by_name || 'another user'}</strong>{' '}
                                while you were editing.
                            </p>
                            <div className="rounded bg-background/80 p-2 border border-amber-200 dark:border-amber-900 text-[11px] space-y-0.5">
                                <div>
                                    <span className="text-muted-foreground font-medium">Server Value:</span>{' '}
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 px-1">
                                        {conflict.server_answer.answer || 'Unanswered'}
                                    </Badge>
                                    {conflict.server_answer.note
                                        ? ` — Note: "${conflict.server_answer.note}"`
                                        : ''}
                                    {conflict.server_answer.extra_value
                                        ? ` — Details: "${formatExtraDisplay(conflict.server_answer.extra_value)}"`
                                        : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 pl-6">
                        <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => onAcceptServerAnswer(conflict.server_answer)}
                            className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/60"
                        >
                            Keep Server Value
                        </Button>
                        <Button
                            size="sm"
                            variant="default"
                            type="button"
                            onClick={() => onOverwriteAnswer(conflict.server_answer.row_version)}
                            className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            Overwrite with My Value
                        </Button>
                    </div>
                </div>
            )}

            {/* Photographic Evidence Strip */}
            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="size-3 text-primary" />
                        <span>Photographic Evidence:</span>
                    </span>
                    <PhotoEvidenceStrip
                        photos={attachedPhotos}
                        isEditable={isEditable && !isLockedNA}
                        onAttachClick={() => setEvidenceModalOpen(true)}
                        onDetachPhoto={handleDetachPhoto}
                    />
                </div>
            </div>

            {/* Photo Evidence Modal */}
            <PhotoEvidenceDialog
                open={evidenceModalOpen}
                onOpenChange={setEvidenceModalOpen}
                reportId={reportId}
                targetType="question"
                targetId={question.id}
                targetTitle={question.question_text}
                reportPhotos={reportPhotos || []}
                categories={photoCategories || []}
                onPhotosUpdated={(updated) => onPhotosUpdated?.(updated)}
            />
        </div>
    );
}
