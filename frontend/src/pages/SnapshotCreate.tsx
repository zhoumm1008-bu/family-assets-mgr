import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, Button, DatePicker, Input, InputNumber, message, Empty, Spin, Tag, Tooltip } from 'antd';
import { SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { fetchAccounts, fetchLatestSnapshots, createSnapshot, fetchBatchQuotes } from '../api';
import type { AssetAccount, AssetCategory, SnapshotItem } from '../types';
import { CATEGORY_CONFIG, formatMoney } from '../types';

export default function SnapshotCreate() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [lastValues, setLastValues] = useState<Record<number, number>>({});
  const [amounts, setAmounts] = useState<Record<number, number>>({});
  const [itemMetas, setItemMetas] = useState<Record<number, Record<string, any>>>({});
  const [date, setDate] = useState(dayjs());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [priceInfo, setPriceInfo] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchAccounts().then((all) => setAccounts(all.filter((a: AssetAccount) => a.enabled)));
    fetchLatestSnapshots().then((snaps) => {
      if (snaps.length > 0 && snaps[0].items) {
        const map: Record<number, number> = {};
        snaps[0].items.forEach((item: SnapshotItem) => {
          map[item.account_id] = item.amount;
        });
        setLastValues(map);
      }
    });
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, AssetAccount[]> = {};
    accounts.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [accounts]);

  const total = useMemo(() => {
    return Object.values(amounts).reduce((s, v) => s + (v || 0), 0);
  }, [amounts]);

  const categoryTotal = (cat: string) => {
    return (grouped[cat] || []).reduce((s, a) => s + (amounts[a.id] || 0), 0);
  };

  // Fetch real-time prices for stocks and funds
  const handleFetchPrices = useCallback(async () => {
    const stockCodes: string[] = [];
    const fundCodes: string[] = [];
    const stockAccountMap: Record<string, AssetAccount[]> = {};
    const fundAccountMap: Record<string, AssetAccount[]> = {};

    accounts.forEach((a) => {
      const meta = a.meta || {};
      if (a.category === 'stocks' && meta.stock_code) {
        stockCodes.push(meta.stock_code);
        if (!stockAccountMap[meta.stock_code]) stockAccountMap[meta.stock_code] = [];
        stockAccountMap[meta.stock_code].push(a);
      } else if (a.category === 'funds' && meta.fund_code) {
        fundCodes.push(meta.fund_code);
        if (!fundAccountMap[meta.fund_code]) fundAccountMap[meta.fund_code] = [];
        fundAccountMap[meta.fund_code].push(a);
      }
    });

    if (stockCodes.length === 0 && fundCodes.length === 0) {
      message.info('没有需要自动获取价格的资产项');
      return;
    }

    setFetchingPrices(true);
    try {
      const result = await fetchBatchQuotes({
        stocks: [...new Set(stockCodes)],
        funds: [...new Set(fundCodes)],
      });

      const newAmounts: Record<number, number> = { ...amounts };
      const newMetas: Record<number, Record<string, any>> = { ...itemMetas };
      const newPriceInfo: Record<string, any> = { ...priceInfo };

      // Process stock quotes
      if (result.stocks) {
        Object.entries(result.stocks).forEach(([code, quote]: [string, any]) => {
          newPriceInfo[code] = quote;
          if (quote.price != null && stockAccountMap[code]) {
            stockAccountMap[code].forEach((acc) => {
              const shares = acc.meta?.shares || 0;
              const amount = shares * quote.price;
              newAmounts[acc.id] = Math.round(amount * 100) / 100;
              newMetas[acc.id] = { stock_code: code, shares, price: quote.price, name: quote.name };
            });
          }
        });
      }

      // Process fund quotes
      if (result.funds) {
        Object.entries(result.funds).forEach(([code, quote]: [string, any]) => {
          newPriceInfo[code] = quote;
          if (fundAccountMap[code]) {
            fundAccountMap[code].forEach((acc) => {
              const shares = acc.meta?.shares || 0;
              const nav = quote.estimated_nav || quote.nav;
              if (nav != null) {
                const amount = shares * nav;
                newAmounts[acc.id] = Math.round(amount * 100) / 100;
                newMetas[acc.id] = { fund_code: code, shares, nav, name: quote.name };
              }
            });
          }
        });
      }

      setAmounts((prev) => ({ ...prev, ...newAmounts }));
      setItemMetas((prev) => ({ ...prev, ...newMetas }));
      setPriceInfo((prev) => ({ ...prev, ...newPriceInfo }));
      message.success('价格获取成功');
    } catch {
      message.error('价格获取失败，请检查网络');
    } finally {
      setFetchingPrices(false);
    }
  }, [accounts, amounts, itemMetas, priceInfo]);

  // Auto-fetch on first load when accounts are ready
  useEffect(() => {
    if (accounts.length > 0) {
      const hasQuotable = accounts.some(
        (a) => (a.category === 'stocks' && a.meta?.stock_code) || (a.category === 'funds' && a.meta?.fund_code)
      );
      if (hasQuotable) {
        handleFetchPrices();
      }

      // Pre-fill options and insurance from meta
      const newAmounts: Record<number, number> = {};
      const newMetas: Record<number, Record<string, any>> = {};
      const snapshotDate = date.toDate();
      accounts.forEach((a) => {
        const meta = a.meta || {};
        if (a.category === 'options' && meta.shares && meta.estimated_price != null && meta.strike_price != null) {
          const intrinsic = Math.max(0, meta.estimated_price - meta.strike_price) * meta.shares;
          newAmounts[a.id] = Math.round(intrinsic * 100) / 100;
          newMetas[a.id] = { shares: meta.shares, strike_price: meta.strike_price, estimated_price: meta.estimated_price };
        } else if (a.category === 'insurance') {
          let cashValue = meta.cash_value;
          let policyYear: number | undefined;
          // Auto-calculate from cash_value_table if available
          if (meta.cash_value_table && meta.start_date) {
            const startDate = new Date(meta.start_date);
            const diffMs = snapshotDate.getTime() - startDate.getTime();
            const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
            const completedYears = Math.floor(diffYears);
            policyYear = completedYears;
            if (completedYears < 1 && meta.cash_value_table.length > 0) {
              // First year: interpolate between 0 and year-1 value
              cashValue = Math.round(meta.cash_value_table[0] * diffYears * 100) / 100;
            } else if (completedYears >= 1 && completedYears <= meta.cash_value_table.length) {
              cashValue = meta.cash_value_table[completedYears - 1];
            } else if (completedYears > meta.cash_value_table.length) {
              cashValue = meta.cash_value_table[meta.cash_value_table.length - 1];
            }
          }
          if (cashValue != null) {
            newAmounts[a.id] = cashValue;
            newMetas[a.id] = { cash_value: cashValue, annual_premium: meta.annual_premium, policy_year: policyYear };
          }
        }
      });
      if (Object.keys(newAmounts).length > 0) {
        setAmounts((prev) => ({ ...newAmounts, ...prev }));
        setItemMetas((prev) => ({ ...newMetas, ...prev }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const handleSubmit = async () => {
    const items = accounts.map((a) => ({
      account_id: a.id,
      account_name: a.name,
      category: a.category,
      amount: amounts[a.id] || 0,
      meta: itemMetas[a.id] || {},
    }));
    setSubmitting(true);
    try {
      await createSnapshot({ date: date.format('YYYY-MM-DD'), notes, items });
      message.success('快照保存成功');
      navigate('/snapshots');
    } catch {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div>
        <h2>新建快照</h2>
        <Empty description="暂无启用的资产项，请先在「资产配置」中添加">
          <Button type="primary" onClick={() => navigate('/accounts')}>去添加</Button>
        </Empty>
      </div>
    );
  }

  const renderPriceTag = (a: AssetAccount) => {
    const meta = a.meta || {};
    if (a.category === 'stocks' && meta.stock_code) {
      const info = priceInfo[meta.stock_code];
      if (info?.price != null) {
        const color = (info.change_pct || 0) >= 0 ? '#cf1322' : '#3f8600';
        return (
          <Tooltip title={`${info.name} | ${meta.shares}股 × ¥${info.price}`}>
            <Tag color={color} style={{ fontSize: 11 }}>
              ¥{info.price} ({info.change_pct > 0 ? '+' : ''}{info.change_pct}%)
            </Tag>
          </Tooltip>
        );
      }
    } else if (a.category === 'funds' && meta.fund_code) {
      const info = priceInfo[meta.fund_code];
      if (info) {
        const nav = info.estimated_nav || info.nav;
        return (
          <Tooltip title={`${info.name} | ${meta.shares}份 × ¥${nav}`}>
            <Tag color="purple" style={{ fontSize: 11 }}>净值 ¥{nav}</Tag>
          </Tooltip>
        );
      }
    } else if (a.category === 'options') {
      if (meta.shares && meta.strike_price != null) {
        return (
          <Tag color="orange" style={{ fontSize: 11 }}>
            {meta.shares}股 | 行权价 ¥{meta.strike_price}
          </Tag>
        );
      }
    } else if (a.category === 'insurance') {
      const itemMeta = itemMetas[a.id];
      if (itemMeta?.policy_year != null) {
        return (
          <Tooltip title={`保单第${itemMeta.policy_year}年，现金价值根据价值表自动计算`}>
            <Tag color="cyan" style={{ fontSize: 11 }}>第{itemMeta.policy_year}年</Tag>
          </Tooltip>
        );
      } else if (meta.annual_premium) {
        return <Tag color="cyan" style={{ fontSize: 11 }}>年缴 ¥{meta.annual_premium}</Tag>;
      }
    }
    return null;
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>新建快照</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button
            icon={fetchingPrices ? <SyncOutlined spin /> : <CheckCircleOutlined />}
            onClick={handleFetchPrices}
            loading={fetchingPrices}
          >
            {fetchingPrices ? '获取中...' : '刷新实时价格'}
          </Button>
          <DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} />
        </div>
      </div>

      {fetchingPrices && <Spin tip="正在获取实时价格..." style={{ display: 'block', margin: '20px 0' }} />}

      {Object.entries(grouped).map(([cat, accs]) => {
        const cfg = CATEGORY_CONFIG[cat as AssetCategory];
        return (
          <Card
            key={cat}
            title={
              <span>
                {cfg.label}{' '}
                <span style={{ color: '#999', fontSize: 14, fontWeight: 400 }}>
                  小计: {formatMoney(categoryTotal(cat))}
                </span>
              </span>
            }
            size="small"
            style={{ marginBottom: 16 }}
            headStyle={{ background: '#fafafa' }}
          >
            {accs.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap', gap: '4px 0' }}>
                <div style={{ width: 160, fontWeight: 500 }}>{a.name}</div>
                <div style={{ width: 120 }}>{renderPriceTag(a)}</div>
                <div style={{ width: 140, color: '#999', fontSize: 13 }}>
                  上期: {lastValues[a.id] !== undefined ? formatMoney(lastValues[a.id]) : '-'}
                </div>
                <InputNumber
                  style={{ width: 200 }}
                  placeholder="当前估值"
                  value={amounts[a.id]}
                  onChange={(val) => setAmounts((prev) => ({ ...prev, [a.id]: val || 0 }))}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value?.replace(/,/g, '') || 0)}
                  precision={2}
                />
              </div>
            ))}
          </Card>
        );
      })}

      <Card style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700 }}>总资产: {formatMoney(total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input
              placeholder="备注（可选）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: 250 }}
            />
            <Button onClick={() => navigate('/snapshots')}>取消</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              保存快照
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
