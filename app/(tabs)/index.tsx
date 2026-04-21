import { Ionicons } from "@expo/vector-icons";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Platform,
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import WineCard from "../../components/WineCard";
import { Lang, tr } from "../../constants/i18n";
import { Wine } from "../../constants/types";
import { auth } from "../../services/firebase";
import { deleteWineFS, fetchWinesFS } from "../../services/firestoreWines";
import { saveUserProfile } from "../../services/firestoreBuddies";

export default function MyListScreen() {
  const [lang, setLang] = useState<Lang>("en");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [wines, setWines] = useState<Wine[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await saveUserProfile({ uid: u.uid, email: u.email ?? "", displayName: u.displayName ?? u.email ?? "" });
        await loadWines(u.uid);
      }
      setLoading(false);
    });
  }, []);

  const loadWines = async (uid: string) => {
    try {
      const list = await fetchWinesFS(uid);
      setWines(list);
    } catch (e) {
      console.error("Load wines error:", e);
    }
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      Alert.alert("Sign in failed", String(e));
    }
  };

  const handleSignOut = async () => {
    const confirmed = Platform.OS === "web" ? window.confirm(tr("signOut", lang)) : true;
    if (!confirmed) return;
    await signOut(auth);
    setWines([]);
  };

  const handleDelete = async (wine: Wine) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(tr("confirmDelete", lang))
      : await new Promise<boolean>((resolve) =>
          Alert.alert(tr("confirmDelete", lang), "", [
            { text: tr("no", lang), style: "cancel", onPress: () => resolve(false) },
            { text: tr("yes", lang), style: "destructive", onPress: () => resolve(true) },
          ])
        );
    if (!confirmed) return;
    try {
      await deleteWineFS(wine.id);
      setWines((prev) => prev.filter((w) => w.id !== wine.id));
    } catch (e) {
      Alert.alert(tr("saveError", lang), String(e));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (user) await loadWines(user.uid);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.centered}>
        <ActivityIndicator size="large" color="#c8a97e" />
      </LinearGradient>
    );
  }

  if (!user) {
    return <IntroScreen lang={lang} setLang={setLang} onSignIn={handleSignIn} />;
  }

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{tr("appName", lang)}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setLang(lang === "en" ? "ko" : "en")} style={styles.iconBtn}>
              <Text style={styles.langText}>{lang === "en" ? "한" : "EN"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSignOut} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={22} color="#c8a97e" />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={wines}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => (
            <WineCard
              wine={item}
              lang={lang}
              onPress={() => router.push({ pathname: "/detail", params: { wineId: item.id, lang, ownerId: user.uid } })}
              onDelete={() => handleDelete(item)}
            />
          )}
          contentContainerStyle={styles.list}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{tr("noWines", lang)}</Text>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push({ pathname: "/scan", params: { lang, userId: user.uid } })}
        >
          <Ionicons name="camera" size={28} color="#1a0a2e" />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

function IntroScreen({ lang, setLang, onSignIn }: { lang: Lang; setLang: (l: Lang) => void; onSignIn: () => void }) {
  const { width, height } = Dimensions.get("window");
  const isWide = width > 600;

  return (
    <LinearGradient colors={["#0d0518", "#1a0a2e", "#2d1052", "#1a0a2e"]} style={intro.root}>
      <ScrollView contentContainerStyle={[intro.scroll, isWide && intro.scrollWide]} showsVerticalScrollIndicator={false}>

        {/* Hero section */}
        <View style={[intro.hero, { minHeight: isWide ? 340 : 300 }]}>
          {/* Decorative orbs */}
          <View style={[intro.orb, { width: 260, height: 260, top: -60, left: -60, opacity: 0.18 }]}>
            <LinearGradient colors={["#9b2335", "#c8a97e"]} style={intro.orbInner} />
          </View>
          <View style={[intro.orb, { width: 180, height: 180, top: 40, right: -40, opacity: 0.12 }]}>
            <LinearGradient colors={["#c8a97e", "#6a0dad"]} style={intro.orbInner} />
          </View>
          <View style={[intro.orb, { width: 120, height: 120, bottom: 0, left: "40%", opacity: 0.1 }]}>
            <LinearGradient colors={["#fff", "#c8a97e"]} style={intro.orbInner} />
          </View>

          {/* Wine glass illustration */}
          <View style={intro.glassWrap}>
            <View style={intro.glassBody}>
              <LinearGradient colors={["rgba(200,169,126,0.25)", "rgba(155,35,53,0.35)"]} style={intro.glassFill} />
            </View>
            <View style={intro.glassStem} />
            <View style={intro.glassBase} />
            <Text style={intro.glassEmoji}>🍷</Text>
          </View>

          {/* Decorative dots */}
          <View style={intro.dotsRow}>
            {[0,1,2,3,4].map((i) => (
              <View key={i} style={[intro.dot, i === 2 && intro.dotActive]} />
            ))}
          </View>
        </View>

        {/* Label-style title */}
        <View style={intro.labelBox}>
          <View style={intro.labelLine} />
          <Text style={intro.labelTitle}>SECRET WINE LIST</Text>
          <View style={intro.labelLine} />
        </View>

        {/* Taglines */}
        <View style={intro.taglineWrap}>
          <Text style={intro.taglineMain}>
            {lang === "ko"
              ? "당신과 당신의 친구들을 위한"
              : "For You & Your Friends"}
          </Text>
          <Text style={intro.taglineSub}>
            {lang === "ko"
              ? "나만의 비밀 와인 컬렉션"
              : "Your Private Wine Collection"}
          </Text>
        </View>

        {/* Login card */}
        <View style={[intro.card, isWide && { maxWidth: 420, alignSelf: "center" as const, width: "100%" }]}>
          <Text style={intro.cardDesc}>
            {lang === "ko"
              ? "와인 라벨을 스캔하고, 버디들과 함께\n당신만의 리스트를 만들어보세요."
              : "Scan wine labels, share with buddies,\nand curate your secret collection."}
          </Text>
          <TouchableOpacity style={intro.googleBtn} onPress={onSignIn} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={20} color="#1a0a2e" />
            <Text style={intro.googleBtnText}>
              {lang === "ko" ? "Google로 시작하기" : "Continue with Google"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang(lang === "en" ? "ko" : "en")} style={intro.langBtn}>
            <Text style={intro.langText}>{lang === "en" ? "한국어로 보기" : "View in English"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={intro.footer}>
          {lang === "ko" ? "Claude AI · Firebase 기반" : "Powered by Claude AI · Firebase"}
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const intro = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", paddingBottom: 40 },
  scrollWide: { paddingHorizontal: 40 },

  hero: {
    width: "100%", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden", paddingTop: 60, paddingBottom: 20,
  },
  orb: { position: "absolute", borderRadius: 999 },
  orbInner: { flex: 1, borderRadius: 999 },

  glassWrap: { alignItems: "center", zIndex: 2 },
  glassBody: {
    width: 80, height: 90, borderRadius: 40,
    borderWidth: 2, borderColor: "rgba(200,169,126,0.5)",
    overflow: "hidden", marginBottom: -4,
  },
  glassFill: { flex: 1 },
  glassStem: { width: 4, height: 40, backgroundColor: "rgba(200,169,126,0.4)" },
  glassBase: { width: 48, height: 4, borderRadius: 2, backgroundColor: "rgba(200,169,126,0.4)" },
  glassEmoji: { fontSize: 72, position: "absolute", top: -8 },

  dotsRow: { flexDirection: "row", gap: 8, marginTop: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(200,169,126,0.3)" },
  dotActive: { width: 20, backgroundColor: "#c8a97e" },

  labelBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginTop: 8, paddingHorizontal: 24, width: "100%",
  },
  labelLine: { flex: 1, height: 1, backgroundColor: "rgba(200,169,126,0.4)" },
  labelTitle: {
    color: "#c8a97e", fontSize: 13, fontWeight: "900",
    letterSpacing: 4, textTransform: "uppercase",
  },

  taglineWrap: { alignItems: "center", marginTop: 16, gap: 6, paddingHorizontal: 20 },
  taglineMain: {
    color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", letterSpacing: 0.5,
  },
  taglineSub: {
    color: "rgba(200,169,126,0.8)", fontSize: 15, textAlign: "center", letterSpacing: 1,
  },

  card: {
    marginTop: 32, marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24, padding: 28, gap: 16,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.2)",
    width: "90%",
  },
  cardDesc: {
    color: "#bbb", fontSize: 14, lineHeight: 22,
    textAlign: "center",
  },
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#c8a97e", paddingVertical: 16, borderRadius: 14,
    shadowColor: "#c8a97e", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  googleBtnText: { color: "#1a0a2e", fontWeight: "800", fontSize: 16 },
  langBtn: { alignItems: "center", paddingVertical: 4 },
  langText: { color: "rgba(200,169,126,0.6)", fontSize: 13 },

  footer: { color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 24, letterSpacing: 1 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  langText: { color: "#c8a97e", fontSize: 14 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 50 : 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(200,169,126,0.2)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn: { padding: 8 },
  list: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { color: "#666", fontSize: 16, textAlign: "center", lineHeight: 24 },
  fab: {
    position: "absolute", bottom: 32, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#c8a97e", justifyContent: "center", alignItems: "center",
    shadowColor: "#c8a97e", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
});
