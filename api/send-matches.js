// api/send-matches.js
// Sends each recipient an email listing only their own mutual matches, via Mailjet.
// Requires the host PIN. Uses Mailjet's batch send (all emails in one API call),
// then maps the per-message results back so the host still sees an accurate
// per-recipient success/failure count.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { recipients, hostNote, eventName, fromName, fromEmail, pin } = req.body;

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  if (!Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ error: 'No recipients provided' });
  }

  const MAILJET_API_KEY    = process.env.MAILJET_API_KEY;
  const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;

  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    return res.status(500).json({ error: 'MAILJET_API_KEY / MAILJET_SECRET_KEY not set in Vercel environment variables' });
  }

  const senderName  = fromName  || 'Go&Glow';
  const senderEmail = fromEmail || 'hello@goandglow.org';

  const validRecipients = [];
  const skipped = [];

  recipients.forEach(person => {
    if (!person.email) {
      skipped.push({ email: person.name || '(no email)', ok: false, error: 'No email address on file' });
      return;
    }
    validRecipients.push(person);
  });

  const messages = validRecipients.map(person => {
    const matchListHtml = (person.matches || []).map(m => `
      <div style="background:#fce8f2;border:1.5px solid #fad4e8;border-radius:12px;padding:0.9rem 1.1rem;margin-bottom:0.6rem;">
        <div style="font-weight:800;font-size:0.95rem;color:#2a2a2a;margin-bottom:0.35rem;">${escapeHtml(m.name || '?')}</div>
        ${m.email ? `<div style="font-size:0.8rem;color:#6b6b6b;">📧 <a href="mailto:${escapeHtml(m.email)}" style="color:#d4568e;text-decoration:none;">${escapeHtml(m.email)}</a></div>` : ''}
        ${m.phone ? `<div style="font-size:0.8rem;color:#6b6b6b;">📞 ${escapeHtml(m.phone)}</div>` : ''}
        ${m.whatsapp ? `<div style="font-size:0.8rem;color:#6b6b6b;"><span style="display:inline-block;width:14px;height:14px;background-color:#25D366;border-radius:3px;color:#ffffff;font-size:9px;font-weight:bold;line-height:14px;text-align:center;vertical-align:middle;margin-right:5px;">W</span> ${escapeHtml(m.whatsapp)}</div>` : ''}
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

    return {
      From: { Email: senderEmail, Name: senderName },
      To: [{ Email: person.email, Name: person.name || undefined }],
      Subject: `Your matches from ${eventName || 'Go&Glow'} ✨`,
      HTMLPart: html,
    };
  });

  let results = [...skipped];

  if (messages.length) {
    try {
      const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

      const mjRes = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ Messages: messages }),
      });

      const data = await mjRes.json();

      if (!mjRes.ok) {
        const errMsg = data.ErrorMessage || JSON.stringify(data);
        validRecipients.forEach(person => {
          results.push({ email: person.email, ok: false, error: errMsg });
        });
      } else {
        (data.Messages || []).forEach((msgResult, i) => {
          const person = validRecipients[i];
          if (msgResult.Status === 'success') {
            results.push({ email: person.email, ok: true });
          } else {
            const errDetail = (msgResult.Errors || [])
              .map(e => e.ErrorMessage)
              .filter(Boolean)
              .join('; ') || msgResult.Status;
            results.push({ email: person.email, ok: false, error: errDetail });
          }
        });
      }
    } catch (e) {
      validRecipients.forEach(person => {
        results.push({ email: person.email, ok: false, error: e.message });
      });
    }
  }

  return res.status(200).json({ results });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
