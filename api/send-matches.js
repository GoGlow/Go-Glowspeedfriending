// api/send-matches.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { recipients, hostNote, eventName, fromName, fromEmail, pin } = req.body;

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  if (!recipients?.length) return res.status(400).json({ error: 'No recipients' });

  const results = [];

  for (const r of recipients) {
    if (!r.email || !r.matches?.length) continue;

    const html = buildEmail({ recipientName: r.name, matches: r.matches, hostNote, eventName, fromName });

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName || 'Speed Friending'} <${fromEmail || 'hello@resend.dev'}>`,
        to:   [r.email],
        subject: `Your matches from ${eventName || 'Speed Friending'} ✦`,
        html,
      }),
    });

    const data = await resp.json();
    results.push({ email: r.email, ok: resp.ok, data });
  }

  return res.status(200).json({ results });
}

function buildEmail({ recipientName, matches, hostNote, eventName, fromName }) {
  const cards = matches.map(m => `
    <div style="background:#fff8f6;border:1.5px solid #e8c4b8;border-radius:14px;padding:16px 18px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:15px;color:#1e1412;margin-bottom:5px;">${esc(m.name)}</div>
      ${m.email ? `<div style="font-size:13px;color:#9e7a72;margin-bottom:3px;">📧 <a href="mailto:${esc(m.email)}" style="color:#c97d6e;text-decoration:none;">${esc(m.email)}</a></div>` : ''}
      ${m.insta ? `<div style="font-size:13px;color:#9e7a72;">📸 <a href="https://instagram.com/${esc(m.insta.replace('@',''))}" style="color:#c97d6e;text-decoration:none;">${esc(m.insta)}</a></div>` : ''}
    </div>`).join('');

  const note = hostNote ? `
    <div style="background:#f7e8e0;border-radius:12px;padding:14px 18px;margin:20px 0;font-size:14px;color:#7a3728;line-height:1.6;font-style:italic;">
      "${esc(hostNote)}"<br>
      <span style="font-style:normal;font-weight:600;font-size:12px;margin-top:5px;display:block;">— ${esc(fromName || 'Your host')}</span>
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7e8e0;font-family:Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7e8e0;padding:28px 14px;">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;background:#fdfaf9;border-radius:20px;overflow:hidden;border:1px solid #e8c4b8;">
        <tr><td style="background:#7a3728;padding:24px 28px;text-align:center;">
          <div style="font-size:20px;color:#fdfaf9;font-weight:700;">${esc(eventName)} ✦</div>
          <div style="font-size:12px;color:#e8c4b8;margin-top:3px;">Your mutual matches</div>
        </td></tr>
        <tr><td style="padding:24px 28px;">
          <p style="font-size:15px;color:#1e1412;margin:0 0 6px;">Hi ${esc(recipientName)} 👋</p>
          <p style="font-size:13px;color:#9e7a72;margin:0 0 18px;line-height:1.6;">
            The feeling was mutual! Here ${matches.length === 1 ? 'is your match' : `are your ${matches.length} matches`} from tonight. Reach out and say hello 💌
          </p>
          ${cards}
          ${note}
          <p style="font-size:12px;color:#c4a49c;margin:18px 0 0;text-align:center;line-height:1.6;">
            Only mutual connections see each other's details.<br>See you at the next one ✦
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
