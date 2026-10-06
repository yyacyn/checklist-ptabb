import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CloudOff,
    HelpCircle,
    Info,
    Loader2,
    MessageSquare,
    RefreshCw,
    Save,
    Search,
    Ship,
    SlidersHorizontal,
    Users,
    WifiOff,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    dequeueSave,
    enqueueSave,
    flushSaveQueue,
    generateClientSaveId,
    getPendingCount,
    type QueueSyncState,
} from '@/lib/autosave-queue';

export interface LockData {
    is_locked: boolean;
    is_owner: boolean;
    owner_id: number;
    owner_name: string;
    expires_at: string;
}

export interface ConflictData {
    error: string;
    message: string;
    server_answer: {
        id: number;
        report_question_id: number;
        answer: string | null;
        note: string | null;
        extra_value: string | null;
        client_save_id?: string | null;
        row_version: number;
        answered_by_name?: string;
        answered_at?: string;
    };
}

export interface AnswerData {
    id?: number;
    report_question_id: number;
    answer: string | null; // yes | no | ns | na
    note: string | null;
    extra_value: string | null;
    row_version?: number;
    answered_at?: string;
}

export interface QuestionData {
    id: number;
    question_text: string;
    guidance: string | null;
    input_type: string;
    sort_order: number;
    is_applicable: boolean;
    applicable_reason: string | null;
    na_reason: string | null;
    answer?: AnswerData | null;
}

export interface SubgroupData {
    id: number;
    parent_id: number;
    title: string;
    sort_order: number;
    is_applicable: boolean;
    questions: QuestionData[];
}

export interface ChapterData {
    id: number;
    title: string;
    chapter_no: string | null;
    sort_order: number;
    is_applicable: boolean;
    na_reason: string | null;
    comments: string | null;
    questions: QuestionData[];
    subgroups: SubgroupData[];
}

export interface ReportData {
    id: number;
    report_type: 'inspection' | 'audit';
    reference_number: string;
    status: string;
    template_version: number;
    vessel_name: string;
    vessel_imo: string | null;
    vessel_flag: string | null;
    vessel_gt: string | null;
    vessel_built: number | null;
    vessel_ice_class: boolean;
    report_date: string;
    master_name: string | null;
    chief_engineer_name: string | null;
    chief_officer_name: string | null;
    form: {
        id: number;
        code: string;
        name: string;
        answer_set: string;
    };
    vessel_type?: {
        id: number;
        name: string;
    } | null;
    groups: ChapterData[];
}

interface Props {
    report: ReportData;
    is_editable: boolean;
    initial_lock?: LockData | null;
}

export default function ReportDataEntry({ report, is_editable = true, initial_lock = null }: Props) {
    // Advisory edit lock state (NFR-15)
    const [lockState, setLockState] = useState<LockData | null>(initial_lock);

    // Question edit conflicts state (NFR-15): questionId -> ConflictData
    const [conflicts, setConflicts] = useState<Record<number, ConflictData>>({});

    // Current Active Chapter (Task 3.2: One group per screen)
    const [activeChapterId, setActiveChapterId] = useState<number>(
        report.groups[0]?.id || 0
    );

    // Filter states (Task 3.2: unanswered filter, search-jump)
    const [showUnansweredOnly, setShowUnansweredOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Answers dictionary: questionId -> AnswerData
    const [answers, setAnswers] = useState<Record<number, AnswerData>>(() => {
        const map: Record<number, AnswerData> = {};
        report.groups.forEach((ch) => {
            (ch.questions || []).forEach((q) => {
                if (q.answer) map[q.id] = q.answer;
            });
            (ch.subgroups || []).forEach((sg) => {
                (sg.questions || []).forEach((q) => {
                    if (q.answer) map[q.id] = q.answer;
                });
            });
        });
        return map;
    });

    // Group comments: chapterId -> string
    const [chapterComments, setChapterComments] = useState<Record<number, string>>(() => {
        const map: Record<number, string> = {};
        report.groups.forEach((ch) => {
            map[ch.id] = ch.comments || '';
        });
        return map;
    });

    // Guidance expanded states: questionId -> boolean
    const [expandedGuidance, setExpandedGuidance] = useState<Record<number, boolean>>({});

    // Notes open states: questionId -> boolean
    const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

    // Saving indicators: questionId -> 'saving' | 'saved' | 'error'
    const [saveStatuses, setSaveStatuses] = useState<Record<number, string>>({});

    // Comments save indicator: chapterId -> 'saving' | 'saved'
    const [commentsSaveStatuses, setCommentsSaveStatuses] = useState<Record<number, string>>({});

    // Available answer choices based on form
    const isB008 = report.form.code === 'B-008';
    const answerChoices = isB008
        ? [
              { value: 'yes', label: 'Yes', color: 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { value: 'no', label: 'No', color: 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
              { value: 'ns', label: 'N/S', color: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
          ]
        : [
              { value: 'yes', label: 'Yes', color: 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
              { value: 'no', label: 'No', color: 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
              { value: 'ns', label: 'NS', color: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
              { value: 'na', label: 'NA', color: 'border-slate-500 text-slate-600 bg-slate-50 dark:bg-slate-900/40' },
          ];

    // Compute progress counters per chapter
    const chapterStats = useMemo(() => {
        const stats: Record<
            number,
            { total: number; applicable: number; answered: number; noCount: number; nsCount: number }
        > = {};

        report.groups.forEach((ch) => {
            let total = 0;
            let applicable = 0;
            let answered = 0;
            let noCount = 0;
            let nsCount = 0;

            const processQ = (q: QuestionData) => {
                total++;
                if (q.is_applicable) {
                    applicable++;
                    const ans = answers[q.id]?.answer;
                    if (ans) {
                        answered++;
                        if (ans === 'no') noCount++;
                        if (ans === 'ns') nsCount++;
                    }
                }
            };

            (ch.questions || []).forEach(processQ);
            (ch.subgroups || []).forEach((sg) => (sg.questions || []).forEach(processQ));

            stats[ch.id] = { total, applicable, answered, noCount, nsCount };
        });

        return stats;
    }, [report.groups, answers]);

    // Active Chapter object
    const activeChapter = report.groups.find((g) => g.id === activeChapterId) || report.groups[0];

    // Task 3.4 & 3.5: IndexedDB Offline Retry Queue & Autosave Engine State
    const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
    const [globalSyncState, setGlobalSyncState] = useState<QueueSyncState>('saved');
    const [isOffline, setIsOffline] = useState<boolean>(() =>
        typeof navigator !== 'undefined' ? !navigator.onLine : false
    );
    const [isFlushingQueue, setIsFlushingQueue] = useState<boolean>(false);

    const triggerManualQueueFlush = useCallback(async () => {
        setIsFlushingQueue(true);
        setGlobalSyncState('saving');
        try {
            const { remaining } = await flushSaveQueue(report.id, (count) => {
                setPendingQueueCount(count);
            });
            setPendingQueueCount(remaining);
            setGlobalSyncState(remaining > 0 ? 'retrying' : 'saved');
        } catch {
            setGlobalSyncState('retrying');
        } finally {
            setIsFlushingQueue(false);
        }
    }, [report.id]);

    useEffect(() => {
        let mounted = true;

        getPendingCount(report.id).then((count) => {
            if (!mounted) return;
            setPendingQueueCount(count);
            if (count > 0) {
                setGlobalSyncState('retrying');
                triggerManualQueueFlush();
            }
        });

        const handleOnline = () => {
            setIsOffline(false);
            triggerManualQueueFlush();
        };

        const handleOffline = () => {
            setIsOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const interval = setInterval(() => {
            if (navigator.onLine) {
                getPendingCount(report.id).then((c) => {
                    if (mounted && c > 0) {
                        setPendingQueueCount(c);
                        triggerManualQueueFlush();
                    }
                });
            }
        }, 10000);

        return () => {
            mounted = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [report.id, triggerManualQueueFlush]);

    // Advisory Edit Lock management (NFR-15)
    const acquireLock = useCallback(
        async (force = false) => {
            if (!is_editable) return;
            try {
                const csrfToken =
                    (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
                const res = await fetch(`/reports/${report.id}/lock`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ force }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.lock) {
                        setLockState(data.lock);
                    }
                }
            } catch {
                // Ignore transient lock failures over VSAT
            }
        },
        [is_editable, report.id]
    );

    // Initial lock acquisition on mount
    useEffect(() => {
        if (!is_editable) return;
        if (!initial_lock || initial_lock.is_owner) {
            acquireLock(false);
        }
    }, [is_editable, initial_lock, acquireLock]);

    // Heartbeat every 2 minutes while user owns lock and tab is active
    useEffect(() => {
        if (!is_editable) return;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && lockState?.is_owner) {
                acquireLock(false);
            }
        }, 120000);

        return () => clearInterval(interval);
    }, [is_editable, lockState?.is_owner, acquireLock]);

    // Release lock on unmount if user owns lock
    useEffect(() => {
        return () => {
            if (lockState?.is_owner) {
                const csrfToken =
                    (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
                fetch(`/reports/${report.id}/lock`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    keepalive: true,
                }).catch(() => {});
            }
        };
    }, [report.id, lockState?.is_owner]);

    // Save Answer with IndexedDB retry queue and conflict detection (Task 3.3, 3.4, 3.5, 3.6, NFR-1, NFR-2, NFR-15)
    const saveAnswerToServer = async (
        questionId: number,
        updatedFields: Partial<AnswerData>,
        overrideBaseVersion?: number
    ) => {
        if (!is_editable) return;

        const currentAnswer = answers[questionId] || {
            report_question_id: questionId,
            answer: null,
            note: null,
            extra_value: null,
        };

        const newAnswerData: AnswerData = {
            ...currentAnswer,
            ...updatedFields,
        };

        // Update local state immediately for responsive UI
        setAnswers((prev) => ({
            ...prev,
            [questionId]: newAnswerData,
        }));

        setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saving' }));
        setGlobalSyncState('saving');

        const clientSaveId = generateClientSaveId();
        const endpoint = `/reports/${report.id}/questions/${questionId}/answer`;
        const payload = {
            answer: newAnswerData.answer,
            note: newAnswerData.note,
            extra_value: newAnswerData.extra_value,
            client_save_id: clientSaveId,
            base_row_version:
                overrideBaseVersion !== undefined ? overrideBaseVersion : (currentAnswer.row_version ?? null),
        };

        // Persist in IndexedDB retry queue first (NFR-2)
        await enqueueSave({
            client_save_id: clientSaveId,
            report_id: report.id,
            question_id: questionId,
            endpoint,
            payload,
            timestamp: Date.now(),
            attempts: 0,
        });

        const count = await getPendingCount(report.id);
        setPendingQueueCount(count);

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                // Server acknowledged -> remove from IndexedDB
                await dequeueSave(clientSaveId);
                const remaining = await getPendingCount(report.id);
                setPendingQueueCount(remaining);
                setGlobalSyncState(remaining > 0 ? 'retrying' : 'saved');

                // Clear any conflict for this question
                setConflicts((prev) => {
                    const copy = { ...prev };
                    delete copy[questionId];
                    return copy;
                });

                setAnswers((prev) => ({
                    ...prev,
                    [questionId]: { ...newAnswerData, ...data.answer },
                }));
                setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saved' }));
                setTimeout(() => {
                    setSaveStatuses((prev) => {
                        const copy = { ...prev };
                        if (copy[questionId] === 'saved') {
                            delete copy[questionId];
                        }
                        return copy;
                    });
                }, 2000);
            } else if (res.status === 409) {
                // Conflict detected (NFR-15): Stale row_version refused by server
                const conflictData: ConflictData = await res.json();
                await dequeueSave(clientSaveId);
                const remaining = await getPendingCount(report.id);
                setPendingQueueCount(remaining);
                setGlobalSyncState(remaining > 0 ? 'retrying' : 'saved');

                setConflicts((prev) => ({
                    ...prev,
                    [questionId]: conflictData,
                }));
                setSaveStatuses((prev) => ({ ...prev, [questionId]: 'conflict' }));
            } else {
                setSaveStatuses((prev) => ({ ...prev, [questionId]: 'retrying' }));
                setGlobalSyncState('retrying');
            }
        } catch {
            // Offline / VSAT drop: keep in IndexedDB and flag as retrying
            setSaveStatuses((prev) => ({ ...prev, [questionId]: 'retrying' }));
            setGlobalSyncState('retrying');
        }
    };

    // Conflict Resolution Handlers (NFR-15)
    const handleAcceptServerAnswer = (
        questionId: number,
        serverAnswer: ConflictData['server_answer']
    ) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: {
                id: serverAnswer.id,
                report_question_id: serverAnswer.report_question_id,
                answer: serverAnswer.answer,
                note: serverAnswer.note,
                extra_value: serverAnswer.extra_value,
                row_version: serverAnswer.row_version,
                answered_at: serverAnswer.answered_at,
            },
        }));
        setConflicts((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
        });
        setSaveStatuses((prev) => {
            const copy = { ...prev };
            delete copy[questionId];
            return copy;
        });
    };

    const handleOverwriteAnswer = (questionId: number, serverRowVersion: number) => {
        const current = answers[questionId];
        if (!current) return;
        setConflicts((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
        });
        saveAnswerToServer(questionId, current, serverRowVersion);
    };

    // Save Chapter Comments with debounce and flush on chapter change (Task 3.4, 3.8)
    const commentsDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedComments = useRef<Record<number, string>>({});

    const saveChapterComments = async (chapterId: number, text: string) => {
        if (!is_editable) return;

        setCommentsSaveStatuses((prev) => ({ ...prev, [chapterId]: 'saving' }));

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(`/reports/${report.id}/groups/${chapterId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ comments: text }),
            });

            if (res.ok) {
                setCommentsSaveStatuses((prev) => ({ ...prev, [chapterId]: 'saved' }));
                setTimeout(() => {
                    setCommentsSaveStatuses((prev) => {
                        const copy = { ...prev };
                        delete copy[chapterId];
                        return copy;
                    });
                }, 2000);
            }
        } catch {
            setCommentsSaveStatuses((prev) => ({ ...prev, [chapterId]: 'error' }));
        }
    };

    const flushPendingComments = useCallback(async (chapterId: number) => {
        if (commentsDebounceTimer.current) {
            clearTimeout(commentsDebounceTimer.current);
            commentsDebounceTimer.current = null;
        }
        const text = chapterComments[chapterId] ?? '';
        if (text !== (lastSavedComments.current[chapterId] ?? '')) {
            lastSavedComments.current[chapterId] = text;
            await saveChapterComments(chapterId, text);
        }
    }, [chapterComments]);

    const handleChapterCommentsChange = (chapterId: number, text: string) => {
        setChapterComments((prev) => ({ ...prev, [chapterId]: text }));
        if (commentsDebounceTimer.current) clearTimeout(commentsDebounceTimer.current);
        commentsDebounceTimer.current = setTimeout(() => {
            if (text !== (lastSavedComments.current[chapterId] ?? '')) {
                lastSavedComments.current[chapterId] = text;
                saveChapterComments(chapterId, text);
            }
        }, 1500);
    };

    const handleChapterSwitch = async (targetChapterId: number) => {
        if (targetChapterId === activeChapterId) return;
        await flushPendingComments(activeChapterId);
        setActiveChapterId(targetChapterId);
    };

    // Filter questions based on search & unanswered filter
    const filterQuestion = (q: QuestionData): boolean => {
        if (!q.is_applicable) return !showUnansweredOnly;

        if (showUnansweredOnly) {
            const ans = answers[q.id]?.answer;
            if (ans) return false;
        }

        if (searchQuery.trim().length > 0) {
            const matchText = q.question_text.toLowerCase().includes(searchQuery.toLowerCase());
            const matchGuidance = (q.guidance || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchText || matchGuidance;
        }

        return true;
    };

    // Overall Progress Calculation
    const overallStats = useMemo(() => {
        let totalApplicable = 0;
        let totalAnswered = 0;
        Object.values(chapterStats).forEach((s) => {
            totalApplicable += s.applicable;
            totalAnswered += s.answered;
        });
        const percent = totalApplicable > 0 ? Math.round((totalAnswered / totalApplicable) * 100) : 0;
        return { totalApplicable, totalAnswered, percent };
    }, [chapterStats]);

    return (
        <>
            <Head title={`Fill Report: ${report.reference_number}`} />

            <div className="flex h-screen flex-col overflow-hidden bg-background">
                {/* Top Sticky Header */}
                <header className="border-b bg-card px-6 py-3.5 shrink-0 z-30">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground hover:text-foreground">
                                <Link href="/reports">
                                    <ArrowLeft className="size-4 mr-1" /> All Reports
                                </Link>
                            </Button>
                            <span className="text-muted-foreground">•</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-base text-foreground">
                                        {report.vessel_name}
                                    </h2>
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {report.reference_number}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                        {report.form.code}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Inspection Date: {report.report_date} • Template v{report.template_version}
                                </p>
                            </div>
                        </div>

                        {/* Overall Progress Bar, Sync Status & Filter Controls */}
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Global Save / Sync Status (Task 3.4 & 3.5, NFR-1, NFR-2) */}
                            <div className="flex items-center gap-2">
                                {globalSyncState === 'saved' && (
                                    <span
                                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                                        title="All checklist changes saved"
                                    >
                                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                                        <span className="hidden lg:inline text-[11px] font-medium">Saved</span>
                                    </span>
                                )}
                                {globalSyncState === 'saving' && (
                                    <span
                                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                                        title="Saving change to server..."
                                    >
                                        <Loader2 className="size-3.5 text-primary animate-spin" />
                                        <span className="hidden lg:inline text-[11px] font-medium">Saving...</span>
                                    </span>
                                )}
                                {globalSyncState === 'retrying' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        type="button"
                                        onClick={triggerManualQueueFlush}
                                        disabled={isFlushingQueue}
                                        className="h-7 text-xs border-amber-500 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 flex items-center gap-1.5 px-2"
                                        title="Temporary VSAT drop or offline. Click to retry syncing immediately."
                                    >
                                        <CloudOff className="size-3 text-amber-500" />
                                        <span>{pendingQueueCount} queued</span>
                                        <RefreshCw className={`size-3 ml-0.5 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}
                                {isOffline && (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                                        <WifiOff className="size-3" /> Offline
                                    </Badge>
                                )}
                            </div>

                            <div className="h-4 w-px bg-border hidden sm:block" />

                            <div className="flex items-center gap-2">
                                <div className="w-32 h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${overallStats.percent}%` }}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-foreground">
                                    {overallStats.totalAnswered} / {overallStats.totalApplicable} ({overallStats.percent}%)
                                </span>
                            </div>

                            {/* Search Jump */}
                            <div className="relative w-40">
                                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search question..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-7 text-xs pl-8"
                                />
                            </div>

                            {/* Unanswered Filter Toggle */}
                            <Button
                                size="sm"
                                variant={showUnansweredOnly ? 'default' : 'outline'}
                                onClick={() => setShowUnansweredOnly((prev) => !prev)}
                                className="h-7 text-xs flex items-center gap-1.5"
                            >
                                <SlidersHorizontal className="size-3" />
                                <span>{showUnansweredOnly ? 'Showing Unanswered' : 'Filter Unanswered'}</span>
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Advisory Edit Lock Banner (NFR-15) */}
                {lockState && lockState.is_locked && !lockState.is_owner && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>
                                <strong>{lockState.owner_name}</strong> is currently editing this report. Concurrent changes might conflict.
                            </span>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => acquireLock(true)}
                            className="h-7 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 shrink-0"
                        >
                            Take over editing
                        </Button>
                    </div>
                )}

                {/* Main 2-Column Split: Sticky Sidebar (Left) + Current Group Form (Right) */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sticky Chapter Navigation Sidebar */}
                    <aside className="w-80 shrink-0 border-r bg-muted/20 overflow-y-auto p-4 space-y-1.5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-1">
                            Chapters / Sections
                        </div>

                        {report.groups.map((group) => {
                            const stats = chapterStats[group.id] || { applicable: 0, answered: 0, noCount: 0, nsCount: 0 };
                            const isCurrent = group.id === activeChapterId;
                            const isComplete = stats.applicable > 0 && stats.answered === stats.applicable;

                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => handleChapterSwitch(group.id)}
                                    className={`w-full text-left rounded-lg p-3 transition-all flex flex-col gap-1.5 ${
                                        isCurrent
                                            ? 'bg-card border-2 border-primary shadow-xs ring-1 ring-primary/20'
                                            : 'border border-transparent hover:bg-card/70'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {isComplete ? (
                                                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <span className="size-2 rounded-full bg-muted-foreground/40 shrink-0" />
                                            )}
                                            <span className="font-medium text-xs text-foreground truncate">
                                                {group.chapter_no ? `${group.chapter_no}. ` : ''}
                                                {group.title}
                                            </span>
                                        </div>

                                        {!group.is_applicable && (
                                            <Badge variant="outline" className="text-[10px] shrink-0 text-amber-600">
                                                NA
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Progress & Flags Bar */}
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-3.5">
                                        <span>
                                            {stats.answered} of {stats.applicable} answered
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            {stats.noCount > 0 && (
                                                <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 rounded text-[10px]">
                                                    {stats.noCount} No
                                                </span>
                                            )}
                                            {stats.nsCount > 0 && (
                                                <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-1 rounded text-[10px]">
                                                    {stats.nsCount} NS
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </aside>

                    {/* Right Main Content Area: One Group Screen */}
                    <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                        {activeChapter ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* VSAT Offline Buffer Banner (NFR-2) */}
                                {pendingQueueCount > 0 && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-between gap-3 shadow-xs">
                                        <div className="flex items-center gap-2.5">
                                            <CloudOff className="size-4 text-amber-600 shrink-0" />
                                            <span>
                                                <strong>VSAT Offline Buffer:</strong> {pendingQueueCount} change(s) stored locally in browser IndexedDB. Will auto-sync when connection restores.
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            type="button"
                                            onClick={triggerManualQueueFlush}
                                            disabled={isFlushingQueue}
                                            className="h-7 text-xs border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 shrink-0"
                                        >
                                            <RefreshCw className={`size-3 mr-1.5 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                                            Retry Sync
                                        </Button>
                                    </div>
                                )}

                                {/* Chapter Title Banner */}
                                <div className="border-b pb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs font-mono">
                                            Chapter {activeChapter.chapter_no || activeChapter.sort_order}
                                        </Badge>
                                        {!activeChapter.is_applicable && (
                                            <Badge variant="destructive" className="text-xs">
                                                {activeChapter.na_reason || 'Inapplicable for this vessel'}
                                            </Badge>
                                        )}
                                    </div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                        {activeChapter.title}
                                    </h1>
                                </div>

                                {/* Direct Chapter Questions (if any) */}
                                {activeChapter.questions && activeChapter.questions.length > 0 && (
                                    <div className="space-y-3">
                                        {activeChapter.questions.filter(filterQuestion).map((q) => (
                                            <QuestionAnswerCard
                                                key={q.id}
                                                question={q}
                                                currentAnswer={answers[q.id]}
                                                isB008={isB008}
                                                answerChoices={answerChoices}
                                                isExpandedGuidance={Boolean(expandedGuidance[q.id])}
                                                isExpandedNotes={Boolean(expandedNotes[q.id])}
                                                saveStatus={saveStatuses[q.id]}
                                                isEditable={is_editable}
                                                onToggleGuidance={() =>
                                                    setExpandedGuidance((prev) => ({
                                                        ...prev,
                                                        [q.id]: !prev[q.id],
                                                    }))
                                                }
                                                onToggleNotes={() =>
                                                    setExpandedNotes((prev) => ({
                                                        ...prev,
                                                        [q.id]: !prev[q.id],
                                                    }))
                                                }
                                                onSelectAnswer={(val) =>
                                                    saveAnswerToServer(q.id, { answer: val })
                                                }
                                                onSaveNote={(noteText) =>
                                                    saveAnswerToServer(q.id, { note: noteText })
                                                }
                                                onSaveExtraValue={(val) =>
                                                    saveAnswerToServer(q.id, { extra_value: val })
                                                }
                                                conflict={conflicts[q.id]}
                                                onAcceptServerAnswer={(srv) => handleAcceptServerAnswer(q.id, srv)}
                                                onOverwriteAnswer={(srvVer) => handleOverwriteAnswer(q.id, srvVer)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Subgroups */}
                                {activeChapter.subgroups && activeChapter.subgroups.length > 0 && (
                                    <div className="space-y-8">
                                        {activeChapter.subgroups.map((subgroup) => {
                                            const visibleQuestions = (subgroup.questions || []).filter(filterQuestion);
                                            if (visibleQuestions.length === 0 && (showUnansweredOnly || searchQuery)) {
                                                return null;
                                            }

                                            return (
                                                <section key={subgroup.id} className="space-y-3">
                                                    <div className="border-b pb-1.5 flex items-center justify-between">
                                                        <h3 className="font-semibold text-sm uppercase tracking-wide text-foreground">
                                                            {subgroup.title}
                                                        </h3>
                                                        {!subgroup.is_applicable && (
                                                            <Badge variant="outline" className="text-[10px] text-amber-600">
                                                                Inapplicable
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3">
                                                        {visibleQuestions.map((q) => (
                                                            <QuestionAnswerCard
                                                                key={q.id}
                                                                question={q}
                                                                currentAnswer={answers[q.id]}
                                                                isB008={isB008}
                                                                answerChoices={answerChoices}
                                                                isExpandedGuidance={Boolean(expandedGuidance[q.id])}
                                                                isExpandedNotes={Boolean(expandedNotes[q.id])}
                                                                saveStatus={saveStatuses[q.id]}
                                                                isEditable={is_editable}
                                                                onToggleGuidance={() =>
                                                                    setExpandedGuidance((prev) => ({
                                                                        ...prev,
                                                                        [q.id]: !prev[q.id],
                                                                    }))
                                                                }
                                                                onToggleNotes={() =>
                                                                    setExpandedNotes((prev) => ({
                                                                        ...prev,
                                                                        [q.id]: !prev[q.id],
                                                                    }))
                                                                }
                                                                onSelectAnswer={(val) =>
                                                                    saveAnswerToServer(q.id, { answer: val })
                                                                }
                                                                onSaveNote={(noteText) =>
                                                                    saveAnswerToServer(q.id, { note: noteText })
                                                                }
                                                                onSaveExtraValue={(val) =>
                                                                    saveAnswerToServer(q.id, { extra_value: val })
                                                                }
                                                                conflict={conflicts[q.id]}
                                                                onAcceptServerAnswer={(srv) => handleAcceptServerAnswer(q.id, srv)}
                                                                onOverwriteAnswer={(srvVer) => handleOverwriteAnswer(q.id, srvVer)}
                                                            />
                                                        ))}
                                                    </div>
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Chapter Comments / Remarks Box */}
                                <Card className="border-2 border-border/80 bg-card">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                                <MessageSquare className="size-4 text-primary" />
                                                <span>Chapter Comments / Remarks</span>
                                            </CardTitle>
                                            {commentsSaveStatuses[activeChapter.id] === 'saving' && (
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Saving remarks...
                                                </span>
                                            )}
                                            {commentsSaveStatuses[activeChapter.id] === 'saved' && (
                                                <span className="text-xs text-emerald-600 flex items-center gap-1">
                                                    <Check className="size-3" /> Saved
                                                </span>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs">
                                            {(chapterStats[activeChapter.id]?.nsCount || 0) > 0 ||
                                            (chapterStats[activeChapter.id]?.total || 0) -
                                                (chapterStats[activeChapter.id]?.applicable || 0) >
                                                0 ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                    Notice: The form requires inspectors to explain any Not Seen (NS) or
                                                    Not Applicable (NA) items in this remarks box.
                                                </span>
                                            ) : (
                                                'Provide overarching notes or observations for this chapter.'
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <textarea
                                            rows={3}
                                            value={chapterComments[activeChapter.id] || ''}
                                            disabled={!is_editable}
                                            onChange={(e) =>
                                                handleChapterCommentsChange(activeChapter.id, e.target.value)
                                            }
                                            onBlur={() => flushPendingComments(activeChapter.id)}
                                            placeholder="Write chapter remarks, qualifications, or NS/NA explanations..."
                                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">Select a chapter from the sidebar.</div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}

// Subcomponent: Individual Question Answer Row (Task 3.3, 3.6)
function QuestionAnswerCard({
    question,
    currentAnswer,
    isB008,
    answerChoices,
    isExpandedGuidance,
    isExpandedNotes,
    saveStatus,
    isEditable,
    onToggleGuidance,
    onToggleNotes,
    onSelectAnswer,
    onSaveNote,
    onSaveExtraValue,
    conflict,
    onAcceptServerAnswer,
    onOverwriteAnswer,
}: {
    question: QuestionData;
    currentAnswer?: AnswerData;
    isB008: boolean;
    answerChoices: { value: string; label: string; color: string }[];
    isExpandedGuidance: boolean;
    isExpandedNotes: boolean;
    saveStatus?: string;
    isEditable: boolean;
    onToggleGuidance: () => void;
    onToggleNotes: () => void;
    onSelectAnswer: (val: string) => void;
    onSaveNote: (note: string) => void;
    onSaveExtraValue: (val: string) => void;
    conflict?: ConflictData;
    onAcceptServerAnswer?: (serverAnswer: ConflictData['server_answer']) => void;
    onOverwriteAnswer?: (serverRowVersion: number) => void;
}) {
    const selectedAnswer = currentAnswer?.answer;
    const isLockedNA = !question.is_applicable;

    // Internal buffered inputs for notes & extra values with debounced autosave (NFR-1)
    const [noteBuffer, setNoteBuffer] = useState(currentAnswer?.note || '');
    const [extraBuffer, setExtraBuffer] = useState(currentAnswer?.extra_value || '');
    const noteDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const extraDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedNote = useRef(currentAnswer?.note || '');
    const lastSavedExtra = useRef(currentAnswer?.extra_value || '');

    useEffect(() => {
        setNoteBuffer(currentAnswer?.note || '');
        lastSavedNote.current = currentAnswer?.note || '';
    }, [currentAnswer?.note]);

    useEffect(() => {
        setExtraBuffer(currentAnswer?.extra_value || '');
        lastSavedExtra.current = currentAnswer?.extra_value || '';
    }, [currentAnswer?.extra_value]);

    const flushNote = useCallback(() => {
        if (noteDebounceTimer.current) clearTimeout(noteDebounceTimer.current);
        if (noteBuffer !== lastSavedNote.current) {
            lastSavedNote.current = noteBuffer;
            onSaveNote(noteBuffer);
        }
    }, [noteBuffer, onSaveNote]);

    const handleNoteChange = (val: string) => {
        setNoteBuffer(val);
        if (noteDebounceTimer.current) clearTimeout(noteDebounceTimer.current);
        noteDebounceTimer.current = setTimeout(() => {
            if (val !== lastSavedNote.current) {
                lastSavedNote.current = val;
                onSaveNote(val);
            }
        }, 1500);
    };

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

    const handleAnswerClick = (val: string) => {
        flushNote();
        flushExtra();
        onSelectAnswer(val);
    };

    useEffect(() => {
        return () => {
            if (noteDebounceTimer.current) clearTimeout(noteDebounceTimer.current);
            if (extraDebounceTimer.current) clearTimeout(extraDebounceTimer.current);
            if (noteBuffer !== lastSavedNote.current) {
                onSaveNote(noteBuffer);
            }
            if (extraBuffer !== lastSavedExtra.current) {
                onSaveExtraValue(extraBuffer);
            }
        };
    }, [noteBuffer, extraBuffer, onSaveNote, onSaveExtraValue]);

    const hasNote = Boolean(noteBuffer.trim() || currentAnswer?.note?.trim());

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
                                <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" /> Conflict
                            </span>
                        )}
                    </div>

                    {/* Extra input field if question asks for typed date/number/text */}
                    {question.input_type && question.input_type !== 'none' && (
                        <div className="pt-1 flex items-center gap-2 max-w-sm">
                            <Label className="text-xs text-muted-foreground shrink-0 capitalize">
                                {question.input_type}:
                            </Label>
                            <Input
                                type={question.input_type === 'date' ? 'date' : 'text'}
                                value={extraBuffer}
                                disabled={!isEditable || isLockedNA}
                                onChange={(e) => handleExtraChange(e.target.value)}
                                onBlur={flushExtra}
                                className="h-7 text-xs"
                                placeholder={`Enter ${question.input_type}...`}
                            />
                        </div>
                    )}
                </div>

                {/* Answer Choice Buttons & Quick Expanders */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    {/* Guidance button */}
                    {question.guidance && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onToggleGuidance}
                            className={`h-8 px-2 text-xs flex items-center gap-1 ${
                                isExpandedGuidance ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                            }`}
                            title="Expand inspection guidance / instruction notes"
                        >
                            <HelpCircle className="size-3.5" />
                            <span>Guidance</span>
                        </Button>
                    )}

                    {/* Note button */}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onToggleNotes}
                        className={`h-8 px-2 text-xs flex items-center gap-1 ${
                            hasNote || isExpandedNotes ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                        }`}
                        title="Add question note"
                    >
                        <MessageSquare className="size-3.5" />
                        <span>{hasNote ? 'Note' : '+ Note'}</span>
                    </Button>

                    {/* Answer Segmented Buttons */}
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
                </div>
            </div>

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

            {/* Expandable Note Input (Task 3.3 & 3.4) */}
            {(isExpandedNotes || hasNote) && (
                <div className="mt-3 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground">Inspector Note / Finding Details:</Label>
                    <textarea
                        rows={2}
                        value={noteBuffer}
                        disabled={!isEditable}
                        onChange={(e) => handleNoteChange(e.target.value)}
                        onBlur={flushNote}
                        placeholder="Add notes, context, or observation particulars..."
                        className="mt-1 w-full rounded border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
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
                                This answer was modified by <strong>{conflict.server_answer.answered_by_name || 'another user'}</strong> while you were editing.
                            </p>
                            <div className="rounded bg-background/80 p-2 border border-amber-200 dark:border-amber-900 text-[11px] space-y-0.5">
                                <div>
                                    <span className="text-muted-foreground font-medium">Server Value:</span>{' '}
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 px-1">
                                        {conflict.server_answer.answer || 'Unanswered'}
                                    </Badge>
                                    {conflict.server_answer.note ? ` — Note: "${conflict.server_answer.note}"` : ''}
                                    {conflict.server_answer.extra_value ? ` — Extra: "${conflict.server_answer.extra_value}"` : ''}
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
        </div>
    );
}
