import { createRpc, createMailSender } from '../_shared/new-profile-mail.ts';
import { createMonthlyHandler } from './handler.ts';

const env = (name: string) => Deno.env.get(name);
Deno.serve(createMonthlyHandler({ env, rpc: createRpc(env), send: createMailSender(env) }));
