export type PrinterType = 'thermal_escpos' | 'browser' | 'dot_matrix';

export type PrinterConnection =
  | 'usb'
  | 'bluetooth'
  | 'lan'
  | 'wifi'
  | 'browser'
  | 'qz_tray'
  | 'local_service';

export type PaperWidth = '58mm' | '80mm' | 'custom';

export interface PrinterProfile {
  id: string;
  name: string;
  type: PrinterType;
  connection: PrinterConnection;
  paperWidth: PaperWidth;
  charsPerLine: number;
  encoding?: string;
  cutter?: boolean;
  cashDrawer?: boolean;
  openDrawerBeforePrint?: boolean;
  openDrawerAfterPrint?: boolean;
  ipAddress?: string;
  port?: number;
  printerName?: string;
}

export interface ReceiptStore {
  name: string;
  title?: string;
  logoUrl?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  headerText?: string;
  footer?: string;
}

export interface ReceiptTransaction {
  invoiceNo: string;
  date: string;
  orderId?: string;
  cashier?: string;
  customer?: string;
  paymentStatus?: string;
  notes?: string;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  discount?: number;
  total: number;
  size?: string;
  material?: string;
  finishing?: string;
  lbMax?: string;
  notes?: string;
  pages?: number;
}

export interface ReceiptSummary {
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  grandTotal: number;
  paid?: number;
  change?: number;
  remainingDue?: number;
}

export interface ReceiptPayment {
  method: string;
  amount: number;
  targetAccount?: string;
}

export interface ReceiptLayout {
  showOrderId?: boolean;
  showCashier?: boolean;
  showCustomer?: boolean;
  showPaymentDetail?: boolean;
}

export interface ReceiptData {
  store: ReceiptStore;
  transaction: ReceiptTransaction;
  items: ReceiptItem[];
  summary: ReceiptSummary;
  payment?: ReceiptPayment;
  layout?: ReceiptLayout;
  qrCode?: string;
  barcode?: string;
}

export interface PrintAdapter {
  print(data: Uint8Array | string, profile: PrinterProfile): Promise<void>;
}

export interface BrowserPrintOptions {
  title?: string;
  document?: Document;
  windowRef?: Window;
  logoUrl?: string;
  hideTitleText?: boolean;
  titleText?: string;
}

export interface LocalServiceOptions {
  endpoint: string;
  headers?: Record<string, string>;
}
