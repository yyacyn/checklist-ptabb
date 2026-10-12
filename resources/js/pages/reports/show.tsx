import { Head, router } from '@inertiajs/react';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Loader2,
    MessageSquare,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    PhotoChapterSection,
    type PhotoCategoryItem,
    type PhotoRecord,
} from '@/components/photo-chapter-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    csrfHeaders,
    dequeueSave,
    enqueueSave,
    flushSaveQueue,
    generateClientSaveId,
    getPendingCount,
    type QueueSyncState,
} from '@/lib/autosave-queue';
import { formatDate } from '@/lib/question-utils';
import {
    GeneralInfoSection,
    ObservationsSection,
    QuestionAnswerCard,
    ReportChapterSidebar,
    ReportHeader,
} from '@/components/reports';
import type {
    AnswerData,
    ConflictData,
    FindingData,
    LockData,
    QuestionData,
    ReportData,
    SummarySchema,
} from '@/types';

// Re-export shared types and helpers for backward compatibility
export type {
    AnswerData,
    ChapterData,
    ConflictData,
    FindingData,
    LockData,
    QuestionData,
    ReportData,
    SubgroupData,
    SummarySchema,
    SummarySchemaRatingOption,
    SummarySchemaTextField,
} from './types';
export {
    buildQuestionInputType,
    formatDate,
    formatExtraDisplay,
    getQuestionInputMeta,
    parseQuestionInputType,
} from '@/lib/question-utils';

interface Props {
    report: ReportData;
    is_editable: boolean;
    can_submit?: boolean;
    initial_lock?: LockData | null;
    can_delete?: boolean;
    photo_categories?: PhotoCategoryItem[];
}

export default function ReportDataEntry({
    report,
    is_editable = true,
    can_submit = true,
    initial_lock = null,
    can_delete = false,
    photo_categories = [],
}: Props) {
    const [reportStatus, setReportStatus] = useState<string>(report.status);
    const canSubmit = Boolean(
        (reportStatus === 'draft' || reportStatus === 'in_progress') && (can_submit ?? is_editable)
    );

    // Advisory edit lock state (NFR-15)
    const [lockState, setLockState] = useState<LockData | null>(initial_lock);

    // Delete Draft state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteReport = () => {
        setIsDeleting(true);
        router.delete(`/reports/${report.id}`, {
            data: { delete_reason: deleteReason },
            onFinish: () => {
                setIsDeleting(false);
                setIsDeleteDialogOpen(false);
            },
        });
    };

    // Submit Report state (RLS-2, RLS-3, RLS-4)
    const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const handleSubmitReport = async () => {
        if (reportStatus !== 'draft' && reportStatus !== 'in_progress') {
            return;
        }
        setIsSubmittingReport(true);
        setSubmitError(null);
        try {
            await flushSaveQueue(report.id);

            const res = await fetch(`/reports/${report.id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                const msg = errData?.errors?.status?.[0] || errData?.message || 'Failed to submit report.';
                throw new Error(msg);
            }

            setReportStatus('submitted');
            report.status = 'submitted';
            setIsSubmitDialogOpen(false);
            router.visit(window.location.href, { replace: true });
        } catch (err: any) {
            console.error('Submit report error:', err);
            setSubmitError(err.message || 'Failed to submit report.');
        } finally {
            setIsSubmittingReport(false);
        }
    };

    // Question edit conflicts state (NFR-15): questionId -> ConflictData
    const [conflicts, setConflicts] = useState<Record<number, ConflictData>>({});

    const isPhotoForm = report.form.form_type === 'photo';

    // Current Active Chapter (0 = General Info, >0 = Form Groups, -999 = Summary, -888 = Photo Chapter)
    const [activeChapterId, setActiveChapterId] = useState<number>(() => {
        if (typeof window === 'undefined') return isPhotoForm ? -888 : 0;
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlChapter = urlParams.get('chapter');
            if (urlChapter !== null) {
                const parsed = parseInt(urlChapter, 10);
                if (!isNaN(parsed)) return parsed;
            }
            const saved = localStorage.getItem(`report_${report.id}_active_chapter`);
            if (saved !== null) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed)) return parsed;
            }
        } catch {
            // fallback
        }
        return isPhotoForm ? -888 : 0;
    });

    // Photographic Records state (Task 5.3)
    const [photos, setPhotos] = useState<PhotoRecord[]>(report.photos || []);

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
                    const extra = answers[q.id]?.extra_value;
                    const isPure = ['text_only', 'date_only'].includes(q.input_type);
                    if (ans || (isPure && extra && extra.trim().length > 0)) {
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

    const [findings, setFindings] = useState<FindingData[]>(report.findings || []);

    const handleAddFinding = async (data: Partial<FindingData>) => {
        const res = await fetch(`/reports/${report.id}/findings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...csrfHeaders(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const json = await res.json();
            setFindings((prev) => [...prev, json.finding]);
        }
    };

    const handleUpdateFinding = async (id: number, data: Partial<FindingData>) => {
        const res = await fetch(`/reports/${report.id}/findings/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...csrfHeaders(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const json = await res.json();
            setFindings((prev) => prev.map((f) => (f.id === id ? json.finding : f)));
        }
    };

    const handleDeleteFinding = async (id: number) => {
        const res = await fetch(`/reports/${report.id}/findings/${id}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                ...csrfHeaders(),
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        if (res.ok) {
            setFindings((prev) => prev.filter((f) => f.id !== id));
        }
    };

    const otherChapters = useMemo(
        () => report.groups.filter((g) => g.chapter_no !== '1' && g.title !== 'General Information'),
        [report.groups]
    );

    const summarySchema: SummarySchema = useMemo(() => {
        if (report.form.summary_schema) {
            return report.form.summary_schema;
        }
        return {
            enabled: !isPhotoForm,
            title: report.form.code === 'B-008' ? 'Audit Summary & NCRs' : 'Summary & Observations',
            has_ratings_matrix: report.form.code === 'D-062',
            has_findings_register: true,
        };
    }, [report.form.summary_schema, report.form.code, isPhotoForm]);

    const summaryChapterNo = String(otherChapters.length + 2);
    const summaryChapterTitle = summarySchema.title || 'Summary & Observations';

    const photoSchema = useMemo(() => {
        if (isPhotoForm && report.form.photo_schema) {
            return report.form.photo_schema;
        }
        return {
            enabled: false,
            title: 'Photographic Records',
            description: '',
        };
    }, [report.form.photo_schema, isPhotoForm]);

    const photoChapterTitle = photoSchema.title || 'Photographic Records';

    const navChapters = useMemo(() => {
        if (isPhotoForm) {
            return [
                {
                    id: -888,
                    title: photoChapterTitle,
                    chapter_no: '1',
                    sort_order: 1,
                },
            ];
        }

        const list = [
            { id: 0, title: 'General Information & Particulars', chapter_no: '1', sort_order: 1 },
            ...otherChapters,
        ];
        if (summarySchema.enabled !== false) {
            list.push({
                id: -999,
                title: summaryChapterTitle,
                chapter_no: summaryChapterNo,
                sort_order: list.length + 1,
            });
        }
        return list;
    }, [
        isPhotoForm,
        otherChapters,
        summarySchema,
        summaryChapterTitle,
        summaryChapterNo,
        photoChapterTitle,
    ]);

    const currentChapterIdx = navChapters.findIndex((c) => c.id === activeChapterId);
    const prevChapter = currentChapterIdx > 0 ? navChapters[currentChapterIdx - 1] : null;
    const nextChapter =
        currentChapterIdx >= 0 && currentChapterIdx < navChapters.length - 1
            ? navChapters[currentChapterIdx + 1]
            : null;

    const mainContentRef = useRef<HTMLElement | null>(null);

    // IndexedDB Offline Retry Queue & Autosave Engine State
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
                const res = await fetch(`/reports/${report.id}/lock`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...csrfHeaders(),
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
                fetch(`/reports/${report.id}/lock`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        ...csrfHeaders(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    keepalive: true,
                }).catch(() => {});
            }
        };
    }, [report.id, lockState?.is_owner]);

    // Save Answer with IndexedDB retry queue and conflict detection
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

        // Persist in IndexedDB retry queue first
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
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                const data = await res.json();
                await dequeueSave(clientSaveId);
                const remaining = await getPendingCount(report.id);
                setPendingQueueCount(remaining);
                setGlobalSyncState(remaining > 0 ? 'retrying' : 'saved');

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
            setSaveStatuses((prev) => ({ ...prev, [questionId]: 'retrying' }));
            setGlobalSyncState('retrying');
        }
    };

    // Conflict Resolution Handlers
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

    // Save Chapter Comments with debounce and flush on chapter change
    const commentsDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedComments = useRef<Record<number, string>>({});

    const saveChapterComments = async (chapterId: number, text: string) => {
        if (!is_editable) return;

        setCommentsSaveStatuses((prev) => ({ ...prev, [chapterId]: 'saving' }));

        try {
            const res = await fetch(`/reports/${report.id}/groups/${chapterId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
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

    const flushPendingComments = useCallback(
        async (chapterId: number) => {
            if (commentsDebounceTimer.current) {
                clearTimeout(commentsDebounceTimer.current);
                commentsDebounceTimer.current = null;
            }
            const text = chapterComments[chapterId] ?? '';
            if (text !== (lastSavedComments.current[chapterId] ?? '')) {
                lastSavedComments.current[chapterId] = text;
                await saveChapterComments(chapterId, text);
            }
        },
        [chapterComments]
    );

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
        if (activeChapterId !== 0) {
            await flushPendingComments(activeChapterId);
        }
        setActiveChapterId(targetChapterId);
        try {
            localStorage.setItem(`report_${report.id}_active_chapter`, String(targetChapterId));
            const url = new URL(window.location.href);
            url.searchParams.set('chapter', String(targetChapterId));
            window.history.replaceState(null, '', url.toString());
        } catch {
            // ignore
        }
        if (mainContentRef.current) {
            mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Keep URL in sync on mount / change
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.get('chapter') !== String(activeChapterId)) {
                url.searchParams.set('chapter', String(activeChapterId));
                window.history.replaceState(null, '', url.toString());
            }
        } catch {
            // ignore
        }
    }, [activeChapterId]);

    // Filter questions based on search & unanswered filter
    const filterQuestion = (q: QuestionData): boolean => {
        if (!q.is_applicable) return !showUnansweredOnly;

        if (showUnansweredOnly) {
            const ans = answers[q.id]?.answer;
            const extra = answers[q.id]?.extra_value;
            const isPure = ['text_only', 'date_only'].includes(q.input_type);
            if (ans || (isPure && extra && extra.trim().length > 0)) return false;
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

        if (isPhotoForm) {
            // Photo Form: progress is based on configured photo slots
            const slots = photoSchema.items || [];
            totalApplicable = slots.length;
            totalAnswered = slots.filter((slot, idx) => {
                const slotNo = idx + 1;
                return photos.some(
                    (p) =>
                        p.item_no === slotNo ||
                        (p.title && p.title.toLowerCase() === slot.title.toLowerCase())
                );
            }).length;

            // Freeform photo form fallback (no defined slots in template)
            if (totalApplicable === 0 && photos.length > 0) {
                totalApplicable = photos.length;
                totalAnswered = photos.length;
            }
        } else {
            // Standard Form: progress is based solely on question answers
            Object.values(chapterStats).forEach((s) => {
                totalApplicable += s.applicable;
                totalAnswered += s.answered;
            });
        }

        const percent = totalApplicable > 0 ? Math.round((totalAnswered / totalApplicable) * 100) : 0;
        return { totalApplicable, totalAnswered, percent };
    }, [chapterStats, isPhotoForm, photoSchema, photos]);

    return (
        <>
            <Head title={`Fill Report: ${report.reference_number}`} />

            <div className="flex h-screen flex-col overflow-hidden bg-background">
                {/* Top Sticky Header */}
                <ReportHeader
                    report={{ ...report, status: reportStatus }}
                    globalSyncState={globalSyncState}
                    isOffline={isOffline}
                    pendingQueueCount={pendingQueueCount}
                    isFlushingQueue={isFlushingQueue}
                    onTriggerManualQueueFlush={triggerManualQueueFlush}
                    overallStats={overallStats}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    showUnansweredOnly={showUnansweredOnly}
                    onToggleUnansweredOnly={() => setShowUnansweredOnly((prev) => !prev)}
                    canDelete={can_delete}
                    onDeleteClick={() => {
                        setDeleteReason('');
                        setIsDeleteDialogOpen(true);
                    }}
                    lockState={lockState}
                    onAcquireLock={acquireLock}
                    isEditable={is_editable}
                />

                {/* Main 2-Column Split: Sticky Sidebar (Left) + Current Group Form (Right) */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sticky Chapter Navigation Sidebar */}
                    <ReportChapterSidebar
                        isPhotoForm={isPhotoForm}
                        photoChapterTitle={photoChapterTitle}
                        photos={photos}
                        activeChapterId={activeChapterId}
                        onChapterSwitch={handleChapterSwitch}
                        groups={report.groups}
                        chapterStats={chapterStats}
                        summarySchema={summarySchema}
                        summaryChapterNo={summaryChapterNo}
                        summaryChapterTitle={summaryChapterTitle}
                        findings={findings}
                    />

                    {/* Right Main Content Area: General Information, Groups, Observations, or Photos */}
                    <main ref={mainContentRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                        {activeChapterId === -888 ? (
                            <div className="max-w-5xl mx-auto space-y-6">
                                <PhotoChapterSection
                                    reportId={report.id}
                                    title={photoChapterTitle}
                                    description={photoSchema.description}
                                    isPhotoForm={isPhotoForm}
                                    isEditable={is_editable}
                                    photos={photos}
                                    schemaItems={photoSchema.items || []}
                                    categories={photo_categories}
                                    allowedCategoryCodes={photoSchema.allowed_categories}
                                    onPhotosChange={setPhotos}
                                />
                                {prevChapter && (
                                    <div className="flex justify-between pt-2 pb-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleChapterSwitch(prevChapter.id)}
                                            className="flex items-center gap-2"
                                        >
                                            <ChevronLeft className="size-4" />
                                            <span>
                                                Prev:{' '}
                                                {prevChapter.chapter_no
                                                    ? `Chapter ${prevChapter.chapter_no} - ${prevChapter.title}`
                                                    : prevChapter.title}
                                            </span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : activeChapterId === 0 ? (
                            <GeneralInfoSection
                                report={report}
                                isEditable={is_editable}
                                attendanceSubgroup={report.groups
                                    .find((g) => g.chapter_no === '1' || g.title === 'General Information')
                                    ?.subgroups?.find((sg) => sg.title.toLowerCase().includes('attendance'))}
                                answers={answers}
                                isB008={isB008}
                                answerChoices={answerChoices}
                                expandedGuidance={expandedGuidance}
                                saveStatuses={saveStatuses}
                                conflicts={conflicts}
                                nextChapter={nextChapter}
                                onChapterSwitch={handleChapterSwitch}
                                onToggleGuidance={(qid) =>
                                    setExpandedGuidance((prev) => ({
                                        ...prev,
                                        [qid]: !prev[qid],
                                    }))
                                }
                                onSelectAnswer={(qid, val) => saveAnswerToServer(qid, { answer: val })}
                                onSaveExtraValue={(qid, val) => saveAnswerToServer(qid, { extra_value: val })}
                                onAcceptServerAnswer={handleAcceptServerAnswer}
                                onOverwriteAnswer={handleOverwriteAnswer}
                                filterQuestion={filterQuestion}
                                reportPhotos={photos}
                                onPhotosUpdated={setPhotos}
                                photoCategories={photo_categories}
                            />
                        ) : activeChapterId === -999 || activeChapterId === -15 ? (
                            <ObservationsSection
                                report={report}
                                isEditable={is_editable}
                                findings={findings}
                                chapterStats={chapterStats}
                                onAddFinding={handleAddFinding}
                                onUpdateFinding={handleUpdateFinding}
                                onDeleteFinding={handleDeleteFinding}
                                prevChapter={prevChapter}
                                nextChapter={nextChapter}
                                onChapterSwitch={handleChapterSwitch}
                                reportPhotos={photos}
                                onPhotosUpdated={setPhotos}
                                photoCategories={photo_categories}
                            />
                        ) : activeChapter ? (
                            <div className="max-w-4xl mx-auto space-y-6">
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
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                                {activeChapter.title}
                                            </h1>
                                            {prevChapter && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleChapterSwitch(prevChapter.id)}
                                                    className="h-7 px-2.5 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                                >
                                                    <ChevronLeft className="size-3.5" />
                                                    <span>Previous</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Direct Chapter Questions (if any) */}
                                {activeChapter.questions && activeChapter.questions.length > 0 && (
                                    <div className="space-y-3">
                                        {activeChapter.questions.filter(filterQuestion).map((q) => (
                                            <QuestionAnswerCard
                                                key={q.id}
                                                reportId={report.id}
                                                question={q}
                                                currentAnswer={answers[q.id]}
                                                isB008={isB008}
                                                answerChoices={answerChoices}
                                                isExpandedGuidance={Boolean(expandedGuidance[q.id])}
                                                saveStatus={saveStatuses[q.id]}
                                                isEditable={is_editable}
                                                onToggleGuidance={() =>
                                                    setExpandedGuidance((prev) => ({
                                                        ...prev,
                                                        [q.id]: !prev[q.id],
                                                    }))
                                                }
                                                onSelectAnswer={(val) => saveAnswerToServer(q.id, { answer: val })}
                                                onSaveExtraValue={(val) =>
                                                    saveAnswerToServer(q.id, { extra_value: val })
                                                }
                                                conflict={conflicts[q.id]}
                                                onAcceptServerAnswer={(srv) => handleAcceptServerAnswer(q.id, srv)}
                                                onOverwriteAnswer={(srvVer) => handleOverwriteAnswer(q.id, srvVer)}
                                                reportPhotos={photos}
                                                onPhotosUpdated={setPhotos}
                                                photoCategories={photo_categories}
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
                                                                reportId={report.id}
                                                                question={q}
                                                                currentAnswer={answers[q.id]}
                                                                isB008={isB008}
                                                                answerChoices={answerChoices}
                                                                isExpandedGuidance={Boolean(expandedGuidance[q.id])}
                                                                saveStatus={saveStatuses[q.id]}
                                                                isEditable={is_editable}
                                                                onToggleGuidance={() =>
                                                                    setExpandedGuidance((prev) => ({
                                                                        ...prev,
                                                                        [q.id]: !prev[q.id],
                                                                    }))
                                                                }
                                                                onSelectAnswer={(val) =>
                                                                    saveAnswerToServer(q.id, { answer: val })
                                                                }
                                                                onSaveExtraValue={(val) =>
                                                                    saveAnswerToServer(q.id, { extra_value: val })
                                                                }
                                                                conflict={conflicts[q.id]}
                                                                onAcceptServerAnswer={(srv) =>
                                                                    handleAcceptServerAnswer(q.id, srv)
                                                                }
                                                                onOverwriteAnswer={(srvVer) =>
                                                                    handleOverwriteAnswer(q.id, srvVer)
                                                                }
                                                                reportPhotos={photos}
                                                                onPhotosUpdated={setPhotos}
                                                                photoCategories={photo_categories}
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

                                {/* Next Chapter Navigation */}
                                {nextChapter && (
                                    <div className="flex justify-end pt-1 pb-4">
                                        <Button
                                            type="button"
                                            onClick={() => handleChapterSwitch(nextChapter.id)}
                                            className="flex items-center gap-2 font-medium"
                                        >
                                            <span>
                                                Next:{' '}
                                                {nextChapter.chapter_no
                                                    ? `Chapter ${nextChapter.chapter_no} - ${nextChapter.title}`
                                                    : nextChapter.title}
                                            </span>
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">Select a chapter from the sidebar.</div>
                        )}
                    </main>
                </div>
            </div>

            {/* 100% Completion Floating Bar - Summoned dynamically anywhere when progress reaches 100% */}
            {canSubmit && overallStats.percent === 100 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-card/95 backdrop-blur-md border-2 border-emerald-500/30 text-card-foreground shadow-2xl rounded-full pl-5 pr-3 py-2 flex items-center gap-4 ring-1 ring-emerald-500/20">
                        <div className="flex items-center gap-2.5">
                            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                <Check className="size-4 stroke-[3]" />
                            </span>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold leading-tight text-foreground flex items-center gap-1.5">
                                    100% Completed
                                    <span className="text-[10px] font-normal text-muted-foreground hidden sm:inline">
                                        ({overallStats.totalAnswered} of {overallStats.totalApplicable} items)
                                    </span>
                                </span>
                                <span className="text-[11px] text-muted-foreground leading-tight hidden xs:inline">
                                    All requirements satisfied
                                </span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => {
                                setSubmitError(null);
                                setIsSubmitDialogOpen(true);
                            }}
                            disabled={isSubmittingReport}
                            className="h-8 rounded-full px-4 text-xs font-semibold gap-1.5 shadow-xs"
                        >
                            {isSubmittingReport ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : null}
                            <span>Finish & Submit</span>
                        </Button>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog for Deleting Draft */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Draft Report</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete draft report{' '}
                            <span className="font-semibold text-foreground">{report.reference_number}</span> (
                            {report.vessel_name})? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-2">
                        <Label htmlFor="delete-reason-detail" className="text-xs">
                            Reason for deletion (optional)
                        </Label>
                        <Input
                            id="delete-reason-detail"
                            placeholder="e.g. Created by mistake / duplicated"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            disabled={isDeleting}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={isDeleting}
                            onClick={handleDeleteReport}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Draft'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation / Guard Dialog for Submitting Report (RLS-2, RLS-3, RLS-4) */}
            <Dialog open={isSubmitDialogOpen} onOpenChange={(open) => !open && !isSubmittingReport && setIsSubmitDialogOpen(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {overallStats.percent === 100 ? 'Finish & Submit Report' : 'Report Incomplete'}
                        </DialogTitle>
                        <DialogDescription>
                            {overallStats.percent === 100 ? (
                                <>
                                    Are you sure you want to finalize and submit report{' '}
                                    <span className="font-semibold text-foreground">{report.reference_number}</span> (
                                    {report.vessel_name})?
                                </>
                            ) : (
                                <>
                                    This report cannot be submitted yet because it has not reached 100% completion.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {overallStats.percent === 100 ? (
                        <div className="py-2 text-xs text-muted-foreground space-y-2">
                            <p>
                                All items ({overallStats.totalAnswered}/{overallStats.totalApplicable}) have been completed.
                            </p>
                            <p>
                                Once submitted, the report will transition to <strong>Submitted</strong> status, editing will be locked, and photographic records will be frozen for corporate review (RLS-2, RLS-4).
                            </p>
                            {submitError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    {submitError}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-2 text-xs text-muted-foreground space-y-2">
                            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                                <strong>Progress: {overallStats.totalAnswered} of {overallStats.totalApplicable} items completed ({overallStats.percent}%).</strong>
                            </div>
                            <p>
                                Rule RLS-2 requires every applicable checklist question and required photo slot to be answered, uploaded, or marked NS/NA before submission.
                            </p>
                            {submitError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                                    {submitError}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsSubmitDialogOpen(false)}
                            disabled={isSubmittingReport}
                        >
                            {overallStats.percent === 100 ? 'Cancel' : 'Close'}
                        </Button>
                        {overallStats.percent === 100 && (
                            <Button
                                type="button"
                                variant="default"
                                className="gap-1.5 font-semibold"
                                disabled={isSubmittingReport}
                                onClick={handleSubmitReport}
                            >
                                {isSubmittingReport ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Confirm & Submit'
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
