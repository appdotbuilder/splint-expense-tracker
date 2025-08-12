import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable, settlementsTable } from '../db/schema';
import { type CreateSettlementInput } from '../schema';
import { createSettlement } from '../handlers/create_settlement';
import { eq, and } from 'drizzle-orm';

describe('createSettlement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId1: number;
  let testUserId2: number;
  let testGroupId: number;

  // Setup test data before each test
  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          name: 'User One',
          password_hash: 'hash1'
        },
        {
          email: 'user2@test.com',
          name: 'User Two',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    testUserId1 = users[0].id;
    testUserId2 = users[1].id;

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A group for testing',
        created_by: testUserId1
      })
      .returning()
      .execute();

    testGroupId = groups[0].id;

    // Add both users as members of the group
    await db.insert(groupMembersTable)
      .values([
        {
          group_id: testGroupId,
          user_id: testUserId1,
          role: 'admin'
        },
        {
          group_id: testGroupId,
          user_id: testUserId2,
          role: 'member'
        }
      ])
      .execute();
  });

  const testInput: CreateSettlementInput = {
    group_id: 0, // Will be set in beforeEach
    from_user: 0, // Will be set in beforeEach
    to_user: 0, // Will be set in beforeEach
    amount: 25.50,
    description: 'Settlement for dinner expenses'
  };

  it('should create a settlement', async () => {
    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2
    };

    const result = await createSettlement(input);

    // Basic field validation
    expect(result.group_id).toEqual(testGroupId);
    expect(result.from_user).toEqual(testUserId1);
    expect(result.to_user).toEqual(testUserId2);
    expect(result.amount).toEqual(25.50);
    expect(typeof result.amount).toBe('number');
    expect(result.description).toEqual('Settlement for dinner expenses');
    expect(result.id).toBeDefined();
    expect(result.settled_at).toBeInstanceOf(Date);
  });

  it('should save settlement to database', async () => {
    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2
    };

    const result = await createSettlement(input);

    // Query using proper drizzle syntax
    const settlements = await db.select()
      .from(settlementsTable)
      .where(eq(settlementsTable.id, result.id))
      .execute();

    expect(settlements).toHaveLength(1);
    expect(settlements[0].group_id).toEqual(testGroupId);
    expect(settlements[0].from_user).toEqual(testUserId1);
    expect(settlements[0].to_user).toEqual(testUserId2);
    expect(parseFloat(settlements[0].amount)).toEqual(25.50);
    expect(settlements[0].description).toEqual('Settlement for dinner expenses');
    expect(settlements[0].settled_at).toBeInstanceOf(Date);
  });

  it('should create settlement with null description', async () => {
    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2,
      description: null
    };

    const result = await createSettlement(input);

    expect(result.description).toBeNull();
    expect(result.amount).toEqual(25.50);
    expect(result.id).toBeDefined();
  });

  it('should throw error when from_user is not a group member', async () => {
    // Create a user who is not in the group
    const nonMember = await db.insert(usersTable)
      .values({
        email: 'nonmember@test.com',
        name: 'Non Member',
        password_hash: 'hash3'
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: nonMember[0].id,
      to_user: testUserId2
    };

    await expect(createSettlement(input)).rejects.toThrow(/from user is not a member/i);
  });

  it('should throw error when to_user is not a group member', async () => {
    // Create a user who is not in the group
    const nonMember = await db.insert(usersTable)
      .values({
        email: 'nonmember@test.com',
        name: 'Non Member',
        password_hash: 'hash3'
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: nonMember[0].id
    };

    await expect(createSettlement(input)).rejects.toThrow(/to user is not a member/i);
  });

  it('should throw error when trying to settle debt with oneself', async () => {
    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId1 // Same user as from_user
    };

    await expect(createSettlement(input)).rejects.toThrow(/cannot settle debt with yourself/i);
  });

  it('should throw error when group does not exist', async () => {
    const input = {
      ...testInput,
      group_id: 99999, // Non-existent group
      from_user: testUserId1,
      to_user: testUserId2
    };

    // This will fail because the users won't be members of non-existent group
    await expect(createSettlement(input)).rejects.toThrow(/from user is not a member/i);
  });

  it('should handle decimal amounts correctly', async () => {
    const input = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2,
      amount: 123.45
    };

    const result = await createSettlement(input);

    expect(result.amount).toEqual(123.45);
    expect(typeof result.amount).toBe('number');

    // Verify in database
    const settlements = await db.select()
      .from(settlementsTable)
      .where(eq(settlementsTable.id, result.id))
      .execute();

    expect(parseFloat(settlements[0].amount)).toEqual(123.45);
  });

  it('should allow multiple settlements between same users', async () => {
    const input1 = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2,
      amount: 10.00,
      description: 'First settlement'
    };

    const input2 = {
      ...testInput,
      group_id: testGroupId,
      from_user: testUserId1,
      to_user: testUserId2,
      amount: 15.00,
      description: 'Second settlement'
    };

    const result1 = await createSettlement(input1);
    const result2 = await createSettlement(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.amount).toEqual(10.00);
    expect(result2.amount).toEqual(15.00);
    expect(result1.description).toEqual('First settlement');
    expect(result2.description).toEqual('Second settlement');

    // Verify both exist in database
    const settlements = await db.select()
      .from(settlementsTable)
      .where(and(
        eq(settlementsTable.group_id, testGroupId),
        eq(settlementsTable.from_user, testUserId1),
        eq(settlementsTable.to_user, testUserId2)
      ))
      .execute();

    expect(settlements).toHaveLength(2);
  });
});