import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginView } from "../features/auth/presentation/LoginView";
import { MigrationView } from "../features/migration/presentation/MigrationView";
import { PipelineModulesView } from "../features/migration/presentation/PipelineModulesView";
import { ChatsView } from "../features/chats/presentation/ChatsView";
import { JobsView } from "../features/jobs/presentation/JobsView";
import { LiveSyncHubView } from "../features/sync/presentation/LiveSyncHubView";
import { AnalyticsView } from "../features/analytics/presentation/AnalyticsView";
import { SettingsView } from "../features/settings/presentation/SettingsView";
import { AuditView } from "../features/audit/presentation/AuditView";
import { BillingPlansView } from "../features/billing/presentation/BillingPlansView";
import { ChannelManagementView } from "../features/channels/presentation/ChannelManagementView";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginView />} />

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
