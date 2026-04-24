import { getStore } from "@netlify/blobs";
import { readFileSync } from "fs";
import { join } from "path";

const walks = JSON.parse(readFileSync(join(__dirname, "../../data/walks.json"), "utf8"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json"
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const store = getStore("registrations");

  const result = [];
  for (const walk of walks) {
    const data = await store.get(walk.id, { type: "json" });
    const existing = data ?? [];
    result.push({
      id: walk.id,
      title: walk.title,
      date: walk.date,
      time: walk.time,
      location: walk.location,
      capacity: walk.capacity,
      registrants: existing.map(r => ({ firstName: r.firstName, lastName: r.lastName })),
      full: existing.length >= walk.capacity,
      count: existing.length
    });
  }

  return new Response(JSON.stringify(result), { headers: cors });
};

export const config = { path: "/api/walks" };
