"""Script to create the initial admin account

Usage:
    docker-compose exec api python scripts/create_admin.py --username admin --password yourpassword
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings
from models.user import User


def main():
    parser = argparse.ArgumentParser(description="Create an admin account")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    engine = create_engine(settings.sync_database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    existing = session.query(User).filter_by(username=args.username).first()
    if existing:
        print(f"[Error] Account already exists: {args.username}")
        session.close()
        sys.exit(1)

    user = User(
        username=args.username,
        hashed_password=bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode(),
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.close()
    print(f"[Done] Account created: {args.username}")


if __name__ == "__main__":
    main()
