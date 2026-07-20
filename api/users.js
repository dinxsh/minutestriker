import fs from "node:fs/promises";
import path from "node:path";
import { readJsonBody, sendJson } from "./_bento.js";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

const SEEDED_USERS = [
  { id: "captain-aya", name: "Captain Aya", team: "Argentina", style: "Striker", wins: 18, losses: 4, points: 2840, streak: 9 },
  { id: "press-master", name: "Press Master", team: "France", style: "Midfield", wins: 15, losses: 5, points: 2410, streak: 6 },
  { id: "last-minute", name: "Last Minute", team: "Brazil", style: "Chaos", wins: 13, losses: 6, points: 2195, streak: 5 },
  { id: "clean-sheet", name: "Clean Sheet", team: "Japan", style: "Defense", wins: 11, losses: 7, points: 1880, streak: 4 },
];

export default async function handler(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, 200, { users: await readUsers() });
      return;
    }

    if (request.method === "POST") {
      const user = normalizeUser(await readJsonBody(request));
      if (!user.name) {
        sendJson(response, 400, { error: { message: "name is required", statusCode: 400 } });
        return;
      }

      const users = await readUsers();
      const existingIndex = users.findIndex((item) => item.id === user.id);
      const nextUsers = existingIndex >= 0
        ? users.map((item, index) => index === existingIndex ? { ...item, ...user } : item)
        : [...users, user];

      await writeUsers(nextUsers);
      sendJson(response, 200, { user, users: nextUsers });
      return;
    }

    if (request.method === "PATCH") {
      const body = await readJsonBody(request);
      const users = await readUsers();
      const nextUsers = users.map((user) => user.id === body.id ? applyResult(user, body.result) : user);
      const user = nextUsers.find((item) => item.id === body.id);

      if (!user) {
        sendJson(response, 404, { error: { message: "user not found", statusCode: 404 } });
        return;
      }

      await writeUsers(nextUsers);
      sendJson(response, 200, { user, users: nextUsers });
      return;
    }

    response.setHeader("Allow", "GET, POST, PATCH");
    sendJson(response, 405, { error: { message: "Method not allowed", statusCode: 405 } });
  } catch (error) {
    sendJson(response, 500, { error: { message: error.message, statusCode: 500 } });
  }
}

export async function readUsers() {
  await ensureUsersFile();
  const raw = await fs.readFile(USERS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.users) ? parsed.users.map(normalizeUser).filter((user) => user.id && user.name) : SEEDED_USERS;
}

async function writeUsers(users) {
  await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
  await fs.writeFile(USERS_FILE, `${JSON.stringify({ users: users.map(normalizeUser) }, null, 2)}\n`);
}

async function ensureUsersFile() {
  try {
    await fs.access(USERS_FILE);
  } catch {
    await writeUsers(SEEDED_USERS);
  }
}

function normalizeUser(value = {}) {
  const wins = numberFrom(value.wins, winsFromRecord(value.record));
  const losses = numberFrom(value.losses, lossesFromRecord(value.record));
  return {
    id: String(value.id || slugFrom(value.name) || `user-${Date.now()}`),
    name: String(value.name || "").trim(),
    team: String(value.team || "USA"),
    style: String(value.style || "Striker"),
    wins,
    losses,
    points: numberFrom(value.points, 1200 + wins * 80 - losses * 20),
    streak: numberFrom(value.streak, 0),
  };
}

function applyResult(user, result) {
  if (result === "loss") {
    return { ...user, losses: user.losses + 1, streak: 0, points: Math.max(0, user.points - 20) };
  }
  return { ...user, wins: user.wins + 1, streak: user.streak + 1, points: user.points + 80 };
}

function winsFromRecord(record) {
  return numberFrom(String(record || "").split("-")[0], 0);
}

function lossesFromRecord(record) {
  return numberFrom(String(record || "").split("-")[1], 0);
}

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slugFrom(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
