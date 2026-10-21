export type AiDraftStatus = 'none' | 'draft' | 'applied';

export type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  ai_content: string | null;
  ai_status: AiDraftStatus;
  is_archived: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type NoteInsert = {
  id?: string;
  title?: string;
  content?: string;
  ai_content?: string | null;
  ai_status?: AiDraftStatus;
  is_archived?: boolean;
  is_pinned?: boolean;
  deleted_at?: string | null;
};

export type NoteUpdate = Partial<NoteInsert>;

export type TagRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type TagInsert = {
  id?: string;
  name: string;
};

export type NoteTagRow = {
  note_id: string;
  tag_id: string;
  user_id: string;
  source: 'user' | 'ai';
  created_at: string;
};

export type NoteTagInsert = {
  note_id: string;
  tag_id: string;
  source: 'user' | 'ai';
};

export type NoteLinkRow = {
  id: string;
  user_id: string;
  note_a: string;
  note_b: string;
  status: 'suggested' | 'accepted' | 'rejected';
  source: 'ai' | 'user';
  reason: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteAttachmentRow = {
  id: string;
  user_id: string;
  note_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
};

export type NoteAttachmentInsert = {
  id?: string;
  note_id: string;
  storage_path: string;
  file_name?: string | null;
  mime_type?: string | null;
};

export type RelatedNoteRow = {
  note_id: string;
  title: string;
  shared_tag_count: number;
  shared_tags: string[];
};

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      notes: Table<NoteRow, NoteInsert, NoteUpdate>;
      tags: Table<TagRow, TagInsert>;
      note_tags: Table<NoteTagRow, NoteTagInsert>;
      note_links: Table<NoteLinkRow, Partial<NoteLinkRow>>;
      note_attachments: Table<NoteAttachmentRow, NoteAttachmentInsert>;
    };
    Views: Record<string, never>;
    Functions: {
      moa_search_notes: {
        Args: { p_query: string; p_limit?: number };
        Returns: NoteRow[];
      };
      moa_related_notes: {
        Args: { p_note_id: string; p_limit?: number };
        Returns: RelatedNoteRow[];
      };
      moa_upsert_note_link: {
        Args: {
          p_note_1: string;
          p_note_2: string;
          p_status?: string;
          p_source?: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      moa_apply_ai_draft: {
        Args: { p_note_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
