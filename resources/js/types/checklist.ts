import type {
    FindingOptionItem,
    PhotoCategoryItem,
    PhotoRecord,
    QuestionOptionItem,
} from '@/components/photo-chapter-section';

export type { FindingOptionItem, PhotoCategoryItem, PhotoRecord, QuestionOptionItem };

export interface PhotoFormItem {
    id?: string;
    title: string;
    description?: string;
}

export interface PhotoSchema {
    enabled: boolean;
    title?: string;
    description?: string;
    attached_form_id?: number | null;
    items?: PhotoFormItem[];
    allowed_categories?: string[];
}

export interface SummarySchemaTextField {
    key: string;
    label: string;
    placeholder?: string;
    rows?: number;
    span?: 'full' | 'half';
    description?: string;
}

export interface SummarySchemaRatingOption {
    value: string;
    label: string;
    color?: string;
}

export interface SummarySchema {
    enabled: boolean;
    title?: string;
    has_ratings_matrix?: boolean;
    rating_options?: SummarySchemaRatingOption[];
    text_fields?: SummarySchemaTextField[];
    has_findings_register?: boolean;
}

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

export interface FindingData {
    id: number;
    report_id: number;
    report_group_id?: number | null;
    report_question_id?: number | null;
    chapter_label?: string | null;
    finding_kind: 'observation' | 'non_conformity';
    risk?: 'high' | 'medium' | 'low' | null;
    severity?: string | null;
    description: string;
    viq_paragraph?: string | null;
    job_order_no?: string | null;
    target_date?: string | null;
    finding_status: string;
    sort_order?: number;
    created_at?: string;
    updated_at?: string;
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
    port: string | null;
    inspected_by: string | null;
    sailing_with_vessel: boolean;
    sailing_from: string | null;
    sailing_to: string | null;
    psc_last_port: string | null;
    psc_last_date: string | null;
    psc_detained_or_deficiencies: boolean | null;
    drydock_last_date: string | null;
    drydock_next_date: string | null;
    operations: string[] | null;
    master_name: string | null;
    chief_engineer_name: string | null;
    chief_officer_name: string | null;
    form: {
        id: number;
        code: string;
        name: string;
        answer_set: string;
        form_type?: 'standard' | 'photo';
        summary_schema?: SummarySchema | null;
        photo_schema?: PhotoSchema | null;
    };
    vessel_type?: {
        id: number;
        name: string;
    } | null;
    groups: ChapterData[];
    findings?: FindingData[];
    photos?: PhotoRecord[];
    summary_ratings?: Record<string, 'very_good' | 'satisfactory' | 'unsatisfactory'> | null;
    summary_comments_no?: string | null;
    summary_safety_meetings?: string | null;
    summary_participants?: string | null;
    summary_concept_understanding?: string | null;
    summary_data?: Record<string, string> | null;
    linked_photo_report_id?: number | null;
    linked_photo_report?: {
        id: number;
        reference_number: string;
        vessel_name: string;
        report_date: string | null;
        status: string;
        form?: {
            id: number;
            code: string;
            name: string;
            form_type?: string;
        } | null;
    } | null;
}

export interface AvailablePhotoReport {
    id: number;
    reference_number: string;
    vessel_name: string;
    report_date: string | null;
    status: string;
    form_code?: string;
    form_name?: string;
    form_type?: 'standard' | 'photo';
    photos_count: number;
    preview_photos: Array<{
        id: number;
        title: string | null;
        thumbnail_url?: string;
    }>;
}
