export const SESSION_COOKIE_NAME = "financial_app_session";
export const SESSION_DURATION_SECONDS = 60 * 60;
export const REMEMBERED_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export function getSessionCookieOptions(
  durationSeconds = SESSION_DURATION_SECONDS
) {
  return {
    httpOnly: true,
    maxAge: durationSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export type SessionPayload = {
  durationSeconds?: number;
  exp: number;
  iat: number;
  userId: string;
};

const textEncoder = new TextEncoder();

export async function createSessionToken(
  userId: string,
  durationSeconds = SESSION_DURATION_SECONDS,
  issuedAt = Math.floor(Date.now() / 1000)
): Promise<string> {
  const safeDurationSeconds = normalizeSessionDuration(durationSeconds);
  const payload: SessionPayload = {
    durationSeconds: safeDurationSeconds,
    exp: issuedAt + safeDurationSeconds,
    iat: issuedAt,
    userId
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) return null;

  const expectedSignature = await sign(encodedPayload);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
    if (!isSessionPayload(payload)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getSessionSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(value)
  );

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function getSessionSecret(): string {
  return (
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "development-only-change-before-publishing"
  );
}

function isSessionPayload(payload: unknown): payload is SessionPayload {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.iat === "number" &&
    Number.isFinite(candidate.iat) &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp) &&
    (candidate.durationSeconds === undefined ||
      (typeof candidate.durationSeconds === "number" &&
        isAllowedSessionDuration(candidate.durationSeconds)))
  );
}

export function normalizeSessionDuration(durationSeconds: number): number {
  return isAllowedSessionDuration(durationSeconds)
    ? durationSeconds
    : SESSION_DURATION_SECONDS;
}

function isAllowedSessionDuration(durationSeconds: number): boolean {
  return (
    Number.isFinite(durationSeconds) &&
    (durationSeconds === SESSION_DURATION_SECONDS ||
      durationSeconds === REMEMBERED_SESSION_DURATION_SECONDS)
  );
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(textEncoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let result = a.length === b.length ? 0 : 1;

  for (let index = 0; index < maxLength; index += 1) {
    result |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }

  return result === 0;
}
