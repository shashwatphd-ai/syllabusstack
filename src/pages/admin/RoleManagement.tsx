import { useState } from 'react';
import { Users, Search, Shield, GraduationCap, School, Plus, Minus, History, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

interface AuditLogEntry {
  id: string;
  user_id: string;
  old_roles: string[];
  new_roles: string[];
  action: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

const roleConfig = {
  student: { icon: GraduationCap, label: 'Student', color: 'bg-blue-500/10 text-blue-600' },
  instructor: { icon: School, label: 'Instructor', color: 'bg-green-500/10 text-green-600' },
  admin: { icon: Shield, label: 'Admin', color: 'bg-purple-500/10 text-purple-600' },
};

export default function RoleManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [roleToAdd, setRoleToAdd] = useState<string | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  // Search users
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      // Search profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email, full_name, created_at')
        .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (profilesError) throw profilesError;

      // Get roles for each user
      const userIds = profiles?.map((p) => p.user_id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        id: profile.user_id,
        email: profile.email || '',
        full_name: profile.full_name,
        created_at: profile.created_at,
        roles: roles?.filter((r) => r.user_id === profile.user_id).map((r) => r.role) || [],
      }));

      return usersWithRoles;
    },
    enabled: searchQuery.length >= 2,
  });

  // Fetch audit log
  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ['role-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  // Add role mutation
  const addRole = useMutation({
    mutationFn: async ({ userId, role, reason }: { userId: string; role: string; reason: string }) => {
      // Get current roles
      const { data: currentRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const oldRoles = currentRoles?.map((r) => r.role) || [];

      // Add role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;

      // Log the change
      const { error: auditError } = await supabase.from('role_audit_log').insert({
        user_id: userId,
        old_roles: oldRoles,
        new_roles: [...oldRoles, role],
        action: 'added',
        changed_by: user?.id,
        reason,
      });

      if (auditError) console.error('Audit log error:', auditError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-search'] });
      queryClient.invalidateQueries({ queryKey: ['role-audit-log'] });
      setRoleToAdd(null);
      setReason('');
      toast({
        title: 'Role added',
        description: 'The user role has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add role',
        variant: 'destructive',
      });
    },
  });

  // Remove role mutation
  const removeRole = useMutation({
    mutationFn: async ({ userId, role, reason }: { userId: string; role: string; reason: string }) => {
      // Get current roles
      const { data: currentRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const oldRoles = currentRoles?.map((r) => r.role) || [];

      // Remove role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (roleError) throw roleError;

      // Log the change
      const { error: auditError } = await supabase.from('role_audit_log').insert({
        user_id: userId,
        old_roles: oldRoles,
        new_roles: oldRoles.filter((r) => r !== role),
        action: 'removed',
        changed_by: user?.id,
        reason,
      });

      if (auditError) console.error('Audit log error:', auditError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-search'] });
      queryClient.invalidateQueries({ queryKey: ['role-audit-log'] });
      setRoleToRemove(null);
      setSelectedUser(null);
      setReason('');
      toast({
        title: 'Role removed',
        description: 'The user role has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove role',
        variant: 'destructive',
      });
    },
  });

  const handleAddRole = () => {
    if (!selectedUser || !roleToAdd) return;
    addRole.mutate({ userId: selectedUser.id, role: roleToAdd, reason });
  };

  const handleRemoveRole = () => {
    if (!selectedUser || !roleToRemove) return;
    removeRole.mutate({ userId: selectedUser.id, role: roleToRemove, reason });
  };

  return (
    <AppShell>
      <PageContainer>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Role Management
            </h1>
            <p className="text-muted-foreground">
              Assign and manage user roles across the platform.
            </p>
          </div>

          <Tabs defaultValue="manage">
            <TabsList>
              <TabsTrigger value="manage" className="gap-2">
                <Users className="h-4 w-4" />
                Manage Roles
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <History className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="space-y-4">
              {/* Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Search Users</CardTitle>
                  <CardDescription>
                    Search by email or name to find users and manage their roles.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button variant="outline" onClick={() => refetchUsers()}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results */}
              {usersLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Searching...</p>
                  </CardContent>
                </Card>
              ) : users && users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((u) => (
                    <Card key={u.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {u.full_name || 'No name'}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {u.email}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {u.roles.length === 0 ? (
                                <Badge variant="outline">No roles</Badge>
                              ) : (
                                u.roles.map((role) => {
                                  const config = roleConfig[role as keyof typeof roleConfig];
                                  return (
                                    <Badge
                                      key={role}
                                      className={config?.color || ''}
                                      variant="outline"
                                    >
                                      {config?.label || role}
                                    </Badge>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                          >
                            Edit Roles
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <p>No users found matching "{searchQuery}"</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Enter at least 2 characters to search</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Role Change History</CardTitle>
                  <CardDescription>
                    Recent role assignments and removals.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLoading ? (
                    <div className="py-8 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Loading audit log...</p>
                    </div>
                  ) : auditLog && auditLog.length > 0 ? (
                    <div className="space-y-3">
                      {auditLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                        >
                          <div
                            className={`p-2 rounded-full ${
                              entry.action === 'added'
                                ? 'bg-green-500/10 text-green-600'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {entry.action === 'added' ? (
                              <Plus className="h-4 w-4" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">
                                {entry.action === 'added' ? 'Added' : 'Removed'}
                              </span>{' '}
                              role(s):{' '}
                              {entry.action === 'added'
                                ? entry.new_roles.filter((r) => !entry.old_roles.includes(r)).join(', ')
                                : entry.old_roles.filter((r) => !entry.new_roles.includes(r)).join(', ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              User: {entry.user_id.slice(0, 8)}...
                            </p>
                            {entry.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Reason: {entry.reason}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No role changes recorded yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Edit Roles Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Roles</DialogTitle>
              <DialogDescription>
                {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>

            {selectedUser && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Current Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No roles assigned</p>
                    ) : (
                      selectedUser.roles.map((role) => {
                        const config = roleConfig[role as keyof typeof roleConfig];
                        return (
                          <Badge
                            key={role}
                            variant="outline"
                            className={`${config?.color || ''} cursor-pointer hover:opacity-80`}
                            onClick={() => setRoleToRemove(role)}
                          >
                            {config?.label || role}
                            <Minus className="h-3 w-3 ml-1" />
                          </Badge>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Add Role</p>
                  <div className="flex flex-wrap gap-2">
                    {(['student', 'instructor', 'admin'] as const)
                      .filter((role) => !selectedUser.roles.includes(role))
                      .map((role) => {
                        const config = roleConfig[role];
                        return (
                          <Badge
                            key={role}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10"
                            onClick={() => setRoleToAdd(role)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Role Confirmation */}
        <AlertDialog open={!!roleToAdd} onOpenChange={(open) => !open && setRoleToAdd(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Role</AlertDialogTitle>
              <AlertDialogDescription>
                Add the <strong>{roleConfig[roleToAdd as keyof typeof roleConfig]?.label}</strong> role
                to {selectedUser?.email}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Textarea
                placeholder="Reason for change (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setReason('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAddRole} disabled={addRole.isPending}>
                {addRole.isPending ? 'Adding...' : 'Add Role'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Role Confirmation */}
        <AlertDialog open={!!roleToRemove} onOpenChange={(open) => !open && setRoleToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Role</AlertDialogTitle>
              <AlertDialogDescription>
                Remove the <strong>{roleConfig[roleToRemove as keyof typeof roleConfig]?.label}</strong> role
                from {selectedUser?.email}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Textarea
                placeholder="Reason for change (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setReason('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveRole}
                disabled={removeRole.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeRole.isPending ? 'Removing...' : 'Remove Role'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppShell>
  );
}
