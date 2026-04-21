import { Platform } from "react-native";
import { CLAUDE_API_KEY } from "./config";

const IS_WEB = Platform.OS === "web";
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

const ANALYZE_URL = IS_WEB
  ? (IS_DEV ? "http://localhost:3001/analyze" : "/api/analyze")
  : "https://api.anthropic.com/v1/messages";

const CHAT_URL = IS_WEB
  ? (IS_DEV ? "http://localhost:3001/chat" : "/api/chat")
  : "https://api.anthropic.com/v1/messages";

const API_URL = ANALYZE_URL;

export interface WineInfo {
  name: string;
  winery: string;
  vintage: string;
  region: string;
  variety: string;
  estimatedPrice: string;
}

export async function analyzeWineLabel(base64Image: string): Promise<WineInfo> {
  if (!CLAUDE_API_KEY) throw new Error("Claude API key not set. Check .env.local");
  if (!base64Image) throw new Error("No image data provided");

  const isWeb = Platform.OS === "web";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!isWeb) {
    headers["x-api-key"] = CLAUDE_API_KEY;
    headers["anthropic-version"] = "2023-06-01";
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Look at this wine label image. Extract all wine information visible on the label, then use your wine knowledge to fill in any missing fields.

Return ONLY a valid JSON object with these exact keys: name, winery, vintage, region, variety.
- name: full wine name (e.g. "Opus One", "Chateau Margaux")
- winery: producer/winery name
- vintage: year visible on label or capsule (e.g. "2018"). If not visible, leave empty — do NOT guess.
- region: appellation/region/country (e.g. "Napa Valley, California, USA")
- variety: grape variety or blend (e.g. "Cabernet Sauvignon", "Bordeaux blend")
- estimatedPrice: your best estimate of the retail price range in USD based on the wine's producer, region, and reputation (e.g. "$40-60", "$150-200", "$20-30"). Use your wine knowledge even if not on label.

If a field is not on the label but you can infer it from the wine name/winery, use your knowledge to fill it in. Do not include any explanation or markdown.

Example: {"name":"Opus One","winery":"Opus One Winery","vintage":"2019","region":"Napa Valley, California, USA","variety":"Cabernet Sauvignon blend","estimatedPrice":"$280-320"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  try {
    return JSON.parse(text) as WineInfo;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as WineInfo;
    throw new Error(`Could not parse response: ${text}`);
  }
}

export interface LikedWine {
  name: string;
  winery: string;
  vintage: string;
  region: string;
  variety: string;
  rating: string;
  price?: string;
  estimatedPrice?: string;
  owner?: string;
}

export async function askWineAdvice(
  myWines: LikedWine[],
  buddyWines: LikedWine[],
  question: string
): Promise<string> {
  if (!CLAUDE_API_KEY) throw new Error("Claude API key not set.");

  const isWeb = Platform.OS === "web";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!isWeb) {
    headers["x-api-key"] = CLAUDE_API_KEY;
    headers["anthropic-version"] = "2023-06-01";
  }

  const formatWine = (w: LikedWine) =>
    `- ${w.name || "Unknown"}${w.winery ? ` by ${w.winery}` : ""}${w.vintage ? ` (${w.vintage})` : ""}${w.region ? `, ${w.region}` : ""}${w.variety ? `, ${w.variety}` : ""}${w.rating === "double_thumbs_up" ? " ⭐⭐" : " ⭐"}${w.price ? ` ~${w.price}` : w.estimatedPrice ? ` ~${w.estimatedPrice}` : ""}`;

  const myList = myWines.length > 0 ? myWines.map(formatWine).join("\n") : "(none)";
  const buddyList = buddyWines.length > 0 ? buddyWines.map(formatWine).join("\n") : "(none)";

  const systemPrompt = `You are an expert sommelier and wine advisor. You have access to the user's wine preferences based on their personal wine list and their friends' lists. Use this data to give personalized, specific wine recommendations. Be conversational, warm, and knowledgeable. Respond in the same language as the user's question (Korean or English).`;

  const userPrompt = `My liked wines (⭐ = thumbs up, ⭐⭐ = double thumbs up):
${myList}

My buddies' liked wines:
${buddyList}

My question: ${question}

Please:
1. First, recommend up to 3 wines from my existing list (or buddies' list) that best fit my request.
2. Then suggest 3–5 new wines I haven't tried that match my taste profile and request.
For each suggestion include: wine name, producer, approximate price range, and a one-sentence reason why I'd like it.`;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}
