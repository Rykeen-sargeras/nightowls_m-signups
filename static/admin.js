const Admin = {
    init() {
        document.getElementById("adminToggle").addEventListener("click", () => this.toggle());
        this.renderPanel();
        this._checkAutoLogin();
    },
    async _checkAutoLogin() {
        try {
            const result = await API.checkAdminIp();
            if (result.is_admin && result.token) {
                this._autoToken = result.token;
                this._unlockAdminUI();
                UI.toast("Admin auto-logged in");
            }
        } catch {}
    },
    toggle() {
        const s = document.getElementById("adminSection");
        s.style.display = s.style.display === "none" || !s.style.display ? "block" : "none";
    },
    renderPanel() {
        document.getElementById("adminInner").innerHTML = `
            <h3>Admin Actions</h3>
            <div id="adminLoginSection">
                <div class="form-group"><input type="password" id="adminPassword" placeholder="Admin Password"></div>
                <button class="btn btn-sm" id="btnLogin" style="width:100%;">Login</button>
            </div>
            <div id="adminLoggedIn" style="display:none;">
                <div class="admin-logged-badge">Logged in as Admin</div>
                <div class="admin-grid">
                    <button class="btn btn-sm btn-secondary" id="btnArchive">Archive & Reset</button>
                    <button class="btn btn-sm" id="btnLock">Lock & Sort</button>
                    <button class="btn btn-sm btn-secondary" id="btnUnlock">Unlock</button>
                    <button class="btn btn-sm btn-success" id="btnSave">Save Groups</button>
                </div>
                <button class="btn btn-sm btn-secondary" id="btnDrag" style="width:100%;margin-top:4px;">Enable Drag & Drop</button>
            </div>
            <div id="debug-console">Waiting for logs...</div>`;
        document.getElementById("btnLogin").addEventListener("click", () => this.login());
        document.getElementById("adminPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") this.login(); });
    },
    _unlockAdminUI() {
        document.getElementById("adminLoginSection").style.display = "none";
        document.getElementById("adminLoggedIn").style.display = "block";
        document.getElementById("btnArchive").onclick = () => this.action("archive");
        document.getElementById("btnLock").onclick = () => this.action("lock");
        document.getElementById("btnUnlock").onclick = () => this.action("unlock");
        document.getElementById("btnSave").onclick = () => this.saveGroups();
        document.getElementById("btnDrag").onclick = () => DragDrop.toggle();
        TabManager.unlockAttendanceTab();
    },
    getPassword() { return this._autoToken || document.getElementById("adminPassword")?.value || ""; },
    async login() {
        const pw = this.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        try {
            await API.adminVerify(pw);
            this._unlockAdminUI();
            UI.toast("Admin logged in");
        } catch (err) {
            UI.toast(err.message, "error");
        }
    },
    async action(type) {
        const pw = this.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        try {
            if (type === "lock") {
                await API.adminLock(pw);
                const result = await API.sortGroups(pw);
                const gm = {};
                result.groups.forEach((g, i) => g.members.forEach(p => gm[p.username] = String(i)));
                result.bench.forEach(p => gm[p.username] = "Bench");
                await API.saveGroups(pw, gm);
                UI.toast("Locked & sorted!");
            } else if (type === "unlock") {
                await API.adminUnlock(pw); UI.toast("Signups unlocked");
            } else if (type === "archive") {
                const r = await API.adminArchive(pw); UI.toast(r.message || "Archived & reset");
                TabManager.refreshAttendance();
            }
            await App.refreshRoster();
        } catch (err) { UI.toast(err.message, "error"); }
    },
    async saveGroups() {
        const pw = this.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        const gm = {};
        document.querySelectorAll(".dungeon-group").forEach(g => {
            const idx = g.dataset.groupIndex;
            g.querySelectorAll(".player").forEach(p => { gm[p.dataset.username] = idx; });
        });
        try {
            const r = await API.saveGroups(pw, gm);
            UI.toast(r.message || "Groups saved!");
        } catch (err) { UI.toast(err.message, "error"); }
    },
    log(msg) {
        const el = document.getElementById("debug-console");
        if (el) el.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.innerHTML;
    },
};

const DragDrop = {
    enabled: false, draggedItem: null,
    toggle() { this.enabled ? this.disable() : this.enable(); },
    enable() {
        this.enabled = true;
        const btn = document.getElementById("btnDrag");
        if (btn) btn.textContent = "Drag Mode: ON";
        document.querySelectorAll(".player").forEach(p => {
            p.draggable = true;
            p.addEventListener("dragstart", this._onStart);
            p.addEventListener("dragend", this._onEnd);
        });
        UI.toast("Drag & drop enabled");
    },
    disable() {
        this.enabled = false;
        const btn = document.getElementById("btnDrag");
        if (btn) btn.textContent = "Enable Drag & Drop";
        document.querySelectorAll(".player").forEach(p => {
            p.draggable = false;
            p.removeEventListener("dragstart", this._onStart);
            p.removeEventListener("dragend", this._onEnd);
        });
    },
    _onStart() { DragDrop.draggedItem = this; setTimeout(() => this.classList.add("dragging"), 0); },
    _onEnd() { this.classList.remove("dragging"); DragDrop.draggedItem = null; },
    handleDrop(e, groupDiv) {
        e.preventDefault(); groupDiv.classList.remove("drag-over");
        if (!DragDrop.draggedItem) return;
        groupDiv.appendChild(DragDrop.draggedItem);
    },
};
