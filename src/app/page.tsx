import { projects } from '@/data/seed';
import ClientCard from '@/components/ClientCard';
import ShootCard from '@/components/ShootCard';

export default function HomePage() {
  const clients = projects.filter(p => p.type === 'client' && p.status === 'active');
  const shoots = projects.filter(p => p.type === 'shoot');

  return (
    <div className="px-10 py-10 max-w-[800px]">
      {/* Clients Section */}
      <h1 className="font-heading text-[32px] font-semibold text-fq-dark mb-8">
        Clients
      </h1>
      <div className="flex flex-col gap-6 mb-16">
        {clients.map((project) => (
          <ClientCard key={project.id} project={project} />
        ))}
      </div>

      {/* Shoots Section */}
      <div className="border-t border-fq-border pt-10">
        <h1 className="font-heading text-[32px] font-semibold text-fq-dark mb-8">
          Styled Shoots
        </h1>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {shoots.map((project) => (
            <ShootCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}
