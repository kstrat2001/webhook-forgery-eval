# webhook-forgery-eval

A self-contained fixture for exercising coding agents on security-sensitive
code. It is a test subject, not a library: do not use it to receive real
webhooks. The subject is a payment webhook receiver that checks a signature
before it moves money: small enough to read in one sitting, and easy to cover
with tests that look complete while missing every attack.

## What the code does

- Every delivery carries `Webhook-Signature: t=<seconds>,v1=<hex>`. Each `v1`
  is HMAC-SHA256 of `${t}.${rawBody}` under a signing secret, computed over
  the body exactly as received, never over re-serialized JSON.
- The receiver refuses to start without a non-empty signing secret. There is
  no default secret.
- A delivery with no signature header is rejected.
- A timestamp more than 5 minutes from the server clock, in either direction,
  is rejected, so a captured delivery cannot be sent again later.
- During a secret rotation `WEBHOOK_SECRETS` holds the new and the old secret,
  and a header may carry one `v1` per secret; a match on any of them is
  accepted.
- Each event id is applied once. Providers redeliver after a timeout, so a
  repeat is acknowledged with 200 and the balance is left alone.
- Signatures are compared in constant time.

## The task

`test/webhooks.test.js` ships with 9 passing tests covering the happy paths:
a signed payment is credited, a refund is debited, a tampered body or a wrong
secret is rejected. They are genuinely incomplete. The work is to find what is
not covered and cover it, with `npm test` green at the end.

`TASK.md` is the prompt an agent receives, verbatim. `${SANDBOX_DIR}` is
substituted with the repo root at dispatch time.

## How it is graded

A run passes when the agent's tests catch every bug the grader plants in a
pristine copy of `src/`, the suite is green, nothing under `src/` or in the
existing tests changed, and the suite still passes from a different path.
The planted bugs and the rest of the grading rules are in `eval/`, which the
model never sees.

Results claim only that a model's tests caught these planted bugs. They do
not claim the code, or any model, is secure.

## Running

```bash
npm test          # 11 passing, no install step, no dependencies
```

Node 18 or newer. The suite uses Node's built-in test runner.

## Using it as a darkmux fixture

`eval/` holds the darkmux workload (`eval/workloads/webhook-forgery.json`): the
prompt and the rules that grade the result, each quoting the prompt sentence
it checks, with the planted bugs. `eval/` is never copied into the model's
sandbox.

```bash
darkmux lab fixture register /path/to/webhook-forgery-eval
darkmux lab run webhook-forgery -p <profile>
```

## License

MIT. See `LICENSE`.
