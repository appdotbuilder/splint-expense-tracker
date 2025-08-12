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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Receipt, DollarSign, Calendar, User as UserIcon, Edit, Trash2, Loader2 } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, Group, Expense, CreateExpenseInput, UpdateExpenseInput, GroupMember } from '../../../server/src/schema';

interface ExpenseWithDetails extends Expense {
  paid_by_name?: string;
  participants?: Array<{
    user_id: number;
    user_name: string;
    share_amount: number;
  }>;
}

interface ExpenseTrackerProps {
  group: Group;
  currentUser: User;
}

export function ExpenseTracker({ group, currentUser }: ExpenseTrackerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { user_name?: string })[]>([]);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithDetails | null>(null);

  const [newExpenseData, setNewExpenseData] = useState<CreateExpenseInput>({
    group_id: group.id,
    paid_by: currentUser.id,
    amount: 0,
    description: '',
    participants: []
  });

  const [updateExpenseData, setUpdateExpenseData] = useState<UpdateExpenseInput>({
    id: 0,
    amount: undefined,
    description: undefined
  });

  const [selectedParticipants, setSelectedParticipants] = useState<Set<number>>(new Set([currentUser.id]));
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customShares, setCustomShares] = useState<Record<number, number>>({});

  const loadExpenses = useCallback(async () => {
    try {
      const result = await trpc.getGroupExpenses.query({ groupId: group.id });
      setExpenses(result);
    } catch (error) {
      console.error('Failed to load expenses:', error);
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
    loadExpenses();
    loadGroupMembers();
  }, [loadExpenses, loadGroupMembers]);

  const calculateShares = () => {
    if (splitType === 'equal') {
      const shareAmount = newExpenseData.amount / selectedParticipants.size;
      return Array.from(selectedParticipants).map(userId => ({
        user_id: userId,
        share_amount: shareAmount
      }));
    } else {
      return Array.from(selectedParticipants).map(userId => ({
        user_id: userId,
        share_amount: customShares[userId] || 0
      }));
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const participants = calculateShares();
    const totalShares = participants.reduce((sum, p) => sum + p.share_amount, 0);
    
    if (Math.abs(totalShares - newExpenseData.amount) > 0.01) {
      setError('Participant shares must add up to the total expense amount');
      setIsLoading(false);
      return;
    }

    try {
      await trpc.createExpense.mutate({
        ...newExpenseData,
        participants
      });
      
      setSuccess('Expense added successfully!');
      setNewExpenseData({
        group_id: group.id,
        paid_by: currentUser.id,
        amount: 0,
        description: '',
        participants: []
      });
      setSelectedParticipants(new Set([currentUser.id]));
      setCustomShares({});
      setSplitType('equal');
      setIsCreateDialogOpen(false);
      loadExpenses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to create expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await trpc.updateExpense.mutate(updateExpenseData);
      setSuccess('Expense updated successfully!');
      setIsEditDialogOpen(false);
      setEditingExpense(null);
      loadExpenses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to update expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await trpc.deleteExpense.mutate({ expenseId });
      setSuccess('Expense deleted successfully!');
      loadExpenses();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to delete expense');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (expense: ExpenseWithDetails) => {
    setEditingExpense(expense);
    setUpdateExpenseData({
      id: expense.id,
      amount: expense.amount,
      description: expense.description
    });
    setIsEditDialogOpen(true);
  };

  const handleParticipantToggle = (userId: number) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
      const newCustomShares = { ...customShares };
      delete newCustomShares[userId];
      setCustomShares(newCustomShares);
    } else {
      newSelected.add(userId);
    }
    setSelectedParticipants(newSelected);
  };

  const updateCustomShare = (userId: number, amount: number) => {
    setCustomShares(prev => ({
      ...prev,
      [userId]: amount
    }));
  };

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

      {/* Add Expense Button */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Add a new expense for {group.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense-amount">Amount ($)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newExpenseData.amount || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setNewExpenseData((prev: CreateExpenseInput) => ({ 
                      ...prev, 
                      amount: parseFloat(e.target.value) || 0 
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid-by">Paid By</Label>
                <Select
                  value={newExpenseData.paid_by.toString()}
                  onValueChange={(value) =>
                    setNewExpenseData((prev: CreateExpenseInput) => ({ 
                      ...prev, 
                      paid_by: parseInt(value) 
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                placeholder="e.g., Dinner at restaurant, Grocery shopping"
                value={newExpenseData.description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewExpenseData((prev: CreateExpenseInput) => ({ 
                    ...prev, 
                    description: e.target.value 
                  }))
                }
                required
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Split Between</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={splitType === 'equal' ? 'default' : 'outline'}
                  onClick={() => setSplitType('equal')}
                >
                  Split Equally
                </Button>
                <Button
                  type="button"
                  variant={splitType === 'custom' ? 'default' : 'outline'}
                  onClick={() => setSplitType('custom')}
                >
                  Custom Split
                </Button>
              </div>

              <div className="space-y-3">
                {groupMembers.map((member) => (
                  <div key={member.user_id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`participant-${member.user_id}`}
                      checked={selectedParticipants.has(member.user_id)}
                      onCheckedChange={() => handleParticipantToggle(member.user_id)}
                    />
                    <Label htmlFor={`participant-${member.user_id}`} className="flex-1">
                      {member.user_name || `User ${member.user_id}`}
                      {member.user_id === currentUser.id && ' (You)'}
                    </Label>
                    {splitType === 'equal' && selectedParticipants.has(member.user_id) && (
                      <Badge variant="secondary">
                        ${(newExpenseData.amount / selectedParticipants.size).toFixed(2)}
                      </Badge>
                    )}
                    {splitType === 'custom' && selectedParticipants.has(member.user_id) && (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customShares[member.user_id] || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateCustomShare(member.user_id, parseFloat(e.target.value) || 0)
                        }
                        className="w-24"
                      />
                    )}
                  </div>
                ))}
              </div>

              {splitType === 'custom' && (
                <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                  Total assigned: $
                  {Object.values(customShares).reduce((sum, amount) => sum + amount, 0).toFixed(2)} / $
                  {newExpenseData.amount.toFixed(2)}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || selectedParticipants.size === 0}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Expense'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>
              Update the expense details
            </DialogDescription>
          </DialogHeader>
          {editingExpense && (
            <form onSubmit={handleUpdateExpense} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount ($)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={updateExpenseData.amount || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUpdateExpenseData((prev: UpdateExpenseInput) => ({ 
                      ...prev, 
                      amount: parseFloat(e.target.value) || undefined 
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={updateExpenseData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUpdateExpenseData((prev: UpdateExpenseInput) => ({ 
                      ...prev, 
                      description: e.target.value || undefined 
                    }))
                  }
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Expense'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Expenses List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Receipt className="h-5 w-5 mr-2" />
          Recent Expenses
        </h3>
        
        {expenses.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <Receipt className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No expenses yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first expense above!</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {expenses.map((expense: ExpenseWithDetails) => (
                <Card key={expense.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{expense.description}</h4>
                          <Badge variant="outline">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {expense.amount.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <UserIcon className="h-3 w-3 mr-1" />
                            Paid by {expense.paid_by_name || `User ${expense.paid_by}`}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {expense.created_at.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}