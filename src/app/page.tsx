'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { projects, team, generateTemplateTasks, addProject } from '@/data/seed';
import type { Project } from '@/data/seed';
import ClientCard from '@/components/ClientCard';
import ShootCard from '@/components/ShootCard';

const SERVICE_TIERS = ['Harmony Planning', 'Full Planning', 'Month-Of Coordination', 'Day-Of Coordination'];
const PROJECT_COLORS = ['#8B6F4E', '#6B7F5E', '#A0522D', '#C4956A', '#D4A574', '#9B8E82', '#C4A97D', '#7B8B5E'];

function NewClientModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (project: Project) => void }) {
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueLocation, setVenueLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [budget, setBudget] = useState('');
  const [serviceTier, setServiceTier] = useState(SERVICE_TIERS[0]);
  const [concept, setConcept] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  if (!open) return null;

  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70' };

  const handleSubmit = () => {
    if (!name.trim() || !eventDate) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const tasks = generateTemplateTasks(eventDate);
    const newProject: Project = {
      id,
      type: 'client',
      name: name.trim(),
      status: 'active',
      event_date: eventDate,
      contract_signed_date: new Date().toISOString().split('T')[0],
      color,
      concept: concept.trim() || undefined,
      service_tier: serviceTier,
      venue_name: venueName.trim() || undefined,
      venue_location: venueLocation.trim() || undefined,
      guest_count: guestCount ? parseInt(guestCount) : undefined,
      estimated_budget: budget.trim() || undefined,
      assigned_to: assignedTo.length > 0 ? assignedTo : ['1'],
      tasks_total: tasks.length,
      tasks_completed: 0,
      overdue_count: 0,
      tasks,
      vendors: [],
      call_notes: [],
      next_call_agenda: [],
    };
    onCreate(newProject);
    onClose();
  };

  const toggleTeam = (id: string) => {
    setAssignedTo(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[560px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-fq-border">
          <h2 className={`font-heading text-[22px] font-semibold ${t.heading}`}>New Client Wedding</h2>
          <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[18px]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Client Name */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Client Name(s) *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Julia & Frank"
                className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
                autoFocus
              />
            </div>

            {/* Event Date */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Event Date *</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50`}
              />
              <p className="font-body text-[11px] text-fq-muted/50 mt-1">Template tasks will be scheduled based on this date</p>
            </div>

            {/* Two columns: Venue + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Venue Name</label>
                <input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Wave Resort"
                  className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
                />
              </div>
              <div>
                <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Location</label>
                <input value={venueLocation} onChange={(e) => setVenueLocation(e.target.value)} placeholder="e.g. Long Branch, NJ"
                  className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
                />
              </div>
            </div>

            {/* Two columns: Guest Count + Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Guest Count</label>
                <input value={guestCount} onChange={(e) => setGuestCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 150"
                  className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
                />
              </div>
              <div>
                <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Estimated Budget</label>
                <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. $150K"
                  className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
                />
              </div>
            </div>

            {/* Service Tier */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Service Tier</label>
              <select value={serviceTier} onChange={(e) => setServiceTier(e.target.value)}
                className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none cursor-pointer focus:border-fq-accent/50`}
              >
                {SERVICE_TIERS.map(tier => <option key={tier} value={tier}>{tier}</option>)}
              </select>
            </div>

            {/* Concept */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>Concept / Theme</label>
              <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="e.g. Rooted in Rhythm, Garden Party, etc."
                className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
              />
            </div>

            {/* Team Assignment */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>Assign Team</label>
              <div className="flex flex-wrap gap-2">
                {team.map(member => (
                  <button
                    key={member.id}
                    onClick={() => toggleTeam(member.id)}
                    className={`font-body text-[12px] px-3 py-1.5 rounded-full border transition-colors ${
                      assignedTo.includes(member.id)
                        ? 'bg-fq-accent text-white border-fq-accent'
                        : 'text-fq-muted border-fq-border hover:border-fq-accent/40'
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Color */}
            <div>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1.5`}>Project Color</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-fq-dark ring-2 ring-fq-accent/30' : 'border-fq-border/50'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-fq-border">
          <p className="font-body text-[11px] text-fq-muted/50">
            {eventDate ? `~40 template tasks will be created` : 'Set event date to generate template tasks'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className={`font-body text-[13px] ${t.light} px-4 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>Cancel</button>
            <button onClick={handleSubmit} disabled={!name.trim() || !eventDate}
              className="font-body text-[13px] font-medium bg-fq-dark text-white px-5 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40"
            >
              Create Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientList, setClientList] = useState(() => projects.filter(p => p.type === 'client' && p.status === 'active'));
  const shoots = projects.filter(p => p.type === 'shoot');

  const handleCreateProject = (project: Project) => {
    addProject(project);
    setClientList(prev => [...prev, project]);
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="py-10 px-10">
      {/* Clients Section */}
      <div className="mb-16">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="font-heading text-[32px] font-semibold text-fq-dark">
              Clients
            </h1>
            <p className="font-body text-[14px] text-fq-muted">
              Active client weddings and details
            </p>
          </div>
          <button
            onClick={() => setShowNewClient(true)}
            className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-fq-dark/90 transition-colors"
          >
            + New Client
          </button>
        </div>
        <div className="border-t border-fq-border mt-4 mb-8" />

        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-5" style={{ minWidth: 'min-content' }}>
            {clientList.map((project) => (
              <div key={project.id} className="w-[360px] shrink-0">
                <ClientCard project={project} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shoots Section */}
      <div className="border-t border-fq-border pt-10">
        <h1 className="font-heading text-[32px] font-semibold text-fq-dark mb-1">
          Styled Shoots
        </h1>
        <p className="font-body text-[14px] text-fq-muted mb-6">
          Upcoming styled shoot projects
        </p>
        <div className="border-t border-fq-border mb-8" />

        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-5" style={{ minWidth: 'min-content' }}>
            {shoots.map((project) => (
              <div key={project.id} className="w-[360px] shrink-0">
                <ShootCard project={project} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <NewClientModal open={showNewClient} onClose={() => setShowNewClient(false)} onCreate={handleCreateProject} />
    </div>
  );
}
