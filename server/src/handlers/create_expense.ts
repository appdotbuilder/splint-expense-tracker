import { db } from '../db';
import { expensesTable, expenseParticipantsTable, groupMembersTable, usersTable, groupsTable } from '../db/schema';
import { type CreateExpenseInput, type Expense } from '../schema';
import { eq, inArray, and } from 'drizzle-orm';

export const createExpense = async (input: CreateExpenseInput): Promise<Expense> => {
  try {
    return await db.transaction(async (tx) => {
      // Validate that the group exists
      const group = await tx.select()
        .from(groupsTable)
        .where(eq(groupsTable.id, input.group_id))
        .limit(1)
        .execute();

      if (group.length === 0) {
        throw new Error(`Group with ID ${input.group_id} not found`);
      }

      // Validate that paid_by user exists and is a member of the group
      const paidByMember = await tx.select()
        .from(groupMembersTable)
        .innerJoin(usersTable, eq(groupMembersTable.user_id, usersTable.id))
        .where(
          and(
            eq(groupMembersTable.group_id, input.group_id),
            eq(groupMembersTable.user_id, input.paid_by)
          )
        )
        .limit(1)
        .execute();

      if (paidByMember.length === 0) {
        throw new Error(`User with ID ${input.paid_by} is not a member of group ${input.group_id}`);
      }

      // Validate that all participants are members of the group
      const participantIds = input.participants.map(p => p.user_id);
      const groupMembers = await tx.select()
        .from(groupMembersTable)
        .where(
          and(
            eq(groupMembersTable.group_id, input.group_id),
            inArray(groupMembersTable.user_id, participantIds)
          )
        )
        .execute();

      if (groupMembers.length !== participantIds.length) {
        const foundUserIds = groupMembers.map(m => m.user_id);
        const missingUserIds = participantIds.filter(id => !foundUserIds.includes(id));
        throw new Error(`Users with IDs [${missingUserIds.join(', ')}] are not members of group ${input.group_id}`);
      }

      // Validate that the sum of shares equals the total amount
      const totalShares = input.participants.reduce((sum, p) => sum + p.share_amount, 0);
      if (Math.abs(totalShares - input.amount) > 0.01) { // Allow for small floating point differences
        throw new Error(`Sum of participant shares (${totalShares}) does not equal total amount (${input.amount})`);
      }

      // Create the expense
      const expenseResult = await tx.insert(expensesTable)
        .values({
          group_id: input.group_id,
          paid_by: input.paid_by,
          amount: input.amount.toString(),
          description: input.description
        })
        .returning()
        .execute();

      const expense = expenseResult[0];

      // Create expense participants
      const participantValues = input.participants.map(p => ({
        expense_id: expense.id,
        user_id: p.user_id,
        share_amount: p.share_amount.toString()
      }));

      await tx.insert(expenseParticipantsTable)
        .values(participantValues)
        .execute();

      // Return the expense with numeric conversion
      return {
        ...expense,
        amount: parseFloat(expense.amount)
      };
    });
  } catch (error) {
    console.error('Expense creation failed:', error);
    throw error;
  }
};