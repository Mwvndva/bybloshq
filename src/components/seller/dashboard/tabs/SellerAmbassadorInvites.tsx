import { useState } from 'react';
import { Copy, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyLinkedTextToClipboard, getShopUsername } from '@/lib/shopLinks';
import { useInviteCreatorMutation, useGetCreatorInvitesQuery } from '@/hooks/seller/useSellerProfile';
import type { SellerSettingsFormData } from '../types';

interface SellerAmbassadorInvitesProps {
  formData: SellerSettingsFormData;
  setFormData: React.Dispatch<React.SetStateAction<SellerSettingsFormData>>;
  isEditing: boolean;
  toggleEdit: () => void;
}

const inputClass = 'h-10 border-white/10 bg-[#141414] text-white placeholder:text-white/40';

export function SellerAmbassadorInvites({ formData, setFormData, isEditing, toggleEdit }: SellerAmbassadorInvitesProps) {
  const [creatorEmail, setCreatorEmail] = useState('');
  const [isInvitingCreator, setIsInvitingCreator] = useState(false);

  const { data: invites = [] } = useGetCreatorInvitesQuery();
  const inviteCreatorMutation = useInviteCreatorMutation();

  const handleInviteCreator = async () => {
    if (!creatorEmail.trim()) {
      toast.error('Enter an ambassador email.');
      return;
    }

    setIsInvitingCreator(true);
    try {
      await inviteCreatorMutation.mutateAsync(creatorEmail.trim());
      setCreatorEmail('');
      toast.success('Ambassador invite sent.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || 'Could not send invite.');
    } finally {
      setIsInvitingCreator(false);
    }
  };

  const copyCreatorLink = async (link?: string, label?: string) => {
    if (!link) return;
    const copyMode = await copyLinkedTextToClipboard(label || link, link);
    toast.success(copyMode === 'rich' ? 'Ambassador link copied as linked text.' : 'Ambassador link copied.');
  };

  const creatorCommissionLabel = `${Number(formData.creatorCommissionRate || 1).toFixed(2).replace(/\.?0+$/, '')}%`;

  return (
      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2" style={{ backgroundColor: 'rgba(var(--theme-accent-rgb, 245, 158, 11), 0.15)' }}>
              <MailPlus className="h-5 w-5" style={{ color: 'var(--theme-accent, #f5c518)' }} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Invite Ambassadors</h3>
              <p className="text-white/60 text-xs sm:text-sm">
                Give influencers an ambassador link for your shop. They earn your chosen commission after completed sales.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.08] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--theme-accent, #f5c518)' }}>Ambassador commission</p>
              <h4 className="mt-1 text-lg font-black text-white">{creatorCommissionLabel} per completed sale</h4>
              <p className="mt-1 text-xs font-medium text-white/60 sm:text-sm">
                This is the cut ambassadors earn from sales they bring to your shop. Default is 1%; you can raise it before inviting ambassadors.
              </p>
            </div>
            {isEditing ? (
              <div className="w-full sm:w-44">
                <label className="mb-1 block text-xs font-semibold text-white/70" htmlFor="creatorCommissionRate">
                  Commission %
                </label>
                <Input
                  id="creatorCommissionRate"
                  type="number"
                  min="1"
                  max="100"
                  step="0.5"
                  value={formData.creatorCommissionRate}
                  onChange={(event) => setFormData(prev => ({
                    ...prev,
                    creatorCommissionRate: Number(event.target.value)
                  }))}
                  className={inputClass}
                />
              </div>
            ) : (
              <Button
                type="button"
                onClick={toggleEdit}
                variant="outline"
                className="h-10 border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
              >
                Set Commission
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            type="email"
            value={creatorEmail}
            onChange={(event) => setCreatorEmail(event.target.value)}
            placeholder="ambassador@example.com"
            className={inputClass}
          />
          <Button
            type="button"
            onClick={handleInviteCreator}
            disabled={isInvitingCreator}
            className="h-10 font-black"
            style={{ backgroundColor: 'var(--theme-button-bg, #f5c518)', color: 'var(--theme-button-text, #000000)' }}
          >
            {isInvitingCreator ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          {invites.length === 0 ? (
            <div className="bg-white/[0.03] p-4 text-sm font-medium text-white/50">
              No ambassador invites yet.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {(invites as unknown[]).map((inviteItem) => {
                 const invite = inviteItem as { id: string | number; creatorName?: string; email?: string; status?: string; code?: string; commissionRate?: number; shopUrl?: string; shopName?: string };
                 return (
                 <div key={invite.id} className="grid gap-3 bg-white/[0.03] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                   <div className="min-w-0">
                     <p className="truncate text-sm font-black text-white">
                       {invite.creatorName || invite.email}
                     </p>
                     <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                       {invite.status}
                       {invite.code ? ` · ${(Number(invite.commissionRate || 0.01) * 100).toFixed(2).replace(/\.?0+$/, '')}% ambassador cut` : ''}
                     </p>
                     {invite.shopUrl && (
                       <a
                         href={invite.shopUrl}
                         target="_blank"
                         rel="noreferrer"
                         className="mt-1 block truncate text-xs font-bold text-white/70 underline decoration-yellow-400 underline-offset-2"
                         title={invite.shopUrl}
                       >
                         {getShopUsername(invite.shopName || formData.shopName)}
                       </a>
                     )}
                   </div>
                   {invite.shopUrl && (
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => copyCreatorLink(invite.shopUrl, getShopUsername(invite.shopName || formData.shopName))}
                       className="h-9 border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
                     >
                       <Copy className="mr-2 h-4 w-4" />
                       Copy Link
                     </Button>
                   )}
                 </div>
              );})}
            </div>
          )}
        </div>
      </section>
  );
}
