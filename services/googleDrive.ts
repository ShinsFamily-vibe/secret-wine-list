const DRIVE_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";

export async function uploadPhoto(accessToken: string, base64Image: string, fileName: string): Promise<string> {
  const binary = atob(base64Image);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/jpeg" });

  const metadata = JSON.stringify({ name: fileName, mimeType: "image/jpeg" });

  const form = new FormData();
  form.append("metadata", new Blob([metadata], { type: "application/json" }));
  form.append("file", blob);

  const res = await fetch(`${DRIVE_API}?uploadType=multipart`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const data = await res.json();
  return data.id ?? "";
}

export async function makeFilePublic(accessToken: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

export function getDrivePhotoUrl(fileId: string): string {
  return `https://drive.google.com/uc?id=${fileId}&export=view`;
}

export async function deletePhoto(accessToken: string, fileId: string): Promise<void> {
  await fetch(`${DRIVE_FILES}/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
