import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Trash2 } from 'lucide-react';

const SUPPORT_EMAIL = 'bybloshqke@zohomail.com';

/**
 * Public account-deletion instructions page (Google Play "Delete account URL").
 * Names the app, gives the exact in-app steps plus an email fallback, and states
 * which data is deleted vs retained and for how long.
 */
export default function DeleteAccountPage() {
  return (
    <div className="min-h-[100svh] bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
          <img src="/byblos-icon.png" alt="Byblos" className="h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-yellow-400">Byblos</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Delete your Byblos account
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/70">
          This page explains how to request deletion of your <strong className="text-white">Byblos</strong> account
          (operated by Byblos / ByblosHQ) and the personal data associated with it. It applies to buyer and seller
          accounts on the Byblos app and website (bybloshq.space).
        </p>

        {/* Steps */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 size={18} className="text-yellow-400" />
            <h2 className="text-lg font-bold text-white">How to request deletion</h2>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="mb-3 text-sm font-semibold text-white">Option 1 — In the app (fastest)</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-white/80">
              <li>Open the Byblos app and sign in.</li>
              <li>
                <span className="font-semibold text-white">Buyers:</span> tap <span className="font-semibold text-white">Profile</span> in the
                bottom navigation, scroll to the bottom, and tap <span className="font-semibold text-yellow-300">Delete account</span>.
              </li>
              <li>
                <span className="font-semibold text-white">Sellers:</span> open the <span className="font-semibold text-white">Settings</span> tab,
                go to the <span className="font-semibold text-white">Account</span> section, and tap <span className="font-semibold text-yellow-300">Delete account</span>.
                (Withdraw any remaining balance first.)
              </li>
              <li>Confirm with <span className="font-semibold text-yellow-300">Yes, delete</span>. Your account is deactivated immediately and your personal data is removed.</li>
            </ol>

            <div className="my-5 h-px w-full bg-white/10" />

            <p className="mb-2 text-sm font-semibold text-white">Option 2 — By email</p>
            <p className="text-sm leading-6 text-white/80">
              If you can’t access the app, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete my account`} className="inline-flex items-center gap-1 font-semibold text-yellow-300 underline-offset-4 hover:underline">
                <Mail size={14} /> {SUPPORT_EMAIL}
              </a>{' '}
              from the email address on your account with the subject{' '}
              <span className="font-semibold text-white">“Delete my account.”</span> We verify ownership and complete the request within
              <span className="font-semibold text-white"> 30 days</span>.
            </p>
          </div>
        </section>

        {/* What happens to your data */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-yellow-400" />
            <h2 className="text-lg font-bold text-white">What data is deleted and what is kept</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-emerald-300">Deleted / anonymised</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/80">
                <li>Your name</li>
                <li>Email address and login credentials</li>
                <li>Phone / WhatsApp and mobile-payment number</li>
                <li>City, area and delivery / pickup location</li>
                <li>Buyer profile, or seller shop details, banner, photo and social links</li>
              </ul>
              <p className="mt-3 text-xs text-white/50">Your sign-in is disabled and these fields are erased or anonymised so you can no longer be identified from them.</p>
            </div>

            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] p-5">
              <h3 className="text-sm font-black uppercase tracking-wide text-yellow-300">Kept for a limited time</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-white/80">
                <li>Transaction and order records</li>
                <li>Payment / M-Pesa references, receipts and refunds</li>
                <li>Seller settlement and withdrawal records</li>
              </ul>
              <p className="mt-3 text-xs text-white/60">
                These are retained in anonymised/transactional form for up to <span className="font-semibold text-white">7 years</span> to
                meet Kenyan tax, accounting and anti-money-laundering obligations (Data Protection Act, 2019 and related law), after which
                they are deleted.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-8 text-sm leading-6 text-white/60">
          Questions about your data? Contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-yellow-300 underline-offset-4 hover:underline">{SUPPORT_EMAIL}</a>.
          See also our <Link to="/privacy" className="font-semibold text-yellow-300 underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
      </main>

      <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/40">
        &copy; 2026 Byblos. All rights reserved.
      </footer>
    </div>
  );
}
