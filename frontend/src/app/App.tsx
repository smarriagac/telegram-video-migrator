import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { MigrationView } from "../features/migration/presentation/MigrationView";
import { ChatsView } from "../features/chats/presentation/ChatsView";
import { SettingsView } from "../features/settings/presentation/SettingsView";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/migration" replace />} />
          <Route path="/migration" element={<MigrationView />} />
          <Route path="/chats" element={<ChatsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/migration" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
