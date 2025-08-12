import { db } from '../db';
import { groupMembersTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type GroupMember } from '../schema';

export const getGroupMembers = async (groupId: number): Promise<GroupMember[]> => {
  try {
    // Join group_members with users to get user information
    const results = await db.select()
      .from(groupMembersTable)
      .innerJoin(usersTable, eq(groupMembersTable.user_id, usersTable.id))
      .where(eq(groupMembersTable.group_id, groupId))
      .execute();

    // Transform the joined results to match GroupMember schema
    return results.map(result => ({
      id: result.group_members.id,
      group_id: result.group_members.group_id,
      user_id: result.group_members.user_id,
      role: result.group_members.role,
      joined_at: result.group_members.joined_at
    }));
  } catch (error) {
    console.error('Failed to fetch group members:', error);
    throw error;
  }
};