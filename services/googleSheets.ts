import { Wine } from "../constants/types";
import { SHEET_NAME } from "./config";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

const HEADERS = ["id", "name", "winery", "vintage", "region", "variety", "rating", "price", "notes", "drivePhotoId", "addedAt", "estimatedPrice", "thumbnail"];
const RANGE = `${SHEET_NAME}!A:M`;

export async function ensureSheet(spreadsheetId: string, accessToken: string): Promise<void> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const sheets: { properties: { title: string } }[] = data.sheets ?? [];
  const exists = sheets.some((s) => s.properties.title === SHEET_NAME);
  if (!exists) {
    await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    });
    await appendRow(spreadsheetId, accessToken, HEADERS);
  }
}

async function appendRow(spreadsheetId: string, accessToken: string, values: string[]): Promise<void> {
  await fetch(`${SHEETS_API}/${spreadsheetId}/values/${RANGE}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [values] }),
  });
}

export async function addWine(spreadsheetId: string, accessToken: string, wine: Wine): Promise<void> {
  const row = [
    wine.id, wine.name, wine.winery, wine.vintage, wine.region, wine.variety,
    wine.rating, wine.price, wine.notes, wine.drivePhotoId ?? "", wine.addedAt,
    wine.estimatedPrice ?? "", wine.thumbnail ?? "",
  ];
  await appendRow(spreadsheetId, accessToken, row);
}

export async function fetchWines(spreadsheetId: string, accessToken: string): Promise<Wine[]> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${RANGE}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  if (rows.length < 2) return [];

  return rows.slice(1).map((row, i) => ({
    id: row[0] ?? "",
    name: row[1] ?? "",
    winery: row[2] ?? "",
    vintage: row[3] ?? "",
    region: row[4] ?? "",
    variety: row[5] ?? "",
    rating: (row[6] as Wine["rating"]) ?? "thumbs_up",
    price: row[7] ?? "",
    notes: row[8] ?? "",
    drivePhotoId: row[9] ?? "",
    addedAt: row[10] ?? "",
    estimatedPrice: row[11] ?? "",
    thumbnail: row[12] ?? "",
    rowIndex: i + 2,
  }));
}

export async function updateWine(spreadsheetId: string, accessToken: string, wine: Wine): Promise<void> {
  if (!wine.rowIndex) return;
  const row = [
    wine.id, wine.name, wine.winery, wine.vintage, wine.region, wine.variety,
    wine.rating, wine.price, wine.notes, wine.drivePhotoId ?? "", wine.addedAt,
    wine.estimatedPrice ?? "", wine.thumbnail ?? "",
  ];
  await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${SHEET_NAME}!A${wine.rowIndex}:M${wine.rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    }
  );
}

export async function deleteWine(spreadsheetId: string, accessToken: string, wine: Wine): Promise<void> {
  if (!wine.rowIndex) return;
  const sheetRes = await fetch(`${SHEETS_API}/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const sheetData = await sheetRes.json();
  const sheet = sheetData.sheets?.find((s: { properties: { title: string; sheetId: number } }) => s.properties.title === SHEET_NAME);
  if (!sheet) return;

  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: wine.rowIndex - 1,
            endIndex: wine.rowIndex,
          },
        },
      }],
    }),
  });
}

export async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const res = await fetch(SHEETS_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } }),
  });
  const data = await res.json();
  return data.spreadsheetId;
}
