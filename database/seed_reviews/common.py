"""
共通ユーティリティ: ME/Indexer接続、URL正規化、フォールバック関数
"""

import os
import re
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from supabase import create_client

# ---------------------------------------------------------------------------
# 接続設定
# ---------------------------------------------------------------------------
ME_ENV_PATH = os.path.expanduser("~/Desktop/menesthe-db/.env")
INDEXER_ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
INDEXER_DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def connect_me():
    """ME Supabaseクライアントを返す"""
    load_dotenv(ME_ENV_PATH)
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def connect_indexer():
    """IndexerローカルPG接続を返す"""
    return psycopg2.connect(INDEXER_DSN)


def get_anthropic_api_key():
    """Anthropic APIキーを返す"""
    load_dotenv(INDEXER_ENV_PATH)
    return os.environ["ANTHROPIC_API_KEY"]


# ---------------------------------------------------------------------------
# URL正規化
# ---------------------------------------------------------------------------
def normalize_url(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    url = url.strip().lower()
    url = re.sub(r"^http://", "https://", url)
    parsed = urlparse(url)
    host = parsed.hostname or ""
    host = re.sub(r"^www\.", "", host)
    path = parsed.path.rstrip("/") or ""
    normalized = f"https://{host}{path}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


def extract_domain(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    parsed = urlparse(url.strip().lower())
    host = parsed.hostname or ""
    return re.sub(r"^www\.", "", host) or None


# ---------------------------------------------------------------------------
# 名前正規化
# ---------------------------------------------------------------------------
def normalize_name(name: str | None) -> str | None:
    if not name:
        return None
    name = name.strip()
    name = re.sub(r"[\s　]+", " ", name)
    name = re.sub(r"[（\(].+?[）\)]", "", name)
    name = name.strip()
    return name if name else None


# ---------------------------------------------------------------------------
# body_type / cup_type フォールバック
# ---------------------------------------------------------------------------
def fallback_body_type_id(waist: int | None) -> int | None:
    """waist(cm)からbody_type_idを推定"""
    if waist is None:
        return None
    if waist <= 56:
        return 1  # スレンダー
    if waist <= 62:
        return 2  # 普通
    if waist <= 68:
        return 3  # グラマー
    return 4  # ぽっちゃり


def fallback_cup_type_id(cup: str | None) -> int | None:
    """cupサイズ文字からcup_type_idを推定"""
    if not cup:
        return None
    cup = cup.strip().upper()
    if cup in ("A", "B", "C"):
        return 3  # ちっぱい
    if cup in ("D", "E"):
        return 1  # ちょうどいい
    if cup in ("F", "G"):
        return 2  # 巨乳
    if cup >= "H":
        return 4  # 爆乳
    return None
