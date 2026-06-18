import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useDemo } from "../src/context/DemoContext";
import { ActionButton, BackButton, Card, ChoiceChip, Screen, StatCard, TopBar } from "../src/components/DemoUI";
import { formatDateTime, formatSessionStatus } from "../src/utils/formatters";

const statusButtons = [
  { label: "Set Normal", event: "set_session_normal", tone: "#16a34a" },
  { label: "Set High Demand", event: "set_session_high_demand", tone: "#ffb703" },
  { label: "Mark Sold Out", event: "mark_sold_out", tone: "#e50914" },
];

export default function AdminScreen() {
  const { socket, pushNotification } = useDemo();
  const [snapshot, setSnapshot] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onAdminStateUpdate = (payload) => {
      setSnapshot(payload);
      if (!selectedSessionId && payload.sessions?.[0]?.id) {
        setSelectedSessionId(payload.sessions[0].id);
      }
    };

    const onToastMessage = (payload) => {
      pushNotification(payload.type || "info", "Admin event", payload.message || "Update received.");
    };

    // Ask the backend for the current snapshot as soon as this screen opens.
    socket.emit("admin_request_state");
    socket.on("admin_state_update", onAdminStateUpdate);
    socket.on("toast_message", onToastMessage);

    return () => {
      socket.off("admin_state_update", onAdminStateUpdate);
      socket.off("toast_message", onToastMessage);
    };
  }, [pushNotification, selectedSessionId, socket]);

  const session = useMemo(
    () => snapshot?.sessions?.find((item) => item.id === selectedSessionId) || snapshot?.sessions?.[0],
    [selectedSessionId, snapshot]
  );

  if (!session) {
    return (
      <Screen scroll={false}>
        <TopBar title="Admin Panel" subtitle="Loading session data..." left={<BackButton />} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "white" }}>Waiting for server snapshot...</Text>
        </View>
      </Screen>
    );
  }

  const emit = (eventName) => {
    socket.emit(eventName, { sessionId: session.id });
  };

  return (
    <Screen scroll={false}>
      <TopBar
        title="Admin Panel"
        subtitle="Real-time demo controls"
        left={<BackButton />}
        right={
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              backgroundColor: "#1a1000",
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: "#3a2500",
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "#ffb703" }} />
            <Text style={{ color: "#ffb703", fontSize: 10, fontWeight: "900", letterSpacing: 1 }}>DEMO</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Card title="Session status" subtitle="Pick a demo session and switch its state.">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {(snapshot?.sessions || []).map((item) => (
              <ChoiceChip
                key={item.id}
                label={item.movieTitle}
                selected={selectedSessionId === item.id}
                onPress={() => setSelectedSessionId(item.id)}
              />
            ))}
          </View>
          <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
            <StatCard
              label="Status"
              value={formatSessionStatus(session.sessionStatus)}
              helper="Normal / High demand / Sold out"
              tone="success"
              valueStyle={{ fontSize: 22, lineHeight: 26 }}
              helperStyle={{ maxWidth: 120 }}
            />
            <StatCard label="Seats" value={String(session.availableSeats)} helper="Available seats" tone="accent" />
          </View>
        </Card>

        <Card title="Controls" subtitle="These buttons drive the live demo flow.">
          <View style={{ gap: 10 }}>
            {statusButtons.map((item) => (
              <ActionButton
                key={item.event}
                label={item.label}
                onPress={() => emit(item.event)}
                style={{ width: "100%", backgroundColor: item.tone }}
              />
            ))}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton label="Allow Next User" onPress={() => emit("allow_next_user")} style={{ flex: 1, backgroundColor: "#22c55e" }} />
              <ActionButton label="Release Ticket" onPress={() => emit("release_ticket")} style={{ flex: 1, backgroundColor: "#f59e0b" }} />
            </View>
            <ActionButton label="Reset Demo" variant="secondary" onPress={() => emit("reset_demo")} style={{ width: "100%" }} />
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <StatCard label="Queue" value={String(session.queue.length)} helper="Current queue" tone="accent" />
          <StatCard label="Waitlist" value={String(session.waitlist.length)} helper="Current waitlist" tone="success" />
        </View>

        <Card title="Current Queue" subtitle="Real-time queue order.">
          {session.queue.length ? (
            session.queue.map((entry) => (
              <View
                key={entry.userId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#12331f",
                    borderWidth: 1,
                    borderColor: "rgba(34,197,94,0.3)",
                  }}
                >
                  <Text style={{ color: "#4ade80", fontWeight: "900" }}>{entry.position}</Text>
                </View>
                <Text style={{ color: "white", fontWeight: "800" }}>{entry.userId}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6b7280" }}>No queue entries.</Text>
          )}
        </Card>

        <Card title="Current Waitlist" subtitle="Users waiting for a released ticket.">
          {session.waitlist.length ? (
            session.waitlist.map((entry) => (
              <View
                key={entry.userId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#332300",
                    borderWidth: 1,
                    borderColor: "rgba(255,183,3,0.25)",
                  }}
                >
                  <Text style={{ color: "#ffb703", fontWeight: "900" }}>{entry.position}</Text>
                </View>
                <Text style={{ color: "white", fontWeight: "800" }}>{entry.userId}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6b7280" }}>No waitlist entries.</Text>
          )}
        </Card>

        <Card title="Latest Events" subtitle="Recent server activity.">
          {session.latestEvents?.length ? (
            session.latestEvents.map((item) => (
              <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>{item.message}</Text>
                <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{formatDateTime(item.timestamp)}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6b7280" }}>No events yet.</Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}
