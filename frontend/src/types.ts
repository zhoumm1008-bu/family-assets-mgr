export type AssetCategory = 'cash' | 'deposit' | 'wealth' | 'stocks' | 'funds' | 'options' | 'insurance' | 'other';

export interface AccountMeta {
  // common
  platform?: string;    // e.g. 天天基金、明亚、富途、招商银行
  // stocks
  stock_code?: string;  // e.g. sh600519, sz000001, hk00700, gb_aapl
  shares?: number;
  // funds
  fund_code?: string;   // e.g. 110011
  // options
  strike_price?: number;
  estimated_price?: number;
  // insurance
  cash_value?: number;
  annual_premium?: number;
  start_date?: string;           // 保单生效日期，如 2024-01-15
  cash_value_table?: number[];   // 现金价值表，按保单年度排列 [第1年末, 第2年末, ...]
  policyholder?: string;         // 投保人
  insurer?: string;              // 保司
  insurance_type?: string;       // 险种类型（增额终身寿/养老年金/重疾）
  coverage_period?: string;      // 保障期间（终身/至106周岁等）
  sum_insured?: string;          // 基本保额
  payment_years?: number;        // 交费期间（年数）
  policy_no?: string;            // 保单号
  // deposit (定期)
  deposit_rate?: number;         // 年利率(%)
  deposit_term?: string;         // 存期（如：1年、3年、5年）
  maturity_date?: string;        // 到期日
  // wealth (理财)
  risk_level?: string;           // 风险等级（R1/R2/R3/R4/R5）
}

export interface AssetAccount {
  id: number;
  name: string;
  category: AssetCategory;
  enabled: number; // 0 or 1
  sort_order: number;
  meta: AccountMeta;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: number;
  date: string;
  total_amount: number;
  notes: string;
  created_at: string;
  items?: SnapshotItem[];
}

export interface SnapshotItem {
  id: number;
  snapshot_id: number;
  account_id: number;
  account_name: string;
  category: AssetCategory;
  amount: number;
  meta?: Record<string, any>;
}

export const CATEGORY_CONFIG: Record<AssetCategory, { label: string; color: string }> = {
  cash: { label: '现金', color: '#52c41a' },
  deposit: { label: '定期', color: '#389e0d' },
  wealth: { label: '理财', color: '#d48806' },
  stocks: { label: '股票', color: '#1677ff' },
  funds: { label: '基金', color: '#722ed1' },
  options: { label: '期权', color: '#fa8c16' },
  insurance: { label: '保险', color: '#13c2c2' },
  other: { label: '其他', color: '#8c8c8c' },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}));

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}
