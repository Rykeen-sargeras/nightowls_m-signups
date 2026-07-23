"""Constraint-safe Mythic+ smart group sorter.

Non-negotiable rules are validated before any group is returned:
- exactly one Tank, one Healer and three DPS;
- no player appears more than once;
- no blocked pair appears in the same group;
- each player's role is derived from the specialization they selected.

Optimization order:
1. form the largest feasible number of complete groups;
2. place as many previous-week bench-priority players as constraints allow;
3. maximize requested utility, interrupt and melee/ranged scoring;
4. use signup order as the final tie-breaker.
"""
from __future__ import annotations

from itertools import combinations
import json
from typing import Iterable, Sequence

from app.models.schemas import VALID_SPECS
from app.services.utility import player_capabilities, score_group

VALID_ROLES = {"Tank", "Healer", "Melee", "Ranged"}
DPS_ROLES = {"Melee", "Ranged"}
ROLE_ALIASES = {
    "tank": "Tank",
    "healer": "Healer",
    "heal": "Healer",
    "melee": "Melee",
    "melee dps": "Melee",
    "ranged": "Ranged",
    "range": "Ranged",
    "ranged dps": "Ranged",
}

# The two-stage search avoids the previous combinatorial explosion. Tank/healer
# shells are chosen first, then three-DPS packages are assigned to those shells.
SHELL_BEAM_WIDTH = 600
MAX_SHELL_ARRANGEMENTS = 30
INITIAL_SHELL_ATTEMPTS = 4
DPS_BEAM_WIDTH = 350
DPS_EXPANSIONS_PER_STATE = 50


def auto_sort(
    players: list[dict],
    bench_priority_names: set[str] | None = None,
    blocked_pairs: Iterable[Sequence[str]] | None = None,
) -> dict:
    """Sort player dictionaries into legal complete groups and a bench."""
    priority_keys = {_name_key(name) for name in (bench_priority_names or set()) if name}
    block_set = _normalise_blocked_pairs(blocked_pairs)

    available: list[dict] = []
    forced_bench: list[dict] = []
    seen_names: set[str] = set()

    for source_order, original in enumerate(players):
        player = original.copy()
        username = str(player.get("username") or "").strip()
        player["username"] = username
        player["_key"] = _name_key(username)
        player["_source_order"] = source_order
        player["bench_priority"] = player["_key"] in priority_keys

        if not player["_key"] or player["_key"] in seen_names:
            player["bench_reason"] = "duplicate_player"
            forced_bench.append(player)
            continue
        seen_names.add(player["_key"])

        _merge_player_blocks(block_set, player)
        role = selected_role_for_player(player)
        player["role"] = role

        status = str(player.get("signup_status") or "available").strip().lower()
        if status in {"tentative", "late"}:
            player["bench_reason"] = status
            forced_bench.append(player)
        elif role not in VALID_ROLES:
            player["bench_reason"] = "invalid_selected_role"
            forced_bench.append(player)
        else:
            available.append(player)

    tanks = _sorted_pool(p for p in available if p["role"] == "Tank")
    healers = _sorted_pool(p for p in available if p["role"] == "Healer")
    dps = _sorted_pool(p for p in available if p["role"] in DPS_ROLES)

    theoretical_groups = min(len(tanks), len(healers), len(dps) // 3)
    groups: list[list[dict]] = []

    for target in range(theoretical_groups, 0, -1):
        shell_arrangements = _build_shell_arrangements(tanks, healers, dps, block_set, target)
        if not shell_arrangements:
            continue

        trio_cache: dict[tuple[str, str], list[dict]] = {}
        best_solution: dict | None = None
        priority_upper_bound = (
            min(target, sum(bool(player.get("bench_priority")) for player in tanks))
            + min(target, sum(bool(player.get("bench_priority")) for player in healers))
            + min(3 * target, sum(bool(player.get("bench_priority")) for player in dps))
        )
        for attempt_index, shells in enumerate(shell_arrangements):
            solution = _assign_dps(shells, dps, block_set, trio_cache)
            if solution is not None and (
                best_solution is None or _solution_rank(solution) > _solution_rank(best_solution)
            ):
                best_solution = solution
            # Compare several top shell arrangements for utility. If none work,
            # continue through the larger fallback list before reducing group count.
            if (
                best_solution is not None
                and best_solution["priority"] >= priority_upper_bound
                and attempt_index + 1 >= INITIAL_SHELL_ATTEMPTS
            ):
                break

        if best_solution is not None:
            groups = best_solution["groups"]
            break

    groups.sort(key=_group_sort_key)
    if groups and not validate_hard_constraints(groups, block_set):
        groups = []

    grouped_keys = {_name_key(p.get("username")) for group in groups for p in group}
    bench = [p for p in available if p["_key"] not in grouped_keys]
    for player in bench:
        player.setdefault("bench_reason", "capacity_or_constraints")
    bench.extend(forced_bench)
    bench = _sorted_bench(bench)

    priority_grouped = sorted(
        p["username"] for group in groups for p in group if p.get("bench_priority")
    )
    priority_deferred = sorted(
        p["username"]
        for p in bench
        if p.get("bench_priority")
        and str(p.get("signup_status") or "available").lower() == "available"
        and p.get("bench_reason") != "duplicate_player"
    )

    public_groups: list[list[dict]] = []
    group_metrics: list[dict] = []
    for group in groups:
        ordered = sorted(group, key=_member_display_key)
        _, metrics = score_group(ordered)
        public_groups.append([_public_player(p) for p in ordered])
        group_metrics.append(metrics)

    return {
        "groups": public_groups,
        "bench": [_public_player(p) for p in bench],
        "group_metrics": group_metrics,
        "hard_constraints_validated": validate_hard_constraints(groups, block_set),
        "theoretical_group_count": theoretical_groups,
        "priority_grouped": priority_grouped,
        "priority_deferred": priority_deferred,
    }


def validate_hard_constraints(
    groups: list[list[dict]],
    blocked_pairs: Iterable[Sequence[str]] | set[frozenset[str]] | None = None,
) -> bool:
    """Return True only when every non-negotiable rule is satisfied."""
    block_set = blocked_pairs if isinstance(blocked_pairs, set) else _normalise_blocked_pairs(blocked_pairs)
    seen: set[str] = set()

    for group in groups:
        if len(group) != 5:
            return False
        if sum(p.get("role") == "Tank" for p in group) != 1:
            return False
        if sum(p.get("role") == "Healer" for p in group) != 1:
            return False
        if sum(p.get("role") in DPS_ROLES for p in group) != 3:
            return False

        keys = [_name_key(p.get("username", "")) for p in group]
        if any(not key for key in keys) or len(keys) != len(set(keys)):
            return False
        if seen.intersection(keys):
            return False
        seen.update(keys)

        if any(frozenset((a, b)) in block_set for a, b in combinations(keys, 2)):
            return False
        if any(selected_role_for_player(player) != player.get("role") for player in group):
            return False

    return True


def selected_role_for_player(player: dict) -> str:
    """Return the role selected through class/spec; never silently role-swap."""
    wow_class = str(player.get("wow_class") or "")
    specialization = str(player.get("specialization") or "")
    derived = VALID_SPECS.get(wow_class, {}).get(specialization)
    if derived in VALID_ROLES:
        return derived

    raw_role = str(player.get("role") or "").strip()
    alias = ROLE_ALIASES.get(raw_role.lower(), raw_role)
    selected_roles = player.get("selected_roles")
    if isinstance(selected_roles, (list, tuple, set)):
        allowed = {
            ROLE_ALIASES.get(str(role).strip().lower(), str(role).strip())
            for role in selected_roles
        }
        return alias if alias in allowed and alias in VALID_ROLES else ""
    return alias if alias in VALID_ROLES else ""


def _build_shell_arrangements(
    tanks: list[dict],
    healers: list[dict],
    dps: list[dict],
    block_set: set[frozenset[str]],
    target: int,
) -> list[list[dict]]:
    pairs: list[dict] = []
    for tank in tanks:
        for healer in healers:
            if _players_blocked(tank, healer, block_set):
                continue
            compatible_players = [
                player
                for player in dps
                if not _players_blocked(tank, player, block_set)
                and not _players_blocked(healer, player, block_set)
            ]
            compatible_count = len(compatible_players)
            if compatible_count < 3:
                continue
            priority_dps_capacity = min(
                3, sum(bool(player.get("bench_priority")) for player in compatible_players)
            )
            pairs.append({
                "tank": tank,
                "healer": healer,
                "tank_key": tank["_key"],
                "healer_key": healer["_key"],
                "priority": int(bool(tank.get("bench_priority"))) + int(bool(healer.get("bench_priority"))),
                "seed_score": _pair_seed_score(tank, healer),
                "compatible_count": compatible_count,
                "priority_dps_capacity": priority_dps_capacity,
                "signup": -int(tank.get("_source_order", 0)) - int(healer.get("_source_order", 0)),
            })

    pairs.sort(key=_pair_rank, reverse=True)
    states = [{
        "pair_indexes": (),
        "used_tanks": frozenset(),
        "used_healers": frozenset(),
        "priority": 0,
        "seed_score": 0,
        "min_compat": len(dps),
        "compat_total": 0,
        "priority_dps_capacity": 0,
        "signup": 0,
        "last_index": -1,
    }]

    for _ in range(target):
        next_states: list[dict] = []
        for state in states:
            for index in range(state["last_index"] + 1, len(pairs)):
                pair = pairs[index]
                if pair["tank_key"] in state["used_tanks"] or pair["healer_key"] in state["used_healers"]:
                    continue
                next_states.append({
                    "pair_indexes": state["pair_indexes"] + (index,),
                    "used_tanks": state["used_tanks"] | {pair["tank_key"]},
                    "used_healers": state["used_healers"] | {pair["healer_key"]},
                    "priority": state["priority"] + pair["priority"],
                    "seed_score": state["seed_score"] + pair["seed_score"],
                    "min_compat": min(state["min_compat"], pair["compatible_count"]),
                    "compat_total": state["compat_total"] + pair["compatible_count"],
                    "priority_dps_capacity": state["priority_dps_capacity"] + pair["priority_dps_capacity"],
                    "signup": state["signup"] + pair["signup"],
                    "last_index": index,
                })
        if not next_states:
            return []
        next_states.sort(key=_shell_state_rank, reverse=True)
        states = next_states[:SHELL_BEAM_WIDTH]

    states.sort(key=_shell_state_rank, reverse=True)
    return [[pairs[index] for index in state["pair_indexes"]] for state in states[:MAX_SHELL_ARRANGEMENTS]]


def _assign_dps(
    shells: list[dict],
    dps: list[dict],
    block_set: set[frozenset[str]],
    trio_cache: dict[tuple[str, str], list[dict]],
) -> dict | None:
    indexed_shells: list[tuple[int, dict, list[dict]]] = []
    for shell_index, shell in enumerate(shells):
        cache_key = (shell["tank_key"], shell["healer_key"])
        candidates = trio_cache.get(cache_key)
        if candidates is None:
            candidates = _build_trio_candidates(shell, dps, block_set)
            trio_cache[cache_key] = candidates
        if not candidates:
            return None
        indexed_shells.append((shell_index, shell, candidates))

    # Fill the most constrained shells first to avoid painting later groups into a corner.
    indexed_shells.sort(key=lambda item: (len(item[2]), item[1]["compatible_count"]))
    base_priority = sum(shell["priority"] for shell in shells)
    base_signup = sum(shell["signup"] for shell in shells)
    states = [{
        "assigned": {},
        "used_dps": frozenset(),
        "priority": base_priority,
        "score": 0,
        "signup": base_signup,
    }]

    for shell_index, _shell, candidates in indexed_shells:
        next_by_used: dict[frozenset[str], dict] = {}
        for state in states:
            expanded = 0
            for candidate in candidates:
                if state["used_dps"].intersection(candidate["keys"]):
                    continue
                new_used = state["used_dps"] | candidate["keys"]
                new_state = {
                    "assigned": {**state["assigned"], shell_index: candidate},
                    "used_dps": new_used,
                    "priority": state["priority"] + candidate["priority"],
                    "score": state["score"] + candidate["score"],
                    "signup": state["signup"] + candidate["signup"],
                }
                existing = next_by_used.get(new_used)
                if existing is None or _dps_state_rank(new_state) > _dps_state_rank(existing):
                    next_by_used[new_used] = new_state
                expanded += 1
                if expanded >= DPS_EXPANSIONS_PER_STATE:
                    break
        if not next_by_used:
            return None
        states = sorted(next_by_used.values(), key=_dps_state_rank, reverse=True)[:DPS_BEAM_WIDTH]

    best = max(states, key=_dps_state_rank)
    groups: list[list[dict]] = []
    for shell_index, shell in enumerate(shells):
        trio = best["assigned"][shell_index]
        groups.append([shell["tank"], shell["healer"], *trio["players"]])

    return {
        "groups": groups,
        "priority": best["priority"],
        "score": best["score"],
        "signup": best["signup"],
    }


def _build_trio_candidates(
    shell: dict,
    dps: list[dict],
    block_set: set[frozenset[str]],
) -> list[dict]:
    tank, healer = shell["tank"], shell["healer"]
    compatible = [
        player
        for player in dps
        if not _players_blocked(tank, player, block_set)
        and not _players_blocked(healer, player, block_set)
    ]
    candidates: list[dict] = []
    for trio in combinations(compatible, 3):
        if _contains_blocked_pair(trio, block_set):
            continue
        score, _metrics = score_group([tank, healer, *trio])
        candidates.append({
            "players": trio,
            "keys": frozenset(player["_key"] for player in trio),
            "priority": sum(int(bool(player.get("bench_priority"))) for player in trio),
            "score": score,
            "signup": -sum(int(player.get("_source_order", 0)) for player in trio),
            "signature": tuple(sorted(player["_key"] for player in trio)),
        })
    candidates.sort(key=_trio_rank, reverse=True)
    return candidates


def _pair_seed_score(tank: dict, healer: dict) -> int:
    caps = [player_capabilities(tank), player_capabilities(healer)]
    score = 0
    if any(cap["bloodlust"] for cap in caps):
        score += 40
    if any(cap["battle_rez"] for cap in caps):
        score += 40
    score += 6 * sum(bool(cap["reliable_interrupt"]) for cap in caps)
    score += 5 * sum(bool(cap["group_defensive"]) for cap in caps)
    return score


def _pair_rank(pair: dict) -> tuple:
    return (
        pair["priority"],
        pair["priority_dps_capacity"],
        pair["seed_score"],
        pair["compatible_count"],
        pair["signup"],
        pair["tank_key"],
        pair["healer_key"],
    )


def _shell_state_rank(state: dict) -> tuple:
    return (
        state["priority"],
        state["priority_dps_capacity"],
        state["seed_score"],
        state["min_compat"],
        state["compat_total"],
        state["signup"],
    )


def _trio_rank(candidate: dict) -> tuple:
    return (
        candidate["priority"],
        candidate["score"],
        candidate["signup"],
        tuple(reversed(candidate["signature"])),
    )


def _dps_state_rank(state: dict) -> tuple:
    return (state["priority"], state["score"], state["signup"])


def _solution_rank(solution: dict) -> tuple:
    return (solution["priority"], solution["score"], solution["signup"])


def _normalise_blocked_pairs(
    blocked_pairs: Iterable[Sequence[str]] | None,
) -> set[frozenset[str]]:
    result: set[frozenset[str]] = set()
    for pair in blocked_pairs or []:
        if isinstance(pair, str):
            parts = [part.strip() for part in pair.replace("|", ",").split(",")]
        else:
            try:
                parts = [str(part).strip() for part in pair]
            except TypeError:
                continue
        keys = [_name_key(part) for part in parts if _name_key(part)]
        if len(keys) >= 2 and keys[0] != keys[1]:
            result.add(frozenset((keys[0], keys[1])))
    return result


def _merge_player_blocks(block_set: set[frozenset[str]], player: dict) -> None:
    raw = player.get("blocked_players", player.get("blocked_with", []))
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
            raw = decoded if isinstance(decoded, list) else raw.split(",")
        except json.JSONDecodeError:
            raw = raw.split(",")
    if not isinstance(raw, (list, tuple, set)):
        return
    for other in raw:
        other_key = _name_key(other)
        if other_key and other_key != player["_key"]:
            block_set.add(frozenset((player["_key"], other_key)))


def _contains_blocked_pair(players: Iterable[dict], block_set: set[frozenset[str]]) -> bool:
    keys = [player["_key"] for player in players]
    return any(frozenset((a, b)) in block_set for a, b in combinations(keys, 2))


def _players_blocked(a: dict, b: dict, block_set: set[frozenset[str]]) -> bool:
    return frozenset((a["_key"], b["_key"])) in block_set


def _sorted_pool(players: Iterable[dict]) -> list[dict]:
    return sorted(players, key=_placement_key)


def _placement_key(player: dict) -> tuple:
    return (
        0 if player.get("bench_priority") else 1,
        player.get("signed_up_at") or "",
        player.get("_source_order", 0),
        player.get("username", "").casefold(),
    )


def _sorted_bench(players: list[dict]) -> list[dict]:
    return sorted(players, key=_placement_key)


def _member_display_key(player: dict) -> tuple:
    role_order = {"Tank": 0, "Healer": 1, "Melee": 2, "Ranged": 3}
    return (role_order.get(player.get("role"), 9), player.get("_source_order", 0))


def _group_sort_key(group: list[dict]) -> tuple:
    return (min((player.get("_source_order", 0) for player in group), default=0),)


def _name_key(value: object) -> str:
    return str(value or "").strip().casefold()


def _public_player(player: dict) -> dict:
    result = player.copy()
    result.pop("_source_order", None)
    result.pop("_key", None)
    return result
