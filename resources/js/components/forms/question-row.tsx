import {
    ArrowDown,
    ArrowUp,
    CheckSquare,
    Copy,
    Edit2,
    Eye,
    EyeOff,
    Filter,
    HelpCircle,
    History,
    MoreHorizontal,
    Square,
    Trash2,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FormQuestionData, FormVesselTypeItem } from './types';

export interface QuestionRowProps {
    question: FormQuestionData;
    vesselTypes: FormVesselTypeItem[];
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: () => void;
    onToggleGuidance: () => void;
    onEdit: () => void;
    onApplicability: () => void;
    onHistory: () => void;
    onReorder: (dir: 'up' | 'down') => void;
    onToggle: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export function QuestionRow({
    question,
    vesselTypes,
    isSelected,
    isExpanded,
    onSelect,
    onToggleGuidance,
    onEdit,
    onApplicability,
    onHistory,
    onReorder,
    onToggle,
    onDuplicate,
    onDelete,
}: QuestionRowProps) {
    return (
        <div
            className={`flex flex-col gap-1 rounded border p-2.5 transition-colors ${
                !question.is_enabled
                    ? 'opacity-50 bg-muted/30'
                    : 'bg-background hover:bg-muted/10'
            } ${isSelected ? 'ring-2 ring-primary' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1">
                    <button
                        type="button"
                        onClick={onSelect}
                        className="mt-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                        {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                        ) : (
                            <Square className="size-4" />
                        )}
                    </button>

                    <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm text-foreground">{question.question_text}</span>
                            {!question.is_enabled && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                    Disabled
                                </Badge>
                            )}
                            {question.input_type !== 'none' && (
                                <div className="inline-flex items-center gap-1 flex-wrap">
                                    {question.input_type.split(',').map((typeToken) => (
                                        <Badge
                                            key={typeToken}
                                            variant="secondary"
                                            className="text-[10px] font-mono uppercase px-1.5 py-0"
                                        >
                                            {typeToken.replace(/_/g, ' ')}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {question.ice_class_only && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    Ice Class
                                </Badge>
                            )}
                            {(question.vessel_type_ids || []).length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {(vesselTypes || [])
                                        .filter((vt) => (question.vessel_type_ids || []).includes(vt.id))
                                        .map((vt) => vt.name)
                                        .join('/')}
                                </Badge>
                            )}
                            {question.guidance && (
                                <button
                                    type="button"
                                    onClick={onToggleGuidance}
                                    className="text-muted-foreground hover:text-foreground inline-flex items-center cursor-pointer"
                                    title="Toggle Guidance"
                                >
                                    <HelpCircle className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {isExpanded && question.guidance && (
                            <div className="mt-1.5 rounded bg-muted/60 p-2 text-xs text-muted-foreground">
                                <strong>Guidance:</strong> {question.guidance}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title={question.is_enabled ? 'Disable' : 'Enable'}
                        onClick={onToggle}
                    >
                        {question.is_enabled ? (
                            <Eye className="size-3.5" />
                        ) : (
                            <EyeOff className="size-3.5 text-muted-foreground" />
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Edit"
                        onClick={onEdit}
                    >
                        <Edit2 className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="More Actions"
                            >
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onReorder('up')} className="cursor-pointer">
                                <ArrowUp className="size-3.5 mr-2" /> Move Up
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReorder('down')} className="cursor-pointer">
                                <ArrowDown className="size-3.5 mr-2" /> Move Down
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onApplicability} className="cursor-pointer">
                                <Filter className="size-3.5 mr-2" /> Applicability
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDuplicate} className="cursor-pointer">
                                <Copy className="size-3.5 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onHistory} className="cursor-pointer">
                                <History className="size-3.5 mr-2" /> Change History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive cursor-pointer"
                                onClick={onDelete}
                            >
                                <Trash2 className="size-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
