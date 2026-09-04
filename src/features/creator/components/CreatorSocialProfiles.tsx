import React, { useState, useEffect } from 'react';
import { ExternalLink, Check, Loader2, Sparkles, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import instagramLogo from '@/assets/social/instagram.png';
import tiktokLogo from '@/assets/social/tiktok.png';
import { socialUrl } from '@/features/shop/utils/socialLinks';
import { useUpdateCreatorProfileMutation } from '../hooks/mutations/useUpdateCreatorProfileMutation';
import type { CreatorProfile } from '../utils/creatorDashboardUtils';

interface CreatorSocialProfilesProps {
  profile?: CreatorProfile;
}

export function CreatorSocialProfiles({ profile }: CreatorSocialProfilesProps) {
  const [instagram, setInstagram] = useState(profile?.instagramLink || '');
  const [tiktok, setTiktok] = useState(profile?.tiktokLink || '');
  const updateMutation = useUpdateCreatorProfileMutation();

  useEffect(() => {
    if (profile) {
      setInstagram(profile.instagramLink || '');
      setTiktok(profile.tiktokLink || '');
    }
  }, [profile?.instagramLink, profile?.tiktokLink]);

  const hasChanges =
    (instagram.trim() || null) !== (profile?.instagramLink || null) ||
    (tiktok.trim() || null) !== (profile?.tiktokLink || null);

  const instagramHref = socialUrl('instagram', instagram);
  const tiktokHref = socialUrl('tiktok', tiktok);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        instagramLink: instagram.trim() || null,
        tiktokLink: tiktok.trim() || null,
      });
      toast.success('Social profiles saved successfully!');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to update social profiles.');
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-5 sm:p-6 shadow-sm transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Social Media Accounts
            </h2>
            <span className="rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-600 dark:text-yellow-400 text-xs font-black px-2.5 py-0.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Creator Reach
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-white/50">
            Connect your Instagram and TikTok so shop sellers can verify your audience and approve collaboration requests faster.
          </p>
        </div>

        {(profile?.instagramLink || profile?.tiktokLink) && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Profiles Linked
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Instagram input */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src={instagramLogo} alt="Instagram" className="h-5 w-5 object-contain" />
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Instagram Profile
                </label>
              </div>
              {instagramHref && (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-pink-600 hover:text-pink-500 transition-colors"
                >
                  <span>Test Link</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourhandle or instagram.com/username"
              className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 rounded-xl"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/40">
              Enter your handle with @ or your full profile URL
            </p>
          </div>

          {/* TikTok input */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src={tiktokLogo} alt="TikTok" className="h-5 w-5 object-contain" />
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  TikTok Profile
                </label>
              </div>
              {tiktokHref && (
                <a
                  href={tiktokHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-500 transition-colors"
                >
                  <span>Test Link</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <Input
              type="text"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="@yourhandle or tiktok.com/@username"
              className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 rounded-xl"
            />
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/40">
              Enter your TikTok username or profile link
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInstagram(profile?.instagramLink || '');
                setTiktok(profile?.tiktokLink || '');
              }}
              disabled={updateMutation.isPending}
              className="h-9 border-slate-200 dark:border-white/10 text-xs font-bold"
            >
              Reset
            </Button>
          )}
          <Button
            type="submit"
            disabled={!hasChanges || updateMutation.isPending}
            className="h-9 px-5 bg-yellow-400 font-black text-black hover:bg-yellow-300 transition-colors text-xs disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Social Links'
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
