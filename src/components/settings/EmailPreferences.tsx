import { useState, useEffect } from 'react';
import { Bell, Mail, TrendingUp, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface EmailPreferencesData {
  weekly_digest: boolean;
  progress_updates: boolean;
  new_recommendations: boolean;
}

const defaultPreferences: EmailPreferencesData = {
  weekly_digest: true,
  progress_updates: true,
  new_recommendations: true,
};

export function EmailPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<EmailPreferencesData>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_preferences')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (data?.email_preferences && typeof data.email_preferences === 'object') {
        const prefs = data.email_preferences as Record<string, unknown>;
        setPreferences({
          weekly_digest: Boolean(prefs.weekly_digest ?? defaultPreferences.weekly_digest),
          progress_updates: Boolean(prefs.progress_updates ?? defaultPreferences.progress_updates),
          new_recommendations: Boolean(prefs.new_recommendations ?? defaultPreferences.new_recommendations),
        });
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof EmailPreferencesData, value: boolean) => {
    if (!user) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_preferences: newPreferences })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Preference updated',
        description: 'Your email preferences have been saved.',
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert on error
      setPreferences(preferences);
      toast({
        title: 'Error',
        description: 'Failed to update preference. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which emails you'd like to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="weekly-digest">Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">
                Get a weekly summary of your progress and upcoming recommendations
              </p>
            </div>
          </div>
          <Switch
            id="weekly-digest"
            checked={preferences.weekly_digest}
            onCheckedChange={(checked) => updatePreference('weekly_digest', checked)}
          />
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="progress-updates">Progress Updates</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications when you complete milestones
              </p>
            </div>
          </div>
          <Switch
            id="progress-updates"
            checked={preferences.progress_updates}
            onCheckedChange={(checked) => updatePreference('progress_updates', checked)}
          />
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="new-recommendations">New Recommendations</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new recommendations are generated for you
              </p>
            </div>
          </div>
          <Switch
            id="new-recommendations"
            checked={preferences.new_recommendations}
            onCheckedChange={(checked) => updatePreference('new_recommendations', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
