import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
    getInvoiceableCustomers,
    InvoiceableCustomer,
} from "../../api/quickbooks/auth/customer";
import {
    CreateInvoiceParams,
    createQuickBooksInvoice,
    InvoiceLineItem
} from "../../api/quickbooks/auth/invoice";
import SubmitButton from "../../common/components/form/SubmitButton";
import { UserContext } from "../../common/contexts/UserContext";

// shape for rows from your `quickbooks_invoices` table
type SavedInvoice = {
  id: string;
  customer_id: string;
  line_items: {
    Id?: string;
    Amount: number;
    LineNum?: number;
    DetailType: string;
    Description?: string;
    SalesItemLineDetail?: {
      Qty: number;
      ItemRef: {
        name: string;
        value: string;
      };
      UnitPrice: number;
    };
  }[];
  due_date: string;
  memo: string;
  status: string;
  created_at: string;
  updated_at: string;
};

// local form–item
type LocalLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export default function InvoicesPage() {
  const { user, isLoading: authLoading } = useContext(UserContext);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [customers, setCustomers] = useState<Record<string, InvoiceableCustomer>>({});
  const [loadingInv, setLoadingInv] = useState(false);
  const [loadingCust, setLoadingCust] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // ... rest of InvoicesPage component ...

  return (
    <div className="p-4">
      {/* ... rest of InvoicesPage JSX ... */}
      <CreateInvoiceModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          fetchInvoices();
        }}
      />
    </div>
  );
}

function CreateInvoiceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<InvoiceableCustomer[]>([]);
  const [loadingCust, setLoadingCust] = useState(false);
  const [selected, setSelected] = useState<InvoiceableCustomer | null>(null);
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingCust(true);
    getInvoiceableCustomers()
      .then(setCustomers)
      .catch((err) => toast.error(`Could not load customers: ${err.message}`))
      .finally(() => setLoadingCust(false));
  }, [open]);

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  const changeLine = (
    idx: number,
    key: keyof LocalLineItem,
    value: string | number
  ) =>
    setLineItems((cur) =>
      cur.map((li, i) => (i === idx ? { ...li, [key]: value } : li))
    );

  const addLine = () =>
    setLineItems((cur) => [
      ...cur,
      { description: "", quantity: 1, unitPrice: 0 },
    ]);

  const removeLine = (idx: number) =>
    setLineItems((cur) => cur.filter((_, i) => i !== idx));

  const total = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );

  const onSubmit = async () => {
    if (!selected) return toast.error("Please select a customer.");
    if (!dueDate) return toast.error("Please pick a due date.");
    if (
      lineItems.some(
        (li) => !li.description || li.quantity < 1 || li.unitPrice < 0
      )
    )
      return toast.error("Please complete all line items.");

    const apiLines: InvoiceLineItem[] = lineItems.map((li) => ({
      DetailType: "SalesItemLineDetail",
      Amount: li.quantity * li.unitPrice,
      Description: li.description,
      SalesItemLineDetail: {
        ItemRef: { value: "19" },
        UnitPrice: li.unitPrice,
        Qty: li.quantity,
      },
    }));

    const params: CreateInvoiceParams = {
      userId: 'admin',  // Add this line to include the required userId
      internalCustomerId: selected.id,
      lineItems: apiLines,
      dueDate,
      memo,
    };

    try {
      const response = await createQuickBooksInvoice(params);
      toast.success(`Invoice #${response.DocNumber} created for ${response.CustomerRef.name}`);
      onClose();
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      toast.error(err.message || "Failed to create invoice");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        {/* ... rest of modal JSX ... */}
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" onClick={onClose}>
            Cancel
          </button>
          <SubmitButton onClick={onSubmit}>Create Invoice</SubmitButton>
        </div>
      </div>
    </div>
  );
} 