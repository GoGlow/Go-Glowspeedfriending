// api/clear-guests.js
// Wipes all guests and submissions for the current event — used by the host's
// "Clear guest list" button to start fresh (e.g. after testing, or between events
// if the same event_id is being reused). Requires the host PIN.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { eventId, pin } = req.body;

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  if (!eventId) {
    return res.status(400).json({ error: 'Missing eventId' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Delete submissions first (they reference guests via foreign key)
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?event_id=eq.${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers }
    );
    if (!subsRes.ok) {
      const err = await subsRes.text();
      return res.status(500).json({ error: `Failed to clear submissions: ${err}` });
    }

    // Then delete guests
    const guestsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/guests?event_id=eq.${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers }
    );
    if (!guestsRes.ok) {
      const err = await guestsRes.text();
      return res.status(500).json({ error: `Failed to clear guests: ${err}` });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
