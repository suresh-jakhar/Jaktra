import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  date,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  boolean,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'viewer',
]);

export const providerEnum = pgEnum('integration_provider', ['sendgrid', 'smtp']);
export const defaultEmailProviderEnum = pgEnum('default_email_provider', ['sendgrid', 'smtp']);
export const validationResultEnum = pgEnum('validation_result', [
  'valid', 'invalid', 'revoked', 'insufficient_scope', 'unverified_sender', 'unknown'
]);


export const paymentStatusEnum = pgEnum('payment_status', [
  'Pending',
  'Paid',
  'Overdue',
  'Written Off',
]);


export const urgencyTierEnum = pgEnum('urgency_tier', [
  'stage_1_warm',
  'stage_2_firm',
  'stage_3_serious',
  'stage_4_stern',
  'legal_escalation',
]);


export const communicationChannelEnum = pgEnum('communication_channel', [
  'email',
  'sms',
  'whatsapp',
]);


export const communicationStatusEnum = pgEnum('communication_status', [
  'pending',
  'sent',
  'failed',
]);


export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default(''),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('viewer'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [

    uniqueIndex('users_email_tenant_id_uniq').on(table.email, table.tenantId),
  ]
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    invoiceNo: text('invoice_no').notNull(),
    clientName: text('client_name').notNull(),
    invoiceAmount: numeric('invoice_amount', { precision: 14, scale: 2 }).notNull(),
    dueDate: date('due_date').notNull(),
    contactEmail: text('contact_email').notNull(),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('Pending'),
    followupCount: integer('followup_count').notNull().default(0),
    lastFollowupDate: timestamp('last_followup_date', { withTimezone: true }),
    urgencyTier: urgencyTierEnum('urgency_tier'),
    externalRefId: text('external_ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('invoices_invoice_no_tenant_id_uniq').on(
      table.invoiceNo,
      table.tenantId
    ),
    index('invoices_tenant_id_payment_status_idx').on(
      table.tenantId,
      table.paymentStatus
    ),
    index('invoices_external_ref_id_idx').on(table.externalRefId),
  ]
);

export const communications = pgTable(
  'communications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    channel: communicationChannelEnum('channel').notNull(),
    subject: text('subject'),
    body: text('body'),
    status: communicationStatusEnum('status').notNull().default('pending'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [

    index('communications_invoice_id_status_sent_at_idx').on(
      table.invoiceId,
      table.status,
      table.sentAt
    ),
  ]
);


export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload'),
    actor: text('actor').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('events_invoice_id_created_at_idx').on(
      table.invoiceId,
      table.createdAt
    ),
  ]
);


export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('running'), // running, completed, failed
    startTime: timestamp('start_time', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endTime: timestamp('end_time', { withTimezone: true }),
    invoicesProcessed: integer('invoices_processed').notNull().default(0),
    emailsSent: integer('emails_sent').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    errorDetails: text('error_details'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('agent_runs_tenant_id_start_time_idx').on(
      table.tenantId,
      table.startTime
    ),
  ]
);

export const dlqEntries = pgTable('dlq_entries', {
  invoiceId: uuid('invoice_id')
    .primaryKey()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(1),
  lastError: text('last_error'),
  firstFailure: timestamp('first_failure', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastFailure: timestamp('last_failure', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull().default('Company'),
  senderName: text('sender_name').notNull(),
  senderEmail: text('sender_email').notNull(),
  replyTo: text('reply_to'),
  paymentLink: text('payment_link'),
  bankDetails: text('bank_details'),
  timezone: text('timezone').notNull().default('UTC'),
  scheduleHour: integer('schedule_hour').notNull().default(9),
  idempotencyWindowHours: integer('idempotency_window_hours').notNull().default(20),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  defaultEmailProvider: defaultEmailProviderEnum('default_email_provider'),
});

export const tenantIntegrations = pgTable('tenant_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),

  ciphertext: text('ciphertext').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  keyVersion: integer('key_version').notNull().default(1),

  lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
  lastValidationResult: validationResultEnum('last_validation_result').notNull().default('unknown'),
  lastOperationalErrorCode: text('last_operational_error_code'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    tenantProviderUniq: unique('tenant_integrations_tenant_provider_uniq').on(table.tenantId, table.provider)
  };
});

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  users: many(users),
  invoices: many(invoices),
  agentRuns: many(agentRuns),
  settings: one(tenantSettings, {
    fields: [tenants.id],
    references: [tenantSettings.tenantId],
  }),
  integrations: many(tenantIntegrations),
}));

export const tenantIntegrationsRelations = relations(tenantIntegrations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantIntegrations.tenantId],
    references: [tenants.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  communications: many(communications),
  events: many(events),
  dlqEntry: one(dlqEntries, {
    fields: [invoices.id],
    references: [dlqEntries.invoiceId],
  }),
}));

export const communicationsRelations = relations(communications, ({ one }) => ({
  invoice: one(invoices, {
    fields: [communications.invoiceId],
    references: [invoices.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  invoice: one(invoices, {
    fields: [events.invoiceId],
    references: [invoices.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  tenant: one(tenants, {
    fields: [agentRuns.tenantId],
    references: [tenants.id],
  }),
}));

export const dlqEntriesRelations = relations(dlqEntries, ({ one }) => ({
  invoice: one(invoices, {
    fields: [dlqEntries.invoiceId],
    references: [invoices.id],
  }),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantSettings.tenantId],
    references: [tenants.id],
  }),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Communication = typeof communications.$inferSelect;
export type NewCommunication = typeof communications.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

export type DlqEntry = typeof dlqEntries.$inferSelect;
export type NewDlqEntry = typeof dlqEntries.$inferInsert;

export type TenantSettings = typeof tenantSettings.$inferSelect;
export type NewTenantSettings = typeof tenantSettings.$inferInsert;

export type TenantIntegration = typeof tenantIntegrations.$inferSelect;
export type NewTenantIntegration = typeof tenantIntegrations.$inferInsert;
export const teamInvitations = pgTable('team_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: userRoleEnum('role').default('viewer').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  invitedByUserId: uuid('invited_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  deliveryStatus: text('delivery_status').default('pending').notNull(),
  deliveryError: text('delivery_error'),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type NewTeamInvitation = typeof teamInvitations.$inferInsert;
