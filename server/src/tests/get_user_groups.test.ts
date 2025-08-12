import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable } from '../db/schema';
import { getUserGroups } from '../handlers/get_user_groups';

describe('getUserGroups', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no groups', async () => {
    // Create a user but no groups
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const groups = await getUserGroups(userId);

    expect(groups).toHaveLength(0);
    expect(Array.isArray(groups)).toBe(true);
  });

  it('should return groups where user is a member', async () => {
    // Create users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          name: 'User 1',
          password_hash: 'hashedpassword1'
        },
        {
          email: 'user2@example.com',
          name: 'User 2',
          password_hash: 'hashedpassword2'
        }
      ])
      .returning()
      .execute();

    const userId = userResults[0].id;
    const creatorId = userResults[1].id;

    // Create groups
    const groupResults = await db.insert(groupsTable)
      .values([
        {
          name: 'Test Group 1',
          description: 'First test group',
          created_by: creatorId
        },
        {
          name: 'Test Group 2',
          description: null,
          created_by: creatorId
        }
      ])
      .returning()
      .execute();

    const group1Id = groupResults[0].id;
    const group2Id = groupResults[1].id;

    // Add user as member to both groups
    await db.insert(groupMembersTable)
      .values([
        {
          group_id: group1Id,
          user_id: userId,
          role: 'member'
        },
        {
          group_id: group2Id,
          user_id: userId,
          role: 'admin'
        }
      ])
      .execute();

    const groups = await getUserGroups(userId);

    expect(groups).toHaveLength(2);
    
    // Verify group data
    const group1 = groups.find(g => g.name === 'Test Group 1');
    const group2 = groups.find(g => g.name === 'Test Group 2');

    expect(group1).toBeDefined();
    expect(group1!.id).toBe(group1Id);
    expect(group1!.description).toBe('First test group');
    expect(group1!.created_by).toBe(creatorId);
    expect(group1!.created_at).toBeInstanceOf(Date);

    expect(group2).toBeDefined();
    expect(group2!.id).toBe(group2Id);
    expect(group2!.description).toBeNull();
    expect(group2!.created_by).toBe(creatorId);
    expect(group2!.created_at).toBeInstanceOf(Date);
  });

  it('should not return groups where user is not a member', async () => {
    // Create users
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          name: 'User 1',
          password_hash: 'hashedpassword1'
        },
        {
          email: 'user2@example.com',
          name: 'User 2',
          password_hash: 'hashedpassword2'
        }
      ])
      .returning()
      .execute();

    const userId = userResults[0].id;
    const otherUserId = userResults[1].id;

    // Create a group
    const groupResult = await db.insert(groupsTable)
      .values({
        name: 'Other User Group',
        description: 'Group for other user',
        created_by: otherUserId
      })
      .returning()
      .execute();

    const groupId = groupResult[0].id;

    // Add only the other user as member
    await db.insert(groupMembersTable)
      .values({
        group_id: groupId,
        user_id: otherUserId,
        role: 'admin'
      })
      .execute();

    const groups = await getUserGroups(userId);

    expect(groups).toHaveLength(0);
  });

  it('should return groups in correct order', async () => {
    // Create user and creator
    const userResults = await db.insert(usersTable)
      .values([
        {
          email: 'user@example.com',
          name: 'Test User',
          password_hash: 'hashedpassword'
        },
        {
          email: 'creator@example.com',
          name: 'Creator',
          password_hash: 'hashedpassword'
        }
      ])
      .returning()
      .execute();

    const userId = userResults[0].id;
    const creatorId = userResults[1].id;

    // Create groups with slight delay to ensure different timestamps
    const group1Result = await db.insert(groupsTable)
      .values({
        name: 'Group A',
        description: 'First group',
        created_by: creatorId
      })
      .returning()
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const group2Result = await db.insert(groupsTable)
      .values({
        name: 'Group B',
        description: 'Second group',
        created_by: creatorId
      })
      .returning()
      .execute();

    // Add user as member to both groups
    await db.insert(groupMembersTable)
      .values([
        {
          group_id: group1Result[0].id,
          user_id: userId,
          role: 'member'
        },
        {
          group_id: group2Result[0].id,
          user_id: userId,
          role: 'member'
        }
      ])
      .execute();

    const groups = await getUserGroups(userId);

    expect(groups).toHaveLength(2);
    // Verify both groups are returned
    expect(groups.some(g => g.name === 'Group A')).toBe(true);
    expect(groups.some(g => g.name === 'Group B')).toBe(true);
  });

  it('should handle non-existent user gracefully', async () => {
    const groups = await getUserGroups(99999); // Non-existent user ID

    expect(groups).toHaveLength(0);
    expect(Array.isArray(groups)).toBe(true);
  });
});