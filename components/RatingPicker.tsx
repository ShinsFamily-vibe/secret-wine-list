import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Rating } from "../constants/types";

const OPTIONS: { value: Rating; label: string }[] = [
  { value: "thumbs_down", label: "👎" },
  { value: "thumbs_up", label: "👍" },
  { value: "double_thumbs_up", label: "👍👍" },
];

interface Props {
  value: Rating;
  onChange: (r: Rating) => void;
}

export default function RatingPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.btn, value === opt.value && styles.selected]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={styles.emoji}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selected: {
    borderColor: "#c8a97e",
    backgroundColor: "rgba(200,169,126,0.15)",
  },
  emoji: { fontSize: 26 },
});
