import { Moon, Sun, Shield, Globe, Palette, Monitor } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { EmailPreferences } from '@/components/settings/EmailPreferences';
import { ExportButtons } from '@/components/common/ExportButtons';
import { useUserPreferences, useUpdatePreferences } from '@/hooks/useUserPreferences';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  const handleDarkModeChange = (checked: boolean) => {
    updatePreferences.mutate({ darkMode: checked });
    // Apply theme change
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleThemeChange = (theme: string) => {
    updatePreferences.mutate({ theme });
  };

  const handleLanguageChange = (language: string) => {
    updatePreferences.mutate({ language });
  };

  const handleDataCollectionChange = (checked: boolean) => {
    updatePreferences.mutate({ dataCollection: checked });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    );
  }

  const darkMode = preferences?.darkMode ?? false;
  const theme = preferences?.theme ?? 'blue';
  const language = preferences?.language ?? 'en';
  const dataCollection = preferences?.dataCollection ?? true;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your application preferences
          </p>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how EduThree looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <div>
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark themes
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode}
                onCheckedChange={handleDarkModeChange}
                disabled={updatePreferences.isPending}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4" />
                <div>
                  <Label htmlFor="theme-select">Color Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred accent color
                  </p>
                </div>
              </div>
              <Select 
                value={theme} 
                onValueChange={handleThemeChange}
                disabled={updatePreferences.isPending}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <EmailPreferences />

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy
            </CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Data Collection</Label>
                <p className="text-sm text-muted-foreground">
                  Allow anonymous usage data to improve the platform
                </p>
              </div>
              <Switch 
                checked={dataCollection} 
                onCheckedChange={handleDataCollectionChange}
                disabled={updatePreferences.isPending}
              />
            </div>
            
            <Separator />
            
            <div>
              <Label>Export Your Data</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Download all your courses, analyses, and recommendations
              </p>
              <ExportButtons variant="inline" size="sm" />
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Language</Label>
                <p className="text-sm text-muted-foreground">
                  Select your preferred language
                </p>
              </div>
              <Select 
                value={language} 
                onValueChange={handleLanguageChange}
                disabled={updatePreferences.isPending}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
