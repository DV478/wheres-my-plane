import type { Handle } from '@sveltejs/kit';
import { getSessionCookie, readSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  event.locals.sessionId = null;

  const db = event.platform?.env.DB;
  const sid = getSessionCookie(event.cookies);

  if (db && sid) {
    const user = await readSession(db, sid);
    if (user) {
      event.locals.user = {
        id: user.id,
        email: user.email,
        tgChatId: user.tg_chat_id,
        homeTz: user.home_tz
      };
      event.locals.sessionId = sid;
    }
  }

  return resolve(event);
};
