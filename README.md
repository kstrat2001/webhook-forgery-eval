# webhook-forgery-eval

A self-contained fixture for exercising coding agents on security-sensitive
code. It is a test subject, not a library: do not use it to receive real
webhooks. The subject is a payment webhook receiver that checks a signature
before it moves money: small enough to read in one sitting, and easy to cover
with tests that look complete while missing every attack.

## At a glance

| | |
| --- | --- |
| Kind | Coding with tools: the model edits and runs a sandboxed copy of this repo, without `eval/` |
| Version | 1.3 (tag `1.3`, commit `ddc2805`) |
| Criteria | 6, each recorded as met or missed on every run |
| Results | [evals.darkmux.com/evals/webhook-forgery-eval](https://evals.darkmux.com/evals/webhook-forgery-eval) |
| Needs | darkmux 5.9.0 or later |
| License | MIT |

The eval's page on evals.darkmux.com names the approved commit, lists the
criteria and shows which ones each run met. The criteria are not listed here
because this file is inside the model's sandbox.

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

## Run it with darkmux

```bash
git clone https://github.com/kstrat2001/webhook-forgery-eval
cd webhook-forgery-eval
git checkout <approved commit>     # named on the eval's page
darkmux lab fixture register .
darkmux lab run webhook-forgery -p <profile>
darkmux run inspect <run id>       # the verdict, time and turns
```

Leave the checkout unchanged: a run from any other commit, or from a checkout
with changes in it, cannot be shared. To share a run on evals.darkmux.com, run
`darkmux lab submit <run id> --dry-run` to see exactly what would be sent, then
`darkmux lab submit <run id>`. The
[share-runs guide](https://darkmux.com/guide/share-runs.html) covers upload
access and what a bundle carries.

## What `eval/` holds

`eval/` holds the darkmux workload (`eval/workloads/webhook-forgery.json`): the
prompt, the rules that grade the result (each quoting the prompt sentence it
checks) and the planted bugs. `eval/` is never copied into the model's
sandbox.

## License

MIT. See `LICENSE`.
