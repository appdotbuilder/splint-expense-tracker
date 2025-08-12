import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable } from '../db/schema';
import { type RemoveGroupMemberInput } from '../schema';
import { removeGroupMember } from '../handlers/remove_group_member';
import { eq, and } from 'drizzle-orm';

describe('removeGroupMember', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test setup data
  let testUserId: number;
  let testGroupId: number;
  let memberUserId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'admin@test.com',
          name: 'Admin User',
          password_hash: 'hash123'
        },
        {
          email: 'member@test.com',
          name: 'Member User',
          password_hash: 'hash456'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    memberUserId = users[1].id;

    // Create test group
    const groups = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A group for testing',
        created_by: testUserId
      })
      .returning()
      .execute();

    testGroupId = groups[0].id;

    // Add both users as group members
    await db.insert(groupMembersTable)
      .values([
        {
          group_id: testGroupId,
          user_id: testUserId,
          role: 'admin'
        },
        {
          group_id: testGroupId,
          user_id: memberUserId,
          role: 'member'
        }
      ])
      .execute();
  });

  it('should remove an existing group member', async () => {
    const input: RemoveGroupMemberInput = {
      group_id: testGroupId,
      user_id: memberUserId
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(true);

    // Verify member was removed from database
    const remainingMembers = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, testGroupId),
          eq(groupMembersTable.user_id, memberUserId)
        )
      )
      .execute();

    expect(remainingMembers).toHaveLength(0);
  });

  it('should return false when trying to remove non-existent member', async () => {
    const input: RemoveGroupMemberInput = {
      group_id: testGroupId,
      user_id: 999 // Non-existent user ID
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(false);

    // Verify original members are still there
    const allMembers = await db.select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.group_id, testGroupId))
      .execute();

    expect(allMembers).toHaveLength(2);
  });

  it('should return false when trying to remove member from non-existent group', async () => {
    const input: RemoveGroupMemberInput = {
      group_id: 999, // Non-existent group ID
      user_id: memberUserId
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(false);

    // Verify original member still exists in the real group
    const originalMember = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, testGroupId),
          eq(groupMembersTable.user_id, memberUserId)
        )
      )
      .execute();

    expect(originalMember).toHaveLength(1);
  });

  it('should remove admin member', async () => {
    const input: RemoveGroupMemberInput = {
      group_id: testGroupId,
      user_id: testUserId // Remove the admin
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(true);

    // Verify admin was removed
    const adminMembers = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, testGroupId),
          eq(groupMembersTable.user_id, testUserId)
        )
      )
      .execute();

    expect(adminMembers).toHaveLength(0);

    // Verify only regular member remains
    const remainingMembers = await db.select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.group_id, testGroupId))
      .execute();

    expect(remainingMembers).toHaveLength(1);
    expect(remainingMembers[0].user_id).toBe(memberUserId);
  });

  it('should handle removing the last member from a group', async () => {
    // First remove the regular member
    await removeGroupMember({
      group_id: testGroupId,
      user_id: memberUserId
    });

    // Then remove the admin (last member)
    const input: RemoveGroupMemberInput = {
      group_id: testGroupId,
      user_id: testUserId
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(true);

    // Verify group has no members
    const remainingMembers = await db.select()
      .from(groupMembersTable)
      .where(eq(groupMembersTable.group_id, testGroupId))
      .execute();

    expect(remainingMembers).toHaveLength(0);

    // Group should still exist (just empty)
    const group = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, testGroupId))
      .execute();

    expect(group).toHaveLength(1);
  });

  it('should handle multiple groups correctly', async () => {
    // Create a second group
    const secondGroup = await db.insert(groupsTable)
      .values({
        name: 'Second Group',
        description: 'Another test group',
        created_by: testUserId
      })
      .returning()
      .execute();

    const secondGroupId = secondGroup[0].id;

    // Add member to second group
    await db.insert(groupMembersTable)
      .values({
        group_id: secondGroupId,
        user_id: memberUserId,
        role: 'member'
      })
      .execute();

    // Remove member from first group
    const input: RemoveGroupMemberInput = {
      group_id: testGroupId,
      user_id: memberUserId
    };

    const result = await removeGroupMember(input);

    expect(result).toBe(true);

    // Member should be removed from first group
    const firstGroupMembers = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, testGroupId),
          eq(groupMembersTable.user_id, memberUserId)
        )
      )
      .execute();

    expect(firstGroupMembers).toHaveLength(0);

    // Member should still exist in second group
    const secondGroupMembers = await db.select()
      .from(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, secondGroupId),
          eq(groupMembersTable.user_id, memberUserId)
        )
      )
      .execute();

    expect(secondGroupMembers).toHaveLength(1);
  });
});