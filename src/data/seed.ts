export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export interface Vendor {
  id: string;
  category: string;
  vendor_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface CallNote {
  id: string;
  date: string;
  summary?: string;
  raw_text: string;
  extracted_actions: {
    id: string;
    text: string;
    due_date: string;
    accepted: boolean;
    dismissed: boolean;
  }[];
}

export interface Project {
  id: string;
  type: 'client' | 'shoot' | 'proposal';
  name: string;
  status: 'active' | 'proposal_sent' | 'completed' | 'archived';
  event_date: string;
  contract_signed_date?: string;
  color: string;
  concept?: string;
  assigned_to: string[];
  // Client-specific
  service_tier?: string;
  client1_name?: string;
  client2_name?: string;
  venue_name?: string;
  venue_location?: string;
  guest_count?: number;
  estimated_budget?: string;
  // Task counts
  tasks_total: number;
  tasks_completed: number;
  overdue_count: number;
  // Shoot-specific
  photographer?: string;
  florist?: string;
  location?: string;
  // Links & Resources
  canva_link?: string;
  internal_file_share?: string;
  client_shared_folder?: string;
  client_portal_link?: string;
  client_website?: string;
  sharepoint_folder?: string;
  // Project colors palette
  project_colors?: string[];
  // Related data
  vendors?: Vendor[];
  call_notes?: CallNote[];
}

export const team: TeamMember[] = [
  { id: '1', name: 'Mikaela Hall', initials: 'MH', role: 'Owner & Creative Director' },
  { id: '2', name: 'Liliana VanMiddlesworth', initials: 'LV', role: 'Marketing Assistant' },
  { id: '3', name: 'Tim Bell', initials: 'TB', role: 'Planning Assistant' },
];

export const projects: Project[] = [
  {
    id: 'julia-frank',
    type: 'client',
    name: 'Julia & Frank',
    status: 'active',
    event_date: '2026-06-07',
    contract_signed_date: '2024-10-14',
    color: '#8B6F4E',
    service_tier: 'Harmony Planning',
    client1_name: 'Julia',
    client2_name: 'Frank',
    venue_name: 'Wave Resort',
    venue_location: 'Long Branch, NJ',
    guest_count: 130,
    estimated_budget: '$100K',
    assigned_to: ['1', '2'],
    tasks_total: 90,
    tasks_completed: 60,
    overdue_count: 2,
    project_colors: ['#C4A97D', '#5B7A5E', '#A0522D', '#8B8FAE', '#C4A040', '#B8A060', '#C49870', '#6B5B4E', '#7B8B5E', '#4A5B8B', '#5B4B3E', '#C4A040', '#B87040', '#D4A0B0'],
    canva_link: 'https://canva.com/...',
    internal_file_share: 'https://sharepoint.com/...',
    client_shared_folder: 'https://drive.google.com/...',
    client_portal_link: 'https://portal.example.com/...',
    client_website: 'https://...',
    sharepoint_folder: 'https://sharepoint.com/...',
    vendors: [
      { id: 'v1', category: 'Hair & Makeup', vendor_name: 'Artsi Artistry', email: 'artsiartistry@gmail.com', phone: '(856) 885-0001' },
      { id: 'v2', category: 'Hair & Makeup', vendor_name: 'Gloss Studio' },
      { id: 'v3', category: 'Band/DJ', vendor_name: 'SCE Event Group', contact_name: 'Jason Jani', email: 'jason@sceeventgroup.com', phone: '(888) 278-0900', website: 'https://sceeventgroup.com/' },
      { id: 'v4', category: 'Band/DJ', vendor_name: 'Arnie Abrams Pianist', contact_name: 'Arnie Abrams', email: 'arnie@arnieabramspianist.com', phone: '(732) 995-1082', website: 'http://www.ArnieAbramsPianist.com' },
      { id: 'v5', category: 'Band/DJ', vendor_name: 'Piano Piano', contact_name: 'Amy Wolk', email: 'amy@pianopianostudios.com', phone: '(212) 586-9056' },
      { id: 'v6', category: 'Florist', vendor_name: 'Lilysh Floral', contact_name: 'Liliya Pincosy', email: 'contact@lilyshdesign.com', phone: '(347) 339-2627', website: 'https://www.lilysh.com/' },
      { id: 'v7', category: 'Rentals', vendor_name: 'United Rent All', contact_name: 'Kristen A. Redmond', email: 'kristen@unitedrentall.com', phone: '(908) 359-3663' },
      { id: 'v8', category: 'Photographer', vendor_name: 'Tay Tesvich Photography', contact_name: 'Tay Tesvich', email: 'taylortesvichphotography@gmail.com', phone: '(251) 554-5227', website: 'https://www.taytesvichphoto.com/' },
      { id: 'v9', category: 'Stationery', vendor_name: 'Merci Studio', contact_name: 'Meredith Masingill Cochran', email: 'mercistudio.design@gmail.com', phone: '(205) 438-5177' },
      { id: 'v10', category: 'Caterer', vendor_name: 'Wave Resort - Catering', contact_name: 'Allison Mercer', email: 'amercer@waveresort.com', phone: '(732) 795-6659', website: 'https://www.waveresort.com/' },
    ],
    call_notes: [
      {
        id: 'cn1',
        date: '2026-03-03',
        raw_text: 'Call covered floral direction (greenery + white/blush approved), cocktail hour music (jazz trio preference), room block deadline (April 15 — potential late RSVPs from Italy), sparkler exit request (needs venue fire check), tasting scheduling (within 3 weeks), budget check (florals may need trim), and calligrapher lead from Instagram.',
        extracted_actions: [
          { id: 'ea1', text: 'Check Wave Resort fire safety rules for sparkler exit', due_date: '2026-03-10', accepted: true, dismissed: false },
          { id: 'ea2', text: 'Schedule tasting at Wave Resort', due_date: '2026-03-20', accepted: true, dismissed: false },
          { id: 'ea3', text: 'Follow up with Julia on calligrapher Instagram handle', due_date: '2026-03-07', accepted: true, dismissed: false },
          { id: 'ea4', text: 'Research jazz trio options for cocktail hour', due_date: '2026-03-15', accepted: false, dismissed: true },
          { id: 'ea5', text: 'Flag room block deadline — April 15 final numbers', due_date: '2026-04-10', accepted: true, dismissed: false },
        ],
      },
      {
        id: 'cn2',
        date: '2026-02-15',
        raw_text: 'Initial planning call — discussed venue walkthrough date, ceremony format (non-religious, ~20 min), cocktail hour flow, and guest accommodation blocks at Wave Resort.',
        extracted_actions: [
          { id: 'ea6', text: 'Book venue walkthrough for early March', due_date: '2026-02-28', accepted: true, dismissed: false },
          { id: 'ea7', text: 'Send accommodation block details to Julia', due_date: '2026-02-20', accepted: true, dismissed: false },
        ],
      },
    ],
  },
  {
    id: 'tippi-justin',
    type: 'client',
    name: 'Tippi & Justin',
    status: 'active',
    event_date: '2026-09-19',
    contract_signed_date: '2025-10-28',
    color: '#6B7F5E',
    service_tier: 'Harmony Planning',
    venue_name: 'Vanderbilt Museum',
    venue_location: 'Centerport, NY',
    guest_count: 175,
    estimated_budget: '$170K',
    assigned_to: ['2'],
    tasks_total: 92,
    tasks_completed: 50,
    overdue_count: 0,
    vendors: [],
    call_notes: [
      {
        id: 'cn-tj1',
        date: '2026-02-28',
        raw_text: 'Reviewed venue walkthrough notes, confirmed ceremony in the courtyard. Discussed cocktail hour logistics and shuttle service from hotel. Tippi prefers candlelit reception with minimal uplighting.',
        extracted_actions: [
          { id: 'ea-tj1', text: 'Get shuttle quotes for guest transportation', due_date: '2026-03-15', accepted: true, dismissed: false },
        ],
      },
    ],
  },
  {
    id: 'elisabeth-jj',
    type: 'client',
    name: 'Elisabeth & JJ',
    status: 'active',
    event_date: '2026-10-10',
    contract_signed_date: '2025-11-07',
    color: '#A0522D',
    service_tier: 'Harmony Planning',
    concept: 'Rooted in Rhythm',
    venue_name: 'LionRock Farm',
    venue_location: 'Sharon, CT',
    guest_count: 160,
    estimated_budget: '$200K',
    assigned_to: ['2'],
    tasks_total: 81,
    tasks_completed: 30,
    overdue_count: 4,
    vendors: [],
    call_notes: [
      {
        id: 'cn-ej1',
        date: '2026-02-20',
        raw_text: 'Discussed ceremony setup at LionRock Farm barn, cocktail hour on the terrace, and reception tent layout. Elisabeth wants live band for reception and acoustic duo for ceremony. Floral concept: earthy tones, dried grasses, garden roses.',
        extracted_actions: [
          { id: 'ea-ej1', text: 'Send band options to Elisabeth', due_date: '2026-03-01', accepted: true, dismissed: false },
          { id: 'ea-ej2', text: 'Schedule florist consultation', due_date: '2026-03-10', accepted: true, dismissed: false },
        ],
      },
    ],
  },
  {
    id: 'cathy-omar',
    type: 'proposal',
    name: 'Cathy Wu & Omar Hyder',
    status: 'proposal_sent',
    event_date: '2026-08-01',
    color: '#9B8E82',
    concept: 'Wu-Hyder Symposium',
    venue_name: 'MIT Chapel & Samberg Center',
    venue_location: 'Cambridge, MA',
    assigned_to: [],
    tasks_total: 0,
    tasks_completed: 0,
    overdue_count: 0,
  },
  {
    id: 'sun-steeped',
    type: 'shoot',
    name: 'Sun-Steeped',
    status: 'active',
    event_date: '2026-04-20',
    color: '#D4A574',
    concept: 'Golden, mimosa-toned, graphic black accents',
    location: 'EHP Hamptons or Wildflower Farms TBD',
    assigned_to: ['1'],
    tasks_total: 12,
    tasks_completed: 4,
    overdue_count: 0,
  },
  {
    id: 'menorca',
    type: 'shoot',
    name: 'Menorca',
    status: 'active',
    event_date: '2026-05-18',
    color: '#C4956A',
    concept: 'Vestige Son Vell + Lithica Quarry, Menorca Spain',
    location: 'Menorca, Spain',
    photographer: 'EFEGE',
    florist: 'Cassandra at Enrich Events',
    assigned_to: ['1', '3', '2'],
    tasks_total: 15,
    tasks_completed: 6,
    overdue_count: 0,
  },
];

export function getTeamMember(id: string): TeamMember | undefined {
  return team.find(m => m.id === id);
}

export function formatCountdown(eventDate: string): { text: string; isUrgent: boolean } {
  const now = new Date('2026-03-07');
  const event = new Date(eventDate);
  const diffMs = event.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `${Math.abs(diffDays)}d ago`, isUrgent: true };
  }
  if (diffDays <= 30) {
    return { text: `${diffDays}d`, isUrgent: true };
  }
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const text = days > 0 ? `${weeks}w ${days}d` : `${weeks}w`;
  return { text, isUrgent: false };
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
