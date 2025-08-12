import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, Calendar, UserCheck, Loader2, Search, UserPlus } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { User, Group, CreateGroupInput, GroupMember } from '../../../server/src/schema';

interface GroupManagerProps {
  currentUser: User;
  groups: Group[];
  selectedGroup: Group | null;
  onGroupCreated: (group: Group) => void;
  onGroupSelected: (group: Group) => void;
  onGroupsUpdated: () => void;
}

export function GroupManager({
  currentUser,
  groups,
  selectedGroup,
  onGroupCreated,
  onGroupSelected,
  onGroupsUpdated
}: GroupManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<(GroupMember & { user_name?: string })[]>([]);

  const [newGroupData, setNewGroupData] = useState<CreateGroupInput>({
    name: '',
    description: null,
    created_by: currentUser.id
  });

  const [memberEmail, setMemberEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const group = await trpc.createGroup.mutate(newGroupData);
      setSuccess('Group created successfully!');
      onGroupCreated(group);
      setNewGroupData({
        name: '',
        description: null,
        created_by: currentUser.id
      });
      setIsCreateDialogOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupMembers = useCallback(async (groupId: number) => {
    try {
      const members = await trpc.getGroupMembers.query({ groupId });
      setGroupMembers(members);
    } catch (error) {
      console.error('Failed to load group members:', error);
    }
  }, []);

  const handleGroupSelect = (group: Group) => {
    onGroupSelected(group);
    loadGroupMembers(group.id);
  };

  const handleSearchUser = async () => {
    if (!memberEmail) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const user = await trpc.getUserByEmail.query({ email: memberEmail });
      setSearchedUser(user);
    } catch (error: any) {
      setError(error.message || 'User not found');
      setSearchedUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchedUser || !selectedGroup) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await trpc.addGroupMember.mutate({
        group_id: selectedGroup.id,
        user_id: searchedUser.id,
        role: 'member'
      });
      setSuccess('Member added successfully!');
      setMemberEmail('');
      setSearchedUser(null);
      setIsAddMemberDialogOpen(false);
      loadGroupMembers(selectedGroup.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
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

      {/* Create Group Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a new expense group to track shared expenses with friends or family.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Vacation 2024, Roommates"
                value={newGroupData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewGroupData((prev: CreateGroupInput) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description (Optional)</Label>
              <Textarea
                id="group-description"
                placeholder="Describe what this group is for..."
                value={newGroupData.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNewGroupData((prev: CreateGroupInput) => ({
                    ...prev,
                    description: e.target.value || null
                  }))
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Group'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      {selectedGroup && (
        <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Member to {selectedGroup.name}</DialogTitle>
              <DialogDescription>
                Search for a user by email to add them to this group.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter user's email address"
                  value={memberEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMemberEmail(e.target.value)}
                  type="email"
                />
                <Button onClick={handleSearchUser} disabled={isLoading || !memberEmail}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              {searchedUser && (
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800">{searchedUser.name}</p>
                      <p className="text-sm text-green-600">{searchedUser.email}</p>
                    </div>
                    <Button onClick={handleAddMember} disabled={isLoading} size="sm">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Add to Group'
                      )}
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => {
                  setIsAddMemberDialogOpen(false);
                  setMemberEmail('');
                  setSearchedUser(null);
                  setError(null);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Groups List */}
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No groups yet. Create your first group above!
            </p>
          ) : (
            groups.map((group: Group) => (
              <div
                key={group.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedGroup?.id === group.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => handleGroupSelect(group)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center mt-2 space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {group.created_at.toLocaleDateString()}
                      </Badge>
                      {group.created_by === currentUser.id && (
                        <Badge variant="outline" className="text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Group Members */}
      {selectedGroup && groupMembers.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2 flex items-center">
            <Users className="h-4 w-4 mr-1" />
            Members ({groupMembers.length})
          </h4>
          <div className="space-y-1">
            {groupMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {member.user_name || `User ${member.user_id}`}
                </span>
                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}