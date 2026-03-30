from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

VALID_SPECS: dict[str, dict[str, str]] = {
    "Death Knight": {"Blood": "Tank", "Frost": "Melee", "Unholy": "Melee"},
    "Demon Hunter": {"Devourer": "Ranged", "Havoc": "Melee", "Vengeance": "Tank"},
    "Druid": {"Balance": "Ranged", "Feral": "Melee", "Guardian": "Tank", "Restoration": "Healer"},
    "Evoker": {"Augmentation": "Ranged", "Devastation": "Ranged", "Preservation": "Healer"},
    "Hunter": {"Beast Mastery": "Ranged", "Marksmanship": "Ranged", "Survival": "Melee"},
    "Mage": {"Arcane": "Ranged", "Fire": "Ranged", "Frost": "Ranged"},
    "Monk": {"Brewmaster": "Tank", "Mistweaver": "Healer", "Windwalker": "Melee"},
    "Paladin": {"Holy": "Healer", "Protection": "Tank", "Retribution": "Melee"},
    "Priest": {"Discipline": "Healer", "Holy": "Healer", "Shadow": "Ranged"},
    "Rogue": {"Assassination": "Melee", "Outlaw": "Melee", "Subtlety": "Melee"},
    "Shaman": {"Elemental": "Ranged", "Enhancement": "Melee", "Restoration": "Healer"},
    "Warlock": {"Affliction": "Ranged", "Demonology": "Ranged", "Destruction": "Ranged"},
    "Warrior": {"Arms": "Melee", "Fury": "Melee", "Protection": "Tank"},
}

LUST_CLASSES = {"Shaman", "Mage", "Hunter", "Evoker"}
BREZ_CLASSES = {"Druid", "Paladin", "Warlock", "Death Knight"}


def get_specs_for_class(wow_class: str) -> dict[str, str]:
    return VALID_SPECS.get(wow_class, {})


def has_lust(wow_class: str) -> bool:
    return wow_class in LUST_CLASSES


def has_brez(wow_class: str) -> bool:
    return wow_class in BREZ_CLASSES


class SignupRequest(BaseModel):
    username: str
    wow_class: str
    specialization: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2 or len(v) > 24:
            raise ValueError("Character name must be 2-24 characters")
        return v

    @field_validator("wow_class")
    @classmethod
    def validate_class(cls, v: str) -> str:
        if v not in VALID_SPECS:
            raise ValueError(f"Invalid class: {v}")
        return v


class PlayerOut(BaseModel):
    id: int
    username: str
    wow_class: str
    specialization: str
    role: str
    group_index: str
    signed_up_at: datetime

    class Config:
        from_attributes = True


class SignupResponse(BaseModel):
    success: bool
    message: str
    player: Optional[PlayerOut] = None


class RosterResponse(BaseModel):
    players: list[PlayerOut]
    is_locked: bool


class AdminRequest(BaseModel):
    password: str


class SaveGroupsRequest(BaseModel):
    password: str
    groups: dict[str, str]


class ClassSpecResponse(BaseModel):
    classes: dict[str, dict[str, str]]


class AuthSignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class AuthLoginRequest(AuthSignupRequest):
    pass


class UserOut(BaseModel):
    id: int
    email: EmailStr
    is_admin: bool

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class CommunityMemberOut(BaseModel):
    id: int
    user_id: int
    name: str
    main_class: str
    guild_rank: Optional[str] = None
    bio: str
    image_path: Optional[str] = None
    position_seed: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CommunityMemberUpdate(BaseModel):
    name: str
    main_class: str
    guild_rank: Optional[str] = None
    bio: str = ""

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 60:
            raise ValueError("Name must be 2-60 characters")
        return v

    @field_validator("main_class")
    @classmethod
    def validate_main_class(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Main class is required")
        return v

    @field_validator("guild_rank")
    @classmethod
    def validate_rank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 80:
            raise ValueError("Guild rank must be 80 characters or less")
        return v or None


class CommunitySeedUpdate(BaseModel):
    member_id: int
    position_seed: int


class CommunitySeedBulkRequest(BaseModel):
    seeds: list[CommunitySeedUpdate]


class RulesUpdateRequest(BaseModel):
    content: str = ""
