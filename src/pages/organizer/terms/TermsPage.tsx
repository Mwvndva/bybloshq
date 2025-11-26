import { FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="prose max-w-none">
        <div className="bg-black p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">📜 Byblos Experience – Organizer Terms & Conditions (Kenya)</h2>
          <p className="mb-6">
            These Terms & Conditions ("Agreement") govern your use of the Byblos Experience platform as an event organizer in Kenya. 
            By creating an event or using our services, you agree to be legally bound by the following terms:
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">1. 🧾 Platform Commission & Services</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Byblos will deduct a 6% commission on every successful ticket sale made through the platform.</li>
                <li>This commission includes:
                  <ul className="list-disc pl-6">
                    <li>Platform services and transaction processing</li>
                    <li>Two (2) trained staff members for on-site ticket validation</li>
                  </ul>
                </li>
                <li>Commission is calculated based on the total amount paid by the customer, inclusive of all taxes and fees.</li>
                <li>The commission is non-refundable.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">2. 📵 No Misrepresentation</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Organizers agree to provide truthful, accurate, and complete information about events.</li>
                <li>Events must comply with Kenyan laws, including licensing, public gathering rules, and county-level regulations.</li>
                <li>Byblos reserves the right to suspend or remove any event that is misleading, unsafe, or illegal.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">3. 💸 Payouts to Organizers</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Payouts are processed within business days after event completion, subject to reconciliation and fraud checks.</li>
                <li>Organizers must provide valid bank account or mobile money details for payment.</li>
                <li>In the case of event cancellation or unresolved disputes, Byblos may withhold payouts pending investigation.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">4. 📵 No Misrepresentation</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Organizers agree to provide truthful, accurate, and complete information about events.</li>
                <li>Events must comply with Kenyan laws, including licensing, public gathering rules, and county-level regulations.</li>
                <li>Byblos reserves the right to suspend or remove any event that is misleading, unsafe, or illegal.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">5. 📢 Marketing & Promotion</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Byblos may use your event name, logo, and images to promote your event across social media and partner platforms.</li>
                <li>You grant us non-exclusive rights to use this content solely for marketing purposes.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">6. 🛡️ Liability</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Byblos is a ticketing platform, not an event organizer. We are not responsible for event logistics, cancellations, or attendee disputes.</li>
                <li>Organizers are fully liable for health, safety, and security of event attendees.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">7. 🧑🏽‍⚖️ Dispute Resolution</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>In case of a dispute between the organizer and Byblos, we will attempt to resolve it amicably.</li>
                <li>If resolution fails, the matter will be handled under Kenyan law and adjudicated in a competent court within Nairobi County.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">8. 🚨 Refunds & Cancellations</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Organizers are responsible for defining their own refund policy and clearly communicating it to ticket buyers.</li>
                <li>Byblos will process refunds only upon written request by the organizer, unless legally required otherwise.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">9. 🔐 Data Protection</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Byblos will handle customer and organizer data in accordance with the Data Protection Act, 2019 (Kenya).</li>
                <li>Organizers agree not to misuse attendee data or share it with third parties without consent.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">10. 🆗 Consent & Agreement</h3>
              <p className="mt-2">
                By creating an event, the organizer automatically agrees to these terms and acknowledges legal responsibility for compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
