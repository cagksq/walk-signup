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

  const { walks } = body;
  if (!Array.isArray(walks)) {
    return new Response(JSON.stringify({ error: "walks must be an array" }), { status: 400, headers: cors });
  }

  const store = getStore("walks-config");
  await store.set("walks", JSON.stringify(walks));

  return new Response(JSON.stringify({ success: true }), { headers: cors });
};

export const config = { path: "/api/admin/save-walks" };
