import os
import time
import logging

import requests

from config import settings

logger = logging.getLogger(__name__)

# Instagram Login 방식 — graph.instagram.com 경로 (페이스북 페이지 불필요).
# 3-스텝 컨테이너 흐름(생성→인코딩 대기→발행)은 동일하며 호스트/토큰만 다름.
BASE_URL = f"{settings.instagram_graph_base.rstrip('/')}/{settings.instagram_api_version}"


def _check(resp: requests.Response, action: str) -> requests.Response:
    """4xx/5xx면 Meta 에러 본문(JSON)을 로그·예외 메시지에 포함시켜 원인을 노출."""
    if resp.status_code >= 400:
        body = resp.text
        logger.error(f"Instagram {action} 실패 [{resp.status_code}]: {body}")
        raise requests.HTTPError(f"{action} {resp.status_code}: {body}", response=resp)
    return resp


def create_reels_container(video_url: str, caption: str) -> str:
    account_id = settings.instagram_account_id
    token = settings.instagram_access_token

    resp = requests.post(
        f"{BASE_URL}/{account_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "access_token": token,
        },
    )
    _check(resp, "컨테이너 생성")
    return resp.json()["id"]


def wait_for_encoding(container_id: str, max_attempts: int = 20) -> None:
    token = settings.instagram_access_token

    for attempt in range(max_attempts):
        resp = requests.get(
            f"{BASE_URL}/{container_id}",
            # status: 사람이 읽을 수 있는 사유(예: "Error: 2207026 ...") 포함
            params={"fields": "status_code,status", "access_token": token},
        )
        _check(resp, "인코딩 상태 조회")
        data = resp.json()
        status = data.get("status_code")

        if status == "FINISHED":
            return
        elif status == "ERROR":
            # status 필드에 실제 실패 사유(미접근/규격 등)가 들어옴
            logger.error(f"Meta 인코딩 오류: {data}")
            raise Exception(f"Meta 인코딩 오류: {data.get('status') or data}")
        else:
            logger.info(f"인코딩 중... ({attempt + 1}/{max_attempts}) status={status}")
            time.sleep(30)

    raise Exception("인코딩 타임아웃 (10분 초과)")


def publish_reels(container_id: str) -> str:
    account_id = settings.instagram_account_id
    token = settings.instagram_access_token

    resp = requests.post(
        f"{BASE_URL}/{account_id}/media_publish",
        data={
            "creation_id": container_id,
            "access_token": token,
        },
    )
    _check(resp, "게시")
    return resp.json()["id"]
