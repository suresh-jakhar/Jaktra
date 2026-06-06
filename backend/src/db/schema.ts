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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'viewer',
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
  'dry_run',
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

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  invoices: many(invoices),
  agentRuns: many(agentRuns),
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
