import { db } from '../db';
import { groupsTable, groupMembersTable } from '../db/schema';
import { type CreateGroupInput, type Group } from '../schema';

export const createGroup = async (input: CreateGroupInput): Promise<Group> => {
  try {
    // Start a transaction to ensure both group creation and member addition succeed together
    const result = await db.transaction(async (tx) => {
      // Insert the group record
      const groupResult = await tx.insert(groupsTable)
        .values({
          name: input.name,
          description: input.description,
          created_by: input.created_by
        })
        .returning()
        .execute();

      const group = groupResult[0];

      // Automatically add the creator as an admin member
      await tx.insert(groupMembersTable)
        .values({
          group_id: group.id,
          user_id: input.created_by,
          role: 'admin'
        })
        .execute();

      return group;
    });

    return result;
  } catch (error) {
    console.error('Group creation failed:', error);
    throw error;
  }
};