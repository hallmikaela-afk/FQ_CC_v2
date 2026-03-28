// Weeks run Saturday–Friday. The week identifier uses the ISO week number of
// the Monday within that Sat–Fri span, giving stable YYYY-Www strings.

export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Advance Saturday/Sunday to the Monday of the same Sat–Fri week
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  if (day === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  // Standard ISO week calc on d (now guaranteed Mon–Fri)
  const thu = new Date(d);
  thu.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(thu.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((thu.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function offsetWeek(isoWeek: string, offset: number): string {
  const [year, week] = isoWeek.split('-W').map(Number);
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  date.setDate(date.getDate() + offset * 7);
  return getISOWeek(date);
}

export function formatWeekLabel(isoWeek: string): string {
  const [year, week] = isoWeek.split('-W').map(Number);
  // Find the Monday of this ISO week
  const jan4 = new Date(year, 0, 4);
  const mon = new Date(jan4);
  mon.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
  // Sat–Fri week starts 2 days before that Monday
  const sat = new Date(mon);
  sat.setDate(mon.getDate() - 2);
  const fri = new Date(sat);
  fri.setDate(sat.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(sat)} – ${fmt(fri)}`;
}
