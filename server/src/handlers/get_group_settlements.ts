import { db } from '../db';
import { settlementsTable, usersTable } from '../db/schema';
import { type Settlement } from '../schema';
import { eq } from 'drizzle-orm';

export async function getGroupSettlements(groupId: number): Promise<Settlement[]> {
  try {
    // Query settlements with joined user data for from_user and to_user
    const results = await db.select({
      id: settlementsTable.id,
      group_id: settlementsTable.group_id,
      from_user: settlementsTable.from_user,
      to_user: settlementsTable.to_user,
      amount: settlementsTable.amount,
      description: settlementsTable.description,
      settled_at: settlementsTable.settled_at,
      from_user_name: usersTable.name,
    })
    .from(settlementsTable)
    .innerJoin(usersTable, eq(settlementsTable.from_user, usersTable.id))
    .where(eq(settlementsTable.group_id, groupId))
    .execute();

    // Convert numeric fields and return settlements
    return results.map(result => ({
      id: result.id,
      group_id: result.group_id,
      from_user: result.from_user,
      to_user: result.to_user,
      amount: parseFloat(result.amount),
      description: result.description,
      settled_at: result.settled_at
    }));
  } catch (error) {
    console.error('Failed to fetch group settlements:', error);
    throw error;
  }
}