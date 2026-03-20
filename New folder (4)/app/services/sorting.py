"""
NightOwls Smart Group Sorting — V4
Builds 5-man M+ groups: 1 Tank, 1 Healer, 3 DPS
Prioritizes Lust + Brez per group, balances melee/ranged, shuffles for fairness.
"""
import random
from app.models.schemas import has_lust, has_brez


def auto_sort(players: list[dict]) -> dict:
    players = [p.copy() for p in players]
    random.shuffle(players)

    tanks = [p for p in players if p["role"] == "Tank"]
    healers = [p for p in players if p["role"] == "Healer"]
    melee = [p for p in players if p["role"] == "Melee"]
    ranged = [p for p in players if p["role"] == "Ranged"]

    groups = []

    while tanks and healers and (len(melee) + len(ranged)) >= 3:
        group = []
        tank = tanks.pop(0)
        group.append(tank)

        healer = _pull_utility(healers, not has_lust(tank["wow_class"]), not has_brez(tank["wow_class"]))
        group.append(healer)

        g_lust = has_lust(tank["wow_class"]) or has_lust(healer["wow_class"])
        g_brez = has_brez(tank["wow_class"]) or has_brez(healer["wow_class"])

        for slot in range(3):
            prefer = True if slot == 0 else (False if slot == 1 else None)
            dps = _pull_dps(melee, ranged, not g_lust, not g_brez, prefer)
            if dps:
                group.append(dps)
                g_lust = g_lust or has_lust(dps["wow_class"])
                g_brez = g_brez or has_brez(dps["wow_class"])

        groups.append(group)

    bench = tanks + healers + melee + ranged
    return {"groups": groups, "bench": bench}


def _pull_utility(pool, need_lust, need_brez):
    idx = _find_utility(pool, need_lust, need_brez)
    return pool.pop(idx) if idx > -1 else pool.pop(0)


def _find_utility(pool, need_lust, need_brez):
    for i, p in enumerate(pool):
        if need_lust and has_lust(p["wow_class"]) and need_brez and has_brez(p["wow_class"]):
            return i
    for i, p in enumerate(pool):
        if (need_lust and has_lust(p["wow_class"])) or (need_brez and has_brez(p["wow_class"])):
            return i
    return -1


def _pull_dps(melee, ranged, need_lust, need_brez, prefer_melee):
    if prefer_melee is True:
        pri, sec = melee, ranged
    elif prefer_melee is False:
        pri, sec = ranged, melee
    else:
        pri, sec = (melee, ranged) if len(melee) >= len(ranged) else (ranged, melee)

    if need_lust or need_brez:
        for pool in [pri, sec]:
            idx = _find_utility(pool, need_lust, need_brez)
            if idx > -1:
                return pool.pop(idx)

    if pri:
        return pri.pop(0)
    if sec:
        return sec.pop(0)
    return None
