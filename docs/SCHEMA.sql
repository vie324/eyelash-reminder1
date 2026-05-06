-- ======================================================
-- アイラッシュサロン LINEリマインドツール
-- Neon (PostgreSQL) + Clerk認証
-- ======================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. tenants（コンサル先サロン = Clerk Organizationと1:1）
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  line_channel_id TEXT,                       -- NULL許容: Clerk Webhookで作成された直後はNULL、admin設定で埋める
  line_channel_access_token TEXT,             -- NULL許容 + 暗号化保存（src/lib/crypto.ts）
  line_channel_secret TEXT,                   -- NULL許容 + 暗号化保存
  liff_id TEXT,                               -- NULL許容
  reminder_days_before INT NOT NULL DEFAULT 2,
  reminder_send_hour INT NOT NULL DEFAULT 9 CHECK (reminder_send_hour BETWEEN 0 AND 23),
  reminder_send_minute INT NOT NULL DEFAULT 0 CHECK (reminder_send_minute BETWEEN 0 AND 59),
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_clerk_org ON tenants(clerk_org_id);

-- 2. staff_users（アイリスト、Clerk user_id を主キーに）
CREATE TABLE staff_users (
  id TEXT PRIMARY KEY,                        -- Clerk user_id
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_users_tenant ON staff_users(tenant_id);

-- 3. customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_kana TEXT,
  phone_last4 TEXT,
  phone_full TEXT,
  line_user_id TEXT,
  line_display_name TEXT,
  line_picture_url TEXT,
  linked_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, line_user_id)
);
CREATE INDEX idx_customers_tenant_search ON customers(tenant_id, phone_last4, name_kana);
CREATE INDEX idx_customers_line_user_id ON customers(tenant_id, line_user_id) WHERE line_user_id IS NOT NULL;

-- 4. message_templates
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_tenant ON message_templates(tenant_id);
CREATE UNIQUE INDEX idx_templates_one_default_per_tenant ON message_templates(tenant_id) WHERE is_default = true;

-- 5. reminders
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id TEXT REFERENCES staff_users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  appointment_at TIMESTAMPTZ NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_send_queue ON reminders(send_at) WHERE status = 'pending';
CREATE INDEX idx_reminders_tenant_status ON reminders(tenant_id, status, send_at DESC);
CREATE INDEX idx_reminders_customer ON reminders(customer_id, appointment_at DESC);

-- 6. linking_tokens（QR紐付け用ワンタイムトークン）
CREATE TABLE linking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id TEXT REFERENCES staff_users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_linking_tokens_token ON linking_tokens(token) WHERE used_at IS NULL;

-- 7. webhook_events
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  line_user_id TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_events_tenant ON webhook_events(tenant_id, created_at DESC);
CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(created_at) WHERE processed = false;

-- updated_atトリガ
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reminders_updated_at BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- send_at自動算出トリガ
CREATE OR REPLACE FUNCTION calc_reminder_send_at() RETURNS TRIGGER AS $$
DECLARE v_days_before INT; v_hour INT; v_minute INT; v_tz TEXT;
BEGIN
  SELECT reminder_days_before, reminder_send_hour, reminder_send_minute, timezone
    INTO v_days_before, v_hour, v_minute, v_tz FROM tenants WHERE id = NEW.tenant_id;
  NEW.send_at := (
    (NEW.appointment_at AT TIME ZONE v_tz)::date
    - (v_days_before || ' days')::interval
    + (v_hour || ' hours')::interval
    + (v_minute || ' minutes')::interval
  ) AT TIME ZONE v_tz;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reminders_calc_send_at BEFORE INSERT OR UPDATE OF appointment_at ON reminders
  FOR EACH ROW EXECUTE FUNCTION calc_reminder_send_at();
