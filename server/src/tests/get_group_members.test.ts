import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, groupMembersTable } from '../db/schema';
import { getGroupMembers } from '../handlers/get_group_members';

describe('getGroupMembers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for group with no members', async () => {
    // Create a user and group first
    const user = await db.insert(usersTable)
      .values({
        email: 'creator@test.com',
        name: 'Creator',
        password_hash: 'hash123'
      })
      .returning()
      .execute();

    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: user[0].id
      })
      .returning()
      .execute();

    const result = await getGroupMembers(group[0].id);

    expect(result).toEqual([]);
  });

  it('should return group members for valid group', async () => {
    // Create users
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

    // Create group
    const group = await db.insert(groupsTable)
      .values({
        name: 'Test Group',
        description: 'A test group',
        created_by: users[0].id
      })
      .returning()
      .execute();

    // Add group members
    const groupMembers = await db.insert(groupMembersTable)
      .values([
        {
          group_id: group[0].id,
          user_id: users[0].id,
          role: 'admin'
        },
        {
          group_id: group[0].id,
          user_id: users[1].id,
          role: 'member'
        }
      ])
      .returning()
      .execute();

    const result = await getGroupMembers(group[0].id);

    expect(result).toHaveLength(2);
    
    // Verify admin member
    const adminMember = result.find(m => m.role === 'admin');
    expect(adminMember).toBeDefined();
    expect(adminMember!.id).toEqual(groupMembers[0].id);
    expect(adminMember!.group_id).toEqual(group[0].id);
    expect(adminMember!.user_id).toEqual(users[0].id);
    expect(adminMember!.role).toEqual('admin');
    expect(adminMember!.joined_at).toBeInstanceOf(Date);

    // Verify regular member
    const regularMember = result.find(m => m.role === 'member');
    expect(regularMember).toBeDefined();
    expect(regularMember!.id).toEqual(groupMembers[1].id);
    expect(regularMember!.group_id).toEqual(group[0].id);
    expect(regularMember!.user_id).toEqual(users[1].id);
    expect(regularMember!.role).toEqual('member');
    expect(regularMember!.joined_at).toBeInstanceOf(Date);
  });

  it('should return only members of specified group', async () => {
    // Create users
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
        },
        {
          email: 'user3@test.com',
          name: 'User 3',
          password_hash: 'hash3'
        }
      ])
      .returning()
      .execute();

    // Create two groups
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

    // Add members to both groups
    await db.insert(groupMembersTable)
      .values([
        // Group 1 members
        {
          group_id: groups[0].id,
          user_id: users[0].id,
          role: 'admin'
        },
        {
          group_id: groups[0].id,
          user_id: users[1].id,
          role: 'member'
        },
        // Group 2 members
        {
          group_id: groups[1].id,
          user_id: users[1].id,
          role: 'admin'
        },
        {
          group_id: groups[1].id,
          user_id: users[2].id,
          role: 'member'
        }
      ])
      .execute();

    // Test Group 1 members
    const group1Members = await getGroupMembers(groups[0].id);
    expect(group1Members).toHaveLength(2);
    expect(group1Members.every(m => m.group_id === groups[0].id)).toBe(true);
    
    const group1UserIds = group1Members.map(m => m.user_id).sort();
    expect(group1UserIds).toEqual([users[0].id, users[1].id].sort());

    // Test Group 2 members
    const group2Members = await getGroupMembers(groups[1].id);
    expect(group2Members).toHaveLength(2);
    expect(group2Members.every(m => m.group_id === groups[1].id)).toBe(true);
    
    const group2UserIds = group2Members.map(m => m.user_id).sort();
    expect(group2UserIds).toEqual([users[1].id, users[2].id].sort());
  });

  it('should handle non-existent group gracefully', async () => {
    const result = await getGroupMembers(99999);
    expect(result).toEqual([]);
  });
});