import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ModulesPage from './pages/ModulesPage';
import ModulePage from './pages/ModulePage';
import RoadmapPage from './pages/RoadmapPage';
import NotFound from './pages/NotFound';
import { Loading } from './components/ui';

const Playground = lazy(() => import('./pages/PlaygroundPage'));
const CostPage = lazy(() => import('./pages/CostPage'));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage'));
const ScenarioPage = lazy(() => import('./pages/ScenarioPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/modules/:id" element={<ModulePage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/scenarios/:id" element={<ScenarioPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/compare/:id" element={<ComparePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
