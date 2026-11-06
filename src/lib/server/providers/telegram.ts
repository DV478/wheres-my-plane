import { log } from '$lib/log';

const API = 'https://api.telegram.org';

export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function call<T>(token: string, method: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = (await resp.json()) as TgResponse<T>;
  if (!data.ok) {
    log.warn('telegram.error', { method, code: data.error_code, desc: data.description });
    throw new Error(`telegram ${method}: ${data.description ?? 'unknown'}`);
  }
  return data.result as T;
}

export async function sendMessage(
  env: TelegramEnv,
  chatId: string,
  text: string,
  opts: { parseMode?: 'MarkdownV2' | 'HTML'; disablePreview?: boolean } = {}
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
  await call(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode,
    disable_web_page_preview: opts.disablePreview ?? true
  });
}

export async function setWebhook(
  env: TelegramEnv,
  url: string,
  secretToken: string
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
  await call(env.TELEGRAM_BOT_TOKEN, 'setWebhook', {
    url,
    secret_token: secretToken,
    drop_pending_updates: true,
    allowed_updates: ['message']
  });
}

export async function deleteWebhook(env: TelegramEnv): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN missing');
  await call(env.TELEGRAM_BOT_TOKEN, 'deleteWebhook', { drop_pending_updates: true });
}

// MarkdownV2 escape — reserved chars per Telegram spec.
export function escapeMd(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (ch) => `\\${ch}`);
}
