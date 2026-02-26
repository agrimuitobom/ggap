// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// レイアウトコンポーネント
import MainLayout from './components/Layout/MainLayout';

// ページコンポーネント
import Dashboard from './pages/Dashboard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import WorkLogsList from './pages/WorkLogs/WorkLogsList';
import WorkLogForm from './pages/WorkLogs/WorkLogForm';
import FieldsList from './pages/FieldManagement/FieldsList';
import FieldForm from './pages/FieldManagement/FieldForm';
import FieldInspectionForm from './pages/FieldManagement/FieldInspectionForm';
import SeedsList from './pages/Seeds/SeedsList';
import SeedForm from './pages/Seeds/SeedForm';
import SeedUseForm from './pages/Seeds/SeedUseForm';
import SeedUsesList from './pages/Seeds/SeedUsesList';
import FertilizersList from './pages/Fertilizers/FertilizersList';
import FertilizerForm from './pages/Fertilizers/FertilizerForm';
import FertilizerUseForm from './pages/Fertilizers/FertilizerUseForm';
import FertilizerUsesList from './pages/Fertilizers/FertilizerUsesList';
import PesticidesList from './pages/Pesticides/PesticidesList';
import PesticideForm from './pages/Pesticides/PesticideForm';
import PesticideUseForm from './pages/Pesticides/PesticideUseForm';
import PesticideUsesList from './pages/Pesticides/PesticideUsesList';

// 収穫管理
import HarvestsList from './pages/Harvests/HarvestsList';
import HarvestForm from './pages/Harvests/HarvestForm';
import HarvestDetail from './pages/Harvests/HarvestDetail';

// 出荷管理
import ShipmentsList from './pages/Shipments/ShipmentsList';
import ShipmentForm from './pages/Shipments/ShipmentForm';
import ShipmentDetail from './pages/Shipments/ShipmentDetail';

// 訪問者管理
import VisitorsList from './pages/Visitors/VisitorsList';
import VisitorForm from './pages/Visitors/VisitorForm';

// 教育・訓練記録
import TrainingsList from './pages/Trainings/TrainingsList';
import TrainingForm from './pages/Trainings/TrainingForm';

// レポート・分析
import ReportsDashboard from './pages/Reports/ReportsDashboard';
import PesticideUsageReport from './pages/Reports/PesticideUsageReport';
import FertilizerUsageReport from './pages/Reports/FertilizerUsageReport';
import BusinessAnalytics from './pages/Reports/BusinessAnalytics';
import TrainingReport from './pages/Reports/TrainingReport';
import TraceabilityReport from './pages/Reports/TraceabilityReport';

// ルート保護用コンポーネント
import PrivateRoute from './components/Auth/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
        <Toaster position="top-right" toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#333',
          },
          success: {
            style: {
              background: '#e6f7e6',
              border: '1px solid #86cb86',
            },
          },
          error: {
            style: {
              background: '#f8d7da',
              border: '1px solid #dc3545',
            },
            duration: 4000,
          },
        }} />
        <Routes>
          {/* 認証ページ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* 認証が必要なページ */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* 作業日誌 */}
            <Route path="work-logs" element={<WorkLogsList />} />
            <Route path="work-logs/new" element={<WorkLogForm />} />
            <Route path="work-logs/edit/:id" element={<WorkLogForm />} />
            
            {/* 圃場管理 */}
            <Route path="fields" element={<FieldsList />} />
            <Route path="fields/new" element={<FieldForm />} />
            <Route path="fields/edit/:id" element={<FieldForm />} />
            <Route path="field-inspections/new" element={<FieldInspectionForm />} />
            <Route path="field-inspections/edit/:id" element={<FieldInspectionForm />} />
            
            {/* 種子・苗管理 */}
            <Route path="seeds" element={<SeedsList />} />
            <Route path="seeds/new" element={<SeedForm />} />
            <Route path="seeds/edit/:id" element={<SeedForm />} />
            <Route path="seed-uses" element={<SeedUsesList />} />
            <Route path="seed-uses/new" element={<SeedUseForm />} />
            <Route path="seed-uses/edit/:id" element={<SeedUseForm />} />
            
            {/* 肥料管理 */}
            <Route path="fertilizers" element={<FertilizersList />} />
            <Route path="fertilizers/new" element={<FertilizerForm />} />
            <Route path="fertilizers/edit/:id" element={<FertilizerForm />} />
            <Route path="fertilizer-uses" element={<FertilizerUsesList />} />
            <Route path="fertilizer-uses/new" element={<FertilizerUseForm />} />
            <Route path="fertilizer-uses/edit/:id" element={<FertilizerUseForm />} />
            
            {/* 農薬管理 */}
            <Route path="pesticides" element={<PesticidesList />} />
            <Route path="pesticides/new" element={<PesticideForm />} />
            <Route path="pesticides/edit/:id" element={<PesticideForm />} />
            <Route path="pesticide-uses" element={<PesticideUsesList />} />
            <Route path="pesticide-uses/new" element={<PesticideUseForm />} />
            <Route path="pesticide-uses/edit/:id" element={<PesticideUseForm />} />
            
            {/* 収穫管理 */}
            <Route path="harvests" element={<HarvestsList />} />
            <Route path="harvests/new" element={<HarvestForm />} />
            <Route path="harvests/:id" element={<HarvestDetail />} />
            <Route path="harvests/edit/:id" element={<HarvestForm />} />
            
            {/* 出荷管理 */}
            <Route path="shipments" element={<ShipmentsList />} />
            <Route path="shipments/new" element={<ShipmentForm />} />
            <Route path="shipments/:id" element={<ShipmentDetail />} />
            <Route path="shipments/edit/:id" element={<ShipmentForm />} />
            
            {/* 訪問者管理 */}
            <Route path="visitors" element={<VisitorsList />} />
            <Route path="visitors/new" element={<VisitorForm />} />
            <Route path="visitors/edit/:id" element={<VisitorForm />} />
            
            {/* 教育・訓練記録 */}
            <Route path="trainings" element={<TrainingsList />} />
            <Route path="trainings/new" element={<TrainingForm />} />
            <Route path="trainings/edit/:id" element={<TrainingForm />} />
            
            {/* レポート・分析 */}
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="reports/pesticide-usage" element={<PesticideUsageReport />} />
            <Route path="reports/fertilizer-usage" element={<FertilizerUsageReport />} />
            <Route path="reports/business-analytics" element={<BusinessAnalytics />} />
            <Route path="reports/training" element={<TrainingReport />} />
            <Route path="reports/traceability" element={<TraceabilityReport />} />
          </Route>
        </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
