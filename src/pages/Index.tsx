import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleEventsClick = () => {
    navigate('/events');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main>
        <HeroSection 
          onEventsClick={handleEventsClick} 
        />
      </main>

      <footer className={`py-8 border-t ${location.pathname === '/' ? 'bg-yellow-300 border-yellow-300' : 'bg-white border-gray-200'} text-black`}>
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4">
            {/* Contact Information */}
            <div className="space-y-2">
              <p className="text-gray-700 text-sm font-medium">Contact Us</p>
              <div className="space-y-1">
                <p className="text-gray-600 text-sm">
                  Nairobi, Kenya
                </p>
                <p className="text-gray-600 text-sm">
                  Phone: +254111548797
                </p>
                <p className="text-gray-600 text-sm">
                  Email: byblosexperience@zohomail.com
                </p>
              </div>
            </div>
            
            {/* Terms and Conditions */}
            <div className="pt-4 border-t border-gray-300">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-gray-600 text-sm hover:text-gray-800 underline">
                    Terms and Conditions
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">BYBLOS LEGAL DOCUMENTS</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <p className="text-gray-600">Last Updated: October 2025</p>
                    <p className="text-gray-600">Registered in Kenya — ByblosHQ ("Byblos," "we," "us," or "our")</p>
                    
                    <div>
                      <h3 className="font-semibold text-base mb-2">1. PRIVACY POLICY</h3>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.1 Introduction</h4>
                        <p className="mb-1">This Privacy Policy explains how Byblos collects, uses, and protects personal information from Sellers, Buyers, and Event Organizers ("Users") in compliance with the Data Protection Act, 2019 (Kenya).</p>
                        <p className="mb-1">By using Byblos, you consent to the collection and processing of your information as outlined below.</p>
                      </div>
                      
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.2 Information We Collect</h4>
                        <p className="mb-1">We collect the following data:</p>
                        <p className="mb-1">Personal details: Name, phone number, email, business name, KRA PIN, and location.</p>
                        <p className="mb-1">Transactional data: Payment records, delivery details, orders, and booking history.</p>
                        <p className="mb-1">Device data: IP address, browser, device type, and cookies.</p>
                        <p className="mb-1">Communications: WhatsApp messages, customer service interactions, and feedback.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.3 How We Use Your Data</h4>
                        <p className="mb-1">Byblos uses your data to:</p>
                        <p className="mb-1">• Create and manage your account.</p>
                        <p className="mb-1">• Process payments and deliver services.</p>
                        <p className="mb-1">• Send notifications, invoices, and updates via WhatsApp or email.</p>
                        <p className="mb-1">• Prevent fraud and secure the platform.</p>
                        <p className="mb-1">• Improve user experience and product features.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.4 Data Sharing</h4>
                        <p className="mb-1">We may share your information with:</p>
                        <p className="mb-1">• Licensed Payment Service Providers (PSPs) (e.g. Pesapal, Paystack).</p>
                        <p className="mb-1">• Delivery and logistics partners for shipping orders.</p>
                        <p className="mb-1">• Regulatory authorities if legally required.</p>
                        <p className="mb-1">• Third-party analytics or support tools under data protection agreements.</p>
                        <p className="mb-1">We do not sell or rent your personal data.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.5 Data Security</h4>
                        <p className="mb-1">We use encryption, secure servers, and restricted access controls.</p>
                        <p className="mb-1">In case of a data breach, users will be notified within 72 hours in accordance with Kenyan law.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.6 Your Rights</h4>
                        <p className="mb-1">Under the Data Protection Act, you have the right to:</p>
                        <p className="mb-1">• Access, correct, or delete your personal data.</p>
                        <p className="mb-1">• Withdraw consent.</p>
                        <p className="mb-1">• Request data portability.</p>
                        <p className="mb-1">• Lodge a complaint with the Office of the Data Protection Commissioner (ODPC).</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.7 Data Retention</h4>
                        <p className="mb-1">We retain user data for as long as your account is active or required by law (typically 7 years for transactional data).</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">1.8 Contact</h4>
                        <p className="mb-1">For data requests or privacy inquiries:</p>
                        <p className="mb-1">📧 privacy@bybloshq.com</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">2. CLIENT AGREEMENT (USER AGREEMENT)</h3>
                      <p className="mb-1">This Agreement is between Byblos and all registered users.</p>
                      
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.1 Scope</h4>
                        <p className="mb-1">Byblos provides a digital marketplace that connects Sellers, Buyers, and Event Organizers.</p>
                        <p className="mb-1">By registering, you agree to use the platform legally, responsibly, and honestly.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.2 Seller Terms</h4>
                        <p className="mb-1">• Sellers pay a 9% commission on every completed sale.</p>
                        <p className="mb-1">• Sellers must ensure product/service authenticity, legality, and timely delivery.</p>
                        <p className="mb-1">• Sellers are solely responsible for customer service and dispute resolution.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.3 Buyer Terms</h4>
                        <p className="mb-1">• Buyers agree to pay full price before order confirmation.</p>
                        <p className="mb-1">• Buyers are responsible for providing accurate delivery and contact details.</p>
                        <p className="mb-1">• Refunds follow the Byblos Refund Policy.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.4 Event Organizer Terms</h4>
                        <p className="mb-1">• Event Organizers pay a 6% commission per ticket sale.</p>
                        <p className="mb-1">• They must ensure compliance with licensing, venue safety, and refund terms.</p>
                        <p className="mb-1">• Byblos provides event listing, ticketing, and payment facilitation only.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.5 Platform Rights</h4>
                        <p className="mb-1">Byblos may:</p>
                        <p className="mb-1">• Suspend or terminate accounts violating these terms.</p>
                        <p className="mb-1">• Modify commission rates with prior notice.</p>
                        <p className="mb-1">• Use listings or shop content for marketing or promotional purposes.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">2.6 Indemnity</h4>
                        <p className="mb-1">Users agree to indemnify and hold Byblos harmless against claims, losses, or damages arising from their use of the platform or breach of this Agreement.</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">3. REFUND POLICY</h3>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">3.1 General Policy</h4>
                        <p className="mb-1">Byblos facilitates transactions but is not the direct seller. Refunds are processed based on the Seller's or Event Organizer's individual policy, subject to review by Byblos.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">3.2 Eligible Refunds</h4>
                        <p className="mb-1">Refunds may apply if:</p>
                        <p className="mb-1">• The item/service is not delivered as described.</p>
                        <p className="mb-1">• An event is canceled or rescheduled.</p>
                        <p className="mb-1">• There is proven fraud or double payment.</p>
                        <p className="mb-1">• A payment system error occurs.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">3.3 Refund Procedure</h4>
                        <p className="mb-1">• The Buyer must submit a request within 7 days of the transaction.</p>
                        <p className="mb-1">• Byblos verifies details with the Seller or Organizer.</p>
                        <p className="mb-1">• Approved refunds are processed via the same payment method within 5–10 business days.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">3.4 Non-Refundable Cases</h4>
                        <p className="mb-1">No refunds are available for:</p>
                        <p className="mb-1">• Change of mind after confirmed order.</p>
                        <p className="mb-1">• Downloadable or digital items once accessed.</p>
                        <p className="mb-1">• Late delivery caused by third-party couriers.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">3.5 Contact for Refunds</h4>
                        <p className="mb-1">📧 refunds@bybloshq.com</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">4. RISK DISCLOSURE AGREEMENT</h3>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">4.1 General Acknowledgment</h4>
                        <p className="mb-1">By using Byblos, you acknowledge that online commerce involves inherent risks including:</p>
                        <p className="mb-1">• Payment delays or chargebacks.</p>
                        <p className="mb-1">• Fraudulent listings or misrepresentation.</p>
                        <p className="mb-1">• Delivery or logistics issues.</p>
                        <p className="mb-1">• Event postponements or cancellations.</p>
                        <p className="mb-1">Byblos acts only as a platform facilitator, not as a seller, event organizer, or payment guarantor.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">4.2 User Responsibility</h4>
                        <p className="mb-1">You agree to:</p>
                        <p className="mb-1">• Conduct due diligence before transactions.</p>
                        <p className="mb-1">• Confirm Seller/Event legitimacy.</p>
                        <p className="mb-1">• Report suspicious activity immediately.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">4.3 Byblos Limitation</h4>
                        <p className="mb-1">Byblos shall not be liable for:</p>
                        <p className="mb-1">• Loss of profits, business opportunities, or data.</p>
                        <p className="mb-1">• Disputes between users.</p>
                        <p className="mb-1">• Service interruptions caused by third-party providers.</p>
                        <p className="mb-1">However, we are committed to resolving disputes fairly and promptly.</p>
                      </div>

                      <div className="mb-2">
                        <h4 className="font-medium mb-1">4.4 Acknowledgment</h4>
                        <p className="mb-1">By registering or using Byblos, you acknowledge and accept all associated business, transactional, and digital risks.</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">5. GOVERNING LAW</h3>
                      <p className="mb-1">All agreements are governed by the Laws of Kenya and subject to the exclusive jurisdiction of Kenyan courts.</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Copyright */}
            <div className="pt-2 space-y-2">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Byblos. All rights reserved.
          </p>
          <p className="text-gray-500 text-xs">Powered by Evolve</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
