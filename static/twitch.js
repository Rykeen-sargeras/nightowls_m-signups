// ============================================
// TWITCH — Embed players with live-priority sorting
// ============================================
const TwitchManager = {
    embeds: {},
    liveStatus: {},
    parentDomain: "",

    init() {
        // Twitch embeds require the parent domain for security
        this.parentDomain = window.location.hostname;
        this.renderAll();
        // Re-check live status periodically
        setInterval(() => this.checkLiveAndReorder(), CONFIG.TWITCH_CHECK_INTERVAL);
        // Initial check after embeds load (give them a few seconds)
        setTimeout(() => this.checkLiveAndReorder(), 8000);
    },

    renderAll() {
        const channels = CONFIG.TWITCH_CHANNELS;
        const priority = channels.filter(c => c.priority);
        const others = channels.filter(c => !c.priority);

        this._renderRow("twitchTop", priority, "top");
        this._renderRow("twitchBottom", others, "bottom");
    },

    _renderRow(containerId, channels, position) {
        const container = document.getElementById(containerId);
        if (!container || channels.length === 0) return;
        container.innerHTML = "";

        channels.forEach(ch => {
            const wrapper = document.createElement("div");
            wrapper.className = "twitch-embed-wrapper";
            wrapper.id = `twitch-wrap-${ch.username}`;
            wrapper.dataset.username = ch.username;
            wrapper.dataset.priority = ch.priority ? "true" : "false";

            const label = document.createElement("div");
            label.className = "twitch-label";
            label.innerHTML = `<span class="twitch-name">${ch.display}</span><span class="twitch-status" id="status-${ch.username}">Checking...</span>`;
            wrapper.appendChild(label);

            const embedDiv = document.createElement("div");
            embedDiv.id = `twitch-embed-${ch.username}`;
            embedDiv.className = "twitch-player";
            wrapper.appendChild(embedDiv);

            container.appendChild(wrapper);

            // Create Twitch embed
            try {
                this.embeds[ch.username] = new Twitch.Embed(`twitch-embed-${ch.username}`, {
                    width: "100%",
                    height: "100%",
                    channel: ch.username,
                    parent: [this.parentDomain],
                    layout: "video",
                    muted: true,
                    autoplay: false,
                });
            } catch (e) {
                embedDiv.innerHTML = `<a href="https://twitch.tv/${ch.username}" target="_blank" class="twitch-fallback">Watch ${ch.display} on Twitch</a>`;
            }
        });
    },

    checkLiveAndReorder() {
        const channels = CONFIG.TWITCH_CHANNELS;

        channels.forEach(ch => {
            const embed = this.embeds[ch.username];
            if (!embed) return;

            try {
                const player = embed.getPlayer();
                if (player) {
                    // Check if channel is actually live by looking at playback stats
                    // The embed shows the channel regardless, but we can check via iframe
                    const isPaused = player.isPaused();
                    const duration = player.getDuration();
                    // Live streams have duration of 0 or Infinity
                    const isLive = !isPaused || duration === 0 || duration === Infinity || isNaN(duration);

                    // Simpler approach: check if there's video playing
                    const qualities = player.getQualities();
                    const hasStream = qualities && qualities.length > 1;

                    this.liveStatus[ch.username] = hasStream;
                    this._updateStatusBadge(ch.username, hasStream);
                }
            } catch (e) {
                // Can't access player yet, try the fetch approach
                this._checkViaEmbed(ch);
            }
        });

        this._reorderByLiveStatus();
    },

    _checkViaEmbed(ch) {
        // Fallback: check if the iframe loaded a live stream by looking at the wrapper
        const wrapper = document.getElementById(`twitch-wrap-${ch.username}`);
        if (!wrapper) return;

        const iframe = wrapper.querySelector("iframe");
        if (iframe) {
            // If embed loaded successfully, assume it might be live
            // We'll rely on the Twitch player API for accuracy
            this.liveStatus[ch.username] = false;
            this._updateStatusBadge(ch.username, false);
        }
    },

    _updateStatusBadge(username, isLive) {
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

        // Separate into live and offline
        const live = channels.filter(c => this.liveStatus[c.username]);
        const offline = channels.filter(c => !this.liveStatus[c.username]);

        // Priority channels that are live go to top first
        const priorityLive = live.filter(c => c.priority);
        const otherLive = live.filter(c => !c.priority);
        const priorityOffline = offline.filter(c => c.priority);
        const otherOffline = offline.filter(c => !c.priority);

        // Top row: priority live first, then other live to fill 2 spots
        let topChannels = [...priorityLive];
        if (topChannels.length < 2) {
            // Fill remaining top spots with other live channels
            const needed = 2 - topChannels.length;
            topChannels.push(...otherLive.slice(0, needed));
        }
        if (topChannels.length < 2) {
            // Still not full, add priority offline
            const needed = 2 - topChannels.length;
            topChannels.push(...priorityOffline.slice(0, needed));
        }

        // Bottom row: everyone else
        const topUsernames = new Set(topChannels.map(c => c.username));
        let bottomChannels = channels.filter(c => !topUsernames.has(c.username));

        // Sort bottom: live first, then offline
        bottomChannels.sort((a, b) => {
            const aLive = this.liveStatus[a.username] ? 1 : 0;
            const bLive = this.liveStatus[b.username] ? 1 : 0;
            return bLive - aLive;
        });

        // Move DOM elements
        this._moveWrappersToContainer(topContainer, topChannels);
        this._moveWrappersToContainer(bottomContainer, bottomChannels);
    },

    _moveWrappersToContainer(container, channels) {
        channels.forEach(ch => {
            const wrapper = document.getElementById(`twitch-wrap-${ch.username}`);
            if (wrapper && wrapper.parentNode !== container) {
                container.appendChild(wrapper);
            }
        });
    },
};
