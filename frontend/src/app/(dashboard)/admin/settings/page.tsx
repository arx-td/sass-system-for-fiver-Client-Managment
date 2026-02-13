'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, TestTube, Loader2, Mail, Server, Lock, Globe, Shield, Bell, Volume2, Play, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { apiGet, apiPost, getErrorMessage } from '@/lib/api';
import { SmtpSettings, GeneralSettings, N8nSettings } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EmailProvider = 'gmail' | 'sendgrid' | 'mailgun' | 'resend' | 'custom';

const emailProviderPresets: Record<EmailProvider, { host: string; port: number; secure: boolean; label: string; description: string }> = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    label: 'Gmail (App Password)',
    description: 'Use Gmail with an App Password. Go to Google Account → Security → 2-Step Verification → App passwords',
  },
  sendgrid: {
    host: 'api.sendgrid.com',
    port: 443,
    secure: true,
    label: 'SendGrid',
    description: 'Use SendGrid API. Get your API key from SendGrid Dashboard → Settings → API Keys',
  },
  mailgun: {
    host: 'api.mailgun.net',
    port: 443,
    secure: true,
    label: 'Mailgun',
    description: 'Use Mailgun API. Get your API key from Mailgun Dashboard → API Keys',
  },
  resend: {
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    label: 'Resend',
    description: 'Use Resend API. Note: Free tier only sends to your own email unless you verify a domain',
  },
  custom: {
    host: '',
    port: 587,
    secure: false,
    label: 'Custom SMTP',
    description: 'Configure your own SMTP server',
  },
};

interface NotificationSettings {
  soundEnabled: boolean;
  soundUrl: string;
  soundVolume: number;
  emailNotificationsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  roleSounds: {
    ADMIN: string | null;
    MANAGER: string | null;
    TEAM_LEAD: string | null;
    DEVELOPER: string | null;
    DESIGNER: string | null;
  };
  notificationTypes: {
    task_assigned: boolean;
    task_started: boolean;
    task_submitted: boolean;
    task_approved: boolean;
    task_rejected: boolean;
    asset_requested: boolean;
    asset_submitted: boolean;
    asset_approved: boolean;
    asset_rejected: boolean;
    project_assigned: boolean;
    project_status_changed: boolean;
    revision_created: boolean;
    revision_completed: boolean;
    requirements_approved: boolean;
    chat_message: boolean;
    user_accepted_invite: boolean;
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // SMTP Settings
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('gmail');
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings>({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: '',
      pass: '',
    },
    from: '',
  });

  // General Settings
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    companyName: 'DEEPAXIS',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    notificationsEnabled: true,
  });

  // n8n Settings
  const [n8nSettings, setN8nSettings] = useState<N8nSettings>({
    enabled: false,
    webhookUrl: '',
    apiKey: '',
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    soundEnabled: true,
    soundUrl: '/sounds/notification.mp3',
    soundVolume: 0.5,
    emailNotificationsEnabled: false,
    browserNotificationsEnabled: true,
    roleSounds: {
      ADMIN: null,
      MANAGER: null,
      TEAM_LEAD: null,
      DEVELOPER: null,
      DESIGNER: null,
    },
    notificationTypes: {
      task_assigned: true,
      task_started: true,
      task_submitted: true,
      task_approved: true,
      task_rejected: true,
      asset_requested: true,
      asset_submitted: true,
      asset_approved: true,
      asset_rejected: true,
      project_assigned: true,
      project_status_changed: true,
      revision_created: true,
      revision_completed: true,
      requirements_approved: true,
      chat_message: true,
      user_accepted_invite: true,
    },
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [testEmail, setTestEmail] = useState('');

  // Password Change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [smtp, general, n8n, notifications] = await Promise.all([
        apiGet<SmtpSettings>('/settings/smtp').catch(() => null),
        apiGet<GeneralSettings>('/settings/general').catch(() => null),
        apiGet<N8nSettings>('/settings/n8n').catch(() => null),
        apiGet<NotificationSettings>('/settings/notifications').catch(() => null),
      ]);

      if (smtp) setSmtpSettings(smtp);
      if (general) setGeneralSettings(general);
      if (n8n) setN8nSettings(n8n);
      if (notifications) setNotificationSettings(notifications);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (provider: EmailProvider) => {
    setEmailProvider(provider);
    const preset = emailProviderPresets[provider];
    setSmtpSettings({
      ...smtpSettings,
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
    });
  };

  // Detect provider from host when settings are loaded
  useEffect(() => {
    if (smtpSettings.host) {
      if (smtpSettings.host.includes('gmail')) {
        setEmailProvider('gmail');
      } else if (smtpSettings.host.includes('sendgrid')) {
        setEmailProvider('sendgrid');
      } else if (smtpSettings.host.includes('mailgun')) {
        setEmailProvider('mailgun');
      } else if (smtpSettings.host.includes('resend')) {
        setEmailProvider('resend');
      } else {
        setEmailProvider('custom');
      }
    }
  }, [smtpSettings.host]);

  const handleSaveSmtp = async () => {
    try {
      setSaving(true);
      // Include provider in settings for backend to know which API to use
      await apiPost('/settings/smtp', { ...smtpSettings, provider: emailProvider });
      toast.success('Email settings saved successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    try {
      setTesting(true);
      await apiPost('/settings/smtp/test', { testEmail });
      toast.success('Test email sent successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const handleSaveGeneral = async () => {
    try {
      setSaving(true);
      await apiPost('/settings/general', generalSettings);
      toast.success('General settings saved successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveN8n = async () => {
    try {
      setSaving(true);
      await apiPost('/settings/n8n', n8nSettings);
      toast.success('n8n settings saved successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSaving(true);
      await apiPost('/settings/notifications', notificationSettings);
      toast.success('Notification settings saved successfully');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  // Web Audio API context for playing chime sounds
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Play a pleasant two-tone chime using Web Audio API
  const playChimeSound = (volume: number) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Resume context if suspended (required after user interaction)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const duration = 0.3;

      // Create gain node for volume control
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(volume * 0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // First tone (E5 - 659.25 Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.connect(gainNode);
      osc1.start(now);
      osc1.stop(now + duration);

      // Second tone (A5 - 880 Hz) slightly delayed
      const gainNode2 = ctx.createGain();
      gainNode2.connect(ctx.destination);
      gainNode2.gain.setValueAtTime(0, now);
      gainNode2.gain.setValueAtTime(volume * 0.3, now + 0.1);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, now + duration + 0.1);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      osc2.connect(gainNode2);
      osc2.start(now + 0.1);
      osc2.stop(now + duration + 0.1);

      toast.success('Notification sound played!');
    } catch (error) {
      console.error('Failed to play chime:', error);
      toast.error('Failed to play notification sound');
    }
  };

  const handleTestSound = async () => {
    const volume = notificationSettings.soundVolume;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // If a custom sound URL is provided and it's not a default preset path, try to play it
    const customUrl = notificationSettings.soundUrl;
    const isDefaultPreset = !customUrl || customUrl.startsWith('/sounds/');

    if (!isDefaultPreset && customUrl) {
      // Try to play custom URL
      try {
        const audio = new Audio(customUrl);
        audio.volume = volume;
        audioRef.current = audio;
        await audio.play();
        toast.success('Custom notification sound played!');
        return;
      } catch (error) {
        console.error('Failed to play custom sound, falling back to chime:', error);
        // Fall through to Web Audio chime
      }
    }

    // Use built-in Web Audio chime (always works, no external file needed)
    playChimeSound(volume);
  };

  const notificationTypeLabels: Record<string, string> = {
    task_assigned: 'Task Assigned',
    task_started: 'Task Started',
    task_submitted: 'Task Submitted',
    task_approved: 'Task Approved',
    task_rejected: 'Task Rejected',
    asset_requested: 'Asset Requested',
    asset_submitted: 'Asset Submitted',
    asset_approved: 'Asset Approved',
    asset_rejected: 'Asset Rejected',
    project_assigned: 'Project Assigned',
    project_status_changed: 'Project Status Changed',
    revision_created: 'Revision Created',
    revision_completed: 'Revision Completed',
    requirements_approved: 'Requirements Approved',
    chat_message: 'Chat Message',
    user_accepted_invite: 'User Accepted Invite',
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    try {
      setChangingPassword(true);
      await apiPost('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and integrations
        </p>
      </div>

      <Tabs defaultValue="smtp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="smtp">
            <Mail className="mr-2 h-4 w-4" />
            SMTP / Email
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="general">
            <Globe className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="n8n">
            <Server className="mr-2 h-4 w-4" />
            n8n Integration
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* SMTP Settings Tab */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                Configure email service for sending notifications and invitations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selector */}
              <div className="grid gap-2">
                <Label>Email Provider</Label>
                <Select value={emailProvider} onValueChange={(v) => handleProviderChange(v as EmailProvider)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select email provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">
                      <span className="font-medium">Gmail (App Password)</span>
                      <span className="text-muted-foreground ml-2">- Recommended, Easy Setup</span>
                    </SelectItem>
                    <SelectItem value="sendgrid">
                      <span className="font-medium">SendGrid</span>
                      <span className="text-muted-foreground ml-2">- 100 free emails/day</span>
                    </SelectItem>
                    <SelectItem value="mailgun">
                      <span className="font-medium">Mailgun</span>
                      <span className="text-muted-foreground ml-2">- 5,000 free emails/month</span>
                    </SelectItem>
                    <SelectItem value="resend">
                      <span className="font-medium">Resend</span>
                      <span className="text-muted-foreground ml-2">- Requires domain verification</span>
                    </SelectItem>
                    <SelectItem value="custom">
                      <span className="font-medium">Custom SMTP</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {emailProviderPresets[emailProvider].description}
                </p>
              </div>

              {/* Provider-specific setup instructions */}
              {emailProvider === 'gmail' && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Gmail Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Go to your Google Account → Security</li>
                    <li>Enable 2-Step Verification if not already enabled</li>
                    <li>Go to Security → 2-Step Verification → App passwords</li>
                    <li>Create a new App password for "Mail"</li>
                    <li>Use your Gmail as Username and the 16-character App password as Password</li>
                  </ol>
                </div>
              )}

              {emailProvider === 'sendgrid' && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">SendGrid Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Sign up at <a href="https://sendgrid.com" target="_blank" className="underline">sendgrid.com</a></li>
                    <li>Go to Settings → API Keys → Create API Key</li>
                    <li>Select "Full Access" or "Restricted Access" with Mail Send permission</li>
                    <li>Use "apikey" as Username and your API key as Password</li>
                    <li>Verify a sender email in Settings → Sender Authentication</li>
                  </ol>
                </div>
              )}

              {emailProvider === 'mailgun' && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Mailgun Setup Instructions</h4>
                  <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                    <li>Sign up at <a href="https://mailgun.com" target="_blank" className="underline">mailgun.com</a></li>
                    <li>Go to Send → Domains and verify your domain (or use sandbox)</li>
                    <li>Go to Settings → API Keys → Copy your Private API key</li>
                    <li>Use your domain as Username (e.g., mg.yourdomain.com) and API key as Password</li>
                  </ol>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="smtpHost">
                    {emailProvider === 'custom' ? 'SMTP Host' : 'API Host'}
                  </Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.example.com"
                    value={smtpSettings.host}
                    onChange={(e) =>
                      setSmtpSettings({ ...smtpSettings, host: e.target.value })
                    }
                    disabled={emailProvider !== 'custom'}
                    className={emailProvider !== 'custom' ? 'bg-muted' : ''}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={smtpSettings.port}
                    onChange={(e) =>
                      setSmtpSettings({
                        ...smtpSettings,
                        port: parseInt(e.target.value) || 587,
                      })
                    }
                    disabled={emailProvider !== 'custom'}
                    className={emailProvider !== 'custom' ? 'bg-muted' : ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="smtpUser">
                    {emailProvider === 'gmail' ? 'Gmail Address' :
                     emailProvider === 'sendgrid' ? 'Username (use "apikey")' :
                     emailProvider === 'mailgun' ? 'Domain' :
                     emailProvider === 'resend' ? 'Username (use "resend")' :
                     'Username'}
                  </Label>
                  <Input
                    id="smtpUser"
                    placeholder={
                      emailProvider === 'gmail' ? 'your-email@gmail.com' :
                      emailProvider === 'sendgrid' ? 'apikey' :
                      emailProvider === 'mailgun' ? 'mg.yourdomain.com' :
                      emailProvider === 'resend' ? 'resend' :
                      'your-email@example.com'
                    }
                    value={smtpSettings.auth.user}
                    onChange={(e) =>
                      setSmtpSettings({
                        ...smtpSettings,
                        auth: { ...smtpSettings.auth, user: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="smtpPass">
                    {emailProvider === 'gmail' ? 'App Password (16 chars)' :
                     emailProvider === 'sendgrid' ? 'API Key' :
                     emailProvider === 'mailgun' ? 'API Key' :
                     emailProvider === 'resend' ? 'API Key' :
                     'Password'}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="smtpPass"
                      type="password"
                      placeholder="••••••••"
                      value={smtpSettings.auth.pass}
                      onChange={(e) =>
                        setSmtpSettings({
                          ...smtpSettings,
                          auth: { ...smtpSettings.auth, pass: e.target.value },
                        })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="smtpFrom">From Address</Label>
                <Input
                  id="smtpFrom"
                  placeholder="noreply@deepaxis.com"
                  value={smtpSettings.from}
                  onChange={(e) =>
                    setSmtpSettings({ ...smtpSettings, from: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="smtpSecure"
                  checked={smtpSettings.secure}
                  onCheckedChange={(checked) =>
                    setSmtpSettings({
                      ...smtpSettings,
                      secure: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="smtpSecure">
                  Use SSL/TLS (Enable for port 465)
                </Label>
              </div>

              <div className="flex justify-between items-end pt-4 border-t">
                <div className="flex gap-2 items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="testEmail">Test Email Address</Label>
                    <Input
                      id="testEmail"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="w-64"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleTestSmtp}
                    disabled={testing}
                  >
                    {testing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="mr-2 h-4 w-4" />
                    )}
                    Send Test
                  </Button>
                </div>
                <Button onClick={handleSaveSmtp} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings Tab */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            {/* Sound Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Sound Settings
                </CardTitle>
                <CardDescription>
                  Configure notification sounds. Users cannot disable sounds - this is a system-wide setting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="soundEnabled">Enable Notification Sounds</Label>
                    <p className="text-sm text-muted-foreground">
                      Play a sound when notifications arrive
                    </p>
                  </div>
                  <Switch
                    id="soundEnabled"
                    checked={notificationSettings.soundEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        soundEnabled: checked,
                      })
                    }
                  />
                </div>

                {notificationSettings.soundEnabled && (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Sound Volume: {Math.round(notificationSettings.soundVolume * 100)}%</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[notificationSettings.soundVolume * 100]}
                            onValueChange={([value]) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                soundVolume: value / 100,
                              })
                            }
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestSound}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Test
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="soundUrl">Custom Sound URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="soundUrl"
                            placeholder="/sounds/notification.mp3"
                            value={notificationSettings.soundUrl}
                            onChange={(e) =>
                              setNotificationSettings({
                                ...notificationSettings,
                                soundUrl: e.target.value,
                              })
                            }
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter a URL to a custom notification sound (MP3, WAV, or OGG format)
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/50 p-4">
                      <h4 className="font-medium mb-3">Sound Type</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={!notificationSettings.soundUrl || notificationSettings.soundUrl.startsWith('/sounds/') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setNotificationSettings({
                              ...notificationSettings,
                              soundUrl: '',
                            })
                          }
                        >
                          Built-in Chime (Recommended)
                        </Button>
                        <Button
                          variant={notificationSettings.soundUrl && !notificationSettings.soundUrl.startsWith('/sounds/') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            // Keep custom URL if set, otherwise clear for custom input
                            if (!notificationSettings.soundUrl || notificationSettings.soundUrl.startsWith('/sounds/')) {
                              setNotificationSettings({
                                ...notificationSettings,
                                soundUrl: '',
                              });
                            }
                          }}
                        >
                          Custom URL
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        The built-in chime uses Web Audio API and works without external files.
                        For custom sounds, enter a valid audio URL above.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Browser Notifications Card */}
            <Card>
              <CardHeader>
                <CardTitle>Browser & Email Notifications</CardTitle>
                <CardDescription>
                  Configure how notifications are delivered to users.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="browserEnabled">Browser Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show native browser notifications when the app is in background
                    </p>
                  </div>
                  <Switch
                    id="browserEnabled"
                    checked={notificationSettings.browserNotificationsEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        browserNotificationsEnabled: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailEnabled">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for important events (requires SMTP configuration)
                    </p>
                  </div>
                  <Switch
                    id="emailEnabled"
                    checked={notificationSettings.emailNotificationsEnabled}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotificationsEnabled: checked,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Types Card */}
            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
                <CardDescription>
                  Enable or disable specific notification types. Disabled notifications will not be sent to any user.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(notificationSettings.notificationTypes).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                      <Label htmlFor={key} className="cursor-pointer">
                        {notificationTypeLabels[key] || key}
                      </Label>
                      <Switch
                        id={key}
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            notificationTypes: {
                              ...notificationSettings.notificationTypes,
                              [key]: checked,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveNotifications} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Notification Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* General Settings Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure general system preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="DEEPAXIS"
                    value={generalSettings.companyName}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        companyName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    placeholder="UTC"
                    value={generalSettings.timezone}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        timezone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input
                    id="dateFormat"
                    placeholder="MM/DD/YYYY"
                    value={generalSettings.dateFormat}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        dateFormat: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notificationsEnabled"
                  checked={generalSettings.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    setGeneralSettings({
                      ...generalSettings,
                      notificationsEnabled: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="notificationsEnabled">
                  Enable Email Notifications
                </Label>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveGeneral} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* n8n Integration Tab */}
        <TabsContent value="n8n">
          <Card>
            <CardHeader>
              <CardTitle>n8n Integration</CardTitle>
              <CardDescription>
                Configure n8n webhook integration for automation workflows.
                n8n acts as a silent helper and never makes decisions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="n8nEnabled"
                  checked={n8nSettings.enabled}
                  onCheckedChange={(checked) =>
                    setN8nSettings({
                      ...n8nSettings,
                      enabled: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="n8nEnabled">Enable n8n Integration</Label>
              </div>

              {n8nSettings.enabled && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="n8nWebhookUrl">Webhook URL</Label>
                    <Input
                      id="n8nWebhookUrl"
                      placeholder="https://your-n8n.com/webhook/..."
                      value={n8nSettings.webhookUrl}
                      onChange={(e) =>
                        setN8nSettings({
                          ...n8nSettings,
                          webhookUrl: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="n8nApiKey">API Key</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="n8nApiKey"
                        type="password"
                        placeholder="••••••••"
                        value={n8nSettings.apiKey}
                        onChange={(e) =>
                          setN8nSettings({
                            ...n8nSettings,
                            apiKey: e.target.value,
                          })
                        }
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h4 className="font-medium mb-2">Available Webhook Events</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• <code>/webhooks/n8n/idle-projects</code> - Triggered for idle projects</li>
                      <li>• <code>/webhooks/n8n/weekly-summary</code> - Weekly summary webhook</li>
                      <li>• <code>/webhooks/n8n/project-status</code> - Project status changes</li>
                    </ul>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveN8n} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security / Password Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password. Make sure to use a strong password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 max-w-md">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 max-w-md">
                <h4 className="font-medium mb-2">Password Requirements</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• At least 8 characters long</li>
                  <li>• Include uppercase and lowercase letters</li>
                  <li>• Include at least one number</li>
                  <li>• Include at least one special character</li>
                </ul>
              </div>

              <div className="flex justify-start pt-4 border-t">
                <Button onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Shield className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
