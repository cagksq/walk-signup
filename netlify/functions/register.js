import { getStore } from "@netlify/blobs";
import { Resend } from "resend";
import { readFileSync } from "fs";
import { join } from "path";

const walks = JSON.parse(readFileSync(join(__dirname, "../../data/walks.json"), "utf8"));

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

  const walk = walks.find(w => w.id === walkId);
  if (!walk) {
    return new Response(JSON.stringify({ error: "Walk not found" }), { status: 404, headers: cors });
  }

  const store = getStore("registrations");
  const data = await store.get(walk.id, { type: "json" });
  const existing = data ?? [];

  if (existing.length >= walk.capacity) {
    return new Response(JSON.stringify({ error: "This walk is full" }), { status: 409, headers: cors });
  }

  if (existing.some(r => r.email.toLowerCase() === email.trim().toLowerCase())) {
    return new Response(JSON.stringify({ error: "This email is already registered for this walk" }), { status: 409, headers: cors });
  }

  const registration = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    cell: cell.trim(),
    registeredAt: new Date().toISOString()
  };

  existing.push(registration);
  await store.set(walk.id, JSON.stringify(existing));

  // Send emails — using onboarding@resend.dev for local testing
  // Before going live, switch "from" to a verified domain address
  try {
    await Promise.all([
      resend.emails.send({
        from: "Nature Walks <onboarding@resend.dev>",
        to: registration.email,
        subject: `You're signed up: ${walk.title}`,
        html: `<p>Hi ${registration.firstName},</p><p>You're signed up for the Nature Walk on ${walk.date.split(", ").slice(0, 2).join(", ")}. Meet at the main parking lot at Anson B. Nixon Park at 9:30 AM. Cancellations announced by text as far in advance as possible.</p>`
      }),
      resend.emails.send({
        from: "Nature Walks <onboarding@resend.dev>",
        to: "clarkegreen@gmail.com",
        subject: `New signup: ${walk.title}`,
        html: `
          <p><strong>${registration.firstName} ${registration.lastName}</strong> signed up for ${walk.title}.</p>
          <p>Email: ${registration.email}<br>Cell: ${registration.cell}</p>
          <p>${existing.length} of ${walk.capacity} spots filled.</p>
        `
      })
    ]);
  } catch (e) {
    console.error("Email send failed:", e.message);
  }

  return new Response(JSON.stringify({
    success: true,
    spotsLeft: walk.capacity - existing.length
  }), { headers: cors });
};

export const config = { path: "/api/register" };
