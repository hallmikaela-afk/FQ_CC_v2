export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function offsetWeek(isoWeek: string, offset: number): string {
  const [year, week] = isoWeek.split('-W').map(Number);
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  date.setDate(date.getDate() + offset * 7);
  return getISOWeek(date);
}

export function formatWeekLabel(isoWeek: string): string {
  const [year, week] = isoWeek.split('-W').map(Number);
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  const end = new Date(date);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(date)} – ${fmt(end)}`;
}
