// ============================================
// AUTH — User login/signup + password management
// ============================================
const AuthManager = {
    currentUser: null,

    async init() {
        this._renderNavButton();
        if (API.loadToken()) {
            try {
                this.currentUser = await API.getMe();
                this._onLoggedIn();
                // Check if password reset is required
                if (this.currentUser.password_reset_required) {
                    this._showChangePasswordModal();
                }
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
                        <input type="text" id="authRegUser" placeholder="Choose a username (3-50 chars)" autocomplete="username"></div>
                    <div class="form-group"><label for="authRegPass">Password</label>
                        <input type="password" id="authRegPass" placeholder="Create a password (min 6 chars)" autocomplete="new-password"></div>
                    <button class="btn btn-sm" onclick="AuthManager._doRegister()" style="width:100%;">Create Account</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

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

            // Check if password reset is required
            if (result.user.password_reset_required) {
                setTimeout(() => this._showChangePasswordModal(), 500);
            }
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    async _doRegister() {
        const username = document.getElementById("authRegUser").value.trim();
        const password = document.getElementById("authRegPass").value;
        if (!username || !password) return UI.toast("Fill in all fields", "error");
        try {
            const result = await API.register(username, password);
            API.setToken(result.token);
            this.currentUser = result.user;
            this._onLoggedIn();
            this.hideModal();
            UI.toast(result.message);
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    _showChangePasswordModal() {
        // Force password change — can't dismiss without changing
        let modal = document.getElementById("changePwModal");
        if (modal) { modal.style.display = "flex"; return; }

        modal = document.createElement("div");
        modal.id = "changePwModal";
        modal.className = "auth-modal-overlay";
        modal.innerHTML = `
            <div class="auth-modal">
                <h3 style="font-size:1.4em; margin-bottom:5px;">Password Change Required</h3>
                <p style="color:#ff8c44; font-family:'Lato',sans-serif; font-size:0.85em; margin-bottom:15px; text-align:center;">
                    Your password was reset by an admin. Please choose a new password to continue.
                </p>
                <div class="form-group"><label for="newPw1">New Password</label>
                    <input type="password" id="newPw1" placeholder="New password (min 6 chars)" autocomplete="new-password"></div>
                <div class="form-group"><label for="newPw2">Confirm Password</label>
                    <input type="password" id="newPw2" placeholder="Confirm new password" autocomplete="new-password"></div>
                <button class="btn btn-sm" onclick="AuthManager._doChangePassword()" style="width:100%;">Change Password</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById("newPw2")?.addEventListener("keydown", e => {
            if (e.key === "Enter") AuthManager._doChangePassword();
        });
    },

    async _doChangePassword() {
        const pw1 = document.getElementById("newPw1").value;
        const pw2 = document.getElementById("newPw2").value;
        if (!pw1 || pw1.length < 6) return UI.toast("Password must be at least 6 characters", "error");
        if (pw1 !== pw2) return UI.toast("Passwords don't match", "error");
        try {
            await API.changePassword(pw1);
            this.currentUser.password_reset_required = false;
            document.getElementById("changePwModal").style.display = "none";
            UI.toast("Password changed!");
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },

    logout() {
        API.clearToken();
        this.currentUser = null;
        this._renderNavButton();
        UI.toast("Logged out");
        if (TabManager.activeTab === "community") CommunityManager.loadIfNeeded();
    },

    _onLoggedIn() {
        this._renderNavButton();
        if (TabManager.activeTab === "community") CommunityManager.loadIfNeeded();
    },

    isLoggedIn() { return !!this.currentUser; },
    isAdmin() { return this.currentUser?.is_admin || false; },

    // === ADMIN: Member List ===
    async showMemberList() {
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Admin password required", "error");

        let modal = document.getElementById("memberListModal");
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.id = "memberListModal";
        modal.className = "auth-modal-overlay";
        modal.innerHTML = `<div class="auth-modal" style="width:500px;max-height:80vh;overflow-y:auto;">
            <button class="auth-modal-close" onclick="document.getElementById('memberListModal').style.display='none'">&times;</button>
            <h3 style="font-size:1.4em;">Member List</h3>
            <div id="memberListContent" style="color:#888;text-align:center;padding:20px;">Loading...</div>
        </div>`;
        document.body.appendChild(modal);

        try {
            const data = await API.getMemberList(pw);
            const container = document.getElementById("memberListContent");
            if (!data.members || data.members.length === 0) {
                container.innerHTML = '<div style="color:#888;padding:20px;">No members registered yet.</div>';
                return;
            }

            let html = '<div class="member-list">';
            data.members.forEach(m => {
                const adminBadge = m.is_admin ? '<span class="member-admin-badge">ADMIN</span>' : '';
                const resetBadge = m.password_reset_required ? '<span class="member-reset-badge">NEEDS PW CHANGE</span>' : '';
                const date = m.created_at ? new Date(m.created_at).toLocaleDateString() : "—";
                html += `<div class="member-row">
                    <div class="member-info">
                        <span class="member-name">${m.username}</span>
                        ${adminBadge}${resetBadge}
                        <span class="member-date">Joined ${date}</span>
                    </div>
                    <button class="btn btn-sm btn-secondary member-reset-btn" onclick="AuthManager.resetPassword(${m.id}, '${m.username.replace(/'/g, "\\'")}')">Reset Password</button>
                </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            document.getElementById("memberListContent").innerHTML = `<div style="color:#ff6a6a;">${err.message}</div>`;
        }
    },

    async resetPassword(userId, username) {
        if (!confirm(`Reset ${username}'s password to "owl123"? They'll be prompted to change it on next login.`)) return;
        const pw = Admin.getPassword();
        try {
            const result = await API.resetMemberPassword(pw, userId);
            UI.toast(result.message);
            this.showMemberList(); // Refresh the list
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },
};
