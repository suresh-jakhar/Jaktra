import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { invoiceService } from "../../services/invoice";
import { Loader2 } from "lucide-react";
import { getErrorMessage } from "../../utils/error-utils";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateInvoiceModal({ isOpen, onClose }: CreateInvoiceModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    invoiceNo: "",
    clientName: "",
    invoiceAmount: "",
    dueDate: "",
    contactEmail: "",
    subject: "",
  });

  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Parameters<typeof invoiceService.createInvoice>[0]) => invoiceService.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-aging"] });
      onClose();
      setFormData({
        invoiceNo: "",
        clientName: "",
        invoiceAmount: "",
        dueDate: "",
        contactEmail: "",
        subject: "",
      });
      setError(null);
    },
    onError: (err: any) => {
      setError(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.invoiceNo || !formData.clientName || !formData.invoiceAmount || !formData.dueDate || !formData.contactEmail) {
      setError("Please fill out all fields.");
      return;
    }
    
    const payload = {
      ...formData,
      invoiceAmount: parseFloat(formData.invoiceAmount as string),
      subject: formData.subject.trim() || undefined,
    };
    
    // Additional basic validations could go here
    mutation.mutate(payload);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Invoice"
      description="Manually add a single invoice to the system."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="invoiceNo" className="text-sm font-medium text-slate-700">Invoice Number</label>
            <input
              id="invoiceNo"
              name="invoiceNo"
              type="text"
              required
              value={formData.invoiceNo}
              onChange={handleChange}
              placeholder="INV-001"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="dueDate" className="text-sm font-medium text-slate-700">Due Date</label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              required
              value={formData.dueDate}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="clientName" className="text-sm font-medium text-slate-700">Client Name</label>
          <input
            id="clientName"
            name="clientName"
            type="text"
            required
            value={formData.clientName}
            onChange={handleChange}
            placeholder="Acme Corp"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contactEmail" className="text-sm font-medium text-slate-700">Contact Email</label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={formData.contactEmail}
            onChange={handleChange}
            placeholder="billing@acmecorp.com"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="invoiceAmount" className="text-sm font-medium text-slate-700">Amount ($)</label>
          <input
            id="invoiceAmount"
            name="invoiceAmount"
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.invoiceAmount}
            onChange={handleChange}
            placeholder="1500.00"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium text-slate-700">
            Invoice Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="subject"
            name="subject"
            rows={2}
            value={formData.subject}
            onChange={handleChange}
            placeholder="e.g. Web Development Services – Q1 2026"
            maxLength={500}
            className="flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
          />
          <p className="text-xs text-slate-400">What this invoice is for — used to personalise follow-up emails.</p>
        </div>

        <div className="pt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              "Save Invoice"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
