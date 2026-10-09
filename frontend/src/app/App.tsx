import React from "react";
import { MigrationView } from "../features/migration/presentation/MigrationView";

export const App: React.FC = () => {
  return (
    <main className="min-h-screen bg-[#090A0F] text-zinc-100 selection:bg-cyan-500 selection:text-black">
      {/* Background ambient subtle glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 px-4 py-8 md:px-8 max-w-6xl mx-auto">
        <MigrationView />
      </div>
    </main>
  );
};

export default App;
