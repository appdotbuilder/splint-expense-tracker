import { db } from '../db';
import { expensesTable } from '../db/schema';
import { type Expense } from '../schema';
import { eq } from 'drizzle-orm';

export async function getGroupExpenses(groupId: number): Promise<Expense[]> {
  try {
    // Query all expenses for the specified group
    const results = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.group_id, groupId))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(expense => ({
      ...expense,
      amount: parseFloat(expense.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to get group expenses:', error);
    throw error;
  }
}