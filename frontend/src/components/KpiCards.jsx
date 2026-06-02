'use client';

import React from 'react';

export default function KpiCards({ devices, online, offline, avgLatency, availability }) {
  const cards = [
    {
      title: 'OFFLINE',
      value: offline,
      icon: '🔴',
      type: 'critical',
      color: 'rose',
      size: 'large'
    },
    {
      title: 'ONLINE',
      value: online,
      icon: '🟢',
      type: 'success',
      color: 'emerald',
      size: 'medium'
    },
    {
      title: 'DISPONIBILIDADE',
      value: `${availability}%`,
      icon: '📊',
      type: 'critical',
      color: 'blue',
      size: 'large',
      subtitle: 'SLA geral'
    },
    {
      title: 'LATÊNCIA MÉDIA',
      value: avgLatency ? `${Math.round(avgLatency)}ms` : '—',
      icon: '⚡',
      type: 'warning',
      color: 'amber',
      size: 'medium'
    },
    {
      title: 'TOTAL ATIVOS',
      value: devices.length,
      icon: '🖥️',
      type: 'info',
      color: 'indigo',
      size: 'small'
    }
  ];

  const getCardClasses = (card) => {
    const base = 'relative overflow-hidden rounded-xl transition-all duration-300';
    const sizes = {
      large: 'lg:col-span-2 p-6',
      medium: 'p-5',
      small: 'p-4'
    };

    const colors = {
      rose: 'bg-gradient-to-br from-rose-900/40 to-rose-900/10 border-rose-800/50 hover:border-rose-500/30',
      emerald: 'bg-gradient-to-br from-emerald-900/30 to-emerald-900/5 border-emerald-800/40',
      blue: 'bg-gradient-to-br from-blue-900/40 to-blue-900/10 border-blue-800/50 hover:border-blue-500/30',
      amber: 'bg-gradient-to-br from-amber-900/30 to-amber-900/5 border-amber-800/40',
      indigo: 'bg-gradient-to-br from-indigo-900/30 to-indigo-900/5 border-indigo-800/40'
    };

    return `${base} ${sizes[card.size]} ${colors[card.color]}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className={getCardClasses(card)}>
          {card.type === 'critical' && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl animate-pulse" />
          )}
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
              {card.subtitle && <span className="text-[10px] text-slate-500">{card.subtitle}</span>}
            </div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${card.type === 'critical' ? 'text-rose-400' : 'text-slate-400'}`}>
              {card.title}
            </p>
            <p className={`text-3xl font-bold mt-2 ${card.color === 'rose' ? 'text-rose-400' : card.color === 'emerald' ? 'text-emerald-400' : card.color === 'blue' ? 'text-blue-400' : card.color === 'amber' ? 'text-amber-400' : 'text-indigo-400'}`}>
              {card.value}
            </p>
            {card.title === 'OFFLINE' && offline > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}