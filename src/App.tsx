import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import AnbieterprofilPage from '@/pages/AnbieterprofilPage';
import StandortePage from '@/pages/StandortePage';
import TimeslotsPage from '@/pages/TimeslotsPage';
import TerminbuchungPage from '@/pages/TerminbuchungPage';
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
                <Route path="anbieterprofil" element={<AnbieterprofilPage />} />
                <Route path="standorte" element={<StandortePage />} />
                <Route path="timeslots" element={<TimeslotsPage />} />
                <Route path="terminbuchung" element={<TerminbuchungPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
