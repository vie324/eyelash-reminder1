# SPEC.md — アイラッシュサロン LINEリマインドツール

## 1. プロジェクト概要

### プロダクト名
アイラッシュサロン向け LINEリマインド自動化ツール（仮称: eyelash-reminder）

### 何を作るか
施術後にアイリストが「お客様の次回予約日時」をスマホで入力すると、
予約2日前の指定時刻に、サロンの公式LINEから自動でリマインドメッセージが送信される SaaS。

### ターゲット
コンサル先のアイラッシュサロン（マルチテナント前提）。
vie本体運用ではなく、独立プロダクトとして展開。

### 解決する課題
- 現状、アイリストが施術ごとに手動で公式LINEからリマインドを送っている
- 工数が大きく、漏れも発生
- → 「次回予約日時を入れるだけ」で完結する仕組みにしたい

### コア体験

**初回（顧客 ↔ LINE User ID 紐付け）:**
1. アイリストがスマホでアプリを開き、顧客検索 or 新規登録
2. 画面に出るQRコードをお客様のスマホでスキャン → 公式LINE上でLIFFが起動
3. お客様が「リマインドを受け取る」をタップ → User ID自動紐付け
4. アイリストが次回予約日時を入力 → 完了

**2回目以降:**
1. 顧客検索
2. 「2週後 同曜日 同時刻」サジェストをタップ or 微調整
3. 完了（5〜8秒）

---

## 2. プロダクト仕様（確定事項）

### 認証・テナント
- 認証: Clerk（既にOrganizations機能をEnable済み）
- テナント = Clerk Organization に1:1対応
- スタッフ（アイリスト）は必ずどこかのOrganizationに所属（Membership required）
- ロール: `admin` / `staff`

### 顧客管理
- 検索キー: 電話番号下4桁 or カナ
- LINE User IDは初回紐付け時にwebhook経由で取得・保存
- LINE公式アカウントの既存友だちが大半なので、紐付けUXが最重要

### 予約・リマインド
- テンプレート粒度: サロン単位（1テナント1〜複数テンプレ、デフォルト1個）
- 送信時刻: サロン単位でカスタム可（`reminder_days_before` / `reminder_send_hour` / `reminder_send_minute`）
- デフォルト: 2日前 9:00
- キャンセル時: 手動でステータス変更（自動連動なし）
- リトライ: 失敗時は `retry_count` をインクリメントして次回cronで再試行

### LINE連携
- 各サロンが自社の既存公式アカウントを使用
- サロンごとに `line_channel_access_token`, `line_channel_secret`, `liff_id` を保持
- 認証情報はアプリ層で暗号化して保存（AES-GCM等）

### Cron送信
- GitHub Actions cron で毎時0分起動
- ジョブが叩くエンドポイント: `POST /api/cron/send-reminders`（ヘッダで `CRON_SECRET` 認証）
- 該当時刻の `reminders.status = 'pending'` を全テナント横断で抽出 → サロンごとにグループ化 → LINE Push API で送信

### マルチテナント分離
- MVPはアプリ層で `tenant_id` フィルタを徹底（RLSは使わない）
- すべてのDBクエリは「現在のClerk Organization → tenant_id」を解決してからスコープを絞る
- Drizzleのクエリ層でラッパー関数を作って徹底する設計を推奨

---

## 3. 技術スタック

### フロントエンド
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- PWA対応（manifest.json + service worker、後フェーズ）

### 認証
- Clerk（Organizations機能利用）

### DB
- Neon (PostgreSQL serverless, Singapore region)
- Drizzle ORM + drizzle-kit

### LINE連携
- `@line/bot-sdk`（Messaging API）
- LIFF v2（紐付け用フロントエンド、別ルートで実装）

### インフラ
- Vercel（ホスティング）
- GitHub Actions（cron送信処理、毎時起動）

### その他
- nanoid（linking_token生成）
- qrcode（紐付けQR表示）
- date-fns + date-fns-tz（タイムゾーン処理）

---

## 4. ディレクトリ構造

```
eyelash-reminder/
├── CLAUDE.md                     # 開発ルール
├── docs/
│   ├── SPEC.md                   # 仕様書（本ファイル）
│   ├── SCHEMA.sql                # Neon DDL
│   └── ROADMAP.md                # 実装ロードマップ
├── src/
│   ├── app/
│   │   ├── (auth)/               # Clerk認証画面
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   ├── (dashboard)/          # ログイン後の本体
│   │   │   ├── layout.tsx        # ヘッダー、Organization切替
│   │   │   ├── page.tsx          # ホーム（今日の予定数等）
│   │   │   ├── customers/        # 顧客検索/登録
│   │   │   ├── reminders/        # リマインド一覧/作成
│   │   │   └── settings/         # サロン設定（admin限定）
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── clerk/        # Clerk webhook（Org/User同期）
│   │   │   │   └── line/[tenantId]/  # LINE webhook（紐付け処理）
│   │   │   ├── cron/
│   │   │   │   └── send-reminders/  # GitHub Actionsから叩かれる
│   │   │   └── linking/
│   │   │       └── [token]/      # LIFF用エンドポイント
│   │   └── liff/
│   │       └── [token]/          # LIFF画面（お客様用）
│   ├── db/
│   │   ├── schema.ts             # Drizzle スキーマ定義
│   │   ├── client.ts             # Neon接続クライアント
│   │   └── queries/              # 再利用クエリ（tenant scope付き）
│   ├── lib/
│   │   ├── tenant.ts             # 現在のtenant_id解決
│   │   ├── line.ts               # LINE Messaging APIラッパ
│   │   ├── crypto.ts             # Channel Access Token暗号化
│   │   └── template.ts           # テンプレート変数置換
│   └── components/
│       └── ui/                   # shadcn/ui
├── drizzle.config.ts
├── .env.local                    # 環境変数（コミット禁止）
└── .github/
    └── workflows/
        └── cron-send-reminders.yml  # GitHub Actions
```

---

## 5. データモデル
`docs/SCHEMA.sql` 参照。Drizzleスキーマ（`src/db/schema.ts`）はこのDDLと完全に一致させる。

---

## 6. 確認・質問について

実装を進める中で仕様が曖昧な点があれば、勝手に判断せず必ず質問する。
特に以下は判断を委ねる前に確認:

- LINE送信の文面・表現
- セキュリティに関わる実装（暗号化方式、認証フロー）
- 不可逆な変更（DBスキーマ変更、削除処理）
- Clerk Webhookで受け取るイベント種別
