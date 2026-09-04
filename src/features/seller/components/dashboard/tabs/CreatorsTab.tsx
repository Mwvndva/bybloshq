import React, { useState, useEffect } from 'react';
import {
  Users,
  Check,
  X,
  Copy,
  ExternalLink,
  Sparkles,
  MailPlus,
  Loader2,
  TrendingUp,
  Percent,
  MessageSquare,
  Instagram
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { copyLinkedTextToClipboard } from '@/shared/utils/shopLinks';
import {
  useSellerCreatorsQuery,
  useUpdateCreatorListingMutation,
  useRespondToCreatorRequestMutation
} from '@/features/seller/hooks/useSellerCreators';
import { useInviteCreatorMutation } from '@/features/seller/hooks/useSellerProfile';

const inputClass = 'h-11 border-white/10 bg-[#141414] text-white placeholder:text-white/40';

export function CreatorsTab() {
  const { data, isLoading, refetch } = useSellerCreatorsQuery();
  const updateListingMutation = useUpdateCreatorListingMutation();
  const respondMutation = useRespondToCreatorRequestMutation();
  const inviteMutation = useInviteCreatorMutation();

  const [isMarketplaceEnabled, setIsMarketplaceEnabled] = useState(false);
  const [commissionRate, setCommissionRate] = useState('5');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [directInviteEmail, setDirectInviteEmail] = useState('');
  const [invitingDirect, setInvitingDirect] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setIsMarketplaceEnabled(data.isCreatorMarketplaceEnabled);
      setCommissionRate(String(Math.round(data.creatorCommissionRate * 100 * 10) / 10 || 5));
    }
  }, [data]);

  const handleSaveListing = async () => {
    const rateNumber = parseFloat(commissionRate);
    if (isNaN(rateNumber) || rateNumber < 1 || rateNumber > 50) {
      toast.error('Please enter a valid commission rate between 1% and 50%.');
      return;
    }

    try {
      await updateListingMutation.mutateAsync({
        isCreatorMarketplaceEnabled: isMarketplaceEnabled,
        creatorCommissionRate: rateNumber / 100
      });
      setHasUnsavedChanges(false);
      toast.success(
        isMarketplaceEnabled
          ? `Shop listed in Creator Marketplace with ${rateNumber}% commission!`
          : 'Shop creator listing updated.'
      );
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Could not update creator settings.');
    }
  };

  const handleRespondToRequest = async (requestId: number, action: 'accept' | 'deny') => {
    setRespondingId(requestId);
    try {
      await respondMutation.mutateAsync({ requestId, action });
      toast.success(action === 'accept' ? 'Creator request accepted!' : 'Creator request declined.');
      refetch();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Failed to respond to request.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDirectInvite = async () => {
    if (!directInviteEmail.trim()) {
      toast.error('Enter a creator email.');
      return;
    }

    setInvitingDirect(true);
    try {
      await inviteMutation.mutateAsync(directInviteEmail.trim());
      setDirectInviteEmail('');
      toast.success('Creator invite email sent.');
      refetch();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Could not send invite.');
    } finally {
      setInvitingDirect(false);
    }
  };

  const handleCopyLink = async (link: string, label: string) => {
    const mode = await copyLinkedTextToClipboard(label, link);
    toast.success(mode === 'rich' ? 'Creator link copied as rich link.' : 'Creator link copied.');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#0a0a0a] px-5 py-3 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
          <span className="text-sm font-semibold text-white/80">Loading creators...</span>
        </div>
      </div>
    );
  }

  const incomingRequests = data?.incomingRequests || [];
  const activeCreators = data?.activeCreators || [];
  const manualInvites = data?.manualInvites || [];

  return (
    <div className="space-y-6">
      {/* ── Section 1: Marketplace Listing & Commission ── */}
      <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="rounded-2xl p-3 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Creator Marketplace</h2>
              <p className="mt-1 text-xs sm:text-sm text-white/60 leading-relaxed max-w-2xl">
                List your shop in the Byblos Creator Marketplace so verified creators can discover your brand, inspect your products, and request to promote them.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isMarketplaceEnabled
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/5 text-white/50 border border-white/10'
            }`}>
              <span className={`h-2 w-2 rounded-full ${isMarketplaceEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`} />
              {isMarketplaceEnabled ? 'Marketplace Active' : 'Not Listed'}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {/* Marketplace toggle card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="marketplace-toggle" className="text-sm font-bold text-white cursor-pointer">
                  List Shop for Creator Requests
                </label>
                <button
                  id="marketplace-toggle"
                  type="button"
                  role="switch"
                  aria-checked={isMarketplaceEnabled}
                  onClick={() => {
                    setIsMarketplaceEnabled(!isMarketplaceEnabled);
                    setHasUnsavedChanges(true);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isMarketplaceEnabled ? 'bg-yellow-400' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                      isMarketplaceEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">
                When enabled, creators can preview your shop in read-only mode and send you collaboration requests. You can accept or decline each request.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-white/40">
              Zero upfront fees — pay only after a successful sale.
            </div>
          </div>

          {/* Commission setting card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-wider">
              <Percent className="h-4 w-4" />
              <span>Creator Commission Cut</span>
            </div>
            <p className="mt-1 text-xs text-white/50">
              The percentage of each delivered sale paid to the promoting creator.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  step="0.5"
                  value={commissionRate}
                  onChange={(e) => {
                    setCommissionRate(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className={`${inputClass} pr-10 font-black text-lg`}
                  placeholder="5"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 font-black text-sm">
                  %
                </span>
              </div>

              <Button
                type="button"
                onClick={handleSaveListing}
                disabled={updateListingMutation.isPending || !hasUnsavedChanges}
                className="h-11 px-5 bg-yellow-400 text-black font-black hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateListingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Incoming Creator Collaboration Requests ── */}
      <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Incoming Creator Requests</h3>
              <p className="text-xs text-white/50">
                Creators requesting to promote your shop on commission.
              </p>
            </div>
          </div>
          {incomingRequests.length > 0 && (
            <span className="rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 px-2.5 py-0.5 text-xs font-black">
              {incomingRequests.length} Pending
            </span>
          )}
        </div>

        <div className="mt-4">
          {incomingRequests.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <Users className="h-10 w-10 mx-auto text-white/20 mb-2" />
              <p className="text-sm font-bold text-white/70">No pending creator requests</p>
              <p className="mt-1 text-xs text-white/40 max-w-md mx-auto">
                Make sure your shop is listed in the Creator Marketplace above so creators can discover you and send requests.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-base text-white">{req.creatorName}</span>
                      <span className="text-xs text-white/40">· {req.email}</span>
                      {req.whatsappNumber && (
                        <span className="text-xs text-emerald-400 font-semibold">
                          WA: {req.whatsappNumber}
                        </span>
                      )}
                    </div>

                    {req.message && (
                      <p className="text-xs text-white/70 bg-white/[0.04] p-2.5 rounded-xl border border-white/5 flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-400" />
                        <span>&ldquo;{req.message}&rdquo;</span>
                      </p>
                    )}

                    <div className="flex items-center gap-3 pt-1 text-xs text-white/50">
                      {req.instagramLink && (
                        <a
                          href={req.instagramLink.startsWith('http') ? req.instagramLink : `https://${req.instagramLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-pink-400 hover:underline"
                        >
                          <Instagram className="h-3 w-3" />
                          Instagram
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {req.tiktokLink && (
                        <a
                          href={req.tiktokLink.startsWith('http') ? req.tiktokLink : `https://${req.tiktokLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-400 hover:underline"
                        >
                          TikTok
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      <span>Requested {new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      onClick={() => handleRespondToRequest(req.id, 'accept')}
                      disabled={respondingId === req.id}
                      className="h-10 px-4 bg-yellow-400 text-black font-black hover:bg-yellow-300"
                    >
                      {respondingId === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          Accept & Link
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRespondToRequest(req.id, 'deny')}
                      disabled={respondingId === req.id}
                      className="h-10 px-3 border-white/10 bg-transparent text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Active Collaborating Creators ── */}
      <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Active Creators ({activeCreators.length})</h3>
              <p className="text-xs text-white/50">
                Creators actively sharing links to your shop.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {activeCreators.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <p className="text-sm font-bold text-white/70">No active creators yet</p>
              <p className="mt-1 text-xs text-white/40">
                Accepted creator requests will appear here with live click and sales metrics.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {activeCreators.map((creator) => (
                <div
                  key={creator.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-white text-base">{creator.creatorName}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      Code: <span className="font-mono text-yellow-400 font-bold">{creator.code}</span> · Cut:{' '}
                      <span className="font-bold text-white">{(creator.commissionRate * 100).toFixed(1)}%</span>
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-white/80">
                        <strong>{creator.clickCount}</strong> clicks
                      </span>
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-emerald-400">
                        <strong>{creator.salesCount}</strong> sales
                      </span>
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-yellow-400 font-bold">
                        KSh {creator.earningsPaid.toLocaleString()} paid
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyLink(creator.shopUrl, creator.creatorName)}
                    className="h-9 self-start sm:self-center border-white/10 bg-white/[0.04] text-white hover:bg-white/10 text-xs font-bold"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy Tracking Link
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Direct Creator Email Invite ── */}
      <section className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400">
            <MailPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Direct Email Invite</h3>
            <p className="text-xs text-white/50">
              Invite an influencer or partner directly by their email address.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="creator@example.com"
            value={directInviteEmail}
            onChange={(e) => setDirectInviteEmail(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <Button
            type="button"
            onClick={handleDirectInvite}
            disabled={invitingDirect}
            className="h-11 px-5 bg-yellow-400 text-black font-black hover:bg-yellow-300"
          >
            {invitingDirect ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
          </Button>
        </div>

        {manualInvites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Sent Email Invites</p>
            <div className="space-y-2">
              {manualInvites.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-white/80 font-medium">{inv.creatorName || inv.email}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    inv.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
