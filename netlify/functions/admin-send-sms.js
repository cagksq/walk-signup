import { getStore } from "@netlify/blobs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

function toE164(cell) {
  const digits = cell.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return null;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers: cors });
  }

  const { walkId, message } = body;
  if (!walkId || !message) {
    return new Response(JSON.stringify({ error: "walkId and message are required" }), { status: 400, headers: cors });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return new Response(JSON.stringify({ error: "Twilio credentials not configured. See setup instructions." }), { status: 500, headers: cors });
  }

  const store = getStore("registrations");
  const data = await store.get(walkId, { type: "json" });
  const registrants = data ?? [];

  if (registrants.length === 0) {
    return new Response(JSON.stringify({ error: "No registrants for this walk" }), { status: 400, headers: cors });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const results = [];
  for (const r of registrants) {
    const to = toE164(r.cell);
    if (!to) {
      results.push({ name: `${r.firstName} ${r.lastName}`, success: false, error: "Invalid phone number" });
      continue;
    }
    try {
      const res = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ From: TWILIO_FROM_NUMBER, To: to, Body: message }).toString()
      });
      const json = await res.json();
      if (res.ok) {
        results.push({ name: `${r.firstName} ${r.lastName}`, success: true });
      } else {
        results.push({ name: `${r.firstName} ${r.lastName}`, success: false, error: json.message || "Send failed" });
      }
    } catch (e) {
      results.push({ name: `${r.firstName} ${r.lastName}`, success: false, error: e.message });
    }
  }

  return new Response(JSON.stringify({ results }), { headers: cors });
};

export const config = { path: "/api/admin/send-sms" };
