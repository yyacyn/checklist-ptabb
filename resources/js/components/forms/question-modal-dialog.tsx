import { router } from '@inertiajs/react';
import { Calendar, FileText, Paperclip } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { buildQuestionInputType, parseQuestionInputType } from '@/lib/question-utils';
import type { FormQuestionData } from './types';

export interface QuestionModalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingQuestion: FormQuestionData | null;
    groupId: number | null;
}

export function QuestionModalDialog({
    open,
    onOpenChange,
    editingQuestion,
    groupId,
}: QuestionModalDialogProps) {
    const [questionText, setQuestionText] = useState('');
    const [questionGuidance, setQuestionGuidance] = useState('');
    const [hasChoices, setHasChoices] = useState(true);
    const [hasText, setHasText] = useState(false);
    const [hasDate, setHasDate] = useState(false);
    const [hasFile, setHasFile] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            if (editingQuestion) {
                setQuestionText(editingQuestion.question_text);
                setQuestionGuidance(editingQuestion.guidance || '');
                const flags = parseQuestionInputType(editingQuestion.input_type);
                setHasChoices(flags.hasChoices);
                setHasText(flags.hasText);
                setHasDate(flags.hasDate);
                setHasFile(flags.hasFile);
            } else {
                setQuestionText('');
                setQuestionGuidance('');
                setHasChoices(true);
                setHasText(false);
                setHasDate(false);
                setHasFile(false);
            }
        }
    }, [open, editingQuestion]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const inputType = buildQuestionInputType({
            hasChoices,
            hasText,
            hasDate,
            hasFile,
        });

        if (editingQuestion) {
            router.put(
                `/admin/questions/${editingQuestion.id}`,
                {
                    question_text: questionText,
                    guidance: questionGuidance || null,
                    input_type: inputType,
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
        } else if (groupId) {
            router.post(
                `/admin/groups/${groupId}/questions`,
                {
                    question_text: questionText,
                    guidance: questionGuidance || null,
                    input_type: inputType,
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
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="dlg_q_text">Question Text</Label>
                        <textarea
                            id="dlg_q_text"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={3}
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Enter the question text..."
                            required
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="dlg_q_guidance">Guidance Text / Bracketed Help (Optional)</Label>
                        <textarea
                            id="dlg_q_guidance"
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={2}
                            value={questionGuidance}
                            onChange={(e) => setQuestionGuidance(e.target.value)}
                            placeholder="Expandable help text for the inspector"
                        />
                    </div>

                    {/* Response & Input Capabilities */}
                    <div className="space-y-3 rounded-lg border p-3.5 bg-muted/20">
                        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">
                            Response & Input Capabilities
                        </Label>

                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5 pb-2.5 border-b">
                                <input
                                    type="checkbox"
                                    id="dlg_chk_choices"
                                    checked={hasChoices}
                                    onChange={(e) => setHasChoices(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <Label htmlFor="dlg_chk_choices" className="cursor-pointer text-sm font-semibold">
                                    Standard Choices (Yes / No / NS / NA buttons)
                                </Label>
                            </div>

                            <Label className="text-xs text-muted-foreground font-medium block pt-0.5">
                                Input Fields (Check all that apply)
                            </Label>

                            <div className="space-y-2 pl-0.5">
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_text"
                                        checked={hasText}
                                        onChange={(e) => setHasText(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label
                                        htmlFor="dlg_chk_text"
                                        className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5"
                                    >
                                        <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>Text / Remarks Input (notes, explanation)</span>
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_date"
                                        checked={hasDate}
                                        onChange={(e) => setHasDate(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label
                                        htmlFor="dlg_chk_date"
                                        className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5"
                                    >
                                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>Date Input (calendar date picker)</span>
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        id="dlg_chk_file"
                                        checked={hasFile}
                                        onChange={(e) => setHasFile(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label
                                        htmlFor="dlg_chk_file"
                                        className="cursor-pointer text-xs font-normal text-foreground flex items-center gap-1.5"
                                    >
                                        <Paperclip className="size-3.5 text-muted-foreground shrink-0" />
                                        <span>File / Attachment Input (document scan, certificate, photo)</span>
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-3">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Question'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
