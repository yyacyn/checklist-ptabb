import { Head, Link } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    HelpCircle,
    Info,
    MessageSquare,
    Save,
    Search,
    Ship,
    SlidersHorizontal,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}

export default function ReportDataEntry({ report, is_editable = true }: Props) {
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

    // Save Answer (Task 3.3 & 3.4 API request)
    const saveAnswerToServer = async (
        questionId: number,
        updatedFields: Partial<AnswerData>
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

        // Update local state immediately
        setAnswers((prev) => ({
            ...prev,
            [questionId]: newAnswerData,
        }));

        setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saving' }));

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const res = await fetch(`/reports/${report.id}/questions/${questionId}/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    answer: newAnswerData.answer,
                    note: newAnswerData.note,
                    extra_value: newAnswerData.extra_value,
                    client_save_id: `cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setAnswers((prev) => ({
                    ...prev,
                    [questionId]: { ...newAnswerData, ...data.answer },
                }));
                setSaveStatuses((prev) => ({ ...prev, [questionId]: 'saved' }));
                setTimeout(() => {
                    setSaveStatuses((prev) => {
                        const copy = { ...prev };
                        delete copy[questionId];
                        return copy;
                    });
                }, 2000);
            } else {
                setSaveStatuses((prev) => ({ ...prev, [questionId]: 'error' }));
            }
        } catch {
            setSaveStatuses((prev) => ({ ...prev, [questionId]: 'error' }));
        }
    };

    // Save Chapter Comments (Task 3.8)
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

                        {/* Overall Progress Bar & Filter Controls */}
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="w-36 h-2.5 rounded-full bg-muted overflow-hidden">
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
                            <div className="relative w-48">
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
                                    onClick={() => setActiveChapterId(group.id)}
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
                                                setChapterComments((prev) => ({
                                                    ...prev,
                                                    [activeChapter.id]: e.target.value,
                                                }))
                                            }
                                            onBlur={(e) => saveChapterComments(activeChapter.id, e.target.value)}
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

// Subcomponent: Individual Question Answer Row (Task 3.3)
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
}) {
    const selectedAnswer = currentAnswer?.answer;
    const hasNote = Boolean(currentAnswer?.note?.trim());
    const isLockedNA = !question.is_applicable;

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
                            <span className="text-[10px] text-amber-500 animate-pulse">Saving...</span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                                <Check className="size-3" /> Saved
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-[10px] text-rose-600 flex items-center gap-0.5">
                                <AlertCircle className="size-3" /> Save failed
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
                                defaultValue={currentAnswer?.extra_value || ''}
                                disabled={!isEditable || isLockedNA}
                                onBlur={(e) => onSaveExtraValue(e.target.value)}
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
                                    onClick={() => onSelectAnswer(choice.value)}
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

            {/* Expandable Note Input (Task 3.3) */}
            {(isExpandedNotes || hasNote) && (
                <div className="mt-3 pt-2 border-t border-border/50">
                    <Label className="text-xs text-muted-foreground">Inspector Note / Finding Details:</Label>
                    <textarea
                        rows={2}
                        defaultValue={currentAnswer?.note || ''}
                        disabled={!isEditable}
                        onBlur={(e) => onSaveNote(e.target.value)}
                        placeholder="Add notes, context, or observation particulars..."
                        className="mt-1 w-full rounded border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                </div>
            )}
        </div>
    );
}
