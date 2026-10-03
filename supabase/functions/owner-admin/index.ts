import {createRpc, createMailSender} from '../_shared/new-profile-mail.ts';
import {createAdminHandler} from './handler.ts';
const env = (name: string) => Deno.env.get(name);
Deno.serve(createAdminHandler({env, rpc:createRpc(env), send:createMailSender(env)}));
