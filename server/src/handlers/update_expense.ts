import { db } from '../db';
import { expensesTable } from '../db/schema';
import { type UpdateExpenseInput, type Expense } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateExpense(input: UpdateExpenseInput): Promise<Expense | null> {
  try {
    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.amount !== undefined) {
      updateData.amount = input.amount.toString(); // Convert number to string for numeric column
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // If no fields to update, return null
    if (Object.keys(updateData).length === 0) {
      return null;
    }

    // Update the expense
    const result = await db.update(expensesTable)
      .set(updateData)
      .where(eq(expensesTable.id, input.id))
      .returning()
      .execute();

    // Return null if no expense was found/updated
    if (result.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers before returning
    const expense = result[0];
    return {
      ...expense,
      amount: parseFloat(expense.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Expense update failed:', error);
    throw error;
  }
}