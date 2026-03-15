import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Upload, message } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  CameraOutlined,
  ExportOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Snapshots from './pages/Snapshots';
import SnapshotCreate from './pages/SnapshotCreate';
import SnapshotDetail from './pages/SnapshotDetail';
import { exportData, importData } from './api';

const { Sider, Content } = Layout;

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuKey = location.pathname.startsWith('/snapshots')
    ? '/snapshots'
    : location.pathname.startsWith('/accounts')
    ? '/accounts'
    : '/';

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-assets-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      message.success('导入成功，页面将刷新');
      setTimeout(() => window.location.reload(), 500);
    } catch {
      message.error('导入失败，请检查文件格式');
    }
    return false;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '20px 16px', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          家庭资产管理
        </div>
        <Menu
          mode="inline"
          selectedKeys={[menuKey]}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/', icon: <DashboardOutlined />, label: '数据大盘' },
            { key: '/accounts', icon: <BankOutlined />, label: '资产配置' },
            { key: '/snapshots', icon: <CameraOutlined />, label: '快照记录' },
          ]}
        />
        <div style={{ padding: '16px', position: 'absolute', bottom: 0, width: '100%' }}>
          <Button icon={<ExportOutlined />} block onClick={handleExport} style={{ marginBottom: 8 }}>
            导出数据
          </Button>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleImport}>
            <Button icon={<ImportOutlined />} block>
              导入数据
            </Button>
          </Upload>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: 24, background: '#f5f5f5', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/snapshots" element={<Snapshots />} />
            <Route path="/snapshots/new" element={<SnapshotCreate />} />
            <Route path="/snapshots/:id" element={<SnapshotDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
