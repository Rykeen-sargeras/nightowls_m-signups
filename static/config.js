// ============================================
// CONFIG — Single-origin: API is on the same server
// ============================================
const CONFIG = {
    API_URL: "",

    // M+ Event: Friday 11:30 PM EST
    MP_EVENT_DAY: 5,
    MP_EVENT_HOUR: 23,
    MP_EVENT_MIN: 30,

    // Raid Event: Saturday 11:30 PM EST
    RAID_EVENT_DAY: 6,
    RAID_EVENT_HOUR: 23,
    RAID_EVENT_MIN: 30,

    // Legacy (keep for backward compat)
    EVENT_DAY: 5,
    EVENT_HOUR: 23,
    EVENT_MIN: 30,

    TWITCH_URL: "https://www.twitch.tv/plated",
    DISCORD_MSG: "Please join Discord to get groups started!",
    POLL_INTERVAL: 20000,
    GROUP_COLORS: ['#FF5733', '#33FF57', '#3357FF', '#FF33F6', '#33FFF6', '#F6FF33', '#FF8C33', '#8C33FF'],
    TWITCH_CHANNELS: [
        { username: "plated", display: "Plated", priority: true },
        { username: "rykeen_the_reducer", display: "Rykeen", priority: true },
        { username: "ekkoe90", display: "Ekkoe", priority: false },
        { username: "krazy_canuck", display: "Shady", priority: false },
        { username: "doccoopgaming", display: "Doc", priority: false },
        { username: "tokithemistweaver", display: "Toki", priority: false },
    ],
    TWITCH_CHECK_INTERVAL: 60000,
};
