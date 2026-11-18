"""Berekeningen en grensgevallen zonder externe runtime."""

from copy import deepcopy
from datetime import date

import pytest

TODAY = date(2026, 10, 7)


def food(expires="2026-10-08", quantity=3, person_days=1):
    return {
        "name": "Voorraad",
        "quantity": quantity,
        "unit": "stuk",
        "expires": expires,
        "person_days": person_days,
    }


def energy(category="powerbank", **overrides):
    return {
        "name": "Accu",
        "category": category,
        "stored_wh": 1500,
        "capacity_wh": 0,
        "entity_id": "",
        "reserve_pct": 20,
    } | overrides


def test_default_not_ready(model):
    data = model.validate(model.defaults())
    result = model.calculate(data, TODAY, {})
    assert result["score"] == 0
    assert result["72h_ready"] is False
    assert result["water_required"] == 9


def test_complete_72h(model):
    data = model.defaults()
    data["water_l"] = 9
    data["food"] = [food()]
    data["energy"] = [energy()]
    for item in data["kit"]:
        item["done"] = True
    data["plan"] = {
        "meeting_place": "Plein",
        "contacts": [{"name": "A", "phone": "123"}],
        "notes": "Looproute",
    }
    result = model.calculate(model.validate(data), TODAY, {})
    assert result["score"] == 100
    assert result["72h_ready"] is True
    assert result["self_sufficiency_days"] == 3


def test_household_water_and_bottleneck(model):
    data = model.defaults()
    data["household"] = {"adults": 2, "children": 1, "pets": 2, "pet_water_l_day": 0.5}
    data["water_l"] = 20
    data["food"] = [food(quantity=9)]
    data["energy"] = [energy()]
    result = model.calculate(model.validate(data), TODAY, {})
    assert result["water_required"] == 30
    assert result["water_days"] == 2
    assert result["food_days"] == 3
    assert result["self_sufficiency_days"] == 2
    assert result["water_score"] == pytest.approx(200 / 3)


def test_expiry_inclusive_and_expired_excluded(model):
    data = model.defaults()
    data["food"] = [
        food("2026-10-06"),
        food("2026-10-07", 1),
        food("2026-11-06", 1),
        food("2026-11-07", 1),
        food(quantity=0),
    ]
    result = model.calculate(model.validate(data), TODAY, {})
    assert result["food_days"] == 3
    assert result["expiring_items"] == 2
    assert result["expired_items"] == 1


@pytest.mark.parametrize(
    "unit,raw,capacity,expected",
    [("Wh", "1500", 0, 1500), ("kWh", "1.5", 0, 1500), ("%", "50", 3000, 1500)],
)
def test_energy_units(model, unit, raw, capacity, expected):
    data = model.defaults()
    data["energy"] = [energy(entity_id="sensor.accu", capacity_wh=capacity, stored_wh=999999)]
    result = model.calculate(model.validate(data), TODAY, {"sensor.accu": (raw, unit)})
    assert result["energy_available"] == expected  # Handmatig wordt niet dubbel geteld.


@pytest.mark.parametrize(
    "raw,unit,capacity",
    [
        ("unavailable", "Wh", 0),
        ("unknown", "kWh", 0),
        ("NaN", "Wh", 0),
        ("inf", "Wh", 0),
        ("-1", "Wh", 0),
        ("101", "%", 1000),
        ("50", "%", 0),
        ("5", "W", 0),
    ],
)
def test_bad_sensor_zero(model, raw, unit, capacity):
    data = model.defaults()
    data["energy"] = [energy(entity_id="sensor.accu", capacity_wh=capacity)]
    result = model.calculate(model.validate(data), TODAY, {"sensor.accu": (raw, unit)})
    assert result["energy_available"] == 0
    assert result["invalid_energy_sources"] == 1


@pytest.mark.parametrize(
    "stored,reserve,capacity,expected",
    [
        (30000, 20, 60000, 18000),
        (5000, 20, 60000, 0),
        (90000, 20, 60000, 48000),
        (30000, 100, 60000, 0),
        (30000, 0, 0, 0),
    ],
)
def test_ev_reserve(model, stored, reserve, capacity, expected):
    data = model.defaults()
    data["energy"] = [energy("ev", stored_wh=stored, reserve_pct=reserve, capacity_wh=capacity)]
    assert model.calculate(model.validate(data), TODAY, {})["energy_available"] == expected


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), True, "9", 10**1000, None])
def test_invalid_numbers(model, value):
    data = model.defaults()
    data["water_l"] = value
    with pytest.raises(ValueError):
        model.validate(data)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d.update(unexpected="x"),
        lambda d: d["household"].update(adults=0),
        lambda d: d["household"].update(children=1.5),
        lambda d: d.update(food=[food("2026-02-30")]),
        lambda d: d.update(food=[food("2026-1-1")]),
        lambda d: d.update(food=[food()] * 501),
        lambda d: d.update(energy=[energy(entity_id="light.hall")]),
        lambda d: d.update(energy=[energy(entity_id="sensor.accu")] * 2),
        lambda d: d.update(energy=[energy(category="other")]),
        lambda d: d.update(kit=[]),
        lambda d: d["kit"][0].update(done="yes"),
        lambda d: d["plan"].update(notes="x" * 5001),
        lambda d: d["plan"].update(contacts=[{"name": "", "phone": "123"}]),
    ],
)
def test_nested_validation(model, mutation):
    data = model.defaults()
    mutation(data)
    with pytest.raises(ValueError):
        model.validate(data)


def test_copy_and_sensitive_data_not_in_summary(model):
    data = model.defaults()
    data["plan"] = {
        "meeting_place": "Private plaats",
        "contacts": [{"name": "Private naam", "phone": "Private nummer"}],
        "notes": "Private opmerking",
    }
    copied = model.validate(data)
    copied["plan"]["contacts"][0]["name"] = "Gewijzigd"
    assert copied != deepcopy(data)
    assert "Private" not in str(model.calculate(data, TODAY, {}))


def test_score_not_ready_when_rounded_100(model):
    data = model.defaults()
    data["water_l"] = 8.99999
    result = model.calculate(data, TODAY, {})
    assert result["water_score"] < 100
    assert result["72h_ready"] is False


def test_sensor_overflow_does_not_publish_infinity(model):
    data = model.defaults()
    data["energy"] = [energy(entity_id="sensor.accu")]
    result = model.calculate(model.validate(data), TODAY, {"sensor.accu": ("1e308", "Wh")})
    assert result["energy_available"] == 0
    assert result["invalid_energy_sources"] == 1


def test_duplicate_kit_names_rejected(model):
    data = model.defaults()
    data["kit"].append({"name": "  zaklamp ", "done": True})
    with pytest.raises(ValueError):
        model.validate(data)
