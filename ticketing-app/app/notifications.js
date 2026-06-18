import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDemo } from "../src/context/DemoContext";
import { movies } from "../src/data/movies";
import { Card, ChoiceChip, Screen, TopBar, TopTabs } from "../src/components/DemoUI";

const filters = [
  { key: "All", label: "All" },
  { key: "waitlist", label: "Waitlist" },
  { key: "queue", label: "Queue" },
  { key: "tickets", label: "Tickets" },
];

const ticketKinds = new Set(["booking", "success", "ticket"]);

function formatKind(kind) {
  if (kind === "queue") return "Queue";
  if (kind === "waitlist") return "Waitlist";
  if (kind === "ticket") return "Ticket";
  if (kind === "booking") return "Booking";
  if (kind === "success") return "Success";
  if (kind === "error") return "Error";
  return "Info";
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function kindColors(kind) {
  if (kind === "error") return { accent: "#e50914", background: "rgba(229,9,20,0.12)", border: "rgba(229,9,20,0.28)" };
  if (kind === "booking" || kind === "success" || kind === "ticket") return { accent: "#4ade80", background: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.25)" };
  if (kind === "waitlist") return { accent: "#ffb703", background: "rgba(255,183,3,0.10)", border: "rgba(255,183,3,0.25)" };
  if (kind === "queue") return { accent: "#60a5fa", background: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)" };
  return { accent: "#a78bfa", background: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.25)" };
}

function kindIcon(kind) {
  if (kind === "error") return "alert-circle";
  if (kind === "booking" || kind === "ticket") return "ticket";
  if (kind === "waitlist") return "hourglass";
  if (kind === "queue") return "list";
  if (kind === "success") return "checkmark-circle";
  return "notifications";
}

function groupTitle(notification) {
  const movie = movies.find((item) => item.id === notification.movieId);
  if (movie) return movie.title;
  if (notification.sessionId) return notification.sessionId;
  return "General";
}

export default function NotificationsScreen() {
  const { notifications, notificationsLoaded, markAllNotificationsRead, markNotificationRead, clearNotifications, removeNotification } = useDemo();
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((item) => {
        if (filter === "All") return true;
        if (filter === "tickets") return ticketKinds.has(item.kind);
        return item.kind === filter;
      });
  }, [filter, notifications]);

  const groupedNotifications = useMemo(() => {
    const groups = new Map();

    visibleNotifications.forEach((item) => {
      // Group by movie/session so the inbox reads like booking threads instead of a flat event log.
      const key = item.movieId || item.sessionId || "general";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          title: groupTitle(item),
          subtitle: item.sessionId || "General updates",
          items: [],
        });
      }
      groups.get(key).items.push(item);
    });

    return Array.from(groups.values());
  }, [visibleNotifications]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <Screen>
      <TopBar
        title="Notifications"
        subtitle="Real-time booking alerts"
        left={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={18} color="#888" />
          </Pressable>
        }
        right={
          <Pressable
            onPress={markAllNotificationsRead}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#1b1b20",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ color: "#d4d4d8", fontSize: 11, fontWeight: "800" }}>{unreadCount} unread</Text>
          </Pressable>
        }
      />

      <TopTabs
        activeKey="notifications"
        tabs={[
          { key: "home", label: "Home", onPress: () => router.push("/") },
          { key: "my-ticket", label: "My Ticket", onPress: () => router.push("/my-ticket") },
          { key: "wait-list", label: "Wait List", onPress: () => router.push("/wait-list") },
          { key: "notifications", label: "Alerts", onPress: () => {} },
        ]}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 }}>
        <View style={{ flex: 1, flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {filters.map((item) => (
            <ChoiceChip
              key={item.key}
              label={item.label}
              selected={filter === item.key}
              onPress={() => setFilter(item.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 9 }}
            />
          ))}
        </View>
        <Pressable
          onPress={clearNotifications}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111116",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Ionicons name="trash-outline" size={17} color="#d4d4d8" />
        </Pressable>
      </View>

      {!notificationsLoaded ? (
        <Card title="Loading notifications" subtitle="Syncing with Supabase...">
          <Text style={{ color: "#6b7280", lineHeight: 20 }}>Pulling your saved notifications from the database.</Text>
        </Card>
      ) : groupedNotifications.length ? (
        groupedNotifications.map((group) => {
          const unreadInGroup = group.items.filter((item) => !item.read).length;

          return (
            <View key={group.key} style={{ marginBottom: 16 }}>
              <View style={{ paddingHorizontal: 2, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: "#f5f5f5", fontSize: 14, fontWeight: "900" }}>{group.title}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>{group.subtitle}</Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: unreadInGroup > 0 ? "rgba(229,9,20,0.12)" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <Text style={{ color: unreadInGroup > 0 ? "#ff9b9b" : "#9ca3af", fontSize: 10, fontWeight: "800" }}>
                    {unreadInGroup > 0 ? `${unreadInGroup} unread` : "All read"}
                  </Text>
                </View>
              </View>

              {group.items.map((item) => {
                const colors = kindColors(item.kind);
                const hasRoute = Boolean(item.route);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      markNotificationRead(item.id);
                      if (hasRoute) router.push(item.route);
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Card
                      title={formatKind(item.kind)}
                      subtitle={item.title}
                      style={{
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ gap: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: colors.border,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Ionicons name={kindIcon(item.kind)} size={16} color={colors.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "white", fontWeight: "900", fontSize: 16, lineHeight: 22 }}>{item.message}</Text>
                            <Text style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>{formatTime(item.timestamp)}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: item.read ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.12)",
                              }}
                            >
                              <Text style={{ color: item.read ? "#9ca3af" : "#ffffff", fontSize: 10, fontWeight: "800" }}>
                                {item.read ? "Read" : "Unread"}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => {
                                markNotificationRead(item.id);
                                removeNotification(item.id);
                              }}
                              hitSlop={8}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "rgba(255,255,255,0.04)",
                              }}
                            >
                              <Ionicons name="trash-outline" size={14} color="#9ca3af" />
                            </Pressable>
                          </View>
                        </View>

                        {item.actionLabel || hasRoute ? (
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ color: "#d4d4d8", fontSize: 12 }}>{item.actionLabel || "Open details"}</Text>
                            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>Tap to open</Text>
                          </View>
                        ) : null}
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      ) : (
        <Card title="No notifications yet" subtitle="Real-time updates from booking, queue, and waitlist will appear here.">
          <Text style={{ color: "#6b7280", lineHeight: 20 }}>
            Use the app and admin controls to generate live events. Queue and waitlist alerts now include quick links back to the relevant screen.
          </Text>
        </Card>
      )}
    </Screen>
  );
}
