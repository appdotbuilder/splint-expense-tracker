import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable, expensesTable, expenseParticipantsTable } from '../db/schema';
import { type CreateExpenseInput } from '../schema';
import { createExpense } from '../handlers/create_expense';
import { eq, and } from 'drizzle-orm';

describe('createExpense', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test helper to create prerequisite data
  const setupTestData = async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' },
        { email: 'user3@test.com', name: 'User 3', password_hash: 'hash3' },
        { email: 'nonmember@test.com', name: 'Non Member', password_hash: 'hash4' }
      ])
      .returning()
      .execute();

    // Create group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: users[0].id
      })
      .returning()
      .execute();

    // Add members to group (users 0, 1, 2 are members, user 3 is not)
    await db.insert(groupMembersTable)
      .values([
        { group_id: groups[0].id, user_id: users[0].id, role: 'admin' },
        { group_id: groups[0].id, user_id: users[1].id, role: 'member' },
        { group_id: groups[0].id, user_id: users[2].id, role: 'member' }
      ])
      .execute();

    return { users, group: groups[0] };
  };

  it('should create an expense with participants successfully', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 60.00,
      description: 'Dinner at restaurant',
      participants: [
        { user_id: users[0].id, share_amount: 20.00 },
        { user_id: users[1].id, share_amount: 20.00 },
        { user_id: users[2].id, share_amount: 20.00 }
      ]
    };

    const result = await createExpense(testInput);

    // Validate expense fields
    expect(result.id).toBeDefined();
    expect(result.group_id).toEqual(group.id);
    expect(result.paid_by).toEqual(users[0].id);
    expect(result.amount).toEqual(60.00);
    expect(typeof result.amount).toEqual('number');
    expect(result.description).toEqual('Dinner at restaurant');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save expense and participants to database correctly', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 45.50,
      description: 'Grocery shopping',
      participants: [
        { user_id: users[0].id, share_amount: 15.50 },
        { user_id: users[1].id, share_amount: 15.00 },
        { user_id: users[2].id, share_amount: 15.00 }
      ]
    };

    const result = await createExpense(testInput);

    // Verify expense was saved
    const savedExpense = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(savedExpense).toHaveLength(1);
    expect(savedExpense[0].group_id).toEqual(group.id);
    expect(savedExpense[0].paid_by).toEqual(users[0].id);
    expect(parseFloat(savedExpense[0].amount)).toEqual(45.50);
    expect(savedExpense[0].description).toEqual('Grocery shopping');

    // Verify participants were saved
    const participants = await db.select()
      .from(expenseParticipantsTable)
      .where(eq(expenseParticipantsTable.expense_id, result.id))
      .execute();

    expect(participants).toHaveLength(3);
    
    const participantShares = participants.map(p => ({
      user_id: p.user_id,
      share_amount: parseFloat(p.share_amount)
    }));

    expect(participantShares).toContainEqual({ user_id: users[0].id, share_amount: 15.50 });
    expect(participantShares).toContainEqual({ user_id: users[1].id, share_amount: 15.00 });
    expect(participantShares).toContainEqual({ user_id: users[2].id, share_amount: 15.00 });
  });

  it('should reject expense if group does not exist', async () => {
    const { users } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: 99999, // Non-existent group
      paid_by: users[0].id,
      amount: 30.00,
      description: 'Test expense',
      participants: [
        { user_id: users[0].id, share_amount: 30.00 }
      ]
    };

    await expect(createExpense(testInput)).rejects.toThrow(/Group with ID 99999 not found/i);
  });

  it('should reject expense if paid_by user is not a group member', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[3].id, // User 3 is not a member
      amount: 25.00,
      description: 'Test expense',
      participants: [
        { user_id: users[0].id, share_amount: 25.00 }
      ]
    };

    await expect(createExpense(testInput)).rejects.toThrow(
      new RegExp(`User with ID ${users[3].id} is not a member of group ${group.id}`, 'i')
    );
  });

  it('should reject expense if participant is not a group member', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 40.00,
      description: 'Test expense',
      participants: [
        { user_id: users[0].id, share_amount: 20.00 },
        { user_id: users[3].id, share_amount: 20.00 } // User 3 is not a member
      ]
    };

    await expect(createExpense(testInput)).rejects.toThrow(
      new RegExp(`Users with IDs \\[${users[3].id}\\] are not members of group ${group.id}`, 'i')
    );
  });

  it('should reject expense if sum of shares does not equal total amount', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 50.00,
      description: 'Test expense',
      participants: [
        { user_id: users[0].id, share_amount: 20.00 },
        { user_id: users[1].id, share_amount: 20.00 }
        // Total shares = 40.00, but amount = 50.00
      ]
    };

    await expect(createExpense(testInput)).rejects.toThrow(
      /Sum of participant shares \(40\) does not equal total amount \(50\)/i
    );
  });

  it('should handle floating point precision in share validation', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 10.00,
      description: 'Test expense with precision',
      participants: [
        { user_id: users[0].id, share_amount: 3.33 },
        { user_id: users[1].id, share_amount: 3.33 },
        { user_id: users[2].id, share_amount: 3.34 } // Total = 9.99 + 0.01 = 10.00
      ]
    };

    const result = await createExpense(testInput);
    
    expect(result.amount).toEqual(10.00);
    expect(result.description).toEqual('Test expense with precision');
  });

  it('should handle multiple participants not being group members', async () => {
    const { users, group } = await setupTestData();

    // Create additional non-member user
    const nonMemberUsers = await db.insert(usersTable)
      .values([
        { email: 'nonmember2@test.com', name: 'Non Member 2', password_hash: 'hash5' }
      ])
      .returning()
      .execute();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[0].id,
      amount: 60.00,
      description: 'Test expense',
      participants: [
        { user_id: users[0].id, share_amount: 20.00 },
        { user_id: users[3].id, share_amount: 20.00 }, // Not a member
        { user_id: nonMemberUsers[0].id, share_amount: 20.00 } // Not a member
      ]
    };

    await expect(createExpense(testInput)).rejects.toThrow(
      new RegExp(`Users with IDs \\[${users[3].id}, ${nonMemberUsers[0].id}\\] are not members of group ${group.id}`, 'i')
    );
  });

  it('should create expense where payer is also a participant', async () => {
    const { users, group } = await setupTestData();

    const testInput: CreateExpenseInput = {
      group_id: group.id,
      paid_by: users[1].id, // User 1 pays and also participates
      amount: 30.00,
      description: 'Coffee for the team',
      participants: [
        { user_id: users[0].id, share_amount: 10.00 },
        { user_id: users[1].id, share_amount: 10.00 }, // Payer is also participant
        { user_id: users[2].id, share_amount: 10.00 }
      ]
    };

    const result = await createExpense(testInput);

    expect(result.paid_by).toEqual(users[1].id);
    expect(result.amount).toEqual(30.00);

    // Verify all participants including the payer
    const participants = await db.select()
      .from(expenseParticipantsTable)
      .where(eq(expenseParticipantsTable.expense_id, result.id))
      .execute();

    expect(participants).toHaveLength(3);
    expect(participants.some(p => p.user_id === users[1].id)).toBe(true);
  });
});