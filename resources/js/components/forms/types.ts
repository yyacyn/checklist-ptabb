import type {
    PhotoCategoryItem,
    PhotoFormItem,
    PhotoSchema,
    SummarySchema,
    SummarySchemaRatingOption,
    SummarySchemaTextField,
} from '@/types';

export interface FormQuestionData {
    id: number;
    group_id: number;
    question_text: string;
    guidance: string | null;
    input_type: string;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only: boolean;
    vessel_type_ids: number[];
    reports_count: number;
}

export interface FormGroupData {
    id: number;
    parent_id?: number | null;
    title: string;
    chapter_no: string | null;
    sort_order: number;
    is_enabled: boolean;
    ice_class_only: boolean;
    vessel_type_ids: number[];
    reports_count: number;
    questions: FormQuestionData[];
    subgroups?: FormGroupData[];
}

export interface FormVesselTypeItem {
    id: number;
    name: string;
}

export interface FormGroupOption {
    id: number;
    title: string;
    parent_id: number | null;
}

export interface FormHistoryItem {
    id: number;
    action: string;
    field: string | null;
    before_value: string | null;
    after_value: string | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        role: string;
    } | null;
}

export interface PhotoFormOption {
    id: number;
    code: string;
    name: string;
    photo_schema?: PhotoSchema | null;
    form_version?: string;
    template_version?: number;
}

export type {
    PhotoCategoryItem,
    PhotoFormItem,
    PhotoSchema,
    SummarySchema,
    SummarySchemaRatingOption,
    SummarySchemaTextField,
};
