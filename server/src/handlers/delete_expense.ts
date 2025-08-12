import { db } from '../db';
import { expensesTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteExpense(expenseId: number): Promise<boolean> {
  try {
    // Delete the expense - participants will be cascade deleted automatically
    // due to the foreign key constraint with onDelete: 'cascade'
    const result = await db.delete(expensesTable)
      .where(eq(expensesTable.id, expenseId))
      .returning()
      .execute();

    // Return true if an expense was deleted, false if not found
    return result.length > 0;
  } catch (error) {
    console.error('Expense deletion failed:', error);
    throw error;
  }
}