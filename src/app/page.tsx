import { projects } from '@/data/seed';
import ClientCard from '@/components/ClientCard';
import ShootCard from '@/components/ShootCard';

export default function HomePage() {
  // Combine active clients + shoots, sorted chronologically by event date
  const allProjects = projects
    .filter(p => (p.type === 'client' || p.type === 'shoot') && p.status === 'active')
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  return (
    <div className="py-10 px-10">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-heading text-[32px] font-semibold text-fq-dark">
            Projects
          </h1>
          <p className="font-body text-[14px] text-fq-muted">
            Active weddings and styled shoots by date
          </p>
        </div>
        <button className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-fq-dark/90 transition-colors">
          + New Project
        </button>
      </div>
      <div className="border-t border-fq-border mt-4 mb-8" />

      {/* Horizontal scroll container */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-5" style={{ minWidth: 'min-content' }}>
          {allProjects.map((project) => (
            <div key={project.id} className="w-[360px] shrink-0">
              {project.type === 'client' ? (
                <ClientCard project={project} />
              ) : (
                <ShootCard project={project} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
