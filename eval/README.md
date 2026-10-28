# How webhook-forgery-eval is graded

This folder is never copied into the model's sandbox. `workloads/webhook-forgery.json`
holds the prompt and the grading rules; each rule quotes the prompt sentence it grades.
`roles/coder.json` and `roles/coder.md` are the role the model runs as, system prompt
included: darkmux's built-in `coder`, copied in so the eval pins it. darkmux reads the role from
here, never from the machine's own settings, and each run records the sha256 of both files.

The grader plants one bug at a time in a pristine copy of `src/` and runs the
agent's tests against it. Each planted bug is one of the mistakes from the incidents cited in the top-level README:

| Behavior | Planted bug |
| --- | --- |
| Secret required | An empty `WEBHOOK_SECRETS` is accepted as a secret; the startup check is switched off |
| Missing signature | A delivery with no header is accepted unverified |
| Timestamp tolerance | Old timestamps are accepted; only future ones are checked |
| Raw body | The signature is checked over re-serialized JSON instead of the bytes received |
| Secret rotation | Only the first secret is tried; only the first `v1` is tried |
| Applied once | A redelivered event is applied again |


A run passes when the agent's tests catch every planted bug, the suite is
green, nothing under `src/` or in the existing tests changed, and the suite
still passes from a different path. The baseline suite catches none of them.
The constant-time comparison is in the prompt but not graded: no behavioral
test can observe it.

The sandbox and the grader run in `node:24-slim`, pinned by digest in the
workload's `image`, not in darkmux's default image. Bump the digest as a new
fixture version.

Results claim only that a model's tests caught these planted bugs. They do
not claim the code, or any model, is secure.

