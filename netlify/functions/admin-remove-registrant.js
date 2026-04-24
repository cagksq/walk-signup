import { getStore } from "@netlify/blobs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

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

  const { walkId, email } = body;
  if (!walkId || !email) {
    return new Response(JSON.stringify({ error: "walkId and email are required" }), { status: 400, headers: cors });
  }

  const store = getStore("registrations");
  const data = await store.get(walkId, { type: "json" });
  const existing = data ?? [];

  const updated = existing.filter(r => r.email.toLowerCase() !== email.trim().toLowerCase());
  await store.set(walkId, JSON.stringify(updated));

  return new Response(JSON.stringify({ success: true, remaining: updated.length }), { headers: cors });
};

export const config = { path: "/api/admin/remove-registrant" };
