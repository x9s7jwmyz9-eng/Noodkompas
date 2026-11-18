"""Strikte invoervalidatie en transparante 72-uursberekeningen."""

import re
from copy import deepcopy
from datetime import date
from math import isfinite
from typing import Any

from .const import KIT_ITEMS

SCHEMA_VERSION = 2
"""Versie van de opgeslagen snapshot; verhoog bij elke wijziging van de velden."""

ITEM_DEFAULTS: dict[str, dict[str, Any]] = {
    "food": {"name": "", "quantity": 0, "unit": "stuk", "expires": "", "person_days": 0},
    "energy": {
        "name": "",
        "category": "powerbank",
        "stored_wh": 0,
        "entity_id": "",
        "capacity_wh": 0,
        "reserve_pct": 0,
    },
    "kit": {"name": "", "done": False},
    "contacts": {"name": "", "phone": ""},
}


def defaults() -> dict[str, Any]:
    return {
        "household": {"adults": 1, "children": 0, "pets": 0, "pet_water_l_day": 1.0},
        "water_l": 0.0,
        "food": [],
        "energy": [],
        "kit": [{"name": name, "done": False} for name in KIT_ITEMS],
        "plan": {"meeting_place": "", "contacts": [], "notes": ""},
        "settings": {"water_l_person_day": 3.0, "energy_wh_day": 500.0, "expiry_warning_days": 30},
    }


def _fill(value: Any, template: dict[str, Any]) -> Any:
    """Vul ontbrekende sleutels aan en laat onbekende sleutels vallen."""
    if not isinstance(value, dict):
        return value
    return {key: value.get(key, deepcopy(default)) for key, default in template.items()}


def migrate(value: Any, version: int) -> Any:
    """Breng opgeslagen data van een andere schemaversie naar het huidige schema.

    Alleen de structuur wordt aangevuld; de inhoud blijft staan zodat validate() die
    nog steeds streng controleert. Niet-dicts gaan ongewijzigd door en falen daar.
    """
    if not isinstance(value, dict):
        return value
    base = defaults()
    data = _fill(deepcopy(value), base)
    for key in ("household", "settings", "plan"):
        data[key] = _fill(data[key], base[key])
    for key in ("food", "energy", "kit"):
        if isinstance(data[key], list):
            data[key] = [_fill(item, ITEM_DEFAULTS[key]) for item in data[key]]
    if isinstance(data["plan"], dict) and isinstance(data["plan"]["contacts"], list):
        data["plan"]["contacts"] = [
            _fill(item, ITEM_DEFAULTS["contacts"]) for item in data["plan"]["contacts"]
        ]
    if isinstance(data["kit"], list):
        present = {
            item["name"].strip().casefold()
            for item in data["kit"]
            if isinstance(item, dict) and isinstance(item["name"], str)
        }
        data["kit"] += [
            {"name": name, "done": False} for name in KIT_ITEMS if name.casefold() not in present
        ]
    if version < 2 and isinstance(data["energy"], list):
        # Tot schema 2 gold de reserve alleen voor een EV; behoud die uitkomst.
        for item in data["energy"]:
            if isinstance(item, dict) and item["category"] != "ev":
                item["reserve_pct"] = 0
    return data


def _keys(value: Any, expected: set[str]) -> dict:
    if not isinstance(value, dict) or set(value) != expected:
        raise ValueError("Ontbrekende of onbekende velden")
    return value


def _number(value: Any, low: float, high: float, integer: bool = False) -> None:
    if type(value) not in (int, float) or not low <= value <= high or not isfinite(value):
        raise ValueError("Ongeldig getal")
    if integer and type(value) is not int:
        raise ValueError("Geheel getal vereist")


def _text(value: Any, limit: int = 200, required: bool = False) -> None:
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError("Ongeldige tekst")


def _list(value: Any, limit: int) -> None:
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError("Te veel items")


def validate(value: Any) -> dict[str, Any]:
    """Valideer ook geneste gegevens; geen coercie van strings of booleans."""
    _keys(value, set(defaults()))
    h = _keys(value["household"], {"adults", "children", "pets", "pet_water_l_day"})
    for key in ("adults", "children", "pets"):
        _number(h[key], 0, 100, True)
    if h["adults"] + h["children"] == 0:
        raise ValueError("Minimaal één persoon vereist")
    _number(h["pet_water_l_day"], 0, 100)
    _number(value["water_l"], 0, 1_000_000)
    s = _keys(value["settings"], {"water_l_person_day", "energy_wh_day", "expiry_warning_days"})
    _number(s["water_l_person_day"], 0.1, 100)
    _number(s["energy_wh_day"], 1, 1_000_000)
    _number(s["expiry_warning_days"], 0, 365, True)
    _list(value["food"], 500)
    for item in value["food"]:
        _keys(item, {"name", "quantity", "unit", "expires", "person_days"})
        _text(item["name"], required=True)
        _text(item["unit"], 30, True)
        _number(item["quantity"], 0, 1_000_000)
        _number(item["person_days"], 0, 10_000)
        _text(item["expires"], 10)
        if item["expires"]:  # Leeg betekent: bederft niet.
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", item["expires"]):
                raise ValueError("Datum moet JJJJ-MM-DD zijn")
            date.fromisoformat(item["expires"])
    _list(value["energy"], 100)
    sources = []
    for item in value["energy"]:
        _keys(item, {"name", "category", "stored_wh", "entity_id", "capacity_wh", "reserve_pct"})
        _text(item["name"], required=True)
        if item["category"] not in ("powerbank", "ups", "powerstation", "home_battery", "ev"):
            raise ValueError("Onbekende energiecategorie")
        for key in ("stored_wh", "capacity_wh"):
            _number(item[key], 0, 1_000_000_000)
        _number(item["reserve_pct"], 0, 100)
        _text(item["entity_id"], 200)
        if item["entity_id"]:
            if not re.fullmatch(r"sensor\.[a-z0-9_]+", item["entity_id"]):
                raise ValueError("Alleen sensor-entities toegestaan")
            if item["entity_id"] in sources:
                raise ValueError("Energiesensor dubbel geselecteerd")
            sources.append(item["entity_id"])
    _list(value["kit"], 100)
    if not value["kit"]:
        raise ValueError("Noodpakket mag niet leeg zijn")
    for item in value["kit"]:
        _keys(item, {"name", "done"})
        _text(item["name"], required=True)
        if type(item["done"]) is not bool:
            raise ValueError("Ongeldige checklistwaarde")
    if not set(KIT_ITEMS).issubset({item["name"] for item in value["kit"]}):
        raise ValueError("Standaard noodpakketitems zijn verplicht")
    if len({item["name"].strip().casefold() for item in value["kit"]}) != len(value["kit"]):
        raise ValueError("Noodpakketitems moeten uniek zijn")
    p = _keys(value["plan"], {"meeting_place", "contacts", "notes"})
    _text(p["meeting_place"], 500)
    _text(p["notes"], 5000)
    _list(p["contacts"], 50)
    for item in p["contacts"]:
        _keys(item, {"name", "phone"})
        _text(item["name"], required=True)
        _text(item["phone"], 100, True)
    return deepcopy(value)


def calculate(
    data: dict, today: date, states: dict[str, tuple[str, str]]
) -> dict[str, float | int | bool]:
    """Percentages zijn indicatief; dagen begrensd door water, voedsel en energie."""
    h, s = data["household"], data["settings"]
    people = h["adults"] + h["children"]
    water_day = people * s["water_l_person_day"] + h["pets"] * h["pet_water_l_day"]
    water_days = data["water_l"] / water_day

    def days_left(item: dict) -> int | None:
        """Dagen tot de houdbaarheidsdatum; None als het product niet bederft."""
        return (date.fromisoformat(item["expires"]) - today).days if item["expires"] else None

    food_days = (
        sum(
            i["quantity"] * i["person_days"]
            for i in data["food"]
            if (left := days_left(i)) is None or left >= 0
        )
        / people
    )
    energy = 0.0
    invalid_sources = 0
    for i in data["energy"]:
        available = i["stored_wh"]
        if i["entity_id"]:
            raw, unit = states.get(i["entity_id"], ("unavailable", ""))
            try:
                n = float(raw)
                if not isfinite(n) or not 0 <= n <= 1_000_000_000:
                    raise ValueError
                if unit == "%" and n <= 100 and i["capacity_wh"] > 0:
                    available = n / 100 * i["capacity_wh"]
                elif unit in ("Wh", "kWh"):
                    available = n * (1000 if unit == "kWh" else 1)
                else:
                    raise ValueError
            except (ValueError, TypeError):
                available = 0
                invalid_sources += 1
        capacity = i["capacity_wh"]
        if i["category"] == "ev" and capacity <= 0:
            available = 0  # Zonder capaciteit is de EV-reserve niet te bepalen.
        elif capacity > 0:
            # Reserve geldt voor elke bron met bekende capaciteit (ook thuisaccu/UPS).
            available = min(available, capacity)
            available = max(0, available - capacity * i["reserve_pct"] / 100)
        energy += available
    energy_days = energy / s["energy_wh_day"]
    kit_score = 100 * sum(i["done"] for i in data["kit"]) / len(data["kit"])
    p = data["plan"]
    # Notities zijn optioneel: verzamelplaats en contacten maken het plan compleet.
    plan_score = 100 * sum((bool(p["meeting_place"].strip()), bool(p["contacts"]))) / 2
    scores = [min(100, days / 3 * 100) for days in (water_days, food_days, energy_days)] + [
        kit_score,
        plan_score,
    ]
    expiring = expired = 0
    for i in data["food"]:
        left = days_left(i)
        if i["quantity"] <= 0 or left is None:
            continue
        expired += left < 0
        expiring += 0 <= left <= s["expiry_warning_days"]
    return dict(
        zip(
            ("water_score", "food_score", "energy_score", "kit_score", "plan_score"),
            scores,
            strict=True,
        )
    ) | {
        "score": sum(scores) / 5,
        "72h_ready": all(v >= 100 for v in scores),
        "water_required": water_day * 3,
        "water_days": water_days,
        "food_days": food_days,
        "energy_available": energy,
        "expiring_items": expiring,
        "expired_items": expired,
        "invalid_energy_sources": invalid_sources,
        "self_sufficiency_days": min(water_days, food_days, energy_days),
    }
