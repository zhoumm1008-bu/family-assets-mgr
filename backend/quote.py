"""
Real-time price quotes for stocks and funds.
- Stocks: Sina Finance API (A-shares: sh/sz, HK: hk, US: gb_)
- Funds: East Money (天天基金) API
"""
import re
import time
import json
from typing import Optional
import requests

_cache = {}
CACHE_TTL = 60  # seconds


def _get_cached(key):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    return None


def _set_cached(key, data):
    _cache[key] = {"ts": time.time(), "data": data}


def _parse_stock_fields(code: str, fields: list[str]) -> Optional[dict]:
    """Parse stock fields based on market prefix."""
    if code.startswith("hk"):
        # HK stocks: fields[1]=name, fields[6]=price, fields[8]=change_pct
        if len(fields) < 9 or not fields[6]:
            return None
        return {
            "code": code,
            "name": fields[1],
            "price": float(fields[6]),
            "change_pct": round(float(fields[8]), 2),
        }
    elif code.startswith("gb_"):
        # US stocks: fields[0]=name, fields[1]=price, fields[2]=change_pct
        if len(fields) < 3 or not fields[1]:
            return None
        return {
            "code": code,
            "name": fields[0],
            "price": float(fields[1]),
            "change_pct": round(float(fields[2]), 2),
        }
    else:
        # A-shares (sh/sz): fields[0]=name, fields[3]=price, fields[2]=prev_close
        if len(fields) < 4 or not fields[3]:
            return None
        prev_close = float(fields[2]) if fields[2] else 0
        current = float(fields[3])
        change_pct = ((current - prev_close) / prev_close * 100) if prev_close else 0
        return {
            "code": code,
            "name": fields[0],
            "price": current,
            "change_pct": round(change_pct, 2),
        }


def get_stock_quotes(codes: list[str]) -> dict[str, dict]:
    """
    Batch fetch stock prices from Sina Finance.
    codes: list of stock codes like ['sh600519', 'sz000001', 'hk00700', 'gb_aapl']
    Returns: {code: {code, name, price, change_pct}}
    """
    results = {}
    to_fetch = []

    for code in codes:
        cached = _get_cached(f"stock:{code}")
        if cached:
            results[code] = cached
        else:
            to_fetch.append(code)

    if to_fetch:
        try:
            codes_str = ",".join(to_fetch)
            url = f"https://hq.sinajs.cn/list={codes_str}"
            headers = {"Referer": "https://finance.sina.com.cn"}
            resp = requests.get(url, headers=headers, timeout=10)
            resp.encoding = "gbk"

            for line in resp.text.strip().split("\n"):
                match = re.match(r'var hq_str_(\w+)="(.*)";', line.strip())
                if not match:
                    continue
                code = match.group(1)
                fields = match.group(2).split(",")
                data = _parse_stock_fields(code, fields)
                if not data:
                    results[code] = {"code": code, "name": "", "price": None}
                    continue
                results[code] = data
                _set_cached(f"stock:{code}", data)
        except Exception as e:
            for code in to_fetch:
                if code not in results:
                    results[code] = {"code": code, "name": "", "price": None, "error": str(e)}

    return results


def _fetch_fund_nav_fallback(code: str) -> Optional[dict]:
    """Fallback: fetch latest NAV from East Money historical NAV page (for QDII funds etc.)."""
    try:
        url = f"https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code={code}&page=1&sdate=&edate=&per=1"
        resp = requests.get(url, timeout=10)
        # Response is HTML table with NAV data
        name_match = re.search(r"var fS_name = \"(.+?)\"", resp.text)
        # Extract first row: <td>date</td><td>nav</td><td>accumulated_nav</td><td>change%</td>
        row_match = re.search(
            r"<td>(\d{4}-\d{2}-\d{2})</td><td[^>]*>([\d.]+)</td>",
            resp.text,
        )
        if row_match:
            nav_date = row_match.group(1)
            nav = float(row_match.group(2))
            return {
                "code": code,
                "name": name_match.group(1) if name_match else "",
                "nav": nav,
                "estimated_nav": nav,
                "nav_date": nav_date,
            }
    except Exception:
        pass
    return None


def get_fund_quotes(codes: list[str]) -> dict[str, dict]:
    """
    Fetch fund NAV from East Money.
    codes: list of fund codes like ['110011', '519300']
    Returns: {code: {code, name, nav, estimated_nav}}
    """
    results = {}

    for code in codes:
        cached = _get_cached(f"fund:{code}")
        if cached:
            results[code] = cached
            continue

        try:
            # Use the estimated NAV API (实时估值)
            url = f"http://fundgz.1234567.com.cn/js/{code}.js"
            resp = requests.get(url, timeout=10)
            # Response is JSONP: jsonpgz({...});
            match = re.search(r"jsonpgz\((.+)\)", resp.text)
            if not match:
                # QDII and some other funds don't have real-time estimates,
                # fall back to historical NAV API
                fallback = _fetch_fund_nav_fallback(code)
                if fallback:
                    results[code] = fallback
                    _set_cached(f"fund:{code}", fallback)
                else:
                    results[code] = {"code": code, "name": "", "nav": None}
                continue
            info = json.loads(match.group(1))
            data = {
                "code": code,
                "name": info.get("name", ""),
                "nav": float(info.get("dwjz", 0)),         # 上一交易日净值
                "estimated_nav": float(info.get("gsz", 0)), # 实时估算净值
                "nav_date": info.get("jzrq", ""),
            }
            results[code] = data
            _set_cached(f"fund:{code}", data)
        except Exception as e:
            results[code] = {"code": code, "name": "", "nav": None, "error": str(e)}

    return results
