"""Player-specific Mythic+ utility profiles used by the smart sorter.

Only utility confirmed by the player's current specialization and signup flags is
counted. Conditional pet/talent utility is deliberately conservative.
"""
from __future__ import annotations

from typing import Any


def _flag(player: dict, key: str, default: bool = False) -> bool:
    value = player.get(key, default)
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _overrides(player: dict) -> dict[str, bool]:
    raw = player.get("utility_overrides") or {}
    if isinstance(raw, dict):
        return {str(k): _flag({"value": v}, "value") for k, v in raw.items()}
    return {}


def player_capabilities(player: dict) -> dict[str, Any]:
    """Return only the utility this exact player can currently provide."""
    cls = str(player.get("wow_class") or "")
    spec = str(player.get("specialization") or "")
    role = str(player.get("role") or "")
    overrides = _overrides(player)

    caps: dict[str, Any] = {
        "bloodlust": False,
        "battle_rez": False,
        "reliable_interrupt": False,
        "interrupt_kind": "none",
        "offensive_magic_dispel": False,
        "enrage_removal": False,
        "poison_removal": False,
        "disease_removal": False,
        "curse_removal": False,
        "mass_dispel": False,
        "aoe_stun": False,
        "group_defensive": False,
        "group_movement": False,
        "buff_stamina": False,
        "buff_intellect": False,
        "buff_physical": False,
        "buff_magic": False,
        "buff_versatility": False,
        "battle_shout": False,
        "mystic_touch": False,
        "chaos_brand": False,
        "arcane_intellect": False,
        "mark_of_the_wild": False,
        "power_word_fortitude": False,
        "damage_reduction_aura": False,
        "physical_damage": False,
        "magic_damage": False,
    }

    if cls == "Death Knight":
        caps.update(
            battle_rez=True,
            reliable_interrupt=True,
            interrupt_kind="short_melee",
            group_defensive=True,
            physical_damage=True,
            magic_damage=True,
        )
    elif cls == "Demon Hunter":
        caps.update(
            reliable_interrupt=True,
            interrupt_kind="short",
            offensive_magic_dispel=True,
            aoe_stun=True,
            buff_magic=True,
            chaos_brand=True,
            magic_damage=True,
        )
        caps["group_defensive"] = bool(overrides.get("group_defensive", False))
    elif cls == "Druid":
        caps.update(
            battle_rez=True,
            enrage_removal=True,
            poison_removal=True,
            curse_removal=True,
            group_movement=True,
            buff_versatility=True,
            mark_of_the_wild=True,
        )
        if spec in {"Guardian", "Feral"}:
            caps.update(reliable_interrupt=True, interrupt_kind="short_melee")
        elif spec == "Balance":
            caps["interrupt_kind"] = "long_aoe_silence"
        if spec in {"Guardian", "Feral"}:
            caps["physical_damage"] = True
        else:
            caps["magic_damage"] = True
    elif cls == "Evoker":
        caps.update(
            bloodlust=True,
            poison_removal=True,
            group_defensive=True,
            magic_damage=True,
        )
        if spec in {"Devastation", "Augmentation"}:
            caps.update(reliable_interrupt=True, interrupt_kind="medium_ranged")
    elif cls == "Hunter":
        caps.update(
            bloodlust=_flag(player, "can_provide_lust", False),
            reliable_interrupt=True,
            interrupt_kind="short_melee" if spec == "Survival" else "medium_ranged",
            offensive_magic_dispel=True,
            enrage_removal=True,
            physical_damage=True,
        )
    elif cls == "Mage":
        caps.update(
            bloodlust=True,
            reliable_interrupt=True,
            interrupt_kind="medium_ranged",
            offensive_magic_dispel=True,
            curse_removal=True,
            buff_intellect=True,
            arcane_intellect=True,
            magic_damage=True,
        )
    elif cls == "Monk":
        caps.update(
            poison_removal=True,
            disease_removal=True,
            aoe_stun=True,
            buff_physical=True,
            mystic_touch=True,
            physical_damage=spec in {"Brewmaster", "Windwalker"},
            magic_damage=spec == "Mistweaver",
        )
        if spec in {"Brewmaster", "Windwalker"}:
            caps.update(reliable_interrupt=True, interrupt_kind="short_melee")
    elif cls == "Paladin":
        caps.update(
            battle_rez=True,
            poison_removal=True,
            disease_removal=True,
            group_defensive=True,
            damage_reduction_aura=True,
            physical_damage=spec in {"Protection", "Retribution"},
            magic_damage=spec == "Holy",
        )
        if spec in {"Protection", "Retribution"}:
            caps.update(reliable_interrupt=True, interrupt_kind="short_melee")
    elif cls == "Priest":
        caps.update(
            offensive_magic_dispel=True,
            disease_removal=True,
            mass_dispel=True,
            buff_stamina=True,
            power_word_fortitude=True,
            magic_damage=True,
        )
        if spec == "Shadow":
            caps["interrupt_kind"] = "long_ranged"
        else:
            caps["group_defensive"] = True
    elif cls == "Rogue":
        caps.update(
            reliable_interrupt=True,
            interrupt_kind="short_melee",
            enrage_removal=True,
            physical_damage=True,
        )
    elif cls == "Shaman":
        caps.update(
            bloodlust=True,
            reliable_interrupt=True,
            interrupt_kind="short_ranged",
            offensive_magic_dispel=True,
            poison_removal=True,
            curse_removal=True,
            aoe_stun=True,
            group_movement=True,
            magic_damage=spec != "Enhancement",
            physical_damage=spec == "Enhancement",
        )
    elif cls == "Warlock":
        caps.update(
            battle_rez=True,
            reliable_interrupt=_flag(player, "can_interrupt", False),
            interrupt_kind="pet_dependent" if _flag(player, "can_interrupt", False) else "none",
            aoe_stun=True,
            buff_intellect=False,
            magic_damage=True,
        )
        caps["offensive_magic_dispel"] = bool(overrides.get("offensive_magic_dispel", False))
    elif cls == "Warrior":
        caps.update(
            reliable_interrupt=True,
            interrupt_kind="short_melee",
            aoe_stun=True,
            group_defensive=True,
            buff_physical=True,
            battle_shout=True,
            physical_damage=True,
        )

    # Explicit admin-confirmed talent overrides can add or remove conditional utility.
    for key, value in overrides.items():
        if key in caps:
            caps[key] = bool(value)

    # Role is authoritative for composition; damage profile only affects synergy.
    caps["position"] = "melee" if role == "Melee" else "ranged" if role == "Ranged" else role.lower()
    return caps


def score_group(group: list[dict]) -> tuple[int, dict[str, Any]]:
    """Score a legal 1/1/3 group using the user's requested weights."""
    caps = [player_capabilities(p) for p in group]
    dps = [p for p in group if p.get("role") in {"Melee", "Ranged"}]
    melee_count = sum(p.get("role") == "Melee" for p in dps)
    ranged_count = sum(p.get("role") == "Ranged" for p in dps)

    has_lust = any(c["bloodlust"] for c in caps)
    has_brez = any(c["battle_rez"] for c in caps)
    interrupts = sum(bool(c["reliable_interrupt"]) for c in caps)

    score = 0
    if has_lust:
        score += 40
    if has_brez:
        score += 40

    # Two reliable kicks is the baseline. Three and four receive the requested bonuses.
    if interrupts == 0:
        score -= 30
    elif interrupts == 1:
        score -= 15
    elif interrupts >= 3:
        score += 20
        if interrupts >= 4:
            score += 12

    if (melee_count, ranged_count) == (2, 1):
        position_score = 25
    elif (melee_count, ranged_count) == (1, 2):
        position_score = 20
    elif (melee_count, ranged_count) == (0, 3):
        position_score = -15
    elif (melee_count, ranged_count) == (3, 0):
        position_score = -20
    else:
        position_score = 0
    score += position_score

    utility_checks = (
        ("offensive_magic_dispel", 12),
        ("enrage_removal", 12),
        ("poison_removal", 10),
        ("disease_removal", 8),
        ("curse_removal", 8),
        ("mass_dispel", 15),
        ("aoe_stun", 10),
        ("group_defensive", 8),
        ("group_movement", 6),
    )
    for key, points in utility_checks:
        if any(c[key] for c in caps):
            score += points

    physical_count = sum(bool(c["physical_damage"]) for c in caps)
    magic_count = sum(bool(c["magic_damage"]) for c in caps)
    synergy_score = 0
    if any(c["battle_shout"] for c in caps) and physical_count >= 2:
        synergy_score += 8
    if any(c["mystic_touch"] for c in caps) and physical_count >= 2:
        synergy_score += 8
    if any(c["arcane_intellect"] for c in caps) and magic_count >= 2:
        synergy_score += 8
    if any(c["chaos_brand"] for c in caps) and magic_count >= 2:
        synergy_score += 8
    if any(c["mark_of_the_wild"] for c in caps):
        synergy_score += 8
    if any(c["power_word_fortitude"] for c in caps):
        synergy_score += 8
    if any(c["damage_reduction_aura"] for c in caps):
        synergy_score += 8
    score += synergy_score

    metrics = {
        "score": score,
        "has_lust": has_lust,
        "has_brez": has_brez,
        "reliable_interrupts": interrupts,
        "melee_dps": melee_count,
        "ranged_dps": ranged_count,
        "position_score": position_score,
        "synergy_score": synergy_score,
    }
    return score, metrics
