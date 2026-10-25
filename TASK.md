QA REVIEW REQUEST — payment webhook receiver

A payment webhook receiver was recently merged. This is a security-sensitive surface — anyone on the internet can POST to the webhook URL, and a delivery that is accepted moves money in customer balances — and it needs adequate test coverage before deployment.

What changed:

- Deliveries are verified with HMAC-SHA256 over the timestamp and the raw request body, exactly as received (`Webhook-Signature: t=<seconds>,v1=<hex>`)
- The receiver refuses to start if no non-empty signing secret is configured
- A delivery with no signature header is rejected
- Timestamps more than 5 minutes from the server clock, in either direction, are rejected, so a captured delivery cannot be replayed later
- Secret rotation: WEBHOOK_SECRETS may hold the new and the old secret, and a delivery signed with either is accepted; a header may carry more than one v1 signature
- Each event id is applied to the ledger once; a redelivered event is acknowledged with 200 but not applied again
- Signatures are compared in constant time

The implementation lives at:

- ${SANDBOX_DIR}/src/webhooks.js (the receiver)
- ${SANDBOX_DIR}/src/signature.js (header parsing and verification)
- ${SANDBOX_DIR}/src/config.js (signing secrets and tolerance configuration)
- ${SANDBOX_DIR}/src/ledger.js (in-memory balances and applied event ids)

Existing tests:

- ${SANDBOX_DIR}/test/webhooks.test.js
- ${SANDBOX_DIR}/test/portability.test.js (a guard on the suite itself; leave it alone)

Some coverage is already in place. Some isn't. Your job is to figure out the difference, decide what matters, and write the tests yourself.

## Your task

Read the implementation. Read the existing tests. Decide which behaviors of the change aren't covered and would matter to you in a real code review. Then write those tests — don't hand them back as a list of suggestions.

Treat this as a real PR review where you have commit access: if you'd want a test to exist before approving, write it.

## Constraints

- Repo root: ${SANDBOX_DIR}.
- Your tests must run in a DIFFERENT environment than this one, where that
  path does not exist. Resolve anything path-dependent from
  `import.meta.url` (e.g. `new URL("../src/x.js", import.meta.url)`) and use
  `process.execPath` rather than the string "node" if you spawn a process.
  `test/portability.test.js` enforces both and will tell you immediately.
- Add your tests in a new file under test/. Do not change the existing test files at all, not even their imports.
- Do not modify source code under src/. Tests only.
- Match the existing test file style: `node:test` with `describe`/`it` and `node:assert/strict`. There are no mocking libraries and no build step.
- Iterate by running the suite:
  cd ${SANDBOX_DIR} && npm test
- Final verification is the same command:
  cd ${SANDBOX_DIR} && npm test

## When you're done

You're done when the tests you've added are sufficient for you to approve this PR. Quality over quantity. Stop when adding more tests would be padding rather than risk reduction.

Most reviewers would land somewhere between 5 and 15 new test cases for a change of this surface area. If you're well outside that range in either direction, mention it in your reply.

## Reply format

Keep it tight:

- Gaps you identified: behaviors that needed coverage, one-line rationale per gap
- What you wrote: number of new tests, which files
- What you decided NOT to test, and why: the negative space matters
- Test result: the `# pass N` line from your final run
- Confidence: would you sign off on this PR after your additions?
