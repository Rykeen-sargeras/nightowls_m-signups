// ============================================
// TWITCH — Interactive embeds with live-priority sorting
// Uses official Twitch.Player JS API with ONLINE/OFFLINE events
// ============================================
const TwitchManager = {
    players: {},
    liveStatus: {},

    init() {
        // Wait for Twitch embed script to be ready
        if (typeof Twitch === "undefined" || typeof Twitch.Player === "undefined") {
            Admin.log("Waiting for Twitch embed script...");
            setTimeout(() => this.init(), 500);
            return;
        }
        Admin.log("Twitch embed script loaded");
        this.renderAll();
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

        channels.forEach(ch => {
            // Wrapper
            const wrapper = document.createElement("div");
            wrapper.className = "twitch-embed-wrapper";
            wrapper.id = `twitch-wrap-${ch.username}`;
            wrapper.dataset.username = ch.username;
            wrapper.dataset.priority = ch.priority ? "true" : "false";

            // Label bar
            const label = document.createElement("div");
            label.className = "twitch-label";
            label.innerHTML = `
                <a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-name">${ch.display}</a>
                <span class="twitch-status" id="status-${ch.username}">Loading...</span>
            `;
            wrapper.appendChild(label);

            // Player container
            const playerDiv = document.createElement("div");
            playerDiv.className = "twitch-player";
            const embedTarget = document.createElement("div");
            embedTarget.id = `twitch-player-${ch.username}`;
            embedTarget.style.width = "100%";
            embedTarget.style.height = "100%";
            playerDiv.appendChild(embedTarget);
            wrapper.appendChild(playerDiv);

            container.appendChild(wrapper);

            // Create Twitch.Player
            try {
                const player = new Twitch.Player(`twitch-player-${ch.username}`, {
                    width: "100%",
                    height: "100%",
                    channel: ch.username,
                    parent: [window.location.hostname],
                    muted: true,
                    autoplay: false,
                });

                this.players[ch.username] = player;
                this.liveStatus[ch.username] = false;

                // Listen for ONLINE/OFFLINE events
                player.addEventListener(Twitch.Player.ONLINE, () => {
                    Admin.log(`${ch.display} went LIVE`);
                    this.liveStatus[ch.username] = true;
                    this._updateBadge(ch.username, true);
                    this._reorderByLiveStatus();
                });

                player.addEventListener(Twitch.Player.OFFLINE, () => {
                    Admin.log(`${ch.display} went OFFLINE`);
                    this.liveStatus[ch.username] = false;
                    this._updateBadge(ch.username, false);
                    this._reorderByLiveStatus();
                });

                player.addEventListener(Twitch.Player.READY, () => {
                    Admin.log(`${ch.display} player ready`);
                });

            } catch (e) {
                Admin.log(`Twitch embed error for ${ch.display}: ${e.message}`);
                embedTarget.innerHTML = `<a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-fallback">Watch ${ch.display} on Twitch</a>`;
            }
        });
    },

    _updateBadge(username, isLive) {
        const badge = document.getElementById(`status-${username}`);
        if (!badge) return;
        if (isLive) {
            badge.textContent = "LIVE";
            badge.className = "twitch-status live";
        } else {
            badge.textContent = "Offline";
            badge.className = "twitch-status offline";
        }
    },

    _reorderByLiveStatus() {
        const channels = CONFIG.TWITCH_CHANNELS;
        const topContainer = document.getElementById("twitchTop");
        const bottomContainer = document.getElementById("twitchBottom");
        if (!topContainer || !bottomContainer) return;

        const live = channels.filter(c => this.liveStatus[c.username]);
        const offline = channels.filter(c => !this.liveStatus[c.username]);

        const priorityLive = live.filter(c => c.priority);
        const otherLive = live.filter(c => !c.priority);
        const priorityOffline = offline.filter(c => c.priority);

        // Top 2: priority live first, then other live to fill, then priority offline
        let topChannels = [...priorityLive];
        if (topChannels.length < 2) {
            topChannels.push(...otherLive.splice(0, 2 - topChannels.length));
        }
        if (topChannels.length < 2) {
            topChannels.push(...priorityOffline.splice(0, 2 - topChannels.length));
        }

        const topUsernames = new Set(topChannels.map(c => c.username));
        let bottomChannels = channels.filter(c => !topUsernames.has(c.username));

        // Sort bottom: live channels first
        bottomChannels.sort((a, b) => {
            const aL = this.liveStatus[a.username] ? 1 : 0;
            const bL = this.liveStatus[b.username] ? 1 : 0;
            return bL - aL;
        });

        // Move DOM wrappers to correct containers
        topChannels.forEach(ch => {
            const w = document.getElementById(`twitch-wrap-${ch.username}`);
            if (w) topContainer.appendChild(w);
        });
        bottomChannels.forEach(ch => {
            const w = document.getElementById(`twitch-wrap-${ch.username}`);
            if (w) bottomContainer.appendChild(w);
        });

        Admin.log(`Twitch reorder: top=[${topChannels.map(c=>c.display)}] bottom=[${bottomChannels.map(c=>c.display)}]`);
    },
};
