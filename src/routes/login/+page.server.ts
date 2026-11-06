import { fail, redirect, type Actions } from '@sveltejs/kit';
import { isInvited, issueMagicToken } from '$lib/server/auth';
import { sendMagicLink } from '$lib/server/email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
  default: async ({ request, platform, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();

    if (!platform?.env.DB) {
      return fail(500, { email, error: 'Database unavailable.' });
    }

    if (!EMAIL_RE.test(email)) {
      return fail(400, { email, error: "That doesn't look like an email." });
    }

    const invited = await isInvited(platform.env.DB, email);

    // Don't leak whether an address is on the allowlist.
    // Always respond "if you're invited, check your email."
    if (invited) {
      const token = await issueMagicToken(platform.env.DB, email);
      const base = platform.env.PUBLIC_BASE_URL || url.origin;
      const link = `${base}/magic/${token}`;

      try {
        await sendMagicLink({
          apiKey: platform.env.RESEND_API_KEY,
          from: platform.env.MAGIC_LINK_FROM,
          to: email,
          link
        });
      } catch (err) {
        // Dev convenience: log the link so you can sign in even if Resend isn't wired up yet.
        console.error('[magic-link] send failed, link is:', link, err);
        return fail(500, { email, error: 'Could not send email. Check server logs.' });
      }
    } else {
      // Deliberate throwaway work to flatten timing.
      await new Promise((r) => setTimeout(r, 200));
    }

    throw redirect(303, '/login/sent');
  }
};
