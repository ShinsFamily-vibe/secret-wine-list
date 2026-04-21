import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, User } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import RatingPicker from "../components/RatingPicker";
import { Lang, tr } from "../constants/i18n";
import { Rating, Wine } from "../constants/types";
import { auth } from "../services/firebase";
import { addComment, Comment, deleteComment, deleteWineFS, fetchComments, updateWineFS } from "../services/firestoreWines";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { getDrivePhotoUrl } from "../services/googleDrive";

export default function DetailScreen() {
  const { wineId, lang: langParam, ownerId, readOnly } = useLocalSearchParams<{
    wineId: string; lang: string; ownerId: string; readOnly?: string;
  }>();
  const lang = (langParam ?? "en") as Lang;
  const isReadOnly = readOnly === "true";

  const [user, setUser] = useState<User | null>(null);
  const [wine, setWine] = useState<Wine | null>(null);
  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [region, setRegion] = useState("");
  const [variety, setVariety] = useState("");
  const [rating, setRating] = useState<Rating>("thumbs_up");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!wineId) return;
    getDoc(doc(db, "wines", wineId)).then((snap) => {
      if (!snap.exists()) return;
      const w = { ...snap.data(), id: snap.id } as Wine;
      setWine(w);
      setName(w.name); setWinery(w.winery); setVintage(w.vintage);
      setRegion(w.region); setVariety(w.variety); setRating(w.rating);
      setPrice(w.price); setNotes(w.notes);
    });
    fetchComments(wineId).then(setComments);
  }, [wineId]);

  const photoIds = wine?.drivePhotoId ? wine.drivePhotoId.split(",").filter(Boolean) : [];

  const handleSave = async () => {
    if (!wineId) return;
    setSaving(true);
    try {
      await updateWineFS(wineId, { name, winery, vintage, region, variety, rating, price, notes });
      router.replace("/(tabs)/");
    } catch (e) {
      Alert.alert(tr("saveError", lang), String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!wineId) return;
    const confirmed = Platform.OS === "web"
      ? window.confirm(tr("confirmDelete", lang))
      : await new Promise<boolean>((resolve) =>
          Alert.alert(tr("confirmDelete", lang), "", [
            { text: tr("no", lang), style: "cancel", onPress: () => resolve(false) },
            { text: tr("yes", lang), style: "destructive", onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteWineFS(wineId);
      router.replace("/(tabs)/");
    } catch (e) {
      Alert.alert(tr("saveError", lang), String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !user || !wineId) return;
    setPostingComment(true);
    try {
      const c: Comment = {
        userId: user.uid,
        userName: user.displayName || user.email || "Anonymous",
        text: commentText.trim(),
        createdAt: Date.now(),
      };
      await addComment(wineId, c);
      setComments((prev) => [...prev, c]);
      setCommentText("");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (c: Comment) => {
    if (!wineId || !c.id) return;
    if (c.userId !== user?.uid) return;
    await deleteComment(wineId, c.id);
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  };

  if (!wine) {
    return (
      <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.centered}>
        <ActivityIndicator color="#c8a97e" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#c8a97e" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{name || "Wine Detail"}</Text>
            {!isReadOnly ? (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} disabled={deleting}>
                {deleting ? <ActivityIndicator size="small" color="#ff6b6b" /> : <Ionicons name="trash-outline" size={22} color="#ff6b6b" />}
              </TouchableOpacity>
            ) : <View style={{ width: 40 }} />}
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Photos */}
            {photoIds.length > 0 && (
              <FlatList
                horizontal
                data={photoIds}
                keyExtractor={(id) => id}
                renderItem={({ item }) => <Image source={{ uri: getDrivePhotoUrl(item) }} style={styles.photo} />}
                ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                showsHorizontalScrollIndicator={false}
              />
            )}

            {/* Fields */}
            {isReadOnly ? (
              <View style={styles.readOnlyFields}>
                {[
                  [tr("wineName", lang), name],
                  [tr("winery", lang), winery],
                  [tr("vintage", lang), vintage],
                  [tr("region", lang), region],
                  [tr("variety", lang), variety],
                  [tr("price", lang), price],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <View key={label} style={styles.roField}>
                    <Text style={styles.roLabel}>{label}</Text>
                    <Text style={styles.roValue}>{value}</Text>
                  </View>
                ))}
                {wine.estimatedPrice ? (
                  <View style={styles.roField}>
                    <Text style={styles.roLabel}>{tr("estimatedPrice", lang)}</Text>
                    <Text style={styles.estimatedText}>🤖 {wine.estimatedPrice}</Text>
                  </View>
                ) : null}
                <Text style={styles.ratingLarge}>{wine.rating === "double_thumbs_up" ? "👍👍" : wine.rating === "thumbs_up" ? "👍" : "👎"}</Text>
                {notes ? <Text style={styles.notesRO}>{notes}</Text> : null}
              </View>
            ) : (
              <>
                <Field label={tr("wineName", lang)} value={name} onChangeText={setName} />
                <Field label={tr("winery", lang)} value={winery} onChangeText={setWinery} />
                <Field label={tr("vintage", lang)} value={vintage} onChangeText={setVintage} keyboardType="numeric" />
                <Field label={tr("region", lang)} value={region} onChangeText={setRegion} />
                <Field label={tr("variety", lang)} value={variety} onChangeText={setVariety} />
                <Text style={styles.fieldLabel}>{tr("rating", lang)}</Text>
                <RatingPicker value={rating} onChange={setRating} />
                {wine.estimatedPrice ? (
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>{tr("estimatedPrice", lang)}</Text>
                    <View style={styles.estimatedBox}>
                      <Text style={styles.estimatedText}>🤖 {wine.estimatedPrice}</Text>
                    </View>
                  </View>
                ) : null}
                <Field label={tr("price", lang)} value={price} onChangeText={setPrice} placeholder={tr("pricePlaceholder", lang)} />
                <Field label={tr("notes", lang)} value={notes} onChangeText={setNotes} placeholder={tr("notesPlaceholder", lang)} multiline />
                <Text style={styles.addedAt}>{tr("addedOn", lang)}: {wine.addedAt ? new Date(wine.addedAt).toLocaleDateString() : ""}</Text>
                <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#1a0a2e" /> : <Text style={styles.saveBtnText}>{tr("save", lang)}</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Comments */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>💬 Comments</Text>
              {comments.map((c) => (
                <View key={c.id ?? c.createdAt} style={styles.commentRow}>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUser}>{c.userName}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <Text style={styles.commentTime}>{new Date(c.createdAt).toLocaleDateString()}</Text>
                  </View>
                  {c.userId === user?.uid && (
                    <TouchableOpacity onPress={() => handleDeleteComment(c)} style={styles.commentDelete}>
                      <Ionicons name="close" size={14} color="#ff6b6b" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {user && (
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    placeholderTextColor="#555"
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity style={styles.commentSendBtn} onPress={handlePostComment} disabled={postingComment}>
                    {postingComment ? <ActivityIndicator size="small" color="#1a0a2e" /> : <Ionicons name="send" size={18} color="#1a0a2e" />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#555"
        multiline={multiline} keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 50 : 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(200,169,126,0.2)",
  },
  backBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  headerTitle: { flex: 1, color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center", marginHorizontal: 8 },
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  photo: { width: 200, height: 260, borderRadius: 16, resizeMode: "cover" },
  field: { gap: 6 },
  fieldLabel: { color: "#c8a97e", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  estimatedBox: {
    backgroundColor: "rgba(200,169,126,0.1)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.3)",
  },
  estimatedText: { color: "#c8a97e", fontSize: 15 },
  addedAt: { color: "#555", fontSize: 12, textAlign: "right" },
  saveBtn: { backgroundColor: "#c8a97e", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#1a0a2e", fontSize: 17, fontWeight: "700" },
  readOnlyFields: { gap: 12 },
  roField: { gap: 2 },
  roLabel: { color: "#c8a97e", fontSize: 12 },
  roValue: { color: "#fff", fontSize: 15 },
  ratingLarge: { fontSize: 36, textAlign: "center", marginVertical: 8 },
  notesRO: { color: "#aaa", fontSize: 14, fontStyle: "italic" },
  commentsSection: { marginTop: 8, gap: 12 },
  commentsTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  commentBubble: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    padding: 12, gap: 4,
  },
  commentUser: { color: "#c8a97e", fontSize: 12, fontWeight: "600" },
  commentText: { color: "#fff", fontSize: 14 },
  commentTime: { color: "#555", fontSize: 11 },
  commentDelete: { padding: 6, marginTop: 4 },
  commentInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  commentInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", maxHeight: 80,
  },
  commentSendBtn: {
    backgroundColor: "#c8a97e", borderRadius: 10, width: 44, height: 44,
    justifyContent: "center", alignItems: "center",
  },
});
