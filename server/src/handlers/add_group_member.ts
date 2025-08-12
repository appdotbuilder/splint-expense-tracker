import { db } from '../db';
import { groupMembersTable, groupsTable, usersTable } from '../db/schema';
import { type AddGroupMemberInput, type GroupMember } from '../schema';
import { eq, and } from 'drizzle-orm';

export const addGroupMember = async (input: AddGroupMemberInput): Promise<GroupMember> => {
  try {
    // Verify that the group exists
    const groupExists = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, input.group_id))
      .execute();

    if (groupExists.length === 0) {
      throw new Error(`Group with id ${input.group_id} not found`);
    }

    // Verify that the user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Check if user is already a member of the group
    const existingMember = await db.select()
      .from(groupMembersTable)
      .where(and(
        eq(groupMembersTable.group_id, input.group_id),
        eq(groupMembersTable.user_id, input.user_id)
      ))
      .execute();

    if (existingMember.length > 0) {
      throw new Error(`User is already a member of this group`);
    }

    // Insert new group member record
    const result = await db.insert(groupMembersTable)
      .values({
        group_id: input.group_id,
        user_id: input.user_id,
        role: input.role
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Add group member failed:', error);
    throw error;
  }
};