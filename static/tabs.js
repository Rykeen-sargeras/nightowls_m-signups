// ============================================
// TABS — Unified tab manager (all tabs)
// ============================================
const TabManager = {
    activeTab: "signups",
    adminVerified: false,
    attendanceLoaded: false,

    switchTab(tab) {
        if (tab === "attendance" && !this.adminVerified) {
            UI.toast("Admin access required", "error");
            return;
        }

        this.activeTab = tab;
        const container = document.querySelector(".container");

        // Hide all tab contents
        const tabIds = ["signupsTabContent", "streamsTabContent", "attendanceTabContent", "videosTabContent", "communityTabContent", "rulesTabContent"];
        tabIds.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });

        // Deactivate all tab buttons
        const btnIds = ["tabSignups", "tabStreams", "tabAttendance", "tabVideos", "tabCommunity", "tabRules"];
        btnIds.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove("active"); });

        // Reset container
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
            if (!this.attendanceLoaded) this._loadAttendance();
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
        const el = document.getElementById("tabAttendance");
        if (el) el.style.display = "";
        Admin.log("Attendance tab unlocked");
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

    async removeAttendance(username) {
        if (!confirm(`Delete ALL attendance records for ${username}?`)) return;
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        try {
            await API.deleteAttendance(pw, username);
            UI.toast("Deleted");
            this.attendanceLoaded = false;
            this._loadAttendance();
        } catch (err) { UI.toast(err.message, "error"); }
    },

    refreshAttendance() {
        if (this.attendanceLoaded) { this.attendanceLoaded = false; this._loadAttendance(); }
    },
};
