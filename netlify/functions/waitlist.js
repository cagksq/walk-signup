import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import { readFileSync } from "fs";
import { join } from "path";

const fallbackWalks = JSON.parse(readFileSync(join(__dirname, "../../data/walks.json"), "utf8"));
const resend = new Resend(process.env.RESEND_API_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
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

  const { walkId, firstName, lastName, email, cell } = body;

  if (!walkId || !firstName || !lastName || !email || !cell) {
    return new Response(JSON.stringify({ error: "All fields are required" }), { status: 400, headers: cors });
  }

  const configStore = getStore("walks-config");
  const configData = await configStore.get("walks", { type: "json" });
  const walks = configData ?? fallbackWalks;

  const walk = walks.find(w => w.id === walkId);
  if (!walk) {
    return new Response(JSON.stringify({ error: "Walk not found" }), { status: 404, headers: cors });
  }

  const store = getStore("waitlist");
  const data = await store.get(walkId, { type: "json" });
  const existing = data ?? [];

  if (existing.some(r => r.email.toLowerCase() === email.trim().toLowerCase())) {
    return new Response(JSON.stringify({ error: "This email is already on the waitlist for this walk" }), { status: 409, headers: cors });
  }

  const entry = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    cell: cell.trim(),
    addedAt: new Date().toISOString()
  };

  existing.push(entry);
  await store.set(walkId, JSON.stringify(existing));

  try {
    await resend.emails.send({
      from: "Nature Walks <onboarding@resend.dev>",
      to: "clarkegreen@gmail.com",
      subject: `Waitlist signup: ${walk.title}`,
      html: `
        <p><strong>${entry.firstName} ${entry.lastName}</strong> joined the waitlist for ${walk.title}.</p>
        <p>Email: ${entry.email}<br>Cell: ${entry.cell}</p>
        <p>${existing.length} on waitlist.</p>
      `
    });
  } catch (e) {
    console.error("Email send failed:", e.message);
  }

  return new Response(JSON.stringify({ success: true }), { headers: cors });
};

export const config = { path: "/api/waitlist" };
