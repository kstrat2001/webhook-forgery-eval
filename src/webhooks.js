import { readSigningSecrets, readToleranceSeconds } from "./config.js";
import { SignatureError, verifyDelivery } from "./signature.js";

/**
 * The payment webhook receiver.
 *
 * A payment provider POSTs an event when a customer pays or is refunded, and
 * the receiver moves the customer's balance. Anyone on the internet can POST
 * to the same URL, so nothing is applied until the signature checks out.
 *
 * Providers deliver at least once: after a timeout they send the same event
 * again. Each event id is applied once; a repeat is acknowledged with 200 so
 * the provider stops retrying, and the balance is left alone.
 */

const HANDLERS = {
  "payment.succeeded": (data) => data.amount,
  "payment.refunded": (data) => -data.amount,
};

/**
 * Call at startup. Throws when no signing secret is configured: a receiver
 * that cannot check signatures must not accept deliveries at all.
 */
export function requireSigningSecrets() {
  const secrets = readSigningSecrets();
  if (secrets.length === 0) {
    throw new Error("WEBHOOK_SECRETS is not set: refusing to accept unsigned deliveries");
  }
  return secrets;
}

function header(headers, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

/**
 * Build a receiver bound to a ledger. Secrets and tolerance are read once,
 * here, so a misconfigured process fails at boot rather than on first use.
 */
export function createReceiver(ledger) {
  const secrets = requireSigningSecrets();
  const toleranceSeconds = readToleranceSeconds();

  /**
   * Handle one delivery. `rawBody` is the request body as a string, exactly
   * as received. Returns `{ status, body }` for the HTTP layer to send.
   */
  return function receive({ headers, rawBody, now = new Date() }) {
    let event;
    try {
      event = verifyDelivery({
        rawBody,
        header: header(headers, "Webhook-Signature"),
        secrets,
        toleranceSeconds,
        now,
      });
    } catch (err) {
      if (err instanceof SignatureError) {
        return { status: 400, body: { error: err.code } };
      }
      if (err instanceof SyntaxError) {
        return { status: 400, body: { error: "INVALID_JSON" } };
      }
      throw err;
    }

    const handler = HANDLERS[event.type];
    if (!handler) {
      return { status: 200, body: { ignored: event.type } };
    }
    if (ledger.hasApplied(event.id)) {
      return { status: 200, body: { duplicate: event.id } };
    }
    ledger.apply(event.id, event.data.account, handler(event.data));
    return { status: 200, body: { applied: event.id } };
  };
}
