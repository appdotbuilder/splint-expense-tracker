import { db } from '../db';
import { expensesTable, expenseParticipantsTable, settlementsTable, usersTable } from '../db/schema';
import { type GroupBalances } from '../schema';
import { eq, sum, and, or } from 'drizzle-orm';

export async function calculateGroupBalances(groupId: number): Promise<GroupBalances> {
  try {
    // Get users from expenses (paid by)
    const expensePayers = await db.select({
      id: usersTable.id,
      name: usersTable.name
    })
    .from(usersTable)
    .innerJoin(expensesTable, eq(usersTable.id, expensesTable.paid_by))
    .where(eq(expensesTable.group_id, groupId))
    .execute();

    // Get users from expense participants
    const expenseParticipants = await db.select({
      id: usersTable.id,
      name: usersTable.name
    })
    .from(usersTable)
    .innerJoin(expenseParticipantsTable, eq(usersTable.id, expenseParticipantsTable.user_id))
    .innerJoin(expensesTable, eq(expenseParticipantsTable.expense_id, expensesTable.id))
    .where(eq(expensesTable.group_id, groupId))
    .execute();

    // Get users from settlements (both from_user and to_user)
    const settlementFromUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name
    })
    .from(usersTable)
    .innerJoin(settlementsTable, eq(usersTable.id, settlementsTable.from_user))
    .where(eq(settlementsTable.group_id, groupId))
    .execute();

    const settlementToUsers = await db.select({
      id: usersTable.id,
      name: usersTable.name
    })
    .from(usersTable)
    .innerJoin(settlementsTable, eq(usersTable.id, settlementsTable.to_user))
    .where(eq(settlementsTable.group_id, groupId))
    .execute();

    // Combine and deduplicate users
    const userMap = new Map<number, { id: number; name: string }>();
    [...expensePayers, ...expenseParticipants, ...settlementFromUsers, ...settlementToUsers].forEach(user => {
      userMap.set(user.id, user);
    });
    const allUsers = Array.from(userMap.values());

    const balances = await Promise.all(
      allUsers.map(async (user) => {
        // Calculate total amount paid by this user in expenses
        const expensesPaid = await db.select({
          total: sum(expensesTable.amount)
        })
        .from(expensesTable)
        .where(
          and(
            eq(expensesTable.group_id, groupId),
            eq(expensesTable.paid_by, user.id)
          )
        )
        .execute();

        const totalPaid = expensesPaid[0]?.total ? parseFloat(expensesPaid[0].total) : 0;

        // Calculate total share amount this user owes from all expenses
        const expenseShares = await db.select({
          total: sum(expenseParticipantsTable.share_amount)
        })
        .from(expenseParticipantsTable)
        .innerJoin(expensesTable, eq(expenseParticipantsTable.expense_id, expensesTable.id))
        .where(
          and(
            eq(expensesTable.group_id, groupId),
            eq(expenseParticipantsTable.user_id, user.id)
          )
        )
        .execute();

        const totalOwes = expenseShares[0]?.total ? parseFloat(expenseShares[0].total) : 0;

        // Calculate net amount from settlements (money received minus money paid)
        const settlementsReceived = await db.select({
          total: sum(settlementsTable.amount)
        })
        .from(settlementsTable)
        .where(
          and(
            eq(settlementsTable.group_id, groupId),
            eq(settlementsTable.to_user, user.id)
          )
        )
        .execute();

        const totalReceived = settlementsReceived[0]?.total ? parseFloat(settlementsReceived[0].total) : 0;

        const settlementsPaid = await db.select({
          total: sum(settlementsTable.amount)
        })
        .from(settlementsTable)
        .where(
          and(
            eq(settlementsTable.group_id, groupId),
            eq(settlementsTable.from_user, user.id)
          )
        )
        .execute();

        const totalSettlementsPaid = settlementsPaid[0]?.total ? parseFloat(settlementsPaid[0].total) : 0;

        // Calculate final balance: 
        // (amount paid for expenses) - (share of expenses owed) + (settlements received) - (settlements paid)
        const balance = totalPaid - totalOwes + totalReceived - totalSettlementsPaid;

        return {
          user_id: user.id,
          user_name: user.name,
          balance: balance
        };
      })
    );

    return {
      group_id: groupId,
      balances: balances
    };
  } catch (error) {
    console.error('Balance calculation failed:', error);
    throw error;
  }
}