"""
NightOwls Smart Group Sorting — V6
- Builds 5-man M+ groups: 1 Tank, 1 Healer, 3 DPS
- BENCH PRIORITY: Players benched last week get guaranteed placement (never benched twice in a row)
- Prioritizes Lust + Brez coverage per group
- After utility is satisfied, fills by signup order (first come first served)
"""
from app.models.schemas import has_lust, has_brez


def auto_sort(players: list[dict], bench_priority_names: set[str] = None) -> dict:
    """
    Takes a list of player dicts with keys:
        username, wow_class, specialization, role, signed_up_at
    Players MUST be pre-sorted by signed_up_at ascending (earliest first).
    bench_priority_names: set of usernames who were benched last week (guaranteed placement).
    Returns { "groups": [ [player, ...], ... ], "bench": [player, ...] }
    """
    if bench_priority_names is None:
        bench_priority_names = set()

    # Mark players with bench priority
    for p in players:
        p["bench_priority"] = p["username"] in bench_priority_names

    # Split into role pools — bench priority players go to the FRONT of each pool
    tanks = _sort_pool([p.copy() for p in players if p["role"] == "Tank"])
    healers = _sort_pool([p.copy() for p in players if p["role"] == "Healer"])
    melee = _sort_pool([p.copy() for p in players if p["role"] == "Melee"])
    ranged = _sort_pool([p.copy() for p in players if p["role"] == "Ranged"])

    groups = []

    while tanks and healers and (len(melee) + len(ranged)) >= 3:
        group = []

        # --- 1. Pick the first Tank (bench priority first, then signup order) ---
        tank = tanks.pop(0)
        group.append(tank)

        # --- 2. Pick a Healer ---
        need_lust = not has_lust(tank["wow_class"])
        need_brez = not has_brez(tank["wow_class"])
        healer = _pull_best_healer(healers, need_lust, need_brez)
        group.append(healer)

        # --- 3. Update what the group still needs ---
        grp_lust = has_lust(tank["wow_class"]) or has_lust(healer["wow_class"])
        grp_brez = has_brez(tank["wow_class"]) or has_brez(healer["wow_class"])

        # --- 4. Fill 3 DPS slots ---
        for _ in range(3):
            still_need_lust = not grp_lust
            still_need_brez = not grp_brez
            dps = _pull_best_dps(melee, ranged, still_need_lust, still_need_brez)
            if dps:
                group.append(dps)
                grp_lust = grp_lust or has_lust(dps["wow_class"])
                grp_brez = grp_brez or has_brez(dps["wow_class"])

        groups.append(group)

    bench = tanks + healers + _merge_by_signup(melee, ranged)
    return {"groups": groups, "bench": bench}


def _sort_pool(pool: list[dict]) -> list[dict]:
    """Bench priority players first (in signup order), then normal (in signup order)."""
    priority = [p for p in pool if p.get("bench_priority")]
    normal = [p for p in pool if not p.get("bench_priority")]
    return priority + normal


def _pull_best_healer(healers: list[dict], need_lust: bool, need_brez: bool) -> dict:
    if not healers:
        return None

    # Bench-priority healer that covers utility
    if need_lust or need_brez:
        for i, h in enumerate(healers):
            if h.get("bench_priority"):
                if (need_lust and has_lust(h["wow_class"])) or (need_brez and has_brez(h["wow_class"])):
                    return healers.pop(i)

    # Covers both gaps
    if need_lust and need_brez:
        for i, h in enumerate(healers):
            if has_lust(h["wow_class"]) and has_brez(h["wow_class"]):
                return healers.pop(i)

    # Covers at least one gap
    if need_lust or need_brez:
        for i, h in enumerate(healers):
            if (need_lust and has_lust(h["wow_class"])) or (need_brez and has_brez(h["wow_class"])):
                return healers.pop(i)

    # First in pool (bench priority already at front)
    return healers.pop(0)


def _pull_best_dps(melee, ranged, need_lust, need_brez):
    if need_lust or need_brez:
        best_idx = None
        best_pool = None
        best_score = None

        for pool in [melee, ranged]:
            for i, p in enumerate(pool):
                covers = False
                if need_lust and need_brez:
                    covers = has_lust(p["wow_class"]) or has_brez(p["wow_class"])
                elif need_lust:
                    covers = has_lust(p["wow_class"])
                elif need_brez:
                    covers = has_brez(p["wow_class"])

                if covers:
                    score = (0 if p.get("bench_priority") else 1, p.get("signed_up_at", ""))
                    if best_score is None or score < best_score:
                        best_idx = i
                        best_pool = pool
                        best_score = score

        if best_pool is not None and best_idx is not None:
            return best_pool.pop(best_idx)

    return _pull_earliest(melee, ranged)


def _pull_earliest(melee, ranged):
    if not melee and not ranged:
        return None
    if not melee:
        return ranged.pop(0)
    if not ranged:
        return melee.pop(0)

    m_score = (0 if melee[0].get("bench_priority") else 1, melee[0].get("signed_up_at", ""))
    r_score = (0 if ranged[0].get("bench_priority") else 1, ranged[0].get("signed_up_at", ""))
    if m_score <= r_score:
        return melee.pop(0)
    else:
        return ranged.pop(0)


def _merge_by_signup(melee, ranged):
    result = []
    i, j = 0, 0
    while i < len(melee) and j < len(ranged):
        if melee[i].get("signed_up_at", "") <= ranged[j].get("signed_up_at", ""):
            result.append(melee[i])
            i += 1
        else:
            result.append(ranged[j])
            j += 1
    result.extend(melee[i:])
    result.extend(ranged[j:])
    return result
