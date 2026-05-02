const UI = {
    toast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => { el.classList.add("removing"); setTimeout(() => el.remove(), 300); }, 3500);
    },

    _countdown(targetDay, targetHour, targetMin) {
        const now = new Date();
        const target = new Date(now);
        target.setDate(now.getDate() + ((targetDay + 7 - now.getDay()) % 7));
        target.setHours(targetHour, targetMin, 0, 0);
        if (target < now) target.setDate(target.getDate() + 7);
        const diff = target - now;
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const dayUnit = d === 1 ? 'day' : 'days';
        return { d, h, m, s, dayUnit, diff };
    },

    updateTimer() {
        // M+ Timer
        const mp = this._countdown(CONFIG.MP_EVENT_DAY, CONFIG.MP_EVENT_HOUR, CONFIG.MP_EVENT_MIN);
        const mpEl = document.getElementById("mpTimerText");
        if (mpEl) {
            mpEl.innerHTML = `
                <span class="timer-label">Mythic+ — Friday 11:30 PM EST</span>
                <span class="timer-countdown">
                    <span class="timer-segment"><span class="timer-digits">${mp.d}</span><span class="timer-unit">${mp.dayUnit}</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(mp.h).padStart(2,'0')}</span><span class="timer-unit">hr</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(mp.m).padStart(2,'0')}</span><span class="timer-unit">min</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(mp.s).padStart(2,'0')}</span><span class="timer-unit">sec</span></span>
                </span>`;
        }

        // Raid Timer
        const raid = this._countdown(CONFIG.RAID_EVENT_DAY, CONFIG.RAID_EVENT_HOUR, CONFIG.RAID_EVENT_MIN);
        const raidEl = document.getElementById("raidTimerText");
        if (raidEl) {
            raidEl.innerHTML = `
                <span class="timer-label">Raid — Saturday 11:30 PM EST</span>
                <span class="timer-countdown">
                    <span class="timer-segment"><span class="timer-digits">${raid.d}</span><span class="timer-unit">${raid.dayUnit}</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(raid.h).padStart(2,'0')}</span><span class="timer-unit">hr</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(raid.m).padStart(2,'0')}</span><span class="timer-unit">min</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(raid.s).padStart(2,'0')}</span><span class="timer-unit">sec</span></span>
                </span>`;
        }

        // Banner timer — show whichever is next
        const bannerEl = document.getElementById("timerText");
        if (bannerEl) {
            const next = mp.diff < raid.diff ? { ...mp, label: "Next M+ Event" } : { ...raid, label: "Next Raid" };
            bannerEl.innerHTML = `
                <span class="timer-label">${next.label}</span>
                <span class="timer-countdown">
                    <span class="timer-segment"><span class="timer-digits">${next.d}</span><span class="timer-unit">${next.dayUnit}</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(next.h).padStart(2,'0')}</span><span class="timer-unit">hr</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(next.m).padStart(2,'0')}</span><span class="timer-unit">min</span></span>
                    <span class="timer-segment"><span class="timer-digits">${String(next.s).padStart(2,'0')}</span><span class="timer-unit">sec</span></span>
                </span>`;
        }
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

    renderSignupForm(eventType = "mythicplus") {
        const containerId = eventType === "raid" ? "raidSignupSection" : "signupSection";
        const btnId = eventType === "raid" ? "raidSignupBtn" : "signupBtn";
        const usernameId = eventType === "raid" ? "raidUsername" : "username";
        const classId = eventType === "raid" ? "raidClassSelect" : "classSelect";
        const specId = eventType === "raid" ? "raidSpecSelect" : "specSelect";
        const roleId = eventType === "raid" ? "raidDerivedRole" : "derivedRole";
        const statusId = eventType === "raid" ? "raidStatusSelect" : "statusSelect";

        const title = eventType === "raid" ? "Raid Registration" : "M+ Registration";

        document.getElementById(containerId).innerHTML = `
            <h3>${title}</h3>
            <div class="form-group"><label for="${usernameId}">Character Name</label>
                <input type="text" id="${usernameId}" placeholder="Enter your character name" maxlength="24" autocomplete="off">
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${classId}">Class</label>
                    <select id="${classId}"><option value="">Select Class</option></select>
                </div>
                <div class="form-group"><label for="${specId}">Specialization</label>
                    <select id="${specId}" disabled><option value="">Select Spec</option></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${statusId}">Status</label>
                    <select id="${statusId}">
                        <option value="available">Available</option>
                        <option value="tentative">Tentative</option>
                        <option value="late">Late</option>
                    </select>
                </div>
                <div class="form-group"><div class="derived-role" id="${roleId}">Select a class and spec to see your role</div></div>
            </div>
            <button id="${btnId}">Sign Up For Glory</button>
        `;
        const cs = document.getElementById(classId);
        Object.keys(SPEC_DATA).sort().forEach(cls => {
            const o = document.createElement("option"); o.value = cls; o.textContent = cls;
            o.style.color = CLASS_COLORS[cls] || "#fff"; cs.appendChild(o);
        });
        cs.addEventListener("change", () => this._onClassChange(classId, specId, roleId));
        document.getElementById(specId).addEventListener("change", () => this._onSpecChange(classId, specId, roleId));
        document.getElementById(btnId).addEventListener("click", () => App.handleSignup(eventType));
        document.getElementById(usernameId).addEventListener("keydown", e => { if (e.key === "Enter") App.handleSignup(eventType); });
    },

    _onClassChange(classId, specId, roleId) {
        const cls = document.getElementById(classId).value;
        const ss = document.getElementById(specId);
        const rd = document.getElementById(roleId);
        ss.innerHTML = '<option value="">Select Spec</option>'; ss.disabled = !cls;
        rd.textContent = "Select a class and spec to see your role"; rd.className = "derived-role";
        if (cls && SPEC_DATA[cls]) {
            Object.keys(SPEC_DATA[cls]).forEach(spec => {
                const o = document.createElement("option"); o.value = spec; o.textContent = spec; ss.appendChild(o);
            });
            const specs = Object.keys(SPEC_DATA[cls]);
            if (specs.length === 1) { ss.value = specs[0]; this._onSpecChange(classId, specId, roleId); }
        }
    },

    _onSpecChange(classId, specId, roleId) {
        const cls = document.getElementById(classId).value;
        const spec = document.getElementById(specId).value;
        const rd = document.getElementById(roleId);
        if (cls && spec && SPEC_DATA[cls] && SPEC_DATA[cls][spec]) {
            const role = SPEC_DATA[cls][spec];
            const labels = { Tank: "Tank", Healer: "Healer", Melee: "Melee DPS", Ranged: "Ranged DPS" };
            rd.textContent = `Role: ${labels[role] || role}`; rd.className = `derived-role ${role.toLowerCase()}`;
        } else { rd.textContent = "Select a class and spec to see your role"; rd.className = "derived-role"; }
    },

    _statusBadge(p) {
        if (p.signup_status === "tentative") return '<span class="status-badge tent">[TENT]</span>';
        if (p.signup_status === "late") return '<span class="status-badge late">[LATE]</span>';
        return '';
    },

    renderRoster(players) {
        const rv = document.getElementById("rosterView"); rv.style.display = "grid";
        document.getElementById("groupView").style.display = "none";
        const tanks = players.filter(p => p.role === "Tank");
        const healers = players.filter(p => p.role === "Healer");
        const dps = players.filter(p => p.role === "Melee" || p.role === "Ranged");

        const possibleGroups = Math.min(tanks.length, healers.length, Math.floor(dps.length / 3));
        const totalPlayers = players.length;

        let needsHtml = "";
        const needs = [];
        if (tanks.length < healers.length || tanks.length < Math.floor(dps.length / 3)) needs.push("Tanks");
        if (healers.length < tanks.length || healers.length < Math.floor(dps.length / 3)) needs.push("Healers");
        if (dps.length < 3 && tanks.length > 0 && healers.length > 0) needs.push("DPS");
        if (totalPlayers > 0 && needs.length > 0) {
            needsHtml = `<div class="role-needs">We need more <strong>${needs.join(" & ")}</strong> to form more groups!</div>`;
        }
        const summaryHtml = totalPlayers > 0
            ? `<div class="group-estimate">${totalPlayers} players signed up — Can form <strong>${possibleGroups}</strong> group${possibleGroups !== 1 ? 's' : ''}${possibleGroups > 0 ? '' : ' yet'}</div>`
            : '';

        rv.innerHTML = `
            <div style="grid-column: 1 / -1;">${summaryHtml}${needsHtml}</div>
            <div class="roster-col"><h4 style="color:${ROLE_COLORS.Tank}">TANKS</h4><div class="count">${tanks.length} signed up</div><div id="tankList"></div></div>
            <div class="roster-col"><h4 style="color:${ROLE_COLORS.Healer}">HEALERS</h4><div class="count">${healers.length} signed up</div><div id="healList"></div></div>
            <div class="roster-col"><h4 style="color:#ABD473">DPS</h4><div class="count">${dps.length} signed up</div><div id="dpsList"></div></div>
        `;
        tanks.forEach(p => document.getElementById("tankList").appendChild(this._playerDiv(p)));
        healers.forEach(p => document.getElementById("healList").appendChild(this._playerDiv(p)));
        dps.forEach(p => document.getElementById("dpsList").appendChild(this._playerDiv(p)));
    },

    renderRaidRoster(players) {
        const rv = document.getElementById("raidRosterView");
        const tanks = players.filter(p => p.role === "Tank");
        const healers = players.filter(p => p.role === "Healer");
        const dps = players.filter(p => p.role === "Melee" || p.role === "Ranged");

        const mainTanks = tanks.slice(0, 2);
        const backupTanks = tanks.slice(2);

        let html = `<div class="raid-summary">${players.length} signed up for Raid</div>`;

        // Tanks section
        html += '<div class="raid-role-section"><h4 style="color:' + ROLE_COLORS.Tank + '">TANKS <span class="raid-slots">' + Math.min(tanks.length, 2) + '/2</span></h4>';
        html += '<div class="raid-player-list" id="raidTankList"></div>';
        if (backupTanks.length > 0) {
            html += '<div class="raid-backup-label">Backup Tanks</div>';
            html += '<div class="raid-player-list" id="raidBackupTankList"></div>';
        }
        html += '</div>';

        // Healers section
        html += '<div class="raid-role-section"><h4 style="color:' + ROLE_COLORS.Healer + '">HEALERS <span class="raid-slots">' + healers.length + '</span></h4>';
        html += '<div class="raid-player-list" id="raidHealList"></div></div>';

        // DPS section
        html += '<div class="raid-role-section"><h4 style="color:#ABD473">DPS <span class="raid-slots">' + dps.length + '</span></h4>';
        html += '<div class="raid-player-list" id="raidDpsList"></div></div>';

        rv.innerHTML = html;

        mainTanks.forEach(p => document.getElementById("raidTankList").appendChild(this._playerDiv(p, "raid")));
        if (backupTanks.length > 0) {
            backupTanks.forEach(p => {
                const div = this._playerDiv(p, "raid");
                div.classList.add("backup-tank");
                document.getElementById("raidBackupTankList").appendChild(div);
            });
        }
        healers.forEach(p => document.getElementById("raidHealList").appendChild(this._playerDiv(p, "raid")));
        dps.forEach(p => document.getElementById("raidDpsList").appendChild(this._playerDiv(p, "raid")));
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

    _playerDiv(p, eventType = "mythicplus") {
        const cls = p.wow_class || p.cls;
        const div = document.createElement("div"); div.className = "player";
        div.dataset.role = p.role; div.dataset.cls = cls;
        div.dataset.username = p.username; div.dataset.spec = p.specialization || "";
        div.dataset.eventType = eventType;

        const signupNum = (p.signup_number != null && p.signup_number > 0) ? `<span class="signup-num" title="Signed up #${p.signup_number}">#${p.signup_number}</span>` : '';
        const statusBadge = this._statusBadge(p);
        const benchBadge = p.bench_priority ? '<span class="bench-priority-badge" title="Bench priority">&#9733;</span>' : '';
        const evtParam = eventType === "raid" ? "raid" : "mythicplus";

        div.innerHTML = `
            <span class="player-name" style="color:${CLASS_COLORS[cls] || '#FFF'}">${signupNum}${benchBadge}${p.username}${statusBadge}</span>
            <span class="player-right">
                <span class="player-spec">${p.specialization || cls}</span>
                <button class="player-remove" onclick="App.removePlayer('${p.username.replace(/'/g, "\\'")}', '${evtParam}')" title="Remove ${p.username}">&times;</button>
            </span>
        `;
        return div;
    },

    showLocked() {
        document.getElementById("signupSection").style.display = "none";
        const m = document.getElementById("lockedMessage"); m.style.display = "block";
        m.innerHTML = '<h3>M+ Signups Locked — Groups Formed</h3>';
    },
    showUnlocked() {
        document.getElementById("signupSection").style.display = "block";
        document.getElementById("lockedMessage").style.display = "none";
    },
};
