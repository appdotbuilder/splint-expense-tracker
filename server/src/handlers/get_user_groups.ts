import { db } from '../db';
import { groupsTable, groupMembersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Group } from '../schema';

export async function getUserGroups(userId: number): Promise<Group[]> {
  try {
    // Join groups with group_members to get all groups where user is a member
    const results = await db.select({
      id: groupsTable.id,
      name: groupsTable.name,
      description: groupsTable.description,
      created_by: groupsTable.created_by,
      created_at: groupsTable.created_at
    })
      .from(groupsTable)
      .innerJoin(groupMembersTable, eq(groupsTable.id, groupMembersTable.group_id))
      .where(eq(groupMembersTable.user_id, userId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get user groups:', error);
    throw error;
  }
}