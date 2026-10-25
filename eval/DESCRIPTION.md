# Forged webhooks

Payment providers, code hosts and messaging services tell an app that something happened by sending an HTTP POST to a public URL: a webhook. Anyone who learns that URL can send a POST too. If the receiver doesn't check that a delivery really came from the provider, an attacker can report a payment that never happened, or replay a real one.

The defense is a signature: the provider computes an HMAC over the exact bytes it sends, with a secret only it and the receiver know, and the receiver checks it before acting. Each part of that check can be quietly wrong while every normal delivery still goes through, so happy-path tests miss it.

## Real-world incidents

- **New API, April 2026 ([CVE-2026-41432](https://github.com/advisories/GHSA-xff3-5c9p-2mr4)).** The Stripe webhook endpoint didn't refuse requests when the webhook secret was empty, which was the default. Anyone could compute a valid signature and credit themselves unlimited quota without paying.
- **Symfony Twilio notifier, May 2026 ([CVE-2026-47212](https://symfony.com/blog/cve-2026-47212-twilio-notifier-webhook-parser-never-verifies-the-x-twilio-signature-hmac-unauthenticated-webhook-event-injection)).** The parser was handed the secret but never read it and ignored the signature header, so any POST could forge delivered or failed message events.
- **n8n, June 2026 ([CVE-2026-56357](https://www.vulncheck.com/advisories/n8n-webhook-forgery-via-missing-hmac-sha256-signature-verification-in-github-webhook-trigger)).** The GitHub webhook trigger didn't verify the HMAC-SHA256 signature, so anyone who knew the URL could start workflows with arbitrary data.

## How the eval shows a model knows the fix

The receiver is correct, but its starting tests only send well-signed deliveries. The model must add tests. The grader then plants one bug at a time, each drawn from the incidents above (see `README.md` in this folder), and the model's tests must fail on every one. A model that knows these attacks writes a test for each; one that doesn't only tests that good deliveries get through.

Results claim only that a model's tests caught these planted bugs, not that any code or model is secure.
