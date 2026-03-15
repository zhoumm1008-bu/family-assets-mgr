import { useEffect, useState } from 'react';
import { Card, Tag, Spin, Button, Descriptions, Modal } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSnapshot, fetchAccounts } from '../api';
import type { Snapshot, AssetCategory, SnapshotItem, AssetAccount } from '../types';
import { CATEGORY_CONFIG, formatMoney } from '../types';

export default function SnapshotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [accounts, setAccounts] = useState<Record<number, AssetAccount>>({});
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<{ item: SnapshotItem; account?: AssetAccount } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSnapshot(Number(id)),
      fetchAccounts(),
    ]).then(([snap, accs]) => {
      setSnapshot(snap);
      const map: Record<number, AssetAccount> = {};
      accs.forEach((a: AssetAccount) => { map[a.id] = a; });
      setAccounts(map);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  if (!snapshot) return <div>快照不存在</div>;

  const grouped: Record<string, SnapshotItem[]> = {};
  (snapshot.items || []).forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  const categoryOrder: AssetCategory[] = ['cash', 'deposit', 'wealth', 'stocks', 'funds', 'options', 'insurance', 'other'];

  const renderItemSummary = (item: SnapshotItem) => {
    const meta = item.meta || {};
    if (item.category === 'stocks' && meta.stock_code) {
      return (
        <span style={{ color: '#999', fontSize: 12 }}>
          {meta.shares}股 × ¥{meta.price}
          {meta.name ? ` · ${meta.name}` : ''}
        </span>
      );
    } else if (item.category === 'funds' && meta.fund_code) {
      return (
        <span style={{ color: '#999', fontSize: 12 }}>
          {meta.shares}份 × ¥{meta.nav}
          {meta.name ? ` · ${meta.name}` : ''}
        </span>
      );
    } else if (item.category === 'options' && meta.shares) {
      return (
        <span style={{ color: '#999', fontSize: 12 }}>
          {meta.shares}股 · 行权价¥{meta.strike_price} · 估价¥{meta.estimated_price}
        </span>
      );
    } else if (item.category === 'insurance') {
      const acc = accounts[item.account_id];
      const accMeta = acc?.meta || {};
      const parts: string[] = [];
      if (accMeta.policyholder) parts.push(accMeta.policyholder);
      if (accMeta.insurance_type) parts.push(accMeta.insurance_type);
      if (meta.policy_year != null) parts.push(`第${meta.policy_year}年`);
      return parts.length > 0 ? <span style={{ color: '#999', fontSize: 12 }}>{parts.join(' · ')}</span> : null;
    } else if (item.category === 'deposit') {
      const acc = accounts[item.account_id];
      const accMeta = acc?.meta || {};
      const parts: string[] = [];
      if (accMeta.deposit_rate) parts.push(`${accMeta.deposit_rate}%`);
      if (accMeta.deposit_term) parts.push(accMeta.deposit_term);
      if (accMeta.maturity_date) parts.push(`到期${accMeta.maturity_date}`);
      return parts.length > 0 ? <span style={{ color: '#999', fontSize: 12 }}>{parts.join(' · ')}</span> : null;
    } else if (item.category === 'wealth') {
      const acc = accounts[item.account_id];
      const accMeta = acc?.meta || {};
      const parts: string[] = [];
      if (accMeta.risk_level) parts.push(accMeta.risk_level);
      if (accMeta.maturity_date) parts.push(`到期${accMeta.maturity_date}`);
      return parts.length > 0 ? <span style={{ color: '#999', fontSize: 12 }}>{parts.join(' · ')}</span> : null;
    }
    return null;
  };

  const renderDetailModal = () => {
    if (!detailItem) return null;
    const { item, account } = detailItem;
    const meta = item.meta || {};
    const accMeta = account?.meta || {};

    return (
      <Modal
        title={item.account_name}
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        footer={
          <Button onClick={() => { setDetailItem(null); navigate('/accounts'); }}>
            前往资产配置
          </Button>
        }
        width={480}
      >
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
          <Descriptions.Item label="资产类别" span={1}>
            <Tag color={CATEGORY_CONFIG[item.category as AssetCategory]?.color}>
              {CATEGORY_CONFIG[item.category as AssetCategory]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="快照金额" span={1}>
            <span style={{ fontWeight: 600 }}>{formatMoney(item.amount)}</span>
          </Descriptions.Item>
        </Descriptions>

        {item.category === 'stocks' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="股票代码">{meta.stock_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="股票名称">{meta.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="持股数">{meta.shares || '-'}</Descriptions.Item>
            <Descriptions.Item label="股价">¥{meta.price || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台" span={2}>{accMeta.platform || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'funds' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="基金代码">{meta.fund_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="基金名称">{meta.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="持有份额">{meta.shares || '-'}</Descriptions.Item>
            <Descriptions.Item label="净值">¥{meta.nav || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台" span={2}>{accMeta.platform || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'options' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="期权股数">{meta.shares || '-'}</Descriptions.Item>
            <Descriptions.Item label="行权价">¥{meta.strike_price || '-'}</Descriptions.Item>
            <Descriptions.Item label="当前估价">¥{meta.estimated_price || '-'}</Descriptions.Item>
            <Descriptions.Item label="内在价值">{formatMoney(item.amount)}</Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'insurance' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="投保人">{accMeta.policyholder || '-'}</Descriptions.Item>
            <Descriptions.Item label="保司">{accMeta.insurer || '-'}</Descriptions.Item>
            <Descriptions.Item label="险种类型">{accMeta.insurance_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="生效日期">{accMeta.start_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="保障期间">{accMeta.coverage_period || '-'}</Descriptions.Item>
            <Descriptions.Item label="基本保额">{accMeta.sum_insured || '-'}</Descriptions.Item>
            <Descriptions.Item label="年缴保费">{accMeta.annual_premium ? `¥${accMeta.annual_premium}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="交费期间">{accMeta.payment_years ? `${accMeta.payment_years}年` : '-'}</Descriptions.Item>
            {accMeta.payment_years && accMeta.start_date && (() => {
              const start = new Date(accMeta.start_date);
              const elapsed = (new Date().getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
              const remaining = Math.max(0, Math.ceil(accMeta.payment_years - elapsed));
              return <Descriptions.Item label="剩余缴费" span={2}>{remaining > 0 ? `${remaining}年` : '已缴清'}</Descriptions.Item>;
            })()}
            <Descriptions.Item label="当前现金价值" span={2}>
              <span style={{ fontWeight: 600 }}>{formatMoney(item.amount)}</span>
              {meta.policy_year != null && <span style={{ color: '#999', marginLeft: 8 }}>（第{meta.policy_year}年）</span>}
            </Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'deposit' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="年利率">{accMeta.deposit_rate ? `${accMeta.deposit_rate}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="存期">{accMeta.deposit_term || '-'}</Descriptions.Item>
            <Descriptions.Item label="起息日">{accMeta.start_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="到期日">{accMeta.maturity_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台" span={2}>{accMeta.platform || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'wealth' && (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="风险等级">{accMeta.risk_level || '-'}</Descriptions.Item>
            <Descriptions.Item label="到期日">{accMeta.maturity_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="平台" span={2}>{accMeta.platform || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {item.category === 'cash' && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="平台">{accMeta.platform || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/snapshots')}>返回</Button>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, marginRight: 16 }}>{snapshot.date}</span>
            {snapshot.notes && <span style={{ color: '#999' }}>{snapshot.notes}</span>}
          </div>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(snapshot.total_amount)}</span>
        </div>
      </Card>

      {categoryOrder
        .filter((cat) => grouped[cat])
        .map((cat) => {
          const items = grouped[cat];
          const cfg = CATEGORY_CONFIG[cat];
          const subtotal = items.reduce((s, i) => s + i.amount, 0);
          const pct = snapshot.total_amount > 0 ? (subtotal / snapshot.total_amount * 100).toFixed(1) : '0';
          return (
            <Card
              key={cat}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <Tag color={cfg.color}>{cfg.label}</Tag>
                    <span style={{ color: '#999', fontSize: 13, fontWeight: 400 }}>{items.length}项 · 占比{pct}%</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
                </div>
              }
              size="small"
              style={{ marginBottom: 12 }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setDetailItem({ item, account: accounts[item.account_id] })}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <span style={{ fontWeight: 500 }}>{item.account_name}</span>
                    <InfoCircleOutlined style={{ color: '#bbb', marginLeft: 6, fontSize: 12 }} />
                    <div>{renderItemSummary(item)}</div>
                  </div>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{formatMoney(item.amount)}</span>
                </div>
              ))}
            </Card>
          );
        })}

      {renderDetailModal()}
    </div>
  );
}
