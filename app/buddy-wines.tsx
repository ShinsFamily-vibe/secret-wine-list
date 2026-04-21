import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import WineCard from "../components/WineCard";
import { Lang } from "../constants/i18n";
import { Wine } from "../constants/types";
import { fetchBuddyWinesFS } from "../services/firestoreWines";

export default function BuddyWinesScreen() {
  const { uid, name } = useLocalSearchParams<{ uid: string; name: string }>();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const lang: Lang = "en";

  useEffect(() => {
    fetchBuddyWinesFS(uid).then((list) => { setWines(list); setLoading(false); });
  }, [uid]);

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#c8a97e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🍷 {name}'s List</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#c8a97e" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={wines}
            keyExtractor={(w) => w.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <WineCard
                wine={item}
                lang={lang}
                onPress={() => router.push({ pathname: "/detail", params: { wineId: item.id, lang, ownerId: uid, readOnly: "true" } })}
                onDelete={() => {}}
              />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No wines yet.</Text>}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "android" ? 50 : 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(200,169,126,0.2)",
  },
  backBtn: { padding: 8 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: "#666", textAlign: "center", marginTop: 60, fontSize: 15 },
});
