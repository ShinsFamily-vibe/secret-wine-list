const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env.local manually
let ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || "";
try {
  const envFile = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const [k, v] = line.split("=");
    if (k?.trim() === "EXPO_PUBLIC_ANTHROPIC_API_KEY") {
      ANTHROPIC_KEY = v?.trim() ?? "";
      break;
    }
  }
} catch {}
console.log("API key loaded:", ANTHROPIC_KEY ? "YES" : "NO");
const PORT = 3001;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST" || (req.url !== "/analyze" && req.url !== "/chat")) {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const parsed = JSON.parse(body);
    const data = JSON.stringify(parsed);

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" });
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (e) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    });

    proxyReq.write(data);
    proxyReq.end();
  });
});

server.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
