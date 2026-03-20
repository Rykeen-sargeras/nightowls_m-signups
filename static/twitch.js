// ============================================
// TWITCH — Tab-based streams view
// NO DOM reordering — iframes reload when moved, causing flashing
// Instead: render once, update badges only
// ============================================
const TwitchManager = {
    players: {},
    liveStatus: {},
    initialized: false,
    activeTab: "signups",

    init() {
        Admin.log("Twitch manager ready (streams load on tab click)");
    },

    switchTab(tab) {
        this.activeTab = tab;
        const signupsContent = document.getElementById("signupsTabContent");
        const streamsContent = document.getElementById("streamsTabContent");
        const tabSignups = document.getElementById("tabSignups");
        const tabStreams = document.getElementById("tabStreams");

        if (tab === "streams") {
            signupsContent.style.display = "none";
            streamsContent.style.display = "block";
            tabSignups.classList.remove("active");
            tabStreams.classList.add("active");
            if (!this.initialized) {
                this._loadEmbeds();
                this.initialized = true;
            }
        } else {
            signupsContent.style.display = "block";
            streamsContent.style.display = "none";
            tabSignups.classList.add("active");
            tabStreams.classList.remove("active");
        }
    },

    _loadEmbeds() {
        if (typeof Twitch === "undefined" || typeof Twitch.Player === "undefined") {
            Admin.log("Twitch script not loaded, retrying...");
            setTimeout(() => this._loadEmbeds(), 500);
            return;
        }

        const channels = CONFIG.TWITCH_CHANNELS;
        const priority = channels.filter(c => c.priority);
        const others = channels.filter(c => !c.priority);

        this._renderRow("twitchTop", priority);
        this._renderRow("twitchBottom", others);
        Admin.log("Twitch embeds loaded");
    },

    _renderRow(containerId, channels) {
        const container = document.getElementById(containerId);
        if (!container || channels.length === 0) return;
        container.innerHTML = "";

        channels.forEach(ch => {
            const wrapper = document.createElement("div");
            wrapper.className = "twitch-embed-wrapper";
            wrapper.id = `twitch-wrap-${ch.username}`;

            // Label
            const label = document.createElement("div");
            label.className = "twitch-label";
            label.innerHTML = `
                <a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-name">${ch.display}</a>
                <span class="twitch-status offline" id="status-${ch.username}">Offline</span>
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

            // Create Twitch.Player — render once, never move
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

                player.addEventListener(Twitch.Player.ONLINE, () => {
                    if (!this.liveStatus[ch.username]) {
                        Admin.log(`${ch.display} is LIVE!`);
                        this.liveStatus[ch.username] = true;
                        this._updateBadge(ch.username, true);
                        this._updateStreamsTabBadge();
                    }
                });

                player.addEventListener(Twitch.Player.OFFLINE, () => {
                    if (this.liveStatus[ch.username]) {
                        Admin.log(`${ch.display} went offline`);
                        this.liveStatus[ch.username] = false;
                        this._updateBadge(ch.username, false);
                        this._updateStreamsTabBadge();
                    }
                });

            } catch (e) {
                Admin.log(`Twitch error (${ch.display}): ${e.message}`);
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

    _updateStreamsTabBadge() {
        const tabBtn = document.getElementById("tabStreams");
        const liveCount = Object.values(this.liveStatus).filter(v => v).length;
        if (liveCount > 0) {
            tabBtn.innerHTML = `Streams <span class="tab-live-badge">${liveCount} LIVE</span>`;
        } else {
            tabBtn.textContent = "Streams";
        }
    },
};
