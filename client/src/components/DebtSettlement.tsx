import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, DollarSign, TrendingUp, TrendingDown, CheckCircle, Calendar, User as UserIcon, Plus, Loader2 } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  Group, 
  GroupBalances, 
  GroupDebts, 
  Settlement, 
  CreateSettlementInput, 
  GroupMember 
} from '../../../server/src/schema';

interface DebtSettlementProps {
  group: Group;
  currentUser: User;
}

export function DebtSettlement({ group, currentUser }: DebtSettlementProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [balances, setBalances] = useState<GroupBalances | null>(null);
  const [debts, setDebts] = useState<GroupDebts | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { user_name?: string })[]>([]);

  const [newSettlementData, setNewSettlementData] = useState<CreateSettlementInput>({
    group_id: group.id,
    from_user: 0,
    to_user: 0,
    amount: 0,
    description: null
  });

  const loadBalances = useCallback(async () => {
    try {
      const result = await trpc.calculateGroupBalances.query({ groupId: group.id });
      setBalances(result);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  }, [group.id]);

  const loadDebts = useCallback(async () => {
    try {
      const result = await trpc.calculateGroupDebts.query({ groupId: group.id });
      setDebts(result);
    } catch (error) {
      console.error('Failed to load debts:', error);
    }
  }, [group.id]);

  const loadSettlements = useCallback(async () => {
    try {
      const result = await trpc.getGroupSettlements.query({ groupId: group.id });
      setSettlements(result);
    } catch (error) {
      console.error('Failed to load settlements:', error);
    }
  }, [group.id]);

  const loadGroupMembers = useCallback(async () => {
    try {
      const members = await trpc.getGroupMembers.query({ groupId: group.id });
      setGroupMembers(members);
    } catch (error) {
      console.error('Failed to load group members:', error);
    }
  }, [group.id]);

  useEffect(() => {
    loadBalances();
    loadDebts();
    loadSettlements();
    loadGroupMembers();
  }, [loadBalances, loadDebts, loadSettlements, loadGroupMembers]);

  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await trpc.createSettlement.mutate(newSettlementData);
      setSuccess('Settlement recorded successfully!');
      setNewSettlementData({
        group_id: group.id,
        from_user: 0,
        to_user: 0,
        amount: 0,
        description: null
      });
      setIsCreateDialogOpen(false);
      // Reload all data after settlement
      loadBalances();
      loadDebts();
      loadSettlements();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to record settlement');
    } finally {
      setIsLoading(false);
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return <TrendingUp className="h-4 w-4" />;
    if (balance < 0) return <TrendingDown className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getBalanceText = (balance: number) => {
    if (balance > 0) return `Gets back $${balance.toFixed(2)}`;
    if (balance < 0) return `Owes $${Math.abs(balance).toFixed(2)}`;
    return 'All settled up';
  };

  const getUserName = (userId: number) => {
    const member = groupMembers.find(m => m.user_id === userId);
    return member?.user_name || `User ${userId}`;
  };

  const currentUserBalance = balances?.balances.find(b => b.user_id === currentUser.id);
  const currentUserDebts = debts?.debts.filter(d => 
    d.from_user === currentUser.id || d.to_user === currentUser.id
  ) || [];

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Current User Summary */}
      {currentUserBalance && (
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Your Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 ${getBalanceColor(currentUserBalance.balance)}`}>
                {getBalanceIcon(currentUserBalance.balance)}
                <span className="text-2xl font-bold">
                  {getBalanceText(currentUserBalance.balance)}
                </span>
              </div>
            </div>
            {currentUserDebts.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Your active debts:</p>
                <div className="space-y-1">
                  {currentUserDebts.map((debt, index) => (
                    <div key={index} className="text-sm flex items-center">
                      {debt.from_user === currentUser.id ? (
                        <>
                          <span className="text-red-600">You owe </span>
                          <span className="font-medium mx-1">{debt.to_user_name}</span>
                          <span className="text-red-600">${debt.amount.toFixed(2)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-green-600">{debt.from_user_name} owes you </span>
                          <span className="text-green-600 font-medium">${debt.amount.toFixed(2)}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Record Settlement Button */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Record Settlement
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Settlement</DialogTitle>
            <DialogDescription>
              Record a payment that was made to settle a debt
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSettlement} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-user">From (Payer)</Label>
                <Select
                  value={newSettlementData.from_user.toString() || ''}
                  onValueChange={(value) =>
                    setNewSettlementData((prev: CreateSettlementInput) => ({ 
                      ...prev, 
                      from_user: parseInt(value) 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id.toString()}>
                        {member.user_name || `User ${member.user_id}`}
                        {member.user_id === currentUser.id && ' (You)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-user">To (Receiver)</Label>
                <Select
                  value={newSettlementData.to_user.toString() || ''}
                  onValueChange={(value) =>
                    setNewSettlementData((prev: CreateSettlementInput) => ({ 
                      ...prev, 
                      to_user: parseInt(value) 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select receiver" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id.toString()}>
                        {member.user_name || `User ${member.user_id}`}
                        {member.user_id === currentUser.id && ' (You)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="settlement-amount">Amount ($)</Label>
              <Input
                id="settlement-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newSettlementData.amount || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewSettlementData((prev: CreateSettlementInput) => ({ 
                    ...prev, 
                    amount: parseFloat(e.target.value) || 0 
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settlement-description">Description (Optional)</Label>
              <Textarea
                id="settlement-description"
                placeholder="e.g., Cash payment for dinner expenses"
                value={newSettlementData.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNewSettlementData((prev: CreateSettlementInput) => ({ 
                    ...prev, 
                    description: e.target.value || null 
                  }))
                }
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || !newSettlementData.from_user || !newSettlementData.to_user || newSettlementData.amount <= 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  'Record Settlement'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Group Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Group Balances
            </CardTitle>
            <CardDescription>Who owes what in this group</CardDescription>
          </CardHeader>
          <CardContent>
            {balances && balances.balances.length > 0 ? (
              <div className="space-y-3">
                {balances.balances.map((balance) => (
                  <div key={balance.user_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-3">
                      {getBalanceIcon(balance.balance)}
                      <span className="font-medium">{balance.user_name}</span>
                      {balance.user_id === currentUser.id && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className={`text-sm font-medium ${getBalanceColor(balance.balance)}`}>
                      {getBalanceText(balance.balance)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No balances to show</p>
            )}
          </CardContent>
        </Card>

        {/* Suggested Settlements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRight className="h-5 w-5 mr-2" />
              Suggested Settlements
            </CardTitle>
            <CardDescription>Optimal way to settle all debts</CardDescription>
          </CardHeader>
          <CardContent>
            {debts && debts.debts.length > 0 ? (
              <div className="space-y-3">
                {debts.debts.map((debt, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <div className="text-sm font-medium">{debt.from_user_name}</div>
                        <ArrowRight className="h-4 w-4 text-gray-400 mx-auto mt-1" />
                        <div className="text-sm font-medium">{debt.to_user_name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${debt.amount.toFixed(2)}
                      </div>
                      {(debt.from_user === currentUser.id || debt.to_user === currentUser.id) && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Involves you
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-2" />
                <p className="text-green-600 font-medium">All settled up! 🎉</p>
                <p className="text-sm text-gray-500 mt-1">No outstanding debts in this group</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Settlement History
          </CardTitle>
          <CardDescription>Recent payments and settlements</CardDescription>
        </CardHeader>
        <CardContent>
          {settlements.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {settlements.map((settlement) => (
                  <div key={settlement.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium">
                          {getUserName(settlement.from_user)} → {getUserName(settlement.to_user)}
                        </span>
                        <Badge variant="outline" className="text-green-600">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {settlement.amount.toFixed(2)}
                        </Badge>
                      </div>
                      {settlement.description && (
                        <p className="text-sm text-gray-600 ml-6">{settlement.description}</p>
                      )}
                      <p className="text-xs text-gray-500 ml-6">
                        {settlement.settled_at.toLocaleDateString()} at {settlement.settled_at.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-gray-500 text-center py-4">No settlements recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}