import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { LoginView } from "../features/auth/presentation/LoginView";
import { MigrationView } from "../features/migration/presentation/MigrationView";
import { ChatsView } from "../features/chats/presentation/ChatsView";
import { SettingsView } from "../features/settings/presentation/SettingsView";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginView />} />

        {/* Protected Dashboard Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/migration" replace />} />
            <Route path="/migration" element={<MigrationView />} />
            <Route path="/chats" element={<ChatsView />} />
            {/* Admin-only route */}
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/settings" element={<SettingsView />} />
            </Route>
            <Route path="*" element={<Navigate to="/migration" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
