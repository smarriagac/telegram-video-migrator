import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Search, Sliders, Film } from "lucide-react";
import { useMigrationStore } from "../application/useMigrationStore";
import { useMigrationStream } from "../application/useMigrationStream";
import { MigrationControlPanel } from "./components/MigrationControlPanel";
import { MessageSelector } from "./components/MessageSelector";
import { ConfirmModal } from "./components/ConfirmModal";
import { ScheduledSuccessModal } from "./components/ScheduledSuccessModal";
import { BrandLogo } from "@/shared/components/BrandLogo";
import { ViewHeader } from "@/shared/components/ViewHeader";
import { cn } from "@/shared/lib/utils";

export const MigrationView: React.FC = () => {
  const navigate = useNavigate();

  // STRICT ARCHITECTURAL CONSTRAINT: At most 2 useState hooks in this view
  // Hook 1: Consolidated modal dialog state (ConfirmModal and ScheduledSuccessModal)
  const [modalState, setModalState] = useState<{
    isConfirmOpen: boolean;
    scheduledSuccess: {
      jobId: string;
      sourceTitle: string;
      targetTitle: string;
      scheduledAt: string;
      itemCount: number | "all";
    } | null;
  }>({
    isConfirmOpen: false,
    scheduledSuccess: null,
  });

  // Hook 2: Consolidated UI filters and responsive mobile tab state
  const [viewState, setViewState] = useState<{
    searchFilter: string;
    mobileTab: "panel" | "messages";
  }>({
    searchFilter: "",
    mobileTab: "panel",
  });

  // Domain & Job State managed strictly via Zustand
  const activeJob = useMigrationStore((state) => state.activeJob);
  const channels = useMigrationStore((state) => state.channels);
  const selectedSourceId = useMigrationStore((state) => state.selectedSourceId);
  const selectedTargetId = useMigrationStore((state) => state.selectedTargetId);
  const scheduledAt = useMigrationStore((state) => state.scheduledAt);
  const fetchChannels = useMigrationStore((state) => state.fetchChannels);
  const startMigration = useMigrationStore((state) => state.startMigration);
  const error = useMigrationStore((state) => state.error);
  const selectedMessageIds = useMigrationStore((state) => state.selectedMessageIds);

  // Hook connecting SSE streaming lifecycle
  useMigrationStream(activeJob?.job_id ?? null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleConfirmStart = async () => {
    const plannedSchedule = scheduledAt;
    const sourceChan = channels.find((c) => c.id === selectedSourceId);
    const targetChan = channels.find((c) => c.id === selectedTargetId);
    const count = selectedMessageIds.length > 0 ? selectedMessageIds.length : "all";

    const jobId = await startMigration();
    setModalState((prev) => ({ ...prev, isConfirmOpen: false }));

    if (jobId && plannedSchedule) {
      setModalState((prev) => ({
        ...prev,
        scheduledSuccess: {
          jobId,
          sourceTitle: sourceChan?.title || String(selectedSourceId),
          targetTitle: targetChan?.title || String(selectedTargetId),
          scheduledAt: plannedSchedule,
          itemCount: count,
        },
      }));
    }
  };

  return (
    <div className="w-full h-full flex flex-col space-y-2 sm:space-y-2.5 min-h-0 overflow-hidden">
      {/* Top Header */}
      <ViewHeader
        icon={<BrandLogo size="md" />}
        iconBoxColor="none"
        title="Telegram Video Migrator"
        subtitle="Clonación masiva directa por referencia (MTProto) · Sin descarga a disco · Copia limpia"
      >
        {/* Search Input using local state hook #2 */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar canal por nombre o usuario"
              placeholder="Buscar canal..."
              value={viewState.searchFilter}
              onChange={(e) => setViewState((prev) => ({ ...prev, searchFilter: e.target.value }))}
              className="bg-secondary/60 border border-border rounded-md pl-8 pr-3 py-1.5 h-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-full sm:w-44 transition-all"
            />
          </div>
          <button
            onClick={() => fetchChannels()}
            className="p-2 rounded-md bg-secondary/80 border border-border text-muted-foreground hover:text-foreground transition-colors h-8 w-8 flex items-center justify-center shrink-0"
            title="Recargar canales"
            aria-label="Recargar lista de canales"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </ViewHeader>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between animate-in fade-in flex-shrink-0"
        >
          <span>{error}</span>
        </div>
      )}

      {/* Mobile Tab Switcher (< 768px): clean full-screen toggle between Control Panel and Media Gallery */}
      <div className="md:hidden flex items-center p-1 bg-secondary/60 border border-border rounded-lg shrink-0">
        <button
          type="button"
          onClick={() => setViewState((prev) => ({ ...prev, mobileTab: "panel" }))}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            viewState.mobileTab === "panel"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Panel de Control</span>
        </button>
        <button
          type="button"
          onClick={() => setViewState((prev) => ({ ...prev, mobileTab: "messages" }))}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            viewState.mobileTab === "messages"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Galería y Mensajes</span>
          {selectedMessageIds.length > 0 && (
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                viewState.mobileTab === "messages"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary/20 text-primary"
              )}
            >
              {selectedMessageIds.length}
            </span>
          )}
        </button>
      </div>

      {/* 2-Panel Split Layout (Fluid side-by-side on >= 768px tablet & desktop; full-view tabbed on < 768px mobile) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-3 items-stretch overflow-hidden">
        {/* Column 1: Migration Control Panel (De -> Para + Actions + Progress) */}
        <div
          className={cn(
            "md:col-span-5 lg:col-span-4 xl:col-span-3 w-full h-full min-h-0",
            viewState.mobileTab === "panel" ? "flex flex-col" : "hidden md:flex md:flex-col"
          )}
        >
          <MigrationControlPanel
            onOpenConfirm={() => setModalState((prev) => ({ ...prev, isConfirmOpen: true }))}
            filterQuery={viewState.searchFilter}
          />
        </div>

        {/* Column 2: Media Gallery & Selector Canvas */}
        <div
          className={cn(
            "md:col-span-7 lg:col-span-8 xl:col-span-9 w-full min-w-0 h-full min-h-0",
            viewState.mobileTab === "messages" ? "flex flex-col" : "hidden md:flex md:flex-col"
          )}
        >
          <MessageSelector />
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalState.isConfirmOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isConfirmOpen: false }))}
        onConfirm={handleConfirmStart}
      />

      {/* Scheduled Success Modal */}
      {modalState.scheduledSuccess && (
        <ScheduledSuccessModal
          isOpen={true}
          onClose={() => setModalState((prev) => ({ ...prev, scheduledSuccess: null }))}
          onViewJobs={() => {
            setModalState((prev) => ({ ...prev, scheduledSuccess: null }));
            navigate("/jobs");
          }}
          jobId={modalState.scheduledSuccess.jobId}
          sourceTitle={modalState.scheduledSuccess.sourceTitle}
          targetTitle={modalState.scheduledSuccess.targetTitle}
          scheduledAt={modalState.scheduledSuccess.scheduledAt}
          itemCount={modalState.scheduledSuccess.itemCount}
        />
      )}
    </div>
  );
};
