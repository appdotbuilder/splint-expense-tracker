import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable } from '../db/schema';
import { type AddGroupMemberInput } from '../schema';
import { addGroupMember } from '../handlers/add_group_member';
import { eq, and } from 'drizzle-orm';

describe('addGroupMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testGroupId: number;
  let anotherUserId: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    testUserId = user[0].id;

    // Create another test user
    const anotherUser = await db.insert(usersTable)
      .values({
        email: 'another@example.com',
        name: 'Another User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    anotherUserId = anotherUser[0].id;

    // Create test group
    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: testUserId
      })
      .returning()
      .execute();
    testGroupId = group[0].id;
  });

  it('should add a user to a group with default member role', async () => {
    const input: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'member'
    };

    const result = await addGroupMember(input);

    // Verify return value
    expect(result.group_id).toEqual(testGroupId);
    expect(result.user_id).toEqual(anotherUserId);
    expect(result.role).toEqual('member');
    expect(result.id).toBeDefined();
    expect(result.joined_at).toBeInstanceOf(Date);

    // Verify database record
    const members = await db.select()
      .from(groupMembersTable)
      .where(and(
        eq(groupMembersTable.group_id, testGroupId),
        eq(groupMembersTable.user_id, anotherUserId)
      ))
      .execute();

    expect(members).toHaveLength(1);
    expect(members[0].role).toEqual('member');
    expect(members[0].joined_at).toBeInstanceOf(Date);
  });

  it('should add a user to a group with admin role', async () => {
    const input: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'admin'
    };

    const result = await addGroupMember(input);

    expect(result.role).toEqual('admin');

    // Verify in database
    const members = await db.select()
      .from(groupMembersTable)
      .where(and(
        eq(groupMembersTable.group_id, testGroupId),
        eq(groupMembersTable.user_id, anotherUserId)
      ))
      .execute();

    expect(members).toHaveLength(1);
    expect(members[0].role).toEqual('admin');
  });

  it('should throw error when group does not exist', async () => {
    const input: AddGroupMemberInput = {
      group_id: 99999, // Non-existent group
      user_id: anotherUserId,
      role: 'member'
    };

    await expect(addGroupMember(input)).rejects.toThrow(/Group with id 99999 not found/i);
  });

  it('should throw error when user does not exist', async () => {
    const input: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: 99999, // Non-existent user
      role: 'member'
    };

    await expect(addGroupMember(input)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should throw error when user is already a member', async () => {
    // First, add the user as a member
    const input: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'member'
    };

    await addGroupMember(input);

    // Try to add the same user again
    await expect(addGroupMember(input)).rejects.toThrow(/User is already a member of this group/i);
  });

  it('should throw error when trying to add user with different role but already exists', async () => {
    // First, add the user as a member
    const memberInput: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'member'
    };

    await addGroupMember(memberInput);

    // Try to add the same user as admin
    const adminInput: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'admin'
    };

    await expect(addGroupMember(adminInput)).rejects.toThrow(/User is already a member of this group/i);
  });

  it('should allow adding multiple different users to the same group', async () => {
    // Create a third user
    const thirdUser = await db.insert(usersTable)
      .values({
        email: 'third@example.com',
        name: 'Third User',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Add first user
    const input1: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: anotherUserId,
      role: 'member'
    };

    const result1 = await addGroupMember(input1);
    expect(result1.user_id).toEqual(anotherUserId);

    // Add second user
    const input2: AddGroupMemberInput = {
      group_id: testGroupId,
      user_id: thirdUser[0].id,
      role: 'admin'
    };

    const result2 = await addGroupMember(input2);
    expect(result2.user_id).toEqual(thirdUser[0].id);

    // Verify both users are in the group
    const members = await db.select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.group_id, testGroupId))
      .execute();

    expect(members).toHaveLength(2);
    expect(members.map(m => m.user_id)).toContain(anotherUserId);
    expect(members.map(m => m.user_id)).toContain(thirdUser[0].id);
  });
});