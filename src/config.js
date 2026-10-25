// Settings for the webhook receiver.
//
// WEBHOOK_SECRETS holds the signing secrets shared with the sender, separated
// by commas. Normally there is one. While a secret is being rotated there are
// two: the new one first, the old one second, so deliveries signed with
// either are accepted until the sender has switched over.
//
// There is no default. A receiver without a secret cannot tell a real
// delivery from anyone else's POST, so `requireSigningSecrets()` refuses to
// start rather than run open.

export const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export function readSigningSecrets() {
  const raw = process.env.WEBHOOK_SECRETS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function readToleranceSeconds() {
  const raw = process.env.WEBHOOK_TOLERANCE_SECONDS;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOLERANCE_SECONDS;
}
