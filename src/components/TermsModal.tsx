import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

const sections = [
  { id: 'privacy', label: '1. Privacy Policy' },
  { id: 'agreement', label: '2. Client Agreement' },
  { id: 'refund', label: '3. Refund Policy' },
  { id: 'risk', label: '4. Risk Disclosure' },
  { id: 'ip', label: '5. Intellectual Property' },
  { id: 'prohibited', label: '6. Prohibited Conduct' },
  { id: 'liability', label: '7. Limitation of Liability' },
  { id: 'disputes', label: '8. Dispute Resolution' },
  { id: 'amendments', label: '9. Amendments' },
  { id: 'governing', label: '10. Governing Law' },
];

const TermsModal = ({ isOpen, onClose, onAccept }: TermsModalProps) => {
  const [activeSection, setActiveSection] = useState('privacy');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        className="max-w-5xl sm:h-[92dvh] h-[100dvh] w-full sm:w-[95vw] flex flex-col p-0 overflow-hidden bg-[#faf9f6] border border-[#d4c9a8]"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-[#1a1a1a] text-white px-5 sm:px-8 py-5 sm:py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] tracking-[0.3em] text-[#c9a84c] uppercase mb-1">Legal Documentation</p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ fontFamily: "'Georgia', serif" }}>
                BYBLOS TERMS & CONDITIONS
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2">
                Effective Date: Jan 2026 &nbsp;|&nbsp; Ver 2.0 &nbsp;|&nbsp; ByblosHQ
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="inline-block border border-[#c9a84c] px-3 py-1 text-[10px] tracking-widest text-[#c9a84c] uppercase">
                Legally Binding
              </div>
            </div>
          </div>
          <div className="mt-3.5 p-2.5 bg-[#c9a84c]/10 border-l-2 border-[#c9a84c] text-[10px] sm:text-xs text-[#e8d9a0] leading-normal">
            <strong>IMPORTANT:</strong> By using Byblos, you agree to be bound by these Terms. If you do not agree, cease all use immediately.
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Nav - Horizontal on mobile, Sidebar on desktop */}
          <nav className="flex-shrink-0 w-full sm:w-52 bg-[#1a1a1a] border-b sm:border-b-0 border-white/5 flex sm:flex-col overflow-x-auto sm:overflow-y-auto py-2 sm:py-6 px-4 no-scrollbar">
            <p className="hidden sm:block text-[10px] tracking-widest text-gray-500 uppercase mb-4 px-2">Sections</p>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`flex-shrink-0 sm:w-full text-left text-[11px] sm:text-xs px-3 py-1.5 sm:py-2.5 rounded mr-2 sm:mr-0 sm:mb-1 transition-all duration-150 leading-tight whitespace-nowrap sm:whitespace-normal
                  ${activeSection === s.id
                    ? 'bg-[#c9a84c] text-[#1a1a1a] font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div
            className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8 text-[13px] sm:text-[13.5px] text-gray-800 leading-relaxed"
            onScroll={(e) => {
              const container = e.currentTarget;
              for (const s of sections) {
                const el = document.getElementById(`section-${s.id}`);
                if (el && el.offsetTop - container.scrollTop < 200) setActiveSection(s.id);
              }
            }}
          >
            {/* ── 1. PRIVACY POLICY ── */}
            <section id="section-privacy" className="mb-12">
              <SectionHeading number="1" title="PRIVACY POLICY" />
              <Sub title="1.1 Introduction">
                This Privacy Policy governs the collection, use, processing, and protection of personal data by ByblosHQ ("Byblos," "we," "us," or "our") in accordance with:
                <BulletList items={[
                  "The Constitution of Kenya, 2010 — Article 31 (Right to Privacy)",
                  "The Data Protection Act, 2019 (Cap. 411C)",
                  "The Computer Misuse and Cybercrimes Act, 2018",
                  "Any regulations issued by the Office of the Data Protection Commissioner (ODPC)"
                ]} />
                By registering or using Byblos, you give express, informed consent to the processing of your personal data as described herein.
              </Sub>

              <Sub title="1.2 Information We Collect">
                <BulletList items={[
                  "Identity data: Full name, email, phone number, location.",
                  "Contact data: Phone number, email address,",
                  "Transactional data: Payment records, M-Pesa references, order history, order confirmations, receipts.",
                  "Technical data: IP address, device type, browser, cookies, session logs.",
                  "Communications: Customer service interactions, WhatsApp messages, dispute records.",
                  "Compliance data: KYC/AML verification documents where required by law."
                ]} />
              </Sub>

              <Sub title="1.3 Lawful Basis for Processing">
                Byblos processes your data on the following lawful grounds under Section 30 of the Data Protection Act, 2019:
                <BulletList items={[
                  "Consent — you have given clear consent.",
                  "Contract — processing is necessary to fulfil a contract with you.",
                  "Legal obligation — processing is required under Kenyan law.",
                  "Legitimate interests — processing is necessary for our legitimate business interests, provided they do not override your rights."
                ]} />
              </Sub>

              <Sub title="1.4 How We Use Your Data">
                <BulletList items={[
                  "Account creation, verification, and management.",
                  "Transaction processing and payment reconciliation.",
                  "Fraud prevention, AML checks, and platform security.",
                  "Regulatory reporting and tax compliance (e.g. KRA).",
                  "Sending transactional notifications, receipts, and service alerts.",
                  "Product improvement and aggregated analytics (anonymised).",
                  "Legal defence of claims against Byblos."
                ]} />
              </Sub>

              <Sub title="1.5 Data Sharing">
                We may share your data only with:
                <BulletList items={[
                  "Licensed Payment Service Providers (e.g. Pesapal, Paystack, Safaricom M-Pesa) — for transaction processing.",
                  "Logistics and delivery partners — limited to fulfil your order.",
                  "Kenya Revenue Authority (KRA) and other regulators — as required by law.",
                  "Legal counsel or auditors — under strict confidentiality obligations.",
                  "Third-party service providers — only under Data Processing Agreements (DPAs) compliant with the Data Protection Act."
                ]} />
                <p className="mt-3 font-semibold text-red-800">We will never sell, rent, or commercially exploit your personal data.</p>
              </Sub>

              <Sub title="1.6 Data Security">
                Byblos implements appropriate technical and organisational measures including encryption at rest and in transit, role-based access controls, regular security audits, and incident response procedures. In the event of a personal data breach, affected users will be notified within 72 hours, and the ODPC will be notified as required by Section 43 of the Data Protection Act, 2019.
              </Sub>

              <Sub title="1.7 Your Rights">
                Under the Data Protection Act, 2019, you have the right to:
                <BulletList items={[
                  "Be informed about how your data is used.",
                  "Access your personal data held by us.",
                  "Rectify inaccurate or incomplete data.",
                  "Erasure of your data, subject to legal retention obligations.",
                  "Object to or restrict processing.",
                  "Data portability.",
                  "Lodge a complaint with the ODPC (odpc.go.ke)."
                ]} />
                To exercise these rights, contact: <strong>bybloshqke@zohomail.com</strong>. We will respond within 21 days.
              </Sub>

              <Sub title="1.8 Data Retention">
                We retain personal data for as long as your account is active or as required by Kenyan law. Transactional and financial records are retained for a minimum of 7 years in accordance with the Tax Procedures Act, 2015. Following account deletion, residual data may be retained for up to 90 days for technical backup purposes.
              </Sub>
            </section>

            {/* ── 2. CLIENT AGREEMENT ── */}
            <section id="section-agreement" className="mb-12">
              <SectionHeading number="2" title="CLIENT AGREEMENT (USER AGREEMENT)" />
              <p className="mb-4 text-gray-600 italic">This Agreement is a legally binding contract between Byblos and every registered user.</p>

              <Sub title="2.1 Platform Role">
                Byblos is a digital marketplace and technology platform. Byblos is <strong>not</strong> a seller, buyer, or party to any transaction between users. Byblos facilitates commerce and assumes no liability for the actions or omissions of users.
              </Sub>

              <Sub title="2.2 Eligibility">
                By registering, you represent and warrant that you are:
                <BulletList items={[
                  "At least 18 years of age, or a legally incorporated entity.",
                  "Legally permitted to enter contracts under Kenyan law (Law of Contract Act, Cap. 23).",
                  "Not subject to any sanctions or legal prohibition from operating online commerce."
                ]} />
              </Sub>

              <Sub title="2.3 Seller Terms">
                <BulletList items={[
                  "A commission of KSh 10 is charged on every completed sale. This is non-negotiable and non-refundable.",
                  "A 1.5% service charge is added to each product price to keep products safe in transit, secure transactions, and support Byblos operations and maintenance.",
                  "Sellers warrant that all listings are truthful, lawful, and not misleading (Consumer Protection Act, 2012).",
                  "Sellers must fulfill orders within the stated timeframe or face suspension.",
                  "Sellers are solely responsible for tax obligations on income earned, including VAT and income tax to KRA.",
                  "Byblos reserves the right to withhold payouts pending dispute resolution.",
                  "Sellers consent to Byblos using their shop name, logo, and product listings for platform marketing."
                ]} />
              </Sub>

              <Sub title="2.4 Buyer Terms">
                <BulletList items={[
                  "Payment in full is required before order confirmation. No credit facilities are offered.",
                  "Buyers must provide accurate delivery and contact information. Losses from inaccurate data are the buyer's sole responsibility.",
                  "Buyers waive the right to chargeback through their bank where a dispute process exists on Byblos.",
                  "Refunds are governed by Section 3 of these Terms."
                ]} />
              </Sub>



              <Sub title="2.6 Platform Rights">
                Byblos may, at its sole discretion and without prior notice:
                <BulletList items={[
                  "Suspend or permanently terminate any account for breach of these Terms.",
                  "Remove any listing that violates applicable law or platform policies.",
                  "Freeze funds in disputed transactions pending resolution.",
                  "Amend commission rates with 30 days' notice.",
                  "Disclose user information to law enforcement or regulators upon lawful request."
                ]} />
              </Sub>

              <Sub title="2.7 Indemnity">
                Each user irrevocably agrees to indemnify, defend, and hold harmless Byblos and its officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including legal fees) arising from:
                <BulletList items={[
                  "Your use or misuse of the platform.",
                  "Your breach of these Terms.",
                  "Your violation of any applicable law or third-party right.",
                  "Any transaction conducted through your account."
                ]} />
              </Sub>
            </section>

            {/* ── 3. REFUND POLICY ── */}
            <section id="section-refund" className="mb-12">
              <SectionHeading number="3" title="REFUND POLICY" />

              <Sub title="3.1 General">
                Byblos processes refunds on behalf of sellers, consistent with the Consumer Protection Act, 2012 (Kenya). Byblos does not guarantee refunds for third-party seller conduct beyond what is explicitly stated herein.
              </Sub>

              <Sub title="3.2 Eligible Refunds">
                A refund may be approved where:
                <BulletList items={[
                  "The goods or services were materially different from the listing description.",
                  "A verified payment system error resulted in a duplicate charge.",
                  "The seller failed to deliver within 14 days of the confirmed delivery date with no communication.",
                  "Proven fraudulent activity by a seller"
                ]} />
              </Sub>

              <Sub title="3.3 Refund Procedure">
                <ol className="list-decimal pl-5 space-y-1.5 mt-2">
                  <li>Buyers must submit a written refund request to <strong>bybloshqke@zohomail.com</strong> within 7 days of the transaction date or delivery date (whichever is later).</li>
                  <li>Byblos will acknowledge receipt within 2 business days.</li>
                  <li>Byblos will investigate and seek response from the seller within 7 business days.</li>
                  <li>A decision will be communicated within 14 business days of the initial request.</li>
                  <li>Approved refunds are credited via the original payment method within 5–10 business days.</li>
                </ol>
              </Sub>

              <Sub title="3.4 Non-Refundable Cases">
                No refunds will be issued for:
                <BulletList items={[
                  "Change of mind after order confirmation.",
                  "Digital or downloadable items once accessed or downloaded.",
                  "Perishable goods delivered in conformity with the listing.",
                  "Delays caused by third-party couriers, Acts of God, or circumstances beyond Byblos's control.",
                  "Refund requests submitted outside the 7-day window without a reasonable excuse accepted by Byblos."
                ]} />
              </Sub>

              <Sub title="3.5 Byblos Commission on Refunds">
                Where a refund is approved, Byblos's commission is non-refundable unless the refund arises solely from a Byblos platform error.
              </Sub>
            </section>

            {/* ── 4. RISK DISCLOSURE ── */}
            <section id="section-risk" className="mb-12">
              <SectionHeading number="4" title="RISK DISCLOSURE AGREEMENT" />

              <Sub title="4.1 General Acknowledgment">
                You acknowledge that use of Byblos involves inherent commercial risks including:
                <BulletList items={[
                  "Payment delays, failed transactions, or mobile money network outages.",
                  "Fraudulent listings, buyer fraud, or identity theft by third parties.",
                  "Delivery failure, damage in transit, or logistics delays.",
                  "Event cancellations, venue changes, or regulatory shutdowns.",
                  "Cybersecurity incidents beyond Byblos's reasonable control."
                ]} />
              </Sub>

              <Sub title="4.2 User Due Diligence">
                Users are solely responsible for conducting independent due diligence before transacting. Byblos makes no warranties as to the quality, authenticity, legality, or fitness of any goods, services, or events listed on the platform.
              </Sub>

              <Sub title="4.3 Platform Disclaimer">
                BYBLOS PROVIDES THE PLATFORM ON AN "AS IS" AND "AS AVAILABLE" BASIS. TO THE FULLEST EXTENT PERMITTED BY KENYAN LAW, BYBLOS EXPRESSLY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </Sub>
            </section>

            {/* ── 5. INTELLECTUAL PROPERTY ── */}
            <section id="section-ip" className="mb-12">
              <SectionHeading number="5" title="INTELLECTUAL PROPERTY" />

              <Sub title="5.1 Byblos Ownership">
                All intellectual property rights in the Byblos platform, including but not limited to the name "Byblos," logo, software, database, user interface, design, and proprietary processes are exclusively owned by ByblosHQ and are protected under:
                <BulletList items={[
                  "The Copyright Act, 2001 (Kenya)",
                  "The Trade Marks Act, Cap. 506",
                  "The Industrial Property Act, 2001"
                ]} />
              </Sub>

              <Sub title="5.2 User Content Licence">
                By uploading content (product images, descriptions, event details) to Byblos, you grant Byblos a non-exclusive, royalty-free, worldwide, perpetual licence to use, reproduce, display, and distribute such content for platform operations and marketing.
              </Sub>

              <Sub title="5.3 Restrictions">
                You may not copy, reverse-engineer, scrape, or reproduce any part of the Byblos platform without express written consent. Violations will be pursued under Kenyan civil and criminal law.
              </Sub>
            </section>

            {/* ── 6. PROHIBITED CONDUCT ── */}
            <section id="section-prohibited" className="mb-12">
              <SectionHeading number="6" title="PROHIBITED CONDUCT" />

              <Sub title="6.1 Prohibited Acts">
                The following are strictly prohibited and may result in immediate account termination, fund forfeiture, and referral to law enforcement:
                <BulletList items={[
                  "Listing counterfeit, stolen, or prohibited goods.",
                  "Fraud, misrepresentation, or identity theft.",
                  "Money laundering or conducting transactions for unlawful purposes (Proceeds of Crime and Anti-Money Laundering Act, 2009).",
                  "Hacking, phishing, or any cyberattack on the platform or users (Computer Misuse and Cybercrimes Act, 2018).",
                  "Circumventing Byblos's payment systems to avoid commission.",
                  "Harassment, threats, or abusive conduct toward users or Byblos staff.",
                  "Creating multiple accounts to evade suspension.",
                  "Listing sexually explicit, hate, or defamatory content."
                ]} />
              </Sub>

              <Sub title="6.2 Byblos's Rights on Breach">
                Upon detection of prohibited conduct, Byblos may without notice:
                <BulletList items={[
                  "Suspend or permanently terminate the account.",
                  "Freeze and forfeit balances where fraud is suspected.",
                  "Report the matter to the DCI, CBK, ODPC, or other relevant authorities.",
                  "Pursue civil damages and injunctive relief."
                ]} />
              </Sub>
            </section>

            {/* ── 7. LIMITATION OF LIABILITY ── */}
            <section id="section-liability" className="mb-12">
              <SectionHeading number="7" title="LIMITATION OF LIABILITY" />

              <Sub title="7.1 Cap on Liability">
                To the maximum extent permitted by Kenyan law, Byblos's total aggregate liability to any user arising from or related to these Terms or use of the platform shall not exceed the total fees paid by that user to Byblos in the 3 months preceding the claim.
              </Sub>

              <Sub title="7.2 Exclusion of Consequential Loss">
                Byblos shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, loss of revenue, loss of data, loss of business, or reputational harm, whether or not Byblos has been advised of the possibility of such damages.
              </Sub>

              <Sub title="7.3 Force Majeure">
                Byblos shall not be in breach of these Terms nor liable for any delay or failure to perform where such delay or failure results from circumstances beyond its reasonable control, including natural disasters, government actions, telecoms outages, cyber-attacks by third parties, strikes, or pandemic-related disruptions.
              </Sub>
            </section>

            {/* ── 8. DISPUTE RESOLUTION ── */}
            <section id="section-disputes" className="mb-12">
              <SectionHeading number="8" title="DISPUTE RESOLUTION" />

              <Sub title="8.1 Internal Resolution">
                In the event of a dispute, users must first contact Byblos at <strong>bybloshqke@zohomail.com</strong> and allow 21 days for Byblos to attempt resolution before pursuing any external remedy.
              </Sub>

              <Sub title="8.2 Mediation">
                If internal resolution fails, the parties agree to submit the dispute to mediation under the Nairobi Centre for International Arbitration (NCIA) Mediation Rules before proceeding to arbitration or litigation.
              </Sub>

              <Sub title="8.3 Arbitration">
                Unresolved disputes shall be referred to binding arbitration under the Arbitration Act, 1995 (Kenya), administered by the NCIA, with a sole arbitrator appointed by agreement or, failing agreement, by the NCIA. Proceedings shall be conducted in English in Nairobi, Kenya.
              </Sub>

              <Sub title="8.4 Small Claims">
                Notwithstanding clause 8.3, either party may bring a claim in the Small Claims Court for disputes not exceeding KES 1,000,000.
              </Sub>

              <Sub title="8.5 Class Action Waiver">
                You irrevocably waive any right to participate in a class action, class arbitration, or representative proceeding against Byblos. All disputes must be brought individually.
              </Sub>
            </section>

            {/* ── 9. AMENDMENTS ── */}
            <section id="section-amendments" className="mb-12">
              <SectionHeading number="9" title="AMENDMENTS" />

              <Sub title="9.1 Right to Amend">
                Byblos reserves the right to amend these Terms at any time. Changes will be published on the platform and users notified via email or in-app notification at least 14 days before taking effect, except where immediate changes are required by law.
              </Sub>

              <Sub title="9.2 Continued Use">
                Continued use of the platform after the effective date of any amendment constitutes acceptance of the updated Terms. If you do not accept the new Terms, you must immediately deactivate your account.
              </Sub>
            </section>

            {/* ── 10. GOVERNING LAW ── */}
            <section id="section-governing" className="mb-12">
              <SectionHeading number="10" title="GOVERNING LAW & JURISDICTION" />
              <div className="text-gray-700 space-y-3">
                <p>These Terms are governed by and construed in accordance with the Laws of Kenya, including but not limited to:</p>
                <BulletList items={[
                  "The Constitution of Kenya, 2010",
                  "The Law of Contract Act (Cap. 23)",
                  "The Consumer Protection Act, 2012",
                  "The Data Protection Act, 2019",
                  "The Computer Misuse and Cybercrimes Act, 2018",
                  "The Proceeds of Crime and Anti-Money Laundering Act, 2009",
                  "The Arbitration Act, 1995",
                  "The Copyright Act, 2001 and the Industrial Property Act, 2001"
                ]} />
                <p>Any court proceedings not subject to arbitration shall be brought exclusively before the courts of Kenya, and each party irrevocably submits to the personal jurisdiction of such courts.</p>
                <div className="mt-6 p-4 bg-[#1a1a1a] text-white text-xs rounded">
                  <p className="text-[#c9a84c] font-semibold mb-1 uppercase tracking-widest text-[10px]">Legal Contact</p>
                  <p>📧 bybloshqke@zohomail.com</p>
                  <p className="mt-2 text-gray-400">ByblosHQ — Nairobi, Kenya &nbsp;|&nbsp; Version 2.0, January 2026</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[#d4c9a8] bg-[#f5f2ea] px-8 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-500 italic">
            By clicking "I Agree" or using Byblos, you confirm you have read and accepted all terms above.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs border border-gray-300 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => {
                if (onAccept) onAccept();
                onClose();
              }}
              className="px-6 py-2 text-xs bg-[#1a1a1a] text-white hover:bg-[#c9a84c] hover:text-[#1a1a1a] font-semibold rounded transition-colors tracking-wide"
            >
              I Agree
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Helper Components ── */

const SectionHeading = ({ number, title }: { number: string; title: string }) => (
  <div className="mb-5 pb-3 border-b-2 border-[#c9a84c]">
    <div className="flex items-baseline gap-3">
      <span className="text-[#c9a84c] font-bold text-sm">{number}.</span>
      <h2 className="text-base font-bold text-[#1a1a1a] tracking-wide uppercase">{title}</h2>
    </div>
  </div>
);

const Sub = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <h3 className="font-semibold text-[#1a1a1a] mb-2 text-[13px]">{title}</h3>
    <div className="text-gray-700 leading-relaxed">{children}</div>
  </div>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-5 mt-2 space-y-1.5 text-gray-700">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

export default TermsModal;
