import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { movies } from "../../src/data/movies";
import { useDemo } from "../../src/context/DemoContext";
import { ActionButton, BackButton, Card, FooterCTA, HeroBand, NotificationBell, Screen, StatCard, TopBar } from "../../src/components/DemoUI";

export default function WaitlistScreen() {
  const { movieId } = useLocalSearchParams();
  const { socket, username, selectedSession, sessionStatus, pushNotification, unreadCount } = useDemo();
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
  const [waitlistState, setWaitlistState] = useState({
    joined: false,
    syncing: true,
    position: null,
    status: "idle",
    ticketReleased: false,
    countdown: null,
    expiresAt: null,
    estimatedWaitMinutes: null,
    notice: "Sold out",
  });
  const [claiming, setClaiming] = useState(false);

  const completeClaimSuccess = useCallback((payload = {}) => {
    if (!movie?.id || !activeSession?.sessionId) return;

    setClaiming(false);
    setWaitlistState((prev) => ({
      ...prev,
      joined: false,
      syncing: false,
      ticketReleased: false,
      countdown: null,
      expiresAt: null,
      notice: payload.message || "Claim successful.",
    }));
    pushNotification("success", "Claim successful", payload.message || "Your ticket was claimed.", {
      route: `/booking/${movie.id}?fromWaitlistClaim=1`,
      actionLabel: "Select seats",
      sessionId: activeSession.sessionId,
      movieId: movie.id,
    });
    router.replace(`/booking/${movie.id}?fromWaitlistClaim=1`);
  }, [activeSession?.sessionId, movie?.id, pushNotification]);

  const syncWaitlistState = (noticeFallback = "Sold out") => {
    if (!socket || !activeSession?.sessionId) return;

    setWaitlistState((prev) => ({ ...prev, syncing: true }));
    socket.emit("sync_waitlist_state", { userId: username, sessionId: activeSession.sessionId }, (result) => {
      if (!result || !result.ok) {
        setWaitlistState((prev) => ({
          ...prev,
          syncing: false,
          notice: result?.message || noticeFallback,
        }));
        return;
      }

      setWaitlistState((prev) => ({
        ...prev,
        joined: result.joined ?? prev.joined,
        syncing: false,
        position: result.position ?? prev.position,
        status: result.status ?? prev.status,
        ticketReleased: result.ticketReleased ?? prev.ticketReleased,
        countdown: result.countdown ?? prev.countdown,
        expiresAt: result.expiresAt ?? prev.expiresAt,
        estimatedWaitMinutes: result.estimatedWaitMinutes ?? prev.estimatedWaitMinutes,
        notice: result.notice || noticeFallback || prev.notice,
      }));
    });
  };

  useEffect(() => {
    if (!socket || !activeSession?.sessionId) return;

    const applySnapshot = (payload, noticeFallback) => {
      setWaitlistState((prev) => ({
        ...prev,
        joined: payload.joined ?? prev.joined,
        syncing: false,
        position: payload.position ?? prev.position,
        status: payload.status ?? prev.status,
        ticketReleased: payload.ticketReleased ?? prev.ticketReleased,
        countdown: payload.countdown ?? prev.countdown,
        expiresAt: payload.expiresAt ?? prev.expiresAt,
        estimatedWaitMinutes: payload.estimatedWaitMinutes ?? prev.estimatedWaitMinutes,
        notice: payload.notice || noticeFallback || prev.notice,
      }));
    };

    const onWaitlistUpdate = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      applySnapshot(
        {
          joined: true,
          position: payload.position,
          status: payload.status,
          estimatedWaitMinutes: payload.estimatedWaitMinutes ?? (payload.position ? Math.max(1, payload.position * 2) : null),
          notice: `Your waitlist position is now #${payload.position}.`,
        },
        `Your waitlist position is now #${payload.position}.`
      );
    };

    const onTicketReleased = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      applySnapshot(
        {
          joined: true,
          ticketReleased: true,
          countdown: payload.claimWindowSeconds ?? 10,
          expiresAt: payload.expiresAt ?? null,
          notice: payload.message || "A ticket has been released for you.",
        },
        "A ticket has been released for you."
      );
      pushNotification("ticket", "Ticket released", "Claim it before the countdown ends.", {
        route: `/waitlist/${movie.id}`,
        actionLabel: "Claim ticket",
        sessionId: activeSession.sessionId,
        movieId: movie.id,
      });
    };

    const onClaimSuccess = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      completeClaimSuccess(payload);
    };

    const onClaimExpired = (payload) => {
      if (payload.sessionId !== activeSession.sessionId || payload.userId !== username) return;
      setWaitlistState((prev) => ({
        ...prev,
        joined: false,
        syncing: false,
        ticketReleased: false,
        countdown: null,
        expiresAt: null,
        notice: payload.message || "Claim window expired.",
      }));
      setClaiming(false);
      pushNotification("error", "Claim expired", payload.message || "The countdown ended.", {
        route: `/waitlist/${movie.id}`,
        actionLabel: "Reopen waitlist",
        sessionId: activeSession.sessionId,
        movieId: movie.id,
      });
    };

    const onError = (message) => pushNotification("error", "Waitlist error", message);

    socket.on("waitlist_update", onWaitlistUpdate);
    socket.on("ticket_released", onTicketReleased);
    socket.on("claim_success", onClaimSuccess);
    socket.on("claim_expired", onClaimExpired);
    socket.on("error_message", onError);

    syncWaitlistState("Sold out");

    return () => {
      socket.off("waitlist_update", onWaitlistUpdate);
      socket.off("ticket_released", onTicketReleased);
      socket.off("claim_success", onClaimSuccess);
      socket.off("claim_expired", onClaimExpired);
      socket.off("error_message", onError);
    };
  }, [activeSession, completeClaimSuccess, pushNotification, socket, username]);

  useEffect(() => {
    if (!waitlistState.expiresAt) return;
    const timer = setInterval(() => {
      setWaitlistState((prev) => {
        if (!prev.expiresAt) {
          clearInterval(timer);
          return prev;
        }

        const remainingSeconds = Math.max(0, Math.ceil((new Date(prev.expiresAt).getTime() - Date.now()) / 1000));
        if (remainingSeconds === 0) {
          clearInterval(timer);
          return { ...prev, countdown: 0, ticketReleased: false, expiresAt: null };
        }

        return { ...prev, countdown: remainingSeconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [waitlistState.expiresAt]);

  if (!movie || !activeSession) return null;

  const joinWaitlist = () => {
    socket.emit(
      "join_waitlist",
      { userId: username, sessionId: activeSession.sessionId },
      (result) => {
        if (!result.ok) {
          if (String(result.message || "").toLowerCase().includes("already in the waitlist")) {
            syncWaitlistState("You are already in the waitlist.");
            return;
          }

          pushNotification("error", "Waitlist error", result.message);
          return;
        }

        setWaitlistState((prev) => ({
          ...prev,
          joined: true,
          syncing: false,
          position: result.position ?? prev.position,
          estimatedWaitMinutes: result.estimatedWaitMinutes ?? prev.estimatedWaitMinutes,
          notice: `You are now #${result.position ?? prev.position}.`,
        }));
        pushNotification("waitlist", "Waitlist joined", `You are now #${result.position ?? "?"}.`, {
          route: `/waitlist/${movie.id}`,
          actionLabel: "Open waitlist",
          sessionId: activeSession.sessionId,
          movieId: movie.id,
        });
      }
    );
  };

  const claimTicket = () => {
    if (claiming || !socket || !activeSession?.sessionId) return;
    setClaiming(true);
    socket.emit(
      "claim_ticket",
      { userId: username, sessionId: activeSession.sessionId },
      (result) => {
        if (!result?.ok) {
          setClaiming(false);
          pushNotification("error", "Claim error", result?.message || "Unable to claim ticket.");
          return;
        }

        completeClaimSuccess({
          sessionId: activeSession.sessionId,
          userId: username,
          message: result.message || "Ticket claim successful.",
        });
      }
    );
  };

  const declineTicket = () => {
    setWaitlistState((prev) => ({
      ...prev,
      joined: true,
      ticketReleased: false,
      countdown: null,
      expiresAt: null,
      notice: "Ticket declined.",
    }));
    pushNotification("waitlist", "Ticket declined", "You stayed in the waitlist.", {
      route: `/waitlist/${movie.id}`,
      actionLabel: "Stay in waitlist",
      sessionId: activeSession.sessionId,
      movieId: movie.id,
    });
  };

  return (
    <Screen
      footer={
        <FooterCTA>
          {waitlistState.syncing ? (
            <ActionButton label="Checking status..." disabled onPress={() => {}} style={{ width: "100%", backgroundColor: "#333" }} />
          ) : waitlistState.ticketReleased ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton
                label={claiming ? "Claiming..." : "Claim Ticket"}
                disabled={claiming}
                onPress={claimTicket}
                style={{ flex: 1, backgroundColor: "#ffb703" }}
              />
              <ActionButton label="Decline" variant="secondary" onPress={declineTicket} style={{ flex: 1 }} />
            </View>
          ) : waitlistState.joined ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton
                label="Already in Waitlist"
                disabled
                onPress={() => {}}
                style={{ flex: 1, backgroundColor: "#333" }}
              />
              <ActionButton
                label="Refresh Status"
                variant="secondary"
                disabled={waitlistState.syncing}
                onPress={() => syncWaitlistState("Refreshing waitlist status...")}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <ActionButton label="Join Waitlist" onPress={joinWaitlist} style={{ width: "100%" }} />
          )}
        </FooterCTA>
      }
    >
      <TopBar title="Waitlist" subtitle={movie.title} left={<BackButton />} right={<NotificationBell count={unreadCount} onPress={() => router.push("/notifications")} />} />

      <HeroBand
        eyebrow="Sold out"
        title="This session is sold out"
        subtitle="Waitlist is used only when the session has no seats left. Join to receive a real-time ticket release notification."
        accent="#e50914"
      />

      <Card title="Session snapshot" subtitle={waitlistState.syncing ? "Syncing your waitlist status..." : waitlistState.notice}>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#a1a1aa", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Status</Text>
            <Text style={{ color: "#ff6b6b", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>
              Sold out
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#a1a1aa", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Position</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{waitlistState.position ?? (waitlistState.syncing ? "..." : "-")}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#a1a1aa", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Countdown</Text>
            <Text style={{ color: waitlistState.ticketReleased ? "#ffb703" : "#8b8b95", fontSize: 18, fontWeight: "900" }}>
              {waitlistState.ticketReleased
                ? `${waitlistState.countdown ?? 0}s`
                : waitlistState.estimatedWaitMinutes != null
                  ? `~${waitlistState.estimatedWaitMinutes}m`
                  : waitlistState.syncing
                    ? "Syncing"
                    : "Waiting"}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <StatCard label="Position" value={waitlistState.position ?? "-"} helper="Live waitlist rank" tone="accent" />
        <StatCard
          label="Timer"
          value={
            waitlistState.ticketReleased
              ? `${waitlistState.countdown ?? 0}s`
              : waitlistState.estimatedWaitMinutes != null
                ? `~${waitlistState.estimatedWaitMinutes}m`
                : waitlistState.syncing
                  ? "..."
                  : "-"
          }
          helper={waitlistState.ticketReleased ? "Claim window" : waitlistState.joined ? "Estimated wait" : "Not joined yet"}
          tone="success"
        />
      </View>

      {waitlistState.ticketReleased ? (
        <Card
          title="Ticket released"
          subtitle="A ticket is available now. Claim it before the countdown ends."
          style={{ borderColor: "rgba(255,183,3,0.35)", backgroundColor: "rgba(255,183,3,0.08)" }}
        >
          <Text style={{ color: "#ffb703", fontWeight: "900", fontSize: 18, marginBottom: 8 }}>
            {waitlistState.countdown ?? 0}s remaining
          </Text>
          <Text style={{ color: "#d4d4d8", lineHeight: 20 }}>
            Tap Claim Ticket to confirm your seat. If you decline, the ticket stays in the waitlist flow.
          </Text>
        </Card>
      ) : (
        <Card title="How it works" subtitle="The waitlist only applies when the session is sold out.">
          <Text style={{ color: "#d4d4d8", lineHeight: 20 }}>1. Join the waitlist.</Text>
          <Text style={{ color: "#d4d4d8", lineHeight: 20, marginTop: 6 }}>2. Receive a real-time ticket release notification.</Text>
          <Text style={{ color: "#d4d4d8", lineHeight: 20, marginTop: 6 }}>3. Claim the ticket before the countdown ends.</Text>
        </Card>
      )}
    </Screen>
  );
}
