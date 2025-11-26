import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal = ({ isOpen, onClose }: TermsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            BYBLOS LEGAL DOCUMENTS
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Last Updated: October 2025 | Registered in Kenya — ByblosHQ ("Byblos," "we," "us," or "our")
          </p>
        </DialogHeader>

        <div className="mt-6 space-y-8 text-sm">
          {/* 1. PRIVACY POLICY */}
          <section>
            <h2 className="text-xl font-bold text-black mb-4">1. PRIVACY POLICY</h2>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold text-black mb-2">1.1 Introduction</h3>
                <p>
                  This Privacy Policy explains how Byblos collects, uses, and protects personal information from Sellers, Buyers, and Event Organizers ("Users") in compliance with the Data Protection Act, 2019 (Kenya).
                </p>
                <p className="mt-2">
                  By using Byblos, you consent to the collection and processing of your information as outlined below.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.2 Information We Collect</h3>
                <p className="mb-2">We collect the following data:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Personal details:</strong> Name, phone number, email, business name, KRA PIN, and location.</li>
                  <li><strong>Transactional data:</strong> Payment records, delivery details, orders, and booking history.</li>
                  <li><strong>Device data:</strong> IP address, browser, device type, and cookies.</li>
                  <li><strong>Communications:</strong> WhatsApp messages, customer service interactions, and feedback.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.3 How We Use Your Data</h3>
                <p className="mb-2">Byblos uses your data to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Create and manage your account.</li>
                  <li>Process payments and deliver services.</li>
                  <li>Send notifications, invoices, and updates via WhatsApp or email.</li>
                  <li>Prevent fraud and secure the platform.</li>
                  <li>Improve user experience and product features.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.4 Data Sharing</h3>
                <p className="mb-2">We may share your information with:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Licensed Payment Service Providers (PSPs) (e.g. Pesapal, Paystack).</li>
                  <li>Delivery and logistics partners for shipping orders.</li>
                  <li>Regulatory authorities if legally required.</li>
                  <li>Third-party analytics or support tools under data protection agreements.</li>
                </ul>
                <p className="mt-2 font-semibold">We do not sell or rent your personal data.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.5 Data Security</h3>
                <p>We use encryption, secure servers, and restricted access controls.</p>
                <p className="mt-2">In case of a data breach, users will be notified within 72 hours in accordance with Kenyan law.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.6 Your Rights</h3>
                <p className="mb-2">Under the Data Protection Act, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Access, correct, or delete your personal data.</li>
                  <li>Withdraw consent.</li>
                  <li>Request data portability.</li>
                  <li>Lodge a complaint with the Office of the Data Protection Commissioner (ODPC).</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.7 Data Retention</h3>
                <p>We retain user data for as long as your account is active or required by law (typically 7 years for transactional data).</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">1.8 Contact</h3>
                <p>For data requests or privacy inquiries:</p>
                <p>📧 privacy@bybloshq.com</p>
              </div>
            </div>
          </section>

          {/* 2. CLIENT AGREEMENT */}
          <section>
            <h2 className="text-xl font-bold text-black mb-4">2. CLIENT AGREEMENT (USER AGREEMENT)</h2>
            <p className="mb-4 text-gray-700">This Agreement is between Byblos and all registered users.</p>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold text-black mb-2">2.1 Scope</h3>
                <p>Byblos provides a digital marketplace that connects Sellers, Buyers, and Event Organizers.</p>
                <p className="mt-2">By registering, you agree to use the platform legally, responsibly, and honestly.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">2.2 Seller Terms</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Sellers pay a 9% commission on every completed sale.</li>
                  <li>Sellers must ensure product/service authenticity, legality, and timely delivery.</li>
                  <li>Sellers are solely responsible for customer service and dispute resolution.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">2.3 Buyer Terms</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Buyers agree to pay full price before order confirmation.</li>
                  <li>Buyers are responsible for providing accurate delivery and contact details.</li>
                  <li>Refunds follow the Byblos Refund Policy.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">2.4 Event Organizer Terms</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Event Organizers pay a 6% commission per ticket sale.</li>
                  <li>They must ensure compliance with licensing, venue safety, and refund terms.</li>
                  <li>Byblos provides event listing, ticketing, and payment facilitation only.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">2.5 Platform Rights</h3>
                <p className="mb-2">Byblos may:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Suspend or terminate accounts violating these terms.</li>
                  <li>Modify commission rates with prior notice.</li>
                  <li>Use listings or shop content for marketing or promotional purposes.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">2.6 Indemnity</h3>
                <p>Users agree to indemnify and hold Byblos harmless against claims, losses, or damages arising from their use of the platform or breach of this Agreement.</p>
              </div>
            </div>
          </section>

          {/* 3. REFUND POLICY */}
          <section>
            <h2 className="text-xl font-bold text-black mb-4">3. REFUND POLICY</h2>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold text-black mb-2">3.1 General Policy</h3>
                <p>Byblos facilitates transactions but is not the direct seller. Refunds are processed based on the Seller's or Event Organizer's individual policy, subject to review by Byblos.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">3.2 Eligible Refunds</h3>
                <p className="mb-2">Refunds may apply if:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The item/service is not delivered as described.</li>
                  <li>An event is canceled or rescheduled.</li>
                  <li>There is proven fraud or double payment.</li>
                  <li>A payment system error occurs.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">3.3 Refund Procedure</h3>
                <ol className="list-decimal pl-6 space-y-1">
                  <li>The Buyer must submit a request within 7 days of the transaction.</li>
                  <li>Byblos verifies details with the Seller or Organizer.</li>
                  <li>Approved refunds are processed via the same payment method within 5–10 business days.</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">3.4 Non-Refundable Cases</h3>
                <p className="mb-2">No refunds are available for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Change of mind after confirmed order.</li>
                  <li>Downloadable or digital items once accessed.</li>
                  <li>Late delivery caused by third-party couriers.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">3.5 Contact for Refunds</h3>
                <p>📧 refunds@bybloshq.com</p>
              </div>
            </div>
          </section>

          {/* 4. RISK DISCLOSURE AGREEMENT */}
          <section>
            <h2 className="text-xl font-bold text-black mb-4">4. RISK DISCLOSURE AGREEMENT</h2>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold text-black mb-2">4.1 General Acknowledgment</h3>
                <p className="mb-2">By using Byblos, you acknowledge that online commerce involves inherent risks including:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Payment delays or chargebacks.</li>
                  <li>Fraudulent listings or misrepresentation.</li>
                  <li>Delivery or logistics issues.</li>
                  <li>Event postponements or cancellations.</li>
                </ul>
                <p className="mt-2 font-semibold">Byblos acts only as a platform facilitator, not as a seller, event organizer, or payment guarantor.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">4.2 User Responsibility</h3>
                <p className="mb-2">You agree to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Conduct due diligence before transactions.</li>
                  <li>Confirm Seller/Event legitimacy.</li>
                  <li>Report suspicious activity immediately.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">4.3 Byblos Limitation</h3>
                <p className="mb-2">Byblos shall not be liable for:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Loss of profits, business opportunities, or data.</li>
                  <li>Disputes between users.</li>
                  <li>Service interruptions caused by third-party providers.</li>
                </ul>
                <p className="mt-2">However, we are committed to resolving disputes fairly and promptly.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">4.4 Acknowledgment</h3>
                <p>By registering or using Byblos, you acknowledge and accept all associated business, transactional, and digital risks.</p>
              </div>
            </div>
          </section>

          {/* 5. GOVERNING LAW */}
          <section>
            <h2 className="text-xl font-bold text-black mb-4">5. GOVERNING LAW</h2>
            <p className="text-gray-700">
              All agreements are governed by the Laws of Kenya and subject to the exclusive jurisdiction of Kenyan courts.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
