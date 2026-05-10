"use client";

import { ReactNode } from "react";
import { X, Download } from "lucide-react";

type ReportShellProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  printAreaId: string;
};

export default function ReportShell({
  open,
  title,
  children,
  onClose,
  printAreaId,
}: ReportShellProps) {
  if (!open) return null;

  const handleDownloadPdf = () => {
    const previousTitle = document.title;
    document.title = title || "Report";

    setTimeout(() => {
      window.print();
      document.title = previousTitle;
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl flex-col p-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-2xl">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-xs text-slate-400">
              Preview the report and download it as PDF
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div
            id={printAreaId}
            className="mx-auto min-h-[1122px] w-full max-w-[794px] bg-white text-slate-950 shadow-2xl"
          >
            {children}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #${printAreaId}, #${printAreaId} * {
            visibility: visible !important;
          }

          #${printAreaId} {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: auto !important;
            box-shadow: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
