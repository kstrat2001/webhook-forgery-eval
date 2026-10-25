import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Ledger } from "../src/ledger.js";
import { computeSignature, parseSignatureHeader } from "../src/signature.js";
import { createReceiver } from "../src/webhooks.js";

const SECRET = "whsec_test_0123456789abcdef";
const NOW = new Date("2026-01-01T00:00:00Z");
const T = Math.floor(NOW.getTime() / 1000);

function delivery(event, { secret = SECRET, timestamp = T } = {}) {
  const rawBody = JSON.stringify(event);
  const v1 = computeSignature(secret, timestamp, rawBody);
  return {
    headers: { "Webhook-Signature": `t=${timestamp},v1=${v1}` },
    rawBody,
    now: NOW,
  };
}

const paid = (id, amount) => ({
  id,
  type: "payment.succeeded",
  data: { account: "acct_1", amount },
});

let saved;
let ledger;
let receive;
beforeEach(() => {
  saved = process.env.WEBHOOK_SECRETS;
  process.env.WEBHOOK_SECRETS = SECRET;
  ledger = new Ledger();
  receive = createReceiver(ledger);
});
afterEach(() => {
  if (saved === undefined) delete process.env.WEBHOOK_SECRETS;
  else process.env.WEBHOOK_SECRETS = saved;
});

describe("computeSignature", () => {
  it("returns 64 hex characters", () => {
    assert.match(computeSignature(SECRET, T, "{}"), /^[0-9a-f]{64}$/);
  });

  it("gives the same signature for the same input", () => {
    assert.equal(computeSignature(SECRET, T, "{}"), computeSignature(SECRET, T, "{}"));
  });
});

describe("parseSignatureHeader", () => {
  it("reads the timestamp and the signature", () => {
    const v1 = "a".repeat(64);
    assert.deepEqual(parseSignatureHeader(`t=${T},v1=${v1}`), {
      timestamp: T,
      signatures: [v1],
    });
  });
});

describe("receive", () => {
  it("credits the account for a signed payment", () => {
    const res = receive(delivery(paid("evt_1", 2500)));
    assert.equal(res.status, 200);
    assert.equal(ledger.balance("acct_1"), 2500);
  });

  it("debits the account for a signed refund", () => {
    receive(delivery(paid("evt_1", 2500)));
    receive(
      delivery({ id: "evt_2", type: "payment.refunded", data: { account: "acct_1", amount: 500 } }),
    );
    assert.equal(ledger.balance("acct_1"), 2000);
  });

  it("acknowledges an event type it does not handle without touching balances", () => {
    const res = receive(delivery({ id: "evt_3", type: "customer.updated", data: {} }));
    assert.equal(res.status, 200);
    assert.equal(ledger.balance("acct_1"), 0);
  });

  it("rejects a body changed after signing", () => {
    const d = delivery(paid("evt_1", 2500));
    d.rawBody = d.rawBody.replace("2500", "250000");
    const res = receive(d);
    assert.deepEqual(res, { status: 400, body: { error: "BAD_SIGNATURE" } });
    assert.equal(ledger.balance("acct_1"), 0);
  });

  it("rejects a delivery signed with a different secret", () => {
    const res = receive(delivery(paid("evt_1", 2500), { secret: "whsec_someone_else" }));
    assert.deepEqual(res, { status: 400, body: { error: "BAD_SIGNATURE" } });
  });

  it("rejects a header it cannot parse", () => {
    const d = delivery(paid("evt_1", 2500));
    d.headers["Webhook-Signature"] = "not a signature";
    const res = receive(d);
    assert.deepEqual(res, { status: 400, body: { error: "MALFORMED_SIGNATURE" } });
  });
});
