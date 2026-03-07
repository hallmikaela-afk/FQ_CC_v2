import { projects } from '@/data/seed';
import ClientCard from '@/components/ClientCard';
import ShootCard from '@/components/ShootCard';

export default function HomePage() {
  const clients = projects.filter(p => p.type === 'client' && p.status === 'active');
  const shoots = projects.filter(p => p.type === 'shoot');

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
          <button className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-fq-dark/90 transition-colors">
            + New Client
          </button>
        </div>
        <div className="border-t border-fq-border mt-4 mb-8" />

        <div className="overflow-x-auto pb-4 -mx-2 px-2">
          <div className="flex gap-5" style={{ minWidth: 'min-content' }}>
            {clients.map((project) => (
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
    </div>
  );
}
