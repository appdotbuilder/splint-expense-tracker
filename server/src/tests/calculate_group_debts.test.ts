import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable, expensesTable, expenseParticipantsTable, settlementsTable } from '../db/schema';
import { calculateGroupDebts } from '../handlers/calculate_group_debts';

describe('calculateGroupDebts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty debts for non-existent group', async () => {
    const result = await calculateGroupDebts(999);

    expect(result.group_id).toEqual(999);
    expect(result.debts).toEqual([]);
  });

  it('should return empty debts for group with no expenses', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: usersResult[0].id
      })
      .returning()
      .execute();

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: groupResult[0].id, user_id: usersResult[0].id, role: 'admin' },
        { group_id: groupResult[0].id, user_id: usersResult[1].id, role: 'member' }
      ])
      .execute();

    const result = await calculateGroupDebts(groupResult[0].id);

    expect(result.group_id).toEqual(groupResult[0].id);
    expect(result.debts).toEqual([]);
  });

  it('should calculate simple debt between two users', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    const alice = usersResult[0];
    const bob = usersResult[1];

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: alice.id
      })
      .returning()
      .execute();

    const group = groupResult[0];

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: alice.id, role: 'admin' },
        { group_id: group.id, user_id: bob.id, role: 'member' }
      ])
      .execute();

    // Alice pays $20 for dinner
    const expenseResult = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: alice.id,
        amount: '20.00',
        description: 'Dinner'
      })
      .returning()
      .execute();

    // Both Alice and Bob split the cost equally ($10 each)
    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenseResult[0].id, user_id: alice.id, share_amount: '10.00' },
        { expense_id: expenseResult[0].id, user_id: bob.id, share_amount: '10.00' }
      ])
      .execute();

    const result = await calculateGroupDebts(group.id);

    expect(result.group_id).toEqual(group.id);
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]).toEqual({
      from_user: bob.id,
      from_user_name: 'Bob',
      to_user: alice.id,
      to_user_name: 'Alice',
      amount: 10.00
    });
  });

  it('should calculate complex debts with multiple expenses', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' },
        { email: 'charlie@test.com', name: 'Charlie', password_hash: 'hash3' }
      ])
      .returning()
      .execute();

    const [alice, bob, charlie] = usersResult;

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: alice.id
      })
      .returning()
      .execute();

    const group = groupResult[0];

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: alice.id, role: 'admin' },
        { group_id: group.id, user_id: bob.id, role: 'member' },
        { group_id: group.id, user_id: charlie.id, role: 'member' }
      ])
      .execute();

    // Expense 1: Alice pays $30 for groceries, split equally among all 3
    const expense1Result = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: alice.id,
        amount: '30.00',
        description: 'Groceries'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense1Result[0].id, user_id: alice.id, share_amount: '10.00' },
        { expense_id: expense1Result[0].id, user_id: bob.id, share_amount: '10.00' },
        { expense_id: expense1Result[0].id, user_id: charlie.id, share_amount: '10.00' }
      ])
      .execute();

    // Expense 2: Bob pays $15 for gas, split equally among all 3
    const expense2Result = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: bob.id,
        amount: '15.00',
        description: 'Gas'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense2Result[0].id, user_id: alice.id, share_amount: '5.00' },
        { expense_id: expense2Result[0].id, user_id: bob.id, share_amount: '5.00' },
        { expense_id: expense2Result[0].id, user_id: charlie.id, share_amount: '5.00' }
      ])
      .execute();

    const result = await calculateGroupDebts(group.id);

    // Expected calculations:
    // Alice: paid $30, owes $15 (10+5) -> net: +$15
    // Bob: paid $15, owes $15 (10+5) -> net: $0
    // Charlie: paid $0, owes $15 (10+5) -> net: -$15
    // So Charlie should owe Alice $15

    expect(result.group_id).toEqual(group.id);
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]).toEqual({
      from_user: charlie.id,
      from_user_name: 'Charlie',
      to_user: alice.id,
      to_user_name: 'Alice',
      amount: 15.00
    });
  });

  it('should account for existing settlements', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    const alice = usersResult[0];
    const bob = usersResult[1];

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: alice.id
      })
      .returning()
      .execute();

    const group = groupResult[0];

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: alice.id, role: 'admin' },
        { group_id: group.id, user_id: bob.id, role: 'member' }
      ])
      .execute();

    // Alice pays $20 for dinner
    const expenseResult = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: alice.id,
        amount: '20.00',
        description: 'Dinner'
      })
      .returning()
      .execute();

    // Both split equally ($10 each)
    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenseResult[0].id, user_id: alice.id, share_amount: '10.00' },
        { expense_id: expenseResult[0].id, user_id: bob.id, share_amount: '10.00' }
      ])
      .execute();

    // Bob already paid Alice $5
    await db.insert(settlementsTable)
      .values({
        group_id: group.id,
        from_user: bob.id,
        to_user: alice.id,
        amount: '5.00',
        description: 'Partial payment'
      })
      .execute();

    const result = await calculateGroupDebts(group.id);

    // Bob should now only owe Alice $5 (original $10 - $5 settlement)
    expect(result.group_id).toEqual(group.id);
    expect(result.debts).toHaveLength(1);
    expect(result.debts[0]).toEqual({
      from_user: bob.id,
      from_user_name: 'Bob',
      to_user: alice.id,
      to_user_name: 'Alice',
      amount: 5.00
    });
  });

  it('should optimize transactions in complex scenario', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' },
        { email: 'charlie@test.com', name: 'Charlie', password_hash: 'hash3' },
        { email: 'david@test.com', name: 'David', password_hash: 'hash4' }
      ])
      .returning()
      .execute();

    const [alice, bob, charlie, david] = usersResult;

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: alice.id
      })
      .returning()
      .execute();

    const group = groupResult[0];

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: alice.id, role: 'admin' },
        { group_id: group.id, user_id: bob.id, role: 'member' },
        { group_id: group.id, user_id: charlie.id, role: 'member' },
        { group_id: group.id, user_id: david.id, role: 'member' }
      ])
      .execute();

    // Alice pays $40, everyone splits equally ($10 each)
    const expense1Result = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: alice.id,
        amount: '40.00',
        description: 'Dinner'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense1Result[0].id, user_id: alice.id, share_amount: '10.00' },
        { expense_id: expense1Result[0].id, user_id: bob.id, share_amount: '10.00' },
        { expense_id: expense1Result[0].id, user_id: charlie.id, share_amount: '10.00' },
        { expense_id: expense1Result[0].id, user_id: david.id, share_amount: '10.00' }
      ])
      .execute();

    // Bob pays $20, everyone splits equally ($5 each)
    const expense2Result = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: bob.id,
        amount: '20.00',
        description: 'Drinks'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expense2Result[0].id, user_id: alice.id, share_amount: '5.00' },
        { expense_id: expense2Result[0].id, user_id: bob.id, share_amount: '5.00' },
        { expense_id: expense2Result[0].id, user_id: charlie.id, share_amount: '5.00' },
        { expense_id: expense2Result[0].id, user_id: david.id, share_amount: '5.00' }
      ])
      .execute();

    const result = await calculateGroupDebts(group.id);

    // Expected calculations:
    // Alice: paid $40, owes $15 (10+5) -> net: +$25
    // Bob: paid $20, owes $15 (10+5) -> net: +$5
    // Charlie: paid $0, owes $15 (10+5) -> net: -$15
    // David: paid $0, owes $15 (10+5) -> net: -$15
    
    // Optimal settlement: Charlie pays Alice $15, David pays Alice $15
    // Or: Charlie pays Alice $15, David pays Bob $5, David pays Alice $10
    // The algorithm should minimize transactions

    expect(result.group_id).toEqual(group.id);
    expect(result.debts.length).toBeGreaterThan(0);
    
    // Verify total amount owed equals total amount due
    const totalOwed = result.debts.reduce((sum, debt) => sum + debt.amount, 0);
    expect(totalOwed).toEqual(30); // Total of what Charlie and David owe

    // Verify all debt amounts are positive
    result.debts.forEach(debt => {
      expect(debt.amount).toBeGreaterThan(0);
    });

    // Verify Alice and Bob are only creditors (receive money)
    const debtors = result.debts.map(d => d.from_user);
    const creditors = result.debts.map(d => d.to_user);
    
    expect(debtors).not.toContain(alice.id);
    expect(debtors).not.toContain(bob.id);
    expect(debtors).toContain(charlie.id);
    expect(debtors).toContain(david.id);
  });

  it('should handle floating point precision correctly', async () => {
    // Create test users
    const usersResult = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' },
        { email: 'charlie@test.com', name: 'Charlie', password_hash: 'hash3' }
      ])
      .returning()
      .execute();

    const [alice, bob, charlie] = usersResult;

    // Create group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: alice.id
      })
      .returning()
      .execute();

    const group = groupResult[0];

    // Add members
    await db.insert(groupMembersTable)
      .values([
        { group_id: group.id, user_id: alice.id, role: 'admin' },
        { group_id: group.id, user_id: bob.id, role: 'member' },
        { group_id: group.id, user_id: charlie.id, role: 'member' }
      ])
      .execute();

    // Alice pays $10.01, split 3 ways (creates precision issues: $3.336666...)
    const expenseResult = await db.insert(expensesTable)
      .values({
        group_id: group.id,
        paid_by: alice.id,
        amount: '10.01',
        description: 'Test precision'
      })
      .returning()
      .execute();

    await db.insert(expenseParticipantsTable)
      .values([
        { expense_id: expenseResult[0].id, user_id: alice.id, share_amount: '3.34' },
        { expense_id: expenseResult[0].id, user_id: bob.id, share_amount: '3.33' },
        { expense_id: expenseResult[0].id, user_id: charlie.id, share_amount: '3.34' }
      ])
      .execute();

    const result = await calculateGroupDebts(group.id);

    expect(result.group_id).toEqual(group.id);
    
    // Verify amounts are properly rounded to 2 decimal places
    result.debts.forEach(debt => {
      expect(debt.amount).toEqual(parseFloat(debt.amount.toFixed(2)));
      expect(debt.amount.toString()).toMatch(/^\d+\.\d{1,2}$/);
    });
  });
});