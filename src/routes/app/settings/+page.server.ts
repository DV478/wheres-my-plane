import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const LINK_CODE_TTL_SEC = 15 * 60;

function sixDigitCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw error(401, 'Unauthorised');
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database unavailable');
  const now = Math.floor(Date.now() / 1000);

  const latestCode = await db
    .prepare(
      `SELECT code, expires_at, consumed_at
         FROM tg_link_codes
        WHERE user_id = ?1
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .bind(locals.user.id)
    .first<{ code: string; expires_at: number; consumed_at: number | null }>();

  const activeCode =
    latestCode && latestCode.consumed_at === null && latestCode.expires_at > now
      ? { code: latestCode.code, expiresAt: latestCode.expires_at }
      : null;

  return {
    tgLinked: locals.user.tgChatId != null,
    tgChatId: locals.user.tgChatId,
    homeTz: locals.user.homeTz,
    activeCode
  };
};

export const actions: Actions = {
  generateCode: async ({ locals, platform }) => {
    if (!locals.user) return fail(401, { error: 'unauthorised' });
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'no_db' });

    const now = Math.floor(Date.now() / 1000);
    const code = sixDigitCode();

    // Invalidate prior unconsumed codes for the user.
    await db
      .prepare(
        `UPDATE tg_link_codes SET consumed_at = ?2
          WHERE user_id = ?1 AND consumed_at IS NULL`
      )
      .bind(locals.user.id, now)
      .run();

    await db
      .prepare(
        `INSERT INTO tg_link_codes (code, user_id, expires_at) VALUES (?1, ?2, ?3)`
      )
      .bind(code, locals.user.id, now + LINK_CODE_TTL_SEC)
      .run();

    return { code, expiresAt: now + LINK_CODE_TTL_SEC };
  },

  setTimezone: async ({ locals, platform, request }) => {
    if (!locals.user) return fail(401, { error: 'unauthorised' });
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'no_db' });

    const form = await request.formData();
    const tz = String(form.get('home_tz') ?? '').trim();
    if (!tz || !isValidTz(tz)) return fail(400, { error: 'bad_tz' });

    await db
      .prepare('UPDATE users SET home_tz = ?2 WHERE id = ?1')
      .bind(locals.user.id, tz)
      .run();

    return { ok: true, home_tz: tz };
  },

  unlinkTelegram: async ({ locals, platform }) => {
    if (!locals.user) return fail(401, { error: 'unauthorised' });
    const db = platform?.env.DB;
    if (!db) return fail(500, { error: 'no_db' });

    await db
      .prepare('UPDATE users SET tg_chat_id = NULL WHERE id = ?1')
      .bind(locals.user.id)
      .run();

    return { ok: true, unlinked: true };
  }
};
