import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  loginUserInputSchema,
  createGroupInputSchema,
  updateGroupInputSchema,
  addGroupMemberInputSchema,
  removeGroupMemberInputSchema,
  createExpenseInputSchema,
  updateExpenseInputSchema,
  createSettlementInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { loginUser } from './handlers/login_user';
import { createGroup } from './handlers/create_group';
import { updateGroup } from './handlers/update_group';
import { getUserGroups } from './handlers/get_user_groups';
import { addGroupMember } from './handlers/add_group_member';
import { removeGroupMember } from './handlers/remove_group_member';
import { getGroupMembers } from './handlers/get_group_members';
import { createExpense } from './handlers/create_expense';
import { getGroupExpenses } from './handlers/get_group_expenses';
import { updateExpense } from './handlers/update_expense';
import { deleteExpense } from './handlers/delete_expense';
import { calculateGroupBalances } from './handlers/calculate_group_balances';
import { calculateGroupDebts } from './handlers/calculate_group_debts';
import { createSettlement } from './handlers/create_settlement';
import { getGroupSettlements } from './handlers/get_group_settlements';
import { getUserByEmail } from './handlers/get_user_by_email';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  getUserByEmail: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(({ input }) => getUserByEmail(input.email)),

  // Group management
  createGroup: publicProcedure
    .input(createGroupInputSchema)
    .mutation(({ input }) => createGroup(input)),

  getUserGroups: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserGroups(input.userId)),

  updateGroup: publicProcedure
    .input(updateGroupInputSchema)
    .mutation(({ input }) => updateGroup(input)),

  // Group members
  addGroupMember: publicProcedure
    .input(addGroupMemberInputSchema)
    .mutation(({ input }) => addGroupMember(input)),

  removeGroupMember: publicProcedure
    .input(removeGroupMemberInputSchema)
    .mutation(({ input }) => removeGroupMember(input)),

  getGroupMembers: publicProcedure
    .input(z.object({ groupId: z.number() }))
    .query(({ input }) => getGroupMembers(input.groupId)),

  // Expense management
  createExpense: publicProcedure
    .input(createExpenseInputSchema)
    .mutation(({ input }) => createExpense(input)),

  getGroupExpenses: publicProcedure
    .input(z.object({ groupId: z.number() }))
    .query(({ input }) => getGroupExpenses(input.groupId)),

  updateExpense: publicProcedure
    .input(updateExpenseInputSchema)
    .mutation(({ input }) => updateExpense(input)),

  deleteExpense: publicProcedure
    .input(z.object({ expenseId: z.number() }))
    .mutation(({ input }) => deleteExpense(input.expenseId)),

  // Balance and debt calculations
  calculateGroupBalances: publicProcedure
    .input(z.object({ groupId: z.number() }))
    .query(({ input }) => calculateGroupBalances(input.groupId)),

  calculateGroupDebts: publicProcedure
    .input(z.object({ groupId: z.number() }))
    .query(({ input }) => calculateGroupDebts(input.groupId)),

  // Settlements
  createSettlement: publicProcedure
    .input(createSettlementInputSchema)
    .mutation(({ input }) => createSettlement(input)),

  getGroupSettlements: publicProcedure
    .input(z.object({ groupId: z.number() }))
    .query(({ input }) => getGroupSettlements(input.groupId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();