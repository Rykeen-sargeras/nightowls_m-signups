const App = {
    players: [],
    isLocked: false,
    pollTimer: null,

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

        UI.renderSignupForm();
        Admin.init();
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
};

document.addEventListener("DOMContentLoaded", () => App.init());
