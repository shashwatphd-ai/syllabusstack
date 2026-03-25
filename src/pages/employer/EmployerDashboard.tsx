import { useState } from 'react';
import { Building2, Key, Activity, Copy, Plus, Shield, Eye, EyeOff, Trash2, Webhook, Briefcase, Users, Star, MapPin, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  useEmployerAccount,
  useEmployerApiKeys,
  useEmployerApiRequests,
  useCreateEmployerAccount,
  useGenerateApiKey,
  useRevokeApiKey
} from '@/hooks/useEmployerAccount';
import { useToast } from '@/hooks/use-toast';
import { WebhookConfig } from '@/components/employer/WebhookConfig';
import { EmployerCapstoneTab } from '@/components/employer/EmployerCapstoneTab';

export default function EmployerDashboard() {
  const { data: account, isLoading: accountLoading } = useEmployerAccount();
  const { data: apiKeys } = useEmployerApiKeys(account?.id);
  const { data: requests } = useEmployerApiRequests(account?.id);
  const createAccount = useCreateEmployerAccount();
  const generateKey = useGenerateApiKey();
  const revokeKey = useRevokeApiKey();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const usagePercent = account 
    ? (account.verifications_this_month / account.monthly_verification_limit) * 100 
    : 0;

  const handleCreateAccount = async () => {
    await createAccount.mutateAsync({ company_name: newCompanyName });
    setNewCompanyName('');
    setShowCreateDialog(false);
  };

  const handleGenerateKey = async () => {
    if (!account) return;
    const result = await generateKey.mutateAsync({
      employer_account_id: account.id,
      name: newKeyName || 'Default Key',
    });
    if (result?.[0]?.api_key) {
      setGeneratedKey(result[0].api_key);
    }
    setNewKeyName('');
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      toast({ title: 'Copied', description: 'API key copied to clipboard' });
    }
  };

  if (accountLoading) {
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

  // No account - show signup
  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
            <CardTitle>Employer Verification Portal</CardTitle>
            <CardDescription>
              Verify candidate credentials and course completions with our API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Features:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instant certificate verification API</li>
                <li>• Verify identity-confirmed credentials</li>
                <li>• Access mastery scores and skill breakdowns</li>
                <li>• 100 verifications/month on Basic plan</li>
              </ul>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full" size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Employer Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Employer Account</DialogTitle>
                  <DialogDescription>
                    Enter your company name to get started with credential verification.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Company name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateAccount} disabled={!newCompanyName || createAccount.isPending}>
                    {createAccount.isPending ? 'Creating...' : 'Create Account'}
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
            <h1 className="text-2xl font-bold">{account.company_name}</h1>
            <p className="text-muted-foreground text-sm">
              Employer Verification Portal • {account.plan} plan
            </p>
          </div>
        </div>
        <Badge variant={account.is_active ? 'default' : 'secondary'}>
          {account.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Monthly Verifications</span>
              <span className="text-sm text-muted-foreground">
                {account.verifications_this_month} / {account.monthly_verification_limit}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{apiKeys?.filter(k => k.is_active).length || 0}</p>
              <p className="text-sm text-muted-foreground">Active API Keys</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-secondary/50 rounded-lg">
              <Activity className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{requests?.length || 0}</p>
              <p className="text-sm text-muted-foreground">API Requests (Last 100)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </TabsTrigger>
          <TabsTrigger value="capstone" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Capstone Projects
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <Shield className="h-4 w-4" />
            API Docs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">API Keys</h2>
            <Dialog open={showKeyDialog} onOpenChange={(open) => {
              setShowKeyDialog(open);
              if (!open) setGeneratedKey(null);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate New Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {generatedKey ? 'API Key Generated' : 'Generate API Key'}
                  </DialogTitle>
                  <DialogDescription>
                    {generatedKey 
                      ? 'Copy this key now. It won\'t be shown again.'
                      : 'Give your API key a name for identification.'
                    }
                  </DialogDescription>
                </DialogHeader>
                {generatedKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={generatedKey}
                        readOnly
                        className="font-mono"
                      />
                      <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} aria-label={showKey ? "Hide API key" : "Show API key"}>
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={copyKey} aria-label="Copy API key">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                      ⚠️ This key will not be shown again. Make sure to save it securely.
                    </div>
                  </div>
                ) : (
                  <Input
                    placeholder="Key name (e.g., Production, Testing)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                )}
                <DialogFooter>
                  {generatedKey ? (
                    <Button onClick={() => {
                      setShowKeyDialog(false);
                      setGeneratedKey(null);
                    }}>
                      Done
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setShowKeyDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleGenerateKey} disabled={generateKey.isPending}>
                        {generateKey.isPending ? 'Generating...' : 'Generate'}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2">
            {apiKeys?.map((key) => (
              <Card key={key.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}...
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p>{key.request_count} requests</p>
                      <p className="text-muted-foreground">
                        {key.last_used_at 
                          ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                          : 'Never used'}
                      </p>
                    </div>
                    <Badge variant={key.is_active ? 'default' : 'secondary'}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                    {key.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeKey.mutate(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!apiKeys?.length && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No API keys yet</p>
                  <p className="text-sm">Generate a key to start verifying credentials</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <WebhookConfig accountId={account.id} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <h2 className="text-lg font-semibold">Recent API Activity</h2>
          <div className="space-y-2">
            {requests?.slice(0, 20).map((req) => (
              <Card key={req.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={req.response_status === 200 ? 'default' : 'destructive'}>
                      {req.response_status}
                    </Badge>
                    <span className="font-mono text-sm">{req.endpoint}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {req.response_time_ms}ms • {new Date(req.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!requests?.length && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No API activity yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="capstone" className="space-y-4">
          <EmployerCapstoneTab companyName={account.company_name} />
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification API</CardTitle>
              <CardDescription>
                Verify certificates using our REST API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                <p className="text-muted-foreground mb-2"># Verify a certificate</p>
                <p>POST /functions/v1/employer-verify-completion</p>
                <p className="text-muted-foreground mt-2"># Headers</p>
                <p>x-api-key: your_api_key</p>
                <p>Content-Type: application/json</p>
                <p className="text-muted-foreground mt-2"># Body</p>
                <pre>{`{
  "certificate_number": "SS-XXXXXX"
  // OR "share_token": "..."
  // OR "certificate_id": "uuid"
}`}</pre>
              </div>

              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                <p className="text-muted-foreground mb-2"># Response</p>
                <pre>{`{
  "valid": true,
  "certificate": {
    "certificate_number": "SS-123456",
    "certificate_type": "assessed",
    "course_title": "Data Science 101",
    "mastery_score": 87.5,
    "identity_verified": true,
    "completion_date": "2026-01-20"
  }
}`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
