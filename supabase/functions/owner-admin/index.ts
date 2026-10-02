import {createRpc, createMailSender} from '../_shared/new-profile-mail.mjs';
import {createAdminHandler} from './handler.mjs';
const env = (name: string) => Deno.env.get(name);
Deno.serve(createAdminHandler({env, rpc:createRpc(env), send:createMailSender(env)}));
