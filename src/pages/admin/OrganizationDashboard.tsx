import { useState } from 'react';
import { Building2, Users, Mail, Settings, CreditCard, Shield, Plus, Trash2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useOrganization, 
  useOrganizationMembers, 
  useOrganizationInvitations,
  useOrganizationRole,
  useInviteUsers,
  useRemoveOrganizationMember,
  useCreateOrganization
} from '@/hooks/useOrganization';
import { Progress } from '@/components/ui/progress';

export default function OrganizationDashboard() {
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: members, isLoading: membersLoading } = useOrganizationMembers(organization?.id);
  const { data: invitations } = useOrganizationInvitations(organization?.id);
  const { data: userRole } = useOrganizationRole(organization?.id);
  const inviteUsers = useInviteUsers();
  const removeMember = useRemoveOrganizationMember();
  const createOrg = useCreateOrganization();

  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const seatUsagePercent = organization ? (organization.seats_used / organization.seat_limit) * 100 : 0;

  const handleInvite = async () => {
    if (!organization) return;
    const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
    await inviteUsers.mutateAsync({
      organization_id: organization.id,
      emails,
      role: inviteRole,
    });
    setInviteEmails('');
    setShowInviteDialog(false);
  };

  const handleCreateOrg = async () => {
    await createOrg.mutateAsync({ name: newOrgName });
    setNewOrgName('');
    setShowCreateDialog(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organization) return;
    await removeMember.mutateAsync({
      organization_id: organization.id,
      user_id: userId,
    });
  };

  if (orgLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  // No organization - show create option
  if (!organization) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Create Your Organization</CardTitle>
            <CardDescription>
              Set up an organization to manage your team, invite instructors, and track progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Organization</DialogTitle>
                  <DialogDescription>
                    Enter a name for your organization. You can customize settings later.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateOrg} disabled={!newOrgName || createOrg.isPending}>
                    {createOrg.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{organization.name}</h1>
            <p className="text-muted-foreground text-sm">
              {organization.type === 'university' ? 'University' : organization.type} • {organization.license_tier} plan
            </p>
          </div>
        </div>
        <Badge variant={organization.is_active ? 'default' : 'secondary'}>
          {organization.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Seat Usage</span>
              <span className="text-sm text-muted-foreground">
                {organization.seats_used} / {organization.seat_limit}
              </span>
            </div>
            <Progress value={seatUsagePercent} className="h-2" />
            {seatUsagePercent > 80 && (
              <p className="text-xs text-warning mt-2">Running low on seats</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{members?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Active Members</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <Mail className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{invitations?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Pending Invites</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            Invitations
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Team Members</h2>
            {isAdmin && (
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Members
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Members</DialogTitle>
                    <DialogDescription>
                      Enter email addresses separated by commas or new lines.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <textarea
                      className="w-full min-h-[100px] p-3 border rounded-md text-sm"
                      placeholder="email1@example.com, email2@example.com"
                      value={inviteEmails}
                      onChange={(e) => setInviteEmails(e.target.value)}
                    />
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={!inviteEmails || inviteUsers.isPending}>
                      {inviteUsers.isPending ? 'Sending...' : 'Send Invitations'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {members?.map((member) => (
                <Card key={member.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.profile?.avatar_url || ''} />
                        <AvatarFallback>
                          {member.profile?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.profile?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{member.profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      {isAdmin && member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={removeMember.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <h2 className="text-lg font-semibold">Pending Invitations</h2>
          {invitations?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending invitations</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {invitations?.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing & License
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge className="capitalize">{organization.license_tier}</Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Seat Limit</span>
                  <span>{organization.seat_limit} seats</span>
                </div>
                {organization.license_end_date && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Renewal Date</span>
                    <span>{new Date(organization.license_end_date).toLocaleDateString()}</span>
                  </div>
                )}
                <Button variant="outline" className="w-full">
                  Manage Subscription
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2">
                  <div>
                    <p className="font-medium">Single Sign-On (SSO)</p>
                    <p className="text-sm text-muted-foreground">Enable SAML/OIDC authentication</p>
                  </div>
                  <Badge variant={organization.sso_enabled ? 'default' : 'secondary'}>
                    {organization.sso_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
