import React, { useState } from 'react';
import { Trophy, Users, ShieldCheck } from 'lucide-react';

interface GrupoSan {
  id: number;
  nombre: string;
  cuota: number;
  moneda: string;
  estado: 'ABIERTO' | 'EN PROGRESO';
  participantesCount: number;
  miTurno: number;
}

interface SeccionSanProps {
  reputacion: number;
  nivel: 'Bronce' | 'Plata' | 'Oro';
  grupos: GrupoSan[];
  onPayAporte: (grupoId: number) => void;
}

export const SeccionSan: React.FC<SeccionSanProps> = ({
  reputacion,
  nivel,
  grupos,
  onPayAporte,
}) => {
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoSan | null>(null);

  const getNivelColor = () => {
    if (nivel === 'Plata') return 'text-slate-400';
    if (nivel === 'Oro') return 'text-amber-500';
    return 'text-amber-700'; // Bronce
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Tarjeta de Reputación */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-2xl shadow-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
          <Trophy className="w-48 h-48" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/10 rounded-2xl">
              <Trophy className={`w-10 h-10 ${getNivelColor()}`} />
            </div>
            <div>
              <span className="text-purple-300 text-xs font-bold uppercase tracking-wider block">🛡️ Reputación SAN</span>
              <h2 className="text-2xl font-black uppercase tracking-wide">Nivel {nivel}</h2>
              <p className="text-purple-200 text-xs mt-1">Puntos de puntualidad acumulados: <strong>{reputacion} pts</strong></p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Historial Limpio
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de Grupos */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-slate-900 font-black border-b pb-2 text-base">Mis Grupos de Ahorro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {grupos.map((g) => (
              <div key={g.id} className="bg-white rounded-xl shadow border border-slate-200 p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{g.nombre}</h4>
                    <span className="text-xs text-slate-400 font-medium">Cuota del Ciclo</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide ${
                    g.estado === 'ABIERTO' 
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {g.estado}
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-extrabold text-slate-900">
                    {g.cuota.toFixed(2)} <small className="text-xs font-bold text-slate-500">{g.moneda}</small>
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {g.participantesCount} miembros
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGrupo(g)}
                  className="w-full bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold py-2 rounded-lg transition"
                >
                  Ver Detalles y Pagar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Info lateral */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 text-slate-800 text-xs">
            <h4 className="font-black text-slate-900 uppercase tracking-wide text-xs">¿Qué es el Sistema SAN?</h4>
            <p className="leading-relaxed">
              Es un sistema de ahorro circular grupal donde todos los participantes aportan una cuota periódica fija. Cada periodo (semana/quincena), un participante recibe el fondo acumulado total ("caja").
            </p>
            <p className="leading-relaxed font-semibold text-purple-900">
              * Mantener un puntaje alto de reputación (pagando tus cuotas antes de la fecha límite) te permite acceder a turnos anticipados en los círculos de ahorro y límites de retiro más altos.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Detalles y Pago de Cuota */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-purple-950 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-base">Detalles del Grupo SAN</h3>
              <button
                onClick={() => setSelectedGrupo(null)}
                className="text-white hover:text-purple-100 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-1">
                <span className="text-xs text-purple-600 font-bold block uppercase tracking-wider">Grupo</span>
                <span className="text-lg font-black text-purple-950">{selectedGrupo.nombre}</span>
                <div className="flex justify-between items-baseline pt-2 border-t border-purple-200/50 mt-2 text-sm text-purple-900">
                  <span>Cuota</span>
                  <span className="font-black text-base">
                    {selectedGrupo.cuota.toFixed(2)} {selectedGrupo.moneda}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-slate-700 text-xs font-semibold">
                <div className="flex justify-between">
                  <span>Mi Turno Asignado:</span>
                  <span className="text-slate-900 font-bold">Turno #{selectedGrupo.miTurno}</span>
                </div>
                <div className="flex justify-between">
                  <span>Participantes:</span>
                  <span className="text-slate-900 font-bold">{selectedGrupo.participantesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Moneda de Operación:</span>
                  <span className="text-slate-900 font-bold">{selectedGrupo.moneda}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedGrupo(null)}
                  className="w-1/3 py-2 rounded-lg font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition text-xs"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    onPayAporte(selectedGrupo.id);
                    setSelectedGrupo(null);
                  }}
                  className="w-2/3 py-2 rounded-lg font-bold bg-purple-900 hover:bg-purple-800 text-white transition shadow-lg text-xs"
                >
                  Pagar Cuota {selectedGrupo.cuota.toFixed(2)} {selectedGrupo.moneda}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
