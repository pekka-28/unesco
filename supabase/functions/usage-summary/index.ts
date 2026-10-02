import { createHandler } from './handler.mjs';
import { createRpc, createMailSender, mailConfigured, deliverNewProfiles } from '../_shared/new-profile-mail.mjs';
const env = (name: string) => Deno.env.get(name);
Deno.serve(createHandler({ env, onAccepted: (submissionId: string) => {
  if (!mailConfigured(env)) return;
  EdgeRuntime.waitUntil(deliverNewProfiles({ rpc: createRpc(env), send: createMailSender(env), submissionId })
    .catch(() => console.error('New-profile delivery failed; pending notification retained')));
} }));
