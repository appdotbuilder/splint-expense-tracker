import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable } from '../db/schema';
import { type CreateGroupInput } from '../schema';
import { createGroup } from '../handlers/create_group';
import { eq, and } from 'drizzle-orm';

describe('createGroup', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;

  beforeEach(async () => {
    // Create a test user for group creation
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;
  });

  it('should create a group with basic information', async () => {
    const testInput: CreateGroupInput = {
      name: 'Test Group',
      description: 'A group for testing',
      created_by: testUserId
    };

    const result = await createGroup(testInput);

    // Validate returned group data
    expect(result.name).toEqual('Test Group');
    expect(result.description).toEqual('A group for testing');
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a group with null description', async () => {
    const testInput: CreateGroupInput = {
      name: 'Simple Group',
      description: null,
      created_by: testUserId
    };

    const result = await createGroup(testInput);

    expect(result.name).toEqual('Simple Group');
    expect(result.description).toBeNull();
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
  });

  it('should save group to database', async () => {
    const testInput: CreateGroupInput = {
      name: 'Database Group',
      description: 'Testing database persistence',
      created_by: testUserId
    };

    const result = await createGroup(testInput);

    // Verify group exists in database
    const groups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, result.id))
      .execute();

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toEqual('Database Group');
    expect(groups[0].description).toEqual('Testing database persistence');
    expect(groups[0].created_by).toEqual(testUserId);
    expect(groups[0].created_at).toBeInstanceOf(Date);
  });

  it('should automatically add creator as admin member', async () => {
    const testInput: CreateGroupInput = {
      name: 'Admin Group',
      description: 'Testing admin membership',
      created_by: testUserId
    };

    const result = await createGroup(testInput);

    // Verify creator is added as admin member
    const members = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, result.id),
          eq(groupMembersTable.user_id, testUserId)
        )
      )
      .execute();

    expect(members).toHaveLength(1);
    expect(members[0].group_id).toEqual(result.id);
    expect(members[0].user_id).toEqual(testUserId);
    expect(members[0].role).toEqual('admin');
    expect(members[0].joined_at).toBeInstanceOf(Date);
  });

  it('should handle transaction rollback on member addition failure', async () => {
    const testInput: CreateGroupInput = {
      name: 'Transaction Test',
      description: 'Testing transaction behavior',
      created_by: 999999 // Non-existent user ID to trigger foreign key constraint
    };

    // Should throw due to foreign key constraint violation
    await expect(createGroup(testInput)).rejects.toThrow();

    // Verify no group was created due to transaction rollback
    const groups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.name, 'Transaction Test'))
      .execute();

    expect(groups).toHaveLength(0);
  });

  it('should create multiple groups for same user', async () => {
    const firstGroup: CreateGroupInput = {
      name: 'First Group',
      description: 'First test group',
      created_by: testUserId
    };

    const secondGroup: CreateGroupInput = {
      name: 'Second Group',
      description: 'Second test group',
      created_by: testUserId
    };

    const firstResult = await createGroup(firstGroup);
    const secondResult = await createGroup(secondGroup);

    // Both groups should be created successfully
    expect(firstResult.id).not.toEqual(secondResult.id);
    expect(firstResult.name).toEqual('First Group');
    expect(secondResult.name).toEqual('Second Group');

    // Both should have the same creator
    expect(firstResult.created_by).toEqual(testUserId);
    expect(secondResult.created_by).toEqual(testUserId);

    // Verify both admin memberships exist
    const allMembers = await db.select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.user_id, testUserId))
      .execute();

    expect(allMembers).toHaveLength(2);
    expect(allMembers.every(member => member.role === 'admin')).toBe(true);
  });
});