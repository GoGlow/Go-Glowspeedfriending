// api/import-emails.js
// Host pastes a CSV (from Ticket Tailor export, or typed manually) of guest
// name+email pairs. This upserts them straight into the `guests` table —
// these become the people who appear on the name-select screen.
// Requires the host PIN as a basic guard.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { guests, eventId, pin } = req.body;
  // guests: [{ email, name }]

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  if (!guests?.length || !eventId) {
    return res.status(400).json({ error: 'Missing guests or eventId' });
  }

  const rows = guests.map(g => ({
    event_id: eventId,
    email:    g.email.trim().toLowerCase(),
    name:     g.name?.trim() || g.email.split('@')[0],
  }));

  const upsertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/guests?on_conflict=event_id,email`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    }
  );

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true, imported: rows.length });
}
