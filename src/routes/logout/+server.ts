import { redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie, deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ platform, cookies, locals }) => {
  const db = platform?.env.DB;
  if (db && locals.sessionId) {
    await deleteSession(db, locals.sessionId);
  }
  clearSessionCookie(cookies);
  throw redirect(303, '/');
};
