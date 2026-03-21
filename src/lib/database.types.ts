export interface Database {
  public: {
    Tables: {
      team_members: {
        Row: {
          id: string;
          name: string;
          initials: string;
          role: string;
          function: string | null;
          created_at: string;
        };
        Insert: Omit<TeamMemberRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<TeamMemberRow>;
      };
      projects: {
        Row: ProjectRow;
        Insert: Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<ProjectRow>;
      };
      project_assignments: {
        Row: { id: string; project_id: string; team_member_id: string };
        Insert: { project_id: string; team_member_id: string };
        Update: Partial<{ project_id: string; team_member_id: string }>;
      };
      tasks: {
        Row: TaskRow;
        Insert: Omit<TaskRow, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<TaskRow>;
      };
      subtasks: {
        Row: SubtaskRow;
        Insert: Omit<SubtaskRow, 'id'> & { id?: string };
        Update: Partial<SubtaskRow>;
      };
      vendors: {
        Row: VendorRow;
        Insert: Omit<VendorRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<VendorRow>;
      };
      call_notes: {
        Row: CallNoteRow;
        Insert: Omit<CallNoteRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<CallNoteRow>;
      };
      extracted_actions: {
        Row: ExtractedActionRow;
        Insert: Omit<ExtractedActionRow, 'id'> & { id?: string };
        Update: Partial<ExtractedActionRow>;
      };
      template_tasks: {
        Row: TemplateTaskRow;
        Insert: Omit<TemplateTaskRow, 'id' | 'created_at'> & { id?: string };
        Update: Partial<TemplateTaskRow>;
      };
      project_files: {
        Row: ProjectFileRow;
        Insert: Omit<ProjectFileRow, 'id' | 'uploaded_at'> & { id?: string };
        Update: Partial<ProjectFileRow>;
      };
    };
  };
}

export interface TeamMemberRow {
  id: string;
  name: string;
  initials: string;
  role: string;
  function: string | null;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  slug: string | null;
  type: 'client' | 'shoot' | 'proposal';
  name: string;
  status: 'active' | 'completed' | 'archived';
  event_date: string | null;
  contract_signed_date: string | null;
  color: string;
  concept: string | null;
  service_tier: string | null;
  client1_name: string | null;
  client2_name: string | null;
  client1_email: string | null;
  client2_email: string | null;
  client1_phone: string | null;
  client2_phone: string | null;
  venue_name: string | null;
  venue_location: string | null;
  venue_street: string | null;
  venue_city_state_zip: string | null;
  client_street: string | null;
  client_city_state_zip: string | null;
  guest_count: number | null;
  estimated_budget: string | null;
  photographer: string | null;
  florist: string | null;
  location: string | null;
  location_street: string | null;
  location_city_state_zip: string | null;
  design_board_link: string | null;
  canva_link: string | null;
  internal_file_share: string | null;
  client_shared_folder: string | null;
  client_portal_link: string | null;
  client_website: string | null;
  sharepoint_folder: string | null;
  project_colors: string[] | null;
  next_call_agenda: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  project_id: string;
  text: string;
  completed: boolean;
  status: 'in_progress' | 'delayed' | 'completed' | null;
  due_date: string | null;
  category: string | null;
  assigned_to: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  notes: string | null;
  function_roles: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SubtaskRow {
  id: string;
  task_id: string;
  text: string;
  completed: boolean;
  sort_order: number;
}

export interface VendorRow {
  id: string;
  project_id: string;
  category: string;
  vendor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  created_at: string;
}

export interface CallNoteRow {
  id: string;
  project_id: string;
  date: string;
  title: string | null;
  summary: string | null;
  raw_text: string;
  created_at: string;
}

export interface ExtractedActionRow {
  id: string;
  call_note_id: string;
  text: string;
  due_date: string | null;
  accepted: boolean;
  dismissed: boolean;
}

export interface ProjectFileRow {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  notes: string | null;
  google_drive_path: string | null;
  uploaded_at: string;
}

export interface TemplateTaskRow {
  id: string;
  text: string;
  category: string;
  weeks_before_event: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}
