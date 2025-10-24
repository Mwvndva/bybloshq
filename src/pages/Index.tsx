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
                    <DialogTitle className="text-xl font-bold">BYBLOS TERMS AND CONDITIONS OF USE</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <p className="text-gray-600">Last updated: October 2025</p>
                    
                    <div>
                      <h3 className="font-semibold text-base mb-2">1. Introduction</h3>
                      <p className="mb-2">Welcome to ByblosHQ ("Byblos," "we," "us," or "our").</p>
                      <p className="mb-2">By using our website, mobile application, or related services (collectively the "Platform"), you agree to comply with and be bound by these Terms and Conditions.</p>
                      <p className="mb-2">These Terms govern your access and use of Byblos whether you are a Seller, Buyer, or Event Organizer.</p>
                      <p className="mb-2">By accessing or using the Platform, you confirm that you have read, understood, and agree to these Terms and our Privacy Policy.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">2. Definitions</h3>
                      <p className="mb-1"><strong>"Seller"</strong> refers to any individual or business offering goods or services for sale on the Platform.</p>
                      <p className="mb-1"><strong>"Buyer"</strong> refers to any user purchasing goods, services, or event tickets through the Platform.</p>
                      <p className="mb-1"><strong>"Event Organizer"</strong> refers to a user who lists and sells tickets to events using Byblos.</p>
                      <p className="mb-1"><strong>"Commission"</strong> refers to the fee charged by Byblos for facilitating sales or transactions.</p>
                      <p className="mb-1"><strong>"Account"</strong> means a registered user profile on Byblos.</p>
                      <p className="mb-1"><strong>"Services"</strong> refers to all products, systems, and functionalities provided by Byblos.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">3. Eligibility</h3>
                      <p className="mb-1">To use Byblos:</p>
                      <p className="mb-1">You must be at least 18 years old or have legal parental consent.</p>
                      <p className="mb-1">You must comply with all applicable Kenyan laws, including consumer protection, e-commerce, and data protection regulations.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">4. User Accounts</h3>
                      <p className="mb-2">All users must create an account with accurate and verifiable information.</p>
                      <p className="mb-1">You agree to:</p>
                      <p className="mb-1">• Maintain accurate and updated information.</p>
                      <p className="mb-1">• Keep your password confidential.</p>
                      <p className="mb-1">• Notify Byblos immediately of unauthorized access.</p>
                      <p className="mb-1">Byblos reserves the right to suspend or terminate any account that violates these Terms or engages in suspicious activity.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">5. Platform Services</h3>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">(a) For Sellers</h4>
                        <p className="mb-1">Sellers can create a personalized shop to list products or services.</p>
                        <p className="mb-1">Byblos provides tools for order management, payment collection, delivery coordination, and analytics.</p>
                        <p className="mb-1">A 9% commission is automatically deducted from each successful transaction before settlement to the Seller.</p>
                        <p className="mb-1">Sellers must:</p>
                        <p className="mb-1">• Ensure all products/services listed are legal under Kenyan law.</p>
                        <p className="mb-1">• Provide accurate product descriptions and pricing.</p>
                        <p className="mb-1">• Fulfill orders promptly and handle customer complaints professionally.</p>
                        <p className="mb-1">Byblos reserves the right to remove listings that violate our policies or applicable laws.</p>
                      </div>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">(b) For Buyers</h4>
                        <p className="mb-1">Buyers can browse, order, and pay for products or services securely through the Platform.</p>
                        <p className="mb-1">Payments are processed via integrated PSPs (e.g., M-Pesa, card gateways).</p>
                        <p className="mb-1">Buyers agree to:</p>
                        <p className="mb-1">• Provide accurate delivery and contact details.</p>
                        <p className="mb-1">• Use the platform in good faith without fraud or abuse.</p>
                        <p className="mb-1">• Review product descriptions before making purchases.</p>
                        <p className="mb-1">Refunds or disputes must be handled in accordance with the Seller's stated policy, and Byblos may act as a mediator where necessary.</p>
                      </div>
                      <div className="mb-2">
                        <h4 className="font-medium mb-1">(c) For Event Organizers</h4>
                        <p className="mb-1">Event Organizers can create and list events on Byblos, sell tickets, and manage attendee data.</p>
                        <p className="mb-1">A 6% commission is charged on every ticket sold.</p>
                        <p className="mb-1">Event Organizers are responsible for:</p>
                        <p className="mb-1">• Ensuring all events comply with relevant local permits, public safety, and licensing laws.</p>
                        <p className="mb-1">• Providing accurate event details, refund policies, and contact information.</p>
                        <p className="mb-1">• Managing event access (e.g., QR codes or wristbands).</p>
                        <p className="mb-1">Byblos may assist with ticketing, but ultimate event responsibility lies with the Organizer.</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">6. Payments & Commissions</h3>
                      <p className="mb-1">All payments are processed via licensed Payment Service Providers (PSPs) regulated by the Central Bank of Kenya (CBK).</p>
                      <p className="mb-1">Byblos deducts:</p>
                      <p className="mb-1">• 9% on each Seller transaction.</p>
                      <p className="mb-1">• 6% on each Event Organizer sale.</p>
                      <p className="mb-1">Settlement to Sellers/Organizers is made after payment confirmation, usually within 2–3 business days, depending on PSP processing.</p>
                      <p className="mb-1">Byblos is not liable for PSP delays, chargebacks, or third-party system failures.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">7. Refunds & Cancellations</h3>
                      <p className="mb-1">Refund policies are defined by Sellers and Event Organizers individually.</p>
                      <p className="mb-1">Byblos facilitates refund requests but does not guarantee refunds on behalf of users.</p>
                      <p className="mb-1">In case of confirmed fraud, double charges, or system errors, Byblos may process refunds directly at its discretion.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">8. Content & Intellectual Property</h3>
                      <p className="mb-1">Sellers and Organizers retain ownership of their listings, media, and branding.</p>
                      <p className="mb-1">Byblos retains ownership of all platform design, code, trademarks, and systems.</p>
                      <p className="mb-1">By posting content, you grant Byblos a non-exclusive, worldwide license to use, display, and promote your listings for marketing purposes.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">9. Prohibited Activities</h3>
                      <p className="mb-1">Users may not:</p>
                      <p className="mb-1">• List illegal, counterfeit, or stolen goods.</p>
                      <p className="mb-1">• Engage in misleading advertising or price manipulation.</p>
                      <p className="mb-1">• Circumvent Byblos' commission system.</p>
                      <p className="mb-1">• Post abusive, defamatory, or explicit content.</p>
                      <p className="mb-1">• Use bots, scrapers, or unauthorized software to access Byblos.</p>
                      <p className="mb-1">Violations will result in suspension or permanent removal of your account.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">10. Data Privacy</h3>
                      <p className="mb-1">Byblos complies with the Data Protection Act (Kenya, 2019).</p>
                      <p className="mb-1">We collect, store, and process data only for legitimate business purposes, including order processing, customer communication, and analytics.</p>
                      <p className="mb-1">Sensitive information (such as payment data) is encrypted and handled by licensed PSPs.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">11. Limitation of Liability</h3>
                      <p className="mb-1">Byblos acts as a facilitator between Sellers, Buyers, and Organizers.</p>
                      <p className="mb-1">We are not a party to the actual sale or event contract.</p>
                      <p className="mb-1">Byblos shall not be liable for:</p>
                      <p className="mb-1">• Product/service quality issues.</p>
                      <p className="mb-1">• Delivery or event cancellation disputes.</p>
                      <p className="mb-1">• Loss of profits, data, or business interruptions.</p>
                      <p className="mb-1">However, Byblos will take reasonable measures to ensure platform integrity and user protection.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">12. Termination</h3>
                      <p className="mb-1">Byblos may suspend or terminate your account if:</p>
                      <p className="mb-1">• You breach these Terms.</p>
                      <p className="mb-1">• You engage in fraudulent or harmful activity.</p>
                      <p className="mb-1">• You misuse platform services or intellectual property.</p>
                      <p className="mb-1">Upon termination, all pending settlements (minus commissions) will be processed according to Byblos' internal policies.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">13. Dispute Resolution</h3>
                      <p className="mb-1">All disputes shall first be resolved amicably through customer support.</p>
                      <p className="mb-1">If unresolved, disputes shall be submitted to arbitration in Nairobi, Kenya, under the Arbitration Act (Cap. 49, Laws of Kenya).</p>
                      <p className="mb-1">The decision of the arbitrator shall be final and binding.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">14. Governing Law</h3>
                      <p className="mb-1">These Terms are governed by and construed in accordance with the Laws of Kenya.</p>
                      <p className="mb-1">Users agree to submit to the exclusive jurisdiction of the Kenyan courts.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base mb-2">15. Modifications</h3>
                      <p className="mb-1">Byblos reserves the right to amend or update these Terms at any time.</p>
                      <p className="mb-1">Any changes will take effect immediately upon posting on the Platform, and continued use signifies acceptance.</p>
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
