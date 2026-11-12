import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useNavigation } from "@/context/NavigationContext";
import { fetchAllManualsFromHygraph, toCompatManual, type CompatManual } from "@/lib/hygraph";
import { openManual } from "@/lib/openManual";
import { getOpensLabel, isManualUnlocked, useNow } from "@/lib/unlock";

const ACCENT = "#9d00d4";

// Weekly devotional, built from the manuals themselves: the memory verse and
// scripture of the latest manual that has opened, plus a teaser for the one
// opening next. Updates by itself when a new manual opens on Friday.
export default function Devotionals() {
  const { isDarkMode } = useNavigation();
  const router = useRouter();
  const now = useNow();

  const [manuals, setManuals] = useState<CompatManual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchAllManualsFromHygraph();
      setManuals(raw.map((m, i) => toCompatManual(m, i + 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this week's devotional.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { current, upcoming } = useMemo(() => {
    const sorted = [...manuals].sort((a, b) => a.studyDate.localeCompare(b.studyDate));
    const opened = sorted.filter((m) => isManualUnlocked(m, now));
    return {
      current: opened[opened.length - 1] ?? null,
      upcoming: sorted.find((m) => !isManualUnlocked(m, now)) ?? null,
    };
  }, [manuals, now]);

  const handleOpen = async () => {
    if (!current || opening) return;
    setOpening(true);
    try {
      await openManual(router, current);
    } finally {
      setOpening(false);
    }
  };

  const text = isDarkMode ? "#FFF" : "#000";
  const muted = isDarkMode ? "#999" : "#666";
  const card = isDarkMode ? "#141414" : "#FFF";
  const border = isDarkMode ? "#333" : "#e5e5e5";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? "#000" : "#FFF" }]}>
      <Text style={[styles.title, { color: text }]}>Devotionals</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="wifi-off" size={36} color={ACCENT} />
          <Text style={[styles.message, { color: muted }]}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={load} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : !current ? (
        <View style={styles.center}>
          <MaterialIcons name="wb-sunny" size={36} color={ACCENT} />
          <Text style={[styles.message, { color: muted }]}>
            {upcoming ? `The first devotional ${getOpensLabel(upcoming).toLowerCase()}.` : "No devotionals yet."}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <Text style={styles.eyebrow}>THIS WEEK · {current.date}</Text>
            <Text style={[styles.cardTitle, { color: text }]}>{current.title}</Text>
            {!!current.theme && <Text style={[styles.theme, { color: ACCENT }]}>{current.theme}</Text>}

            {!!current.memoryVerse && (
              <View style={[styles.verseBox, { backgroundColor: isDarkMode ? "#241a2e" : "#f3e5fb" }]}>
                <Text style={styles.verseLabel}>Memory verse</Text>
                <Text style={[styles.verse, { color: text }]}>{current.memoryVerse}</Text>
              </View>
            )}

            {!!current.text && <Text style={[styles.scripture, { color: muted }]}>{current.text}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleOpen} activeOpacity={0.8} disabled={opening}>
              {opening ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Read this week&apos;s manual</Text>}
            </TouchableOpacity>
          </View>

          {upcoming && (
            <View style={[styles.upNext, { backgroundColor: card, borderColor: border }]}>
              <MaterialIcons name="lock-clock" size={22} color={ACCENT} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.upNextLabel, { color: muted }]}>Up next</Text>
                <Text numberOfLines={2} style={[styles.upNextTitle, { color: text }]}>
                  {upcoming.title}
                </Text>
                <Text style={[styles.upNextOpens, { color: ACCENT }]}>{getOpensLabel(upcoming)}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 26, fontFamily: "Manrope_800ExtraBold", marginBottom: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, marginBottom: 80 },
  message: { fontSize: 14, fontFamily: "Manrope_400Regular", textAlign: "center", lineHeight: 21, marginTop: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 1, color: ACCENT, fontFamily: "Manrope_700Bold", marginBottom: 8 },
  cardTitle: { fontSize: 20, fontFamily: "Manrope_800ExtraBold", lineHeight: 27 },
  theme: { fontSize: 13, fontFamily: "Manrope_600SemiBold", marginTop: 6 },
  verseBox: { borderRadius: 12, padding: 14, marginTop: 16 },
  verseLabel: { fontSize: 11, color: ACCENT, fontFamily: "Manrope_700Bold", marginBottom: 4 },
  verse: { fontSize: 15, fontFamily: "Manrope_600SemiBold", lineHeight: 22 },
  scripture: { fontSize: 13, fontFamily: "Manrope_400Regular", lineHeight: 20, marginTop: 12 },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 18,
  },
  buttonText: { color: "#FFF", fontSize: 14, fontFamily: "Manrope_700Bold" },
  upNext: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  upNextLabel: { fontSize: 11, fontFamily: "Manrope_600SemiBold" },
  upNextTitle: { fontSize: 14, fontFamily: "Manrope_700Bold", marginTop: 2 },
  upNextOpens: { fontSize: 12, fontFamily: "Manrope_600SemiBold", marginTop: 4 },
});
