import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useDemo } from "../../src/context/DemoContext";
import { movies } from "../../src/data/movies";
import { ActionButton, BackButton, Card, FooterCTA, HeroBand, NotificationBell, Screen, StatCard, TopBar } from "../../src/components/DemoUI";
import { formatQueueStatus, formatSessionStatus } from "../../src/utils/formatters";

export default function QueueScreen() {
  const { movieId } = useLocalSearchParams();
  const { socket, username, selectedSession, sessionStatus, setSessionStatus, pushNotification, unreadCount } = useDemo();
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
  const [queueState, setQueueState] = useState({
    position: null,
    estimatedWaitMinutes: null,
    status: "waiting",
    allowedToBook: false,
    message: "Waiting for the next booking slot.",
  });

  const syncQueueState = useCallback(() => {
    if (!socket || !activeSession?.sessionId) return;

    socket.emit("sync_queue_state", { userId: username, sessionId: activeSession.sessionId }, (result) => {
      if (!result?.ok) {
        return;
      }

      setQueueState((prev) => ({
        ...prev,
        position: result.position ?? null,
        estimatedWaitMinutes: result.estimatedWaitMinutes ?? null,
        status: result.allowedToBook ? "allowed" : result.status || "idle",
        allowedToBook: Boolean(result.allowedToBook),
        message: result.message || (result.joined ? "Waiting for the next booking slot." : prev.message),
      }));
    });
  }, [activeSession?.sessionId, socket, username]);

  useEffect(() => {
    if (!socket || !activeSession) return;

    const onQueueUpdate = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      setQueueState((prev) => ({
        ...prev,
        position: payload.position,
        estimatedWaitMinutes: payload.estimatedWaitMinutes,
        status: payload.status,
        message: "Your queue position was updated in real time.",
      }));
      pushNotification("queue", "Queue position updated", `You are now #${payload.position}.`, {
        route: `/queue/${movie.id}`,
        actionLabel: "Open queue",
        sessionId: activeSession.sessionId,
        movieId: movie.id,
      });
    };

    const onAllowedToBook = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      setQueueState((prev) => ({
        ...prev,
        allowedToBook: true,
        status: "allowed",
        message: "It is your turn to book now.",
      }));
      pushNotification("booking", "It is your turn to book", "You can continue to seat selection now.", {
        route: `/booking/${movie.id}`,
        actionLabel: "Continue booking",
        sessionId: activeSession.sessionId,
        movieId: movie.id,
      });
    };

    const onSessionUpdate = (payload) => {
      if (payload.sessionId !== activeSession.sessionId) return;
      setSessionStatus(payload.sessionStatus || payload.status || "normal");
    };

    const onError = (message) => pushNotification("error", "Queue error", message);

    socket.on("queue_update", onQueueUpdate);
    socket.on("allowed_to_book", onAllowedToBook);
    socket.on("session_update", onSessionUpdate);
    socket.on("error_message", onError);
    syncQueueState();

    return () => {
      socket.off("queue_update", onQueueUpdate);
      socket.off("allowed_to_book", onAllowedToBook);
      socket.off("session_update", onSessionUpdate);
      socket.off("error_message", onError);
    };
  }, [activeSession, pushNotification, setSessionStatus, socket, syncQueueState, username]);

  useEffect(() => {
    if (sessionStatus === "sold_out" && !queueState.allowedToBook) {
      router.replace(`/waitlist/${movieId}`);
    }
  }, [movieId, queueState.allowedToBook, sessionStatus]);

  if (!movie || !activeSession) return null;

  const progress = Math.max(10, 100 - Math.max((queueState.position || 1) - 1, 0) * 25);

  return (
    <Screen
      footer={
        <FooterCTA>
          {queueState.allowedToBook ? (
            <ActionButton
              label="Continue to Seat Selection"
              onPress={() => router.push(`/booking/${movie.id}`)}
              style={{ width: "100%", backgroundColor: "#16a34a" }}
            />
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton
                label="Back to Showtime"
                variant="secondary"
                onPress={() => router.replace(`/showtime/${movie.id}`)}
                style={{ flex: 1 }}
              />
              <ActionButton
                label="Refresh Status"
                onPress={syncQueueState}
                style={{ flex: 1, backgroundColor: "#333" }}
              />
            </View>
          )}
        </FooterCTA>
      }
    >
      <TopBar
        title="High-demand Booking Queue"
        subtitle={movie.title}
        left={<BackButton onPress={() => router.replace(`/showtime/${movie.id}`)} />}
        right={<NotificationBell count={unreadCount} onPress={() => router.push("/notifications")} />}
      />

      <HeroBand
        eyebrow="Queue management"
        title={queueState.allowedToBook ? "It is your turn" : "High-demand queue"}
        subtitle={
          queueState.allowedToBook
            ? "You have been allowed to book. Continue to seat selection."
            : "This movie session is currently receiving many booking requests. To ensure fair access and system stability, users are allowed to enter seat selection in order."
        }
        accent={queueState.allowedToBook ? "#4ade80" : "#e50914"}
      />

      <Card title="Queue status" subtitle={queueState.message}>
        <Text style={{ color: "#d4d4d8", lineHeight: 20 }}>Session status: {formatSessionStatus(sessionStatus)}</Text>
        <Text style={{ color: "#d4d4d8", lineHeight: 20, marginTop: 6 }}>Queue position: {queueState.position ?? "-"}</Text>
        <Text style={{ color: "#d4d4d8", lineHeight: 20, marginTop: 6 }}>
          Estimated waiting time: {queueState.estimatedWaitMinutes != null ? `${queueState.estimatedWaitMinutes} min` : "-"}
        </Text>
        <Text style={{ color: "#d4d4d8", lineHeight: 20, marginTop: 6 }}>Queue status: {formatQueueStatus(queueState.status)}</Text>
      </Card>

      {queueState.allowedToBook ? (
        <Card
          title="Success"
          subtitle="It is your turn to book now."
          style={{ backgroundColor: "rgba(22,163,74,0.12)", borderColor: "rgba(22,163,74,0.35)" }}
        >
          <Text style={{ color: "#4ade80", fontSize: 18, fontWeight: "900" }}>Continue to Seat Selection</Text>
        </Card>
      ) : (
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              width: 160,
              height: 160,
              borderRadius: 999,
              borderWidth: 3,
              borderColor: "#e50914",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#100000",
            }}
          >
            <Text style={{ color: "#666", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Queue No.</Text>
            <Text style={{ color: "#e50914", fontSize: 56, lineHeight: 60, fontWeight: "900" }}>
              {queueState.position ?? "-"}
            </Text>
            <Text style={{ color: "#666", fontSize: 11 }}>live position</Text>
          </View>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <StatCard
          label="Est. Wait"
          value={queueState.estimatedWaitMinutes != null ? `${queueState.estimatedWaitMinutes}m` : "-"}
          helper="Live estimate"
          tone="accent"
        />
        <StatCard label="Ahead" value={queueState.position ? Math.max(queueState.position - 1, 0) : "-"} helper="Users in front" tone="success" />
      </View>

      <Card title="Queue progress" subtitle="Updated live from the server.">
        <View style={{ marginBottom: 8, backgroundColor: "#1a1a1a", borderRadius: 999, height: 8, overflow: "hidden" }}>
          <View style={{ width: `${progress}%`, height: "100%", backgroundColor: "#e50914" }} />
        </View>
        <Text style={{ color: "#d4d4d8" }}>Real-time update: {queueState.message}</Text>
      </Card>
    </Screen>
  );
}
