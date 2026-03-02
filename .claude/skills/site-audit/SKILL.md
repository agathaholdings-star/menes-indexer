---
name: site-audit
description: サイトをChrome MCPで巡回し、画像抜け・表示崩れ・エラーを検出。問題セラピストの画像は公式サイトから回収してDB更新する。
allowed-tools: Read, Glob, Grep, Bash, mcp__chrome-devtools__*, mcp__playwright__*
---

# サイト巡回＆画像リカバリー Bot

メンエスインデクサのサイトをChrome MCPで巡回し、画像が表示されていない箇所を見つけ、原因調査→画像回収を行う。

## ワークフロー

### Phase 1: DB状態スキャン

まずDBに接続して画像の状態を把握する。

```bash
cd /Users/agatha/Desktop/project/menethe-indexer/database/therapist-scraper
python image_recovery.py audit
```

これで `storage_ok` / `external_only` / `empty` / `null` の件数がわかる。

### Phase 2: Chrome MCPでサイト巡回

ローカル開発サーバーを巡回する。ポートは `pnpm dev` で確認（通常 `http://localhost:3001`）。サーバーが起動していなければ先に起動する:

```bash
cd /Users/agatha/Desktop/project/menethe-indexer/frontend/demo1 && pnpm dev
```

#### 巡回するページ

以下のページを順番にChrome MCPで開き、スクリーンショットを撮って問題を確認する。
**注意**: ページ内の画像は `loading="lazy"` なので、`evaluate_script` でスクロールしてから壊れた画像を検出すること。

1. **トップページ**: `http://localhost:3001`
   - 人気セラピストの画像が正しく表示されているか
   - レイアウト崩れがないか

2. **エリア一覧**: `http://localhost:3001/area`
   - エリア詳細のURLは `/area/[prefecture]/[district]` 形式（例: `/area/tokyo/ikebukuro`）
   - DBで確認: `SELECT a.slug, p.slug as pref FROM areas a JOIN prefectures p ON p.id = a.prefecture_id LIMIT 5`

3. **サロン詳細**:
   - DBからサロンIDをいくつか取得して確認
   - `http://localhost:3001/shop/[id]`
   - セラピスト一覧のサムネイル画像

4. **セラピスト詳細**:
   - Phase 1で特定した画像なしセラピストのIDを使う
   - `http://localhost:3001/therapist/[id]`
   - 画像ギャラリーの表示

5. **検索結果**: `http://localhost:3001/search`
   - サムネイル画像の表示

#### 各ページでの確認項目

Chrome MCPの以下ツールを使う:

- `navigate_page` でページ遷移
- `take_screenshot` でスクショ撮影
- `evaluate_script` でスクロール→壊れた画像を検出:
  ```javascript
  async () => {
    // lazy imageを全て読み込ませるためスクロール
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 2000));
    // 壊れた画像を検出
    const imgs = Array.from(document.querySelectorAll('img'));
    const broken = imgs.filter(img =>
      img.src && !img.src.startsWith('data:') && img.complete && img.naturalWidth === 0
    );
    return { total: imgs.length, ok: imgs.length - broken.length,
      broken: broken.map(i => ({src: i.src, alt: i.alt})) };
  }
  ```
- `list_console_messages` でコンソールエラー確認
- `list_network_requests` で画像の404エラー確認

### Phase 3: 問題の原因調査

壊れた画像を見つけたら:

1. **DBを確認**: そのセラピストの `image_urls` を確認
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
     "SELECT id, name, image_urls FROM therapists WHERE id = <ID>"
   ```

2. **原因を分類**:
   - `image_urls` が NULL or 空 → 画像データ自体がない
   - `image_urls` が外部URL → DL時に拒否された
   - `image_urls` が Storage URL → Storageの問題（アップロード失敗等）

3. **source_url を確認**: セラピストの公式プロフィールページ
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
     "SELECT source_url, s.official_url FROM therapists t JOIN salons s ON s.id = t.salon_id WHERE t.id = <ID>"
   ```

### Phase 4: 画像リカバリー

#### 方法A: 公式サイトから手動回収

Chrome MCPで公式サイトを訪問:
1. `navigate_page` で `source_url` を開く
2. `take_screenshot` で画像があるか確認
3. 画像が見つかったら、そのURLを取得
4. `image_recovery.py` で回収:
   ```bash
   cd /Users/agatha/Desktop/project/menethe-indexer/database/therapist-scraper
   python image_recovery.py single --id <THERAPIST_ID> --urls "<IMAGE_URL1>,<IMAGE_URL2>"
   ```

#### 方法B: バッチ自動リカバリー

source_urlから自動で画像を抽出・回収:
```bash
cd /Users/agatha/Desktop/project/menethe-indexer/database/therapist-scraper

# まず少数でdry-run
python image_recovery.py scan --limit 10 --dry-run

# 問題なければ実行
python image_recovery.py scan --workers 5 --limit 100

# 画像なしのみ対象
python image_recovery.py scan --target empty --workers 5

# 外部URLのみ対象（再DL試行）
python image_recovery.py scan --target external --workers 5
```

### Phase 5: 結果確認

リカバリー後、もう一度Chrome MCPで該当ページを開いて画像が表示されることを確認する。

### レポート

最後に以下をユーザーに報告する:

- チェックしたページ数と種別
- 発見した問題の一覧（ページURL、問題の種類、スクショ）
- 画像回収の結果（成功/失敗件数）
- 残りの要手動対応項目

## 重要な注意事項

- **対象は「本来あるのに表示されてないもの」だけ。無理なやつは放置する。**
  - 外部URLが失効・サイトがブロック → しょうがない、スキップ
  - source_urlが404（退店済み） → しょうがない、スキップ
  - 元サイトに画像が存在するのにDBに入ってないもの → これだけ回収する
- ローカル開発環境のDB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- ローカルdevサーバー: 通常 `http://localhost:3001`（ポート確認必須）
- Supabase Storage URL: `http://127.0.0.1:54321/storage/v1/object/public/therapist-images/...`
- セラピスト画像パス: `{salon_id}/{therapist_id}/{001|002|003}.webp`
- 外部サイトへのアクセスはrate limitに注意（デフォルト5並列）
- SKR/HR はセンシティブ内容の隠語、表現に注意
