import { format, isValid } from "date-fns";
import { parseAndValidateDate } from "@/utils/dateUtils";
import { useProfile } from "@/context/ProfileContext";

interface InvoiceItem {
  id: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

interface InvoicePdfContentProps {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail?: string;
  customerAddress: string;
  // customerContact?: string; // Removed
  terms: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
  taxRate: number;
  companyLogoUrl?: string;
  invoiceQrCodeSvg?: string;
}

const InvoicePdfContent: React.FC<InvoicePdfContentProps> = ({
  invoiceNumber,
  invoiceDate,
  customerName,
  customerEmail,
  customerAddress,
  terms,
  dueDate,
  items,
  notes,
  taxRate,
  invoiceQrCodeSvg,
}) => {
  const { profile } = useProfile();

  if (!profile || !profile.companyProfile) {
    return <div className="text-center text-red-500">Error: Company profile not loaded.</div>;
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;

  const invoiceDateObj = parseAndValidateDate(invoiceDate);
  const dueDateObj = parseAndValidateDate(dueDate);

  return (
    <div className="bg-white text-gray-900 font-sans text-sm p-[20mm]">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {profile.companyProfile.companyLogoUrl ? (
            <img src={profile.companyProfile.companyLogoUrl} alt="Company Logo" className="max-h-20 object-contain mb-2" style={{ maxWidth: '1.5in' }} />
          ) : (
            <div className="max-h-20 mb-2" style={{ maxWidth: '1.5in' }}></div>
          )}
          <h1 className="text-5xl font-extrabold uppercase tracking-tight mb-2">
            INVOICE
          </h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">DATE: {invoiceDateObj && isValid(invoiceDateObj) ? format(invoiceDateObj, "MMM dd, yyyy") : "N/A"}</p>
          <p className="text-sm font-semibold">INVOICE #: {invoiceNumber}</p>
          {invoiceQrCodeSvg && (
            <div className="mt-2 flex justify-end p-2 bg-white">
              <div dangerouslySetInnerHTML={{ __html: invoiceQrCodeSvg }} className="w-[20mm] h-[20mm] object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* SOLD BY / BILL TO Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-bold mb-2">SOLD BY:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded">
            <p className="font-semibold">{profile.companyProfile.companyName || "Your Company"}</p>
            <p>{profile.companyProfile.companyCurrency || "N/A"}</p>
            <p>{profile.companyProfile.companyAddress?.split('\n')[0] || "N/A"}</p>
            <p>{profile.companyProfile.companyAddress?.split('\n')[1] || ""}</p>
          </div>
        </div>
        <div>
          <p className="font-bold mb-2">BILL TO:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded">
            <p className="font-semibold">{customerName}</p>
            <p>{customerEmail}</p>
            <p>{customerAddress.split('\n')[0]}</p>
            <p>{customerAddress.split('\n')[1]}</p>
          </div>
        </div>
      </div>

      {/* TERMS / DUE Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="font-bold mb-2">TERMS:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded">
            <p>{terms}</p>
          </div>
        </div>
        <div>
          <p className="font-bold mb-2">DUE:</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded">
            <p>{dueDateObj && isValid(dueDateObj) ? format(dueDateObj, "MMM dd, yyyy") : "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100 border border-gray-300">
            <th className="py-2 px-4 text-left font-semibold border-r border-gray-300">Item Description</th>
            <th className="py-2 px-4 text-right font-semibold w-24 border-r border-gray-300">Quantity</th>
            <th className="py-2 px-4 text-right font-semibold w-24 border-r border-gray-300">Unit Price</th>
            <th className="py-2 px-4 text-right font-semibold w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, _index) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-2 px-4 border-r border-gray-200">{item.itemName}</td>
              <td className="py-2 px-4 text-right border-r border-gray-200">{item.quantity}</td>
              <td className="py-2 px-4 text-right border-r border-gray-200">${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="py-2 px-4 text-right">${(item.quantity * item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className="border-b border-gray-200">
              <td className="py-2 px-4 border-r border-gray-200">&nbsp;</td>
              <td className="py-2 px-4 border-r border-gray-200">&nbsp;</td>
              <td className="py-2 px-4 border-r border-gray-200">&nbsp;</td>
              <td className="py-2 px-4">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* New container for Notes and Totals */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Left side: Notes */}
        <div>
          <p className="font-bold mb-2">Notes</p>
          <div className="bg-gray-50 p-3 border border-gray-200 rounded min-h-[80px]">
            <p>{notes}</p>
          </div>
        </div>

        {/* Right side: Totals Summary */}
        <div className="flex flex-col items-end">
          <div className="w-full max-w-xs">
            <div className="flex justify-between py-1">
              <span className="font-bold">Subtotal</span>
              <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-bold">Tax ({taxRate * 100}%)</span>
              <span>${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-300 mt-2">
              <span className="font-bold text-lg">BALANCE DUE</span>
              <span className="font-bold text-lg">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-500 mt-12 text-right">
        <p>eForms.com</p>
      </div>
    </div>
  );
};

export default InvoicePdfContent;