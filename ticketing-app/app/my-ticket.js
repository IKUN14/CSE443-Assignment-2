import { Text, View } from "react-native";
import { router } from "expo-router";
import { useDemo } from "../src/context/DemoContext";
import { ActionButton, BackButton, Card, Screen, TopBar, TopTabs } from "../src/components/DemoUI";
import { formatDisplayDate, formatSessionStatus } from "../src/utils/formatters";

export default function MyTicketScreen() {
  const { selectedSession, sessionStatus, username } = useDemo();

  return (
    <Screen>
      <TopBar
        title="My Ticket"
        subtitle="Your current booking"
        left={<BackButton />}
        right={<Text style={{ color: "#888", fontSize: 11, fontWeight: "800" }}>{username}</Text>}
      />

      <TopTabs
        activeKey="my-ticket"
        tabs={[
          { key: "home", label: "Home", onPress: () => router.push("/") },
          { key: "my-ticket", label: "My Ticket", onPress: () => {} },
          { key: "wait-list", label: "Wait List", onPress: () => router.push("/wait-list") },
          { key: "notifications", label: "Alerts", onPress: () => router.push("/notifications") },
        ]}
      />

      {selectedSession ? (
        <>
          <Card
            title="Confirmed session"
            subtitle="This page summarizes the ticket you are currently holding or reviewing."
            style={{ backgroundColor: "rgba(22,163,74,0.08)" }}
          >
            <View style={{ gap: 8 }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{selectedSession.movieTitle}</Text>
              <Text style={{ color: "#d4d4d8" }}>Cinema: {selectedSession.cinema}</Text>
              <Text style={{ color: "#d4d4d8" }}>Date: {formatDisplayDate(selectedSession.date)}</Text>
              <Text style={{ color: "#d4d4d8" }}>Showtime: {selectedSession.showtime}</Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                <Text style={{ color: "#d4d4d8", fontSize: 12, fontWeight: "800" }}>
                  Status: {formatSessionStatus(sessionStatus)}
                </Text>
              </View>
              <Text style={{ color: "#d4d4d8" }}>Price: RM {selectedSession.price}</Text>
            </View>
          </Card>

          <Card title="Ticket actions" subtitle="Use these shortcuts during the demo.">
            <View style={{ gap: 10 }}>
              <ActionButton label="Back to Home" onPress={() => router.push("/")} style={{ width: "100%" }} />
              <ActionButton
                label="Open Showtime"
                variant="secondary"
                onPress={() => router.push(`/showtime/${selectedSession.movieId}`)}
                style={{ width: "100%" }}
              />
            </View>
          </Card>
        </>
      ) : (
        <Card title="No ticket yet" subtitle="You have not completed a booking in this session.">
          <Text style={{ color: "#d4d4d8", lineHeight: 20 }}>
            Pick a movie from the home screen, then continue through booking to see your ticket here.
          </Text>
          <ActionButton label="Browse Movies" onPress={() => router.push("/")} style={{ marginTop: 14, width: "100%" }} />
        </Card>
      )}
    </Screen>
  );
}
