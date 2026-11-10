"""Load optional example personas and voices into the database.

Nothing is seeded automatically — run this only if you want starter data.

Usage (inside the api container):
    python -m scripts.seed_examples /examples/seed.en.json
    python -m scripts.seed_examples /examples/seed.ko.json

Existing rows with the same persona name / voice ID are left untouched.
"""
import json
import sys
import uuid

from database import SyncSessionLocal
from models.persona import Persona
from models.voice import Voice


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    added_personas = added_voices = 0
    with SyncSessionLocal() as db:
        for order, p in enumerate(data.get("personas", [])):
            if db.query(Persona).filter(Persona.name == p["name"]).first():
                continue
            db.add(Persona(
                id=str(uuid.uuid4()),
                name=p["name"],
                description=p.get("description", ""),
                speech_style=p.get("speech_style", ""),
                is_active=True,
                sort_order=order,
            ))
            added_personas += 1

        for v in data.get("voices", []):
            if db.query(Voice).filter(Voice.id == v["id"]).first():
                continue
            db.add(Voice(id=v["id"], name=v["name"], is_active=True))
            added_voices += 1

        db.commit()

    print(f"Added {added_personas} persona(s) and {added_voices} voice(s) from {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
