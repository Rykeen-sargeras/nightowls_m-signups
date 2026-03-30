const TabManager = {
    activeTab: "signups",
    adminVerified: false,
    attendanceLoaded: false,
    switchTab(tab) {
        this.activeTab = tab;
        const container = document.querySelector(".container");
        ["signups","streams","attendance","community","rules"].forEach(name => {
            const el = document.getElementById(`${name}TabContent`);
            if (el) el.style.display = "none";
        });
        document.getElementById("videosTabContent").style.display = "none";
        document.querySelectorAll(".banner-tab").forEach(tab => tab.classList.remove("active"));
        container.classList.remove("wide");
        container.style.display = "";
        if (tab === "videos") {
            container.style.display = "none";
            document.getElementById("videosTabContent").style.display = "block";
            document.getElementById("tabVideos").classList.add("active");
            VideoManager.loadIfNeeded();
            return;
        }
        document.getElementById(`${tab}TabContent`).style.display = "block";
        document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add("active");
        if (tab === "streams") { container.classList.add("wide"); TwitchManager.loadIfNeeded(); }
        if (tab === "attendance") this._loadAttendance();
        if (tab === "community") CommunityManager.loadIfNeeded();
        if (tab === "rules") RulesManager.loadIfNeeded();
    },
    unlockAttendanceTab() {
        this.adminVerified = true;
        document.getElementById("tabAttendance").style.display = "";
    },
    async _loadAttendance() {
        const tableDiv = document.getElementById("attendanceTable");
        tableDiv.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">Loading attendance data...</div>';
        try {
            const data = await API.fetchAttendance();
            let html = '<div class="attendance-list">';
            html += '<div class="attendance-header"><span class="att-rank">#</span><span class="att-name">Player</span><span class="att-count">Events</span><span class="att-last">Last Attended</span><span class="att-action"></span></div>';
            data.attendance.forEach((player, i) => {
                const lastDate = player.last_event ? new Date(player.last_event).toLocaleDateString() : "—";
                html += `<div class="attendance-row"><span class="att-rank">${i+1}</span><span class="att-name">${player.username}</span><span class="att-count">${player.events}</span><span class="att-last">${lastDate}</span><span></span></div>`;
            });
            html += '</div>'; tableDiv.innerHTML = html;
        } catch (err) { tableDiv.innerHTML = `<div style="color:#ff6a6a">${err.message}</div>`; }
    },
    refreshAttendance() { if (this.activeTab === "attendance") this._loadAttendance(); },
};
