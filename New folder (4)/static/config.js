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

    // Twitch channels — priority channels get top spots by default
    TWITCH_CHANNELS: [
        { username: "plated", display: "Plated", priority: true },
        { username: "rykeen_the_reducer", display: "Rykeen", priority: true },
        { username: "ekkoe90", display: "Ekkoe", priority: false },
        { username: "krazy_canuck", display: "Shady", priority: false },
        { username: "doccoopgaming", display: "Doc", priority: false },
        { username: "tokithemistweaver", display: "Toki", priority: false },
    ],

    // How often to re-check live status (ms)
    TWITCH_CHECK_INTERVAL: 60000,
};
