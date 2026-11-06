import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import {
  consumeMagicToken,
  createSession,
  hashIp,
  setSessionCookie,
  upsertUserByEmail
} from '$lib/server/auth';

export const GET: RequestHandler = async ({ params, platform, cookies, request }) => {
  const db = platform?.env.DB;
  if (!db) throw error(500, 'Database unavailable.');

  const token = params.token;
  if (!token) throw error(400, 'Missing token.');

  const consumed = await consumeMagicToken(db, token);
  if (!consumed) throw error(400, 'This link is invalid or has expired.');

  const user = await upsertUserByEmail(db, consumed.email);

  const ua = request.headers.get('user-agent');
  const ip = request.headers.get('cf-connecting-ip');
  const ipHash = await hashIp(ip, platform.env.SESSION_SECRET);

  const sid = await createSession(db, user.id, { userAgent: ua, ipHash });
  setSessionCookie(cookies, sid);

  throw redirect(303, '/app');
};
