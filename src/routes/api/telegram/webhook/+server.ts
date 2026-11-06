import { error, json, type RequestHandler } from '@sveltejs/kit';
import { sendMessage, escapeMd, type TelegramEnv } from '$lib/server/providers/telegram';
import { log } from '$lib/log';

const MUTE_SEC = 24 * 60 * 60;

interface TgUpdate {
  message?: {
    chat: { id: number | string };
    text?: string;
    from?: { id: number | string };
  };
}

interface UserRow {
  id: string;
  email: string;
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = platform?.env;
  if (!env?.DB) throw error(500, 'Infrastructure unavailable');
  if (!env.TELEGRAM_BOT_TOKEN) throw error(503, 'Telegram not configured.');
  if (!env.TELEGRAM_WEBHOOK_SECRET) throw error(503, 'Telegram webhook secret missing.');

  const auth = request.headers.get('x-telegram-bot-api-secret-token');
  if (auth !== env.TELEGRAM_WEBHOOK_SECRET) throw error(401, 'Bad secret.');

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    throw error(400, 'Invalid JSON.');
  }

  const msg = update.message;
  if (!msg?.text) return json({ ok: true, ignored: true });

  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const tgEnv: TelegramEnv = { TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN };

  try {
    if (text === '/start' || text === '/start@') {
      const base = env.PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';
      await sendMessage(
        tgEnv,
        chatId,
        [
          `Hi\\! I'm *Where's My Plane*\\.`,
          '',
          `1\\) Open ${escapeMd(base + '/app/settings')}`,
          '2\\) Copy your 6\\-digit link code',
          '3\\) Reply here with `/link 123456`',
          '',
          'Codes expire in 15 minutes\\.'
        ].join('\n'),
        { parseMode: 'MarkdownV2' }
      );
      return json({ ok: true });
    }

    const linkMatch = text.match(/^\/link\s+(\d{6})\b/);
    if (linkMatch) {
      const code = linkMatch[1];
      const now = Math.floor(Date.now() / 1000);
      const row = await env.DB
        .prepare(
          `SELECT c.user_id, c.expires_at, c.consumed_at
             FROM tg_link_codes c
            WHERE c.code = ?1 LIMIT 1`
        )
        .bind(code)
        .first<{ user_id: string; expires_at: number; consumed_at: number | null }>();
      if (!row) {
        await sendMessage(tgEnv, chatId, 'That code is not valid. Generate a fresh one at /app/settings.');
        return json({ ok: true });
      }
      if (row.consumed_at !== null) {
        await sendMessage(tgEnv, chatId, 'That code was already used. Generate a fresh one.');
        return json({ ok: true });
      }
      if (row.expires_at < now) {
        await sendMessage(tgEnv, chatId, 'That code expired. Generate a fresh one.');
        return json({ ok: true });
      }

      await env.DB.batch([
        env.DB
          .prepare('UPDATE tg_link_codes SET consumed_at = ?2 WHERE code = ?1')
          .bind(code, now),
        env.DB
          .prepare('UPDATE users SET tg_chat_id = ?2 WHERE id = ?1')
          .bind(row.user_id, chatId)
      ]);

      await sendMessage(
        tgEnv,
        chatId,
        'Linked. You will get alerts here when the flight agent notices a material change.'
      );
      return json({ ok: true });
    }

    if (text === '/status') {
      const user = await userByChat(env.DB, chatId);
      if (!user) {
        await sendMessage(tgEnv, chatId, 'Link your account first with /link <code>.');
        return json({ ok: true });
      }
      const rows = await env.DB
        .prepare(
          `SELECT f.flight_no, f.flight_date, f.origin_iata, f.dest_iata, f.status,
                  f.assigned_reg, fc.next_check_at
             FROM flights f
             JOIN flight_checks fc ON fc.flight_id = f.id
            WHERE f.user_id = ?1 AND fc.next_check_at IS NOT NULL
            ORDER BY f.sched_dep_utc ASC
            LIMIT 10`
        )
        .bind(user.id)
        .all<{
          flight_no: string;
          flight_date: string;
          origin_iata: string | null;
          dest_iata: string | null;
          status: string;
          assigned_reg: string | null;
          next_check_at: number;
        }>();
      const list = rows.results ?? [];
      if (list.length === 0) {
        await sendMessage(tgEnv, chatId, 'No active flights. Add one in the app.');
      } else {
        const body = list
          .map((r) => {
            const route = [r.origin_iata, r.dest_iata].filter(Boolean).join('→');
            const tail = r.assigned_reg ? ` · ${r.assigned_reg}` : '';
            return `• ${r.flight_no} ${r.flight_date} ${route} · ${r.status}${tail}`;
          })
          .join('\n');
        await sendMessage(tgEnv, chatId, body);
      }
      return json({ ok: true });
    }

    if (text === '/mute') {
      const user = await userByChat(env.DB, chatId);
      if (!user) {
        await sendMessage(tgEnv, chatId, 'Link your account first with /link <code>.');
        return json({ ok: true });
      }
      const now = Math.floor(Date.now() / 1000);
      await env.DB
        .prepare('UPDATE users SET alerts_paused_until = ?2 WHERE id = ?1')
        .bind(user.id, now + MUTE_SEC)
        .run();
      await sendMessage(tgEnv, chatId, 'Alerts paused for 24 hours. Send /unmute to resume early.');
      return json({ ok: true });
    }

    if (text === '/unmute') {
      const user = await userByChat(env.DB, chatId);
      if (!user) {
        await sendMessage(tgEnv, chatId, 'Link your account first with /link <code>.');
        return json({ ok: true });
      }
      await env.DB
        .prepare('UPDATE users SET alerts_paused_until = NULL WHERE id = ?1')
        .bind(user.id)
        .run();
      await sendMessage(tgEnv, chatId, 'Alerts resumed.');
      return json({ ok: true });
    }

    await sendMessage(
      tgEnv,
      chatId,
      'Commands: /start · /link <code> · /status · /mute · /unmute'
    );
    return json({ ok: true });
  } catch (err) {
    log.warn('telegram.webhook.err', { err: String(err) });
    // Always 200 back to Telegram so it does not retry forever.
    return json({ ok: true, handled: false });
  }
};

async function userByChat(db: App.Platform['env']['DB'], chatId: string): Promise<UserRow | null> {
  return db
    .prepare('SELECT id, email FROM users WHERE tg_chat_id = ?1 LIMIT 1')
    .bind(chatId)
    .first<UserRow>();
}
