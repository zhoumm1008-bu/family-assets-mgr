import { useEffect, useState } from 'react';
import { Card, Button, Tag, message, Popconfirm, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { fetchSnapshots, deleteSnapshot } from '../api';
import type { AssetCategory } from '../types';
import { CATEGORY_CONFIG, formatMoney } from '../types';

export default function Snapshots() {
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setSnapshots(await fetchSnapshots());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    await deleteSnapshot(id);
    message.success('已删除');
    load();
  };

  if (!loading && snapshots.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>快照记录</h2>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/snapshots/new')}>新建快照</Button>
        </div>
        <Empty description="暂无快照记录" />
      </div>
    );
  }

  const categoryOrder: AssetCategory[] = ['cash', 'deposit', 'wealth', 'stocks', 'funds', 'options', 'insurance', 'other'];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>快照记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/snapshots/new')}>新建快照</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {snapshots.map((snap) => {
          const cats = snap.categories || {};
          return (
            <Card
              key={snap.id}
              hoverable
              size="small"
              onClick={() => navigate(`/snapshots/${snap.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{snap.date}</span>
                  {snap.notes && <span style={{ color: '#999', marginLeft: 12, fontSize: 13 }}>{snap.notes}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{formatMoney(snap.total_amount)}</span>
                  <Popconfirm
                    title="确定删除此快照？"
                    onConfirm={(e) => { e?.stopPropagation(); handleDelete(snap.id); }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {categoryOrder
                  .filter((cat) => cats[cat])
                  .map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    return (
                      <Tag key={cat} color={cfg.color} style={{ fontSize: 12 }}>
                        {cfg.label} {formatMoney(cats[cat].total)}
                      </Tag>
                    );
                  })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
