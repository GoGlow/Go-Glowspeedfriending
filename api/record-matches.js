// api/record-matches.js
// Records mutual matches (only mutual — never one-sided ticks) to a locked-down
// audit table, purely for safety/incident purposes. Guests already receive this
// same information via the match email, so nothing new is being disclosed by
// storing it — this just gives Go&Glow a durable record if it's ever needed.
// Auto-deleted after 6 months (see add-match-history.sql for the retention job).
// Requires the host PIN. Upserts so re-clicking "Find matches" doesn't create
// duplicate rows for the same pair.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { eventId, matches, pin } = req.body;

  if (pin !== process.env.HOST_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  if (!eventId || !Array.isArray(matches)) {
    return res.status(400).json({ error: 'Missing eventId or matches' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  // Only keep pairs where both sides have an email — sort each pair consistently
  // by email so the same two people always land in the same a/b order, letting
  // the unique constraint on (event_id, guest_a_email, guest_b_email) prevent
  // duplicate rows if "Find matches" is clicked more than once.
  const rows = matches
    .filter(m => m.aEmail && m.bEmail)
    .map(m => {
      const [first, second] = [
        { name: m.aName || '', email: m.aEmail, insta: m.aInsta || '' },
        { name: m.bName || '', email: m.bEmail, insta: m.bInsta || '' },
      ].sort((x, y) => x.email.localeCompare(y.email));

      return {
        event_id: eventId,
        guest_a_name: first.name,
        guest_a_email: first.email.toLowerCase(),
        guest_a_insta: first.insta,
        guest_b_name: second.name,
        guest_b_email: second.email.toLowerCase(),
        guest_b_insta: second.insta,
      };
    });

  if (!rows.length) {
    return res.status(200).json({ ok: true, recorded: 0 });
  }

  try {
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/match_history?on_conflict=event_id,guest_a_email,guest_b_email`,
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

    return res.status(200).json({ ok: true, recorded: rows.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
