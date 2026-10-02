import { createRpc, createMailSender } from '../_shared/new-profile-mail.mjs';
import { createMonthlyHandler } from './handler.mjs';

const env = (name: string) => Deno.env.get(name);
Deno.serve(createMonthlyHandler({ env, rpc: createRpc(env), send: createMailSender(env) }));
