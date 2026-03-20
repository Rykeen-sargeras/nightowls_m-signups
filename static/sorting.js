const Sorting = {
    autoSort(players) {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const tanks = shuffled.filter(p => p.role === "Tank");
        const healers = shuffled.filter(p => p.role === "Healer");
        const melee = shuffled.filter(p => p.role === "Melee");
        const ranged = shuffled.filter(p => p.role === "Ranged");
        const groups = [];
        while (tanks.length && healers.length && (melee.length + ranged.length) >= 3) {
            const group = [];
            const tank = tanks.shift(); group.push(tank);
            const healer = this._pullUtil(healers, !hasLust(tank.wow_class), !hasBrez(tank.wow_class));
            group.push(healer);
            let gl = hasLust(tank.wow_class) || hasLust(healer.wow_class);
            let gb = hasBrez(tank.wow_class) || hasBrez(healer.wow_class);
            for (let s = 0; s < 3; s++) {
                const pref = s === 0 ? true : s === 1 ? false : null;
                const dps = this._pullDPS(melee, ranged, !gl, !gb, pref);
                if (dps) { group.push(dps); gl = gl || hasLust(dps.wow_class); gb = gb || hasBrez(dps.wow_class); }
            }
            groups.push(group);
        }
        return { groups, bench: [...tanks, ...healers, ...melee, ...ranged] };
    },
    _pullUtil(pool, nL, nB) { const i = this._findUtil(pool, nL, nB); return i > -1 ? pool.splice(i, 1)[0] : pool.shift(); },
    _findUtil(pool, nL, nB) {
        for (let i = 0; i < pool.length; i++) { if (nL && hasLust(pool[i].wow_class) && nB && hasBrez(pool[i].wow_class)) return i; }
        for (let i = 0; i < pool.length; i++) { if ((nL && hasLust(pool[i].wow_class)) || (nB && hasBrez(pool[i].wow_class))) return i; }
        return -1;
    },
    _pullDPS(melee, ranged, nL, nB, pref) {
        let pri, sec;
        if (pref === true) { pri = melee; sec = ranged; } else if (pref === false) { pri = ranged; sec = melee; }
        else { pri = melee.length >= ranged.length ? melee : ranged; sec = melee.length >= ranged.length ? ranged : melee; }
        if (nL || nB) { for (const p of [pri, sec]) { const i = this._findUtil(p, nL, nB); if (i > -1) return p.splice(i, 1)[0]; } }
        if (pri.length) return pri.shift(); if (sec.length) return sec.shift(); return null;
    },
};
