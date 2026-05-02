// ============================================
// TABS — Unified tab manager (all tabs)
// ============================================
const TabManager = {
    activeTab: "signups",
    adminVerified: false,
    attendanceLoaded: false,
    archiveHistoryLoaded: false,

    switchTab(tab) {
        this.activeTab = tab;
        const container = document.querySelector(".container");

        const tabIds = ["signupsTabContent", "streamsTabContent", "attendanceTabContent", "videosTabContent", "communityTabContent", "rulesTabContent"];
        tabIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });

        const btnIds = ["tabSignups", "tabStreams", "tabAttendance", "tabVideos", "tabCommunity", "tabRules"];
        btnIds.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove("active"); });

        container.classList.remove("wide");
        container.style.display = "";

        const tabBtn = document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (tabBtn) tabBtn.classList.add("active");

        if (tab === "signups") {
            document.getElementById("signupsTabContent").style.display = "block";
        } else if (tab === "streams") {
            document.getElementById("streamsTabContent").style.display = "block";
            container.classList.add("wide");
            TwitchManager.loadIfNeeded();
        } else if (tab === "attendance") {
            document.getElementById("attendanceTabContent").style.display = "block";
            container.classList.add("wide");
            if (!this.attendanceLoaded) this._loadAttendance();
            if (!this.archiveHistoryLoaded) this._loadArchiveHistory();
        } else if (tab === "videos") {
            container.style.display = "none";
            document.getElementById("videosTabContent").style.display = "block";
            VideoManager.loadIfNeeded();
        } else if (tab === "community") {
            container.style.display = "none";
            document.getElementById("communityTabContent").style.display = "block";
            CommunityManager.loadIfNeeded();
        } else if (tab === "rules") {
            container.style.display = "none";
            document.getElementById("rulesTabContent").style.display = "block";
            RulesManager.loadIfNeeded();
        }
    },

    unlockAttendanceTab() {
        this.adminVerified = true;
        Admin.log("HighScore tab admin access granted");
    },

    async _loadAttendance() {
        const tableDiv = document.getElementById("attendanceTable");
        tableDiv.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">Loading...</div>';
        try {
            const data = await API.fetchAttendance();
            this.attendanceLoaded = true;
            if (!data.attendance || data.attendance.length === 0) {
                tableDiv.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No attendance data yet.</div>';
                return;
            }
            let html = '<div class="attendance-list">';
            html += '<div class="attendance-header"><span class="att-rank">#</span><span class="att-name">Player</span><span class="att-count">Events</span><span class="att-last">Last Attended</span><span class="att-action"></span></div>';
            data.attendance.forEach((player, i) => {
                const rank = i + 1;
                const lastDate = player.last_event ? new Date(player.last_event).toLocaleDateString() : "—";
                let rankClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
                const safeName = player.username.replace(/'/g, "\\'");
                html += `<div class="attendance-row"><span class="att-rank ${rankClass}">${rank}</span><span class="att-name">${player.username}</span><span class="att-count">${player.events}</span><span class="att-last">${lastDate}</span><span class="att-action"><button class="att-remove" onclick="TabManager.removeAttendance('${safeName}')" title="Delete">&times;</button></span></div>`;
            });
            const totalPlayers = data.attendance.length;
            const totalEvents = data.attendance.reduce((sum, p) => sum + p.events, 0);
            html += `<div class="attendance-summary">${totalPlayers} players across ${totalEvents} total signups</div></div>`;
            tableDiv.innerHTML = html;
        } catch (err) {
            tableDiv.innerHTML = `<div style="text-align:center;color:#ff6a6a;padding:20px;">Error: ${err.message}</div>`;
        }
    },

    async _loadArchiveHistory() {
        const select = document.getElementById("archiveSelect");
        try {
            const data = await API.fetchArchiveHistory();
            this.archiveHistoryLoaded = true;
            select.innerHTML = '<option value="">Select a past event...</option>';

            if (!data.events || data.events.length === 0) return;

            data.events.forEach(evt => {
                const dt = new Date(evt.event_date);
                const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const dayName = days[dt.getDay()];
                const dateStr = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const typeLabel = evt.event_type === "raid" ? "Raid" : "M+";
                const label = `${dayName} ${dateStr} — ${typeLabel} (${evt.player_count} players)`;
                const opt = document.createElement("option");
                opt.value = `${evt.event_date}|${evt.event_type}`;
                opt.textContent = label;
                select.appendChild(opt);
            });
        } catch (err) {
            Admin.log("Archive history load failed: " + err.message);
        }
    },

    async loadArchiveEvent() {
        const select = document.getElementById("archiveSelect");
        const display = document.getElementById("archiveDisplay");
        const val = select.value;

        if (!val) { display.innerHTML = ""; return; }

        const [eventDate, eventType] = val.split("|");
        display.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">Loading...</div>';

        try {
            const data = await API.fetchArchiveEvent(eventDate, eventType);
            const players = data.players;

            if (!players || players.length === 0) {
                display.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No data for this event.</div>';
                return;
            }

            if (eventType === "raid") {
                display.innerHTML = this._renderArchiveRaid(players);
            } else {
                display.innerHTML = this._renderArchiveMythicPlus(players);
            }
        } catch (err) {
            display.innerHTML = `<div style="text-align:center;color:#ff6a6a;padding:20px;">Error: ${err.message}</div>`;
        }
    },

    _renderArchiveMythicPlus(players) {
        const groups = {};
        const bench = [];
        players.forEach(p => {
            if (p.group_index && p.group_index !== "" && p.group_index !== "Bench") {
                const gi = p.group_index;
                if (!groups[gi]) groups[gi] = [];
                groups[gi].push(p);
            } else {
                bench.push(p);
            }
        });

        let html = '<div class="archive-event">';

        const sortedKeys = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
        const roleOrder = { Tank: 1, Healer: 2, Melee: 3, Ranged: 4 };

        if (sortedKeys.length > 0) {
            html += '<div class="archive-groups-grid">';
            sortedKeys.forEach(gi => {
                const members = groups[gi].sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));
                const g_lust = members.some(p => hasLust(p.wow_class));
                const g_brez = members.some(p => hasBrez(p.wow_class));
                const color = CONFIG.GROUP_COLORS[Number(gi) % CONFIG.GROUP_COLORS.length];

                html += `<div class="archive-group-card" style="border-top: 3px solid ${color};">`;
                html += `<h4 style="color:${color}">Squad ${Number(gi) + 1}</h4>`;
                html += '<div class="group-badges">';
                html += g_lust ? '<span class="badge badge-lust">Lust</span>' : '<span class="badge badge-missing">No Lust</span>';
                html += g_brez ? '<span class="badge badge-brez">B-Rez</span>' : '<span class="badge badge-missing">No B-Rez</span>';
                html += '</div>';

                members.forEach(p => {
                    const cls = p.wow_class;
                    const statusBadge = p.signup_status === "tentative" ? '<span class="status-badge tent">[TENT]</span>'
                        : p.signup_status === "late" ? '<span class="status-badge late">[LATE]</span>' : '';
                    html += `<div class="archive-player"><span style="color:${CLASS_COLORS[cls] || '#FFF'}">${p.username}${statusBadge}</span><span class="player-spec">${p.specialization}</span></div>`;
                });
                html += '</div>';
            });
            html += '</div>';
        }

        if (bench.length > 0) {
            html += '<div class="archive-bench"><h4 style="color:#888">Bench</h4>';
            bench.forEach(p => {
                const cls = p.wow_class;
                const statusBadge = p.signup_status === "tentative" ? '<span class="status-badge tent">[TENT]</span>'
                    : p.signup_status === "late" ? '<span class="status-badge late">[LATE]</span>' : '';
                html += `<div class="archive-player"><span style="color:${CLASS_COLORS[cls] || '#FFF'}">${p.username}${statusBadge}</span><span class="player-spec">${p.specialization}</span></div>`;
            });
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    _renderArchiveRaid(players) {
        const tanks = players.filter(p => p.role === "Tank");
        const healers = players.filter(p => p.role === "Healer");
        const dps = players.filter(p => p.role === "Melee" || p.role === "Ranged");

        const mainTanks = tanks.slice(0, 2);
        const backupTanks = tanks.slice(2);

        let html = '<div class="archive-event">';
        html += `<div class="raid-summary">${players.length} players attended</div>`;

        // Tanks
        html += `<div class="archive-raid-role"><h4 style="color:${ROLE_COLORS.Tank}">TANKS</h4>`;
        mainTanks.forEach(p => {
            const statusBadge = this._archiveStatusBadge(p);
            html += `<div class="archive-player"><span style="color:${CLASS_COLORS[p.wow_class] || '#FFF'}">${p.username}${statusBadge}</span><span class="player-spec">${p.specialization}</span></div>`;
        });
        if (backupTanks.length > 0) {
            html += '<div class="raid-backup-label">Backup Tanks</div>';
            backupTanks.forEach(p => {
                html += `<div class="archive-player backup-tank"><span style="color:${CLASS_COLORS[p.wow_class] || '#FFF'}">${p.username}</span><span class="player-spec">${p.specialization}</span></div>`;
            });
        }
        html += '</div>';

        // Healers
        html += `<div class="archive-raid-role"><h4 style="color:${ROLE_COLORS.Healer}">HEALERS</h4>`;
        healers.forEach(p => {
            const statusBadge = this._archiveStatusBadge(p);
            html += `<div class="archive-player"><span style="color:${CLASS_COLORS[p.wow_class] || '#FFF'}">${p.username}${statusBadge}</span><span class="player-spec">${p.specialization}</span></div>`;
        });
        html += '</div>';

        // DPS
        html += '<div class="archive-raid-role"><h4 style="color:#ABD473">DPS</h4>';
        dps.forEach(p => {
            const statusBadge = this._archiveStatusBadge(p);
            html += `<div class="archive-player"><span style="color:${CLASS_COLORS[p.wow_class] || '#FFF'}">${p.username}${statusBadge}</span><span class="player-spec">${p.specialization}</span></div>`;
        });
        html += '</div></div>';

        return html;
    },

    _archiveStatusBadge(p) {
        if (p.signup_status === "tentative") return '<span class="status-badge tent">[TENT]</span>';
        if (p.signup_status === "late") return '<span class="status-badge late">[LATE]</span>';
        return '';
    },

    async removeAttendance(username) {
        if (!confirm(`Delete ALL attendance records for ${username}?`)) return;
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        try {
            await API.deleteAttendance(pw, username);
            UI.toast("Deleted");
            this.attendanceLoaded = false;
            this.archiveHistoryLoaded = false;
            this._loadAttendance();
            this._loadArchiveHistory();
        } catch (err) { UI.toast(err.message, "error"); }
    },

    refreshAttendance() {
        if (this.attendanceLoaded) { this.attendanceLoaded = false; this._loadAttendance(); }
        this.archiveHistoryLoaded = false;
        this._loadArchiveHistory();
    },
};
