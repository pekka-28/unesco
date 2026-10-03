import {stats as parseStats} from '../_shared/contracts.ts';
import type {Environment, Worker, Period} from '../_shared/contracts.ts';
import { reportTime } from '../_shared/report-time.ts';
import { previousMonth, renderReport } from '../_shared/monthly-report.ts';
import { monthlyRegisterReport } from '../_shared/register-report.ts';

export function createMonthlyHandler({ env, rpc, send, register = monthlyRegisterReport, now = () => new Date(), id = () => crypto.randomUUID() }: Worker & {env: Environment; register?: (period: Period) => Promise<string>; now?: () => Date; id?: () => string}) {
  return async (req: Request) => {
    const token = env('MWH_NOTIFICATION_TOKEN');
    if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
      return Response.json({ ok: false }, { status: 401 });
    }
    if (req.method !== 'POST') return Response.json({ ok: false }, { status: 405 });
    try {
      const timestamp = now();
      const period = previousMonth(timestamp);
      const stats = parseStats(await rpc('usage_stats', { start_at: period.start_at, end_at: period.end_at }));
      let text = renderReport(period, stats);
      try { text += await register(period); }
      catch { text += '\nSite register comparison unavailable. Inspect the GitHub catalogue history; no claim of zero changes is made.\n'; }
      const test = req.headers.get('x-mwh-report-test') === 'true';
      if (test) {
        const current = parseStats(await rpc('usage_stats', { start_at: period.end_at, end_at: timestamp.toISOString() }));
        text += '\nManual delivery check — current month to date\n\n' +
          'The section above is the regular previous-month report. The section below is included only for this manual check.\n' +
          `As at: ${reportTime(timestamp.toISOString())}\n` +
          `Accepted submissions: ${current.submissions}\nActive profiles: ${current.active_datasets}\n` +
          `Adoption submissions: ${current.adoption}\nManual updates: ${current.manual}\nPeriodic updates: ${current.periodic}\n` +
          `Reported uses: ${current.reported_uses}\nAverage visited sites (latest update per profile): ${Number(current.average_visited_sites).toFixed(1)}\n\n` +
          'Current totals include the integration-test profile.\n';
      }
      await send({ to: 'pekka@data.co.za',
        subject: `My World Heritage - monthly user activity${test ? ' - delivery check' : ''}`,
        text }, id());
      return Response.json({ ok: true, accepted: true, period: period.label, test }, { status: 202 });
    } catch {
      return Response.json({ ok: false, error: 'Monthly report query or delivery failed; check before retrying' }, { status: 503 });
    }
  };
}
