import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, message, Divider, Popconfirm, Space, DatePicker, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined, HolderOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchAccounts, createAccount, updateAccount, toggleAccount, deleteAccount, reorderAccounts } from '../api';
import type { AssetAccount, AssetCategory } from '../types';
import { CATEGORY_CONFIG, CATEGORY_OPTIONS } from '../types';

// Sortable row component for Ant Design Table
function SortableRow(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props['data-row-key'],
  });
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999, background: '#fafafa' } : {}),
  };
  return <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<AssetAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetAccount | null>(null);
  const [form] = Form.useForm();
  const selectedCategory = Form.useWatch('category', form) as AssetCategory | undefined;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await fetchAccounts());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: AssetAccount) => {
    setEditing(record);
    const meta = record.meta || {};
    form.setFieldsValue({
      name: record.name,
      category: record.category,
      platform: meta.platform,
      stock_code: meta.stock_code,
      shares: meta.shares,
      fund_code: meta.fund_code,
      strike_price: meta.strike_price,
      estimated_price: meta.estimated_price,
      cash_value: meta.cash_value,
      annual_premium: meta.annual_premium,
      start_date: meta.start_date ? dayjs(meta.start_date) : undefined,
      cash_value_table_text: meta.cash_value_table ? meta.cash_value_table.join('\n') : '',
      policyholder: meta.policyholder,
      insurer: meta.insurer,
      insurance_type: meta.insurance_type,
      coverage_period: meta.coverage_period,
      sum_insured: meta.sum_insured,
      payment_years: meta.payment_years,
      deposit_rate: meta.deposit_rate,
      deposit_term: meta.deposit_term,
      maturity_date: meta.maturity_date ? dayjs(meta.maturity_date) : undefined,
      risk_level: meta.risk_level,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { name, category, platform, stock_code, shares, fund_code, strike_price, estimated_price, cash_value, annual_premium, start_date, cash_value_table_text, policyholder, insurer, insurance_type, coverage_period, sum_insured, payment_years, deposit_rate, deposit_term, maturity_date, risk_level } = values;

    const meta: Record<string, any> = {};
    if (platform) meta.platform = platform;
    if (category === 'stocks') {
      if (stock_code) meta.stock_code = stock_code;
      if (shares != null) meta.shares = shares;
    } else if (category === 'funds') {
      if (fund_code) meta.fund_code = fund_code;
      if (shares != null) meta.shares = shares;
    } else if (category === 'options') {
      if (shares != null) meta.shares = shares;
      if (strike_price != null) meta.strike_price = strike_price;
      if (estimated_price != null) meta.estimated_price = estimated_price;
    } else if (category === 'insurance') {
      if (cash_value != null) meta.cash_value = cash_value;
      if (annual_premium != null) meta.annual_premium = annual_premium;
      if (start_date) meta.start_date = start_date.format('YYYY-MM-DD');
      if (cash_value_table_text) {
        const table = cash_value_table_text
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line !== '')
          .map((line: string) => parseFloat(line));
        if (table.length > 0 && table.every((v: number) => !isNaN(v))) {
          meta.cash_value_table = table;
        }
      }
      if (policyholder) meta.policyholder = policyholder;
      if (insurer) meta.insurer = insurer;
      if (insurance_type) meta.insurance_type = insurance_type;
      if (coverage_period) meta.coverage_period = coverage_period;
      if (sum_insured) meta.sum_insured = sum_insured;
      if (payment_years != null) meta.payment_years = payment_years;
    } else if (category === 'deposit') {
      if (deposit_rate != null) meta.deposit_rate = deposit_rate;
      if (deposit_term) meta.deposit_term = deposit_term;
      if (start_date) meta.start_date = start_date.format('YYYY-MM-DD');
      if (maturity_date) meta.maturity_date = maturity_date.format('YYYY-MM-DD');
    } else if (category === 'wealth') {
      if (risk_level) meta.risk_level = risk_level;
      if (maturity_date) meta.maturity_date = maturity_date.format('YYYY-MM-DD');
    }

    if (editing) {
      await updateAccount(editing.id, { name, category, sort_order: editing.sort_order, meta });
      message.success('修改成功');
    } else {
      await createAccount({ name, category, sort_order: accounts.length, meta });
      message.success('添加成功');
    }
    setModalOpen(false);
    load();
  };

  const handleToggle = async (id: number) => {
    await toggleAccount(id);
    load();
  };

  const handleDelete = async (id: number) => {
    await deleteAccount(id);
    message.success('已删除');
    load();
  };

  const handleCopy = (record: AssetAccount) => {
    setEditing(null);
    form.resetFields();
    const meta = record.meta || {};
    form.setFieldsValue({
      name: record.name + '（副本）',
      category: record.category,
      platform: '',
      stock_code: meta.stock_code,
      shares: meta.shares,
      fund_code: meta.fund_code,
      strike_price: meta.strike_price,
      estimated_price: meta.estimated_price,
      cash_value: meta.cash_value,
      annual_premium: meta.annual_premium,
      start_date: meta.start_date ? dayjs(meta.start_date) : undefined,
      cash_value_table_text: meta.cash_value_table ? meta.cash_value_table.join('\n') : '',
      policyholder: meta.policyholder,
      insurer: meta.insurer,
      insurance_type: meta.insurance_type,
      coverage_period: meta.coverage_period,
      sum_insured: meta.sum_insured,
      payment_years: meta.payment_years,
      deposit_rate: meta.deposit_rate,
      deposit_term: meta.deposit_term,
      maturity_date: meta.maturity_date ? dayjs(meta.maturity_date) : undefined,
      risk_level: meta.risk_level,
    });
    setModalOpen(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = accounts.findIndex((a) => a.id === active.id);
    const newIndex = accounts.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally first for instant feedback
    const newAccounts = [...accounts];
    const [moved] = newAccounts.splice(oldIndex, 1);
    newAccounts.splice(newIndex, 0, moved);
    setAccounts(newAccounts);

    // Persist to backend
    const items = newAccounts.map((a, idx) => ({ id: a.id, sort_order: idx }));
    await reorderAccounts(items);
  };

  const renderMetaInfo = (record: AssetAccount) => {
    const meta = record.meta || {};
    const parts: string[] = [];
    if (meta.platform) parts.push(`平台: ${meta.platform}`);
    if (record.category === 'stocks' && meta.stock_code) {
      parts.push(`代码: ${meta.stock_code}`);
      if (meta.shares) parts.push(`${meta.shares}股`);
    } else if (record.category === 'funds' && meta.fund_code) {
      parts.push(`代码: ${meta.fund_code}`);
      if (meta.shares) parts.push(`${meta.shares}份`);
    } else if (record.category === 'options') {
      if (meta.shares) parts.push(`${meta.shares}股`);
      if (meta.strike_price) parts.push(`行权价: ¥${meta.strike_price}`);
    } else if (record.category === 'insurance') {
      if (meta.policyholder) parts.push(`${meta.policyholder}`);
      if (meta.insurer) parts.push(meta.insurer);
      if (meta.insurance_type) parts.push(meta.insurance_type);
      if (meta.annual_premium) parts.push(`年缴¥${meta.annual_premium}`);
      if (meta.payment_years && meta.start_date) {
        const start = new Date(meta.start_date);
        const now = new Date();
        const elapsed = (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const remaining = Math.max(0, Math.ceil(meta.payment_years - elapsed));
        parts.push(remaining > 0 ? `剩余${remaining}年缴费` : '已缴清');
      }
    } else if (record.category === 'deposit') {
      if (meta.deposit_rate) parts.push(`利率${meta.deposit_rate}%`);
      if (meta.deposit_term) parts.push(meta.deposit_term);
      if (meta.maturity_date) parts.push(`到期: ${meta.maturity_date}`);
    } else if (record.category === 'wealth') {
      if (meta.risk_level) parts.push(meta.risk_level);
      if (meta.maturity_date) parts.push(`到期: ${meta.maturity_date}`);
    }
    return parts.length > 0 ? <span style={{ color: '#999', fontSize: 12 }}>{parts.join(' | ')}</span> : '-';
  };

  const grouped = useMemo(() => {
    const groups: Record<string, AssetAccount[]> = {};
    accounts.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [accounts]);

  const columns = [
    {
      title: '',
      width: 40,
      render: () => <HolderOutlined style={{ cursor: 'grab', color: '#999' }} />,
    },
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AssetAccount) => (
        <div>
          <div>{name}</div>
          <div>{renderMetaInfo(record)}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (val: number, record: AssetAccount) => (
        <Switch checked={val === 1} onChange={() => handleToggle(record.id)} checkedChildren="启用" unCheckedChildren="停用" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: AssetAccount) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
          <Popconfirm title="确定删除此资产项？删除后历史快照中的数据不受影响。" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Category order for display
  const categoryOrder: AssetCategory[] = ['cash', 'deposit', 'wealth', 'stocks', 'funds', 'options', 'insurance', 'other'];
  const activeCategories = categoryOrder.filter((cat) => grouped[cat]?.length > 0);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>资产配置管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增资产项</Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Collapse
          defaultActiveKey={activeCategories}
          style={{ background: 'transparent' }}
          items={activeCategories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const catAccounts = grouped[cat] || [];
            const enabledCount = catAccounts.filter((a) => a.enabled).length;
            return {
              key: cat,
              label: (
                <span style={{ fontWeight: 500 }}>
                  <Tag color={cfg.color} style={{ marginRight: 8 }}>{cfg.label}</Tag>
                  <span style={{ color: '#999', fontSize: 13 }}>{enabledCount}/{catAccounts.length} 启用</span>
                </span>
              ),
              children: (
                <SortableContext items={catAccounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={catAccounts}
                    loading={loading}
                    pagination={false}
                    size="small"
                    components={{ body: { row: SortableRow } }}
                    showHeader={false}
                  />
                </SortableContext>
              ),
            };
          })}
        />
      </DndContext>
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>拖拽行可调整同类资产的排序</div>
      <Modal
        title={editing ? '编辑资产项' : '新增资产项'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="资产名称" rules={[{ required: true, message: '请输入资产名称' }]}>
            <Input placeholder="如：招行尾号1234、腾讯股票" />
          </Form.Item>
          <Form.Item name="category" label="所属大类" rules={[{ required: true, message: '请选择所属大类' }]}>
            <Select options={CATEGORY_OPTIONS} placeholder="请选择" />
          </Form.Item>
          <Form.Item name="platform" label="所在平台"
            extra="如：富途、天天基金、招商银行、明亚保险、蚂蚁财富">
            <Input placeholder="如：天天基金" />
          </Form.Item>

          {selectedCategory === 'stocks' && (
            <>
              <Divider plain>股票参数</Divider>
              <Form.Item name="stock_code" label="股票代码" rules={[{ required: true, message: '请输入股票代码' }]}
                extra="沪市sh（如sh600519），深市sz（如sz000001），港股hk（如hk00700），美股gb_（如gb_aapl）">
                <Input placeholder="如：sh600519 / hk00700 / gb_aapl" />
              </Form.Item>
              <Form.Item name="shares" label="持有股数" rules={[{ required: true, message: '请输入持有股数' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="持有的总股数" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'funds' && (
            <>
              <Divider plain>基金参数</Divider>
              <Form.Item name="fund_code" label="基金代码" rules={[{ required: true, message: '请输入基金代码' }]}
                extra="6位数字基金代码，如 110011、519300">
                <Input placeholder="如：110011" />
              </Form.Item>
              <Form.Item name="shares" label="持有份额" rules={[{ required: true, message: '请输入持有份额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="持有的基金份额" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'deposit' && (
            <>
              <Divider plain>定期参数</Divider>
              <Form.Item name="deposit_rate" label="年利率(%)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="如：2.5" />
              </Form.Item>
              <Form.Item name="deposit_term" label="存期">
                <Select placeholder="请选择" allowClear options={[
                  { value: '3个月', label: '3个月' },
                  { value: '6个月', label: '6个月' },
                  { value: '1年', label: '1年' },
                  { value: '2年', label: '2年' },
                  { value: '3年', label: '3年' },
                  { value: '5年', label: '5年' },
                ]} />
              </Form.Item>
              <Form.Item name="start_date" label="起息日">
                <DatePicker style={{ width: '100%' }} placeholder="选择起息日" />
              </Form.Item>
              <Form.Item name="maturity_date" label="到期日">
                <DatePicker style={{ width: '100%' }} placeholder="选择到期日" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'wealth' && (
            <>
              <Divider plain>理财参数</Divider>
              <Form.Item name="risk_level" label="风险等级">
                <Select placeholder="请选择" allowClear options={[
                  { value: 'R1', label: 'R1 - 谨慎型' },
                  { value: 'R2', label: 'R2 - 稳健型' },
                  { value: 'R3', label: 'R3 - 平衡型' },
                  { value: 'R4', label: 'R4 - 进取型' },
                  { value: 'R5', label: 'R5 - 激进型' },
                ]} />
              </Form.Item>
              <Form.Item name="maturity_date" label="到期日"
                extra="开放式理财可不填">
                <DatePicker style={{ width: '100%' }} placeholder="选择到期日" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'options' && (
            <>
              <Divider plain>期权参数</Divider>
              <Form.Item name="shares" label="期权份额/股数" rules={[{ required: true, message: '请输入份额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} placeholder="已归属的期权股数" />
              </Form.Item>
              <Form.Item name="strike_price" label="行权价（元/股）" rules={[{ required: true, message: '请输入行权价' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="行权价格" />
              </Form.Item>
              <Form.Item name="estimated_price" label="当前估价（元/股）"
                extra="公司最新一轮融资估值对应的每股价格，或市价">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="当前每股估值" />
              </Form.Item>
            </>
          )}

          {selectedCategory === 'insurance' && (
            <Collapse
              defaultActiveKey={['basic']}
              size="small"
              style={{ marginTop: 8 }}
              items={[
                {
                  key: 'basic',
                  label: '基本信息',
                  children: (
                    <>
                      <Form.Item name="policyholder" label="投保人">
                        <Input placeholder="投保人姓名" />
                      </Form.Item>
                      <Form.Item name="insurer" label="保司">
                        <Input placeholder="如：阳光人寿、中英人寿" />
                      </Form.Item>
                      <Form.Item name="insurance_type" label="险种类型">
                        <Select placeholder="请选择" allowClear options={[
                          { value: '增额终身寿', label: '增额终身寿' },
                          { value: '养老年金', label: '养老年金' },
                          { value: '重疾', label: '重疾' },
                          { value: '医疗', label: '医疗' },
                          { value: '意外', label: '意外' },
                          { value: '其他', label: '其他' },
                        ]} />
                      </Form.Item>
                      <Form.Item name="annual_premium" label="年缴保费（元）">
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="年缴保费" />
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: 'policy',
                  label: '保单详情',
                  children: (
                    <>
                      <Form.Item name="start_date" label="保单生效日期">
                        <DatePicker style={{ width: '100%' }} placeholder="选择生效日期" />
                      </Form.Item>
                      <Form.Item name="coverage_period" label="保障期间">
                        <Input placeholder="如：终身、至106周岁" />
                      </Form.Item>
                      <Form.Item name="sum_insured" label="基本保额">
                        <Input placeholder="如：500000元" />
                      </Form.Item>
                      <Form.Item name="payment_years" label="交费期间（年）">
                        <InputNumber style={{ width: '100%' }} min={0} placeholder="如：3、5、10、20" />
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: 'cash_value',
                  label: '现金价值',
                  children: (
                    <>
                      <Form.Item name="cash_value_table_text" label="现金价值表"
                        extra="每行一个年度末的现金价值，系统根据生效日期自动计算当前值">
                        <Input.TextArea rows={4} placeholder={"第1年末现金价值\n第2年末现金价值\n..."} />
                      </Form.Item>
                      <Form.Item name="cash_value" label="当前现金价值（元）"
                        extra="手动指定，若填写了价值表则自动计算">
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="现金价值" />
                      </Form.Item>
                    </>
                  ),
                },
              ]}
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}
