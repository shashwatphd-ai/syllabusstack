import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Upload, Download, Search, MoreHorizontal, UserPlus,
  Mail, Trash2, CheckCircle, XCircle, Loader2, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSubscription } from '@/hooks/useSubscription';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/common/Pagination';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface OrgUser {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_active_at: string | null;
  subscription_tier: string;
  courses_count?: number;
}

export default function UserManagement() {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddingUsers, setIsAddingUsers] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');

  // Redirect if not university tier
  if (tier !== 'university') {
    navigate('/dashboard');
    return null;
  }

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<OrgUser[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          full_name,
          created_at,
          last_active_at,
          subscription_tier
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const inviteUsersMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const { data, error } = await supabase.functions.invoke('invite-users', {
        body: { emails },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Invitations sent',
        description: `Successfully invited ${data.sent} user(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setIsAddingUsers(false);
      setBulkEmails('');
    },
    onError: (error) => {
      toast({
        title: 'Failed to invite users',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('remove-org-user', {
        body: { userId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'User removed from organization' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to remove user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!search) return users;
    const searchLower = search.toLowerCase();
    return users.filter(user =>
      user.email?.toLowerCase().includes(searchLower) ||
      user.full_name?.toLowerCase().includes(searchLower)
    );
  }, [users, search]);

  // Paginate filtered users
  const {
    paginatedData: paginatedUsers,
    page,
    setPage,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination(filteredUsers, { pageSize: 20 });

  const handleBulkInvite = () => {
    const emails = bulkEmails
      .split(/[\n,;]/)
      .map(e => e.trim())
      .filter(e => e && e.includes('@'));

    if (emails.length === 0) {
      toast({
        title: 'No valid emails',
        description: 'Please enter at least one valid email address',
        variant: 'destructive',
      });
      return;
    }

    inviteUsersMutation.mutate(emails);
  };

  const handleExportCSV = () => {
    if (!users) return;

    const csv = [
      ['Email', 'Name', 'Joined', 'Last Active', 'Tier'].join(','),
      ...users.map(u => [
        u.email,
        u.full_name || '',
        format(new Date(u.created_at), 'yyyy-MM-dd'),
        u.last_active_at ? format(new Date(u.last_active_at), 'yyyy-MM-dd') : 'Never',
        u.subscription_tier || 'free',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to admin dashboard">
          <Link to="/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 flex items-center gap-2">
          <Users className="h-6 w-6" />
          <p className="text-muted-foreground">
            Manage student and staff accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isAddingUsers} onOpenChange={setIsAddingUsers}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Users
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Users</DialogTitle>
                <DialogDescription>
                  Invite users by email. They'll receive an invitation to join.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Addresses</Label>
                  <Textarea
                    placeholder="Enter emails (one per line or comma-separated)"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    You can also paste from a CSV or spreadsheet
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingUsers(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkInvite}
                  disabled={inviteUsersMutation.isPending}
                >
                  {inviteUsersMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Invitations
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !filteredUsers.length ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {user.last_active_at
                        ? format(new Date(user.last_active_at), 'MMM d, yyyy')
                        : <span className="text-muted-foreground">Never</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.last_active_at ? 'default' : 'secondary'}>
                        {user.last_active_at ? 'Active' : 'Invited'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="More user options">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Reminder
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => removeUserMutation.mutate(user.user_id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove from Org
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          hasNext={hasNext}
          hasPrev={hasPrev}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
        />
      )}
    </div>
  );
}
