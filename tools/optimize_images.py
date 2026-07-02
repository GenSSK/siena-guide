#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""images/ 配下の画像を最大幅1280px・JPEG品質82に最適化（モバイル快適化・GitHub軽量化）。"""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXW = 1280
Q = 82

def main():
    root = os.path.join(BASE, "images")
    total_before = total_after = 0
    for dirpath, _, files in os.walk(root):
        for fn in files:
            if not fn.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            p = os.path.join(dirpath, fn)
            before = os.path.getsize(p)
            total_before += before
            try:
                im = Image.open(p)
                im = im.convert("RGB")
                # 長辺を MAXW 以下に（幅・高さ双方を制限しパノラマの肥大を防ぐ）
                if max(im.width, im.height) > MAXW:
                    im.thumbnail((MAXW, MAXW), Image.LANCZOS)
                out = os.path.splitext(p)[0] + ".jpg"
                im.save(out, "JPEG", quality=Q, optimize=True, progressive=True)
                if out != p:
                    os.remove(p)
                after = os.path.getsize(out)
                total_after += after
                if before != after:
                    print(f"  {os.path.relpath(out, BASE)}: {before//1024}KB -> {after//1024}KB")
            except Exception as e:
                print(f"  [FAIL] {fn}: {e}")
                total_after += before
    print(f"== 合計: {total_before//1024}KB -> {total_after//1024}KB ==")

if __name__ == "__main__":
    main()
