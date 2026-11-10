"""초기 관리자 계정 생성 스크립트

사용법:
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
    parser = argparse.ArgumentParser(description="관리자 계정 생성")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    engine = create_engine(settings.sync_database_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    existing = session.query(User).filter_by(username=args.username).first()
    if existing:
        print(f"[오류] 이미 존재하는 계정: {args.username}")
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
    print(f"[완료] 계정 생성: {args.username}")


if __name__ == "__main__":
    main()
