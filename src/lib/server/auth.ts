import type { D1Database } from '@cloudflare/workers-types';
import type { Cookies } from '@sveltejs/kit';
import { randomId, sha256Hex } from './random';

const MAGIC_TOKEN_TTL_SEC = 15 * 60;
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
const SESSION_COOKIE = 'wmp_sid';

export interface UserRow {
  id: string;
  email: string;
  tg_chat_id: string | null;
  home_tz: string | null;
}

export async function isInvited(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM invites WHERE email = ?1 LIMIT 1')
    .bind(email.toLowerCase())
    .first();
  return row !== null;
}

export async function issueMagicToken(db: D1Database, email: string): Promise<string> {
  const token = randomId(32);
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_TOKEN_TTL_SEC;
  await db
    .prepare('INSERT INTO magic_tokens (token, email, expires_at) VALUES (?1, ?2, ?3)')
    .bind(token, email.toLowerCase(), expiresAt)
    .run();
  return token;
}

export async function consumeMagicToken(
  db: D1Database,
  token: string
): Promise<{ email: string } | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      'SELECT email, expires_at, consumed_at FROM magic_tokens WHERE token = ?1 LIMIT 1'
    )
    .bind(token)
    .first<{ email: string; expires_at: number; consumed_at: number | null }>();

  if (!row) return null;
  if (row.consumed_at !== null) return null;
  if (row.expires_at < now) return null;

  await db
    .prepare('UPDATE magic_tokens SET consumed_at = ?2 WHERE token = ?1')
    .bind(token, now)
    .run();

  return { email: row.email };
}

export async function upsertUserByEmail(db: D1Database, email: string): Promise<UserRow> {
  const normalised = email.toLowerCase();
  const existing = await db
    .prepare('SELECT id, email, tg_chat_id, home_tz FROM users WHERE email = ?1 LIMIT 1')
    .bind(normalised)
    .first<UserRow>();

  const now = Math.floor(Date.now() / 1000);
  if (existing) {
    await db
      .prepare('UPDATE users SET last_login_at = ?2 WHERE id = ?1')
      .bind(existing.id, now)
      .run();
    return existing;
  }

  const id = randomId(16);
  await db
    .prepare(
      'INSERT INTO users (id, email, last_login_at) VALUES (?1, ?2, ?3) RETURNING id, email, tg_chat_id, home_tz'
    )
    .bind(id, normalised, now)
    .run();

  return { id, email: normalised, tg_chat_id: null, home_tz: null };
}

export async function createSession(
  db: D1Database,
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {}
): Promise<string> {
  const id = randomId(32);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5)'
    )
    .bind(id, userId, expiresAt, meta.userAgent ?? null, meta.ipHash ?? null)
    .run();
  return id;
}

export async function readSession(
  db: D1Database,
  sessionId: string
): Promise<UserRow | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.tg_chat_id, u.home_tz, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?1 LIMIT 1`
    )
    .bind(sessionId)
    .first<UserRow & { expires_at: number }>();

  if (!row) return null;
  if (row.expires_at < now) {
    await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(sessionId).run();
    return null;
  }
  return { id: row.id, email: row.email, tg_chat_id: row.tg_chat_id, home_tz: row.home_tz };
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?1').bind(sessionId).run();
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SEC
  });
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function getSessionCookie(cookies: Cookies): string | null {
  return cookies.get(SESSION_COOKIE) ?? null;
}

export async function hashIp(ip: string | null, secret: string): Promise<string | null> {
  if (!ip) return null;
  return sha256Hex(`${secret}:${ip}`);
}
