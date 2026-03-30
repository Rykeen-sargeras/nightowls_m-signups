const TwitchManager = {
    players: {}, liveStatus: {}, initialized: false,
    init() {},
    loadIfNeeded() { if (!this.initialized) { this._loadEmbeds(); this.initialized = true; } },
    _loadEmbeds() {
        if (typeof Twitch === "undefined" || typeof Twitch.Player === "undefined") { setTimeout(() => this._loadEmbeds(), 500); return; }
        const channels = CONFIG.TWITCH_CHANNELS; const priority = channels.filter(c => c.priority); const others = channels.filter(c => !c.priority);
        this._renderRow("twitchTop", priority); this._renderRow("twitchBottom", others);
    },
    _renderRow(containerId, channels) {
        const container = document.getElementById(containerId); if (!container) return; container.innerHTML = "";
        channels.forEach(ch => {
            const wrapper = document.createElement("div"); wrapper.className = "twitch-embed-wrapper";
            wrapper.innerHTML = `<div class="twitch-label"><a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-name">${ch.display}</a><span class="twitch-status offline">Offline</span></div><div class="twitch-player"><div id="twitch-player-${ch.username}"></div></div>`;
            container.appendChild(wrapper);
            try { new Twitch.Player(`twitch-player-${ch.username}`, { width: "100%", height: "100%", channel: ch.username, parent: [window.location.hostname], muted: true, autoplay: false }); } catch {}
        });
    },
};
