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
  instagram?: string;
}

export interface CallNote {
  id: string;
  date: string;
  title?: string;
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

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  due_date?: string;
  category?: string;
  assigned_to?: string;
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
  venue_street?: string;
  venue_city_state_zip?: string;
  client_street?: string;
  client_city_state_zip?: string;
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
  location_street?: string;
  location_city_state_zip?: string;
  // Links & Resources
  design_board_link?: string;
  canva_link?: string;
  internal_file_share?: string;
  client_shared_folder?: string;
  client_portal_link?: string;
  client_website?: string;
  sharepoint_folder?: string;
  // Project colors palette
  project_colors?: string[];
  // Next call agenda
  next_call_agenda?: string[];
  // Related data
  tasks?: Task[];
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
    venue_street: '101 Chelsea Ave',
    venue_city_state_zip: 'Long Branch, NJ 07740',
    client_street: '245 Park Ave, Apt 12B',
    client_city_state_zip: 'New York, NY 10167',
    guest_count: 130,
    estimated_budget: '$100K',
    assigned_to: ['1', '2'],
    tasks_total: 90,
    tasks_completed: 60,
    overdue_count: 2,
    tasks: [
      { id: 'jf-t1', text: 'Check Wave Resort fire safety rules for sparkler exit', completed: false, due_date: '2026-03-10', category: 'Venue & Key Vendor Search', assigned_to: '2' },
      { id: 'jf-t2', text: 'Schedule tasting at Wave Resort', completed: false, due_date: '2026-03-20', category: 'Venue & Key Vendor Search', assigned_to: '2' },
      { id: 'jf-t3', text: 'Follow up with Julia on calligrapher Instagram handle', completed: false, due_date: '2026-03-07', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t4', text: 'Flag room block deadline — April 15 final numbers', completed: false, due_date: '2026-04-10', category: 'Logistics', assigned_to: '2' },
      { id: 'jf-t5', text: 'Finalize ceremony music selections', completed: false, due_date: '2026-03-15', category: 'Entertainment', assigned_to: '2' },
      { id: 'jf-t6', text: 'Confirm cocktail hour pianist booking', completed: false, due_date: '2026-03-18', category: 'Entertainment', assigned_to: '2' },
      { id: 'jf-t7', text: 'Review floral mockup with Lilysh', completed: false, due_date: '2026-03-22', category: 'Florals & Decor', assigned_to: '2' },
      { id: 'jf-t8', text: 'Send save-the-date proofs to Merci Studio', completed: false, due_date: '2026-03-12', category: 'Stationery', assigned_to: '2' },
      { id: 'jf-t9', text: 'Coordinate rental delivery timeline with United Rent All', completed: false, due_date: '2026-04-01', category: 'Logistics', assigned_to: '2' },
      { id: 'jf-t10', text: 'Schedule engagement shoot with Tay Tesvich', completed: false, due_date: '2026-03-25', category: 'Photography', assigned_to: '2' },
      { id: 'jf-t11', text: 'Finalize hair & makeup trial date with Artsi', completed: false, due_date: '2026-04-05', category: 'Hair & Makeup', assigned_to: '2' },
      { id: 'jf-t12', text: 'Draft day-of timeline v1', completed: false, due_date: '2026-04-15', category: 'Logistics', assigned_to: '1' },
      { id: 'jf-t13', text: 'Send venue contract addendum for sparkler exit', completed: false, due_date: '2026-03-28', category: 'Venue & Key Vendor Search', assigned_to: '2' },
      { id: 'jf-t14', text: 'Confirm SCE Event Group availability for reception', completed: false, due_date: '2026-03-30', category: 'Entertainment', assigned_to: '2' },
      { id: 'jf-t15', text: 'Collect dietary restrictions from guest RSVPs', completed: false, due_date: '2026-05-01', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t16', text: 'Create wedding website', completed: false, due_date: '2026-03-14', category: 'Onboarding', assigned_to: '2' },
      { id: 'jf-t17', text: 'Book hotel blocks for guests', completed: false, due_date: '2026-02-12', category: 'Venue & Key Vendor Search', assigned_to: '2' },
      { id: 'jf-t18', text: 'Schedule ceremony rehearsal', completed: false, due_date: '2026-07-18', category: 'Venue & Key Vendor Search', assigned_to: '2' },
      { id: 'jf-t19', text: 'Check in call with client (5.5 months)', completed: false, due_date: '2026-04-28', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t20', text: 'Send client check in email', completed: false, due_date: '2026-05-28', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t21', text: 'Schedule timeline call', completed: false, due_date: '2026-05-28', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t22', text: 'Have timeline call with client', completed: false, due_date: '2026-07-18', category: 'Check in - Client', assigned_to: '2' },
      { id: 'jf-t23', text: 'Check in call with client (7 weeks)', completed: false, due_date: '2026-08-22', category: 'Check in - Client', assigned_to: '2' },
    ],
    project_colors: ['#C4A97D', '#5B7A5E', '#A0522D', '#8B8FAE', '#C4A040', '#B8A060', '#C49870', '#6B5B4E', '#7B8B5E', '#4A5B8B', '#5B4B3E', '#C4A040', '#B87040', '#D4A0B0'],
    canva_link: 'https://canva.com/...',
    internal_file_share: 'https://sharepoint.com/...',
    client_shared_folder: 'https://drive.google.com/...',
    client_portal_link: 'https://portal.example.com/...',
    client_website: 'https://...',
    sharepoint_folder: 'https://sharepoint.com/...',
    vendors: [
      { id: 'v1', category: 'Hair & Makeup', vendor_name: 'Artsi Artistry', email: 'artsiartistry@gmail.com', phone: '(856) 885-0001', instagram: '@artsiartistry' },
      { id: 'v2', category: 'Hair & Makeup', vendor_name: 'Gloss Studio', instagram: '@glossstudio' },
      { id: 'v3', category: 'Band/DJ', vendor_name: 'SCE Event Group', contact_name: 'Jason Jani', email: 'jason@sceeventgroup.com', phone: '(888) 278-0900', website: 'https://sceeventgroup.com/', instagram: '@sceeventgroup' },
      { id: 'v4', category: 'Band/DJ', vendor_name: 'Arnie Abrams Pianist', contact_name: 'Arnie Abrams', email: 'arnie@arnieabramspianist.com', phone: '(732) 995-1082', website: 'http://www.ArnieAbramsPianist.com' },
      { id: 'v5', category: 'Band/DJ', vendor_name: 'Piano Piano', contact_name: 'Amy Wolk', email: 'amy@pianopianostudios.com', phone: '(212) 586-9056' },
      { id: 'v6', category: 'Florist', vendor_name: 'Lilysh Floral', contact_name: 'Liliya Pincosy', email: 'contact@lilyshdesign.com', phone: '(347) 339-2627', website: 'https://www.lilysh.com/', instagram: '@lilyshfloral' },
      { id: 'v7', category: 'Rentals', vendor_name: 'United Rent All', contact_name: 'Kristen A. Redmond', email: 'kristen@unitedrentall.com', phone: '(908) 359-3663' },
      { id: 'v8', category: 'Photographer', vendor_name: 'Tay Tesvich Photography', contact_name: 'Tay Tesvich', email: 'taylortesvichphotography@gmail.com', phone: '(251) 554-5227', website: 'https://www.taytesvichphoto.com/', instagram: '@taytesvich' },
      { id: 'v9', category: 'Stationery', vendor_name: 'Merci Studio', contact_name: 'Meredith Masingill Cochran', email: 'mercistudio.design@gmail.com', phone: '(205) 438-5177', instagram: '@mercistudiodesign' },
      { id: 'v10', category: 'Caterer', vendor_name: 'Wave Resort - Catering', contact_name: 'Allison Mercer', email: 'amercer@waveresort.com', phone: '(732) 795-6659', website: 'https://www.waveresort.com/', instagram: '@waveresort' },
    ],
    next_call_agenda: [
      'Follow up on venue deposit',
      'Confirm florist timeline',
      'Review guest list updates',
    ],
    call_notes: [
      {
        id: 'cn1',
        date: '2026-03-03',
        title: 'Floral Direction & Logistics',
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
        date: '2026-03-05',
        title: 'Timeline & Logistics Review',
        summary: 'The meeting focused on finalizing the wedding timeline and addressing various logistical details for the upcoming wedding. The couple and Mikaela discussed adjustments to the timeline, including moving the first look earlier and reorganizing hair and makeup schedules based on artist availability. They decided to add a photo booth during dinner and addressed concerns about the ice luge and bar package costs. The group also reviewed seating arrangements, dinner timing, and the placement of a well-wishing box. Mikaela agreed to update the timeline and follow up with the venue about the photo booth setup. The couple shared their decision to forego a rehearsal dinner and discussed options for the wedding film and cigar selection. They concluded by reviewing the progress on design elements, including linens, florals, and table arrangements, with plans to finalize details with the florist in the coming weeks.',
        raw_text: 'juliamazzucca: Provide Mikaela with details on the number of hair and makeup artists, their schedule/timeline, and how many people each is bringing juliamazzucca: Send Mikaela the specific link or details for the chosen cigars juliamazzucca: Send Mikaela options for the well-wishing box (card box) for review Mikaela: Update the hair and makeup schedule to include the additional person (Gabriella) and reorganize based on new artist information Mikaela: Move the first look timing earlier (to 3:15 or 3:30) and consult with Tay (photographer) on timing Mikaela: Reach out to Mark to confirm timing for the single toast during dinner Mikaela: Ask the photo booth vendor how long setup takes and if it can be set up during dinner Mikaela: Schedule a call with Mark to discuss bartender and martini tower/luge situation Mikaela: Look into options for mid-tone/darker napkins and coordinate with florist on fabric choices juliamazzucca: Think about and inform Mikaela on preferred timing for first dance Mikaela: Consider and confirm best timing/flow for first dance and cake cutting juliamazzucca: Decide on bouquet style and communicate to Mikaela Mikaela: Add linens/fabric for the credenza (card box table) and satellite bar to the linens list and source options Mikaela: Update the after party venue information on the website back from Wave Resort juliamazzucca: Arrange for bridal suite food for wedding party (and coordinate with Frank\'s mom if needed) Mikaela: Add time for rehearsal before hair and makeup, once schedule is set',
        extracted_actions: [
          { id: 'ea6', text: 'Update hair and makeup schedule for Gabriella', due_date: '2026-03-10', accepted: true, dismissed: false },
          { id: 'ea7', text: 'Move first look to 3:15 and consult Tay on timing', due_date: '2026-03-08', accepted: true, dismissed: false },
          { id: 'ea8', text: 'Ask photo booth vendor about setup during dinner', due_date: '2026-03-12', accepted: true, dismissed: false },
          { id: 'ea9', text: 'Schedule call with Mark re: bartender + luge', due_date: '2026-03-10', accepted: false, dismissed: false },
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
    tasks: [
      { id: 'tj-t1', text: 'Get shuttle quotes for guest transportation', completed: false, due_date: '2026-03-15' },
      { id: 'tj-t2', text: 'Finalize courtyard ceremony layout', completed: false, due_date: '2026-04-01' },
      { id: 'tj-t3', text: 'Source candlelit reception decor rentals', completed: false, due_date: '2026-04-10' },
      { id: 'tj-t4', text: 'Book caterer tasting at Vanderbilt', completed: false, due_date: '2026-03-20' },
      { id: 'tj-t5', text: 'Research uplighting alternatives (candle-only look)', completed: false, due_date: '2026-03-25' },
      { id: 'tj-t6', text: 'Send hotel block options to Tippi', completed: false, due_date: '2026-03-12' },
      { id: 'tj-t7', text: 'Schedule florist site visit at Vanderbilt', completed: false, due_date: '2026-04-05' },
      { id: 'tj-t8', text: 'Confirm photographer contract + deposit', completed: false, due_date: '2026-03-18' },
      { id: 'tj-t9', text: 'Draft cocktail hour flow plan', completed: false, due_date: '2026-04-15' },
      { id: 'tj-t10', text: 'Review invitation suite proofs', completed: false, due_date: '2026-03-28' },
      { id: 'tj-t11', text: 'Coordinate rehearsal dinner venue options', completed: false, due_date: '2026-04-20' },
      { id: 'tj-t12', text: 'Collect vendor insurance certificates', completed: false, due_date: '2026-05-01' },
    ],
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
    tasks: [
      { id: 'ej-t1', text: 'Send band options to Elisabeth', completed: false, due_date: '2026-03-01' },
      { id: 'ej-t2', text: 'Schedule florist consultation', completed: false, due_date: '2026-03-10' },
      { id: 'ej-t3', text: 'Confirm barn ceremony setup with LionRock', completed: false, due_date: '2026-03-20' },
      { id: 'ej-t4', text: 'Source dried grass + garden rose samples', completed: false, due_date: '2026-03-25' },
      { id: 'ej-t5', text: 'Book acoustic duo for ceremony', completed: false, due_date: '2026-03-15' },
      { id: 'ej-t6', text: 'Get tent rental quotes for reception', completed: false, due_date: '2026-04-01' },
      { id: 'ej-t7', text: 'Schedule LionRock Farm site visit', completed: false, due_date: '2026-03-28' },
      { id: 'ej-t8', text: 'Draft terrace cocktail hour layout', completed: false, due_date: '2026-04-10' },
      { id: 'ej-t9', text: 'Research caterer options in Sharon, CT area', completed: false, due_date: '2026-04-05' },
      { id: 'ej-t10', text: 'Send save-the-date design concepts', completed: false, due_date: '2026-03-18' },
      { id: 'ej-t11', text: 'Coordinate hotel block at local inn', completed: false, due_date: '2026-04-15' },
      { id: 'ej-t12', text: 'Review earthy tone linen samples', completed: false, due_date: '2026-04-20' },
    ],
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
    design_board_link: 'https://canva.com/design/sun-steeped',
    assigned_to: ['1'],
    tasks_total: 12,
    tasks_completed: 4,
    overdue_count: 0,
    tasks: [
      { id: 'ss-t1', text: 'Confirm venue (EHP vs Wildflower)', completed: false, due_date: '2026-03-14' },
      { id: 'ss-t2', text: 'Book photographer', completed: false, due_date: '2026-03-15' },
      { id: 'ss-t3', text: 'Source gold + black tableware rentals', completed: false, due_date: '2026-03-20' },
      { id: 'ss-t4', text: 'Finalize floral palette with florist', completed: false, due_date: '2026-03-22' },
      { id: 'ss-t5', text: 'Order mimosa-toned linens', completed: false, due_date: '2026-03-25' },
      { id: 'ss-t6', text: 'Create shot list / mood board', completed: false, due_date: '2026-03-28' },
      { id: 'ss-t7', text: 'Coordinate model casting', completed: false, due_date: '2026-04-01' },
      { id: 'ss-t8', text: 'Schedule hair & makeup artist', completed: false, due_date: '2026-04-05' },
      { id: 'ss-t9', text: 'Send creative brief to team', completed: true },
      { id: 'ss-t10', text: 'Draft concept mood board', completed: true },
      { id: 'ss-t11', text: 'Research venue options', completed: true },
      { id: 'ss-t12', text: 'Create project timeline', completed: true },
    ],
    vendors: [
      { id: 'ss-v1', category: 'Photographer', vendor_name: 'TBD' },
      { id: 'ss-v2', category: 'Florist', vendor_name: 'TBD' },
    ],
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
    design_board_link: 'https://canva.com/design/menorca-shoot',
    photographer: 'EFEGE',
    florist: 'Cassandra at Enrich Events',
    assigned_to: ['1', '3', '2'],
    tasks_total: 15,
    tasks_completed: 6,
    overdue_count: 0,
    tasks: [
      { id: 'mn-t1', text: 'Book flights to Menorca', completed: false, due_date: '2026-03-20' },
      { id: 'mn-t2', text: 'Confirm Vestige Son Vell access permit', completed: false, due_date: '2026-03-25' },
      { id: 'mn-t3', text: 'Finalize floral order with Cassandra', completed: false, due_date: '2026-04-01' },
      { id: 'mn-t4', text: 'Ship rentals & props to Spain', completed: false, due_date: '2026-04-10' },
      { id: 'mn-t5', text: 'Arrange local transport + accommodation', completed: false, due_date: '2026-04-15' },
      { id: 'mn-t6', text: 'Create detailed shot list for Lithica Quarry', completed: false, due_date: '2026-04-20' },
      { id: 'mn-t7', text: 'Coordinate model travel logistics', completed: false, due_date: '2026-04-25' },
      { id: 'mn-t8', text: 'Confirm EFEGE availability + contract', completed: false, due_date: '2026-03-15' },
      { id: 'mn-t9', text: 'Source local hair & makeup in Menorca', completed: false, due_date: '2026-04-05' },
      { id: 'mn-t10', text: 'Research Menorca venue options', completed: true },
      { id: 'mn-t11', text: 'Contact EFEGE for initial inquiry', completed: true },
      { id: 'mn-t12', text: 'Draft concept + mood board', completed: true },
      { id: 'mn-t13', text: 'Connect with Cassandra at Enrich', completed: true },
      { id: 'mn-t14', text: 'Create project budget estimate', completed: true },
      { id: 'mn-t15', text: 'Build project timeline', completed: true },
    ],
    vendors: [
      { id: 'mn-v1', category: 'Photographer', vendor_name: 'EFEGE', contact_name: 'EFEGE Photo', instagram: '@efegephoto' },
      { id: 'mn-v2', category: 'Florist', vendor_name: 'Enrich Events', contact_name: 'Cassandra', email: 'cassandra@enrichevents.com', instagram: '@enrichevents' },
      { id: 'mn-v3', category: 'Venue', vendor_name: 'Vestige Son Vell', website: 'https://vestigesonvell.com' },
    ],
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
