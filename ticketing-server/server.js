const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;

    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnvFile(path.resolve(__dirname, ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const CLAIM_WINDOW_MS = 10_000;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_REST_URL = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : "";
const SUPABASE_HEADERS = SUPABASE_URL
  ? {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
    }
  : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Supabase env vars are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/admin/state", (_req, res) => {
  res.json(buildAdminSnapshot());
});

app.get("/api/tickets", async (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    const tickets = await supabaseListActiveTicketsByUser(userId);
    res.json({ ok: true, tickets });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to load tickets." });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    const rows = await supabaseSelect(
      `/notifications?select=id,user_id,kind,title,message,route,action_label,movie_id,session_id,read,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50`
    );

    res.json({
      ok: true,
      notifications: rows.map(mapNotificationRow),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to load notifications." });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const payload = req.body || {};
    const userId = String(payload.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    await supabaseUpsertUser(userId);

    const notification = {
      user_id: userId,
      kind: payload.kind || "info",
      title: payload.title || "Notification",
      message: payload.message || "",
      route: payload.route || null,
      action_label: payload.actionLabel || null,
      movie_id: payload.movieId || null,
      session_id: payload.sessionId || null,
      read: Boolean(payload.read),
    };

    const rows = await supabaseUpsertNotification(notification);
    res.json({ ok: true, notification: mapNotificationRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to create notification." });
  }
});

app.patch("/api/notifications/read", async (req, res) => {
  try {
    const payload = req.body || {};
    const userId = String(payload.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    if (payload.notificationId) {
      await supabaseUpdateNotificationsById(userId, [payload.notificationId], { read: true });
    } else {
      await supabaseUpdateNotificationsByUser(userId, { read: true });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to mark notifications read." });
  }
});

app.delete("/api/notifications", async (req, res) => {
  try {
    const payload = req.body || {};
    const userId = String(payload.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    await supabaseDeleteNotificationsByUser(userId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to clear notifications." });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const userId = String(req.query.userId || req.body?.userId || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, message: "Notification id is required." });
    }
    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId is required." });
    }

    await supabaseDeleteNotificationsById(userId, [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "Unable to delete notification." });
  }
});

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Ticketing backend only. Open the Expo app in ticketing-app for the frontend.",
  });
});

const sessionConfigs = [
  {
    id: "inception-630",
    movieTitle: "Inception",
    cinema: "Grand Central",
    showtime: "6:30 PM",
    date: "2026-06-15",
    price: 18,
  },
  {
    id: "interstellar-830",
    movieTitle: "Interstellar",
    cinema: "Westfield",
    showtime: "8:30 PM",
    date: "2026-06-15",
    price: 18,
  },
  {
    id: "dark-knight-700",
    movieTitle: "The Dark Knight",
    cinema: "Southgate",
    showtime: "7:00 PM",
    date: "2026-06-15",
    price: 18,
  },
  {
    id: "endgame-930",
    movieTitle: "Avengers: Endgame",
    cinema: "Grand Central",
    showtime: "9:30 PM",
    date: "2026-06-15",
    price: 18,
  },
  {
    id: "dune-730",
    movieTitle: "Dune: Part Two",
    cinema: "Westfield",
    showtime: "7:30 PM",
    date: "2026-06-15",
    price: 18,
  },
  {
    id: "oppenheimer-1010",
    movieTitle: "Oppenheimer",
    cinema: "Southgate",
    showtime: "10:10 PM",
    date: "2026-06-15",
    price: 18,
  },
];

function createSession(config) {
  return {
    ...config,
    sessionStatus: "normal",
    status: "normal",
    availableSeats: 8,
    availableTickets: 8,
    bookedSeats: ["B3"],
    heldSeats: {},
    queue: [],
    waitlist: [],
    eventLog: [],
    currentlyNotifiedUser: null,
    notifiedUserId: null,
    claimTimer: null,
    claimDeadline: null,
    claimedUsers: [],
  };
}

function sanitizeSession(session) {
  return {
    id: session.id,
    movieTitle: session.movieTitle,
    cinema: session.cinema,
    showtime: session.showtime,
    date: session.date,
    price: session.price,
    sessionStatus: session.sessionStatus,
    status: session.status,
    availableSeats: session.availableSeats,
    availableTickets: session.availableTickets,
    bookedSeats: session.bookedSeats,
    heldSeats: session.heldSeats,
    queue: session.queue,
    waitlist: session.waitlist,
    eventLog: session.eventLog,
    currentlyNotifiedUser: session.currentlyNotifiedUser,
    notifiedUserId: session.notifiedUserId,
    claimDeadline: session.claimDeadline,
    claimedUsers: session.claimedUsers,
  };
}

function normalizeSession(session, config) {
  session.id = config.id;
  session.movieTitle = config.movieTitle;
  session.cinema = config.cinema;
  session.showtime = config.showtime;
  session.date = config.date;
  session.price = config.price;
  session.sessionStatus = session.sessionStatus || session.status || "normal";
  session.status = session.status || session.sessionStatus || "normal";
  session.availableSeats = Number.isFinite(session.availableSeats) ? session.availableSeats : 8;
  session.availableTickets = Number.isFinite(session.availableTickets) ? session.availableTickets : session.availableSeats;
  session.bookedSeats = Array.isArray(session.bookedSeats) ? session.bookedSeats : ["B3"];
  session.heldSeats = session.heldSeats && typeof session.heldSeats === "object" ? session.heldSeats : {};
  session.queue = Array.isArray(session.queue) ? session.queue : [];
  session.waitlist = Array.isArray(session.waitlist) ? session.waitlist : [];
  session.eventLog = Array.isArray(session.eventLog) ? session.eventLog : [];
  session.currentlyNotifiedUser = session.currentlyNotifiedUser || null;
  session.notifiedUserId = session.notifiedUserId || session.currentlyNotifiedUser || null;
  session.claimDeadline = session.claimDeadline || null;
  session.claimedUsers = Array.isArray(session.claimedUsers) ? session.claimedUsers : [];
  session.claimTimer = null;
  return session;
}

async function supabaseRequest(pathname, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${SUPABASE_REST_URL}${pathname}`, {
    ...options,
    headers: {
      ...SUPABASE_HEADERS,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${body || response.statusText}`);
  }

  return response;
}

function getBookingErrorMessage(error) {
  const message = error?.message || "";
  if (message.includes("23505") || message.includes("tickets_active_user_session_idx")) {
    return "You already have a ticket for this session.";
  }
  return message || "Unable to confirm booking.";
}

async function supabaseSelect(pathname) {
  const response = await supabaseRequest(pathname, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  return response.json();
}

async function supabaseUpsertUser(userId, role = "customer") {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  await supabaseRequest("/users?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: normalizedUserId,
      display_name: normalizedUserId,
      role,
      updated_at: new Date().toISOString(),
    }),
  });

  return normalizedUserId;
}

async function supabaseUpsertNotification(notification) {
  const response = await supabaseRequest("/notifications?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(notification),
  });
  return response.json();
}

async function supabaseUpdateNotificationsByUser(userId, changes) {
  await supabaseRequest(`/notifications?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(changes),
  });
}

async function supabaseUpdateNotificationsById(userId, ids, changes) {
  if (!ids.length) return;
  await supabaseRequest(
    `/notifications?id=eq.${encodeURIComponent(String(ids[0]))}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify(changes),
    }
  );
}

async function supabaseDeleteNotificationsByUser(userId) {
  await supabaseRequest(`/notifications?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function supabaseDeleteNotificationsById(userId, ids) {
  if (!ids.length) return;
  await supabaseRequest(
    `/notifications?id=eq.${encodeURIComponent(String(ids[0]))}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
}

function mapNotificationRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    message: row.message,
    route: row.route || null,
    actionLabel: row.action_label || null,
    movieId: row.movie_id || null,
    sessionId: row.session_id || null,
    read: Boolean(row.read),
    timestamp: row.created_at,
  };
}

function mapTicketRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: row.user_id,
    sessionId: row.session_id,
    movieId: row.movie_id,
    movieTitle: row.movie_title,
    cinema: row.cinema,
    showtime: row.showtime,
    date: row.session_date,
    seat: row.seat,
    price: Number(row.price),
    status: row.status,
    refundedAt: row.refunded_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function supabaseCreateTicket(ticket) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await supabaseRequest("/tickets", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(ticket),
  });
  const rows = await response.json();
  return mapTicketRow(rows[0]);
}

async function supabaseGetActiveTicket(userId, sessionId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await supabaseRequest(
    `/tickets?user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}&status=eq.confirmed&limit=1`
  );
  const rows = await response.json();
  return rows[0] ? mapTicketRow(rows[0]) : null;
}

async function supabaseListActiveTicketsByUser(userId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const response = await supabaseRequest(
    `/tickets?user_id=eq.${encodeURIComponent(userId)}&status=eq.confirmed&order=created_at.desc`
  );
  const rows = await response.json();
  return rows.map(mapTicketRow).filter(Boolean);
}

async function supabaseListActiveTicketSeats(sessionId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const response = await supabaseRequest(
    `/tickets?select=seat&session_id=eq.${encodeURIComponent(sessionId)}&status=eq.confirmed`
  );
  const rows = await response.json();
  return rows.map((row) => row.seat).filter(Boolean);
}

async function supabaseRefundActiveTicket(userId, sessionId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await supabaseRequest(
    `/tickets?user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}&status=eq.confirmed`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );
  const rows = await response.json();
  return rows[0] ? mapTicketRow(rows[0]) : null;
}

async function supabaseResetSessionTickets(sessionId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  await supabaseRequest(
    `/tickets?session_id=eq.${encodeURIComponent(sessionId)}&status=eq.confirmed`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function loadSession(config) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return normalizeSession(createSession(config), config);
  }

  const response = await supabaseRequest(
    `/session_states?select=state_json&id=eq.${encodeURIComponent(config.id)}&limit=1`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );
  const rows = await response.json();
  const stored = rows[0]?.state_json;

  if (!stored) {
    const session = normalizeSession(createSession(config), config);
    const ticketSeats = await supabaseListActiveTicketSeats(config.id);
    session.bookedSeats = Array.from(new Set([...session.bookedSeats, ...ticketSeats]));
    await persistSession(session);
    return session;
  }

  const sessionData = typeof stored === "string" ? JSON.parse(stored) : stored;
  const session = normalizeSession({ ...createSession(config), ...sessionData }, config);
  const ticketSeats = await supabaseListActiveTicketSeats(config.id);
  session.bookedSeats = Array.from(new Set([...session.bookedSeats, ...ticketSeats]));
  return session;
}

async function persistSession(session) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  await supabaseRequest(`/session_states?on_conflict=id`, {
    method: "POST",
    headers: {
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: session.id,
      state_json: sanitizeSession(session),
      updated_at: new Date().toISOString(),
    }),
  });
}

let sessions = {};

async function bootstrapSessions() {
  const loadedSessions = await Promise.all(sessionConfigs.map(async (config) => [config.id, await loadSession(config)]));
  sessions = Object.fromEntries(loadedSessions);
  restoreClaimTimers();
}

function restoreClaimTimers() {
  Object.values(sessions).forEach((session) => {
    if (!session.currentlyNotifiedUser || !session.claimDeadline) return;

    const userId = session.currentlyNotifiedUser;

    const remainingMs = session.claimDeadline - Date.now();
    if (remainingMs <= 0) {
      expireClaimWindow(userId, session.id);
      return;
    }

    session.claimTimer = setTimeout(() => {
      expireClaimWindow(userId, session.id);
    }, remainingMs);
  });
}

// Keeps the demo session in one of the three booking modes required by the prototype.
function setSessionStatus(session, status) {
  session.sessionStatus = status;
  session.status = status;
}

// Mirrors the current ticket inventory into both legacy and updated field names.
function setAvailableSeats(session, seats) {
  session.availableSeats = seats;
  session.availableTickets = seats;
}

function buildSeatSnapshot(session) {
  return {
    ok: true,
    sessionId: session.id,
    bookedSeats: session.bookedSeats,
    heldSeats: session.heldSeats,
    availableSeats: session.availableSeats,
    availableTickets: session.availableTickets,
    sessionStatus: session.sessionStatus,
    status: session.sessionStatus,
  };
}

function holdSeat(userId, sessionId, seat) {
  const session = getSession(sessionId);
  const requestedSeat = String(seat || "").trim();

  if (!userId) {
    return { ok: false, message: "userId is required." };
  }

  if (!requestedSeat) {
    return { ok: false, message: "Seat is required." };
  }

  if (session.bookedSeats.includes(requestedSeat)) {
    return { ok: false, message: "This seat has already been booked." };
  }

  const heldBy = session.heldSeats[requestedSeat];
  if (heldBy && heldBy !== userId) {
    return { ok: false, message: "This seat is currently selected by another user." };
  }

  Object.entries(session.heldSeats).forEach(([heldSeat, heldUserId]) => {
    if (heldUserId === userId && heldSeat !== requestedSeat) {
      delete session.heldSeats[heldSeat];
    }
  });
  session.heldSeats[requestedSeat] = userId;
  emitSessionUpdate(sessionId);
  return { ...buildSeatSnapshot(session), heldSeat: requestedSeat };
}

function releaseSeatHold(userId, sessionId, seat = null) {
  const session = getSession(sessionId);

  Object.entries(session.heldSeats).forEach(([heldSeat, heldUserId]) => {
    const shouldRelease = heldUserId === userId && (!seat || heldSeat === seat);
    if (shouldRelease) {
      delete session.heldSeats[heldSeat];
    }
  });

  emitSessionUpdate(sessionId);
  return buildSeatSnapshot(session);
}

function releaseAllSeatHoldsForUser(userId) {
  if (!userId) return;

  Object.values(sessions).forEach((session) => {
    let changed = false;
    Object.entries(session.heldSeats).forEach(([heldSeat, heldUserId]) => {
      if (heldUserId === userId) {
        delete session.heldSeats[heldSeat];
        changed = true;
      }
    });

    if (changed) {
      emitSessionUpdate(session.id);
    }
  });
}

function createEvent(message) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    timestamp: new Date().toISOString(),
  };
}

function logEvent(sessionId, message) {
  const session = sessions[sessionId];
  if (!session) return;
  session.eventLog.unshift(createEvent(message));
  session.eventLog = session.eventLog.slice(0, 12);
  void persistSession(session).catch((error) => console.error("Failed to persist session event:", error.message));
  emitAdminState();
}

function getSession(sessionId) {
  const session = sessions[sessionId];
  if (!session) {
    throw new Error(`Unknown session: ${sessionId}`);
  }
  return session;
}

function getUserPayload(session, userId, position) {
  return {
    sessionId: session.id,
    userId,
    position,
    queueLength: session.queue.length,
    estimatedWaitMinutes: Math.max(1, position * 2),
    status: session.sessionStatus,
    sessionStatus: session.sessionStatus,
    availableTickets: session.availableSeats,
    availableSeats: session.availableSeats,
    bookedSeats: session.bookedSeats,
    heldSeats: session.heldSeats,
    cinema: session.cinema,
    movieTitle: session.movieTitle,
    showtime: session.showtime,
    date: session.date,
  };
}

function estimateWaitMinutes(session, position, userId) {
  if (session.currentlyNotifiedUser === userId) {
    return 0;
  }

  if (!session.currentlyNotifiedUser || !session.claimDeadline) {
    return Math.max(1, position * 3);
  }

  const claimWindowRemainingSeconds = Math.max(0, Math.ceil((session.claimDeadline - Date.now()) / 1000));
  const usersAheadOfYou = Math.max(0, position - 2);
  const perUserSeconds = 3 * 60;
  const totalSeconds = claimWindowRemainingSeconds + usersAheadOfYou * perUserSeconds;

  return Math.max(1, Math.ceil(totalSeconds / 60));
}

// Sends a targeted Socket.IO event to every connected client session for one user.
function emitToUser(userId, eventName, payload) {
  io.to(`user:${userId}`).emit(eventName, payload);
}

// Optional helper for banner/toast style updates when a client wants a lightweight push message.
function emitToastMessage(userId, payload) {
  emitToUser(userId, "toast_message", payload);
}

// Broadcasts a compact session summary so both the mobile app and admin page stay in sync.
function emitSessionUpdate(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  void persistSession(session).catch((error) => console.error("Failed to persist session state:", error.message));
  io.emit("session_update", {
    sessionId,
    status: session.sessionStatus,
    sessionStatus: session.sessionStatus,
    availableTickets: session.availableSeats,
    availableSeats: session.availableSeats,
    bookedSeats: session.bookedSeats,
    heldSeats: session.heldSeats,
    queueLength: session.queue.length,
    waitlistLength: session.waitlist.length,
    currentlyNotifiedUser: session.currentlyNotifiedUser,
  });
  emitAdminState();
}

// Pushes the current server snapshot to the admin dashboard.
function emitAdminState() {
  io.emit("admin_state_update", buildAdminSnapshot());
}

function buildAdminSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    sessions: Object.values(sessions).map((session) => ({
      id: session.id,
      movieTitle: session.movieTitle,
      cinema: session.cinema,
      showtime: session.showtime,
      date: session.date,
      status: session.sessionStatus,
      sessionStatus: session.sessionStatus,
      availableTickets: session.availableSeats,
      availableSeats: session.availableSeats,
      bookedSeats: session.bookedSeats,
      heldSeats: session.heldSeats,
      queue: session.queue.map((entry, index) => ({
        userId: entry.userId,
        position: index + 1,
        status: entry.status,
      })),
      waitlist: session.waitlist.map((entry, index) => ({
        userId: entry.userId,
        position: index + 1,
        status: entry.status,
      })),
      latestEvents: session.eventLog,
      notifiedUserId: session.currentlyNotifiedUser,
      currentlyNotifiedUser: session.currentlyNotifiedUser,
      claimTimerActive: Boolean(session.claimTimer),
    })),
  };
}

function findQueueEntry(session, userId) {
  return session.queue.find((entry) => entry.userId === userId);
}

function findWaitlistEntry(session, userId) {
  return session.waitlist.find((entry) => entry.userId === userId);
}

function buildQueueSnapshot(session, userId) {
  const entry = findQueueEntry(session, userId);

  if (!entry) {
    return {
      ok: true,
      joined: false,
      position: null,
      queueLength: session.queue.length,
      estimatedWaitMinutes: null,
      status: "idle",
      allowedToBook: false,
      sessionStatus: session.sessionStatus,
      availableSeats: session.availableSeats,
      bookedSeats: session.bookedSeats,
      heldSeats: session.heldSeats,
      message: session.sessionStatus === "high_demand" ? "Not currently in queue." : "Queue is not active.",
    };
  }

  return {
    ok: true,
    joined: true,
    ...getUserPayload(session, userId, entry.position || session.queue.findIndex((item) => item.userId === userId) + 1),
    allowedToBook: false,
    message: entry.status === "next" ? "You are next in line." : "Waiting for the next booking slot.",
  };
}

function buildWaitlistSnapshot(session, userId) {
  const entry = findWaitlistEntry(session, userId);

  if (!entry) {
    return {
      ok: true,
      joined: false,
      ticketReleased: false,
      countdown: null,
      expiresAt: null,
      position: null,
      status: "idle",
      estimatedWaitMinutes: null,
      sessionStatus: session.sessionStatus,
      availableSeats: session.availableSeats,
      bookedSeats: session.bookedSeats,
      heldSeats: session.heldSeats,
      notice: session.sessionStatus === "sold_out" ? "Sold out" : "Not in waitlist",
    };
  }

  const isNotified = session.currentlyNotifiedUser === userId || entry.status === "notified";
  const countdown = isNotified && session.claimDeadline ? Math.max(0, Math.ceil((session.claimDeadline - Date.now()) / 1000)) : null;

  return {
    ok: true,
    joined: true,
    ticketReleased: isNotified,
    countdown,
    expiresAt: isNotified && session.claimDeadline ? new Date(session.claimDeadline).toISOString() : null,
    position: entry.position || session.waitlist.findIndex((item) => item.userId === userId) + 1,
    status: entry.status,
    estimatedWaitMinutes: estimateWaitMinutes(session, entry.position || 1, userId),
    sessionStatus: session.sessionStatus,
    availableSeats: session.availableSeats,
    notice: isNotified ? "A ticket is available for you." : "You have joined the waitlist.",
  };
}

function clearClaimTimer(session) {
  if (session.claimTimer) {
    clearTimeout(session.claimTimer);
    session.claimTimer = null;
  }
}

function handleBookingAccess(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.sessionStatus === "sold_out" || session.availableSeats <= 0) {
    emitToastMessage(userId, {
      type: "warning",
      message: "This session is sold out. Please join the waitlist.",
    });
    emitToUser(userId, "redirect_to_waitlist", {
      sessionId,
      userId,
      message: "This session is sold out. Please join the waitlist.",
      sessionStatus: session.sessionStatus,
      availableSeats: session.availableSeats,
    });
    return { ok: true, route: "waitlist" };
  }

  if (session.sessionStatus === "normal") {
    emitToastMessage(userId, {
      type: "success",
      message: "Seats are available. You can continue directly to seat selection.",
    });
    emitToUser(userId, "direct_booking_allowed", {
      sessionId,
      userId,
      message: "Seats are available. You can continue directly to seat selection.",
      sessionStatus: session.sessionStatus,
      availableSeats: session.availableSeats,
    });
    return { ok: true, route: "seats" };
  }

  const existingEntry = findQueueEntry(session, userId);
  if (existingEntry) {
    updateQueuePositions(sessionId);
    return { ok: true, route: "queue", position: existingEntry.position || 1 };
  }

  const result = joinQueue(userId, sessionId);
  if (result.ok) {
    return { ok: true, route: "queue" };
  }

  return result;
}

// Recalculates queue positions and notifies each queued user with a fresh position update.
function updateQueuePositions(sessionId) {
  const session = getSession(sessionId);

  session.queue.forEach((entry, index) => {
    entry.position = index + 1;
    entry.status = index === 0 ? "next" : "waiting";
    emitToUser(entry.userId, "queue_update", getUserPayload(session, entry.userId, entry.position));
    emitToastMessage(entry.userId, {
      type: "info",
      message: `Your queue position is now #${entry.position}.`,
    });
  });

  emitSessionUpdate(sessionId);
  logEvent(sessionId, `Queue positions recalculated for ${session.queue.length} user(s).`);
}

// Adds a user to the active queue and rejects duplicates or sold-out sessions.
function joinQueue(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.sessionStatus === "sold_out" || session.availableSeats <= 0) {
    emitToUser(userId, "redirect_to_waitlist", {
      sessionId,
      userId,
      message: "This session is sold out. Please join the waitlist.",
      sessionStatus: session.sessionStatus,
      availableSeats: session.availableSeats,
    });
    return { ok: false, message: "Session is sold out. Join the waitlist instead." };
  }

  if (findQueueEntry(session, userId)) {
    return { ok: false, message: "You are already in the queue." };
  }

  session.queue.push({
    userId,
    status: session.queue.length === 0 ? "next" : "waiting",
  });

  logEvent(sessionId, `${userId} joined the queue.`);
  updateQueuePositions(sessionId);
  return { ok: true };
}

// Removes the first user from the queue and grants that user permission to book.
function allowNextUser(sessionId) {
  const session = getSession(sessionId);

  if (session.queue.length === 0) {
    return { ok: false, message: "Queue is empty." };
  }

  const nextUser = session.queue.shift();

  emitToUser(nextUser.userId, "allowed_to_book", {
    sessionId,
    userId: nextUser.userId,
    message: "You are allowed to book now.",
    movieTitle: session.movieTitle,
    cinema: session.cinema,
    showtime: session.showtime,
    date: session.date,
    price: session.price,
  });
  emitToastMessage(nextUser.userId, {
    type: "success",
    message: "It is your turn to book now.",
  });

  logEvent(sessionId, `${nextUser.userId} was allowed to book.`);
  updateQueuePositions(sessionId);
  return { ok: true };
}

// Adds a user to the waitlist only when the session is sold out.
function joinWaitlist(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.sessionStatus !== "sold_out" && session.availableSeats > 0) {
    return { ok: false, message: "Waitlist is only available when the session is sold out." };
  }

  if (findWaitlistEntry(session, userId)) {
    return { ok: false, message: "You are already in the waitlist." };
  }

  session.waitlist.push({
    userId,
    status: "waiting",
  });

  emitToUser(userId, "waitlist_update", {
    sessionId,
    userId,
    position: session.waitlist.length,
    waitlistLength: session.waitlist.length,
    status: "waiting",
    sessionStatus: session.sessionStatus,
    availableSeats: session.availableSeats,
    estimatedWaitMinutes: estimateWaitMinutes(session, session.waitlist.length, userId),
  });
  emitToastMessage(userId, {
    type: "success",
    message: "You have joined the waitlist.",
  });
  logEvent(sessionId, `${userId} joined the waitlist.`);
  updateWaitlistPositions(sessionId);

  return {
    ok: true,
    position: session.waitlist.length,
    estimatedWaitMinutes: estimateWaitMinutes(session, session.waitlist.length, userId),
  };
}

// Recalculates waitlist order and broadcasts the current status to each waitlisted user.
function updateWaitlistPositions(sessionId) {
  const session = getSession(sessionId);

  session.waitlist.forEach((entry, index) => {
    entry.position = index + 1;
  });

  session.waitlist.forEach((entry) => {
    emitToUser(entry.userId, "waitlist_update", {
      sessionId,
      userId: entry.userId,
      position: entry.position,
      waitlistLength: session.waitlist.length,
      status: entry.status,
      sessionStatus: session.sessionStatus,
      estimatedWaitMinutes: estimateWaitMinutes(session, entry.position, entry.userId),
    });
  });

  emitSessionUpdate(sessionId);
}

// Notifies the next waiting user that a ticket is available and starts the claim countdown.
function notifyNextWaitlistUser(sessionId) {
  const session = getSession(sessionId);
  const nextUser = session.waitlist.find((entry) => entry.status === "waiting");

  if (!nextUser) {
    session.currentlyNotifiedUser = null;
    session.notifiedUserId = null;
    emitSessionUpdate(sessionId);
    return { ok: false, message: "No waitlist users available." };
  }

  clearClaimTimer(session);
  nextUser.status = "notified";
  session.currentlyNotifiedUser = nextUser.userId;
  session.notifiedUserId = nextUser.userId;
  session.claimDeadline = Date.now() + CLAIM_WINDOW_MS;
  if (session.availableSeats <= 0) {
    setAvailableSeats(session, 1);
  }

  emitToUser(nextUser.userId, "ticket_released", {
    sessionId,
    userId: nextUser.userId,
    message: "A ticket has been released for you.",
    claimWindowSeconds: CLAIM_WINDOW_MS / 1000,
    expiresAt: new Date(Date.now() + CLAIM_WINDOW_MS).toISOString(),
    sessionStatus: session.sessionStatus,
    availableSeats: session.availableSeats,
  });
  emitToastMessage(nextUser.userId, {
    type: "warning",
    message: "A ticket has been released for you.",
  });

  session.claimTimer = setTimeout(() => {
    expireClaimWindow(nextUser.userId, sessionId);
  }, CLAIM_WINDOW_MS);

  logEvent(sessionId, `Waitlist user ${nextUser.userId} notified about a released ticket.`);
  emitSessionUpdate(sessionId);
  updateWaitlistPositions(sessionId);
  return { ok: true };
}

// Simulates one returned ticket, either by increasing inventory or notifying the waitlist.
function releaseTicket(sessionId) {
  const session = getSession(sessionId);

  if (session.waitlist.length === 0) {
    setAvailableSeats(session, session.availableSeats + 1);
    setSessionStatus(session, "normal");
    logEvent(sessionId, "One ticket was released back to general availability.");
    emitSessionUpdate(sessionId);
    return { ok: true, mode: "inventory", availableTickets: session.availableTickets };
  }

  setSessionStatus(session, "sold_out");
  logEvent(sessionId, "One ticket was released to the waitlist.");
  return notifyNextWaitlistUser(sessionId);
}

async function confirmTicketBooking(payload = {}) {
  const userId = String(payload.userId || "").trim();
  const sessionId = String(payload.sessionId || "").trim();
  const movieId = String(payload.movieId || sessionId).trim();
  const seat = String(payload.seat || "").trim();
  const session = getSession(sessionId);

  if (!userId) {
    return { ok: false, message: "userId is required." };
  }

  if (!seat) {
    return { ok: false, message: "Seat is required." };
  }

  await supabaseUpsertUser(userId);

  if (session.bookedSeats.includes(seat)) {
    return { ok: false, message: "This seat has already been booked." };
  }

  const heldBy = session.heldSeats[seat];
  if (heldBy && heldBy !== userId) {
    return { ok: false, message: "This seat is currently selected by another user." };
  }

  const existingTicket = await supabaseGetActiveTicket(userId, sessionId);
  if (existingTicket) {
    return {
      ok: true,
      persisted: true,
      ticket: existingTicket,
      duplicate: true,
      message: "You already have a ticket for this session.",
    };
  }

  const hasWaitlistClaim = session.claimedUsers.includes(userId);
  if (session.sessionStatus === "sold_out" && !hasWaitlistClaim) {
    return { ok: false, message: "This released ticket is reserved for the notified waitlist user." };
  }

  if (session.availableSeats <= 0) {
    return { ok: false, message: "This session is sold out." };
  }

  const ticket = await supabaseCreateTicket({
    user_id: userId,
    session_id: sessionId,
    movie_id: movieId,
    movie_title: payload.movieTitle || session.movieTitle,
    cinema: payload.cinema || session.cinema,
    showtime: payload.showtime || session.showtime,
    session_date: payload.date || session.date,
    seat,
    price: Number(payload.price || session.price || 0),
    status: "confirmed",
  });

  if (!session.bookedSeats.includes(seat)) {
    session.bookedSeats.push(seat);
  }
  delete session.heldSeats[seat];
  session.claimedUsers = session.claimedUsers.filter((claimedUserId) => claimedUserId !== userId);
  setAvailableSeats(session, Math.max(0, session.availableSeats - 1));
  if (session.availableSeats <= 0) {
    setSessionStatus(session, "sold_out");
  }

  logEvent(sessionId, `${userId} booked seat ${seat}.`);
  emitSessionUpdate(sessionId);
  return {
    ok: true,
    persisted: Boolean(ticket),
    ticket,
    message: ticket ? "Ticket saved to database." : "Ticket confirmed locally. Supabase is not configured.",
  };
}

// Handles a user refund by releasing one seat back into inventory or to the next waitlisted user.
async function refundTicket(userId, sessionId, seat = null) {
  const session = getSession(sessionId);

  if (!userId) {
    return { ok: false, message: "userId is required." };
  }

  const ticket = await supabaseRefundActiveTicket(userId, sessionId);
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !ticket) {
    return { ok: false, message: "No active ticket was found for this user and session." };
  }

  const releasedSeat = ticket?.seat || seat;
  if (!releasedSeat) {
    return { ok: false, message: "No seat was found for this ticket." };
  }

  if (releasedSeat) {
    session.bookedSeats = session.bookedSeats.filter((bookedSeat) => bookedSeat !== releasedSeat);
    delete session.heldSeats[releasedSeat];
  }

  if (session.waitlist.length === 0) {
    setAvailableSeats(session, session.availableSeats + 1);
    setSessionStatus(session, "normal");
    logEvent(sessionId, `${userId} refunded a ticket. One seat returned to inventory.`);
    emitSessionUpdate(sessionId);
    return {
      ok: true,
      mode: "inventory",
      ticket,
      persisted: Boolean(ticket),
      availableTickets: session.availableTickets,
      message: "Your ticket has been refunded.",
    };
  }

  setSessionStatus(session, "sold_out");
  logEvent(sessionId, `${userId} refunded a ticket. The ticket was offered to the waitlist.`);
  const result = notifyNextWaitlistUser(sessionId);
  return {
    ...result,
    ok: true,
    mode: "waitlist",
    ticket,
    persisted: Boolean(ticket),
    message: "Your ticket has been refunded and offered to the next waitlist user.",
  };
}

// Lets the notified waitlist user claim the released ticket before the timer expires.
function claimReleasedTicket(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.currentlyNotifiedUser !== userId) {
    return { ok: false, message: "You are not the currently notified waitlist user." };
  }

  clearClaimTimer(session);
  session.claimDeadline = null;
  session.waitlist = session.waitlist.filter((entry) => entry.userId !== userId);
  session.claimedUsers.push(userId);
  session.currentlyNotifiedUser = null;
  session.notifiedUserId = null;

  emitToUser(userId, "claim_success", {
    sessionId,
    userId,
    message: "Ticket claim successful.",
  });
  emitToastMessage(userId, {
    type: "success",
    message: "Ticket claim successful.",
  });

  logEvent(sessionId, `${userId} claimed the released ticket.`);
  updateWaitlistPositions(sessionId);
  return { ok: true };
}

// Lets a notified waitlist user pass on the released ticket immediately.
function declineReleasedTicket(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.currentlyNotifiedUser !== userId) {
    return { ok: false, message: "You are not the currently notified waitlist user." };
  }

  clearClaimTimer(session);
  session.claimDeadline = null;
  session.waitlist = session.waitlist.filter((entry) => entry.userId !== userId);
  session.currentlyNotifiedUser = null;
  session.notifiedUserId = null;

  emitToUser(userId, "claim_declined", {
    sessionId,
    userId,
    message: "Ticket declined.",
  });
  emitToastMessage(userId, {
    type: "info",
    message: "Ticket declined.",
  });

  logEvent(sessionId, `${userId} declined the released ticket.`);
  updateWaitlistPositions(sessionId);

  const result = notifyNextWaitlistUser(sessionId);
  if (!result.ok) {
    setSessionStatus(session, "normal");
    setAvailableSeats(session, Math.max(1, session.availableSeats));
    emitSessionUpdate(sessionId);
  }

  return { ok: true };
}

// Expires the active claim window and advances to the next waitlist user if one exists.
function expireClaimWindow(userId, sessionId) {
  const session = getSession(sessionId);

  if (session.currentlyNotifiedUser !== userId) {
    return { ok: false, message: "Claim window already handled." };
  }

  clearClaimTimer(session);
  session.claimDeadline = null;
  session.waitlist = session.waitlist.filter((entry) => entry.userId !== userId);
  session.currentlyNotifiedUser = null;
  session.notifiedUserId = null;

  emitToUser(userId, "claim_expired", {
    sessionId,
    userId,
    message: "Claim window expired.",
  });
  emitToastMessage(userId, {
    type: "warning",
    message: "Claim window expired.",
  });

  logEvent(sessionId, `${userId}'s claim window expired.`);
  updateWaitlistPositions(sessionId);
  const result = notifyNextWaitlistUser(sessionId);
  if (!result.ok) {
    setSessionStatus(session, "normal");
    setAvailableSeats(session, Math.max(1, session.availableSeats));
    emitSessionUpdate(sessionId);
  }
  return { ok: true };
}

// Marks the demo session as sold out so new users are redirected into the waitlist flow.
function markSoldOut(sessionId) {
  const session = getSession(sessionId);
  setSessionStatus(session, "sold_out");
  if (session.availableSeats > 0) {
    setAvailableSeats(session, 0);
  }
  logEvent(sessionId, "Session marked as sold out.");
  emitSessionUpdate(sessionId);
  return { ok: true };
}

function setSessionNormal(sessionId) {
  const session = getSession(sessionId);
  setSessionStatus(session, "normal");
  if (session.availableSeats <= 0) {
    setAvailableSeats(session, 8);
  }
  logEvent(sessionId, "Session marked as normal.");
  emitSessionUpdate(sessionId);
  return { ok: true };
}

function setSessionHighDemand(sessionId) {
  const session = getSession(sessionId);
  setSessionStatus(session, "high_demand");
  if (session.availableSeats <= 0) {
    setAvailableSeats(session, 8);
  }
  logEvent(sessionId, "Session marked as high demand.");
  emitSessionUpdate(sessionId);
  return { ok: true };
}

// Resets all in-memory demo state so the queue and waitlist can be replayed for a video demo.
async function resetDemo(sessionId) {
  const session = getSession(sessionId);
  await supabaseResetSessionTickets(sessionId);
  clearClaimTimer(session);
  setSessionStatus(session, "normal");
  setAvailableSeats(session, 8);
  session.queue = [];
  session.waitlist = [];
  session.currentlyNotifiedUser = null;
  session.notifiedUserId = null;
  session.claimDeadline = null;
  session.claimedUsers = [];
  session.bookedSeats = ["B3"];
  session.heldSeats = {};
  session.eventLog = [];
  logEvent(sessionId, "Demo reset.");
  emitSessionUpdate(sessionId);
  updateQueuePositions(sessionId);
  updateWaitlistPositions(sessionId);
  return { ok: true };
}

io.on("connection", (socket) => {
  socket.on("register_user", ({ userId }) => {
    if (!userId) return;
    if (socket.data.userId && socket.data.userId !== userId) {
      socket.leave(`user:${socket.data.userId}`);
    }
    socket.join(`user:${userId}`);
    socket.data.userId = userId;
    void supabaseUpsertUser(userId).catch((error) => console.error("Failed to persist user:", error.message));
  });

  socket.on("disconnect", () => {
    releaseAllSeatHoldsForUser(socket.data.userId);
  });

  socket.on("request_booking_access", ({ userId, sessionId } = {}, ack) => {
    try {
      const result = handleBookingAccess(userId, sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to request booking access.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("join_queue", (payload = {}, ack) => {
    try {
      const result = joinQueue(payload.userId, payload.sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to join queue.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("allow_next_user", ({ sessionId } = {}, ack) => {
    try {
      const result = allowNextUser(sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to allow next user.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("join_waitlist", ({ userId, sessionId } = {}, ack) => {
    try {
      const result = joinWaitlist(userId, sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to join waitlist.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("sync_waitlist_state", ({ userId, sessionId } = {}, ack) => {
    try {
      const session = getSession(sessionId);
      const result = buildWaitlistSnapshot(session, userId);
      if (ack) ack(result);
    } catch (error) {
      const message = error.message || "Unable to sync waitlist state.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("sync_queue_state", ({ userId, sessionId } = {}, ack) => {
    try {
      const session = getSession(sessionId);
      const result = buildQueueSnapshot(session, userId);
      if (ack) ack(result);
    } catch (error) {
      const message = error.message || "Unable to sync queue state.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("sync_seat_state", ({ sessionId } = {}, ack) => {
    try {
      const session = getSession(sessionId);
      if (ack) ack(buildSeatSnapshot(session));
    } catch (error) {
      const message = error.message || "Unable to sync seat state.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("hold_seat", ({ userId, sessionId, seat } = {}, ack) => {
    try {
      const result = holdSeat(userId, sessionId, seat);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to hold seat.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("release_seat_hold", ({ userId, sessionId, seat } = {}, ack) => {
    try {
      const result = releaseSeatHold(userId, sessionId, seat);
      if (ack) ack(result);
    } catch (error) {
      const message = error.message || "Unable to release seat hold.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("release_ticket", ({ sessionId } = {}, ack) => {
    try {
      const result = releaseTicket(sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to release ticket.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("confirm_booking", async (payload = {}, ack) => {
    try {
      const result = await confirmTicketBooking(payload);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = getBookingErrorMessage(error);
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("refund_ticket", async ({ userId, sessionId, seat } = {}, ack) => {
    try {
      const result = await refundTicket(userId, sessionId, seat);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to refund ticket.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("claim_ticket", ({ userId, sessionId } = {}, ack) => {
    try {
      const result = claimReleasedTicket(userId, sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to claim ticket.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("decline_ticket", ({ userId, sessionId } = {}, ack) => {
    try {
      const result = declineReleasedTicket(userId, sessionId);
      if (ack) ack(result);
      if (!result.ok) socket.emit("error_message", result.message);
    } catch (error) {
      const message = error.message || "Unable to decline ticket.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("mark_sold_out", ({ sessionId } = {}, ack) => {
    try {
      const result = markSoldOut(sessionId);
      if (ack) ack(result);
      emitAdminState();
    } catch (error) {
      const message = error.message || "Unable to mark sold out.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("set_session_normal", ({ sessionId } = {}, ack) => {
    try {
      const result = setSessionNormal(sessionId);
      if (ack) ack(result);
      emitAdminState();
    } catch (error) {
      const message = error.message || "Unable to set session normal.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("set_session_high_demand", ({ sessionId } = {}, ack) => {
    try {
      const result = setSessionHighDemand(sessionId);
      if (ack) ack(result);
      emitAdminState();
    } catch (error) {
      const message = error.message || "Unable to set session high demand.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("reset_demo", async ({ sessionId } = {}, ack) => {
    try {
      const result = await resetDemo(sessionId);
      if (ack) ack(result);
      emitAdminState();
    } catch (error) {
      const message = error.message || "Unable to reset demo.";
      if (ack) ack({ ok: false, message });
      socket.emit("error_message", message);
    }
  });

  socket.on("admin_request_state", () => {
    socket.emit("admin_state_update", buildAdminSnapshot());
  });
});

bootstrapSessions()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Ticketing server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap sessions:", error);
    process.exit(1);
  });
