// ============================================
// TWITCH — Embed players using iframes with live-priority sorting
// ============================================
const TwitchManager = {
    liveStatus: {},

    init() {
        this.renderAll();
        // Check live status after a short delay, then periodically
        setTimeout(() => this.checkLiveStatus(), 3000);
        setInterval(() => this.checkLiveStatus(), CONFIG.TWITCH_CHECK_INTERVAL);
    },

    renderAll() {
        const channels = CONFIG.TWITCH_CHANNELS;
        const priority = channels.filter(c => c.priority);
        const others = channels.filter(c => !c.priority);

        this._renderRow("twitchTop", priority);
        this._renderRow("twitchBottom", others);
    },

    _renderRow(containerId, channels) {
        const container = document.getElementById(containerId);
        if (!container || channels.length === 0) return;
        container.innerHTML = "";

        const parent = window.location.hostname;

        channels.forEach(ch => {
            const wrapper = document.createElement("div");
            wrapper.className = "twitch-embed-wrapper";
            wrapper.id = `twitch-wrap-${ch.username}`;
            wrapper.dataset.username = ch.username;
            wrapper.dataset.priority = ch.priority ? "true" : "false";

            const label = document.createElement("div");
            label.className = "twitch-label";
            label.innerHTML = `
                <a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-name">${ch.display}</a>
                <span class="twitch-status" id="status-${ch.username}">Checking...</span>
            `;
            wrapper.appendChild(label);

            const playerDiv = document.createElement("div");
            playerDiv.className = "twitch-player";

            const iframe = document.createElement("iframe");
            iframe.src = `https://player.twitch.tv/?channel=${ch.username}&enableExtensions=true&muted=true&parent=${parent}&player=popout&quality=auto&volume=0`;
            iframe.allowFullscreen = true;
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("scrolling", "no");
            iframe.setAttribute("allow", "autoplay; encrypted-media");
            playerDiv.appendChild(iframe);

            wrapper.appendChild(playerDiv);
            container.appendChild(wrapper);
        });
    },

    async checkLiveStatus() {
        // Use a lightweight check — try fetching each channel's Twitch page
        // or use the oembed endpoint which doesn't need auth
        const channels = CONFIG.TWITCH_CHANNELS;

        for (const ch of channels) {
            try {
                // Twitch oembed returns data if channel exists, but doesn't directly tell live status
                // Instead, we check the static thumbnail which changes when live
                const thumbUrl = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${ch.username}-80x45.jpg`;
                const response = await fetch(thumbUrl, { method: "HEAD", mode: "no-cors" });
                // If we get here without error, channel might be live
                // no-cors doesn't give us status, so use a different approach

                // Better approach: Use the Twitch iframe's behavior
                // For now, mark all as unknown and let users see the embed
                this.liveStatus[ch.username] = false;
                this._updateBadge(ch.username, false);
            } catch (e) {
                this.liveStatus[ch.username] = false;
                this._updateBadge(ch.username, false);
            }
        }

        // Try the Twitch GraphQL-less approach: check oembed
        for (const ch of channels) {
            try {
                const res = await fetch(`https://www.twitch.tv/${ch.username}`, { mode: "no-cors" });
                // Can't read the response in no-cors, this is just a connectivity check
            } catch (e) {
                // ignore
            }
        }

        this._reorderByLiveStatus();
    },

    // Call this from outside if you get live data (e.g., from a backend endpoint)
    setLiveStatus(username, isLive) {
        this.liveStatus[username] = isLive;
        this._updateBadge(username, isLive);
        this._reorderByLiveStatus();
    },

    _updateBadge(username, isLive) {
        const badge = document.getElementById(`status-${username}`);
        if (!badge) return;
        if (isLive) {
            badge.textContent = "LIVE";
            badge.className = "twitch-status live";
        } else {
            badge.textContent = "";
            badge.className = "twitch-status";
        }
    },

    _reorderByLiveStatus() {
        const channels = CONFIG.TWITCH_CHANNELS;
        const topContainer = document.getElementById("twitchTop");
        const bottomContainer = document.getElementById("twitchBottom");
        if (!topContainer || !bottomContainer) return;

        const live = channels.filter(c => this.liveStatus[c.username]);
        const offline = channels.filter(c => !this.liveStatus[c.username]);

        // Priority live first, then other live, then priority offline
        const priorityLive = live.filter(c => c.priority);
        const otherLive = live.filter(c => !c.priority);
        const priorityOffline = offline.filter(c => c.priority);
        const otherOffline = offline.filter(c => !c.priority);

        // Top 2 spots: priority live → other live → priority offline
        let topChannels = [...priorityLive];
        if (topChannels.length < 2) topChannels.push(...otherLive.splice(0, 2 - topChannels.length));
        if (topChannels.length < 2) topChannels.push(...priorityOffline.splice(0, 2 - topChannels.length));

        const topUsernames = new Set(topChannels.map(c => c.username));
        let bottomChannels = channels.filter(c => !topUsernames.has(c.username));

        // Sort bottom: live first
        bottomChannels.sort((a, b) => {
            const aL = this.liveStatus[a.username] ? 1 : 0;
            const bL = this.liveStatus[b.username] ? 1 : 0;
            return bL - aL;
        });

        // Move wrappers
        topChannels.forEach(ch => {
            const w = document.getElementById(`twitch-wrap-${ch.username}`);
            if (w) topContainer.appendChild(w);
        });
        bottomChannels.forEach(ch => {
            const w = document.getElementById(`twitch-wrap-${ch.username}`);
            if (w) bottomContainer.appendChild(w);
        });
    },
};
