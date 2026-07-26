import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadImage } from '../services/cloudinary';
import { useToast } from '../components/ui/Toast';
import { useTheme } from '../context/ThemeContext';
import { 
  Save, 
  Camera, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Paintbrush
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const settingsSchema = zod.object({
  coachingName: zod.string().min(3, 'Coaching name must be at least 3 characters'),
  contactNumber: zod.string().min(8, 'Provide a valid contact number'),
  address: zod.string().min(5, 'Address details are too short'),
  website: zod.string().url('Provide a valid URL (include http/https)'),
  supportEmail: zod.string().email('Provide a valid support email address'),
  theme: zod.enum(['light', 'dark']),
});

type SettingsFormValues = zod.infer<typeof settingsSchema>;

export const Settings: React.FC = () => {
  const toast = useToast();
  const { theme: contextTheme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Logo uploading preview states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  // Listen to Settings in real time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'coaching'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setValue('coachingName', data.coachingName || '');
        setValue('contactNumber', data.contactNumber || '');
        setValue('address', data.address || '');
        setValue('website', data.website || '');
        setValue('supportEmail', data.supportEmail || '');
        setValue('theme', data.theme || 'dark');
        setLogoPreview(data.logoUrl || '');
      } else {
        // Fallback standard parameters
        setValue('coachingName', 'NEW DIRECTION COACHING CENTRE');
        setValue('contactNumber', '+91 9876543210');
        setValue('address', 'Main Street, Education Hub City');
        setValue('website', 'https://newdirection.edu');
        setValue('supportEmail', 'support@newdirection.edu');
        setValue('theme', 'dark');
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Failed to sync settings config.');
      setLoading(false);
    });

    return () => unsub();
  }, [setValue]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: SettingsFormValues) => {
    setSaving(true);
    let finalLogoUrl = logoPreview;

    try {
      // 1. Upload logo image to Cloudinary if selected
      if (logoFile) {
        finalLogoUrl = await uploadImage(logoFile, 'subject-images'); // Optimize under subject image directory or separate folders
      }

      const payload = {
        ...data,
        logoUrl: finalLogoUrl,
      };

      // 2. Write details to settings/coaching Firestore document
      await setDoc(doc(db, 'settings', 'coaching'), payload);
      
      // 3. Keep local UI theme matched if toggle changed
      if (data.theme !== contextTheme) {
        toggleTheme();
      }

      toast.success('Coaching configurations saved successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save coaching settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-1.5 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight">Coaching Settings</h1>
        <p className="text-sm text-muted-foreground">Manage institute metadata, logo icons, contact endpoints, and theme options.</p>
      </div>

      {/* Main Settings Card Panel */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm text-left">
        <div className="p-6 md:p-8 space-y-8 max-w-3xl">
          
          {/* Section 1: Branding & Logo */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5 select-none">
              <Building2 className="h-4.5 w-4.5 text-primary" />
              1. Academy Branding
            </h3>

            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Logo Editor */}
              <div className="flex flex-col items-center gap-2 select-none">
                <div className="relative h-24 w-24 rounded-2xl border border-border/80 group overflow-hidden bg-secondary flex items-center justify-center">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                  )}
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity">
                    <Camera className="h-4.5 w-4.5" />
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  </label>
                </div>
                <span className="text-[10px] text-muted-foreground">Click to upload logo</span>
              </div>

              {/* Coaching name */}
              <div className="flex-1 w-full">
                <Input
                  label="Coaching Center Registered Name"
                  id="coachingName"
                  placeholder="NEW DIRECTION COACHING CENTRE"
                  {...register('coachingName')}
                  error={errors.coachingName?.message}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact Info */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5 select-none">
              <Phone className="h-4.5 w-4.5 text-primary" />
              2. Contact Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                label="Contact Number"
                id="contactNumber"
                placeholder="+91 98765 43210"
                icon={<Phone className="h-4 w-4" />}
                {...register('contactNumber')}
                error={errors.contactNumber?.message}
              />
              <Input
                label="Support/Help Email"
                id="supportEmail"
                placeholder="support@ndcc.com"
                icon={<Mail className="h-4 w-4" />}
                {...register('supportEmail')}
                error={errors.supportEmail?.message}
              />
            </div>
            
            <div className="w-full">
              <Input
                label="Coaching Website URL"
                id="website"
                placeholder="https://www.newdirectioncoaching.com"
                icon={<Globe className="h-4 w-4" />}
                {...register('website')}
                error={errors.website?.message}
              />
            </div>
          </div>

          {/* Section 3: Location */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5 select-none">
              <MapPin className="h-4.5 w-4.5 text-primary" />
              3. Location Address
            </h3>
            
            <div className="w-full flex flex-col gap-1.5">
              <label htmlFor="address" className="text-xs font-semibold tracking-wide text-foreground/80 select-none">
                Office Premises Address
              </label>
              <textarea
                id="address"
                rows={3}
                placeholder="Enter physical street address, building floor, and postal code..."
                className={`w-full bg-card text-sm p-3 rounded-lg border border-border outline-none transition-all placeholder:text-muted-foreground/50 resize-none focus:border-primary focus:ring-1 focus:ring-primary ${
                  errors.address ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''
                }`}
                {...register('address')}
              />
              {errors.address && (
                <span className="text-[11px] font-medium text-destructive leading-none select-none">
                  {errors.address.message}
                </span>
              )}
            </div>
          </div>

          {/* Section 4: Display theme */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5 select-none">
              <Paintbrush className="h-4.5 w-4.5 text-primary" />
              4. Display Settings
            </h3>
            
            <div className="max-w-xs">
              <Select
                label="Default Portal Theme Color"
                id="theme"
                options={[
                  { value: 'light', label: 'Light Mode Colors' },
                  { value: 'dark', label: 'Dark Mode Colors' },
                ]}
                {...register('theme')}
                error={errors.theme?.message}
              />
            </div>
          </div>

        </div>

        {/* Form save action */}
        <div className="py-4.5 px-6 md:px-8 border-t border-border/40 bg-secondary/15 flex justify-end">
          <Button type="submit" isLoading={saving} className="cursor-pointer">
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </div>
      </form>

    </div>
  );
};

export default Settings;
