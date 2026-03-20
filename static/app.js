const App = {
    players: [],
    isLocked: false,
    pollTimer: null,
    attendanceMap: {},

    async init() {
        UI.initParticles();
        UI.updateTimer();
        setInterval(() => UI.updateTimer(), 1000);

        try {
            SPEC_DATA = await API.fetchSpecs();
            Admin.log("Loaded spec data from API");
        } catch (err) {
            Admin.log("ERROR loading specs: " + err.message);
            UI.toast("Could not connect to server", "error");
            return;
        }

        // Load attendance data
        try {
            const attData = await API.fetchAttendance();
            attData.attendance.forEach(a => {
                this.attendanceMap[a.username.toLowerCase()] = a;
            });
            Admin.log(`Loaded attendance for ${attData.attendance.length} players`);
        } catch (err) {
            Admin.log("Attendance load skipped: " + err.message);
        }

        UI.renderSignupForm();
        Admin.init();
        TwitchManager.init();
        await this.refreshRoster();
        this.pollTimer = setInterval(() => this.refreshRoster(), CONFIG.POLL_INTERVAL);
    },

    async refreshRoster() {
        try {
            const data = await API.fetchRoster();
            this.players = data.players;
            this.isLocked = data.is_locked;

            if (this.isLocked) {
                UI.showLocked();
                const hasSaved = this.players.some(p => p.group_index && p.group_index !== "");
                if (hasSaved) {
                    UI.renderSavedGroups(this.players);
                    Admin.log("Loaded saved groups");
                } else {
                    UI.renderRoster(this.players);
                }
            } else {
                UI.showUnlocked();
                UI.renderRoster(this.players);
            }

            if (DragDrop.enabled) DragDrop.enable();
        } catch (err) {
            Admin.log("Roster fetch error: " + err.message);
        }
    },

    async handleSignup() {
        const username = document.getElementById("username").value.trim();
        const cls = document.getElementById("classSelect").value;
        const spec = document.getElementById("specSelect").value;
        const btn = document.getElementById("signupBtn");

        if (!username) return UI.toast("Enter a character name", "error");
        if (!cls) return UI.toast("Select a class", "error");
        if (!spec) return UI.toast("Select a specialization", "error");

        if (this.players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
            return UI.toast("That name is already signed up", "error");
        }

        btn.disabled = true; btn.textContent = "Signing up...";
        try {
            const result = await API.signup(username, cls, spec);
            UI.toast(result.message);
            document.getElementById("username").value = "";
            document.getElementById("classSelect").value = "";
            document.getElementById("specSelect").innerHTML = '<option value="">Select Spec</option>';
            document.getElementById("specSelect").disabled = true;
            document.getElementById("derivedRole").textContent = "Select a class and spec to see your role";
            document.getElementById("derivedRole").className = "derived-role";
            await this.refreshRoster();
        } catch (err) {
            UI.toast(err.message, "error");
        } finally {
            btn.disabled = false; btn.textContent = "Sign Up For Glory";
        }
    },

    async removePlayer(username) {
        if (!TabManager.adminVerified) {
            UI.toast("Admin access required — enter password in admin panel first", "error");
            return;
        }
        if (!confirm(`Remove ${username} from signups?`)) return;
        try {
            const result = await API.cancelSignup(username);
            UI.toast(result.message);
            await this.refreshRoster();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async removeFromAttendance(username) {
        if (!TabManager.adminVerified) {
            UI.toast("Admin access required", "error");
            return;
        }
        if (!confirm(`Remove ${username} from attendance records? This deletes all their archived history.`)) return;
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password in admin panel", "error");
        try {
            const result = await API.deleteAttendance(pw, username);
            UI.toast(result.message);
            TabManager.refreshAttendance();
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },
};

document.addEventListener("DOMContentLoaded", () => App.init());
