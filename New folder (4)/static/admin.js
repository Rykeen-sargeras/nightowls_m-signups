const Admin = {
    init() {
        document.getElementById("adminToggle").addEventListener("click", () => this.toggle());
        this.renderPanel();
    },
    toggle() {
        const s = document.getElementById("adminSection");
        s.style.display = s.style.display === "none" || !s.style.display ? "block" : "none";
    },
    renderPanel() {
        document.getElementById("adminInner").innerHTML = `
            <h3>Admin Actions</h3>
            <div class="form-group"><label for="adminPassword" style="display:none;">Admin Password</label><input type="password" id="adminPassword" placeholder="Admin Password"></div>
            <div class="admin-grid">
                <button class="btn btn-sm btn-secondary" id="btnArchive">Archive & Reset</button>
                <button class="btn btn-sm" id="btnLock">Lock & Sort</button>
                <button class="btn btn-sm btn-secondary" id="btnUnlock">Unlock</button>
                <button class="btn btn-sm btn-success" id="btnSave">Save Groups</button>
            </div>
            <button class="btn btn-sm btn-secondary" id="btnDrag" style="width:100%;margin-top:4px;">Enable Drag & Drop</button>
            <div id="debug-console">Waiting for logs...</div>
        `;
        document.getElementById("btnArchive").addEventListener("click", () => this.action("archive"));
        document.getElementById("btnLock").addEventListener("click", () => this.action("lock"));
        document.getElementById("btnUnlock").addEventListener("click", () => this.action("unlock"));
        document.getElementById("btnSave").addEventListener("click", () => this.saveGroups());
        document.getElementById("btnDrag").addEventListener("click", () => DragDrop.toggle());
    },
    getPassword() { return document.getElementById("adminPassword")?.value || ""; },
    async action(type) {
        const pw = this.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        try {
            this.log(`Running: ${type}...`);
            if (type === "lock") {
                await API.adminLock(pw);
                const result = await API.sortGroups(pw);
                const gm = {};
                result.groups.forEach((g, i) => { g.members.forEach(p => { gm[p.username] = String(i); }); });
                result.bench.forEach(p => { gm[p.username] = "Bench"; });
                await API.saveGroups(pw, gm);
                UI.toast("Locked & sorted!");
                this.log(`Formed ${result.groups.length} groups, ${result.bench.length} benched`);
            } else if (type === "unlock") {
                await API.adminUnlock(pw);
                UI.toast("Signups unlocked");
                this.log("Unlocked signups");
            } else if (type === "archive") {
                const r = await API.adminArchive(pw);
                UI.toast(r.message || "Archived & reset");
                this.log(r.message);
            }
            App.refreshRoster();
        } catch (err) { UI.toast(err.message, "error"); this.log("ERROR: " + err.message); }
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
            this.log("Groups saved to database");
        } catch (err) { UI.toast(err.message, "error"); this.log("ERROR: " + err.message); }
    },
    log(msg) {
        const el = document.getElementById("debug-console");
        if (el) el.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.innerHTML;
    },
};

const DragDrop = {
    enabled: false, draggedItem: null,
    async toggle() {
        if (this.enabled) { this.disable(); return; }
        const pw = Admin.getPassword();
        if (!pw) return UI.toast("Enter admin password", "error");
        const btn = document.getElementById("btnDrag"); btn.textContent = "Verifying...";
        try {
            await API.adminVerify(pw);
            this.enable(); UI.toast("Drag & drop enabled");
        } catch (err) { UI.toast(err.message, "error"); btn.textContent = "Enable Drag & Drop"; }
    },
    enable() {
        this.enabled = true;
        const btn = document.getElementById("btnDrag");
        btn.textContent = "Drag Mode: ON"; btn.style.background = "#228B22"; btn.style.borderColor = "#4CAF50"; btn.style.color = "#fff";
        document.querySelectorAll(".player").forEach(p => {
            p.draggable = true;
            p.addEventListener("dragstart", this._onStart);
            p.addEventListener("dragend", this._onEnd);
        });
    },
    disable() {
        this.enabled = false;
        const btn = document.getElementById("btnDrag");
        btn.textContent = "Enable Drag & Drop"; btn.style.background = ""; btn.style.borderColor = ""; btn.style.color = "";
        document.querySelectorAll(".player").forEach(p => {
            p.draggable = false;
            p.removeEventListener("dragstart", this._onStart);
            p.removeEventListener("dragend", this._onEnd);
        });
    },
    _onStart(e) { DragDrop.draggedItem = this; setTimeout(() => this.classList.add("dragging"), 0); },
    _onEnd(e) { this.classList.remove("dragging"); DragDrop.draggedItem = null; },
    handleDrop(e, groupDiv) {
        e.preventDefault(); groupDiv.classList.remove("drag-over");
        if (!DragDrop.draggedItem) return;
        groupDiv.appendChild(DragDrop.draggedItem);
        DragDrop._reorganize(groupDiv);
        DragDrop._updateBadges(groupDiv);
        Admin.log(`Moved ${DragDrop.draggedItem.dataset.username} → ${groupDiv.querySelector("h4").textContent}`);
    },
    _reorganize(div) {
        const players = Array.from(div.querySelectorAll(".player"));
        const h4 = div.querySelector("h4"), badges = div.querySelector(".group-badges");
        Array.from(div.children).forEach(c => { if (c !== h4 && c !== badges) c.remove(); });
        const order = { Tank: 1, Healer: 2, Melee: 3, Ranged: 4 };
        players.sort((a, b) => (order[a.dataset.role] || 5) - (order[b.dataset.role] || 5));
        let cur = "";
        players.forEach(p => {
            const lbl = (p.dataset.role === "Melee" || p.dataset.role === "Ranged") ? "Damage" : p.dataset.role;
            if (lbl !== cur) { const rh = document.createElement("div"); rh.className = "role-header"; rh.textContent = lbl; div.appendChild(rh); cur = lbl; }
            div.appendChild(p);
        });
    },
    _updateBadges(div) {
        const badges = div.querySelector(".group-badges"); if (!badges) return;
        let gl = false, gb = false;
        div.querySelectorAll(".player").forEach(p => { if (hasLust(p.dataset.cls)) gl = true; if (hasBrez(p.dataset.cls)) gb = true; });
        badges.innerHTML = (gl ? '<span class="badge badge-lust">Lust</span>' : '<span class="badge badge-missing">No Lust</span>')
            + (gb ? '<span class="badge badge-brez">B-Rez</span>' : '<span class="badge badge-missing">No B-Rez</span>');
    },
};
