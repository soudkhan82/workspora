"use client";

type PurchaseOrderLineItem = {
  id?: string | number;
  line_code?: string | null;
  line_item?: string | null;
  item_description?: string | null;
  description?: string | null;
  uom?: string | null;
  UOM?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  currency?: string | null;
};

export type PurchaseOrderReportData = {
  id?: string | number;
  po_no?: string | null;
  po_number?: string | null;
  po_date?: string | null;
  order_date?: string | null;
  delivery_date?: string | null;

  vendor_name?: string | null;
  vendor?: string | null;

  project_name?: string | null;
  project?: string | null;

  status_name?: string | null;
  status?: string | null;

  currency?: string | null;
  remarks?: string | null;
  notes?: string | null;

  created_at?: string | null;

  line_code?: string | null;
  line_item?: string | null;
  item_description?: string | null;
  description?: string | null;
  uom?: string | null;
  UOM?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;

  line_items?: PurchaseOrderLineItem[];
};

type PurchaseOrderReportProps = {
  po: PurchaseOrderReportData;
  companyName?: string;
  companySubtitle?: string;
  logoText?: string;
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number, currency?: string | null) {
  const safeCurrency = currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${safeCurrency} ${value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  }
}

export default function PurchaseOrderReport({
  po,
  companyName = "Workspora",
  companySubtitle = "Purchase Order Report",
  logoText = "W",
}: PurchaseOrderReportProps) {
  const poNo = po.po_no || po.po_number || `PO-${po.id ?? ""}`;
  const vendor = po.vendor_name || po.vendor || "—";
  const project = po.project_name || po.project || "—";
  const status = po.status_name || po.status || "—";
  const currency = po.currency || "USD";

  const lineItems: PurchaseOrderLineItem[] =
    po.line_items && po.line_items.length > 0
      ? po.line_items
      : [
          {
            line_code: po.line_code,
            line_item: po.line_item,
            item_description: po.item_description,
            description: po.description,
            uom: po.uom || po.UOM,
            quantity: po.quantity,
            unit_price: po.unit_price,
            currency: po.currency,
          },
        ];

  const normalizedItems = lineItems.map((item, index) => {
    const qty = toNumber(item.quantity);
    const unitPrice = toNumber(item.unit_price);
    const itemCurrency = item.currency || currency;
    const rowTotal = qty * unitPrice;

    return {
      sr: index + 1,
      lineCode: item.line_code || "—",
      description:
        item.line_item || item.item_description || item.description || "—",
      uom: item.uom || item.UOM || "—",
      quantity: qty,
      unitPrice,
      currency: itemCurrency,
      rowTotal,
    };
  });

  const total = normalizedItems.reduce((sum, item) => sum + item.rowTotal, 0);

  return (
    <div className="p-8 text-[11px] leading-tight text-slate-950">
      <div className="mb-5 flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-emerald-400">
            {logoText}
          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950">
              {companyName}
            </h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {companySubtitle}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Purchase Order
          </div>
          <div className="mt-1 text-lg font-black text-slate-950">{poNo}</div>
          <div className="mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-700">
            {status}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Vendor Details
          </div>

          <div className="text-sm font-black text-slate-950">{vendor}</div>

          <div className="mt-3 grid grid-cols-[90px_1fr] gap-y-1">
            <div className="font-bold text-slate-500">Project</div>
            <div className="font-semibold text-slate-900">{project}</div>

            <div className="font-bold text-slate-500">Currency</div>
            <div className="font-semibold text-slate-900">{currency}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Order Information
          </div>

          <div className="grid grid-cols-[110px_1fr] gap-y-1">
            <div className="font-bold text-slate-500">PO Date</div>
            <div className="font-semibold text-slate-900">
              {formatDate(po.po_date || po.order_date || po.created_at)}
            </div>

            <div className="font-bold text-slate-500">Delivery Date</div>
            <div className="font-semibold text-slate-900">
              {formatDate(po.delivery_date)}
            </div>

            <div className="font-bold text-slate-500">Status</div>
            <div className="font-semibold text-slate-900">{status}</div>

            <div className="font-bold text-slate-500">Generated</div>
            <div className="font-semibold text-slate-900">
              {formatDate(new Date().toISOString())}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 overflow-hidden rounded-xl border border-slate-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-950 text-white">
              <th className="w-10 px-2 py-2 text-left text-[10px] font-black uppercase">
                #
              </th>
              <th className="w-24 px-2 py-2 text-left text-[10px] font-black uppercase">
                Code
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-black uppercase">
                Item Description
              </th>
              <th className="w-16 px-2 py-2 text-left text-[10px] font-black uppercase">
                UOM
              </th>
              <th className="w-16 px-2 py-2 text-right text-[10px] font-black uppercase">
                Qty
              </th>
              <th className="w-24 px-2 py-2 text-right text-[10px] font-black uppercase">
                Unit Price
              </th>
              <th className="w-28 px-2 py-2 text-right text-[10px] font-black uppercase">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            {normalizedItems.map((item) => (
              <tr
                key={`${item.sr}-${item.lineCode}`}
                className="border-b border-slate-200"
              >
                <td className="px-2 py-2 font-bold text-slate-600">
                  {item.sr}
                </td>
                <td className="px-2 py-2 font-semibold text-slate-800">
                  {item.lineCode}
                </td>
                <td className="px-2 py-2 font-semibold text-slate-950">
                  {item.description}
                </td>
                <td className="px-2 py-2 font-semibold text-slate-700">
                  {item.uom}
                </td>
                <td className="px-2 py-2 text-right font-semibold text-slate-800">
                  {item.quantity.toLocaleString("en-US")}
                </td>
                <td className="px-2 py-2 text-right font-semibold text-slate-800">
                  {formatMoney(item.unitPrice, item.currency)}
                </td>
                <td className="px-2 py-2 text-right font-black text-slate-950">
                  {formatMoney(item.rowTotal, item.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5 flex justify-end">
        <div className="w-72 rounded-xl border border-slate-300 bg-slate-50 p-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-500">Subtotal</span>
            <span className="font-black text-slate-950">
              {formatMoney(total, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-black text-slate-950">
              Grand Total
            </span>
            <span className="text-sm font-black text-emerald-700">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          Notes / Remarks
        </div>
        <p className="min-h-10 text-[11px] font-medium leading-relaxed text-slate-700">
          {po.remarks || po.notes || "No additional remarks provided."}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="h-12 border-b border-slate-400" />
          <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Prepared By
          </div>
        </div>

        <div>
          <div className="h-12 border-b border-slate-400" />
          <div className="mt-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            Approved By
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] font-semibold text-slate-400">
        This is a system-generated purchase order report from Workspora.
      </div>
    </div>
  );
}
