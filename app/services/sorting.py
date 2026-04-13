"""
NightOwls Smart Group Sorting — V5
- Builds 5-man M+ groups: 1 Tank, 1 Healer, 3 DPS
- Prioritizes Lust + Brez coverage per group
- After utility is satisfied, fills by signup order (first come first served)
- No more random shuffle — signup_number determines priority
"""
from app.models.schemas import has_lust, has_brez


def auto_sort(players: list[dict]) -> dict:
    """
    Takes a list of player dicts with keys:
        username, wow_class, specialization, role, signed_up_at
    Players MUST be pre-sorted by signed_up_at ascending (earliest first).
    Returns { "groups": [ [player, ...], ... ], "bench": [player, ...] }
    """
    # Split into role pools — already sorted by signup order
    tanks = [p.copy() for p in players if p["role"] == "Tank"]
    healers = [p.copy() for p in players if p["role"] == "Healer"]
    melee = [p.copy() for p in players if p["role"] == "Melee"]
    ranged = [p.copy() for p in players if p["role"] == "Ranged"]

    groups = []

    while tanks and healers and (len(melee) + len(ranged)) >= 3:
        group = []

        # --- 1. Pick the earliest-signed-up Tank ---
        tank = tanks.pop(0)
        group.append(tank)

        # --- 2. Pick a Healer ---
        # Check what utility the tank already covers
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

    # Everyone left over goes to bench — already in signup order
    bench = tanks + healers + _merge_by_signup(melee, ranged)
    return {"groups": groups, "bench": bench}


def _pull_best_healer(healers: list[dict], need_lust: bool, need_brez: bool) -> dict:
    """
    Pick the best healer for utility coverage.
    Priority: covers BOTH gaps > covers ONE gap > earliest signup.
    Within each priority tier, earliest signup wins.
    """
    if not healers:
        return None

    # Try to find one that covers both
    if need_lust and need_brez:
        for i, h in enumerate(healers):
            if has_lust(h["wow_class"]) and has_brez(h["wow_class"]):
                return healers.pop(i)

    # Try to find one that covers at least one gap
    if need_lust or need_brez:
        for i, h in enumerate(healers):
            if (need_lust and has_lust(h["wow_class"])) or (need_brez and has_brez(h["wow_class"])):
                return healers.pop(i)

    # No utility needed or nobody has it — take the earliest signup
    return healers.pop(0)


def _pull_best_dps(melee: list[dict], ranged: list[dict],
                   need_lust: bool, need_brez: bool) -> dict | None:
    """
    Pick the best DPS for utility coverage.
    If utility is still needed, scan both pools for a provider (earliest signup first).
    If utility is covered, just take the overall earliest signup across both pools.
    """
    # --- Utility needed: find the earliest signup that covers a gap ---
    if need_lust or need_brez:
        best_idx = None
        best_pool = None
        best_time = None

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
                    p_time = p.get("signed_up_at")
                    if best_time is None or (p_time and p_time < best_time):
                        best_idx = i
                        best_pool = pool
                        best_time = p_time

        if best_pool is not None and best_idx is not None:
            return best_pool.pop(best_idx)

    # --- Utility covered (or nobody left has it): earliest signup wins ---
    return _pull_earliest(melee, ranged)


def _pull_earliest(melee: list[dict], ranged: list[dict]) -> dict | None:
    """Pull the player with the earliest signed_up_at from either pool."""
    if not melee and not ranged:
        return None
    if not melee:
        return ranged.pop(0)
    if not ranged:
        return melee.pop(0)

    # Both have players — compare the front of each (already sorted by signup)
    if melee[0].get("signed_up_at", "") <= ranged[0].get("signed_up_at", ""):
        return melee.pop(0)
    else:
        return ranged.pop(0)


def _merge_by_signup(melee: list[dict], ranged: list[dict]) -> list[dict]:
    """Merge two sorted lists into one sorted list by signed_up_at."""
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
