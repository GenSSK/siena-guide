#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
シエナ・ガイド 画像取得スクリプト
Wikimedia Commons から、食べ物・観光名所の実画像をダウンロードして images/ に保存する。
- ライセンスが明確（CC/PD）でホットリンクせずローカル化するため GitHub Pages でリンク切れしない。
- レストランの具体的な店舗写真は Commons にほぼ無いため、UI 側のプレースホルダ＋「写真を検索」リンクで対応（本スクリプトの対象外）。

使い方:
    python3 tools/fetch_images.py            # 全カテゴリ取得
    python3 tools/fetch_images.py foods       # 食べ物のみ
    python3 tools/fetch_images.py attractions # 観光のみ

要: ネットワーク（commons.wikimedia.org / upload.wikimedia.org へのアクセス許可）
"""
import json, os, sys, time, urllib.parse, urllib.request, urllib.error

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "SienaGuide/1.0 (personal trip planning; non-commercial)"
API = "https://commons.wikimedia.org/w/api.php"

# 各項目IDに対する Commons 検索クエリ（精度重視で英語＋地名）
FOOD_Q = {
    "pici": "Pici",
    "ribollita": "Ribollita soup",
    "pappa-al-pomodoro": "Pappa al pomodoro",
    "panzanella": "Panzanella",
    "crostini-neri": "Crostini toscani",
    "gnudi": "Gnudi",
    "cinta-senese": "Cinta Senese",
    "cinghiale": "Cinghiale in umido",
    "bistecca": "Bistecca fiorentina",
    "tartufo": "Tartufo truffle",
    "pecorino": "Pecorino cheese",
    "finocchiona": "Finocchiona",
    "trippa": "Trippa alla fiorentina",
    "panforte": "Panforte",
    "ricciarelli": "Ricciarelli",
    "cavallucci": "Cavallucci",
    "cantucci": "Cantuccini",
    "wine-chianti": "Chianti wine",
    "wine-brunello": "Brunello di Montalcino",
    "wine-nobile": "Vino Nobile di Montepulciano",
    "wine-vernaccia": "Vernaccia di San Gimignano",
}
ATTR_Q = {
    "campo": "Piazza del Campo Siena",
    "fonte-gaia": "Fonte Gaia Siena",
    "palazzo-pubblico": "Palazzo Pubblico Siena facade",
    "torre-mangia": "Torre del Mangia tower",
    "duomo": "Siena Cathedral facade",
    "piccolomini": "Libreria Piccolomini Siena",
    "battistero": "Battistero San Giovanni Siena",
    "cripta": "Cripta Duomo Siena fresco",
    "museo-opera": "Museo dell'Opera del Duomo Siena Maesta",
    "facciatone": "Facciatone Siena panorama",
    "porta-cielo": "Duomo di Siena interior",
    "santa-maria-scala": "Santa Maria della Scala Siena pellegrinaio",
    "pinacoteca": "Pinacoteca Nazionale Siena",
    "san-domenico": "Basilica San Domenico Siena",
    "casa-caterina": "Santuario Casa Santa Caterina Siena",
    "san-francesco": "Basilica San Francesco Siena",
    "san-bernardino": "Oratorio San Bernardino Siena",
    "fortezza": "Fortezza Medicea Siena",
    "orto-botanico": "Orto Botanico Siena",
    "provenzano": "Santa Maria di Provenzano Siena",
    "contrada": "Palio di Siena contrada flags",
}

PAUSE = 2.0  # 全リクエスト間の基本待機（秒）

def _get(url, timeout=45):
    """429/503 に指数バックオフで再試行しながら取得（bytes を返す）"""
    delay = 8
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": UA,
              "Accept": "application/json,image/*,*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 4:
                wait = delay
                ra = e.headers.get("Retry-After")
                if ra and ra.isdigit():
                    wait = max(wait, int(ra))
                print(f"      (429/503 → {wait}s 待機して再試行 {attempt+1}/4)")
                time.sleep(wait)
                delay *= 2
                continue
            raise
    raise RuntimeError("retry exhausted")

def api_search(query, limit=8):
    params = {
        "action": "query", "generator": "search",
        "gsrsearch": query, "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|mime|size", "iiurlwidth": "1280",
        "format": "json",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    data = json.loads(_get(url, timeout=30).decode("utf-8"))
    pages = (data.get("query") or {}).get("pages") or {}
    items = sorted(pages.values(), key=lambda p: p.get("index", 999))
    out = []
    for p in items:
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime", "")
        if not mime.startswith("image/") or mime == "image/svg+xml":
            continue
        # 極端な縦横比（パノラマ等）はカード表示に不向きなので除外
        w, h = ii.get("width", 0), ii.get("height", 0)
        if w and h:
            ar = w / h
            if ar > 3.0 or ar < 0.45:
                continue
        thumb = ii.get("thumburl") or ii.get("url")
        if thumb:
            out.append(thumb)
    return out

def download(url, dest):
    time.sleep(PAUSE)
    data = _get(url, timeout=60)
    if len(data) < 3000:  # 壊れ/極小はスキップ
        raise ValueError("too small")
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)

def run(group, mapping, subdir):
    outdir = os.path.join(BASE, "images", subdir)
    os.makedirs(outdir, exist_ok=True)
    ok = skip = fail = 0
    for _id, q in mapping.items():
        dest = os.path.join(outdir, _id + ".jpg")
        if os.path.exists(dest) and os.path.getsize(dest) > 3000:
            print(f"  [skip] {subdir}/{_id}.jpg (既存)"); skip += 1; continue
        try:
            time.sleep(PAUSE)  # 検索前にも待機
            urls = api_search(q)
            if not urls:
                print(f"  [FAIL] {subdir}/{_id}  検索結果に画像なし: {q}"); fail += 1
                continue
            done = False
            for u in urls[:4]:  # 最大4候補まで
                try:
                    n = download(u, dest)
                    print(f"  [ok]   {subdir}/{_id}.jpg  ({n//1024} KB)  <- {q}")
                    ok += 1; done = True; break
                except Exception as de:
                    print(f"      (候補ダウンロード失敗: {de})")
                    continue
            if not done:
                print(f"  [FAIL] {subdir}/{_id}  取得できず: {q}"); fail += 1
        except Exception as e:
            print(f"  [FAIL] {subdir}/{_id}  {e}"); fail += 1
    print(f"== {group}: ok={ok} skip={skip} fail={fail} ==")
    return ok, skip, fail

def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    print("シエナ・ガイド 画像取得（Wikimedia Commons）")
    if which in ("all", "foods"):
        run("食べ物", FOOD_Q, "foods")
    if which in ("all", "attractions"):
        run("観光", ATTR_Q, "attractions")
    print("完了。取得できなかった項目は UI のプレースホルダで表示されます。")

if __name__ == "__main__":
    main()
