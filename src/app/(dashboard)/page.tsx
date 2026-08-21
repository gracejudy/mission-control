"use client";

import { useEffect, useState } from "react";
import { StatsCard } from "@/components/StatsCard";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Notepad } from "@/components/Notepad";
import {
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Brain,
  Zap,
  Server,
  Terminal,
} from "lucide-react";
import Link from "next/link";

interface Stats {
  total: number;
  today: number;
  success: number;
  error: number;
  byType: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, success: 0, error: 0, byType: {} });

  useEffect(() => {
    fetch("/api/activities/stats").then(r => r.json()).then((actStats) => {
      setStats({
        total: actStats.total || 0,
        today: actStats.today || 0,
        success: actStats.byStatus?.success || 0,
        error: actStats.byStatus?.error || 0,
        byType: actStats.byType || {},
      });
    }).catch(console.error);
  }, []);

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{ 
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-primary)',
            letterSpacing: '-1.5px'
          }}
        >
          🦞 Mission Control
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Overview of Tenacitas agent activity
        </p>
      </div>

      {/* Stats Grid + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 md:mb-6">
        {/* Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard
            title="Total Activities"
            value={stats.total.toLocaleString()}
            icon={<Activity className="w-5 h-5" />}
            iconColor="var(--info)"
          />
          <StatsCard
            title="Today"
            value={stats.today.toLocaleString()}
            icon={<Zap className="w-5 h-5" />}
            iconColor="var(--accent)"
          />
          <StatsCard
            title="Successful"
            value={stats.success.toLocaleString()}
            icon={<CheckCircle className="w-5 h-5" />}
            iconColor="var(--success)"
          />
          <StatsCard
            title="Errors"
            value={stats.error.toLocaleString()}
            icon={<XCircle className="w-5 h-5" />}
            iconColor="var(--error)"
          />
        </div>

        {/* Weather Widget */}
        <div className="lg:col-span-1">
          <WeatherWidget />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {/* Quick Links */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div 
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2 
                className="text-base font-semibold"
                style={{ 
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--text-primary)'
                }}
              >
                Quick Links
              </h2>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {[
              { href: "/cron", icon: Calendar, label: "Cron Jobs", color: "#a78bfa" },
              { href: "/actions", icon: Zap, label: "Quick Actions", color: "var(--accent)" },
              { href: "/system", icon: Server, label: "System", color: "var(--success)" },
              { href: "/logs", icon: Terminal, label: "Live Logs", color: "#60a5fa" },
              { href: "/memory", icon: Brain, label: "Memory", color: "#f59e0b" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Notepad */}
          <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
            <Notepad />
          </div>
        </div>
      </div>
    </div>
  );
}
