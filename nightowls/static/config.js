// ============================================
// CONFIG — Single-origin: API is on the same server
// ============================================
const CONFIG = {
    // Same origin — no need for a separate URL since backend serves frontend
    API_URL: "",

    // Event schedule: Friday 11:15 PM
    EVENT_DAY: 5,
    EVENT_HOUR: 23,
    EVENT_MIN: 15,

    // Links
    TWITCH_URL: "https://www.twitch.tv/plated",
    DISCORD_MSG: "Please join Discord to get groups started!",

    // Auto-refresh interval (ms)
    POLL_INTERVAL: 20000,

    // Group colors
    GROUP_COLORS: ['#FF5733', '#33FF57', '#3357FF', '#FF33F6', '#33FFF6', '#F6FF33', '#FF8C33', '#8C33FF'],
};
