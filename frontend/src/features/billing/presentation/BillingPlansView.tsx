import React, { useState, useEffect } from "react";
import {
  Check,
  Zap,
  ShieldCheck,
  Sparkles,
  Users,
  Radio,
  HardDrive,
  CreditCard,
  Building2,
  Lock,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { billingApi } from "../infrastructure/billingApi";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanDefinition {
  id: string;
  name: string;
  tier: "FREE_TRIAL" | "CREATOR" | "PRO_AGENCY" | "ENTERPRISE";
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: PlanFeature[];
  limits: {
    accounts: number;
    syncBindings: number;
    bandwidthGb: number;
    gatekeeper: string;
  };
}

const PLANS: PlanDefinition[] = [
  {
    id: "free-trial",
    name: "Free Trial",
    tier: "FREE_TRIAL",
    tagline: "Para explorar la plataforma y probar clonaciones puntuales.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      { text: "1 Cuenta Telegram MTProto", included: true },
      { text: "2 Rutas de sincronización en vivo", included: true },
      { text: "10 GB de transferencia mensual", included: true },
      { text: "Filtros de video y sanitización básica", included: true },
      { text: "Gatekeeper de membresías VIP", included: false },
      { text: "Aislamiento dedicado por Tenant", included: false },
    ],
    limits: {
      accounts: 1,
      syncBindings: 2,
      bandwidthGb: 10,
      gatekeeper: "No incluido",
    },
  },
  {
    id: "creator",
    name: "Creator",
    tier: "CREATOR",
    tagline: "Ideal para creadores de contenido y administradores de comunidades.",
    monthlyPrice: 29,
    annualPrice: 23,
    popular: true,
    features: [
      { text: "2 Cuentas Telegram MTProto", included: true },
      { text: "5 Rutas de sincronización en vivo", included: true },
      { text: "100 GB de transferencia mensual", included: true },
      { text: "Reglas de caption y marca de agua", included: true },
      { text: "Orquestador VIP Gatekeeper (hasta 2 canales)", included: true },
      { text: "Aislamiento RLS en PostgreSQL", included: true },
    ],
    limits: {
      accounts: 2,
      syncBindings: 5,
      bandwidthGb: 100,
      gatekeeper: "Hasta 2 canales",
    },
  },
  {
    id: "pro-agency",
    name: "Pro Agency",
    tier: "PRO_AGENCY",
    tagline: "Potencia para agencias de medios y redes masivas de canales.",
    monthlyPrice: 89,
    annualPrice: 71,
    features: [
      { text: "10 Cuentas Telegram MTProto en clúster", included: true },
      { text: "30 Rutas de sincronización continua", included: true },
      { text: "1,000 GB (1 TB) de transferencia mensual", included: true },
      { text: "Gatekeeper ilimitado con Auto-Kick & Expire Links", included: true },
      { text: "Pipeline de sanitización completo con regex", included: true },
      { text: "Soporte técnico prioritario por Telegram", included: true },
    ],
    limits: {
      accounts: 10,
      syncBindings: 30,
      bandwidthGb: 1000,
      gatekeeper: "Canales ilimitados",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tier: "ENTERPRISE",
    tagline: "Infraestructura a medida para operaciones de alto volumen.",
    monthlyPrice: 249,
    annualPrice: 199,
    features: [
      { text: "50 Cuentas Telegram MTProto", included: true },
      { text: "200 Rutas de sincronización concurrentes", included: true },
      { text: "10,000 GB (10 TB) de transferencia mensual", included: true },
      { text: "Pool de clientes MTProto de baja latencia", included: true },
      { text: "Pasarelas Stripe + Crypto directas", included: true },
      { text: "SLA garantizado 99.9% y account manager", included: true },
    ],
    limits: {
      accounts: 50,
      syncBindings: 200,
      bandwidthGb: 10000,
      gatekeeper: "Full Enterprise",
    },
  },
];

export const BillingPlansView: React.FC = () => {
  // STRICT ARCHITECTURAL CONSTRAINT: Max 2 useState hooks (only 2 used)
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("FREE_TRIAL");

  useEffect(() => {
    billingApi
      .getSubscription()
      .then((data) => {
        if (data.plan_tier) {
          setSelectedTier(data.plan_tier);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectPlan = async (tier: string) => {
    try {
      const res = await billingApi.createCheckoutSession(tier, isAnnual);
      if (res.checkout_url && res.checkout_url.startsWith("http")) {
        window.location.href = res.checkout_url;
      } else {
        setSelectedTier(tier);
      }
    } catch (err: any) {
      alert(err.message || "Error al conectar con la pasarela Stripe.");
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Suscripción & Planes SaaS
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Elegí el plan adecuado para tus canales, sincronizaciones y control de miembros VIP.
          </p>
        </div>

        {/* Annual / Monthly Toggle */}
        <div className="flex items-center gap-3 bg-secondary/80 p-1.5 rounded-xl border border-border self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              !isAnnual
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Facturación Mensual
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5",
              isAnnual
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Facturación Anual
            <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              -20% OFF
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = selectedTier === plan.tier;
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col justify-between bg-card rounded-2xl border transition-all duration-200 p-5",
                plan.popular
                  ? "border-primary ring-1 ring-primary/40 shadow-lg shadow-primary/5"
                  : "border-border hover:border-border/80",
                isCurrent && "ring-2 ring-primary"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  Recomendado
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                  {isCurrent && (
                    <span className="bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Plan Actual
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 min-h-[36px]">
                  {plan.tagline}
                </p>

                {/* Price Display */}
                <div className="my-5 flex items-baseline gap-1 border-b border-border pb-4">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    ${price}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {price === 0 ? "gratis de por vida" : isAnnual ? "/mes (facturado anual)" : "/mes"}
                  </span>
                </div>

                {/* Quota Highlights */}
                <div className="space-y-2 py-2 bg-secondary/50 rounded-xl p-3 border border-border/50 text-xs mb-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Cuentas MTProto
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.limits.accounts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-primary" />
                      Rutas en Vivo
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.limits.syncBindings}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-primary" />
                      Ancho de Banda
                    </span>
                    <span className="font-semibold text-foreground">
                      {plan.limits.bandwidthGb} GB
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      VIP Gatekeeper
                    </span>
                    <span className="font-semibold text-foreground text-[11px]">
                      {plan.limits.gatekeeper}
                    </span>
                  </div>
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-2 text-xs">
                  {plan.features.map((feat, idx) => (
                    <li
                      key={idx}
                      className={cn(
                        "flex items-start gap-2",
                        feat.included ? "text-foreground" : "text-muted-foreground/50 line-through"
                      )}
                    >
                      <Check
                        className={cn(
                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                          feat.included ? "text-primary" : "text-muted-foreground/30"
                        )}
                      />
                      <span>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={isCurrent}
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                    isCurrent
                      ? "bg-secondary text-muted-foreground cursor-default border border-border"
                      : plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 active:scale-[0.98]"
                      : "bg-secondary hover:bg-secondary/80 text-foreground border border-border active:scale-[0.98]"
                  )}
                >
                  {isCurrent ? (
                    "Plan Activo"
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      {plan.tier === "ENTERPRISE" ? "Contactar Ventas" : `Elegir ${plan.name}`}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenant Status & Security Assurance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Organización & Aislamiento de Clúster
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Tu instancia corre bajo el modelo de base de datos multi-inquilino de Telegram Hub. Tus credenciales de API Telegram, strings de sesión MTProto, bindings de sincronización y reglas de caption están aisladas criptográficamente y protegidas mediante políticas de <strong>Row-Level Security (RLS)</strong> en PostgreSQL.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-secondary/60 rounded-xl p-3 border border-border">
              <span className="text-[11px] text-muted-foreground block">Tenant ID</span>
              <span className="font-mono font-semibold text-foreground truncate block">
                00000000-0000-0000-0000-000000000001
              </span>
            </div>
            <div className="bg-secondary/60 rounded-xl p-3 border border-border">
              <span className="text-[11px] text-muted-foreground block">Plan Vigente</span>
              <span className="font-semibold text-emerald-500 dark:text-emerald-400 block">
                Free Trial (Activo)
              </span>
            </div>
            <div className="bg-secondary/60 rounded-xl p-3 border border-border">
              <span className="text-[11px] text-muted-foreground block">Pasarela Conectada</span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Lock className="w-3 h-3 text-primary" />
                Stripe Billing Test
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h2 className="text-sm font-bold text-foreground">Garantía de Servicio</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Podés cambiar de plan o cancelar tu suscripción en cualquier momento sin penalizaciones. Las cuotas de canales y transferencia se actualizan en tiempo real.
            </p>
          </div>
          <div className="pt-4 border-t border-border mt-4 text-[11px] text-muted-foreground">
            Soporte 24/7 disponible para planes Pro y Enterprise.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPlansView;
