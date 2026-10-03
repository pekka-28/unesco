// Supabase Edge Runtime extension used for durable background delivery.
declare namespace EdgeRuntime {
  function waitUntil(promise: Promise<unknown>): void;
}
