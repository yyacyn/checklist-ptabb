/**
 * Shared Question Input Type and Formatting Utilities
 * Used across Form Template Builder (forms/show.tsx) and Report Data Entry (reports/show.tsx)
 */

export interface QuestionInputFlags {
    hasChoices: boolean;
    hasText: boolean;
    hasDate: boolean;
    hasFile: boolean;
}

export function parseQuestionInputType(inputType: string): QuestionInputFlags {
    const raw = (inputType || 'none').toLowerCase().trim();
    if (raw === 'none') {
        return { hasChoices: true, hasText: false, hasDate: false, hasFile: false };
    }
    const tokens = raw.split(',').map((t) => t.trim());
    const isPureOnly = tokens.some((t) => t.endsWith('_only'));
    const hasChoices = !isPureOnly && !tokens.includes('no_choices');

    return {
        hasChoices,
        hasText: tokens.includes('text') || tokens.includes('text_only'),
        hasDate: tokens.includes('date') || tokens.includes('date_only'),
        hasFile: tokens.includes('file') || tokens.includes('file_only'),
    };
}

export function buildQuestionInputType(flags: QuestionInputFlags): string {
    const types: string[] = [];
    if (flags.hasText) types.push('text');
    if (flags.hasDate) types.push('date');
    if (flags.hasFile) types.push('file');

    if (flags.hasChoices) {
        if (types.length === 0) return 'none';
        return types.join(',');
    } else {
        if (types.length === 0) return 'text_only';
        return types.map((t) => `${t}_only`).join(',');
    }
}

export function getQuestionInputMeta(question: { question_text?: string; input_type?: string }): {
    label: string;
    placeholder: string;
} {
    const text = (question.question_text || '').toUpperCase();

    if (text.includes('SAFETY MEETING HELD ONBOARD')) {
        return { label: 'IF NO EXPLAIN REASON:', placeholder: 'Explain reason if No...' };
    }
    if (text.includes('SAFETY DRILL CONDUCTED ONBOARD') || text.includes('SAFETY DRILL CONDUCTED')) {
        return { label: 'IF YES SPECIFY TYPE:', placeholder: 'Specify drill type if Yes...' };
    }
    if (text.includes('TRAINING SEMINAR')) {
        return { label: 'IF YES SPECIFY TYPE:', placeholder: 'Specify training seminar type if Yes...' };
    }
    if (text.includes('PMS TRAINING PROVIDED')) {
        return { label: 'PROVIDE DETAILS:', placeholder: 'Provide PMS training details...' };
    }
    if (text.includes('PMS RECORDS COMPARED')) {
        return { label: 'COMMENTS (IF ANY):', placeholder: 'Enter comments if any...' };
    }
    if (text.includes('CRITICAL EQUIPMENT TESTED')) {
        return { label: 'PROVIDE DETAILS:', placeholder: 'Provide details of critical equipment tested...' };
    }
    if (text.includes('WORK/REST HOURS RECORDS')) {
        return { label: 'COMMENTS (IF ANY):', placeholder: 'Enter comments if any...' };
    }
    if (text.includes('RISK ASSESSMENTS REVIEWED')) {
        return { label: 'COMMENTS (IF ANY):', placeholder: 'Enter comments if any...' };
    }
    if (text.includes('NEAR MISSES')) {
        return { label: 'COMMENTS (IF ANY):', placeholder: 'Enter comments if any...' };
    }
    if (text.includes('APPRAISALS FOR CREW')) {
        return {
            label: 'PROVIDE DETAILS (INCL. IDENTIFIED TRAINING NEEDS, IF ANY):',
            placeholder: 'Provide details (incl. identified training needs)...',
        };
    }
    if (text.includes('VERIFICATION OF PENDING WORKS')) {
        return {
            label: 'PROVIDE FURTHER COMMENTS (IF ANY FURTHER FOLLOW-UP IS NEEDED):',
            placeholder: 'Provide further comments / follow-up...',
        };
    }

    if (question.input_type === 'date' || question.input_type === 'date_only') {
        return { label: 'DATE:', placeholder: 'Select date...' };
    }
    if (question.input_type === 'file' || question.input_type === 'file_only') {
        return {
            label: 'ATTACHMENT / FILE REFERENCE:',
            placeholder: 'Enter file name, document ID, or upload reference...',
        };
    }
    return { label: 'COMMENTS / DETAILS:', placeholder: 'Enter details...' };
}

export function formatExtraDisplay(raw: string): string {
    if (!raw) return '';
    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw) as Record<string, string>;
            return Object.entries(parsed)
                .filter(([_, v]) => Boolean(v))
                .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
                .join(', ');
        } catch {
            return raw;
        }
    }
    return raw;
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
}
