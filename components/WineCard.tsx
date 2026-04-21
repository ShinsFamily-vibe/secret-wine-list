import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Lang } from "../constants/i18n";
import { Rating, Wine } from "../constants/types";
import { getDrivePhotoUrl } from "../services/googleDrive";

const RATING_EMOJI: Record<Rating, string> = {
  thumbs_down: "👎",
  thumbs_up: "👍",
  double_thumbs_up: "👍👍",
};

interface Props {
  wine: Wine;
  lang: Lang;
  onPress: () => void;
  onDelete: () => void;
}

export default function WineCard({ wine, lang, onPress, onDelete }: Props) {
  const photoUrl = wine.thumbnail || null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.left}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.bottleIcon}>🍷</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{wine.name || "Unknown Wine"}</Text>
        {wine.winery ? <Text style={styles.sub}>{wine.winery}</Text> : null}
        <View style={styles.meta}>
          {wine.vintage ? <Text style={styles.chip}>{wine.vintage}</Text> : null}
          {wine.region ? <Text style={styles.chip} numberOfLines={1}>{wine.region}</Text> : null}
        </View>
        {(wine.price || wine.estimatedPrice) ? (
          <Text style={styles.price}>
            {wine.price || `~${wine.estimatedPrice}`}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Text style={styles.rating}>{RATING_EMOJI[wine.rating]}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="pencil-outline" size={16} color="#c8a97e" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200,169,126,0.2)",
    alignItems: "center",
  },
  left: { width: 80, height: 100 },
  photo: { width: 80, height: 100, resizeMode: "cover" },
  photoPlaceholder: {
    width: 80,
    height: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottleIcon: { fontSize: 30 },
  info: { flex: 1, padding: 12, gap: 4 },
  name: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sub: { color: "#c8a97e", fontSize: 12 },
  meta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    backgroundColor: "rgba(200,169,126,0.15)",
    color: "#c8a97e",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  price: { color: "#aaa", fontSize: 12, marginTop: 2 },
  actions: { paddingRight: 12, alignItems: "center", gap: 10 },
  rating: { fontSize: 22 },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
});
