import { db } from '../db';
import { groupMembersTable } from '../db/schema';
import { type RemoveGroupMemberInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function removeGroupMember(input: RemoveGroupMemberInput): Promise<boolean> {
  try {
    // Remove the group member based on group_id and user_id
    const result = await db.delete(groupMembersTable)
      .where(
        and(
          eq(groupMembersTable.group_id, input.group_id),
          eq(groupMembersTable.user_id, input.user_id)
        )
      )
      .execute();

    // Return true if a record was deleted, false if no member was found
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Remove group member failed:', error);
    throw error;
  }
}