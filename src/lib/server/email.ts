import { Resend } from 'resend';

export interface SendMagicLinkArgs {
  apiKey: string;
  from: string;
  to: string;
  link: string;
}

export async function sendMagicLink({ apiKey, from, to, link }: SendMagicLinkArgs): Promise<void> {
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Sign in to Where's My Plane",
    html: renderHtml(link),
    text: renderText(link)
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

function renderText(link: string): string {
  return [
    "Sign in to Where's My Plane",
    '',
    'Click the link below to sign in. The link expires in 15 minutes.',
    '',
    link,
    '',
    "If you did not request this, you can ignore the email."
  ].join('\n');
}

function renderHtml(link: string): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, system-ui, sans-serif; background:#0b1020; color:#e2e8f0; padding:32px;">
    <div style="max-width:520px; margin:0 auto; background:#111733; border-radius:12px; padding:32px;">
      <h1 style="margin:0 0 16px; font-size:20px;">Sign in to Where's My Plane</h1>
      <p style="margin:0 0 24px; color:#a5b4cf; line-height:1.5;">Click the button below to sign in. The link expires in 15 minutes.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(link)}" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">Sign in</a>
      </p>
      <p style="margin:0; color:#64748b; font-size:12px; word-break:break-all;">If the button doesn't work, paste this into your browser:<br />${escapeHtml(link)}</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}
