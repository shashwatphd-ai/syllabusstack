import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Palette, ArrowLeft, Upload, Eye, Save, Loader2,
  Image, Type, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

interface BrandingConfig {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  institution_name: string;
  custom_domain: string | null;
  hide_powered_by: boolean;
  custom_email_footer: string;
}

export default function BrandingSettings() {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<BrandingConfig>({
    logo_url: null,
    primary_color: '#667eea',
    secondary_color: '#764ba2',
    institution_name: 'Your University',
    custom_domain: null,
    hide_powered_by: false,
    custom_email_footer: '',
  });

  if (tier !== 'university') {
    navigate('/dashboard');
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to database via edge function
      await new Promise(resolve => setTimeout(resolve, 1000)); // Placeholder
      toast({
        title: 'Branding saved',
        description: 'Your branding settings have been updated.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = (key: keyof BrandingConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Branding Settings
          </h1>
          <p className="text-muted-foreground">
            Customize the platform with your institution's branding
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Institution Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Institution Details
              </CardTitle>
              <CardDescription>
                Basic information about your institution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Institution Name</Label>
                <Input
                  value={config.institution_name}
                  onChange={(e) => updateConfig('institution_name', e.target.value)}
                  placeholder="Your University"
                />
              </div>
              <div className="space-y-2">
                <Label>Custom Domain (optional)</Label>
                <Input
                  value={config.custom_domain || ''}
                  onChange={(e) => updateConfig('custom_domain', e.target.value)}
                  placeholder="careers.youruniversity.edu"
                />
                <p className="text-xs text-muted-foreground">
                  Contact support to configure custom domain DNS
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Logo
              </CardTitle>
              <CardDescription>
                Upload your institution's logo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                {config.logo_url ? (
                  <div className="space-y-4">
                    <img
                      src={config.logo_url}
                      alt="Institution logo"
                      className="max-h-20 mx-auto"
                    />
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Change Logo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG or SVG. Max 2MB. Recommended: 400x100px
                    </p>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Brand Colors
              </CardTitle>
              <CardDescription>
                Customize the color scheme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.secondary_color}
                      onChange={(e) => updateConfig('secondary_color', e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={config.secondary_color}
                      onChange={(e) => updateConfig('secondary_color', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Hide "Powered by SyllabusStack"</Label>
                  <p className="text-sm text-muted-foreground">
                    Remove branding from the footer
                  </p>
                </div>
                <Switch
                  checked={config.hide_powered_by}
                  onCheckedChange={(checked) => updateConfig('hide_powered_by', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Custom Email Footer</Label>
                <Input
                  value={config.custom_email_footer}
                  onChange={(e) => updateConfig('custom_email_footer', e.target.value)}
                  placeholder="© 2024 Your University. All rights reserved."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview
              </CardTitle>
              <CardDescription>
                See how your branding will appear
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mock Header Preview */}
              <div
                className="rounded-lg overflow-hidden border"
                style={{
                  background: `linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%)`
                }}
              >
                <div className="p-4 flex items-center justify-between">
                  {config.logo_url ? (
                    <img
                      src={config.logo_url}
                      alt="Logo"
                      className="h-8 brightness-0 invert"
                    />
                  ) : (
                    <span className="text-white font-bold">
                      {config.institution_name}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>

              {/* Mock Content Preview */}
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <Button
                    size="sm"
                    style={{ backgroundColor: config.primary_color }}
                  >
                    Sample Button
                  </Button>
                </div>
              </div>

              {/* Footer Preview */}
              <div className="mt-4 p-3 border rounded-lg text-center text-xs text-muted-foreground">
                {config.custom_email_footer || `© 2024 ${config.institution_name}`}
                {!config.hide_powered_by && (
                  <span className="block mt-1">Powered by SyllabusStack</span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-success">
                <CheckCircle className="h-4 w-4" />
                Changes will apply across the platform
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
