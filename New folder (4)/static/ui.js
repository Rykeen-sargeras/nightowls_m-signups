const UI = {
    toast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => { el.classList.add("removing"); setTimeout(() => el.remove(), 300); }, 3500);
    },

    updateTimer() {
        const now = new Date();
        const day = now.getDay(), hour = now.getHours(), min = now.getMinutes();
        if (day === CONFIG.EVENT_DAY && (hour > CONFIG.EVENT_HOUR || (hour === CONFIG.EVENT_HOUR && min >= CONFIG.EVENT_MIN))) {
            document.getElementById("timer-banner").innerHTML = `${CONFIG.DISCORD_MSG} Watch <a href="${CONFIG.TWITCH_URL}" target="_blank">Plated on Twitch</a>`;
            return;
        }
        const target = new Date(now);
        target.setDate(now.getDate() + ((CONFIG.EVENT_DAY + 7 - now.getDay()) % 7));
        target.setHours(CONFIG.EVENT_HOUR, CONFIG.EVENT_MIN, 0, 0);
        if (target < now) target.setDate(target.getDate() + 7);
        const diff = target - now;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        document.getElementById("timer-banner").innerHTML = `Next Mythic+ Event: <span class="timer-digits">${d}d</span><span class="timer-sep">:</span><span class="timer-digits">${String(h).padStart(2,'0')}h</span><span class="timer-sep">:</span><span class="timer-digits">${String(m).padStart(2,'0')}m</span><span class="timer-sep">:</span><span class="timer-digits">${String(s).padStart(2,'0')}s</span>`;
    },

    initParticles() {
        const c = document.getElementById("particles");
        for (let i = 0; i < 25; i++) {
            const p = document.createElement("div");
            p.className = "particle";
            p.style.left = Math.random() * 100 + "%";
            p.style.animationDuration = (8 + Math.random() * 14) + "s";
            p.style.animationDelay = Math.random() * 10 + "s";
            p.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
            const sz = 2 + Math.random() * 5;
            p.style.width = sz + "px"; p.style.height = sz + "px";
            c.appendChild(p);
        }
    },

    renderSignupForm() {
        document.getElementById("signupSection").innerHTML = `
            <h3>Event Registration</h3>
            <div class="form-group"><label for="username">Character Name</label>
                <input type="text" id="username" placeholder="Enter your character name" maxlength="24" autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group"><label for="classSelect">Class</label>
                    <select id="classSelect"><option value="">Select Class</option></select>
                </div>
                <div class="form-group"><label for="specSelect">Specialization</label>
                    <select id="specSelect" disabled><option value="">Select Spec</option></select>
                </div>
            </div>
            <div class="derived-role" id="derivedRole">Select a class and spec to see your role</div>
            <button id="signupBtn">Sign Up For Glory</button>
        `;
        const cs = document.getElementById("classSelect");
        Object.keys(SPEC_DATA).sort().forEach(cls => {
            const o = document.createElement("option"); o.value = cls; o.textContent = cls;
            o.style.color = CLASS_COLORS[cls] || "#fff"; cs.appendChild(o);
        });
        cs.addEventListener("change", () => this._onClassChange());
        document.getElementById("specSelect").addEventListener("change", () => this._onSpecChange());
        document.getElementById("signupBtn").addEventListener("click", () => App.handleSignup());
        document.getElementById("username").addEventListener("keydown", e => { if (e.key === "Enter") App.handleSignup(); });
    },

    _onClassChange() {
        const cls = document.getElementById("classSelect").value;
        const ss = document.getElementById("specSelect");
        const rd = document.getElementById("derivedRole");
        ss.innerHTML = '<option value="">Select Spec</option>'; ss.disabled = !cls;
        rd.textContent = "Select a class and spec to see your role"; rd.className = "derived-role";
        if (cls && SPEC_DATA[cls]) {
            Object.keys(SPEC_DATA[cls]).forEach(spec => {
                const o = document.createElement("option"); o.value = spec; o.textContent = spec; ss.appendChild(o);
            });
            const specs = Object.keys(SPEC_DATA[cls]);
            if (specs.length === 1) { ss.value = specs[0]; this._onSpecChange(); }
        }
    },

    _onSpecChange() {
        const cls = document.getElementById("classSelect").value;
        const spec = document.getElementById("specSelect").value;
        const rd = document.getElementById("derivedRole");
        if (cls && spec && SPEC_DATA[cls] && SPEC_DATA[cls][spec]) {
            const role = SPEC_DATA[cls][spec];
            const labels = { Tank: "Tank", Healer: "Healer", Melee: "Melee DPS", Ranged: "Ranged DPS" };
            rd.textContent = `Role: ${labels[role] || role}`; rd.className = `derived-role ${role.toLowerCase()}`;
        } else { rd.textContent = "Select a class and spec to see your role"; rd.className = "derived-role"; }
    },

    renderRoster(players) {
        const rv = document.getElementById("rosterView"); rv.style.display = "grid";
        document.getElementById("groupView").style.display = "none";
        const tanks = players.filter(p => p.role === "Tank");
        const healers = players.filter(p => p.role === "Healer");
        const dps = players.filter(p => p.role === "Melee" || p.role === "Ranged");
        rv.innerHTML = `
            <div class="roster-col"><h4 style="color:${ROLE_COLORS.Tank}">TANKS</h4><div class="count">${tanks.length} signed up</div><div id="tankList"></div></div>
            <div class="roster-col"><h4 style="color:${ROLE_COLORS.Healer}">HEALERS</h4><div class="count">${healers.length} signed up</div><div id="healList"></div></div>
            <div class="roster-col"><h4 style="color:#ABD473">DPS</h4><div class="count">${dps.length} signed up</div><div id="dpsList"></div></div>
        `;
        tanks.forEach(p => document.getElementById("tankList").appendChild(this._playerDiv(p)));
        healers.forEach(p => document.getElementById("healList").appendChild(this._playerDiv(p)));
        dps.forEach(p => document.getElementById("dpsList").appendChild(this._playerDiv(p)));
    },

    renderGroups(groups, bench) {
        document.getElementById("rosterView").style.display = "none";
        const gv = document.getElementById("groupView"); gv.style.display = "grid"; gv.innerHTML = "";
        groups.forEach((g, i) => this._createGroupCard(gv, i, `NightOwls Squad ${i + 1}`, g.members || g));
        if (bench && bench.length > 0) this._createGroupCard(gv, -1, "Waitlist / Bench", bench);
    },

    renderSavedGroups(players) {
        const gm = {}, bench = [];
        players.forEach(p => {
            if (p.group_index === "Bench" || p.group_index === "") bench.push(p);
            else { if (!gm[p.group_index]) gm[p.group_index] = []; gm[p.group_index].push(p); }
        });
        document.getElementById("rosterView").style.display = "none";
        const gv = document.getElementById("groupView"); gv.style.display = "grid"; gv.innerHTML = "";
        Object.keys(gm).sort((a, b) => Number(a) - Number(b)).forEach(idx => {
            this._createGroupCard(gv, parseInt(idx), `NightOwls Squad ${parseInt(idx) + 1}`, gm[idx]);
        });
        if (bench.length > 0) this._createGroupCard(gv, -1, "Waitlist / Bench", bench);
    },

    _createGroupCard(container, index, title, members) {
        const div = document.createElement("div");
        div.className = "dungeon-group";
        div.dataset.groupIndex = index === -1 ? "Bench" : String(index);
        if (index === -1) { div.style.borderTopColor = "#555"; div.style.background = "rgba(30,30,40,0.8)"; }
        else { div.style.borderTopColor = CONFIG.GROUP_COLORS[index % CONFIG.GROUP_COLORS.length]; }

        const h4 = document.createElement("h4");
        h4.style.color = index === -1 ? "#888" : CONFIG.GROUP_COLORS[index % CONFIG.GROUP_COLORS.length];
        h4.textContent = title; div.appendChild(h4);

        if (index !== -1) {
            const badges = document.createElement("div"); badges.className = "group-badges";
            let gl = false, gb = false;
            members.forEach(p => { const c = p.wow_class || p.cls; if (hasLust(c)) gl = true; if (hasBrez(c)) gb = true; });
            badges.innerHTML = (gl ? '<span class="badge badge-lust">Lust</span>' : '<span class="badge badge-missing">No Lust</span>')
                + (gb ? '<span class="badge badge-brez">B-Rez</span>' : '<span class="badge badge-missing">No B-Rez</span>');
            div.appendChild(badges);
        }

        const roleOrder = { Tank: 1, Healer: 2, Melee: 3, Ranged: 4 };
        const sorted = [...members].sort((a, b) => (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5));
        let curHeader = "";
        sorted.forEach(p => {
            const lbl = (p.role === "Melee" || p.role === "Ranged") ? "Damage" : p.role;
            if (lbl !== curHeader) {
                const rh = document.createElement("div"); rh.className = "role-header"; rh.textContent = lbl;
                div.appendChild(rh); curHeader = lbl;
            }
            div.appendChild(this._playerDiv(p));
        });

        div.addEventListener("dragover", e => { e.preventDefault(); div.classList.add("drag-over"); });
        div.addEventListener("dragleave", () => div.classList.remove("drag-over"));
        div.addEventListener("drop", e => DragDrop.handleDrop(e, div));
        container.appendChild(div);
    },

    _playerDiv(p) {
        const cls = p.wow_class || p.cls;
        const div = document.createElement("div"); div.className = "player";
        div.dataset.role = p.role; div.dataset.cls = cls;
        div.dataset.username = p.username; div.dataset.spec = p.specialization || "";
        div.innerHTML = `<span class="player-name" style="color:${CLASS_COLORS[cls] || '#FFF'}">${p.username}</span><span class="player-spec">${p.specialization || cls}</span>`;
        return div;
    },

    showLocked() {
        document.getElementById("signupSection").style.display = "none";
        const m = document.getElementById("lockedMessage"); m.style.display = "block";
        m.innerHTML = '<h3>Signups Locked — Groups Formed</h3>';
    },
    showUnlocked() {
        document.getElementById("signupSection").style.display = "block";
        document.getElementById("lockedMessage").style.display = "none";
    },
};
