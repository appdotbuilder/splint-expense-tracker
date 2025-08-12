import { db } from '../db';
import { settlementsTable, groupMembersTable, usersTable } from '../db/schema';
import { type CreateSettlementInput, type Settlement } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createSettlement = async (input: CreateSettlementInput): Promise<Settlement> => {
  try {
    // Validate that both users exist and are members of the group
    const fromUserMembership = await db.select()
      .from(groupMembersTable)
      .where(and(
        eq(groupMembersTable.group_id, input.group_id),
        eq(groupMembersTable.user_id, input.from_user)
      ))
      .execute();

    if (fromUserMembership.length === 0) {
      throw new Error('From user is not a member of this group');
    }

    const toUserMembership = await db.select()
      .from(groupMembersTable)
      .where(and(
        eq(groupMembersTable.group_id, input.group_id),
        eq(groupMembersTable.user_id, input.to_user)
      ))
      .execute();

    if (toUserMembership.length === 0) {
      throw new Error('To user is not a member of this group');
    }

    // Ensure from_user and to_user are different
    if (input.from_user === input.to_user) {
      throw new Error('Cannot settle debt with yourself');
    }

    // Insert settlement record
    const result = await db.insert(settlementsTable)
      .values({
        group_id: input.group_id,
        from_user: input.from_user,
        to_user: input.to_user,
        amount: input.amount.toString(), // Convert number to string for numeric column
        description: input.description
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const settlement = result[0];
    return {
      ...settlement,
      amount: parseFloat(settlement.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Settlement creation failed:', error);
    throw error;
  }
};