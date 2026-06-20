import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { invoiceService } from "../../services/invoice";
import { Upload, FileUp, XCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { getErrorMessage } from "../../utils/error-utils";

interface ImportInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportInvoiceModal({ isOpen, onClose }: ImportInvoiceModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [strategy, setStrategy] = useState<'skip' | 'update'>('skip');
  const [preview, setPreview] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: any[];
  } | null>(null);

  const resetState = () => {
    setFile(null);
    setPreview([]);
    setPreviewHeaders([]);
    setError(null);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => invoiceService.importInvoices(file!, strategy),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-aging"] });
      setImportResult(data);
    },
    onError: (err: any) => {
      setError(getErrorMessage(err));
    },
  });

  const processFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['csv', 'xlsx', 'xls'];

    if (!ext || !allowedExtensions.includes(ext)) {
      setError("Only CSV and Excel (.xlsx, .xls) files are supported.");
      return;
    }
    setError(null);
    setFile(selectedFile);

    if (ext === 'csv') {
      // Preview CSV
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
        complete: (results) => {
          if (results.meta.fields) {
            setPreviewHeaders(results.meta.fields);
          }
          setPreview(results.data);
        },
        error: (err) => {
          setError("Failed to parse CSV preview: " + getErrorMessage(err));
        }
      });
    } else {
      // Excel file, skip client-side preview to avoid heavy package bundling
      setPreview([]);
      setPreviewHeaders([]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;
    mutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Invoices"
      description={!importResult ? "Upload a CSV or Excel file containing your invoices." : undefined}
      className="max-w-2xl"
    >
      {importResult ? (
        <div className="space-y-6">
          <div className="bg-green-50 text-green-800 p-6 rounded-lg border border-green-200 text-center flex flex-col items-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Import Complete</h3>
            <p className="text-green-700">
              Successfully processed your invoice file.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-center">
              <div className="text-2xl font-bold text-slate-800">{importResult.imported}</div>
              <div className="text-sm text-slate-500 font-medium">Imported</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-center">
              <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
              <div className="text-sm text-blue-500 font-medium">Updated</div>
            </div>
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200 text-center">
              <div className="text-2xl font-bold text-amber-600">{importResult.skipped}</div>
              <div className="text-sm text-amber-600 font-medium">Skipped</div>
            </div>
          </div>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-red-800 flex items-center mb-2">
                <AlertCircle className="w-4 h-4 mr-1.5" /> Errors ({importResult.errors.length})
              </h4>
              <div className="bg-red-50 p-3 rounded-md border border-red-100 max-h-32 overflow-y-auto">
                <ul className="text-xs text-red-700 space-y-1">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="font-semibold w-12 flex-shrink-0">Row {err.row}:</span>
                      <span>{err.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-start">
              <XCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
              }`}
              onClick={() => document.getElementById("csv-upload")?.click()}
            >
              <input
                id="csv-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">Click to upload or drag and drop</p>
              <p className="text-xs text-slate-500">CSV and Excel files only. Required columns: invoice_no, client_name, invoice_amount, due_date, contact_email</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-slate-50">
                <div className="flex items-center overflow-hidden">
                  <FileUp className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-900 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetState}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {preview.length === 0 && file && (
                <div className="p-3 bg-blue-50 text-blue-800 border border-blue-100 rounded-md text-xs">
                  <strong>Note:</strong> Client-side preview is not available for Excel spreadsheets, but the file is loaded and ready to upload and process.
                </div>
              )}

              {preview.length > 0 && (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                    Data Preview (First 5 Rows)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {previewHeaders.map((header, i) => (
                            <th key={i} className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {preview.map((row, i) => (
                          <tr key={i}>
                            {previewHeaders.map((header, j) => (
                              <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap truncate max-w-[150px]" title={row[header]}>
                                {row[header] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-slate-900">Duplicate Handling Strategy</label>
                <div className="flex gap-4">
                  <label className="flex items-center text-sm">
                    <input
                      type="radio"
                      name="strategy"
                      value="skip"
                      checked={strategy === 'skip'}
                      onChange={() => setStrategy('skip')}
                      className="mr-2 text-blue-600 focus:ring-blue-600"
                    />
                    Skip existing (ignore)
                  </label>
                  <label className="flex items-center text-sm">
                    <input
                      type="radio"
                      name="strategy"
                      value="update"
                      checked={strategy === 'update'}
                      onChange={() => setStrategy('update')}
                      className="mr-2 text-blue-600 focus:ring-blue-600"
                    />
                    Update existing records
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={mutation.isPending}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                    </>
                  ) : (
                    "Upload and Process"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
