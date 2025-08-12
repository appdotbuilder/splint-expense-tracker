import { db } from '../db';
import { groupsTable } from '../db/schema';
import { type UpdateGroupInput, type Group } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateGroup(input: UpdateGroupInput): Promise<Group | null> {
  try {
    // Check if the group exists first
    const existingGroups = await db.select()
      .from(groupsTable)
      .where(eq(groupsTable.id, input.id))
      .execute();

    if (existingGroups.length === 0) {
      return null;
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof groupsTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    // If no fields to update, return the existing group
    if (Object.keys(updateData).length === 0) {
      return existingGroups[0];
    }

    // Update the group
    const result = await db.update(groupsTable)
      .set(updateData)
      .where(eq(groupsTable.id, input.id))
      .returning()
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Group update failed:', error);
    throw error;
  }
}