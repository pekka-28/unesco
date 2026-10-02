export function previousMonth(now = new Date()) {
  // Johannesburg is UTC+02 throughout the year. Reporting periods use local months.
  const local = new Date(+now + 2 * 3600000);
  const y = local.getUTCFullYear(), m = local.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1, -2));
  const end = new Date(Date.UTC(y, m, 1, -2));
  const label = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 7);
  return { start_at: start.toISOString(), end_at: end.toISOString(), label };
}

export function renderReport(period, s) {
  return `My World Heritage user activity: ${period.label}\n\n` +
    `Period: previous calendar month in Africa/Johannesburg.\n` +
    `Accepted submissions: ${s.submissions}\nActive profiles: ${s.active_datasets}\n` +
    `Adoption submissions: ${s.adoption}\nManual updates: ${s.manual}\nPeriodic updates: ${s.periodic}\n` +
    `Reported uses: ${s.reported_uses}\nAverage visited sites (latest update per profile): ${Number(s.average_visited_sites).toFixed(1)}\n\n` +
    `Counts describe voluntary pseudonymous submissions, not all users or unique people.\n` +
    `No names, locations, visit notes or individual profile identifiers are included.\n`;
}
