const https = require("https");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: "API key not configured" }); return; }

  const body = JSON.stringify(req.body);
  await proxyToAnthropic(key, body, res);
};

function proxyToAnthropic(key, body, res) {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (r) => {
      res.status(r.statusCode);
      r.pipe(res);
      r.on("end", resolve);
    });
    req.on("error", (e) => { res.status(500).json({ error: e.message }); resolve(); });
    req.write(body);
    req.end();
  });
}
