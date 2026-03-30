const App = {
    players: [], isLocked: false, pollTimer: null, attendanceMap: {},
    async init() {
        UI.initParticles(); UI.updateTimer(); setInterval(() => UI.updateTimer(), 1000);
        try { SPEC_DATA = await API.fetchSpecs(); } catch (err) { UI.toast("Could not connect to server", "error"); return; }
        try {
            const attData = await API.fetchAttendance();
            attData.attendance.forEach(a => this.attendanceMap[a.username.toLowerCase()] = a);
        } catch {}
        UI.renderSignupForm();
        Admin.init();
        AuthManager.init();
        await AuthManager.restore();
        if (AuthManager.isAdmin()) TabManager.unlockAttendanceTab();
        TwitchManager.init();
        await this.refreshRoster();
        this.pollTimer = setInterval(() => this.refreshRoster(), CONFIG.POLL_INTERVAL);
    },
    async refreshRoster() {
        try {
            const data = await API.fetchRoster(); this.players = data.players; this.isLocked = data.is_locked;
            if (this.isLocked) {
                UI.showLocked();
                const hasSaved = this.players.some(p => p.group_index && p.group_index !== "");
                hasSaved ? UI.renderSavedGroups(this.players) : UI.renderRoster(this.players);
            } else {
                UI.showUnlocked(); UI.renderRoster(this.players);
            }
            if (DragDrop.enabled) DragDrop.enable();
        } catch (err) {}
    },
    async handleSignup() {
        const username = document.getElementById("username").value.trim();
        const cls = document.getElementById("classSelect").value;
        const spec = document.getElementById("specSelect").value;
        const btn = document.getElementById("signupBtn");
        if (!username) return UI.toast("Enter a character name", "error");
        if (!cls) return UI.toast("Select a class", "error");
        if (!spec) return UI.toast("Select a specialization", "error");
        btn.disabled = true; btn.textContent = "Signing up...";
        try {
            const result = await API.signup(username, cls, spec); UI.toast(result.message);
            document.getElementById("username").value = ""; document.getElementById("classSelect").value = "";
            document.getElementById("specSelect").innerHTML = '<option value="">Select Spec</option>'; document.getElementById("specSelect").disabled = true;
            document.getElementById("derivedRole").textContent = "Select a class and spec to see your role"; document.getElementById("derivedRole").className = "derived-role";
            await this.refreshRoster();
        } catch (err) { UI.toast(err.message, "error"); }
        finally { btn.disabled = false; btn.textContent = "Sign Up For Glory"; }
    },
    async removePlayer(username) {
        if (!TabManager.adminVerified) return UI.toast("Admin access required", "error");
        if (!confirm(`Remove ${username} from signups?`)) return;
        try { const result = await API.cancelSignup(username); UI.toast(result.message); await this.refreshRoster(); } catch (err) { UI.toast(err.message, "error"); }
    },
};

document.addEventListener("DOMContentLoaded", () => App.init());
