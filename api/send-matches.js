// api/send-matches.js
// Sends each recipient an email listing only their own mutual matches, via Resend.
// Requires the host PIN. Returns a per-recipient result so the host can see exactly
// which emails succeeded and, for any that failed, why.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { recipients, hostNote, eventName, fromName, fromEmail, pin } = req.body;

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  if (!Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ error: 'No recipients provided' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not set in Vercel environment variables' });
  }

  // Resend only allows sending from this exact address until a custom domain
  // is verified — any other @resend.dev address (or unverified domain) will
  // be rejected. This is intentionally NOT configurable via the UI to avoid
  // this exact failure mode; once a real domain is verified in Resend, update
  // this constant (or wire it back to a verified fromEmail from cfg).
  const VERIFIED_SENDER = 'onboarding@resend.dev';
  const senderName = fromName || 'Go&Glow';
  const senderEmail = (fromEmail && fromEmail !== 'hello@resend.dev') ? fromEmail : VERIFIED_SENDER;

  const results = [];

  for (const person of recipients) {
    if (!person.email) {
      results.push({ email: person.name || '(no email)', ok: false, error: 'No email address on file' });
      continue;
    }

    const matchListHtml = (person.matches || []).map(m => `
      <div style="background:#fce8f2;border:1.5px solid #fad4e8;border-radius:12px;padding:0.9rem 1.1rem;margin-bottom:0.6rem;">
        <div style="font-weight:800;font-size:0.95rem;color:#2a2a2a;margin-bottom:0.35rem;">${escapeHtml(m.name || '?')}</div>
        ${m.email ? `<div style="font-size:0.8rem;color:#6b6b6b;">📧 <a href="mailto:${escapeHtml(m.email)}" style="color:#d4568e;text-decoration:none;">${escapeHtml(m.email)}</a></div>` : ''}
        ${m.phone ? `<div style="font-size:0.8rem;color:#6b6b6b;">📞 ${escapeHtml(m.phone)}</div>` : ''}
        ${m.whatsapp ? `<div style="font-size:0.8rem;color:#6b6b6b;">💬 ${escapeHtml(m.whatsapp)}</div>` : ''}
        ${m.insta ? `<div style="font-size:0.8rem;color:#6b6b6b;">📸 ${escapeHtml(m.insta)}</div>` : ''}
      </div>
    `).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;">
        <div style="background:#f27db6;padding:1.75rem 2rem;text-align:center;border-radius:16px 16px 0 0;">
          <div style="font-size:1.4rem;font-weight:800;font-style:italic;color:#fff;">${escapeHtml(eventName || 'Go&Glow')} ✨</div>
          <div style="font-size:0.75rem;color:rgba(255,255,255,0.85);margin-top:0.2rem;">Your mutual matches</div>
        </div>
        <div style="padding:1.5rem 2rem;background:#fff;border-radius:0 0 16px 16px;">
          <div style="font-size:0.9rem;font-weight:700;color:#2a2a2a;margin-bottom:0.4rem;">Hi ${escapeHtml(person.name || 'there')}! 👋</div>
          <div style="font-size:0.8rem;color:#6b6b6b;line-height:1.6;margin-bottom:1.1rem;">The feeling was mutual! Here ${(person.matches||[]).length === 1 ? 'is your match' : 'are your matches'} from tonight 💕</div>
          ${matchListHtml}
          ${hostNote ? `<div style="background:#fad4e8;border-radius:10px;font-style:italic;font-size:0.8rem;color:#d4568e;line-height:1.6;padding:0.9rem 1.1rem;margin-top:0.75rem;">"${escapeHtml(hostNote)}"</div>` : ''}
          <div style="font-size:0.68rem;color:#c8c8c8;text-align:center;margin-top:1rem;">Only mutual connections see each other's details.</div>
        </div>
      </div>
    `;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: person.email,
          subject: `Your matches from ${eventName || 'Go&Glow'} ✨`,
          html,
        }),
      });

      const data = await resendRes.json();

      if (!resendRes.ok) {
        results.push({ email: person.email, ok: false, error: data.message || JSON.stringify(data) });
      } else {
        results.push({ email: person.email, ok: true });
      }
    } catch (e) {
      results.push({ email: person.email, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ results });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
