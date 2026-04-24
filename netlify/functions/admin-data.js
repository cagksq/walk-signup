import { getStore } from "@netlify/blobs";
import { readFileSync } from "fs";
import { join } from "path";

const fallbackWalks = JSON.parse(readFileSync(join(__dirname, "../../data/walks.json"), "utf8"));

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-password",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json"
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const configStore = getStore("walks-config");
  const configData = await configStore.get("walks", { type: "json" });
  const walks = configData ?? fallbackWalks;

  const regStore = getStore("registrations");
  const waitStore = getStore("waitlist");

  const result = [];
  for (const walk of walks) {
    const [regData, waitData] = await Promise.all([
      regStore.get(walk.id, { type: "json" }),
      waitStore.get(walk.id, { type: "json" })
    ]);
    result.push({
      ...walk,
      registrants: regData ?? [],
      waitlist: waitData ?? []
    });
  }

  return new Response(JSON.stringify(result), { headers: cors });
};

export const config = { path: "/api/admin/data" };
