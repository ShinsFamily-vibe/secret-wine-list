import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, User } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Platform,
  SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Lang } from "../../constants/i18n";
import { auth } from "../../services/firebase";
import { addBuddy, fetchBuddies, findUserByEmail, removeBuddy, UserProfile } from "../../services/firestoreBuddies";

export default function BuddiesScreen() {
  const [lang] = useState<Lang>("en");
  const [user, setUser] = useState<User | null>(null);
  const [buddies, setBuddies] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const list = await fetchBuddies(u.uid);
        setBuddies(list);
        loadSuggestions(u.uid, list);
      }
      setLoading(false);
    });
  }, []);

  const loadSuggestions = async (myUid: string, myBuddies: UserProfile[]) => {
    const myBuddyUids = new Set([myUid, ...myBuddies.map((b) => b.uid)]);
    const seen = new Set<string>();
    const result: UserProfile[] = [];
    for (const buddy of myBuddies) {
      const theirBuddies = await fetchBuddies(buddy.uid);
      for (const p of theirBuddies) {
        if (!myBuddyUids.has(p.uid) && !seen.has(p.uid)) {
          seen.add(p.uid);
          result.push(p);
        }
      }
    }
    setSuggestions(result);
  };

  const handleAdd = async () => {
    if (!email.trim() || !user) return;
    if (email.trim() === user.email) {
      Alert.alert("That's you!");
      return;
    }
    setAdding(true);
    setAddMsg(null);
    try {
      const found = await findUserByEmail(email.trim().toLowerCase());
      if (!found) {
        setAddMsg({ text: "User not found. They need to sign in first.", ok: false });
        return;
      }
      if (buddies.find((b) => b.uid === found.uid)) {
        setAddMsg({ text: "Already a buddy!", ok: false });
        return;
      }
      await addBuddy(user.uid, found.uid);
      const newBuddies = [...buddies, found];
      setBuddies(newBuddies);
      setSuggestions((prev) => prev.filter((s) => s.uid !== found.uid));
      setEmail("");
      setAddMsg({ text: `${found.displayName || found.email} added!`, ok: true });
      loadSuggestions(user.uid, newBuddies);
    } catch (e) {
      console.error("Add buddy error:", e);
      setAddMsg({ text: String(e), ok: false });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (buddy: UserProfile) => {
    const confirmed = Platform.OS === "web"
      ? window.confirm(`Remove ${buddy.displayName || buddy.email}?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert("Remove buddy?", buddy.email, [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Remove", style: "destructive", onPress: () => resolve(true) },
          ])
        );
    if (!confirmed || !user) return;
    await removeBuddy(user.uid, buddy.uid);
    setBuddies((prev) => prev.filter((b) => b.uid !== buddy.uid));
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
        <Text style={styles.msg}>Sign in first to manage buddies.</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🍷 Buddies</Text>
        </View>

        {/* Add buddy */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add by email..."
            placeholderTextColor="#555"
            value={email}
            onChangeText={(t) => { setEmail(t); setAddMsg(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={adding}>
            {adding ? <ActivityIndicator size="small" color="#1a0a2e" /> : <Ionicons name="person-add" size={20} color="#1a0a2e" />}
          </TouchableOpacity>
        </View>
        {addMsg && (
          <Text style={[styles.addMsgText, { color: addMsg.ok ? "#7ecfa9" : "#ff6b6b" }]}>
            {addMsg.text}
          </Text>
        )}

        <FlatList
          data={buddies}
          keyExtractor={(b) => b.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.buddyRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.displayName || item.email)[0].toUpperCase()}</Text>
              </View>
              <View style={styles.buddyInfo}>
                <Text style={styles.buddyName}>{item.displayName || item.email}</Text>
                <Text style={styles.buddyEmail}>{item.email}</Text>
              </View>
              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => router.push({ pathname: "/buddy-wines", params: { uid: item.uid, name: item.displayName || item.email } })}
              >
                <Ionicons name="wine-outline" size={18} color="#c8a97e" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item)}>
                <Ionicons name="close-circle-outline" size={20} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No buddies yet.{"\n"}Add friends by their email!</Text>
          }
          ListFooterComponent={
            suggestions.length > 0 ? (
              <View style={styles.suggestSection}>
                <Text style={styles.suggestTitle}>👥 People you may know</Text>
                {suggestions.map((s) => (
                  <View key={s.uid} style={styles.suggestRow}>
                    <View style={[styles.avatar, styles.avatarSuggest]}>
                      <Text style={styles.avatarText}>{(s.displayName || s.email)[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.buddyInfo}>
                      <Text style={styles.buddyName}>{s.displayName || s.email}</Text>
                      <Text style={styles.buddyEmail}>{s.email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quickAddBtn}
                      onPress={async () => {
                        if (!user) return;
                        await addBuddy(user.uid, s.uid);
                        const newBuddies = [...buddies, s];
                        setBuddies(newBuddies);
                        setSuggestions((prev) => prev.filter((x) => x.uid !== s.uid));
                        loadSuggestions(user.uid, newBuddies);
                      }}
                    >
                      <Ionicons name="person-add-outline" size={16} color="#1a0a2e" />
                      <Text style={styles.quickAddText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  msg: { color: "#aaa", fontSize: 16 },
  header: {
    paddingHorizontal: 20, paddingTop: Platform.OS === "android" ? 50 : 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(200,169,126,0.2)",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  addRow: { flexDirection: "row", padding: 16, gap: 10 },
  input: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 15,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  addBtn: {
    backgroundColor: "#c8a97e", borderRadius: 10, width: 48, justifyContent: "center", alignItems: "center",
  },
  list: { padding: 16, gap: 12 },
  buddyRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(200,169,126,0.15)",
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: "#c8a97e",
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#1a0a2e", fontWeight: "700", fontSize: 18 },
  buddyInfo: { flex: 1 },
  buddyName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  buddyEmail: { color: "#888", fontSize: 12 },
  viewBtn: { padding: 6 },
  removeBtn: { padding: 6 },
  emptyText: { color: "#666", textAlign: "center", marginTop: 60, fontSize: 15, lineHeight: 24 },
  addMsgText: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13 },
  suggestSection: { marginTop: 24, gap: 10 },
  suggestTitle: { color: "#888", fontSize: 13, fontWeight: "600", marginBottom: 4 },
  suggestRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  avatarSuggest: { backgroundColor: "rgba(200,169,126,0.4)" },
  quickAddBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#c8a97e", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  quickAddText: { color: "#1a0a2e", fontSize: 12, fontWeight: "700" },
});
