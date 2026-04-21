import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, User } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { auth } from "../../services/firebase";
import { fetchWinesFS, fetchBuddyWinesFS } from "../../services/firestoreWines";
import { fetchBuddies } from "../../services/firestoreBuddies";
import { askWineAdvice, analyzeMenuForUser, getContextualPicks, ContextualPicks, LikedWine } from "../../services/claude";
import { Wine } from "../../constants/types";

function resizeImageForWeb(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img") as HTMLImageElement;
    const timer = setTimeout(() => resolve(dataUrl), 8000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width || 800, img.height || 600));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round((img.width || 800) * scale);
        canvas.height = Math.round((img.height || 600) * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", 0.82);
        resolve(out.length > 200 ? out : dataUrl);
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => { clearTimeout(timer); resolve(dataUrl); };
    img.src = dataUrl;
  });
}

const LIKED_RATINGS = ["thumbs_up", "double_thumbs_up"];

const GUIDE = {
  ko: "Claude가 당신 및 Buddy들의 와인리스트를 바탕으로 추천해드립니다.\n지금 어떤 와인이 생각나세요?\n종류, 가격, 모임 성격, 날씨, 음식 등을 적어주시면 추천해드릴게요.",
  en: "Claude recommends wines based on your list and your buddies' lists.\nWhat kind of wine are you in the mood for?\nTell me the type, budget, occasion, weather, or food pairing — I'll find the perfect match.",
};

const PLACEHOLDER = {
  ko: "예: 오늘 삼겹살 먹는데 어울리는 레드와인 추천해줘 (2만원대)",
  en: "e.g. Suggest a red wine for grilled pork belly tonight, under $20",
};

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
  const [menuAnalyzing, setMenuAnalyzing] = useState(false);
  const [picks, setPicks] = useState<ContextualPicks | null>(null);
  const [picksLoading, setPicksLoading] = useState(false);
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const [detailWine, setDetailWine] = useState<{ wine: Wine | LikedWine; reason: string; isBuddy?: boolean } | null>(null);
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

        // Claude contextual picks
        const topWines = liked.filter((w) => w.rating === "double_thumbs_up");
        const winesForPicks = topWines.length >= 2 ? topWines : liked;
        if (winesForPicks.length > 0) {
          setPicksLoading(true);
          try {
            const p = await getContextualPicks(
              winesForPicks.map((w) => tolikedWine(w)),
              allBuddyLiked,
              "ko"
            );
            setPicks(p);
          } catch { /* silent */ } finally {
            setPicksLoading(false);
          }
        }
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

  const handleScanMenu = () => {
    if (menuAnalyzing) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/*";
    input.setAttribute("capture", "environment");
    input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0;";
    document.body.appendChild(input);
    input.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setMenuAnalyzing(true);
      setAnswer("");
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          let resized = await resizeImageForWeb(dataUrl, 1200);
          if (resized.length > 3_000_000) resized = await resizeImageForWeb(resized, 700);
          const b64 = resized.split(",")[1] ?? "";
          const result = await analyzeMenuForUser(
            b64,
            myLiked.map((w) => tolikedWine(w)),
            buddyLiked,
            lang
          );
          setAnswer(result);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        } catch (err) {
          setAnswer(`Error: ${String(err)}`);
        } finally {
          setMenuAnalyzing(false);
        }
      };
      reader.onerror = () => { setAnswer("Could not read image."); setMenuAnalyzing(false); };
      reader.readAsDataURL(file);
    });
    setTimeout(() => input.click(), 50);
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

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🤖 AI Wine Advice</Text>
            <TouchableOpacity onPress={() => setLang(lang === "ko" ? "en" : "ko")} style={styles.langBtn}>
              <Text style={styles.langText}>{lang === "ko" ? "EN" : "한"}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* Contextual picks */}
            {picksLoading && (
              <View style={styles.picksLoadingRow}>
                <ActivityIndicator size="small" color="#c8a97e" />
                <Text style={styles.picksLoadingText}>
                  {lang === "ko" ? "지금 이 순간 추천을 골라오는 중..." : "Finding the perfect wines for this moment..."}
                </Text>
              </View>
            )}

            {!picksLoading && picks && (picks.myPicks.length > 0 || picks.buddyPick) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  🕐 {lang === "ko" ? "지금 이 순간을 위한 추천" : "Perfect for Right Now"}
                </Text>

                {picks.myPicks.map((p, i) => {
                  const full = myLiked.find((w) => w.name === p.name || w.winery === p.winery) ?? p as unknown as Wine;
                  return (
                    <TouchableOpacity key={i} style={styles.pickCard} onPress={() => setDetailWine({ wine: full, reason: p.reason })}>
                      <View style={styles.pickBadge}>
                        <Text style={styles.pickBadgeText}>나</Text>
                      </View>
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickName} numberOfLines={1}>{p.name}{p.winery ? ` · ${p.winery}` : ""}</Text>
                        {p.variety ? <Text style={styles.pickSub} numberOfLines={1}>{p.variety}</Text> : null}
                        <Text style={styles.pickReason}>{p.reason}</Text>
                      </View>
                      <View style={styles.pickRight}>
                        <Text style={styles.pickRating}>👍👍</Text>
                        <Ionicons name="chevron-forward" size={14} color="#555" />
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {picks.buddyPick && (() => {
                  const bp = picks.buddyPick!;
                  const full = buddyLiked.find((w) => w.name === bp.name || w.winery === bp.winery) ?? bp as unknown as LikedWine;
                  return (
                    <TouchableOpacity style={[styles.pickCard, styles.pickCardBuddy]} onPress={() => setDetailWine({ wine: full, reason: bp.reason, isBuddy: true })}>
                      <View style={[styles.pickBadge, styles.pickBadgeBuddy]}>
                        <Text style={styles.pickBadgeText}>👥</Text>
                      </View>
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickName} numberOfLines={1}>{bp.name}{bp.winery ? ` · ${bp.winery}` : ""}</Text>
                        {bp.variety ? <Text style={styles.pickSub}>{bp.variety}</Text> : null}
                        {bp.owner ? <Text style={styles.pickOwner}>{bp.owner}'s pick</Text> : null}
                        <Text style={styles.pickReason}>{bp.reason}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={14} color="#555" />
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}

            {!picksLoading && myLiked.length === 0 && (
              <View style={styles.noPicksBox}>
                <Text style={styles.noPicksText}>
                  👍 {lang === "ko" ? "와인에 좋아요를 눌러 맞춤 추천을 받아보세요!" : "Rate wines to get personalized recommendations!"}
                </Text>
              </View>
            )}

            {/* Menu scan */}
            <TouchableOpacity
              style={[styles.menuScanBtn, menuAnalyzing && styles.menuScanBtnDisabled]}
              onPress={handleScanMenu}
              disabled={menuAnalyzing}
            >
              {menuAnalyzing ? (
                <>
                  <ActivityIndicator size="small" color="#1a0a2e" />
                  <Text style={styles.menuScanText}>
                    {lang === "ko" ? "메뉴 분석 중..." : "Analyzing menu..."}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="restaurant-outline" size={20} color="#1a0a2e" />
                  <Text style={styles.menuScanText}>
                    {lang === "ko" ? "📋 와인 메뉴판 스캔" : "📋 Scan Wine Menu"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Guide + input */}
            <View style={styles.section}>
              <Text style={styles.guideText}>{GUIDE[lang]}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={PLACEHOLDER[lang]}
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

      {/* Detail Modal */}
      <Modal visible={!!detailWine} transparent animationType="slide" onRequestClose={() => setDetailWine(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailWine(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {detailWine && (() => {
              const w = detailWine.wine as any;
              const rows: [string, string][] = [
                ["🍷 Wine", w.name || ""],
                ["🏠 Winery", w.winery || ""],
                ["📅 Vintage", w.vintage || ""],
                ["🌍 Region", w.region || ""],
                ["🍇 Variety", w.variety || ""],
                ["💰 Price", w.price || ""],
                ["🤖 Est. Price", w.estimatedPrice || ""],
                ["📝 Notes", w.notes || ""],
              ].filter(([, v]) => v) as [string, string][];
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle} numberOfLines={2}>{w.name || w.winery || "Wine"}</Text>
                    {detailWine.isBuddy && w.owner && (
                      <Text style={styles.modalBuddyTag}>👥 {w.owner}'s pick</Text>
                    )}
                  </View>

                  <View style={styles.modalReasonBox}>
                    <Text style={styles.modalReasonLabel}>✨ {lang === "ko" ? "지금 추천하는 이유" : "Why right now"}</Text>
                    <Text style={styles.modalReasonText}>{detailWine.reason}</Text>
                  </View>

                  {rows.map(([label, value]) => (
                    <View key={label} style={styles.modalRow}>
                      <Text style={styles.modalRowLabel}>{label}</Text>
                      <Text style={styles.modalRowValue}>{value}</Text>
                    </View>
                  ))}

                  <View style={styles.modalTipBox}>
                    <Text style={styles.modalTipText}>
                      {lang === "ko"
                        ? "💡 레스토랑에서 주문 시: 위 정보를 소믈리에에게 보여주세요.\n구매 시: 와인 전문점에서 이름 + 빈티지로 검색해보세요."
                        : "💡 At a restaurant: show this to the sommelier.\nTo buy: search by name + vintage at a wine shop."}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailWine(null)}>
                    <Text style={styles.modalCloseBtnText}>{lang === "ko" ? "닫기" : "Close"}</Text>
                  </TouchableOpacity>
                </ScrollView>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 50 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,169,126,0.2)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  langBtn: { padding: 8 },
  langText: { color: "#c8a97e", fontSize: 14, fontWeight: "600" },
  content: { padding: 16, gap: 20, paddingBottom: 40 },

  section: { gap: 12 },
  sectionTitle: { color: "#c8a97e", fontSize: 15, fontWeight: "700" },

  picksLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  picksLoadingText: { color: "#c8a97e", fontSize: 13 },
  pickCard: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.15)",
  },
  pickCardBuddy: { borderColor: "rgba(100,180,255,0.25)", backgroundColor: "rgba(100,180,255,0.05)" },
  pickBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#c8a97e", justifyContent: "center", alignItems: "center",
    marginTop: 2,
  },
  pickBadgeBuddy: { backgroundColor: "rgba(100,180,255,0.4)" },
  pickBadgeText: { color: "#1a0a2e", fontSize: 11, fontWeight: "700" },
  pickInfo: { flex: 1 },
  pickName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  pickSub: { color: "#aaa", fontSize: 12, marginTop: 2 },
  pickOwner: { color: "rgba(100,180,255,0.8)", fontSize: 11, marginTop: 1 },
  pickReason: { color: "#c8a97e", fontSize: 12, marginTop: 4, lineHeight: 17 },
  pickRating: { fontSize: 18 },
  pickRight: { alignItems: "center", gap: 4 },

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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#1a0a2e", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: "85%",
    borderWidth: 1, borderColor: "rgba(200,169,126,0.2)",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16 },
  modalHeader: { marginBottom: 16, gap: 4 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalBuddyTag: { color: "rgba(100,180,255,0.8)", fontSize: 13 },
  modalReasonBox: {
    backgroundColor: "rgba(200,169,126,0.1)", borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.25)",
  },
  modalReasonLabel: { color: "#c8a97e", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  modalReasonText: { color: "#e8e8e8", fontSize: 14, lineHeight: 20 },
  modalRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", gap: 12 },
  modalRowLabel: { color: "#888", fontSize: 13, width: 110 },
  modalRowValue: { color: "#fff", fontSize: 13, flex: 1, lineHeight: 18 },
  modalTipBox: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalTipText: { color: "#999", fontSize: 12, lineHeight: 19 },
  modalCloseBtn: {
    backgroundColor: "#c8a97e", borderRadius: 14, paddingVertical: 14,
    alignItems: "center", marginTop: 16,
  },
  modalCloseBtnText: { color: "#1a0a2e", fontWeight: "700", fontSize: 16 },
  menuScanBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#c8a97e", borderRadius: 14, paddingVertical: 14,
    shadowColor: "#c8a97e", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  menuScanBtnDisabled: { opacity: 0.6 },
  menuScanText: { color: "#1a0a2e", fontSize: 15, fontWeight: "700" },
});
