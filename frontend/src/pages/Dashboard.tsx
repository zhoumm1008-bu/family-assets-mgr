import { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchLatestSnapshots, fetchTrend } from '../api';
import type { Snapshot, AssetCategory, SnapshotItem } from '../types';
import { CATEGORY_CONFIG, formatMoney } from '../types';

const CATEGORIES: AssetCategory[] = ['cash', 'stocks', 'funds', 'options', 'insurance', 'other'];

export default function Dashboard() {
  const [latest, setLatest] = useState<Snapshot | null>(null);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [trend, setTrend] = useState<any[]>([]);

  useEffect(() => {
    fetchLatestSnapshots().then((snaps) => {
      if (snaps.length > 0) setLatest(snaps[0]);
      if (snaps.length > 1) setPrevious(snaps[1]);
    });
    fetchTrend().then(setTrend);
  }, []);

  if (!latest) {
    return <Empty description="暂无快照数据，请先创建快照" style={{ marginTop: 100 }} />;
  }

  const growth = previous ? latest.total_amount - previous.total_amount : 0;
  const growthPct = previous && previous.total_amount > 0
    ? ((growth / previous.total_amount) * 100).toFixed(2)
    : null;

  // Pie data
  const pieData = (() => {
    const map: Record<string, number> = {};
    (latest.items || []).forEach((item: SnapshotItem) => {
      map[item.category] = (map[item.category] || 0) + item.amount;
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([cat, val]) => ({
        name: CATEGORY_CONFIG[cat as AssetCategory]?.label || cat,
        value: val,
        color: CATEGORY_CONFIG[cat as AssetCategory]?.color || '#8c8c8c',
      }));
  })();

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>数据大盘</h2>

      {/* Net Worth Card */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="最新总资产" value={latest.total_amount} precision={2} prefix="¥"
              formatter={(val) => formatMoney(Number(val))} />
            <div style={{ color: '#999', marginTop: 4 }}>{latest.date}</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="较上期增长"
              value={Math.abs(growth)}
              precision={2}
              prefix={growth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: growth >= 0 ? '#3f8600' : '#cf1322' }}
              formatter={(val) => formatMoney(Number(val))}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="增长百分比"
              value={growthPct !== null ? Math.abs(Number(growthPct)) : 0}
              precision={2}
              suffix="%"
              prefix={growth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: growth >= 0 ? '#3f8600' : '#cf1322' }}
            />
            {!previous && <div style={{ color: '#999', marginTop: 4 }}>仅有一期数据</div>}
          </Card>
        </Col>
      </Row>

      {/* Trend Chart */}
      {trend.length > 1 && (
        <Card title="资产趋势" style={{ marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              {CATEGORIES.map((cat) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId="1"
                  stroke={CATEGORY_CONFIG[cat].color}
                  fill={CATEGORY_CONFIG[cat].color}
                  fillOpacity={0.6}
                  name={CATEGORY_CONFIG[cat].label}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Allocation Pie */}
      {pieData.length > 0 && (
        <Card title="资产结构占比">
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(1)}%`}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
