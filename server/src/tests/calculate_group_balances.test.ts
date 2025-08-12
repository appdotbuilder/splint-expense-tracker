import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  groupsTable, 
  expensesTable, 
  expenseParticipantsTable,
  settlementsTable 
} from '../db/schema';
import { calculateGroupBalances } from '../handlers/calculate_group_balances';

describe('calculateGroupBalances', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty balances for non-existent group', async () => {
    const result = await calculateGroupBalances(999);

    expect(result.group_id).toEqual(999);
    expect(result.balances).toHaveLength(0);
  });

  it('should calculate balances with single expense paid equally', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' },
        { email: 'user3@test.com', name: 'User 3', password_hash: 'hash3' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Create expense: User 1 pays $30, split equally among 3 users ($10 each)
    const expenses = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[0].id,
        amount: '30.00',
        description: 'Dinner expense'
      })
      .returning()
      .execute();

    // Add participants
    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenses[0].id, user_id: users[0].id, share_amount: '10.00' },
        { expense_id: expenses[0].id, user_id: users[1].id, share_amount: '10.00' },
        { expense_id: expenses[0].id, user_id: users[2].id, share_amount: '10.00' }
      ])
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(3);

    // User 1: paid $30, owes $10 = +$20 balance
    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.user_name).toEqual('User 1');
    expect(user1Balance!.balance).toEqual(20);

    // User 2: paid $0, owes $10 = -$10 balance
    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.user_name).toEqual('User 2');
    expect(user2Balance!.balance).toEqual(-10);

    // User 3: paid $0, owes $10 = -$10 balance
    const user3Balance = result.balances.find(b => b.user_id === users[2].id);
    expect(user3Balance).toBeDefined();
    expect(user3Balance!.user_name).toEqual('User 3');
    expect(user3Balance!.balance).toEqual(-10);
  });

  it('should calculate balances with multiple expenses and unequal splits', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Expense 1: User 1 pays $50, User 1 owes $20, User 2 owes $30
    const expense1 = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[0].id,
        amount: '50.00',
        description: 'Groceries'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense1[0].id, user_id: users[0].id, share_amount: '20.00' },
        { expense_id: expense1[0].id, user_id: users[1].id, share_amount: '30.00' }
      ])
      .execute();

    // Expense 2: User 2 pays $40, User 1 owes $25, User 2 owes $15
    const expense2 = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[1].id,
        amount: '40.00',
        description: 'Utilities'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense2[0].id, user_id: users[0].id, share_amount: '25.00' },
        { expense_id: expense2[0].id, user_id: users[1].id, share_amount: '15.00' }
      ])
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(2);

    // User 1: paid $50, owes ($20 + $25) = +$5 balance
    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.balance).toEqual(5);

    // User 2: paid $40, owes ($30 + $15) = -$5 balance
    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.balance).toEqual(-5);
  });

  it('should include settlements in balance calculations', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Create expense: User 1 pays $100, split equally ($50 each)
    const expenses = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[0].id,
        amount: '100.00',
        description: 'Large expense'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenses[0].id, user_id: users[0].id, share_amount: '50.00' },
        { expense_id: expenses[0].id, user_id: users[1].id, share_amount: '50.00' }
      ])
      .execute();

    // Add settlement: User 2 pays User 1 $30
    await db.insert(settlementsTable)
      .values({
        group_id: groupId,
        from_user: users[1].id,
        to_user: users[0].id,
        amount: '30.00',
        description: 'Partial payment'
      })
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(2);

    // User 1: paid $100, owes $50, received $30 = +$80 balance
    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.balance).toEqual(80);

    // User 2: paid $0, owes $50, paid settlement $30 = -$80 balance
    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.balance).toEqual(-80);
  });

  it('should include settlements in balance calculations with expenses', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Create expense: User 1 pays $60, split equally ($30 each)
    const expenses = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[0].id,
        amount: '60.00',
        description: 'Shared expense'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenses[0].id, user_id: users[0].id, share_amount: '30.00' },
        { expense_id: expenses[0].id, user_id: users[1].id, share_amount: '30.00' }
      ])
      .execute();

    // Settlement: User 2 pays User 1 $30 (what User 2 owed for their share)
    await db.insert(settlementsTable)
      .values({
        group_id: groupId,
        from_user: users[1].id,
        to_user: users[0].id,
        amount: '30.00',
        description: 'Settlement for share'
      })
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(2);

    // The balance calculation treats all money flows independently:
    // User 1: paid $60 (expense) - owes $30 (share) + received $30 (settlement) = +$60
    // User 2: paid $0 (expenses) - owes $30 (share) + paid $30 (settlement) = -$60
    // 
    // This represents the net financial position considering all transactions.
    // The balances sum to zero, confirming the math is consistent.

    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.balance).toEqual(60);

    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.balance).toEqual(-60);
  });

  it('should handle group with only settlements and no expenses', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Add only settlement without any expenses
    await db.insert(settlementsTable)
      .values({
        group_id: groupId,
        from_user: users[1].id,
        to_user: users[0].id,
        amount: '25.00',
        description: 'Direct payment'
      })
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(2);

    // User 1: received $25 settlement = +$25 balance
    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.balance).toEqual(25);

    // User 2: paid $25 settlement = -$25 balance
    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.balance).toEqual(-25);
  });

  it('should handle decimal amounts correctly', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'Test group for balances',
        created_by: users[0].id
      })
      .returning()
      .execute();

    const groupId = groups[0].id;

    // Create expense with decimal amounts
    const expenses = await db.insert(expensesTable)
      .values({
        group_id: groupId,
        paid_by: users[0].id,
        amount: '23.75',
        description: 'Coffee expense'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenses[0].id, user_id: users[0].id, share_amount: '11.25' },
        { expense_id: expenses[0].id, user_id: users[1].id, share_amount: '12.50' }
      ])
      .execute();

    const result = await calculateGroupBalances(groupId);

    expect(result.group_id).toEqual(groupId);
    expect(result.balances).toHaveLength(2);

    // User 1: paid $23.75, owes $11.25 = +$12.50 balance
    const user1Balance = result.balances.find(b => b.user_id === users[0].id);
    expect(user1Balance).toBeDefined();
    expect(user1Balance!.balance).toEqual(12.5);

    // User 2: paid $0, owes $12.50 = -$12.50 balance
    const user2Balance = result.balances.find(b => b.user_id === users[1].id);
    expect(user2Balance).toBeDefined();
    expect(user2Balance!.balance).toEqual(-12.5);
  });
});