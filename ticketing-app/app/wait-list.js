import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useDemo } from "../src/context/DemoContext";
import { BackButton, Card, Screen, TopBar, TopTabs } from "../src/components/DemoUI";

export default function WaitListScreen() {
  const { notifications, selectedSession, username } = useDemo();

  const waitlistItems = useMemo(
    () =>
      notifications.filter(
        (item) =>
          item.kind === "waitlist" ||
          item.title?.toLowerCase().includes("waitlist") ||
          item.message?.toLowerCase().includes("waitlist")
      ),
    [notifications]
  );

  return (
    <Screen>
      <TopBar
        title="Wait List"
        subtitle="Your sold-out reminders"
        left={<BackButton />}
        right={<Text style={{ color: "#888", fontSize: 11, fontWeight: "800" }}>{username}</Text>}
      />

      <TopTabs
        activeKey="wait-list"
        tabs={[
          { key: "home", label: "Home", onPress: () => router.push("/") },
          { key: "my-ticket", label: "My Ticket", onPress: () => router.push("/my-ticket") },
          { key: "wait-list", label: "Wait List", onPress: () => {} },
          { key: "notifications", label: "Alerts", onPress: () => router.push("/notifications") },
        ]}
      />

      <Card
        title="Waitlist overview"
        subtitle="These entries represent sold-out sessions you are monitoring."
      >
        <Text style={{ color: "#d4d4d8", lineHeight: 20 }}>
          Waitlist is only used when a session is sold out. When a ticket is released, you will get a notification and can claim it within the countdown.
        </Text>
      </Card>

      {selectedSession ? (
        <Card title="Latest watched session" subtitle="Shortcut back into the sold-out flow.">
          <Text style={{ color: "white", fontWeight: "900" }}>{selectedSession.movieTitle}</Text>
          <Text style={{ color: "#d4d4d8", marginTop: 6 }}>
            {selectedSession.cinema} · {selectedSession.showtime}
          </Text>
          <Pressable
            onPress={() => router.push(`/waitlist/${selectedSession.movieId}`)}
            style={{
              marginTop: 14,
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: "#e50914",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Open Session Waitlist</Text>
          </Pressable>
        </Card>
      ) : null}

      {waitlistItems.length ? (
        waitlistItems.map((item) => (
          <Card key={item.id} title={item.title} subtitle="Real-time waitlist alert">
            <Text style={{ color: "white", fontWeight: "800" }}>{item.message}</Text>
          </Card>
        ))
      ) : (
        <Card title="No waitlist items yet" subtitle="Use a sold-out session to generate waitlist events.">
          <Text style={{ color: "#6b7280" }}>No waitlist notifications have been created yet.</Text>
        </Card>
      )}
    </Screen>
  );
}
