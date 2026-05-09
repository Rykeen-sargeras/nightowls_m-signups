"""
NightOwls Smart Group Sorting — V7
- Builds 5-man M+ groups: 1 Tank, 1 Healer, 3 DPS
- BENCH PRIORITY: Players benched last week get guaranteed placement
- Only sorts "available" players — tentative/late go to bench
- Prioritizes Lust + Brez, then signup order
"""
from app.models.schemas import has_lust, has_brez


def auto_sort(players: list[dict], bench_priority_names: set[str] = None) -> dict:
    if bench_priority_names is None:
        bench_priority_names = set()

    # Separate available vs tentative/late
    # Treat None/empty signup_status as "available"
    available = []
    status_bench = []
    for p in players:
        p["bench_priority"] = p["username"] in bench_priority_names
        status = (p.get("signup_status") or "available").strip().lower()
        if status in ("tentative", "late"):
            status_bench.append(p.copy())
        else:
            available.append(p.copy())

    tanks = _sort_pool([p for p in available if p["role"] == "Tank"])
    healers = _sort_pool([p for p in available if p["role"] == "Healer"])
    melee = _sort_pool([p for p in available if p["role"] == "Melee"])
    ranged = _sort_pool([p for p in available if p["role"] == "Ranged"])

    groups = []

    # Build full 5-man groups: need 1 tank + 1 healer + 3 DPS minimum
    while tanks and healers and (len(melee) + len(ranged)) >= 3:
        group = []

        # 1. Tank
        tank = tanks.pop(0)
        group.append(tank)

        # 2. Healer — prefer one that fills missing utility
        need_lust = not has_lust(tank["wow_class"])
        need_brez = not has_brez(tank["wow_class"])
        healer = _pull_best_healer(healers, need_lust, need_brez)
        group.append(healer)

        # 3. Track group utility
        grp_lust = has_lust(tank["wow_class"]) or has_lust(healer["wow_class"])
        grp_brez = has_brez(tank["wow_class"]) or has_brez(healer["wow_class"])

        # 4. Fill exactly 3 DPS
        for _ in range(3):
            dps = _pull_best_dps(melee, ranged, not grp_lust, not grp_brez)
            if dps:
                group.append(dps)
                grp_lust = grp_lust or has_lust(dps["wow_class"])
                grp_brez = grp_brez or has_brez(dps["wow_class"])

        # Only add the group if it has at least 3 members
        if len(group) >= 3:
            groups.append(group)
        else:
            # Put them all back to bench
            for p in group:
                status_bench.append(p)

    # All leftovers + tentative/late go to bench
    bench = tanks + healers + _merge_by_signup(melee, ranged) + status_bench
    return {"groups": groups, "bench": bench}


def _sort_pool(pool):
    priority = [p for p in pool if p.get("bench_priority")]
    normal = [p for p in pool if not p.get("bench_priority")]
    return priority + normal


def _pull_best_healer(healers, need_lust, need_brez):
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
    # Utility needed: find earliest that covers a gap
    if need_lust or need_brez:
        best_idx, best_pool, best_score = None, None, None
        for pool in [melee, ranged]:
            for i, p in enumerate(pool):
                covers = (need_lust and has_lust(p["wow_class"])) or (need_brez and has_brez(p["wow_class"]))
                if covers:
                    score = (0 if p.get("bench_priority") else 1, p.get("signed_up_at", ""))
                    if best_score is None or score < best_score:
                        best_idx, best_pool, best_score = i, pool, score
        if best_pool is not None:
            return best_pool.pop(best_idx)

    # Utility covered — take earliest
    return _pull_earliest(melee, ranged)


def _pull_earliest(melee, ranged):
    if not melee and not ranged: return None
    if not melee: return ranged.pop(0)
    if not ranged: return melee.pop(0)
    m = (0 if melee[0].get("bench_priority") else 1, melee[0].get("signed_up_at", ""))
    r = (0 if ranged[0].get("bench_priority") else 1, ranged[0].get("signed_up_at", ""))
    return melee.pop(0) if m <= r else ranged.pop(0)


def _merge_by_signup(melee, ranged):
    result, i, j = [], 0, 0
    while i < len(melee) and j < len(ranged):
        if melee[i].get("signed_up_at", "") <= ranged[j].get("signed_up_at", ""):
            result.append(melee[i]); i += 1
        else:
            result.append(ranged[j]); j += 1
    result.extend(melee[i:]); result.extend(ranged[j:])
    return result
