// src/pages/Dashboard/index.jsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import EmployeeHome from './EmployeeHome';
import DashboardView from './DashboardView';
import useDashboardData from './useDashboardData';

const Dashboard = () => {
  const { userProfile } = useAuth();
  const { currentOrganization, isAdmin } = useOrganization();
  // 管理者以外は簡易ホーム（EmployeeHome）を表示するため、ここでの取得は不要
  const { data, loading, reload } = useDashboardData(currentOrganization?.id, isAdmin);

  if (!isAdmin) {
    return <EmployeeHome />;
  }

  return (
    <DashboardView
      data={data}
      loading={loading}
      onReload={reload}
      organizationName={currentOrganization?.name}
      userName={userProfile?.name}
    />
  );
};

export default Dashboard;
