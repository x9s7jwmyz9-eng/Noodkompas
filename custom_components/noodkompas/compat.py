"""Gebruik de schema-library die de geïnstalleerde HA-versie gebruikt."""

try:
    import probatio as vol
except ImportError:
    import voluptuous as vol

__all__ = ["vol"]
