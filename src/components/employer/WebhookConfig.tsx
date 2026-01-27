import { useState } from 'react';
import { Webhook, Plus, Trash2, Copy, Eye, EyeOff, CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useEmployerWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  WEBHOOK_EVENTS,
  type EmployerWebhook,
} from '@/hooks/useEmployerAccount';
import { useToast } from '@/hooks/use-toast';

interface WebhookConfigProps {
  accountId: string;
}

export function WebhookConfig({ accountId }: WebhookConfigProps) {
  const { data: webhooks, isLoading } = useEmployerWebhooks(accountId);
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['certificate.issued']);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a webhook endpoint URL.',
        variant: 'destructive',
      });
      return;
    }

    if (newWebhookEvents.length === 0) {
      toast({
        title: 'Events required',
        description: 'Please select at least one event to subscribe to.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createWebhook.mutateAsync({
        employer_account_id: accountId,
        url: newWebhookUrl,
        events: newWebhookEvents,
      });
      setGeneratedSecret(result.secret);
    } catch {
      // Error handled by mutation
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewWebhookUrl('');
    setNewWebhookEvents(['certificate.issued']);
    setGeneratedSecret(null);
  };

  const toggleEvent = (event: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({ title: 'Copied', description: 'Signing secret copied to clipboard' });
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p>Loading webhooks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Endpoint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {generatedSecret ? 'Webhook Created' : 'Add Webhook Endpoint'}
              </DialogTitle>
              <DialogDescription>
                {generatedSecret
                  ? 'Save your signing secret now. It won\'t be shown again.'
                  : 'Configure a webhook to receive real-time notifications.'}
              </DialogDescription>
            </DialogHeader>

            {generatedSecret ? (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <Label className="text-xs text-muted-foreground">Signing Secret</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm font-mono break-all">{generatedSecret}</code>
                    <Button variant="ghost" size="icon" onClick={() => copySecret(generatedSecret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-destructive/10 text-destructive p-3 rounded text-sm flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>This secret is used to verify webhook signatures. Store it securely.</span>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseCreateDialog}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Endpoint URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://api.yourapp.com/webhooks/syllabusstack"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be an HTTPS URL that can receive POST requests.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Events to Subscribe</Label>
                    <div className="space-y-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <div
                          key={event.value}
                          className="flex items-start space-x-3 p-2 rounded border hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleEvent(event.value)}
                        >
                          <Checkbox
                            checked={newWebhookEvents.includes(event.value)}
                            onCheckedChange={() => toggleEvent(event.value)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{event.label}</p>
                            <p className="text-xs text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreateDialog}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWebhook} disabled={createWebhook.isPending}>
                    {createWebhook.isPending ? 'Creating...' : 'Create Webhook'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks?.map((webhook) => (
          <WebhookCard
            key={webhook.id}
            webhook={webhook}
            showSecret={showSecrets[webhook.id]}
            onToggleSecret={() => toggleSecretVisibility(webhook.id)}
            onCopySecret={() => webhook.secret && copySecret(webhook.secret)}
            onToggleActive={(active) =>
              updateWebhook.mutate({ id: webhook.id, is_active: active })
            }
            onDelete={() => deleteWebhook.mutate(webhook.id)}
            isUpdating={updateWebhook.isPending}
            isDeleting={deleteWebhook.isPending}
          />
        ))}

        {webhooks?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No webhook endpoints configured</p>
              <p className="text-sm">Add an endpoint to receive real-time notifications</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface WebhookCardProps {
  webhook: EmployerWebhook;
  showSecret: boolean;
  onToggleSecret: () => void;
  onCopySecret: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function WebhookCard({
  webhook,
  showSecret,
  onToggleSecret,
  onCopySecret,
  onToggleActive,
  onDelete,
  isUpdating,
  isDeleting,
}: WebhookCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {webhook.is_active ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <code className="text-sm font-mono truncate">{webhook.url}</code>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {webhook.events?.map((event) => (
                <Badge key={event} variant="secondary" className="text-xs">
                  {event}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {webhook.last_triggered_at && (
                <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}</span>
              )}
              {(webhook.failure_count ?? 0) > 0 && (
                <span className="text-destructive">
                  {webhook.failure_count} failed attempts
                </span>
              )}
            </div>

            {webhook.secret && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Secret:</span>
                <code className="text-xs font-mono">
                  {showSecret ? webhook.secret : '••••••••••••••••'}
                </code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleSecret}>
                  {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopySecret}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor={`active-${webhook.id}`} className="text-xs text-muted-foreground">
                Active
              </Label>
              <Switch
                id={`active-${webhook.id}`}
                checked={webhook.is_active ?? false}
                onCheckedChange={onToggleActive}
                disabled={isUpdating}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this webhook endpoint. You'll stop receiving
                    notifications at this URL.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
