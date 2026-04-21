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
  if (!IS_WEB && !CLAUDE_API_KEY) throw new Error("Claude API key not set. Check .env.local");
  if (!base64Image) throw new Error("No image data provided");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!IS_WEB) {
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
  if (!IS_WEB && !CLAUDE_API_KEY) throw new Error("Claude API key not set.");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!IS_WEB) {
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

export async function analyzeMenuForUser(
  base64Image: string,
  myWines: LikedWine[],
  buddyWines: LikedWine[],
  lang: "ko" | "en"
): Promise<string> {
  if (!IS_WEB && !CLAUDE_API_KEY) throw new Error("Claude API key not set.");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!IS_WEB) {
    headers["x-api-key"] = CLAUDE_API_KEY;
    headers["anthropic-version"] = "2023-06-01";
  }

  const formatWine = (w: LikedWine) =>
    `- ${w.name || "?"}${w.winery ? ` by ${w.winery}` : ""}${w.variety ? `, ${w.variety}` : ""}${w.region ? `, ${w.region}` : ""}${w.rating === "double_thumbs_up" ? " ⭐⭐" : " ⭐"}`;

  const myList = myWines.length > 0 ? myWines.map(formatWine).join("\n") : "(none yet)";
  const buddyList = buddyWines.length > 0 ? buddyWines.map(formatWine).join("\n") : "(none)";

  const instructions = lang === "ko"
    ? `이 와인 메뉴판 사진을 분석해주세요. 메뉴에서 모든 와인을 추출한 뒤, 아래 사용자의 취향을 바탕으로 가장 잘 맞는 와인 2~3개를 추천해주세요. 메뉴에 없는 와인은 추천하지 마세요. 각 추천에는 와인 이름, 가격(메뉴에 있으면), 추천 이유를 포함해주세요.`
    : `Analyze this wine menu photo. Extract all wines listed, then recommend 2-3 wines from this menu that best match the user's taste profile below. Only recommend wines actually on this menu. Include the wine name, price (if shown), and reason for each recommendation.`;

  const response = await fetch(ANALYZE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64Image },
          },
          {
            type: "text",
            text: `${instructions}\n\nMy liked wines (⭐=thumbs up, ⭐⭐=double thumbs up):\n${myList}\n\nBuddies' liked wines:\n${buddyList}`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return data.content[0].text.trim();
}

export interface ContextualPick {
  name: string;
  winery: string;
  variety?: string;
  owner?: string;
  reason: string;
}

export interface ContextualPicks {
  myPicks: ContextualPick[];
  buddyPick: ContextualPick | null;
}

export async function getContextualPicks(
  myTopWines: LikedWine[],
  buddyWines: LikedWine[],
  lang: "ko" | "en"
): Promise<ContextualPicks> {
  if (!IS_WEB && !CLAUDE_API_KEY) throw new Error("Claude API key not set.");
  if (myTopWines.length === 0) return { myPicks: [], buddyPick: null };

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!IS_WEB) {
    headers["x-api-key"] = CLAUDE_API_KEY;
    headers["anthropic-version"] = "2023-06-01";
  }

  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const timeOfDay = hour < 6 ? "late night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";

  const fmt = (w: LikedWine) =>
    `${w.name || "?"}${w.winery ? ` by ${w.winery}` : ""}${w.variety ? `, ${w.variety}` : ""}${w.region ? `, ${w.region}` : ""}`;

  const myList = myTopWines.map((w, i) => `${i + 1}. ${fmt(w)}`).join("\n");
  const buddyList = buddyWines.length > 0
    ? buddyWines.map((w, i) => `${i + 1}. ${fmt(w)} [by ${w.owner || "buddy"}]`).join("\n")
    : "";

  const reasonLang = lang === "ko" ? "Korean" : "English";
  const prompt = `Current context: ${timeOfDay}, ${season}, month ${month}.

From MY double-thumbs-up wines, pick exactly 2 that best suit this moment:
${myList}

${buddyList ? `From BUDDIES' liked wines, pick exactly 1 that best suits this moment:\n${buddyList}` : "No buddy wines."}

Respond ONLY with valid JSON (no markdown):
{"myPicks":[{"name":"...","winery":"...","variety":"...","reason":"one line in ${reasonLang}"},{"name":"...","winery":"...","variety":"...","reason":"..."}],"buddyPick":${buddyList ? `{"name":"...","winery":"...","variety":"...","owner":"...","reason":"..."}` : "null"}}`;

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data2 = await response.json();
  const text = data2.content[0].text.trim();
  try {
    return JSON.parse(text) as ContextualPicks;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ContextualPicks;
    return { myPicks: [], buddyPick: null };
  }
}
