"""Statische controle van de autorisatiegrens; echte HA-tests staan in ha/."""

import ast
import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
INTEGRATION = ROOT / "custom_components" / "noodkompas"


def test_each_websocket_command_requires_admin_before_scheduling():
    tree = ast.parse((INTEGRATION / "websocket.py").read_text(encoding="utf-8"))
    commands = [
        n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name.startswith("ws_")
    ]
    assert len(commands) == 2
    for command in commands:
        decorators = [ast.unparse(d) for d in command.decorator_list]
        assert decorators[0].startswith("websocket_api.websocket_command(")
        assert decorators[1:] == ["websocket_api.require_admin", "websocket_api.async_response"]


def test_panel_admin_and_static_route_contains_only_js():
    text = (INTEGRATION / "__init__.py").read_text(encoding="utf-8")
    tree = ast.parse(text)
    panel = [
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.Call) and ast.unparse(n.func) == "panel_custom.async_register_panel"
    ]
    assert len(panel) == 1
    assert next(k.value.value for k in panel[0].keywords if k.arg == "require_admin") is True
    assert '"panel.js"' in text
    assert "async_register_static_paths" in text


def test_no_unsafe_frontend_sinks_or_external_clients():
    js = (INTEGRATION / "frontend" / "panel.js").read_text(encoding="utf-8")
    for forbidden in (
        "innerHTML",
        "outerHTML",
        "insertAdjacentHTML",
        "eval(",
        "fetch(",
        "http://",
        "https://",
    ):
        assert forbidden not in js
    for path in INTEGRATION.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        imports = [n for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom))]
        for node in imports:
            names = (
                [a.name for a in node.names]
                if isinstance(node, ast.Import)
                else [node.module or ""]
            )
            assert not any(
                n.split(".")[0] in {"subprocess", "requests", "aiohttp", "socket", "urllib"}
                for n in names
            )
    manifest = json.loads((INTEGRATION / "manifest.json").read_text())
    assert manifest["requirements"] == []
