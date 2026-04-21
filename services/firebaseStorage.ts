import { deleteObject, getDownloadURL, ref, uploadString } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadPhotoFS(base64: string, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadString(storageRef, `data:image/jpeg;base64,${base64}`, "data_url");
  return await getDownloadURL(storageRef);
}

export async function deletePhotoFS(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {}
}
