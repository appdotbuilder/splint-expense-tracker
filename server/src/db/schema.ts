import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const groupMemberRoleEnum = pgEnum('group_member_role', ['admin', 'member']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Groups table
export const groupsTable = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Group members table (junction table)
export const groupMembersTable = pgTable('group_members', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').notNull().references(() => groupsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  role: groupMemberRoleEnum('role').notNull().default('member'),
  joined_at: timestamp('joined_at').defaultNow().notNull(),
});

// Expenses table
export const expensesTable = pgTable('expenses', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').notNull().references(() => groupsTable.id, { onDelete: 'cascade' }),
  paid_by: integer('paid_by').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Expense participants table (tracks who participated in each expense and their share)
export const expenseParticipantsTable = pgTable('expense_participants', {
  id: serial('id').primaryKey(),
  expense_id: integer('expense_id').notNull().references(() => expensesTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  share_amount: numeric('share_amount', { precision: 10, scale: 2 }).notNull(),
});

// Settlements table (tracks when debts are settled)
export const settlementsTable = pgTable('settlements', {
  id: serial('id').primaryKey(),
  group_id: integer('group_id').notNull().references(() => groupsTable.id, { onDelete: 'cascade' }),
  from_user: integer('from_user').notNull().references(() => usersTable.id),
  to_user: integer('to_user').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  settled_at: timestamp('settled_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdGroups: many(groupsTable),
  groupMemberships: many(groupMembersTable),
  paidExpenses: many(expensesTable),
  expenseParticipations: many(expenseParticipantsTable),
  settlementsFrom: many(settlementsTable, { relationName: 'from_user_settlements' }),
  settlementsTo: many(settlementsTable, { relationName: 'to_user_settlements' }),
}));

export const groupsRelations = relations(groupsTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [groupsTable.created_by],
    references: [usersTable.id],
  }),
  members: many(groupMembersTable),
  expenses: many(expensesTable),
  settlements: many(settlementsTable),
}));

export const groupMembersRelations = relations(groupMembersTable, ({ one }) => ({
  group: one(groupsTable, {
    fields: [groupMembersTable.group_id],
    references: [groupsTable.id],
  }),
  user: one(usersTable, {
    fields: [groupMembersTable.user_id],
    references: [usersTable.id],
  }),
}));

export const expensesRelations = relations(expensesTable, ({ one, many }) => ({
  group: one(groupsTable, {
    fields: [expensesTable.group_id],
    references: [groupsTable.id],
  }),
  paidBy: one(usersTable, {
    fields: [expensesTable.paid_by],
    references: [usersTable.id],
  }),
  participants: many(expenseParticipantsTable),
}));

export const expenseParticipantsRelations = relations(expenseParticipantsTable, ({ one }) => ({
  expense: one(expensesTable, {
    fields: [expenseParticipantsTable.expense_id],
    references: [expensesTable.id],
  }),
  user: one(usersTable, {
    fields: [expenseParticipantsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const settlementsRelations = relations(settlementsTable, ({ one }) => ({
  group: one(groupsTable, {
    fields: [settlementsTable.group_id],
    references: [groupsTable.id],
  }),
  fromUser: one(usersTable, {
    fields: [settlementsTable.from_user],
    references: [usersTable.id],
    relationName: 'from_user_settlements',
  }),
  toUser: one(usersTable, {
    fields: [settlementsTable.to_user],
    references: [usersTable.id],
    relationName: 'to_user_settlements',
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Group = typeof groupsTable.$inferSelect;
export type NewGroup = typeof groupsTable.$inferInsert;

export type GroupMember = typeof groupMembersTable.$inferSelect;
export type NewGroupMember = typeof groupMembersTable.$inferInsert;

export type Expense = typeof expensesTable.$inferSelect;
export type NewExpense = typeof expensesTable.$inferInsert;

export type ExpenseParticipant = typeof expenseParticipantsTable.$inferSelect;
export type NewExpenseParticipant = typeof expenseParticipantsTable.$inferInsert;

export type Settlement = typeof settlementsTable.$inferSelect;
export type NewSettlement = typeof settlementsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  groups: groupsTable,
  groupMembers: groupMembersTable,
  expenses: expensesTable,
  expenseParticipants: expenseParticipantsTable,
  settlements: settlementsTable,
};