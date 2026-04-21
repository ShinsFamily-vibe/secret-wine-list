import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, User } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { auth } from "../../services/firebase";
import { fetchWinesFS, fetchBuddyWinesFS } from "../../services/firestoreWines";
import { fetchBuddies } from "../../services/firestoreBuddies";
import { askWineAdvice, LikedWine } from "../../services/claude";
import { Wine } from "../../constants/types";

const LIKED_RATINGS = ["thumbs_up", "double_thumbs_up"];
const GUIDE =
  "Claude가 당신 및 Buddy들의 와인리스트를 바탕으로 추천해드립니다.\n지금 어떤 와인이 생각나세요?\n종류, 가격, 모임 성격, 날씨, 음식 등을 적어주시면 추천해드릴게요.";

function ratingEmoji(r: string) {
  if (r === "double_thumbs_up") return "👍👍";
  if (r === "thumbs_up") return "👍";
  return "👎";
}

function tolikedWine(w: Wine, owner?: string): LikedWine {
  return {
    name: w.name, winery: w.winery, vintage: w.vintage,
    region: w.region, variety: w.variety, rating: w.rating,
    price: w.price, estimatedPrice: w.estimatedPrice, owner,
  };
}

export default function AdviceScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [myLiked, setMyLiked] = useState<Wine[]>([]);
  const [buddyLiked, setBuddyLiked] = useState<LikedWine[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const [myWines, buddies] = await Promise.all([
          fetchWinesFS(u.uid),
          fetchBuddies(u.uid),
        ]);
        const liked = myWines.filter((w) => LIKED_RATINGS.includes(w.rating));
        liked.sort((a, b) =>
          (b.rating === "double_thumbs_up" ? 1 : 0) - (a.rating === "double_thumbs_up" ? 1 : 0)
        );
        setMyLiked(liked);

        const allBuddyLiked: LikedWine[] = [];
        for (const buddy of buddies) {
          const bwines = await fetchBuddyWinesFS(buddy.uid);
          bwines
            .filter((w) => LIKED_RATINGS.includes(w.rating))
            .forEach((w) => allBuddyLiked.push(tolikedWine(w, buddy.displayName || buddy.email)));
        }
        setBuddyLiked(allBuddyLiked);
      }
      setLoading(false);
    });
  }, []);

  const handleAsk = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer("");
    try {
      const result = await askWineAdvice(
        myLiked.map((w) => tolikedWine(w)),
        buddyLiked,
        question.trim()
      );
      setAnswer(result);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setAnswer(`Error: ${String(e)}`);
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.centered}>
        <ActivityIndicator size="large" color="#c8a97e" />
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.centered}>
        <Text style={styles.emptyText}>Sign in first.</Text>
      </LinearGradient>
    );
  }

  const top3 = myLiked.slice(0, 3);

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🤖 AI Wine Advice</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top picks */}
            {top3.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⭐ Your Top Picks</Text>
                {top3.map((w) => (
                  <View key={w.id} style={styles.pickCard}>
                    <View style={styles.pickInfo}>
                      <Text style={styles.pickName} numberOfLines={1}>
                        {w.name || w.winery || "Unknown"}
                      </Text>
                      <Text style={styles.pickSub} numberOfLines={1}>
                        {[w.winery, w.vintage, w.variety].filter(Boolean).join(" · ")}
                      </Text>
                      {w.region ? <Text style={styles.pickRegion} numberOfLines={1}>{w.region}</Text> : null}
                    </View>
                    <Text style={styles.pickRating}>{ratingEmoji(w.rating)}</Text>
                  </View>
                ))}
                {myLiked.length > 3 && (
                  <Text style={styles.moreText}>+{myLiked.length - 3} more liked wines included in context</Text>
                )}
              </View>
            )}

            {top3.length === 0 && (
              <View style={styles.noPicksBox}>
                <Text style={styles.noPicksText}>
                  👍 Rate wines in your list to get personalized recommendations!
                </Text>
              </View>
            )}

            {/* Guide + input */}
            <View style={styles.section}>
              <Text style={styles.guideText}>{GUIDE}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="예: 오늘 삼겹살 먹는데 어울리는 레드와인 추천해줘 (2만원대)"
                  placeholderTextColor="#555"
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  maxLength={300}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!question.trim() || asking) && styles.sendBtnDisabled]}
                  onPress={handleAsk}
                  disabled={!question.trim() || asking}
                >
                  {asking
                    ? <ActivityIndicator size="small" color="#1a0a2e" />
                    : <Ionicons name="send" size={20} color="#1a0a2e" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Answer */}
            {asking && (
              <View style={styles.thinkingRow}>
                <ActivityIndicator color="#c8a97e" size="small" />
                <Text style={styles.thinkingText}>Claude가 추천을 준비중입니다...</Text>
              </View>
            )}

            {answer ? (
              <View style={styles.answerBox}>
                <Text style={styles.answerLabel}>🍷 Claude's Recommendation</Text>
                <Text style={styles.answerText}>{answer}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,169,126,0.2)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  content: { padding: 16, gap: 20, paddingBottom: 40 },

  section: { gap: 12 },
  sectionTitle: { color: "#c8a97e", fontSize: 15, fontWeight: "700" },

  pickCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.15)",
  },
  pickInfo: { flex: 1 },
  pickName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  pickSub: { color: "#aaa", fontSize: 12, marginTop: 2 },
  pickRegion: { color: "#777", fontSize: 11, marginTop: 1 },
  pickRating: { fontSize: 22 },
  moreText: { color: "#666", fontSize: 12, textAlign: "center" },

  noPicksBox: {
    backgroundColor: "rgba(200,169,126,0.08)",
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.2)",
  },
  noPicksText: { color: "#c8a97e", fontSize: 13, lineHeight: 20, textAlign: "center" },

  guideText: {
    color: "#aaa", fontSize: 13, lineHeight: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: "#fff", fontSize: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    maxHeight: 120, minHeight: 50,
  },
  sendBtn: {
    width: 50, height: 50, borderRadius: 12,
    backgroundColor: "#c8a97e",
    justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },

  thinkingRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 4,
  },
  thinkingText: { color: "#c8a97e", fontSize: 13 },

  answerBox: {
    backgroundColor: "rgba(200,169,126,0.08)",
    borderRadius: 14, padding: 16, gap: 10,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.25)",
  },
  answerLabel: { color: "#c8a97e", fontSize: 14, fontWeight: "700" },
  answerText: { color: "#e8e8e8", fontSize: 14, lineHeight: 22 },

  emptyText: { color: "#aaa", fontSize: 16 },
});
