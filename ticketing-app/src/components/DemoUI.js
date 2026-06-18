import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export function Screen({ children, scroll = true, style, footer }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#09090b" }}>
      {scroll ? (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[{ flexGrow: 1, padding: 16, paddingBottom: 24 }, style]}>
            {children}
          </ScrollView>
          {footer}
        </View>
      ) : (
        <View style={[{ flex: 1, padding: 16 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function TopBar({ title, subtitle, left, right }) {
  return (
    <View
      style={{
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
        backgroundColor: "#0d0d0f",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {left}
        <View style={{ flex: 1 }}>
          <Text style={{ color: "white", fontWeight: "900", fontSize: 15 }}>{title}</Text>
          {subtitle ? <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function BackButton({ label = "Back", onPress, color = "#888" }) {
  return (
    <Pressable
      onPress={onPress || (() => router.back())}
      hitSlop={10}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Ionicons name="arrow-back" size={18} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function NotificationBell({ count = 0, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#1b1b20",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <Ionicons name="notifications-outline" size={18} color="white" />
      {count > 0 ? (
        <View
          style={{
            position: "absolute",
            right: -1,
            top: -1,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            paddingHorizontal: 4,
            backgroundColor: "#e50914",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 9, fontWeight: "900" }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function TopTabs({ tabs, activeKey }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginBottom: 14,
        padding: 4,
        borderRadius: 18,
        backgroundColor: "#111116",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
                return (
          <Pressable
            key={tab.key}
            onPress={tab.onPress}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? "#e50914" : "transparent",
            }}
            >
              <Text style={{ color: active ? "white" : "#8a8a93", fontWeight: "900", fontSize: 12 }}>
                {tab.label}
              </Text>
            </Pressable>
        );
      })}
    </View>
  );
}

export function HeroBand({ eyebrow, title, subtitle, accent = "#e50914" }) {
  return (
    <View
      style={{
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        backgroundColor: "#111116",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: -30,
          top: -30,
          width: 120,
          height: 120,
          borderRadius: 999,
          backgroundColor: "rgba(229, 9, 20, 0.14)",
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: accent }} />
        <Text style={{ color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>
          {eyebrow}
        </Text>
      </View>
      <Text style={{ color: "white", fontSize: 28, lineHeight: 32, fontWeight: "900" }}>{title}</Text>
      {subtitle ? <Text style={{ color: "#a1a1aa", marginTop: 8, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function HeroHeader({ eyebrow, title, subtitle, meta }) {
  return (
    <View
      style={{
        marginBottom: 16,
        borderRadius: 28,
        padding: 18,
        backgroundColor: "#111116",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: -36,
          top: -26,
          width: 150,
          height: 150,
          borderRadius: 999,
          backgroundColor: "rgba(214,40,40,0.16)",
        }}
      />
      <View
        style={{
          width: 88,
          paddingVertical: 7,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: "rgba(214,40,40,0.16)",
        }}
      >
        <Text style={{ color: "#ff9f9f", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>
          {eyebrow}
        </Text>
      </View>
      <Text
        style={{
          color: "white",
          fontSize: 30,
          lineHeight: 34,
          fontWeight: "900",
          marginTop: 14,
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      <Text style={{ color: "#b4b4bf", marginTop: 8, lineHeight: 22 }}>{subtitle}</Text>
      {meta ? <Text style={{ color: "#ffb703", marginTop: 10, fontWeight: "700" }}>{meta}</Text> : null}
    </View>
  );
}

export function Card({ title, subtitle, children, style }) {
  return (
    <View
      style={[
        {
          borderRadius: 24,
          padding: 16,
          backgroundColor: "#121219",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          marginBottom: 14,
        },
        style,
      ]}
    >
      {(title || subtitle) && (
        <View style={{ marginBottom: 12 }}>
          {title ? (
            <Text style={{ color: "#ffd166", fontSize: 12, letterSpacing: 1.2, fontWeight: "900" }}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={{ color: "#a1a1aa", marginTop: 4, lineHeight: 18 }}>{subtitle}</Text>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

export function ActionButton({ label, onPress, variant = "primary", disabled = false, style }) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isPrimary ? "#e50914" : isDanger ? "#7f0000" : "#222230",
          borderWidth: 1,
          borderColor: isPrimary ? "rgba(255,107,107,0.5)" : isDanger ? "rgba(229,9,20,0.45)" : "rgba(255,255,255,0.08)",
          opacity: disabled ? 0.55 : 1,
          flexDirection: "row",
          gap: 8,
        },
        style,
      ]}
    >
      <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChoiceChip({ label, selected, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderRadius: 999,
          backgroundColor: selected ? "#ffb703" : "#1f1f29",
          borderWidth: 1,
          borderColor: selected ? "#ffd166" : "rgba(255,255,255,0.08)",
        },
        style,
      ]}
    >
      <Text style={{ color: selected ? "#09090b" : "white", fontWeight: "800", fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatCard({ label, value, helper, tone = "neutral", valueStyle, helperStyle }) {
  const palette =
    tone === "accent"
      ? { bg: "rgba(255,183,3,0.12)", border: "rgba(255,183,3,0.22)", value: "#ffcf70" }
      : tone === "success"
        ? { bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.22)", value: "#8ff1df" }
        : { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", value: "#f5f5f7" };

  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 18,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        minWidth: 92,
      }}
    >
      <Text style={{ color: "#a1a1aa", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={[{ color: palette.value, fontSize: 26, fontWeight: "900", marginTop: 8 }, valueStyle]}>{value}</Text>
      {helper ? <Text style={[{ color: "#d4d4d8", fontSize: 12, marginTop: 6, lineHeight: 16 }, helperStyle]}>{helper}</Text> : null}
    </View>
  );
}

export function FooterCTA({ children }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.08)",
        backgroundColor: "#0d0d0f",
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}
