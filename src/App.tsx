import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import TakeSurveyStart from './pages/TakeSurveyStart'
import RunSurvey from './pages/RunSurvey'
import Login from './pages/Login'
import AppLayout from './pages/app/AppLayout'
import Dashboard from './pages/app/Dashboard'
import OrgManager from './pages/app/OrgManager'
import SurveysList from './pages/app/SurveysList'
import SurveyBuilder from './pages/app/SurveyBuilder'
import RunsManager from './pages/app/RunsManager'
import ReportPage from './pages/app/ReportPage'
import UsersManager from './pages/app/UsersManager'
import IndicatorsManager from './pages/app/IndicatorsManager'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/take" element={<TakeSurveyStart />} />
      <Route path="/r/:token" element={<RunSurvey />} />
      <Route path="/login" element={<Login />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="org" element={<OrgManager />} />
        <Route path="surveys" element={<SurveysList />} />
        <Route path="surveys/:id" element={<SurveyBuilder />} />
        <Route path="runs" element={<RunsManager />} />
        <Route path="runs/:runId/report" element={<ReportPage />} />
        <Route path="indicators" element={<IndicatorsManager />} />
        <Route path="users" element={<UsersManager />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
