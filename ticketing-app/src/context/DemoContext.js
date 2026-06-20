import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const DemoContext = createContext(null);

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://127.0.0.1:3001";
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || SOCKET_URL;
const NOTIFICATION_DEDUPE_MS = 30000;

function getPayloadStatus(payload) {
  return payload?.sessionStatus || payload?.status || "normal";
}

function pickPrimarySession(sessions, preferredSessionId = null) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  return (
    sessions.find((session) => preferredSessionId && session.id === preferredSessionId) ||
    sessions.find((session) => getPayloadStatus(session) !== "normal") ||
    sessions[0]
  );
}

function buildNotificationKey(userId, kind, title, message, meta = {}) {
  return [
    userId,
    kind,
    title,
    message,
    meta.route || "",
    meta.sessionId || "",
    meta.movieId || "",
    meta.actionLabel || "",
  ].join("|");
}

function normalizeNotifications(items) {
  const merged = new Map();

  items.forEach((item) => {
    // Collapse repeated events from socket replays / optimistic updates into one visible card.
    const key = buildNotificationKey(item.userId || "", item.kind, item.title, item.message, item);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      return;
    }

    merged.set(key, {
      ...existing,
      read: existing.read && item.read,
    });
  });

  return Array.from(merged.values()).slice(0, 50);
}

function ticketToSession(ticket) {
  if (!ticket) return null;
  return {
    ticketId: ticket.id || null,
    sessionId: ticket.sessionId,
    movieId: ticket.movieId,
    movieTitle: ticket.movieTitle,
    cinema: ticket.cinema,
    date: ticket.date,
    showtime: ticket.showtime,
    seat: ticket.seat,
    price: ticket.price,
  };
}

export function DemoProvider({ children }) {
  const [username, setUsername] = useState("User A");
  const [selectedSession, setSelectedSession] = useState(null);
  const [fallbackSessionStatus, setFallbackSessionStatus] = useState("normal");
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionStatuses, setSessionStatuses] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const notificationKeysRef = useRef(new Map());

  const socket = useMemo(() => io(SOCKET_URL, { transports: ["websocket"] }), []);

  useEffect(() => {
    if (socket && username) {
      socket.emit("register_user", { userId: username });
    }
  }, [socket, username]);

  const setSessionStatus = useCallback((nextStatus, sessionId = selectedSession?.sessionId || activeSessionId) => {
    const normalizedStatus = nextStatus || "normal";
    setFallbackSessionStatus(normalizedStatus);

    if (!sessionId) return;

    setActiveSessionId(sessionId);
    setSessionStatuses((prev) => ({
      ...prev,
      [sessionId]: normalizedStatus,
    }));
  }, [activeSessionId, selectedSession?.sessionId]);

  useEffect(() => {
    if (!socket) return;

    const applyAdminSnapshot = (payload) => {
      const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
      if (!sessions.length) return;

      setSessionStatuses((prev) => {
        const next = { ...prev };
        sessions.forEach((session) => {
          if (session.id) {
            next[session.id] = getPayloadStatus(session);
          }
        });
        return next;
      });

      const primarySession = selectedSession?.sessionId
        ? pickPrimarySession(sessions, selectedSession.sessionId)
        : sessions.find((session) => getPayloadStatus(session) !== "normal") ||
          sessions.find((session) => activeSessionId && session.id === activeSessionId) ||
          sessions[0];
      if (primarySession?.id) {
        setActiveSessionId(primarySession.id);
        setFallbackSessionStatus(getPayloadStatus(primarySession));
      }
    };

    const onSessionUpdate = (payload) => {
      if (!payload?.sessionId) return;
      const nextStatus = getPayloadStatus(payload);
      setSessionStatuses((prev) => ({
        ...prev,
        [payload.sessionId]: nextStatus,
      }));

      const shouldFocusSession = selectedSession?.sessionId
        ? payload.sessionId === selectedSession.sessionId
        : !activeSessionId || activeSessionId === payload.sessionId || nextStatus !== "normal";

      if (shouldFocusSession) {
        setActiveSessionId(payload.sessionId);
        setFallbackSessionStatus(nextStatus);
      }
    };

    socket.emit("admin_request_state");
    socket.on("admin_state_update", applyAdminSnapshot);
    socket.on("session_update", onSessionUpdate);

    fetch(`${API_BASE_URL}/api/admin/state`)
      .then((response) => response.json())
      .then(applyAdminSnapshot)
      .catch(() => {});

    return () => {
      socket.off("admin_state_update", applyAdminSnapshot);
      socket.off("session_update", onSessionUpdate);
    };
  }, [activeSessionId, selectedSession?.sessionId, socket]);

  useEffect(() => {
    let cancelled = false;

    async function loadUserState() {
      setNotifications([]);
      setSelectedSession(null);
      setNotificationsLoaded(false);
      try {
        const [notificationsResponse, ticketsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/notifications?userId=${encodeURIComponent(username)}`),
          fetch(`${API_BASE_URL}/api/tickets?userId=${encodeURIComponent(username)}`),
        ]);
        const notificationsData = await notificationsResponse.json();
        const ticketsData = await ticketsResponse.json();

        if (!cancelled && notificationsData.ok) {
          setNotifications(normalizeNotifications(Array.isArray(notificationsData.notifications) ? notificationsData.notifications : []));
        }
        if (!cancelled && ticketsData.ok) {
          const tickets = Array.isArray(ticketsData.tickets) ? ticketsData.tickets : [];
          setSelectedSession(ticketToSession(tickets[0]));
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setSelectedSession(null);
        }
      } finally {
        if (!cancelled) {
          setNotificationsLoaded(true);
        }
      }
    }

    if (username) {
      loadUserState();
    }

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  const pushNotification = useCallback((kind, title, message, meta = {}) => {
    const key = buildNotificationKey(username, kind, title, message, meta);
    const now = Date.now();
    const lastCreatedAt = notificationKeysRef.current.get(key);
    // Guard against the same event being emitted multiple times during a short live update burst.
    if (lastCreatedAt && now - lastCreatedAt < NOTIFICATION_DEDUPE_MS) {
      return null;
    }
    notificationKeysRef.current.set(key, now);

    const optimisticId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticNotification = {
      id: optimisticId,
      kind,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      userId: username,
      route: meta.route || null,
      actionLabel: meta.actionLabel || null,
      sessionId: meta.sessionId || null,
      movieId: meta.movieId || null,
      tone: meta.tone || null,
    };

    setNotifications((prev) => normalizeNotifications([optimisticNotification, ...prev]));

    fetch(`${API_BASE_URL}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: username,
        kind,
        title,
        message,
        route: meta.route || null,
        actionLabel: meta.actionLabel || null,
        sessionId: meta.sessionId || null,
        movieId: meta.movieId || null,
        read: false,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok || !data.notification) return;
        // Replace the optimistic row with the persisted record so later read/delete actions use the server id.
        setNotifications((prev) => normalizeNotifications([data.notification, ...prev.filter((item) => item.id !== optimisticId)]));
      })
      .catch(() => {
        // Keep optimistic entry if persistence fails.
      });

    return optimisticId;
  }, [username]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    fetch(`${API_BASE_URL}/api/notifications/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: username }),
    }).catch(() => {});
  }, [username]);

  const markNotificationRead = useCallback((notificationId) => {
    setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
    fetch(`${API_BASE_URL}/api/notifications/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: username, notificationId }),
    }).catch(() => {});
  }, [username]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    fetch(`${API_BASE_URL}/api/notifications`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: username }),
    }).catch(() => {});
  }, [username]);

  const removeNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(notificationId)}?userId=${encodeURIComponent(username)}`, {
      method: "DELETE",
    }).catch(() => {});
  }, [username]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0),
    [notifications]
  );

  const sessionStatus = useMemo(() => {
    const currentSessionId = selectedSession?.sessionId || activeSessionId;
    if (currentSessionId && sessionStatuses[currentSessionId]) {
      return sessionStatuses[currentSessionId];
    }
    return fallbackSessionStatus;
  }, [activeSessionId, fallbackSessionStatus, selectedSession?.sessionId, sessionStatuses]);

  const value = useMemo(
    () => ({
      socket,
      username,
      setUsername,
      selectedSession,
      setSelectedSession,
      sessionStatus,
      setSessionStatus,
      notifications,
      unreadCount,
      notificationsLoaded,
      pushNotification,
      markAllNotificationsRead,
      markNotificationRead,
      clearNotifications,
      removeNotification,
    }),
    [
      socket,
      username,
      selectedSession,
      sessionStatus,
      setSessionStatus,
      notifications,
      unreadCount,
      notificationsLoaded,
      pushNotification,
      markAllNotificationsRead,
      markNotificationRead,
      clearNotifications,
      removeNotification,
    ]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within DemoProvider");
  }
  return context;
}
