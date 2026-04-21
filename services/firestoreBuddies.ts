import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await setDoc(doc(db, "users", profile.uid), profile, { merge: true });
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserProfile;
}

export async function addBuddy(myUid: string, buddyUid: string): Promise<void> {
  await setDoc(doc(db, "buddies", myUid, "list", buddyUid), { addedAt: Date.now() });
  await setDoc(doc(db, "buddies", buddyUid, "list", myUid), { addedAt: Date.now() });
}

export async function removeBuddy(myUid: string, buddyUid: string): Promise<void> {
  await deleteDoc(doc(db, "buddies", myUid, "list", buddyUid));
  await deleteDoc(doc(db, "buddies", buddyUid, "list", myUid));
}

export async function fetchBuddies(myUid: string): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "buddies", myUid, "list"));
  const uids = snap.docs.map((d) => d.id);
  if (uids.length === 0) return [];

  const profiles: UserProfile[] = [];
  for (const uid of uids) {
    const userSnap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
    if (!userSnap.empty) profiles.push(userSnap.docs[0].data() as UserProfile);
  }
  return profiles;
}
