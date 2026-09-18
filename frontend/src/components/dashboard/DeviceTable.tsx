'use client';

import { Fragment, type MouseEvent } from 'react';
import type { Device, SortField } from '@/types/dashboard';
import { getLatencyBarColor, getLatencyColor } from '@/lib/latency';

interface DeviceTableProps {
  devices: Device[];
  onSort: (field: SortField) => void;
  expandedDevice: Device['id'] | null;
  onToggleExpand: (id: Device['id']) => void;
  pingingDevice: Device['id'] | null;
  onPingDevice: (id: Device['id']) => void;
  onRemoveDevice: (id: Device['id'], name: string) => void;
  alertThresholds: Record<string, number>;
  onRemoveAlertConfig: (id: Device['id']) => void;
  onOpenAlertConfig: (device: Device) => void;
}

export default function DeviceTable({
  devices,
  onSort,
  expandedDevice,
  onToggleExpand,
  pingingDevice,
  onPingDevice,
  onRemoveDevice,
  alertThresholds,
  onRemoveAlertConfig,
  onOpenAlertConfig,
}: DeviceTableProps) {
  return (
    <div className="bg-slate-800/20 rounded-lg border border-slate-600/70 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#121a2b] border-b border-slate-600/70">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors w-24" onClick={() => onSort('status')}>Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => onSort('name')}>Dispositivo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => onSort('ip')}>IP</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-300 transition-colors w-32" onClick={() => onSort('latency')}>Latência</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-600/70">
            {devices.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Nenhum dispositivo encontrado</td></tr>
            ) : (
              devices.map((device) => (
                <Fragment key={device.id}>
                  <tr className="group cursor-pointer transition-colors hover:bg-slate-700/30" onClick={() => onToggleExpand(device.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                        <span className={`text-xs font-medium ${device.status === 'online' ? 'text-emerald-300' : 'text-rose-400'}`}>
                          {device.status === 'online' ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{device.name}</div>
                      {device.location && <div className="text-[10px] text-slate-400">{device.location}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{device.ip}</td>
                    <td className="px-4 py-3">
                      {device.latency && device.status === 'online' ? (
                        <div className="flex items-center justify-end gap-2 w-full">
                          <div className="w-20 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${getLatencyBarColor(device.latency)} transition-all duration-300`}
                              style={{ width: `${Math.min(100, device.latency / 10)}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-mono w-12 text-right ${getLatencyColor(device.latency)}`}>
                            {device.latency}ms
                          </span>
                        </div>
                      ) : <span className="text-slate-500 text-xs text-right block">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-start gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={(e: MouseEvent) => { e.stopPropagation(); onPingDevice(device.id); }}
                          disabled={pingingDevice === device.id}
                          className="px-2 py-1 bg-slate-700 hover:bg-[#4F8CFF] text-slate-400 hover:text-white rounded-md text-xs font-medium transition-all flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Ping
                        </button>
                        <button
                          onClick={(e: MouseEvent) => { e.stopPropagation(); onRemoveDevice(device.id, device.name); }}
                          className="px-2 py-1 bg-slate-700 hover:bg-rose-600 text-slate-400 hover:text-white rounded-md text-xs font-medium transition-all flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedDevice === device.id && (
                    <tr className="bg-slate-800/30">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div><p className="text-slate-400">Localização</p><p className="text-slate-300">{device.location || '—'}</p></div>
                          <div><p className="text-slate-400">Último check</p><p className="text-slate-300">{device.last_check ? new Date(device.last_check).toLocaleString() : '—'}</p></div>
                          <div>
                            <p className="text-slate-400">Alerta SLA</p>
                            {alertThresholds[device.id] ? (
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-300">Limite: {alertThresholds[device.id]}ms</span>
                                <button onClick={() => onRemoveAlertConfig(device.id)} className="text-rose-400 text-xs">Remover</button>
                              </div>
                            ) : (
                              <button onClick={() => onOpenAlertConfig(device)} className="text-blue-300 hover:text-blue-200 text-xs">Configurar alerta</button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
