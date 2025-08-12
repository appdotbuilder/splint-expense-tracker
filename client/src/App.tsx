import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Receipt, TrendingUp } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { GroupManager } from '@/components/GroupManager';
import { ExpenseTracker } from '@/components/ExpenseTracker';
import { DebtSettlement } from '@/components/DebtSettlement';
import { trpc } from '@/utils/trpc';
import type { User, Group } from '../../server/src/schema';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);

  const loadUserGroups = useCallback(async () => {
    if (!currentUser) return;
    try {
      const groups = await trpc.getUserGroups.query({ userId: currentUser.id });
      setUserGroups(groups);
      // If there's no selected group but we have groups, select the first one
      if (!selectedGroup && groups.length > 0) {
        setSelectedGroup(groups[0]);
      }
    } catch (error) {
      console.error('Failed to load user groups:', error);
    }
  }, [currentUser, selectedGroup]);

  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedGroup(null);
    setUserGroups([]);
  };

  const handleGroupCreated = (group: Group) => {
    setUserGroups(prev => [...prev, group]);
    setSelectedGroup(group);
  };

  const handleGroupSelected = (group: Group) => {
    setSelectedGroup(group);
  };

  // If user is not logged in, show login form
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center mb-4">
                  <DollarSign className="h-12 w-12 text-green-600" />
                  <h1 className="text-4xl font-bold text-gray-900 ml-2">Splint</h1>
                </div>
                <p className="text-gray-600">Track shared expenses and settle debts with ease</p>
              </div>
              <LoginForm onLogin={handleLogin} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900 ml-2">Splint</h1>
              </div>
              {selectedGroup && (
                <Badge variant="secondary" className="text-sm">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedGroup.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {currentUser.name}!</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Quick Stats */}
        {selectedGroup && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Group</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{selectedGroup.name}</div>
                <p className="text-xs text-gray-600 mt-1">
                  {selectedGroup.description || 'No description'}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
                <Receipt className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{userGroups.length}</div>
                <p className="text-xs text-gray-600 mt-1">Groups you're part of</p>
              </CardContent>
            </Card>
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Manage expenses and settle debts</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Group Management */}
          <div className="lg:col-span-1">
            <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Groups
                </CardTitle>
                <CardDescription>Manage your expense groups</CardDescription>
              </CardHeader>
              <CardContent>
                <GroupManager
                  currentUser={currentUser}
                  groups={userGroups}
                  selectedGroup={selectedGroup}
                  onGroupCreated={handleGroupCreated}
                  onGroupSelected={handleGroupSelected}
                  onGroupsUpdated={loadUserGroups}
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {selectedGroup ? (
              <Tabs defaultValue="expenses" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 bg-white/60 backdrop-blur-sm">
                  <TabsTrigger value="expenses" className="flex items-center">
                    <Receipt className="h-4 w-4 mr-2" />
                    Expenses
                  </TabsTrigger>
                  <TabsTrigger value="settlement" className="flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Settlement
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="expenses">
                  <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
                    <CardHeader>
                      <CardTitle>💰 Expense Tracking</CardTitle>
                      <CardDescription>
                        Add and manage expenses for {selectedGroup.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ExpenseTracker
                        group={selectedGroup}
                        currentUser={currentUser}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="settlement">
                  <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
                    <CardHeader>
                      <CardTitle>🤝 Debt Settlement</CardTitle>
                      <CardDescription>
                        View balances and settle debts for {selectedGroup.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DebtSettlement
                        group={selectedGroup}
                        currentUser={currentUser}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="bg-white/60 backdrop-blur-sm border-0 shadow-md">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Group Selected</h3>
                  <p className="text-gray-500 text-center mb-6">
                    {userGroups.length === 0
                      ? "Create your first group to start tracking expenses"
                      : "Select a group from the sidebar to manage expenses"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;