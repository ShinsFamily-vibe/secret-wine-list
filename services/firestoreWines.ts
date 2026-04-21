import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Wine } from "../constants/types";
import { db } from "./firebase";

export async function addWineFS(wine: Wine, userId: string): Promise<string> {
  const ref = await addDoc(collection(db, "wines"), {
    ...wine,
    userId,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function fetchWinesFS(userId: string): Promise<Wine[]> {
  const q = query(collection(db, "wines"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Wine));
}

export async function fetchBuddyWinesFS(userId: string): Promise<Wine[]> {
  const q = query(collection(db, "wines"), where("userId", "==", userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Wine));
}

export async function updateWineFS(wineId: string, data: Partial<Wine>): Promise<void> {
  await updateDoc(doc(db, "wines", wineId), data as Record<string, unknown>);
}

export async function deleteWineFS(wineId: string): Promise<void> {
  await deleteDoc(doc(db, "wines", wineId));
}

// Comments
export interface Comment {
  id?: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export async function addComment(wineId: string, comment: Comment): Promise<void> {
  await addDoc(collection(db, "wines", wineId, "comments"), comment);
}

export async function fetchComments(wineId: string): Promise<Comment[]> {
  const q = query(collection(db, "wines", wineId, "comments"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Comment));
}

export async function deleteComment(wineId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, "wines", wineId, "comments", commentId));
}
