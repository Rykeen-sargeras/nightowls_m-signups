const AuthManager = {
    user: null,
    init() {
        document.getElementById("authButton").addEventListener("click", () => this.toggleModal(true));
        document.getElementById("authModalClose").addEventListener("click", () => this.toggleModal(false));
        document.getElementById("authSignupBtn").addEventListener("click", () => this.signup());
        document.getElementById("authLoginBtn").addEventListener("click", () => this.login());
        document.getElementById("authLogoutBtn").addEventListener("click", () => this.logout());
    },
    async restore() {
        const token = localStorage.getItem("nightowls_token");
        if (!token) { this.render(); return; }
        try {
            const data = await API.fetchMe();
            this.user = data.user;
        } catch {
            localStorage.removeItem("nightowls_token");
            this.user = null;
        }
        this.render();
    },
    toggleModal(show) { document.getElementById("authModal").style.display = show ? "flex" : "none"; },
    isLoggedIn() { return !!this.user; },
    isAdmin() { return !!this.user?.is_admin; },
    async signup() {
        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;
        try {
            const data = await API.authSignup(email, password);
            localStorage.setItem("nightowls_token", data.token);
            this.user = data.user; this.render(); this.toggleModal(false);
            UI.toast("Account created");
            CommunityManager.resetLoaded(); RulesManager.resetLoaded();
        } catch (err) { UI.toast(err.message, "error"); }
    },
    async login() {
        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;
        try {
            const data = await API.authLogin(email, password);
            localStorage.setItem("nightowls_token", data.token);
            this.user = data.user; this.render(); this.toggleModal(false);
            UI.toast("Logged in");
            if (this.isAdmin()) { TabManager.unlockAttendanceTab(); }
            CommunityManager.resetLoaded(); RulesManager.resetLoaded();
        } catch (err) { UI.toast(err.message, "error"); }
    },
    logout() {
        localStorage.removeItem("nightowls_token"); this.user = null; this.render(); UI.toast("Logged out");
        CommunityManager.resetLoaded(); RulesManager.resetLoaded();
    },
    render() {
        const label = this.user ? `${this.user.email}${this.user.is_admin ? ' (Admin)' : ''}` : 'Sign Up / Login';
        document.getElementById("authButton").textContent = label;
        document.getElementById("authLogoutRow").style.display = this.user ? "block" : "none";
    },
};
