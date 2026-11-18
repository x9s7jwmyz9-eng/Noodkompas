"""Vul repositorymetadata in zonder netwerk, shellacties of externe packages."""

import json
import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2 or not re.fullmatch(
        r"https://github\.com/[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]+/?", sys.argv[1]
    ):
        raise SystemExit(
            "Gebruik: python tools/prepare_repository.py https://github.com/eigenaar/repository"
        )
    url = sys.argv[1].rstrip("/")
    owner = url.split("/")[-2]
    manifest_path = (
        Path(__file__).resolve().parents[1] / "custom_components" / "noodkompas" / "manifest.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update(documentation=url, issue_tracker=f"{url}/issues", codeowners=[f"@{owner}"])
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Repositorylinks en eigenaar zijn ingevuld. Er is niets geüpload.")


if __name__ == "__main__":
    main()
