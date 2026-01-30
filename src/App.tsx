
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import TasksPage from '@/pages/Tasks'
import ReportsPage from '@/pages/Reports'
import DataCenterPage from '@/pages/DataCenter'
import AdminUnitsPage from '@/pages/AdminUnits'
import { Toaster } from '@/components/ui/sonner'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/data-center" element={<DataCenterPage />} />
                <Route path="/units" element={<AdminUnitsPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <Toaster />
        </BrowserRouter>
    )
}

export default App
