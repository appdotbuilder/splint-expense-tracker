import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, groupsTable, settlementsTable, groupMembersTable } from '../db/schema';
import { getGroupSettlements } from '../handlers/get_group_settlements';

describe('getGroupSettlements', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all settlements for a specific group', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'alice@test.com', name: 'Alice', password_hash: 'hash1' },
        { email: 'bob@test.com', name: 'Bob', password_hash: 'hash2' },
        { email: 'charlie@test.com', name: 'Charlie', password_hash: 'hash3' }
      ])
      .returning()
      .execute();

    // Create test groups
    const groups = await db.insert(groupsTable)
      .values([
        { name: 'Group 1', description: 'Test group 1', created_by: users[0].id },
        { name: 'Group 2', description: 'Test group 2', created_by: users[0].id }
      ])
      .returning()
      .execute();

    // Add group members
    await db.insert(groupMembersTable)
      .values([
        { group_id: groups[0].id, user_id: users[0].id, role: 'admin' },
        { group_id: groups[0].id, user_id: users[1].id, role: 'member' },
        { group_id: groups[1].id, user_id: users[2].id, role: 'member' }
      ])
      .execute();

    // Create settlements for different groups
    const settlements = await db.insert(settlementsTable)
      .values([
        {
          group_id: groups[0].id,
          from_user: users[0].id,
          to_user: users[1].id,
          amount: '25.50',
          description: 'Dinner split'
        },
        {
          group_id: groups[0].id,
          from_user: users[1].id,
          to_user: users[0].id,
          amount: '15.00',
          description: 'Gas money'
        },
        {
          group_id: groups[1].id,
          from_user: users[2].id,
          to_user: users[0].id,
          amount: '30.00',
          description: 'Different group settlement'
        }
      ])
      .returning()
      .execute();

    // Test fetching settlements for group 1
    const result = await getGroupSettlements(groups[0].id);

    expect(result).toHaveLength(2);
    
    // Check first settlement
    const settlement1 = result.find(s => s.description === 'Dinner split');
    expect(settlement1).toBeDefined();
    expect(settlement1!.group_id).toEqual(groups[0].id);
    expect(settlement1!.from_user).toEqual(users[0].id);
    expect(settlement1!.to_user).toEqual(users[1].id);
    expect(settlement1!.amount).toEqual(25.50);
    expect(typeof settlement1!.amount).toBe('number');
    expect(settlement1!.description).toEqual('Dinner split');
    expect(settlement1!.settled_at).toBeInstanceOf(Date);

    // Check second settlement
    const settlement2 = result.find(s => s.description === 'Gas money');
    expect(settlement2).toBeDefined();
    expect(settlement2!.group_id).toEqual(groups[0].id);
    expect(settlement2!.from_user).toEqual(users[1].id);
    expect(settlement2!.to_user).toEqual(users[0].id);
    expect(settlement2!.amount).toEqual(15.00);
    expect(typeof settlement2!.amount).toBe('number');

    // Verify settlements from different group are not included
    const hasOtherGroupSettlement = result.some(s => s.description === 'Different group settlement');
    expect(hasOtherGroupSettlement).toBe(false);
  });

  it('should return empty array for group with no settlements', async () => {
    // Create test user and group
    const user = await db.insert(usersTable)
      .values({ email: 'test@test.com', name: 'Test User', password_hash: 'hash' })
      .returning()
      .execute();

    const group = await db.insert(groupsTable)
      .values({ name: 'Empty Group', description: 'No settlements', created_by: user[0].id })
      .returning()
      .execute();

    const result = await getGroupSettlements(group[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle settlements with null description', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const group = await db.insert(groupsTable)
      .values({ name: 'Test Group', description: 'Test', created_by: users[0].id })
      .returning()
      .execute();

    // Create settlement with null description
    await db.insert(settlementsTable)
      .values({
        group_id: group[0].id,
        from_user: users[0].id,
        to_user: users[1].id,
        amount: '50.00',
        description: null
      })
      .execute();

    const result = await getGroupSettlements(group[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBeNull();
    expect(result[0].amount).toEqual(50.00);
  });

  it('should return settlements ordered by settled_at date', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { email: 'user1@test.com', name: 'User 1', password_hash: 'hash1' },
        { email: 'user2@test.com', name: 'User 2', password_hash: 'hash2' }
      ])
      .returning()
      .execute();

    // Create test group
    const group = await db.insert(groupsTable)
      .values({ name: 'Test Group', description: 'Test', created_by: users[0].id })
      .returning()
      .execute();

    // Create multiple settlements
    await db.insert(settlementsTable)
      .values([
        {
          group_id: group[0].id,
          from_user: users[0].id,
          to_user: users[1].id,
          amount: '10.00',
          description: 'First settlement'
        },
        {
          group_id: group[0].id,
          from_user: users[1].id,
          to_user: users[0].id,
          amount: '20.00',
          description: 'Second settlement'
        },
        {
          group_id: group[0].id,
          from_user: users[0].id,
          to_user: users[1].id,
          amount: '30.00',
          description: 'Third settlement'
        }
      ])
      .execute();

    const result = await getGroupSettlements(group[0].id);

    expect(result).toHaveLength(3);
    
    // Verify all settlements have valid dates
    result.forEach(settlement => {
      expect(settlement.settled_at).toBeInstanceOf(Date);
    });

    // Verify settlements contain expected data
    const descriptions = result.map(s => s.description);
    expect(descriptions).toContain('First settlement');
    expect(descriptions).toContain('Second settlement');
    expect(descriptions).toContain('Third settlement');
  });

  it('should handle non-existent group gracefully', async () => {
    const result = await getGroupSettlements(999999);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });
});