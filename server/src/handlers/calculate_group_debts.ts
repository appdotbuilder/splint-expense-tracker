import { db } from '../db';
import { expensesTable, expenseParticipantsTable, settlementsTable, groupMembersTable, usersTable } from '../db/schema';
import { type GroupDebts, type Debt } from '../schema';
import { eq, sum, SQL } from 'drizzle-orm';

interface UserBalance {
  user_id: number;
  user_name: string;
  balance: number;
}

export async function calculateGroupDebts(groupId: number): Promise<GroupDebts> {
  try {
    // Get all group members with their names
    const membersResult = await db.select({
      user_id: groupMembersTable.user_id,
      user_name: usersTable.name
    })
    .from(groupMembersTable)
    .innerJoin(usersTable, eq(groupMembersTable.user_id, usersTable.id))
    .where(eq(groupMembersTable.group_id, groupId))
    .execute();

    if (membersResult.length === 0) {
      return {
        group_id: groupId,
        debts: []
      };
    }

    // Calculate how much each user paid (expenses they covered)
    const paymentsResult = await db.select({
      user_id: expensesTable.paid_by,
      total_paid: sum(expensesTable.amount)
    })
    .from(expensesTable)
    .where(eq(expensesTable.group_id, groupId))
    .groupBy(expensesTable.paid_by)
    .execute();

    // Calculate how much each user owes (their share of all expenses)
    const sharesResult = await db.select({
      user_id: expenseParticipantsTable.user_id,
      total_share: sum(expenseParticipantsTable.share_amount)
    })
    .from(expenseParticipantsTable)
    .innerJoin(expensesTable, eq(expenseParticipantsTable.expense_id, expensesTable.id))
    .where(eq(expensesTable.group_id, groupId))
    .groupBy(expenseParticipantsTable.user_id)
    .execute();

    // Calculate existing settlements (money already paid back)
    const settlementsFromResult = await db.select({
      user_id: settlementsTable.from_user,
      total_settled: sum(settlementsTable.amount)
    })
    .from(settlementsTable)
    .where(eq(settlementsTable.group_id, groupId))
    .groupBy(settlementsTable.from_user)
    .execute();

    const settlementsToResult = await db.select({
      user_id: settlementsTable.to_user,
      total_received: sum(settlementsTable.amount)
    })
    .from(settlementsTable)
    .where(eq(settlementsTable.group_id, groupId))
    .groupBy(settlementsTable.to_user)
    .execute();

    // Create balance map for each user
    const balances: Map<number, UserBalance> = new Map();
    
    // Initialize all members with zero balance
    membersResult.forEach(member => {
      balances.set(member.user_id, {
        user_id: member.user_id,
        user_name: member.user_name,
        balance: 0
      });
    });

    // Add amounts paid by each user (positive contribution)
    paymentsResult.forEach(payment => {
      const balance = balances.get(payment.user_id);
      if (balance) {
        balance.balance += parseFloat(payment.total_paid || '0');
      }
    });

    // Subtract amounts owed by each user (negative contribution)
    sharesResult.forEach(share => {
      const balance = balances.get(share.user_id);
      if (balance) {
        balance.balance -= parseFloat(share.total_share || '0');
      }
    });

    // Adjust for existing settlements (money already paid back)
    // When someone pays a settlement, it improves their balance (they owe less)
    settlementsFromResult.forEach(settlement => {
      const balance = balances.get(settlement.user_id);
      if (balance) {
        balance.balance += parseFloat(settlement.total_settled || '0');
      }
    });

    // When someone receives a settlement, it reduces their balance (they are owed less)
    settlementsToResult.forEach(settlement => {
      const balance = balances.get(settlement.user_id);
      if (balance) {
        balance.balance -= parseFloat(settlement.total_received || '0');
      }
    });

    // Calculate optimal debt settlements using greedy algorithm
    const debts = calculateOptimalDebts(Array.from(balances.values()));

    return {
      group_id: groupId,
      debts
    };
  } catch (error) {
    console.error('Group debt calculation failed:', error);
    throw error;
  }
}

function calculateOptimalDebts(balances: UserBalance[]): Debt[] {
  const debts: Debt[] = [];
  const EPSILON = 0.01; // Small threshold to handle floating point precision issues
  
  // Create working copies
  const creditors = balances.filter(b => b.balance > EPSILON).map(b => ({ ...b }));
  const debtors = balances.filter(b => b.balance < -EPSILON).map(b => ({ ...b }));
  
  // Sort creditors (owed money) in descending order of balance
  creditors.sort((a, b) => b.balance - a.balance);
  
  // Sort debtors (owe money) in ascending order of balance (most negative first)
  debtors.sort((a, b) => a.balance - b.balance);
  
  let creditorIndex = 0;
  let debtorIndex = 0;
  
  // Match creditors with debtors to minimize transactions
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    
    // Calculate settlement amount (minimum of what's owed and what's due)
    const settlementAmount = Math.min(creditor.balance, Math.abs(debtor.balance));
    
    if (settlementAmount > EPSILON) {
      debts.push({
        from_user: debtor.user_id,
        from_user_name: debtor.user_name,
        to_user: creditor.user_id,
        to_user_name: creditor.user_name,
        amount: parseFloat(settlementAmount.toFixed(2))
      });
      
      // Update balances
      creditor.balance -= settlementAmount;
      debtor.balance += settlementAmount;
    }
    
    // Move to next creditor/debtor if current one is settled
    if (Math.abs(creditor.balance) < EPSILON) {
      creditorIndex++;
    }
    if (Math.abs(debtor.balance) < EPSILON) {
      debtorIndex++;
    }
  }
  
  return debts;
}