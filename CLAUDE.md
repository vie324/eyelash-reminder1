# CLAUDE.md - eyelash-reminder

## プロジェクト概要
アイラッシュサロン向け LINEリマインド自動化SaaS。
コンサル先サロン（マルチテナント）が利用する独立プロダクト。

施術後にアイリストが「お客様の次回予約日時」をスマホで入力すると、
予約2日前の指定時刻に、サロンの公式LINEから自動でリマインドメッセージが送信される。

## 技術スタック
- Next.js 16 (App Router) + TypeScript
- Clerk (認証 + Organizations)
- Neon (PostgreSQL serverless, Singapore) + Drizzle ORM
- Tailwind CSS + shadcn/ui
- LINE Messaging API + LIFF v2
- GitHub Actions (cron)
- Vercel (ホスティング)

## 開発ルール

### ブランチ運用
- `main`: 本番（Vercel本番環境）
- `feat/<機能名>`: 機能追加
- `fix/<内容>`: バグ修正
- PR経由でmergeし、Vercel preview URLで確認後にマージ

### コーディングルール

1. **マルチテナント分離は最優先**
   - すべてのDBクエリは `tenant_id` でスコープを絞る
   - `src/lib/tenant.ts` の `getCurrentTenantId()` を必ず経由する
   - `src/db/queries/` に再利用クエリを集約し、生のSQLやDrizzleクエリをページコンポーネントに書かない
   - MVPはアプリ層で `tenant_id` フィルタを徹底（RLSは使わない）

2. **型安全**
   - DrizzleのInferSelectModel/InferInsertModelで型を導出
   - APIルートはZodで入力バリデーション

3. **時刻処理**
   - すべて `date-fns-tz` で `Asia/Tokyo` 前提
   - DBはTIMESTAMPTZで保存、表示時にTZ変換

4. **シークレット**
   - `line_channel_access_token`, `line_channel_secret` は `src/lib/crypto.ts` でAES-GCM暗号化保存
   - `.env.local` は絶対にcommitしない

5. **エラーハンドリング**
   - LINE送信失敗時は `reminders.error_message` に記録、`retry_count` をインクリメント
   - Cronは部分失敗してもジョブ全体を落とさない

### ディレクトリ
- ページ: `src/app/`
- DB: `src/db/`
- 共通ロジック: `src/lib/`
- UIコンポーネント: `src/components/`
- ドキュメント: `docs/`

### 新機能の追加手順
1. `docs/ROADMAP.md` で該当タスクを確認
2. ブランチ作成 `feat/<name>`
3. 実装
4. ローカルで `npm run dev` 確認
5. PR作成 → Vercel previewで確認
6. マージ

### 仕様確認
迷ったら `docs/SPEC.md` を見る。SPECに書いてないことはSakaiさんに確認。

## 重要：実装前に確認すべき事項
- LINE送信の文面・表現
- セキュリティに関わる実装（暗号化方式、認証フロー）
- 不可逆な変更（DBスキーマ変更、削除処理）
- Clerk Webhookで受け取るイベント種別
