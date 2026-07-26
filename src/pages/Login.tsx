import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { LogIn, GraduationCap, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';

const loginSchema = zod.object({
  email: zod.string().min(1, 'Email is required').email('Invalid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { user, isAdmin, loginWithEmail, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // If user is authenticated and is admin, redirect to original page
    if (user && isAdmin === true) {
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, navigate, from]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await loginWithEmail(data.email, data.password);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden select-none">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-[30rem] h-[30rem] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[25rem] h-[25rem] rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-card/85 backdrop-blur-xl border border-border/80 rounded-2xl p-8 shadow-2xl relative z-10 text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary mb-6">
          <GraduationCap className="h-8 w-8" />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          New Direction Coaching Centre
        </h1>
        <p className="text-xs text-muted-foreground mt-1 mb-8 uppercase tracking-widest font-semibold">
          Admin Portal Console
        </p>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs py-3 px-4 rounded-lg mb-6 flex items-start gap-2 text-left leading-relaxed">
            <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
          
          <Input
            label="Email Address"
            id="email"
            type="email"
            placeholder="admin@newdirection.com"
            {...register('email')}
            error={errors.email?.message}
          />

          <div className="relative">
            <Input
              label="Secret Password"
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-9 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>

          <Button
            type="submit"
            isLoading={loading}
            className="w-full mt-6 h-11 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <LogIn className="h-4.5 w-4.5" />
            Sign In with Email
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/40 text-[10px] text-muted-foreground">
          © {new Date().getFullYear()} NEW DIRECTION COACHING CENTRE. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
