import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, expensesTable } from '../db/schema';
import { type UpdateExpenseInput } from '../schema';
import { updateExpense } from '../handlers/update_expense';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  password_hash: 'hashedpassword'
};

const testGroup = {
  name: 'Test Group',
  description: 'A group for testing',
  created_by: 1 // Will be set after user creation
};

const testExpense = {
  group_id: 1, // Will be set after group creation
  paid_by: 1, // Will be set after user creation
  amount: '25.50', // Stored as string in database
  description: 'Original expense'
};

describe('updateExpense', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update expense amount only', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id,
      amount: 30.75
    };

    const result = await updateExpense(input);

    // Verify result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(expense.id);
    expect(result!.amount).toEqual(30.75);
    expect(typeof result!.amount).toEqual('number');
    expect(result!.description).toEqual('Original expense'); // Should remain unchanged
    expect(result!.group_id).toEqual(group.id);
    expect(result!.paid_by).toEqual(user.id);
  });

  it('should update expense description only', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id,
      description: 'Updated expense description'
    };

    const result = await updateExpense(input);

    // Verify result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(expense.id);
    expect(result!.description).toEqual('Updated expense description');
    expect(result!.amount).toEqual(25.50); // Should remain unchanged
    expect(typeof result!.amount).toEqual('number');
  });

  it('should update both amount and description', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id,
      amount: 15.25,
      description: 'Completely updated expense'
    };

    const result = await updateExpense(input);

    // Verify result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(expense.id);
    expect(result!.amount).toEqual(15.25);
    expect(typeof result!.amount).toEqual('number');
    expect(result!.description).toEqual('Completely updated expense');
  });

  it('should save changes to database', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id,
      amount: 45.00,
      description: 'Database test expense'
    };

    await updateExpense(input);

    // Query database directly to verify changes
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense.id))
      .execute();

    expect(expenses).toHaveLength(1);
    expect(parseFloat(expenses[0].amount)).toEqual(45.00);
    expect(expenses[0].description).toEqual('Database test expense');
  });

  it('should return null for non-existent expense', async () => {
    const input: UpdateExpenseInput = {
      id: 999, // Non-existent ID
      amount: 50.00
    };

    const result = await updateExpense(input);

    expect(result).toBeNull();
  });

  it('should return null when no fields are provided for update', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id
      // No amount or description provided
    };

    const result = await updateExpense(input);

    expect(result).toBeNull();
  });

  it('should handle decimal precision correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [group] = await db.insert(groupsTable).values({ ...testGroup, created_by: user.id }).returning().execute();
    const [expense] = await db.insert(expensesTable).values({
      ...testExpense,
      group_id: group.id,
      paid_by: user.id
    }).returning().execute();

    const input: UpdateExpenseInput = {
      id: expense.id,
      amount: 123.45 // Test decimal precision (2 decimal places to match numeric(10,2))
    };

    const result = await updateExpense(input);

    expect(result).not.toBeNull();
    expect(result!.amount).toEqual(123.45);
    expect(typeof result!.amount).toEqual('number');

    // Verify precision is maintained in database
    const dbExpenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expense.id))
      .execute();

    expect(parseFloat(dbExpenses[0].amount)).toEqual(123.45);
  });
});