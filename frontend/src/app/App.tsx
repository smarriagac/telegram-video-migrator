import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { ViewLoadingFallback } from "../shared/components/ViewLoadingFallback";

// Lazy-loaded route components for optimal bundle splitting
const LoginView = lazy(() =>
  import("../features/auth/presentation/LoginView").then((m) => ({ default: m.LoginView }))
);
const MigrationView = lazy(() =>
  import("../features/migration/presentation/MigrationView").then((m) => ({ default: m.MigrationView }))
);
const PipelineModulesView = lazy(() =>
  import("../features/migration/presentation/PipelineModulesView").then((m) => ({ default: m.PipelineModulesView }))
);
const ChatsView = lazy(() =>
  import("../features/chats/presentation/ChatsView").then((m) => ({ default: m.ChatsView }))
);
const JobsView = lazy(() =>
  import("../features/jobs/presentation/JobsView").then((m) => ({ default: m.JobsView }))
);
const LiveSyncHubView = lazy(() =>
  import("../features/sync/presentation/LiveSyncHubView").then((m) => ({ default: m.LiveSyncHubView }))
);
const AnalyticsView = lazy(() =>
  import("../features/analytics/presentation/AnalyticsView").then((m) => ({ default: m.AnalyticsView }))
);
const SettingsView = lazy(() =>
  import("../features/settings/presentation/SettingsView").then((m) => ({ default: m.SettingsView }))
);
const AuditView = lazy(() =>
  import("../features/audit/presentation/AuditView").then((m) => ({ default: m.AuditView }))
);
const BillingPlansView = lazy(() =>
  import("../features/billing/presentation/BillingPlansView").then((m) => ({ default: m.BillingPlansView }))
);
const ChannelManagementView = lazy(() =>
  import("../features/channels/presentation/ChannelManagementView").then((m) => ({ default: m.ChannelManagementView }))
);

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route
            path="/login"
            element={
              <Suspense fallback={<ViewLoadingFallback message="Iniciando acceso..." />}>
                <LoginView />
              </Suspense>
            }
          />

          {/* Protected Dashboard Shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/migration" replace />} />
              <Route path="/migration" element={<MigrationView />} />
              <Route path="/sync" element={<LiveSyncHubView />} />
              <Route path="/channels" element={<ChannelManagementView />} />
              <Route path="/pipeline" element={<PipelineModulesView />} />
              <Route path="/chats" element={<ChatsView />} />
              <Route path="/jobs" element={<JobsView />} />
              <Route path="/analytics" element={<AnalyticsView />} />
              <Route path="/billing" element={<BillingPlansView />} />
              {/* Admin-only route */}
              <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/audit" element={<AuditView />} />
                <Route path="/settings" element={<SettingsView />} />
              </Route>
              <Route path="*" element={<Navigate to="/migration" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
