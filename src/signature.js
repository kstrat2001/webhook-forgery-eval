import crypto from "node:crypto";

/**
 * Delivery signatures.
 *
 * The sender puts one header on every delivery:
 *
 *   Webhook-Signature: t=1767225600,v1=5257a869e7ec...,v1=...
 *
 * `t` is the send time in Unix seconds. Each `v1` is the hex HMAC-SHA256 of
 * `${t}.${rawBody}` under one signing secret. During a secret rotation the
 * sender signs with both secrets, so a header can carry more than one `v1`.
 *
 * The body is signed exactly as it arrived on the wire. Parsing the JSON and
 * serializing it again would change whitespace and key order, and the
 * signature would no longer describe the bytes the sender sent.
 */

export class SignatureError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SignatureError";
    this.code = code;
  }
}

export function computeSignature(secret, timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

/** Split a header into its timestamp and every v1 signature. */
export function parseSignatureHeader(header) {
  let timestamp = null;
  const signatures = [];
  for (const part of String(header).split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  return { timestamp, signatures };
}

function sameSignature(a, b) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Check a delivery and return its parsed body.
 *
 * Throws a SignatureError when:
 *   - the header is missing                       -> MISSING_SIGNATURE
 *   - it has no timestamp or no v1 signature      -> MALFORMED_SIGNATURE
 *   - the timestamp is further than `toleranceSeconds` from now, in either
 *     direction, so a captured delivery cannot be sent again later
 *                                                 -> STALE_TIMESTAMP
 *   - no v1 matches any of the secrets            -> BAD_SIGNATURE
 */
export function verifyDelivery({ rawBody, header, secrets, toleranceSeconds, now = new Date() }) {
  if (header === undefined || header === null || header === "") {
    throw new SignatureError("MISSING_SIGNATURE", "no Webhook-Signature header");
  }
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (timestamp === null || signatures.length === 0) {
    throw new SignatureError("MALFORMED_SIGNATURE", "expected t=<seconds>,v1=<hex>");
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new SignatureError("STALE_TIMESTAMP", `timestamp ${timestamp} is outside the tolerance`);
  }
  const matched = secrets.some((secret) => {
    const expected = computeSignature(secret, timestamp, rawBody);
    return signatures.some((candidate) => sameSignature(candidate, expected));
  });
  if (!matched) {
    throw new SignatureError("BAD_SIGNATURE", "no signature matches a configured secret");
  }
  return JSON.parse(rawBody);
}
