'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Mail, Lock, FolderKanban, Moon, Sun } from 'lucide-react';
import { LoginIllustration } from '@/components/LoginIllustration';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setLoading(true);
      setError('');
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err: any) {
      const errorMessage =
        err.message ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Login failed. Please try again.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary-50 via-sky-50 to-primary-100 dark:from-gray-950 dark:via-gray-900 dark:to-primary-950">
      <div className="absolute inset-0 login-grain opacity-20 dark:opacity-10 pointer-events-none" aria-hidden />

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 p-2.5 rounded-lg bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        <section className="relative flex flex-col justify-between px-8 sm:px-12 lg:px-16 py-10 lg:py-14 min-h-[40vh] lg:min-h-screen">
          <div className="login-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">Pritul&apos;s workspace</span>
            </div>
            <h1 className="mt-8 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white max-w-md">
              Plan, track, and ship together
            </h1>
            <p className="mt-4 max-w-sm text-base text-gray-600 dark:text-gray-400">
              Boards, sprints, time tracking, and docs — your team workspace in one place.
            </p>
          </div>

          <div className="mt-8 lg:mt-0 flex-1 flex items-center justify-center lg:justify-start pointer-events-none select-none">
            <div className="w-full max-w-[520px] aspect-[720/640]">
              <LoginIllustration dark={theme === 'dark'} />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 sm:px-10 lg:px-16 py-10 lg:py-14">
          <div className="w-full max-w-md login-fade-up-delay space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to your account</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      {...register('email')}
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder="you@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary-600 hover:text-primary-500"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      {...register('password')}
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="text-primary-600 hover:text-primary-500 font-medium">
                    Sign up
                  </Link>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <Link href="/admin/login" className="text-primary-600 hover:text-primary-500">
                    Admin Login
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
