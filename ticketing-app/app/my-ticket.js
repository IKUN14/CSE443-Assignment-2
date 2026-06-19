import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useDemo } from "../src/context/DemoContext";
import { ActionButton, BackButton, Card, Screen, TopBar, TopTabs } from "../src/components/DemoUI";
import { formatDisplayDate, formatSessionStatus } from "../src/utils/formatters";

export default function MyTicketScreen() {
  const { selectedSession, setSelectedSession, sessionStatus, socket, username, pushNotification } = useDemo();
  const [refunding, setRefunding] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  const executeRefund = () => {
    if (!selectedSession) return;
    if (refunding) return;
    setRefundDialogOpen(false);

    const clearTicket = (message = "Your ticket has been refunded.") => {
      setRefunding(false);
      setSelectedSession(null);
      pushNotification("refund", "Ticket refunded", message, {
        route: "/",
        actionLabel: "Browse movies",
        sessionId: selectedSession.sessionId,
        movieId: selectedSession.movieId,
        tone: "success",
      });
      router.replace("/");
    };

    if (!socket || !selectedSession.sessionId) {
      clearTicket();
      return;
    }

    setRefunding(true);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setRefunding(false);
      pushNotification("error", "Refund failed", "The server did not respond. Restart the ticketing server and try again.");
    }, 5000);

    socket.emit(
      "refund_ticket",
      {
        userId: username,
        sessionId: selectedSession.sessionId,
      },
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

        if (!result?.ok) {
          setRefunding(false);
          pushNotification("error", "Refund failed", result?.message || "Unable to refund this ticket.");
          return;
        }

        clearTicket(result.message || "Your ticket has been refunded.");
      }
    );
  };

  const refundTicket = () => {
    if (!selectedSession) return;
    setRefundDialogOpen(true);
  };

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
              {selectedSession.seat ? <Text style={{ color: "#d4d4d8" }}>Seat: {selectedSession.seat}</Text> : null}
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
              <ActionButton
                label={refunding ? "Refunding..." : "Refund Ticket"}
                variant="danger"
                disabled={refunding}
                onPress={refundTicket}
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

      <Modal
        visible={refundDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRefundDialogOpen(false)}
      >
        <Pressable
          onPress={() => !refunding && setRefundDialogOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 24,
              padding: 18,
              backgroundColor: "#121219",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(229,9,20,0.14)",
                borderWidth: 1,
                borderColor: "rgba(229,9,20,0.35)",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#ff6b6b", fontSize: 22, fontWeight: "900" }}>!</Text>
            </View>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>Refund this ticket?</Text>
            <Text style={{ color: "#a1a1aa", lineHeight: 20, marginTop: 8 }}>
              This will cancel your booking and release the seat back to the session.
            </Text>

            {selectedSession ? (
              <View
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  gap: 7,
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{selectedSession.movieTitle}</Text>
                <Text style={{ color: "#d4d4d8" }}>Showtime: {selectedSession.showtime}</Text>
                <Text style={{ color: "#d4d4d8" }}>Seat: {selectedSession.seat || "-"}</Text>
                <Text style={{ color: "#d4d4d8" }}>Refund amount: RM {selectedSession.price}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <ActionButton
                label="Keep Ticket"
                variant="secondary"
                disabled={refunding}
                onPress={() => setRefundDialogOpen(false)}
                style={{ flex: 1 }}
              />
              <ActionButton
                label={refunding ? "Refunding..." : "Confirm Refund"}
                variant="danger"
                disabled={refunding}
                onPress={executeRefund}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
