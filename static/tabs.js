// ============================================
// TABS — Unified tab manager
// Attendance tab is hidden until admin verifies
// ============================================
const TabManager = {
    activeTab: "signups",
    adminVerified: false,
    attendanceLoaded: false,

    switchTab(tab) {
        // Attendance requires admin auth
        if (tab === "attendance" && !this.adminVerified) {
            UI.toast("Admin access required", "error");
            return;
        }

        this.activeTab = tab;
        const container = document.querySelector(".container");

        // Hide all tab contents (inside container)
        document.getElementById("signupsTabContent").style.display = "none";
        document.getElementById("streamsTabContent").style.display = "none";
        document.getElementById("attendanceTabContent").style.display = "none";
        // Videos is outside the container
        document.getElementById("videosTabContent").style.display = "none";

        // Deactivate all tab buttons
        document.getElementById("tabSignups").classList.remove("active");
        document.getElementById("tabStreams").classList.remove("active");
        document.getElementById("tabAttendance").classList.remove("active");
        document.getElementById("tabVideos").classList.remove("active");

        // Reset container
        container.classList.remove("wide");
        container.style.display = "";

        // Show selected tab
        if (tab === "signups") {
            document.getElementById("signupsTabContent").style.display = "block";
            document.getElementById("tabSignups").classList.add("active");
        } else if (tab === "streams") {
            document.getElementById("streamsTabContent").style.display = "block";
            document.getElementById("tabStreams").classList.add("active");
            container.classList.add("wide");
            TwitchManager.loadIfNeeded();
        } else if (tab === "attendance") {
            document.getElementById("attendanceTabContent").style.display = "block";
            document.getElementById("tabAttendance").classList.add("active");
            if (!this.attendanceLoaded) {
                this._loadAttendance();
            }
        } else if (tab === "videos") {
            container.style.display = "none";
            document.getElementById("videosTabContent").style.display = "block";
            document.getElementById("tabVideos").classList.add("active");
            VideoManager.loadIfNeeded();
        }
    },

    // Called when admin successfully verifies — shows the attendance tab
    unlockAttendanceTab() {
        this.adminVerified = true;
        document.getElementById("tabAttendance").style.display = "";
        Admin.log("Attendance tab unlocked");
    },

    async _loadAttendance() {
        const tableDiv = document.getElementById("attendanceTable");
        tableDiv.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">Loading attendance data...</div>';

        try {
            const data = await API.fetchAttendance();
            this.attendanceLoaded = true;

            if (!data.attendance || data.attendance.length === 0) {
                tableDiv.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">No attendance data yet. Archive an event first.</div>';
                return;
            }

            // Build table
            let html = '<div class="attendance-list">';
            html += '<div class="attendance-header"><span class="att-rank">#</span><span class="att-name">Player</span><span class="att-count">Events</span><span class="att-last">Last Attended</span><span class="att-action"></span></div>';

            data.attendance.forEach((player, i) => {
                const rank = i + 1;
                const lastDate = player.last_event ? new Date(player.last_event).toLocaleDateString() : "—";

                // Medal colors for top 3
                let rankClass = "";
                if (rank === 1) rankClass = "gold";
                else if (rank === 2) rankClass = "silver";
                else if (rank === 3) rankClass = "bronze";

                const safeName = player.username.replace(/'/g, "\\'");
                html += `<div class="attendance-row">
                    <span class="att-rank ${rankClass}">${rank}</span>
                    <span class="att-name">${player.username}</span>
                    <span class="att-count">${player.events}</span>
                    <span class="att-last">${lastDate}</span>
                    <span class="att-action"><button class="att-remove" onclick="TabManager.removeAttendance('${safeName}')" title="Delete ${player.username}">&times;</button></span>
                </div>`;
            });

            // Summary
            const totalPlayers = data.attendance.length;
            const totalEvents = data.attendance.reduce((sum, p) => sum + p.events, 0);
            html += `<div class="attendance-summary">${totalPlayers} players across ${totalEvents} total signups</div>`;
            html += '</div>';

            tableDiv.innerHTML = html;
        } catch (err) {
            tableDiv.innerHTML = `<div style="text-align:center; color:#ff6a6a; padding:20px;">Error loading attendance: ${err.message}</div>`;
        }
    },

    // Refresh attendance if it was already loaded
    refreshAttendance() {
        if (this.attendanceLoaded) {
            this.attendanceLoaded = false;
            this._loadAttendance();
        }
    },

    async removeAttendance(username) {
        if (!confirm(`Delete ALL attendance records for ${username}? This cannot be undone.`)) return;
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password in the admin panel first", "error");
        try {
            const result = await API.deleteAttendance(pw, username);
            UI.toast(result.message);
            Admin.log(`Deleted attendance for ${username}`);
            this.attendanceLoaded = false;
            this._loadAttendance();
        } catch (err) {
            UI.toast(err.message, "error");
            Admin.log("ERROR: " + err.message);
        }
    },
};
