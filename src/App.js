// src/App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { Toaster } from 'react-hot-toast';

// レイアウト・認証画面・保護用コンポーネントは初回表示に必要なため即時読み込み
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import PrivateRoute from './components/Auth/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import InstallPrompt from './components/PWA/InstallPrompt';

// その他のページは遅延読み込み（起動時のJSを小さくする）
const Dashboard = lazy(() => import('./pages/Dashboard'));
const WorkLogsList = lazy(() => import('./pages/WorkLogs/WorkLogsList'));
const WorkLogForm = lazy(() => import('./pages/WorkLogs/WorkLogForm'));
const QuickWorkLogForm = lazy(() => import('./pages/WorkLogs/QuickWorkLogForm'));
const WorkLogCalendar = lazy(() => import('./pages/WorkLogs/WorkLogCalendar'));
const CleaningCheck = lazy(() => import('./pages/Cleaning/CleaningCheck'));
const CleaningItemsManager = lazy(() => import('./pages/Cleaning/CleaningItemsManager'));
const NutrientLogs = lazy(() => import('./pages/Nutrient/NutrientLogs'));
const PlantingsList = lazy(() => import('./pages/Plantings/PlantingsList'));
const PlantingForm = lazy(() => import('./pages/Plantings/PlantingForm'));
const ResearchAnalysis = lazy(() => import('./pages/Research/ResearchAnalysis'));
const BiodiversityList = lazy(() => import('./pages/Biodiversity/BiodiversityList'));
const BiodiversitySurveyForm = lazy(() => import('./pages/Biodiversity/BiodiversitySurveyForm'));
const WaterManagement = lazy(() => import('./pages/Water/WaterManagement'));
const MaterialDisposals = lazy(() => import('./pages/Materials/MaterialDisposals'));
const MassBalanceReport = lazy(() => import('./pages/Reports/MassBalanceReport'));
const Complaints = lazy(() => import('./pages/Compliance/Complaints'));
const Equipment = lazy(() => import('./pages/Compliance/Equipment'));
const Incidents = lazy(() => import('./pages/Compliance/Incidents'));
const SelfAssessmentList = lazy(() => import('./pages/SelfAssessment/SelfAssessmentList'));
const SelfAssessmentDetail = lazy(() => import('./pages/SelfAssessment/SelfAssessmentDetail'));
const FieldsList = lazy(() => import('./pages/FieldManagement/FieldsList'));
const FieldForm = lazy(() => import('./pages/FieldManagement/FieldForm'));
const FieldInspectionForm = lazy(() => import('./pages/FieldManagement/FieldInspectionForm'));
const SeedsList = lazy(() => import('./pages/Seeds/SeedsList'));
const SeedForm = lazy(() => import('./pages/Seeds/SeedForm'));
const SeedUseForm = lazy(() => import('./pages/Seeds/SeedUseForm'));
const SeedUsesList = lazy(() => import('./pages/Seeds/SeedUsesList'));
const FertilizersList = lazy(() => import('./pages/Fertilizers/FertilizersList'));
const FertilizerForm = lazy(() => import('./pages/Fertilizers/FertilizerForm'));
const FertilizerUseForm = lazy(() => import('./pages/Fertilizers/FertilizerUseForm'));
const FertilizerUsesList = lazy(() => import('./pages/Fertilizers/FertilizerUsesList'));
const PesticidesList = lazy(() => import('./pages/Pesticides/PesticidesList'));
const PesticideForm = lazy(() => import('./pages/Pesticides/PesticideForm'));
const PesticideUseForm = lazy(() => import('./pages/Pesticides/PesticideUseForm'));
const PesticideUsesList = lazy(() => import('./pages/Pesticides/PesticideUsesList'));
const HarvestsList = lazy(() => import('./pages/Harvests/HarvestsList'));
const HarvestForm = lazy(() => import('./pages/Harvests/HarvestForm'));
const QuickHarvestForm = lazy(() => import('./pages/Harvests/QuickHarvestForm'));
const HarvestDetail = lazy(() => import('./pages/Harvests/HarvestDetail'));
const ShipmentsList = lazy(() => import('./pages/Shipments/ShipmentsList'));
const ShipmentForm = lazy(() => import('./pages/Shipments/ShipmentForm'));
const ShipmentDetail = lazy(() => import('./pages/Shipments/ShipmentDetail'));
const VisitorsList = lazy(() => import('./pages/Visitors/VisitorsList'));
const VisitorForm = lazy(() => import('./pages/Visitors/VisitorForm'));
const TrainingsList = lazy(() => import('./pages/Trainings/TrainingsList'));
const TrainingForm = lazy(() => import('./pages/Trainings/TrainingForm'));
const QuickTrainingForm = lazy(() => import('./pages/Trainings/QuickTrainingForm'));
const TrainingItemsManager = lazy(() => import('./pages/Trainings/TrainingItemsManager'));
const WorkersList = lazy(() => import('./pages/Workers/WorkersList'));
const WorkerForm = lazy(() => import('./pages/Workers/WorkerForm'));
const GroupsList = lazy(() => import('./pages/Groups/GroupsList'));
const GroupForm = lazy(() => import('./pages/Groups/GroupForm'));
// レポート・分析（exceljs / jspdf / recharts を含むため特に分割効果が大きい）
const ReportsDashboard = lazy(() => import('./pages/Reports/ReportsDashboard'));
const PesticideUsageReport = lazy(() => import('./pages/Reports/PesticideUsageReport'));
const FertilizerUsageReport = lazy(() => import('./pages/Reports/FertilizerUsageReport'));
const BusinessAnalytics = lazy(() => import('./pages/Reports/BusinessAnalytics'));
const TrainingReport = lazy(() => import('./pages/Reports/TrainingReport'));
const TraceabilityReport = lazy(() => import('./pages/Reports/TraceabilityReport'));
const BackupPage = lazy(() => import('./pages/Backup/BackupPage'));
const TrashPage = lazy(() => import('./pages/Trash/TrashPage'));
const TermsOfService = lazy(() => import('./pages/Legal/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/Legal/PrivacyPolicy'));
const OrganizationSettings = lazy(() => import('./pages/Organizations/OrganizationSettings'));
const OrganizationSwitcher = lazy(() => import('./pages/Organizations/OrganizationSwitcher'));
const InvitationsPage = lazy(() => import('./pages/Organizations/InvitationsPage'));

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <OrganizationProvider>
            <InstallPrompt />
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
        <Suspense fallback={
          <div className="flex justify-center items-center h-screen bg-gray-100">
            <span className="text-gray-500">読み込み中...</span>
          </div>
        }>
        <Routes>
          {/* 認証ページ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 規約・ポリシー（ログインしていなくても閲覧できるようにする） */}
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          
          {/* 認証が必要なページ */}
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            
            {/* 作業日誌 */}
            <Route path="work-logs" element={<WorkLogsList />} />
            <Route path="work-logs/new" element={<WorkLogForm />} />
            <Route path="work-logs/quick" element={<QuickWorkLogForm />} />
            <Route path="work-logs/calendar" element={<WorkLogCalendar />} />
            <Route path="work-logs/edit/:id" element={<WorkLogForm />} />

            {/* 清掃チェック */}
            <Route path="cleaning" element={<CleaningCheck />} />
            <Route path="cleaning/items" element={<CleaningItemsManager />} />

            {/* 作付・処理区 */}
            <Route path="plantings" element={<PlantingsList />} />
            <Route path="plantings/new" element={<PlantingForm />} />
            <Route path="plantings/edit/:id" element={<PlantingForm />} />

            {/* 研究データ分析 */}
            <Route path="research" element={<ResearchAnalysis />} />

            {/* 生物多様性モニタリング */}
            <Route path="biodiversity" element={<BiodiversityList />} />
            <Route path="biodiversity/new" element={<BiodiversitySurveyForm />} />
            <Route path="biodiversity/edit/:id" element={<BiodiversitySurveyForm />} />

            {/* 養液管理 */}
            <Route path="nutrient-logs" element={<NutrientLogs />} />

            {/* 水源・水質管理 */}
            <Route path="water" element={<WaterManagement />} />

            {/* 資材の保管・廃棄 */}
            <Route path="material-disposals" element={<MaterialDisposals />} />

            {/* コンプライアンス記録 */}
            <Route path="complaints" element={<Complaints />} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="incidents" element={<Incidents />} />

            {/* 自己点検（内部監査） */}
            <Route path="self-assessments" element={<SelfAssessmentList />} />
            <Route path="self-assessments/:id" element={<SelfAssessmentDetail />} />

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
            <Route path="harvests/quick" element={<QuickHarvestForm />} />
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
            <Route path="trainings/quick" element={<QuickTrainingForm />} />
            <Route path="trainings/quick/edit/:id" element={<QuickTrainingForm />} />
            <Route path="trainings/items" element={<TrainingItemsManager />} />
            <Route path="trainings/new" element={<TrainingForm />} />
            <Route path="trainings/edit/:id" element={<TrainingForm />} />

            {/* 従業員管理 */}
            <Route path="workers" element={<WorkersList />} />
            <Route path="workers/new" element={<WorkerForm />} />
            <Route path="workers/edit/:id" element={<WorkerForm />} />

            {/* グループ管理 */}
            <Route path="groups" element={<GroupsList />} />
            <Route path="groups/new" element={<GroupForm />} />
            <Route path="groups/edit/:id" element={<GroupForm />} />
            
            {/* レポート・分析 */}
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="reports/pesticide-usage" element={<PesticideUsageReport />} />
            <Route path="reports/fertilizer-usage" element={<FertilizerUsageReport />} />
            <Route path="reports/business-analytics" element={<BusinessAnalytics />} />
            <Route path="reports/training" element={<TrainingReport />} />
            <Route path="reports/traceability" element={<TraceabilityReport />} />
            <Route path="reports/mass-balance" element={<MassBalanceReport />} />

            {/* バックアップ・復元・ゴミ箱 */}
            <Route path="backup" element={<BackupPage />} />
            <Route path="trash" element={<TrashPage />} />

            {/* 組織管理 */}
            <Route path="organizations/settings" element={<OrganizationSettings />} />
            <Route path="organizations/switch" element={<OrganizationSwitcher />} />
            <Route path="organizations/invitations" element={<InvitationsPage />} />
          </Route>
        </Routes>
        </Suspense>
          </OrganizationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
