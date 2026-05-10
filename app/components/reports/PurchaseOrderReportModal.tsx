"use client";

import ReportShell from "./ReportShell";
import PurchaseOrderReport, {
  PurchaseOrderReportData,
} from "./PurchaseOrderReport";

type PurchaseOrderReportModalProps = {
  open: boolean;
  po: PurchaseOrderReportData | null;
  onClose: () => void;
};

export default function PurchaseOrderReportModal({
  open,
  po,
  onClose,
}: PurchaseOrderReportModalProps) {
  if (!po) return null;

  const poNo = po.po_no || po.po_number || `PO-${po.id ?? ""}`;

  return (
    <ReportShell
      open={open}
      title={`Purchase Order Report - ${poNo}`}
      onClose={onClose}
      printAreaId="purchase-order-report-print-area"
    >
      <PurchaseOrderReport
        po={po}
        companyName="Workspora"
        companySubtitle="Purchase Order Report"
        logoText="W"
      />
    </ReportShell>
  );
}
