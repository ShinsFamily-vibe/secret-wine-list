export type Rating = "thumbs_down" | "thumbs_up" | "double_thumbs_up";

export interface Wine {
  id: string;
  name: string;
  winery: string;
  vintage: string;
  region: string;
  variety: string;
  rating: Rating;
  price: string;
  notes: string;
  drivePhotoId?: string; // comma-separated list of Drive file IDs
  thumbnail?: string;   // small base64 data URL for list display
  addedAt: string;
  estimatedPrice?: string;
  rowIndex?: number;
}

export interface LocalPhoto {
  uri: string;
  base64: string;
}
