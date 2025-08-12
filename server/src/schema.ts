import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  password_hash: z.string(),
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// User input schemas
export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Group schema
export const groupSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date()
});

export type Group = z.infer<typeof groupSchema>;

// Group input schemas
export const createGroupInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  created_by: z.number()
});

export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;

export const updateGroupInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional()
});

export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>;

// Group member schema
export const groupMemberSchema = z.object({
  id: z.number(),
  group_id: z.number(),
  user_id: z.number(),
  role: z.enum(['admin', 'member']),
  joined_at: z.coerce.date()
});

export type GroupMember = z.infer<typeof groupMemberSchema>;

// Group member input schemas
export const addGroupMemberInputSchema = z.object({
  group_id: z.number(),
  user_id: z.number(),
  role: z.enum(['admin', 'member']).default('member')
});

export type AddGroupMemberInput = z.infer<typeof addGroupMemberInputSchema>;

export const removeGroupMemberInputSchema = z.object({
  group_id: z.number(),
  user_id: z.number()
});

export type RemoveGroupMemberInput = z.infer<typeof removeGroupMemberInputSchema>;

// Expense schema
export const expenseSchema = z.object({
  id: z.number(),
  group_id: z.number(),
  paid_by: z.number(),
  amount: z.number(),
  description: z.string(),
  created_at: z.coerce.date()
});

export type Expense = z.infer<typeof expenseSchema>;

// Expense input schemas
export const createExpenseInputSchema = z.object({
  group_id: z.number(),
  paid_by: z.number(),
  amount: z.number().positive(),
  description: z.string().min(1),
  participants: z.array(z.object({
    user_id: z.number(),
    share_amount: z.number().positive()
  }))
});

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  amount: z.number().positive().optional(),
  description: z.string().optional()
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

// Expense participant schema
export const expenseParticipantSchema = z.object({
  id: z.number(),
  expense_id: z.number(),
  user_id: z.number(),
  share_amount: z.number()
});

export type ExpenseParticipant = z.infer<typeof expenseParticipantSchema>;

// Settlement schema
export const settlementSchema = z.object({
  id: z.number(),
  group_id: z.number(),
  from_user: z.number(),
  to_user: z.number(),
  amount: z.number(),
  description: z.string().nullable(),
  settled_at: z.coerce.date()
});

export type Settlement = z.infer<typeof settlementSchema>;

// Settlement input schemas
export const createSettlementInputSchema = z.object({
  group_id: z.number(),
  from_user: z.number(),
  to_user: z.number(),
  amount: z.number().positive(),
  description: z.string().nullable()
});

export type CreateSettlementInput = z.infer<typeof createSettlementInputSchema>;

// Balance calculation result schema
export const userBalanceSchema = z.object({
  user_id: z.number(),
  user_name: z.string(),
  balance: z.number() // Positive = owed money, Negative = owes money
});

export type UserBalance = z.infer<typeof userBalanceSchema>;

export const groupBalancesSchema = z.object({
  group_id: z.number(),
  balances: z.array(userBalanceSchema)
});

export type GroupBalances = z.infer<typeof groupBalancesSchema>;

// Debt calculation result schema
export const debtSchema = z.object({
  from_user: z.number(),
  from_user_name: z.string(),
  to_user: z.number(),
  to_user_name: z.string(),
  amount: z.number()
});

export type Debt = z.infer<typeof debtSchema>;

export const groupDebtsSchema = z.object({
  group_id: z.number(),
  debts: z.array(debtSchema)
});

export type GroupDebts = z.infer<typeof groupDebtsSchema>;