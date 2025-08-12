import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, expensesTable, expenseParticipantsTable, groupMembersTable } from '../db/schema';
import { deleteExpense } from '../handlers/delete_expense';
import { eq } from 'drizzle-orm';

describe('deleteExpense', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete an expense and return true when expense exists', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    // Create test group
    const [group] = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create test expense
    const [expense] = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: user.id,
        amount: '50.00',
        description: 'Test expense'
      })
      .returning()
      .execute();

    // Delete the expense
    const result = await deleteExpense(expense.id);

    // Should return true
    expect(result).toBe(true);

    // Verify expense is deleted from database
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense.id))
      .execute();

    expect(expenses).toHaveLength(0);
  });

  it('should return false when expense does not exist', async () => {
    const nonExistentId = 99999;
    
    const result = await deleteExpense(nonExistentId);

    expect(result).toBe(false);
  });

  it('should cascade delete expense participants when expense is deleted', async () => {
    // Create test users
    const [payer] = await db.insert(usersTable)
      .values({
        email: 'payer@example.com',
        name: 'Payer User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    const [participant] = await db.insert(usersTable)
      .values({
        email: 'participant@example.com',
        name: 'Participant User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    // Create test group
    const [group] = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: payer.id
      })
      .returning()
      .execute();

    // Add users to group
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: payer.id, role: 'admin' },
        { group_id: group.id, user_id: participant.id, role: 'member' }
      ])
      .execute();

    // Create test expense
    const [expense] = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: payer.id,
        amount: '100.00',
        description: 'Shared expense'
      })
      .returning()
      .execute();

    // Create expense participants
    await db.insert(expenseParticipantsTable)
      .values([
        {
          expense_id: expense.id,
          user_id: payer.id,
          share_amount: '50.00'
        },
        {
          expense_id: expense.id,
          user_id: participant.id,
          share_amount: '50.00'
        }
      ])
      .execute();

    // Verify participants exist before deletion
    const participantsBefore = await db.select()
      .from(expenseParticipantsTable)
      .where(eq(expenseParticipantsTable.expense_id, expense.id))
      .execute();

    expect(participantsBefore).toHaveLength(2);

    // Delete the expense
    const result = await deleteExpense(expense.id);

    expect(result).toBe(true);

    // Verify expense participants are cascade deleted
    const participantsAfter = await db.select()
      .from(expenseParticipantsTable)
      .where(eq(expenseParticipantsTable.expense_id, expense.id))
      .execute();

    expect(participantsAfter).toHaveLength(0);

    // Verify expense is deleted
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense.id))
      .execute();

    expect(expenses).toHaveLength(0);
  });

  it('should not affect other expenses when deleting one expense', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    // Create test group
    const [group] = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create two test expenses
    const [expense1] = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: user.id,
        amount: '25.00',
        description: 'First expense'
      })
      .returning()
      .execute();

    const [expense2] = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: user.id,
        amount: '35.00',
        description: 'Second expense'
      })
      .returning()
      .execute();

    // Delete the first expense
    const result = await deleteExpense(expense1.id);

    expect(result).toBe(true);

    // Verify first expense is deleted
    const deletedExpenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense1.id))
      .execute();

    expect(deletedExpenses).toHaveLength(0);

    // Verify second expense still exists
    const remainingExpenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense2.id))
      .execute();

    expect(remainingExpenses).toHaveLength(1);
    expect(remainingExpenses[0].description).toBe('Second expense');
    expect(parseFloat(remainingExpenses[0].amount)).toBe(35.00);
  });

  it('should handle multiple delete attempts on same expense', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    // Create test group
    const [group] = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create test expense
    const [expense] = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: user.id,
        amount: '40.00',
        description: 'Test expense'
      })
      .returning()
      .execute();

    // First deletion should succeed
    const firstResult = await deleteExpense(expense.id);
    expect(firstResult).toBe(true);

    // Second deletion should return false (expense no longer exists)
    const secondResult = await deleteExpense(expense.id);
    expect(secondResult).toBe(false);
  });
});