// ============================================
// AUTH — User login/signup UI + session management
// ============================================
const AuthManager = {
    currentUser: null,

    async init() {
        this._renderNavButton();
        // Try to restore session from localStorage
        if (API.loadToken()) {
            try {
                this.currentUser = await API.getMe();
                this._onLoggedIn();
            } catch (e) {
                API.clearToken();
                this.currentUser = null;
            }
        }
    },

    _renderNavButton() {
        const btn = document.getElementById("authNavBtn");
        if (!btn) return;
        if (this.currentUser) {
            btn.innerHTML = `<span class="auth-user-name">${this.currentUser.username}</span> <span class="auth-logout" onclick="AuthManager.logout()">Logout</span>`;
            btn.onclick = null;
        } else {
            btn.textContent = "Sign Up / Login";
            btn.onclick = () => this.showModal();
        }
    },

    showModal() {
        let modal = document.getElementById("authModal");
        if (modal) { modal.style.display = "flex"; return; }

        modal = document.createElement("div");
        modal.id = "authModal";
        modal.className = "auth-modal-overlay";
        modal.innerHTML = `
            <div class="auth-modal">
                <button class="auth-modal-close" onclick="AuthManager.hideModal()">&times;</button>
                <div class="auth-tabs">
                    <button class="auth-tab active" id="authTabLogin" onclick="AuthManager._switchAuthTab('login')">Login</button>
                    <button class="auth-tab" id="authTabRegister" onclick="AuthManager._switchAuthTab('register')">Sign Up</button>
                </div>

                <div id="authLoginForm">
                    <div class="form-group"><label for="authLoginUser">Username</label>
                        <input type="text" id="authLoginUser" placeholder="Your username" autocomplete="username"></div>
                    <div class="form-group"><label for="authLoginPass">Password</label>
                        <input type="password" id="authLoginPass" placeholder="Your password" autocomplete="current-password"></div>
                    <button class="btn btn-sm" onclick="AuthManager._doLogin()" style="width:100%;">Login</button>
                </div>

                <div id="authRegisterForm" style="display:none;">
                    <div class="auth-security-warning">
                        &#9888; Please use a unique password for this site. Do NOT reuse your World of Warcraft or other sensitive passwords.
                    </div>
                    <div class="form-group"><label for="authRegUser">Username</label>
                        <input type="text" id="authRegUser" placeholder="Choose a username" autocomplete="username"></div>
                    <div class="form-group"><label for="authRegEmail">Email</label>
                        <input type="email" id="authRegEmail" placeholder="Your email address" autocomplete="email"></div>
                    <div class="form-group"><label for="authRegPass">Password</label>
                        <input type="password" id="authRegPass" placeholder="Create a password (min 6 chars)" autocomplete="new-password"></div>
                    <button class="btn btn-sm" onclick="AuthManager._doRegister()" style="width:100%;">Create Account</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Enter key support
        setTimeout(() => {
            document.getElementById("authLoginPass")?.addEventListener("keydown", e => { if (e.key === "Enter") AuthManager._doLogin(); });
            document.getElementById("authRegPass")?.addEventListener("keydown", e => { if (e.key === "Enter") AuthManager._doRegister(); });
        }, 100);
    },

    hideModal() {
        const modal = document.getElementById("authModal");
        if (modal) modal.style.display = "none";
    },

    _switchAuthTab(tab) {
        document.getElementById("authLoginForm").style.display = tab === "login" ? "block" : "none";
        document.getElementById("authRegisterForm").style.display = tab === "register" ? "block" : "none";
        document.getElementById("authTabLogin").classList.toggle("active", tab === "login");
        document.getElementById("authTabRegister").classList.toggle("active", tab === "register");
    },

    async _doLogin() {
        const username = document.getElementById("authLoginUser").value.trim();
        const password = document.getElementById("authLoginPass").value;
        if (!username || !password) return UI.toast("Fill in all fields", "error");
        try {
            const result = await API.login(username, password);
            API.setToken(result.token);
            this.currentUser = result.user;
            this._onLoggedIn();
            this.hideModal();
            UI.toast(`Welcome back, ${result.user.username}!`);
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async _doRegister() {
        const username = document.getElementById("authRegUser").value.trim();
        const email = document.getElementById("authRegEmail").value.trim();
        const password = document.getElementById("authRegPass").value;
        if (!username || !email || !password) return UI.toast("Fill in all fields", "error");
        try {
            const result = await API.register(username, email, password);
            API.setToken(result.token);
            this.currentUser = result.user;
            this._onLoggedIn();
            this.hideModal();
            UI.toast(result.message);
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    logout() {
        API.clearToken();
        this.currentUser = null;
        this._renderNavButton();
        UI.toast("Logged out");
        // Refresh current tab to update UI
        if (TabManager.activeTab === "community") CommunityManager.loadIfNeeded();
    },

    _onLoggedIn() {
        this._renderNavButton();
        // If on community tab, refresh to show edit controls
        if (TabManager.activeTab === "community") CommunityManager.loadIfNeeded();
    },

    isLoggedIn() { return !!this.currentUser; },
    isAdmin() { return this.currentUser?.is_admin || false; },
};
