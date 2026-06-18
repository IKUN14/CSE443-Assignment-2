export function formatSessionStatus(status) {
  if (status === "high_demand") return "High Demand";
  if (status === "sold_out") return "Sold Out";
  if (status === "normal") return "Normal";
  if (!status) return "Unknown";

  return String(status)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatQueueStatus(status) {
  if (status === "allowed") return "Ready to Book";
  if (status === "next") return "Up Next";
  if (status === "waiting") return "Waiting";
  if (status === "idle") return "Not Joined";
  return formatSessionStatus(status);
}

export function formatDisplayDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
