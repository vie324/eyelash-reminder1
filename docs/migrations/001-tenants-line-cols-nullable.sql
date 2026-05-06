-- ======================================================
-- Migration: tenants の LINE関連4カラムを NULL許容に変更
-- 適用先: Sakaiさんが既に SCHEMA.sql を実行済みの Neon DB
-- 理由:
--   Clerk Webhook の organization.created イベントで tenants 行を自動作成する際、
--   line_channel_id / line_channel_access_token / line_channel_secret / liff_id は
--   未取得（admin が後から /settings/line で設定する）。
--   そのため NULL を許容する。
-- ======================================================

ALTER TABLE tenants
  ALTER COLUMN line_channel_id DROP NOT NULL,
  ALTER COLUMN line_channel_access_token DROP NOT NULL,
  ALTER COLUMN line_channel_secret DROP NOT NULL,
  ALTER COLUMN liff_id DROP NOT NULL;
