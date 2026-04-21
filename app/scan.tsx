import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RatingPicker from "../components/RatingPicker";
import { Lang, tr } from "../constants/i18n";
import { LocalPhoto, Rating, Wine } from "../constants/types";
import { analyzeWineLabel } from "../services/claude";
import { makeFilePublic, uploadPhoto } from "../services/googleDrive";
import { addWineFS } from "../services/firestoreWines";

function resizeImageWeb(dataUrl: string, maxPx: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img") as HTMLImageElement;
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

export default function ScanScreen() {
  const params = useLocalSearchParams<{ lang: string }>();
  const lang = (params.lang ?? "en") as Lang;
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setUserId(u.uid); });
    return unsub;
  }, []);

  const [showCamera, setShowCamera] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [analyzingIdx, setAnalyzingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [region, setRegion] = useState("");
  const [variety, setVariety] = useState("");
  const [rating, setRating] = useState<Rating>("thumbs_up");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");

  // Merge Claude result into fields — only fill empty fields
  const mergeInfo = (info: { name: string; winery: string; vintage: string; region: string; variety: string }) => {
    if (info.name) setName((v) => v || info.name);
    if (info.winery) setWinery((v) => v || info.winery);
    if (info.vintage) setVintage((v) => v || info.vintage);
    if (info.region) setRegion((v) => v || info.region);
    if (info.variety) setVariety((v) => v || info.variety);
    if (info.estimatedPrice) setEstimatedPrice((v) => v || info.estimatedPrice);
  };

  const addPhoto = async (uri: string, base64: string) => {
    const newIdx = photos.length;
    setPhotos((prev) => [...prev, { uri, base64 }]);
    setAnalyzingIdx(newIdx);
    try {
      const info = await analyzeWineLabel(base64);
      mergeInfo(info);
    } catch (e) {
      Alert.alert(tr("scanError", lang), String(e));
    } finally {
      setAnalyzingIdx(null);
    }
  };

  const handleTakePhoto = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setShowCamera(true);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
    if (!photo) return;
    setShowCamera(false);
    await addPhoto(photo.uri, photo.base64 ?? "");
  };

  const handlePickLibrary = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const resized = await resizeImageWeb(dataUrl, 1200);
          await addPhoto(resized, resized.split(",")[1]);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await addPhoto(asset.uri, asset.base64 ?? "");
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name && !winery) {
      Alert.alert("Please fill in at least the wine name or winery.");
      return;
    }
    setSaving(true);
    try {
      let thumbnail = "";
      if (photos.length > 0) {
        const small = await resizeImageWeb(photos[0].uri, 120);
        thumbnail = small;
      }
      const wine: Wine = {
        id: `wine_${Date.now()}`,
        name, winery, vintage, region, variety, rating, price, notes,
        drivePhotoId: "",
        addedAt: new Date().toISOString(),
        estimatedPrice,
        thumbnail,
      };
      await addWineFS(wine, userId);
      router.replace("/(tabs)/");
    } catch (e) {
      Alert.alert(tr("saveError", lang), String(e));
    } finally {
      setSaving(false);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.flex}>
        <CameraView ref={cameraRef} style={styles.flex} facing="back">
          <SafeAreaView style={styles.cameraUI}>
            <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.captureRow}>
              <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#1a0a2e", "#2d1052", "#1a0a2e"]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace("/")} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#c8a97e" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{tr("scan", lang)}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

            {/* Photo strip */}
            <View style={styles.photoStrip}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: p.uri }} style={styles.thumbImg} />
                  {analyzingIdx === i && (
                    <View style={styles.thumbOverlay}>
                      <ActivityIndicator color="#c8a97e" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={20} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add photo buttons */}
              {photos.length === 0 ? (
                <View style={styles.largeBtns}>
                  <TouchableOpacity style={styles.largeBtn} onPress={handleTakePhoto}>
                    <Ionicons name="camera" size={32} color="#c8a97e" />
                    <Text style={styles.largeBtnText}>{tr("takePhoto", lang)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.largeBtn} onPress={handlePickLibrary}>
                    <Ionicons name="images" size={32} color="#c8a97e" />
                    <Text style={styles.largeBtnText}>{tr("choosePhoto", lang)}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.addBtns}>
                  <TouchableOpacity style={styles.addBtn} onPress={handleTakePhoto}>
                    <Ionicons name="camera" size={20} color="#c8a97e" />
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addBtn} onPress={handlePickLibrary}>
                    <Ionicons name="images" size={20} color="#c8a97e" />
                    <Text style={styles.addBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {analyzingIdx !== null && (
              <View style={styles.scanningRow}>
                <ActivityIndicator color="#c8a97e" />
                <Text style={styles.scanningText}>{tr("scanning", lang)}</Text>
              </View>
            )}

            <Field label={tr("wineName", lang)} value={name} onChangeText={setName} />
            <Field label={tr("winery", lang)} value={winery} onChangeText={setWinery} />
            <Field label={tr("vintage", lang)} value={vintage} onChangeText={setVintage} keyboardType="numeric" />
            <Field label={tr("region", lang)} value={region} onChangeText={setRegion} />
            <Field label={tr("variety", lang)} value={variety} onChangeText={setVariety} />

            <Text style={styles.fieldLabel}>{tr("rating", lang)}</Text>
            <RatingPicker value={rating} onChange={setRating} />

            {estimatedPrice ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{tr("estimatedPrice", lang)}</Text>
                <View style={styles.estimatedBox}>
                  <Text style={styles.estimatedText}>🤖 {estimatedPrice}</Text>
                </View>
              </View>
            ) : null}
            <Field label={tr("price", lang)} value={price} onChangeText={setPrice} placeholder={tr("pricePlaceholder", lang)} />
            <Field label={tr("notes", lang)} value={notes} onChangeText={setNotes} placeholder={tr("notesPlaceholder", lang)} multiline />

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving || analyzingIdx !== null}>
              {saving ? <ActivityIndicator color="#1a0a2e" /> : <Text style={styles.saveBtnText}>{tr("save", lang)}</Text>}
            </TouchableOpacity>
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
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#555"
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 50 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200,169,126,0.2)",
  },
  backBtn: { padding: 8 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 20, gap: 16, paddingBottom: 60 },

  photoStrip: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoThumb: { width: 90, height: 120, borderRadius: 10, overflow: "hidden", position: "relative" },
  thumbImg: { width: 90, height: 120, resizeMode: "cover" },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbRemove: { position: "absolute", top: 4, right: 4 },

  largeBtns: { flexDirection: "row", gap: 12, width: "100%" },
  largeBtn: {
    flex: 1,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200,169,126,0.3)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  largeBtnText: { color: "#c8a97e", fontSize: 13 },
  addBtns: { gap: 8 },
  addBtn: {
    width: 90,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,169,126,0.3)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  addBtnText: { color: "#c8a97e", fontSize: 11 },

  scanningRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scanningText: { color: "#c8a97e", fontSize: 14 },
  field: { gap: 6 },
  fieldLabel: { color: "#c8a97e", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  estimatedBox: {
    backgroundColor: "rgba(200,169,126,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(200,169,126,0.3)",
  },
  estimatedText: { color: "#c8a97e", fontSize: 15 },
  saveBtn: {
    backgroundColor: "#c8a97e",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#1a0a2e", fontSize: 17, fontWeight: "700" },
  cameraUI: { flex: 1, justifyContent: "space-between", padding: 20 },
  cameraClose: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 6,
  },
  captureRow: { alignItems: "center", paddingBottom: 20 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 3, borderColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
});
