// Shared Claude proxy used by /api/analyze and /api/chat.
// Files starting with "_" inside /api are not exposed as routes by Vercel.
const https = require("https");

const ALLOWED_MODELS = new Set(["claude-sonnet-4-6"]);
const MAX_TOKENS_CAP = 2000;

// Verify a Firebase ID token by asking Firebase who it belongs to.
// Returns the user's uid, or null if the token is missing/invalid.
async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!idToken || !apiKey) return null;
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

// Only forward the fields the app actually uses, with a fixed model and a token cap.
function sanitizeBody(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return null;
  const model = ALLOWED_MODELS.has(body.model) ? body.model : "claude-sonnet-4-6";
  const maxTokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS_CAP);
  const clean = { model, max_tokens: maxTokens, messages: body.messages };
  if (typeof body.system === "string") clean.system = body.system;
  return clean;
}

function proxyToAnthropic(key, body, res) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (r) => {
        res.status(r.statusCode);
        r.pipe(res);
        r.on("end", resolve);
      }
    );
    req.on("error", (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });
    req.write(body);
    req.end();
  });
}

module.exports = async function handleClaude(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "API key not configured" }); return; }

  const auth = req.headers.authorization || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const uid = await verifyFirebaseToken(idToken);
  if (!uid) { res.status(401).json({ error: "Login required" }); return; }

  const clean = sanitizeBody(req.body);
  if (!clean) { res.status(400).json({ error: "Invalid request" }); return; }

  await proxyToAnthropic(key, JSON.stringify(clean), res);
};
