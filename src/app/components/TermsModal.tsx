import { X } from 'lucide-react';

const TERMS_TEXT = `
**VENDLOCATE — TERMS OF SERVICE, DISCLAIMER & NO-REFUND POLICY**

**1. ACCEPTANCE OF TERMS**
By purchasing or using VendLocate ("the Service"), you agree to be bound by these terms. If you do not agree, do not use the Service.

**2. DESCRIPTION OF SERVICE**
VendLocate provides automated discovery of business locations and their contact information using public data sources (Overture Maps, OpenStreetMap, Google Places) and website crawling. Leads and emails are generated algorithmically and are provided for informational purposes only.

**3. NO GUARANTEE OF ACCURACY**
THE SERVICE PROVIDES LEADS AND EMAIL ADDRESSES ON AN "AS IS" AND "AS AVAILABLE" BASIS. WE MAKE NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING:
- The accuracy, completeness, or reliability of any lead, email address, phone number, or business information
- The deliverability of any email address
- Whether any business is interested in your services or products
- The continued operation or existence of any listed business

Leads are discovered through automated crawling and public data sources. Emails may be inferred from website content and may not represent actual contact addresses for the business. Some business information may be outdated, inaccurate, or incomplete.

**4. NO REFUND POLICY**
ALL PURCHASES ARE FINAL. NO REFUNDS WILL BE ISSUED FOR ANY REASON, INCLUDING BUT NOT LIMITED TO:
- Unsatisfactory lead quality or quantity
- Invalid or non-deliverable email addresses
- Businesses that do not respond to outreach
- Inability to secure business relationships or revenue
- Duplicate or inaccurate business information
- Changes to business status or availability

You acknowledge that the value of the Service is in the automated discovery process, not in any specific outcome or result.

**5. LIMITATION OF LIABILITY**
TO THE MAXIMUM EXTENT PERMITTED BY LAW, VENDLOCATE AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE.

**6. NO GUARANTEE OF BUSINESS RESULTS**
Finding potential business leads does not guarantee:
- That any business will respond to your outreach
- That any business relationship will be established
- Any specific return on investment or revenue
- Business success or profitability

You are solely responsible for evaluating leads and conducting your own due diligence before pursuing any business relationship.

**7. COMPLIANCE WITH LAWS**
You agree to use all leads and contact information in compliance with all applicable laws, including:
- CAN-SPAM Act (controlling unsolicited email)
- Telephone Consumer Protection Act (TCPA)
- State and federal privacy laws
- Any applicable anti-spam regulations

You shall not use the Service to send unsolicited commercial email in violation of applicable law.

**8. INDEMNIFICATION**
You agree to indemnify and hold harmless VendLocate and its operators from any claims, damages, losses, or expenses arising from your use of the Service or violation of these terms.

**9. CHANGES TO TERMS**
We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.

**10. GOVERNING LAW**
These terms shall be governed by and construed in accordance with the laws of the State of Illinois, without regard to its conflict of law provisions.
`;

export default function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">Terms of Service</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed space-y-4 whitespace-pre-line">
          {TERMS_TEXT.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2" />;
            if (line.startsWith('**') && line.endsWith('**')) {
              return <h3 key={i} className="text-base font-bold text-gray-900 mt-4">{line.replace(/\*\*/g, '')}</h3>;
            }
            if (line.match(/^\d+\./)) {
              return <h4 key={i} className="font-semibold text-gray-900 mt-3">{line}</h4>;
            }
            return <p key={i} className="text-gray-700">{line}</p>;
          })}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
