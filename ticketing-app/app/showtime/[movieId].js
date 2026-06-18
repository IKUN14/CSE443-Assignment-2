import { useEffect, useMemo, useState } from "react";
import { ImageBackground, SafeAreaView, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { movies } from "../../src/data/movies";
import { useDemo } from "../../src/context/DemoContext";
import { ActionButton, BackButton, Card, ChoiceChip, FooterCTA, HeroBand, NotificationBell, Screen, StatCard, TopBar } from "../../src/components/DemoUI";
import { formatDisplayDate } from "../../src/utils/formatters";

export default function ShowtimeScreen() {
  const { movieId } = useLocalSearchParams();
  const { socket, username, selectedSession, setSelectedSession, sessionStatus, setSessionStatus, pushNotification, unreadCount } = useDemo();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedCinema, setSelectedCinema] = useState("TGV Queensbay Mall");
  const [selectedDate, setSelectedDate] = useState("2026-06-15");
  const [selectedShowtime, setSelectedShowtime] = useState("8:30 PM");
  const [requestState, setRequestState] = useState("idle");

  const movie = useMemo(() => movies.find((item) => item.id === movieId), [movieId]);

  if (!movie) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#09090b", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white" }}>Movie not found.</Text>
      </SafeAreaView>
    );
  }

  const session = {
    sessionId: movie.sessionId,
    movieId: movie.id,
    movieTitle: movie.title,
    cinema: selectedCinema,
    date: selectedDate,
    showtime: selectedShowtime,
    price: movie.price,
  };

  useEffect(() => {
    if (!socket) return;

    const onDirectBookingAllowed = (payload) => {
      if (payload.sessionId !== session.sessionId || payload.userId !== username) return;
      setRequestState("idle");
      pushNotification("booking", "Direct booking allowed", "Seats are available. Continue to seat selection.", {
        route: `/booking/${movie.id}`,
        actionLabel: "Continue booking",
        sessionId: session.sessionId,
        movieId: movie.id,
      });
      router.push(`/booking/${movie.id}`);
    };

    const onQueueUpdate = (payload) => {
      if (payload.sessionId !== session.sessionId || payload.userId !== username) return;
      setRequestState("idle");
      pushNotification("queue", "Queue updated", `Your queue position is ${payload.position}.`, {
        route: `/queue/${movie.id}`,
        actionLabel: "Open queue",
        sessionId: session.sessionId,
        movieId: movie.id,
      });
      router.push(`/queue/${movie.id}`);
    };

    const onRedirectToWaitlist = (payload) => {
      if (payload.sessionId !== session.sessionId || payload.userId !== username) return;
      setRequestState("idle");
      pushNotification("waitlist", "Redirected to waitlist", "This session is sold out.", {
        route: `/waitlist/${movie.id}`,
        actionLabel: "Open waitlist",
        sessionId: session.sessionId,
        movieId: movie.id,
      });
      router.push(`/waitlist/${movie.id}`);
    };

    const onSessionUpdate = (payload) => {
      if (payload.sessionId !== session.sessionId) return;
      setSessionStatus(payload.sessionStatus || payload.status || "normal");
    };

    const onError = (message) => {
      setRequestState("idle");
      pushNotification("error", "Booking error", message);
    };

    socket.on("direct_booking_allowed", onDirectBookingAllowed);
    socket.on("queue_update", onQueueUpdate);
    socket.on("redirect_to_waitlist", onRedirectToWaitlist);
    socket.on("session_update", onSessionUpdate);
    socket.on("error_message", onError);

    return () => {
      socket.off("direct_booking_allowed", onDirectBookingAllowed);
      socket.off("queue_update", onQueueUpdate);
      socket.off("redirect_to_waitlist", onRedirectToWaitlist);
      socket.off("session_update", onSessionUpdate);
      socket.off("error_message", onError);
    };
  }, [movie?.id, pushNotification, session.sessionId, setSessionStatus, socket, username]);

  const statusCopy =
    sessionStatus === "high_demand"
      ? "This is a high-demand session. A real-time queue may be used before seat selection."
      : sessionStatus === "sold_out"
        ? "This showtime is currently sold out. You may join the waitlist."
        : "Seats are available. You can continue directly to seat selection.";

  const buttonLabel = sessionStatus === "sold_out" ? "Join Waitlist" : "Continue Booking";
  const wideLayout = windowWidth >= 900;
  const posterWidth = wideLayout ? 260 : 155;
  const heroHeight = wideLayout ? 230 : 180;

  return (
    <Screen
      footer={
        <FooterCTA>
          <ActionButton
            label={requestState === "loading" ? "Checking..." : buttonLabel}
            onPress={() => {
              setSelectedSession(session);
              setRequestState("loading");
              socket.emit("request_booking_access", {
                userId: username,
                sessionId: session.sessionId,
              });
            }}
            disabled={requestState === "loading"}
            style={{ width: "100%", backgroundColor: sessionStatus === "sold_out" ? "#7f0000" : "#e50914" }}
          />
        </FooterCTA>
      }
    >
      <TopBar
        title="Select Showtime"
        subtitle={movie.title}
        left={<BackButton onPress={() => router.replace("/")} />}
        right={<NotificationBell count={unreadCount} onPress={() => router.push("/notifications")} />}
      />

      <View
        style={{
          minHeight: heroHeight,
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 14,
          backgroundColor: movie.heroColor,
          position: "relative",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            flex: 1,
            padding: 16,
            justifyContent: "flex-end",
            backgroundColor: "rgba(9,9,11,0.34)",
          }}
        >
          <Text style={{ color: "white", fontSize: wideLayout ? 34 : 24, fontWeight: "900" }}>{movie.title}</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: wideLayout ? 18 : 14 }}>
            {movie.genre} · {movie.duration}
          </Text>
          <Text style={{ color: "#ffb703", marginTop: 6, fontWeight: "800", fontSize: wideLayout ? 16 : 14 }}>
            Rating {movie.rating} · RM {movie.price}
          </Text>
        </View>
        <ImageBackground
          source={movie.poster}
          style={{
            width: posterWidth,
            minHeight: heroHeight,
            backgroundColor: "#0f0f10",
          }}
          imageStyle={{ resizeMode: "cover" }}
        >
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.12)",
            }}
          />
        </ImageBackground>
      </View>

      <Card
        title="Session status"
        subtitle={statusCopy}
        style={{
          backgroundColor:
            sessionStatus === "high_demand"
              ? "rgba(255,183,3,0.08)"
              : sessionStatus === "sold_out"
                ? "rgba(229,9,20,0.08)"
                : "rgba(34,197,94,0.08)",
        }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>
          {sessionStatus === "high_demand" ? "High Demand" : sessionStatus === "sold_out" ? "Sold Out" : "Normal"}
        </Text>
      </Card>

      <Card title="Cinema location" subtitle="Choose the cinema for this booking.">
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {["TGV Queensbay Mall", "TGV Gurney Paragon", "TGV Bukit Mertajam"].map((item) => (
            <ChoiceChip key={item} label={item} selected={selectedCinema === item} onPress={() => setSelectedCinema(item)} />
          ))}
        </View>
      </Card>

      <Card title="Date" subtitle="Select a session date.">
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {["2026-06-15", "2026-06-16", "2026-06-17"].map((item) => (
            <ChoiceChip key={item} label={item} selected={selectedDate === item} onPress={() => setSelectedDate(item)} />
          ))}
        </View>
      </Card>

      <Card title="Showtime" subtitle="Use the example showtimes for the demo.">
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {["6:00 PM", "8:30 PM", "10:15 PM"].map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={selectedShowtime === item}
              onPress={() => setSelectedShowtime(item)}
            />
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <StatCard label="Cinema" value="TGV" helper="Demo location" tone="success" />
        <StatCard label="Time" value={selectedShowtime} helper="Selected session" tone="accent" />
      </View>

      <Card title="Booking summary" subtitle="This will be sent to the queue screen.">
        <View style={{ gap: 8 }}>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{movie.title}</Text>
          <Text style={{ color: "#d4d4d8" }}>Cinema: {selectedCinema}</Text>
          <Text style={{ color: "#d4d4d8" }}>Date: {formatDisplayDate(selectedDate)}</Text>
          <Text style={{ color: "#d4d4d8" }}>Showtime: {selectedShowtime}</Text>
          <Text style={{ color: "#d4d4d8" }}>Price: RM {movie.price}</Text>
        </View>
      </Card>
    </Screen>
  );
}
