import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, expensesTable } from '../db/schema';
import { getGroupExpenses } from '../handlers/get_group_expenses';

describe('getGroupExpenses', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all expenses for a group', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          name: 'User 1',
          password_hash: 'hash1'
        },
        {
          email: 'user2@test.com',
          name: 'User 2',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Create test expenses
    await db.insert(expensesTable)
      .values([
        {
          group_id: groupId,
          paid_by: users[0].id,
          amount: '25.50',
          description: 'Lunch expense'
        },
        {
          group_id: groupId,
          paid_by: users[1].id,
          amount: '15.75',
          description: 'Coffee expense'
        },
        {
          group_id: groupId,
          paid_by: users[0].id,
          amount: '100.00',
          description: 'Groceries'
        }
      ])
      .execute();

    const result = await getGroupExpenses(groupId);

    // Should return 3 expenses
    expect(result).toHaveLength(3);

    // Verify expense details and numeric conversion
    expect(result[0].group_id).toEqual(groupId);
    expect(result[0].paid_by).toEqual(users[0].id);
    expect(result[0].amount).toEqual(25.50);
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].description).toEqual('Lunch expense');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify second expense
    expect(result[1].amount).toEqual(15.75);
    expect(typeof result[1].amount).toBe('number');
    expect(result[1].paid_by).toEqual(users[1].id);
    expect(result[1].description).toEqual('Coffee expense');

    // Verify third expense
    expect(result[2].amount).toEqual(100.00);
    expect(typeof result[2].amount).toBe('number');
    expect(result[2].description).toEqual('Groceries');
  });

  it('should return empty array for group with no expenses', async () => {
    // Create test user and group
    const users = await db.insert(usersTable)
      .values({
        email: 'user@test.com',
        name: 'Test User',
        password_hash: 'hash'
      })
      .returning()
      .execute();

    const groups = await db.insert(groupsTable)
      .values({
        name: 'Empty Group',
        description: 'Group with no expenses',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const result = await getGroupExpenses(groups[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent group', async () => {
    const nonExistentGroupId = 999999;

    const result = await getGroupExpenses(nonExistentGroupId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return expenses for the specified group', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          name: 'User 1',
          password_hash: 'hash1'
        },
        {
          email: 'user2@test.com',
          name: 'User 2',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    // Create two test groups
    const groups = await db.insert(groupsTable)
      .values([
        {
          name: 'Group 1',
          description: 'First group',
          created_by: users[0].id
        },
        {
          name: 'Group 2',
          description: 'Second group',
          created_by: users[1].id
        }
      ])
      .returning()
      .execute();

    // Create expenses in both groups
    await db.insert(expensesTable)
      .values([
        // Expenses for Group 1
        {
          group_id: groups[0].id,
          paid_by: users[0].id,
          amount: '20.00',
          description: 'Group 1 Expense 1'
        },
        {
          group_id: groups[0].id,
          paid_by: users[1].id,
          amount: '30.00',
          description: 'Group 1 Expense 2'
        },
        // Expenses for Group 2
        {
          group_id: groups[1].id,
          paid_by: users[0].id,
          amount: '40.00',
          description: 'Group 2 Expense 1'
        }
      ])
      .execute();

    // Get expenses for Group 1 only
    const group1Expenses = await getGroupExpenses(groups[0].id);

    expect(group1Expenses).toHaveLength(2);
    expect(group1Expenses[0].group_id).toEqual(groups[0].id);
    expect(group1Expenses[1].group_id).toEqual(groups[0].id);
    expect(group1Expenses[0].description).toEqual('Group 1 Expense 1');
    expect(group1Expenses[1].description).toEqual('Group 1 Expense 2');

    // Get expenses for Group 2 only
    const group2Expenses = await getGroupExpenses(groups[1].id);

    expect(group2Expenses).toHaveLength(1);
    expect(group2Expenses[0].group_id).toEqual(groups[1].id);
    expect(group2Expenses[0].description).toEqual('Group 2 Expense 1');
  });

  it('should handle decimal amounts correctly', async () => {
    // Create test user and group
    const users = await db.insert(usersTable)
      .values({
        email: 'user@test.com',
        name: 'Test User',
        password_hash: 'hash'
      })
      .returning()
      .execute();

    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for decimal amounts',
        created_by: users[0].id
      })
      .returning()
      .execute();

    // Create expense with complex decimal amount
    await db.insert(expensesTable)
      .values({
        group_id: groups[0].id,
        paid_by: users[0].id,
        amount: '123.45',
        description: 'Decimal amount test'
      })
      .execute();

    const result = await getGroupExpenses(groups[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].amount).toEqual(123.45);
    expect(typeof result[0].amount).toBe('number');
  });
});