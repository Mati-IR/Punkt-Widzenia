// Browser side of PUN-71: an event created today shows only its time ("14:05"); older ones keep
// the date + time rendered at build time ("9 lis, 15:05"). Runs on load and after infinite scroll.
const tz = 'Europe/Warsaw';
const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD in Warsaw

export function formatCreated(root: ParentNode) {
  const today = day(new Date());
  root.querySelectorAll<HTMLTimeElement>('time[data-created]').forEach((el) => {
    const d = new Date(el.dateTime);
    if (Number.isNaN(d.getTime())) return;
    if (!el.title) el.title = `Utworzono ${el.textContent}`;
    if (day(d) === today) el.textContent = `dziś, ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: tz })}`;
  });
}
