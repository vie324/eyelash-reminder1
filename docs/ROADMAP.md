# 実装ロードマップ

## Phase 1: 基盤（最優先）
- [ ] Drizzleスキーマ定義（schema.ts）
- [ ] Neon接続クライアント（client.ts）
- [ ] tenant.ts: 現在のClerk Org → tenant_id解決ヘルパ
- [ ] Clerk Webhook受信API（Org作成・User作成イベント → tenants/staff_users自動同期）
- [ ] crypto.ts: AES-GCM暗号化ヘルパ（LINE token保存用）

## Phase 2: 顧客管理
- [ ] /customers: 顧客一覧（検索: 電話下4桁/カナ）
- [ ] /customers/new: 新規登録モーダル
- [ ] /customers/[id]: 顧客詳細
- [ ] tenant scopeのDrizzleクエリ層

## Phase 3: 紐付けフロー
- [ ] linking_tokens生成API
- [ ] QRコード表示UI（顧客詳細画面）
- [ ] LIFF画面（/liff/[token]）: お客様タップで User ID紐付け
- [ ] LINE Webhook受信API（/api/webhooks/line/[tenantId]）
- [ ] 紐付け完了後のリアルタイム反映（Server-Sent Events or polling）

## Phase 4: 次回予約登録
- [ ] /reminders/new: 顧客選択 → 日時入力 → テンプレ確認 → 登録
- [ ] 「2週後 同曜日 同時刻」サジェスト機能
- [ ] 登録後のreminders.send_at自動算出確認

## Phase 5: Cron送信
- [ ] /api/cron/send-reminders エンドポイント実装
  - CRON_SECRET認証
  - 該当時刻のpending抽出
  - LINE Push API送信
  - status更新（sent/failed）
- [ ] テンプレート変数置換（{{customer_name}} 等）
- [ ] GitHub Actions workflow作成（毎時0分起動）

## Phase 6: 設定画面（admin限定）
- [ ] /settings/salon: サロン情報編集
- [ ] /settings/templates: テンプレート編集
- [ ] /settings/line: LINE Channel設定（暗号化保存）
- [ ] /settings/staff: スタッフ管理（Clerk Organization招待リンク）

## Phase 7: 仕上げ
- [ ] PWA対応（manifest.json, service worker）
- [ ] エラー監視（Sentry検討）
- [ ] アクセス解析
- [ ] 1社実運用テスト
