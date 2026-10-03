export type Environment = (name: string) => string | undefined;
export type Requester = typeof fetch;
export type Rpc = (name: string, body: Record<string, unknown>) => Promise<unknown>;
export interface Mail { to: string; subject: string; text: string }
export type SendMail = (mail: Mail, id: string) => Promise<void>;
export interface Worker { rpc: Rpc; send: SendMail }
export interface Period { start_at: string; end_at: string; label: string }
export interface Stats {
  submissions: number; active_datasets: number; adoption: number; manual: number;
  periodic: number; reported_uses: number; average_visited_sites: number;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid service object');
  return value as Record<string, unknown>;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid service array');
  return value;
}
export function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid service string');
  return value;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid service number');
  return value;
}
export function stats(value: unknown): Stats {
  const row = object(value);
  return {submissions:number(row.submissions),active_datasets:number(row.active_datasets),
    adoption:number(row.adoption),manual:number(row.manual),periodic:number(row.periodic),
    reported_uses:number(row.reported_uses),average_visited_sites:number(row.average_visited_sites)};
}
export function required(env: Environment, name: string): string {
  const value = env(name);
  if (!value) throw new Error('Service configuration unavailable');
  return value;
}
