// HMAC-SHA256 user id, truncated to 16 hex chars. Used for `events.user_hash`
// so exported events can be analysed without re-identifying the user.
export async function hashUser(userId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(userId));
  const bytes = new Uint8Array(sig);
  let out = '';
  for (let i = 0; i < 8; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}
