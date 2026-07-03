#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レストランの Google 画像（主に Google マップの店舗写真 lh3.googleusercontent.com/p/…）の
URL を抽出して JSON に出力する。画像はダウンロードせず「ホットリンク用URL」を集めるだけ。

仕組み: ヘッドレス Chromium で Google 画像検索(udm=2)をレンダリングし、DOM から
        店舗写真URLを抽出。取得できなければ gstatic サムネイルURLをフォールバックに使う。

出力: tools/restaurant_image_urls.json  {id: url, ...}
要: www.google.com へのアクセス許可（settings.local.json）
"""
import json, os, re, subprocess, time, urllib.parse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "tools", "restaurant_image_urls.json")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# id: 検索クエリ
QUERIES = {
    "san-giuseppe": "La Taverna di San Giuseppe Siena ristorante",
    "logge": "Osteria Le Logge Siena ristorante",
    "divo": "Antica Osteria da Divo Siena ristorante",
    "campo-cedro": "Ristorante Campo Cedro Siena",
    "tartufo": "Ristorante Tar-Tufo Siena",
    "bagoga": "Grotta Santa Caterina da Bagoga Siena ristorante",
    "mugolone": "Ristorante Mugolone Siena",
    "terzi": "Enoteca I Terzi Siena",
    "vinattieri": "La Compagnia dei Vinattieri Siena",
    "trombicche": "Osteria da Trombicche Siena",
    "particolare": "Particolare di Siena ristorante",
    "capitano": "La Taverna del Capitano Siena ristorante",
    "salefino": "Salefino Vino e Cucina Siena",
    "chiacchera": "Osteria La Chiacchera Siena",
    "svitati": "Osteria degli Svitati Siena",
    "permalico": "Osteria Permalico Siena",
    "grattacielo": "Osteria Il Grattacielo Siena",
    "papei": "Antica Trattoria Papei Siena",
    "nonna-gina": "Osteria Nonna Gina Siena",
    "pretto": "Pretto Prosciutteria e Convivio Siena interno tagliere",
    "tellina": "Trattoria La Tellina Siena",
    "nannini": "Nannini Siena pasticceria caffe",
    "zest": "Zest ristorante Siena Costa dei Barbieri interno",
    "locanda-oste": "Locanda dell'Oste Siena ristorante",
    "fonte-giusta": "Trattoria Fonte Giusta Siena ristorante",
    "sosta-violante": "Osteria La Sosta di Violante Siena",
}

RE_MAPS = re.compile(r"https://lh3\.googleusercontent\.com/p/AF1Qip[A-Za-z0-9_-]+")
RE_PROXY = re.compile(r"https://lh3\.googleusercontent\.com/proxy/[A-Za-z0-9_-]+")
RE_TBN = re.compile(r"https://encrypted-tbn[0-9]\.gstatic\.com/images\?q=tbn:[A-Za-z0-9_-]+")

def render(query):
    url = "https://www.google.com/search?udm=2&hl=en&gl=us&q=" + urllib.parse.quote(query)
    cmd = ["chromium-browser", "--headless", "--no-sandbox", "--disable-gpu",
           "--dump-dom", "--virtual-time-budget=9000",
           "--user-agent=" + UA, url]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=70).stdout.decode("utf-8", "ignore")
        return out
    except Exception as e:
        print("  render error:", e)
        return ""

def pick(dom):
    # 優先: Googleマップの店舗写真（高品質・ホットリンク向き）
    m = RE_MAPS.search(dom)
    if m:
        return m.group(0) + "=w1000"   # 幅1000pxにリサイズ
    # 次点: proxy 経由の外部画像
    m = RE_PROXY.search(dom)
    if m:
        return m.group(0)
    # 最終: gstatic サムネイル（低解像度）
    m = RE_TBN.search(dom)
    if m:
        return m.group(0) + "&s=10"
    return None

def main():
    result = {}
    if os.path.exists(OUT):
        result = json.load(open(OUT))
    for _id, q in QUERIES.items():
        if result.get(_id):
            print(f"  [skip] {_id} (取得済)"); continue
        dom = render(q)
        u = pick(dom)
        if u:
            result[_id] = u
            kind = "maps" if "/p/AF1Qip" in u else ("proxy" if "/proxy/" in u else "tbn")
            print(f"  [ok]   {_id}  ({kind})")
        else:
            print(f"  [FAIL] {_id}  画像URL抽出できず: {q}")
        json.dump(result, open(OUT, "w"), ensure_ascii=False, indent=1)
        time.sleep(2.0)
    ok = len(result)
    print(f"== {ok}/{len(QUERIES)} 件のURLを {os.path.relpath(OUT, BASE)} に保存 ==")

if __name__ == "__main__":
    main()
