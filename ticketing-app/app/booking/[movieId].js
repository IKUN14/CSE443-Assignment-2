import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { movies } from "../../src/data/movies";
import { useDemo } from "../../src/context/DemoContext";
import { ActionButton, BackButton, Card, FooterCTA, HeroBand, NotificationBell, Screen, StatCard, TopBar } from "../../src/components/DemoUI";

const rows = ["A", "B", "C", "D"];
const seatNumbers = ["1", "2", "3", "4", "5"];
const duplicateTicketMessage = "You already have a ticket for this session.";

function normalizeBookingError(message) {
  if (!message) return "Unable to save this ticket.";
  if (message.includes("23505") || message.includes("tickets_active_user_session_idx") || message.includes("already exists")) {
    return duplicateTicketMessage;
  }
  return message;
}

export default function BookingScreen() {
  const { movieId, fromWaitlistClaim } = useLocalSearchParams();
  const { socket, username, selectedSession, setSelectedSession, sessionStatus, setSessionStatus, pushNotification, unreadCount } = useDemo();
  const movie = useMemo(() => movies.find((item) => item.id === movieId), [movieId]);
  const activeSession = useMemo(
    () =>
      selectedSession || {
        sessionId: movie?.sessionId,
        movieId: movie?.id,
        movieTitle: movie?.title,
        cinema: "TGV Queensbay Mall",
        date: "2026-06-15",
        showtime: "8:30 PM",
        price: movie?.price,
      },
    [movie, selectedSession]
  );
  const [selectedSeat, setSelectedSeat] = useState(null);
  const selectedSeatRef = useRef(null);
  const [bookedSeats, setBookedSeats] = useState(["B3"]);
  const [heldSeats, setHeldSeats] = useState({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    selectedSeatRef.current = selectedSeat;
  }, [selectedSeat]);

  useEffect(() => {
    if (!socket || !activeSession) return;

    const onSessionUpdate = (payload) => {
      if (payload.sessionId !== activeSession.sessionId) return;
      setSessionStatus(payload.sessionStatus || payload.status || "normal", payload.sessionId);
      if (Array.isArray(payload.bookedSeats)) setBookedSeats(payload.bookedSeats);
      if (payload.heldSeats && typeof payload.heldSeats === "object") setHeldSeats(payload.heldSeats);
    };

    socket.on("session_update", onSessionUpdate);
    socket.emit("sync_seat_state", { sessionId: activeSession.sessionId }, (result) => {
      if (!result?.ok) return;
      if (Array.isArray(result.bookedSeats)) setBookedSeats(result.bookedSeats);
      if (result.heldSeats && typeof result.heldSeats === "object") setHeldSeats(result.heldSeats);
    });

    return () => {
      socket.off("session_update", onSessionUpdate);
      const heldSeat = selectedSeatRef.current;
      if (heldSeat) {
        socket.emit("release_seat_hold", {
          userId: username,
          sessionId: activeSession.sessionId,
          seat: heldSeat,
        });
      }
    };
  }, [activeSession, setSessionStatus, socket, username]);

  useEffect(() => {
    if (!selectedSeat) return;
    const heldBy = heldSeats[selectedSeat];
    const unavailable = bookedSeats.includes(selectedSeat) || (heldBy && heldBy !== username);
    if (unavailable) {
      setSelectedSeat(null);
    }
  }, [bookedSeats, heldSeats, selectedSeat, username]);

  useEffect(() => {
    if (sessionStatus === "sold_out" && fromWaitlistClaim !== "1") {
      router.replace(`/waitlist/${movieId}`);
    }
  }, [fromWaitlistClaim, movieId, sessionStatus]);

  if (!movie || !activeSession) return null;

  const selectSeat = (seatId) => {
    if (bookedSeats.includes(seatId) || (heldSeats[seatId] && heldSeats[seatId] !== username)) {
      Alert.alert("Seat unavailable", "This seat is already taken or currently selected by another user.");
      return;
    }

    if (selectedSeat === seatId) {
      setSelectedSeat(null);
      if (socket && activeSession.sessionId) {
        socket.emit("release_seat_hold", {
          userId: username,
          sessionId: activeSession.sessionId,
          seat: seatId,
        });
      }
      return;
    }

    if (!socket || !activeSession.sessionId) {
      setSelectedSeat(seatId);
      return;
    }

    socket.emit(
      "hold_seat",
      {
        userId: username,
        sessionId: activeSession.sessionId,
        seat: seatId,
      },
      (result) => {
        if (!result?.ok) {
          Alert.alert("Seat unavailable", result?.message || "Unable to select this seat.");
          return;
        }
        if (Array.isArray(result.bookedSeats)) setBookedSeats(result.bookedSeats);
        if (result.heldSeats && typeof result.heldSeats === "object") setHeldSeats(result.heldSeats);
        setSelectedSeat(seatId);
      }
    );
  };

  const confirmBooking = () => {
    if (!selectedSeat) {
      Alert.alert("Select a seat", "Pick one available seat before confirming.");
      return;
    }
    if (confirming) return;

    const ticketPayload = {
      ...activeSession,
      userId: username,
      seat: selectedSeat,
    };

    const completeBooking = (ticket = null) => {
      setConfirming(false);
      setSelectedSession({
        ...ticketPayload,
        ticketId: ticket?.id || null,
      });
      Alert.alert("Booking confirmed", `${movie.title} at ${activeSession.cinema} for seat ${selectedSeat}.`);
      router.replace("/my-ticket");
    };

    if (!socket || !activeSession.sessionId) {
      completeBooking();
      return;
    }

    setConfirming(true);
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setConfirming(false);
      pushNotification("error", "Booking failed", "The server did not respond. Restart the ticketing server and try again.");
    }, 5000);

    socket.emit("confirm_booking", ticketPayload, (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (!result?.ok) {
        setConfirming(false);
        pushNotification("error", "Booking failed", normalizeBookingError(result?.message));
        return;
      }

      if (result.duplicate) {
        setConfirming(false);
        setSelectedSession({
          ...ticketPayload,
          ticketId: result.ticket?.id || null,
        });
        Alert.alert("Ticket already exists", result.message || duplicateTicketMessage);
        router.replace("/my-ticket");
        return;
      }

      completeBooking(result.ticket || null);
    });
  };

  return (
    <Screen
      footer={
        <FooterCTA>
          <ActionButton
            label={confirming ? "Saving Ticket..." : selectedSeat ? `Confirm Booking · RM ${movie.price}` : "Select a seat"}
            onPress={confirmBooking}
            style={{ width: "100%", backgroundColor: selectedSeat ? "#e50914" : "#1a1a1a" }}
            disabled={!selectedSeat || confirming}
          />
        </FooterCTA>
      }
    >
      <TopBar
        title="Select Seats"
        subtitle={`${movie.title} · ${activeSession.showtime}`}
        left={<BackButton />}
        right={<NotificationBell count={unreadCount} onPress={() => router.push("/notifications")} />}
      />

      <HeroBand
        eyebrow="Seat selection"
        title={movie.title}
        subtitle={`${activeSession.cinema} · ${activeSession.showtime}`}
        accent="#e50914"
      />

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <StatCard label="Seat" value={selectedSeat ?? "-"} helper="Tap an available seat" tone="accent" />
        <StatCard label="Price" value={`RM ${movie.price}`} helper="Summary total" tone="success" />
      </View>

      <Card title="Cinema screen" subtitle="Seat map for the demo session.">
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              width: "100%",
              height: 8,
              borderRadius: 999,
              backgroundColor: "#e50914",
              marginBottom: 10,
            }}
          />
          <Text style={{ color: "#6b7280", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
            Screen this way
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 }}>
          <Text style={{ color: "#6b7280", fontSize: 11 }}>Available</Text>
          <Text style={{ color: "#e50914", fontSize: 11 }}>Selected</Text>
          <Text style={{ color: "#6b7280", fontSize: 11 }}>Booked</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          {rows.map((row) => (
            <View key={row} style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 8 }}>
              <Text style={{ width: 16, textAlign: "center", color: "#444", fontWeight: "700" }}>{row}</Text>
              {seatNumbers.map((seat) => {
                const seatId = `${row}${seat}`;
                const heldBy = heldSeats[seatId];
                const heldByOther = Boolean(heldBy && heldBy !== username);
                const booked = bookedSeats.includes(seatId);
                const unavailable = booked || heldByOther;
                const selected = selectedSeat === seatId;
                return (
                  <Pressable
                    key={seatId}
                    onPress={() => selectSeat(seatId)}
                    disabled={unavailable}
                    style={{
                      width: 32,
                      height: 28,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: unavailable ? "#191919" : selected ? "#e50914" : "#3a3a3a",
                      backgroundColor: unavailable ? "#0e0e0e" : selected ? "#e50914" : "#222",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: unavailable ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: unavailable ? "#2c2c2c" : selected ? "#fff" : "#666", fontSize: 9, fontWeight: selected ? "900" : "500" }}>
                      {seat}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={{ width: 16, textAlign: "center", color: "#444", fontWeight: "700" }}>{row}</Text>
            </View>
          ))}
        </View>

        <Text style={{ textAlign: "center", color: "#2a2a2a", fontSize: 10, letterSpacing: 2, marginTop: 10 }}>
          AISLE
        </Text>
      </Card>

      <Card title="Booking summary" subtitle="Review before confirming.">
        <Pressable onPress={() => setSummaryOpen((v) => !v)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#a1a1aa", fontSize: 12 }}>Tap to {summaryOpen ? "collapse" : "expand"} booking summary</Text>
          <Text style={{ color: "#a1a1aa" }}>{summaryOpen ? "▾" : "▸"}</Text>
        </Pressable>

        {summaryOpen ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ color: "#d4d4d8" }}>Movie: {movie.title}</Text>
            <Text style={{ color: "#d4d4d8" }}>Cinema: {activeSession.cinema}</Text>
            <Text style={{ color: "#d4d4d8" }}>Showtime: {activeSession.showtime}</Text>
            <Text style={{ color: "#d4d4d8" }}>Seat: {selectedSeat || "Not selected"}</Text>
            <Text style={{ color: "#d4d4d8" }}>Price: RM {movie.price}</Text>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
