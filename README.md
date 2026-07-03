# シエナ 美食・観光ガイド

イタリア・トスカーナ州シエナの **レストラン・郷土料理・観光名所** をまとめた、スマートフォン最適化の静的Webサイトです。現地調査ノート（Markdown）を構造化データに変換して構築しています。

## 特徴

- **トップページ**（`index.html`）：シエナ全景を背景にしたランディング。各セクションへの導線。
- **ガイド本体**（`guide.html`）：5タブ構成 — レストラン（26）／食べ物（21）／観光（21）／マップ／地区
- **全文検索**：店名・料理名・エリア・地区・特徴などを横断検索
- **タグ絞り込み**：カテゴリや特徴のタグでフィルタ（多い場合は折りたたみ表示）
- **詳細モーダル**：営業時間・価格・レビュー・見どころ・名物・**位置マップ**などを表示
- **相互リンク**：レストラン ↔ 郷土料理 ↔ 観光名所を相互に行き来できる
- **統合マップ**（Leaflet + OpenStreetMap/CARTO）：レストラン・観光を色分けマーカーで一覧。種別・地区でフィルタ、マーカー→詳細へ。
- **地区（実用エリア）別**：地区ごとのミニマップ＋施設リスト。全44地点をジオコーディングし6エリアに分類。
- **位置の一目表示**：各カード／詳細に「シエナ地図＋現在地の点」を表示（基準地図1枚＋座標投影）。
- **Googleマップリンク**：各スポットを地図で開ける／写真検索リンク付き
- **実画像**：食べ物・観光名所は Wikimedia Commons の実画像を同梱、レストランは Google（マップ店舗写真）をホットリンク
- **スマホ最適化**：レスポンシブ、ダークモード対応、URLハッシュでタブ共有可（`guide.html#map` など）

## 使い方（ローカル）

`index.html`（トップ）または `guide.html`（ガイド本体）をブラウザで開くだけ（ビルド不要）。
※ 統合マップは表示時に Leaflet(CDN) と地図タイルをブラウザが読み込むため、閲覧にはインターネット接続が必要です。

## GitHub Pages での公開

1. このディレクトリ（`siena-guide/`）を任意のリポジトリに配置
2. リポジトリの **Settings → Pages** で公開ブランチ／フォルダを指定
3. 公開URLにアクセス

> `data/data.js` はグローバル変数として読み込むため、`file://` でもそのまま動作します（fetch/CORS不要）。

## ディレクトリ構成

```
siena-guide/
├── index.html          # トップページ（ランディング）
├── guide.html          # ガイド本体（5タブ）
├── css/style.css       # スタイル（レスポンシブ・ダークモード）
├── js/app.js           # タブ・検索・タグ・モーダル・相互リンク・Leaflet地図・地区
├── data/data.js        # 全データ（座標・地区・基準地図投影 SIENA_PROJ を含む）
├── images/             # hero.jpg・map/siena-base.jpg・foods/・attractions/
└── tools/
    ├── fetch_images.py               # Wikimedia Commons から画像取得
    ├── optimize_images.py            # 画像を1280px/JPEG品質82に最適化
    ├── fetch_restaurant_image_urls.py# レストランのGoogle画像URL抽出
    ├── geocode.py                    # 全地点をNominatimでジオコーディング
    ├── geo.json / zones.json / proj.json  # 座標・地区・基準地図投影（生成物）
    └── places.json                   # ジオコーディング対象一覧（生成物）
```

## 画像について

- **食べ物・観光名所**：Wikimedia Commons（CC / パブリックドメイン）の実画像をローカル保存（`images/`）。リンク切れ防止のためリポジトリに同梱。ライセンスは各ファイルの Commons ページを参照（再配布時は帰属表示が必要な場合あり）。
- **レストラン**：Google（主に Google マップの店舗写真 `lh3.googleusercontent.com/p/…`、一部 gstatic サムネイル）を **ホットリンク**（`data/data.js` に URL を直接記載）。ダウンロードはしていません。将来 URL が失効した場合は、UI 側で自動的に店名入りプレースホルダにフォールバックします。
- 画像が読み込めない場合でも、各カード/モーダルの「📷 写真を検索」から Google 画像検索を開けます。

### レストラン画像URLの再取得（リンク切れ時など）

```bash
# 1. Google画像検索(udm=2)をヘッドレスChromiumでレンダリングしURL抽出
python3 tools/fetch_restaurant_image_urls.py     # -> tools/restaurant_image_urls.json
# 2. 抽出URLを data/data.js の各レストラン image に反映（下記のような小スクリプトで置換）
```
（`tools/restaurant_image_urls.json` の `{id: url}` を `data/data.js` の該当 image に差し替えます。要 `chromium-browser` と www.google.com へのアクセス）

## データ出典

シエナ現地調査ノート（2026年）：
- シエナのレストラン調査
- シエナの観光スポット情報
- compass_artifact（レストラン／観光の2ファイル）

## 画像の更新

```bash
python3 tools/fetch_images.py            # 全カテゴリ取得（既存はスキップ）
python3 tools/fetch_images.py foods      # 食べ物のみ
python3 tools/optimize_images.py         # 取得後に最適化
```

※ 取得には commons.wikimedia.org / upload.wikimedia.org へのアクセスが必要です。
