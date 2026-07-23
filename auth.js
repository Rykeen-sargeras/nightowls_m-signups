const App = {
    mpPlayers: [],
    raidPlayers: [],
    isLocked: false,
    pollTimer: null,
    benchPriorityNames: new Set(),
    currentEventType: "mythicplus",

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

        UI.renderSignupForm("mythicplus");
        UI.renderSignupForm("raid");
        Admin.init();
        TwitchManager.init();

        await this.refreshBenchPriority();

        await AuthManager.init();
        await this.refreshRoster();
        this.pollTimer = setInterval(() => this.refreshRoster(), CONFIG.POLL_INTERVAL);
    },

    switchEventType(type) {
        this.currentEventType = type;
        document.getElementById("toggleMythicPlus").classList.toggle("active", type === "mythicplus");
        document.getElementById("toggleRaid").classList.toggle("active", type === "raid");
        document.getElementById("mythicplusSection").style.display = type === "mythicplus" ? "block" : "none";
        document.getElementById("raidSection").style.display = type === "raid" ? "block" : "none";
    },

    async refreshBenchPriority() {
        try {
            const bpData = await API.fetchBenchPriority();
            this.benchPriorityNames = new Set(
                (bpData.bench_priority || []).map(name => String(name).toLowerCase())
            );
        } catch (err) {
            Admin.log("Bench priority load skipped");
        }
    },

    async refreshRoster() {
        try {
            await this.refreshBenchPriority();
            // Fetch M+ roster
            const mpData = await API.fetchRoster("mythicplus");
            this.mpPlayers = mpData.players;
            this.isLocked = mpData.is_locked;

            this.mpPlayers.forEach((p, i) => {
                p.signup_number = i + 1;
                p.bench_priority = this.benchPriorityNames.has(String(p.username).toLowerCase());
            });

            if (this.isLocked) {
                UI.showLocked();
                const hasSaved = this.mpPlayers.some(p => p.group_index && p.group_index !== "");
                if (hasSaved) {
                    UI.renderSavedGroups(this.mpPlayers);
                } else {
                    UI.renderRoster(this.mpPlayers);
                }
            } else {
                UI.showUnlocked();
                UI.renderRoster(this.mpPlayers);
            }

            // Fetch Raid roster
            const raidData = await API.fetchRoster("raid");
            this.raidPlayers = raidData.players;
            this.raidPlayers.forEach((p, i) => { p.signup_number = i + 1; });
            UI.renderRaidRoster(this.raidPlayers);

            if (DragDrop.enabled) DragDrop.enable();
        } catch (err) {
            Admin.log("Roster fetch error: " + err.message);
        }
    },

    async handleSignup(eventType = "mythicplus") {
        const isRaid = eventType === "raid";
        const usernameId = isRaid ? "raidUsername" : "username";
        const classId = isRaid ? "raidClassSelect" : "classSelect";
        const specId = isRaid ? "raidSpecSelect" : "specSelect";
        const statusId = isRaid ? "raidStatusSelect" : "statusSelect";
        const btnId = isRaid ? "raidSignupBtn" : "signupBtn";
        const roleId = isRaid ? "raidDerivedRole" : "derivedRole";

        const username = document.getElementById(usernameId).value.trim();
        const cls = document.getElementById(classId).value;
        const spec = document.getElementById(specId).value;
        const status = document.getElementById(statusId).value;
        const btn = document.getElementById(btnId);
        const canProvideLust = !isRaid && !!document.getElementById("canProvideLust")?.checked;
        const canInterrupt = !isRaid && !!document.getElementById("canInterrupt")?.checked;

        if (!username) return UI.toast("Enter a character name", "error");
        if (!cls) return UI.toast("Select a class", "error");
        if (!spec) return UI.toast("Select a specialization", "error");

        const checkPlayers = isRaid ? this.raidPlayers : this.mpPlayers;
        if (checkPlayers.some(p => p.username.toLowerCase() === username.toLowerCase())) {
            return UI.toast("That name is already signed up", "error");
        }

        btn.disabled = true; btn.textContent = "Signing up...";
        try {
            const result = await API.signup(username, cls, spec, eventType, status, canProvideLust, canInterrupt);
            UI.toast(result.message);
            document.getElementById(usernameId).value = "";
            document.getElementById(classId).value = "";
            document.getElementById(specId).innerHTML = '<option value="">Select Spec</option>';
            document.getElementById(specId).disabled = true;
            document.getElementById(roleId).textContent = "Select a class and spec to see your role";
            document.getElementById(roleId).className = "derived-role";
            document.getElementById(statusId).value = "available";
            if (!isRaid) {
                const lust = document.getElementById("canProvideLust"); if (lust) lust.checked = false;
                const interrupt = document.getElementById("canInterrupt"); if (interrupt) interrupt.checked = false;
                UI._updateUtilityOptions(classId);
            }
            await this.refreshRoster();
        } catch (err) {
            UI.toast(err.message, "error");
        } finally {
            btn.disabled = false; btn.textContent = "Sign Up For Glory";
        }
    },

    async removePlayer(username, eventType = "mythicplus") {
        if (!TabManager.adminVerified) {
            UI.toast("Admin access required", "error");
            return;
        }
        if (!confirm(`Remove ${username} from signups?`)) return;
        try {
            const result = await API.cancelSignup(username, eventType);
            UI.toast(result.message);
            await this.refreshRoster();
        } catch (err) { UI.toast(err.message, "error"); }
    },
};

document.addEventListener("DOMContentLoaded", () => App.init());
