#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全地点(tools/places.json)を Nominatim(OpenStreetMap) でジオコーディングし
tools/geo.json {id: {lat, lon, name, query}} を出力する。
Nominatim 利用規約に従い 1リクエスト/秒・UA明記。
"""
import json, os, re, time, urllib.parse, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "SienaGuide/1.0 (personal trip planning; non-commercial)"
API = "https://nominatim.openstreetmap.org/search"

# シエナ歴史地区のおおよその範囲（妥当性チェック用）
LAT_MIN, LAT_MAX = 43.300, 43.340
LON_MIN, LON_MAX = 11.310, 11.350

STREET_RE = re.compile(r"(Via|Piazza|Costa|Vicolo|Piazzetta|Banchi|Costa)", re.I)

def q(query, viewbox=True):
    params = {"q": query, "format": "json", "limit": "3", "addressdetails": "0"}
    if viewbox:
        # シエナ周辺に絞る（境界内優先）
        params["viewbox"] = "11.30,43.34,11.36,43.30"
        params["bounded"] = "0"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if attempt < 3:
                time.sleep(3 * (attempt + 1)); continue
            print("   query error:", e); return []
    return []

def in_siena(lat, lon):
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX

def candidates(p):
    """クエリ候補を優先度順に返す"""
    cands = []
    addr = (p.get("address") or "").strip()
    name = (p.get("name") or "").strip()
    # 住所が通り名を含むならそれを最優先
    if STREET_RE.search(addr):
        # 日本語括弧以降を除去
        clean = re.split(r"[（(]", addr)[0].strip()
        cands.append(clean + ", Siena, Italy")
    # 名称（施設名）
    if name:
        cands.append(name + ", Siena, Italy")
    # mapQuery（末尾に Siena, Italy 済み）
    if p.get("mapQuery"):
        cands.append(p["mapQuery"])
    # エリアのみ（最後の砦）
    if p.get("area") and STREET_RE.search(p["area"]):
        cands.append(re.split(r"[（(]", p["area"])[0].strip() + ", Siena, Italy")
    # 重複除去
    seen = set(); uniq = []
    for c in cands:
        if c not in seen:
            seen.add(c); uniq.append(c)
    return uniq

def main():
    places = json.load(open(os.path.join(BASE, "tools", "places.json")))
    out = {}
    outpath = os.path.join(BASE, "tools", "geo.json")
    if os.path.exists(outpath):
        out = json.load(open(outpath))
    for p in places:
        _id = p["id"]
        if out.get(_id):
            print(f"  [skip] {_id}"); continue
        found = None
        for cand in candidates(p):
            res = q(cand)
            time.sleep(1.1)  # Nominatim: 1req/sec
            for r in res:
                lat, lon = float(r["lat"]), float(r["lon"])
                if in_siena(lat, lon):
                    found = {"lat": round(lat, 6), "lon": round(lon, 6),
                             "name": r.get("display_name", "")[:80], "query": cand}
                    break
            if found:
                break
        if found:
            out[_id] = found
            print(f"  [ok]   {_id:16s} {found['lat']},{found['lon']}  <- {found['query'][:45]}")
        else:
            print(f"  [FAIL] {_id:16s} 座標特定できず")
        json.dump(out, open(outpath, "w"), ensure_ascii=False, indent=1)
    print(f"== {len(out)}/{len(places)} 件 -> tools/geo.json ==")

if __name__ == "__main__":
    main()
