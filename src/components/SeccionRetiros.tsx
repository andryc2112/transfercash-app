import React, { useState } from 'react';
import { Wallet, History } from 'lucide-react';

interface Retiro {
  id: number;
  fecha: string;
  monto: number;
  fee: number;
  totalRecibir: number;
  estado: 'PAGADO' | 'PENDIENTE' | 'RECHAZADO';
}

interface SeccionRetirosProps {
  saldoDisponible: number;
  historialRetiros: Retiro[];
  onRequestRetiro: (monto: number) => void;
}

export const SeccionRetiros: React.FC<SeccionRetirosProps> = ({
  saldoDisponible,
  historialRetiros,
  onRequestRetiro,
}) => {
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');

  const feeCalculado = (parseFloat(monto) || 0) * 0.10;
  const netoRecibir = Math.max(0, (parseFloat(monto) || 0) - feeCalculado);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseFloat(monto);
    if (isNaN(valor) || valor <= 0) {
      setError('Monto inválido.');
      return;
    }
    if (valor > saldoDisponible) {
      setError('Saldo acumulado insuficiente.');
      return;
    }
    setError('');
    onRequestRetiro(valor);
    setMonto('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Solicitud de Retiro */}
      <div className="md:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Saldo Disponible</span>
              <span className="text-2xl font-black text-purple-950">${saldoDisponible.toFixed(2)} USD</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Monto a retirar (USD)</label>
              <input
                type="number"
                step="0.01"
                required
                max={saldoDisponible}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>

            {parseFloat(monto) > 0 && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs space-y-1.5 text-purple-900">
                <div className="flex justify-between font-semibold">
                  <span>Comisión Admin (10%)</span>
                  <span>-${feeCalculado.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm border-t border-purple-200/50 pt-1.5">
                  <span>Total a Recibir</span>
                  <span>${netoRecibir.toFixed(2)} USD</span>
                </div>
              </div>
            )}

            {error && <p className="text-xs font-bold text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={saldoDisponible <= 0 || !monto}
              className={`w-full py-2.5 rounded-xl font-bold uppercase tracking-wider text-white transition-all text-xs ${
                saldoDisponible > 0 && monto
                  ? 'bg-purple-700 hover:bg-purple-800 shadow-md shadow-purple-600/10'
                  : 'bg-slate-300 cursor-not-allowed shadow-none'
              }`}
            >
              Solicitar Retiro
            </button>

            <span className="text-[10px] text-slate-400 block text-center leading-normal">
              * El retiro se enviará a tus cuentas de cobro (Binance o banco local asignado) tras la aprobación del administrador.
            </span>
          </form>
        </div>
      </div>

      {/* Historial de Retiros */}
      <div className="md:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-950 text-white px-6 py-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            <h2 className="font-bold text-base">Historial de Retiros</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase">
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Monto Solicitado</th>
                  <th className="p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historialRetiros.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center p-8 text-slate-400 font-medium">
                      Aún no has solicitado retiros de caja.
                  </td>
                  </tr>
                ) : (
                  historialRetiros.map((ret) => (
                    <tr key={ret.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition">
                      <td className="p-4 text-xs font-semibold text-slate-600">
                        {ret.fecha}
                      </td>
                      <td className="p-4">
                        <span className="font-black text-slate-900 text-sm">${ret.monto.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Neto a recibir: ${ret.totalRecibir.toFixed(2)} (Fee: ${ret.fee.toFixed(2)})</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                          ret.estado === 'PAGADO' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : ret.estado === 'RECHAZADO'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {ret.estado}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
