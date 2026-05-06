import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// 1. tenants（コンサル先サロン = Clerk Organizationと1:1）
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clerkOrgId: text("clerk_org_id").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    lineChannelId: text("line_channel_id"),
    lineChannelAccessToken: text("line_channel_access_token"),
    lineChannelSecret: text("line_channel_secret"),
    liffId: text("liff_id"),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(2),
    reminderSendHour: integer("reminder_send_hour").notNull().default(9),
    reminderSendMinute: integer("reminder_send_minute").notNull().default(0),
    timezone: text("timezone").notNull().default("Asia/Tokyo"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_tenants_clerk_org").on(t.clerkOrgId),
    check(
      "tenants_reminder_send_hour_check",
      sql`${t.reminderSendHour} BETWEEN 0 AND 23`,
    ),
    check(
      "tenants_reminder_send_minute_check",
      sql`${t.reminderSendMinute} BETWEEN 0 AND 59`,
    ),
  ],
);

// 2. staff_users（アイリスト、Clerk user_id を主キーに）
export const staffUsers = pgTable(
  "staff_users",
  {
    id: text("id").primaryKey(), // Clerk user_id
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_staff_users_tenant").on(t.tenantId),
    check("staff_users_role_check", sql`${t.role} IN ('admin', 'staff')`),
  ],
);

// 3. customers
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKana: text("name_kana"),
    phoneLast4: text("phone_last4"),
    phoneFull: text("phone_full"),
    lineUserId: text("line_user_id"),
    lineDisplayName: text("line_display_name"),
    linePictureUrl: text("line_picture_url"),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_tenant_id_line_user_id_key").on(
      t.tenantId,
      t.lineUserId,
    ),
    index("idx_customers_tenant_search").on(
      t.tenantId,
      t.phoneLast4,
      t.nameKana,
    ),
    index("idx_customers_line_user_id")
      .on(t.tenantId, t.lineUserId)
      .where(sql`${t.lineUserId} IS NOT NULL`),
  ],
);

// 4. message_templates
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_templates_tenant").on(t.tenantId),
    uniqueIndex("idx_templates_one_default_per_tenant")
      .on(t.tenantId)
      .where(sql`${t.isDefault} = true`),
  ],
);

// 5. reminders
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    staffId: text("staff_id").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    templateId: uuid("template_id").references(() => messageTemplates.id, {
      onDelete: "set null",
    }),
    appointmentAt: timestamp("appointment_at", {
      withTimezone: true,
    }).notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_reminders_send_queue")
      .on(t.sendAt)
      .where(sql`${t.status} = 'pending'`),
    index("idx_reminders_tenant_status").on(
      t.tenantId,
      t.status,
      sql`${t.sendAt} DESC`,
    ),
    index("idx_reminders_customer").on(
      t.customerId,
      sql`${t.appointmentAt} DESC`,
    ),
    check(
      "reminders_status_check",
      sql`${t.status} IN ('pending', 'sent', 'failed', 'cancelled')`,
    ),
  ],
);

// 6. linking_tokens（QR紐付け用ワンタイムトークン）
export const linkingTokens = pgTable(
  "linking_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    staffId: text("staff_id").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_linking_tokens_token")
      .on(t.token)
      .where(sql`${t.usedAt} IS NULL`),
  ],
);

// 7. webhook_events
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    eventType: text("event_type").notNull(),
    lineUserId: text("line_user_id"),
    rawPayload: jsonb("raw_payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_webhook_events_tenant").on(
      t.tenantId,
      sql`${t.createdAt} DESC`,
    ),
    index("idx_webhook_events_unprocessed")
      .on(t.createdAt)
      .where(sql`${t.processed} = false`),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type StaffUser = typeof staffUsers.$inferSelect;
export type NewStaffUser = typeof staffUsers.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type LinkingToken = typeof linkingTokens.$inferSelect;
export type NewLinkingToken = typeof linkingTokens.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
