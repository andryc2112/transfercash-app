import React, { useState } from 'react';
import { Clock, FileText, ArrowRight, Copy } from 'lucide-react';

interface Deposito {
  id: number;
  cliente: string;
  monto: number;
  ref: string;
  comprobanteUrl: string;
}

interface Remesa {
  id: number;
  origen: string;
  destino: string;
  montoOrigen: number;
  montoDestino: number;
  simboloOrigen: string;
  simboloDestino: string;
  cliente: string;
  cedula: string;
  fecha: string;
  tasaCompra?: number;
  beneficiarios: {
    banco: string;
    cuenta: string;
    telefono: string;
    titular: string;
    cedula: string;
    monto: number;
  }[];
}

interface TablaPendientesProps {
  depositos: Deposito[];
  remesas: Remesa[];
  onApproveDeposito: (id: number, binanceRef: string, BinanceTasa: number) => void;
  onApproveRemesa: (id: number, bancoRef: string, binanceRef: string, binanceTasa: number, comprobantePagoFile?: File) => void;
  showWallet?: boolean;
  onViewTracking?: (remesa: Remesa) => void;
}

export const TablaPendientes: React.FC<TablaPendientesProps> = ({
  depositos,
  remesas,
  onApproveDeposito,
  onApproveRemesa,
  showWallet = true,
  onViewTracking
}) => {
  const [selectedDeposito, setSelectedDeposito] = useState<Deposito | null>(null);
  const [selectedRemesa, setSelectedRemesa] = useState<Remesa | null>(null);

  // Estados de gestos de deslizamiento (Swipe to action)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [activeSwipeId, setActiveSwipeId] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  const handleTouchStart = (e: React.TouchEvent, id: number) => {
    setTouchStart(e.targetTouches[0].clientX);
    setActiveSwipeId(id);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 180)); // tope de 180px
    }
  };

  const handleTouchEnd = (rem: any) => {
    setTouchStart(null);
    if (swipeOffset > 110) {
      setSelectedRemesa(rem);
    }
    setSwipeOffset(0);
    setActiveSwipeId(null);
  };

  // Inputs para el modal de depósito
  const [depTasaCompra, setDepTasaCompra] = useState('1.0');
  const [depRefBinance, setDepRefBinance] = useState('');

  // Inputs para el modal de remesa
  const [remRefEmisor, setRemRefEmisor] = useState('');
  const [remTasaVentaUsdt, setRemTasaVentaUsdt] = useState('1.0');
  const [remRefBinanceVenta, setRemRefBinanceVenta] = useState('');
  const [remComprobanteFile, setRemComprobanteFile] = useState<File | undefined>(undefined);

  const handleRemComprobanteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRemComprobanteFile(e.target.files[0]);
    }
  };

  const handleApproveDepositoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDeposito) {
      onApproveDeposito(
        selectedDeposito.id,
        depRefBinance,
        parseFloat(depTasaCompra) || 1.0
      );
      setSelectedDeposito(null);
      setDepRefBinance('');
      setDepTasaCompra('1.0');
    }
  };

  const handleApproveRemesaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRemesa) {
      onApproveRemesa(
        selectedRemesa.id,
        remRefEmisor,
        remRefBinanceVenta,
        parseFloat(remTasaVentaUsdt) || 1.0,
        remComprobanteFile
      );
      setSelectedRemesa(null);
      setRemRefEmisor('');
      setRemRefBinanceVenta('');
      setRemTasaVentaUsdt('1.0');
      setRemComprobanteFile(undefined);
    }
  };

  const getProfitStatus = () => {
    if (!selectedRemesa) return null;
    const tCompra = selectedRemesa.tasaCompra || 1.0;
    const tVenta = parseFloat(remTasaVentaUsdt) || 0;
    if (tVenta <= 0) return null;

    const usdIn = tCompra > 0 ? selectedRemesa.montoOrigen / tCompra : 0;
    const usdOut = selectedRemesa.montoDestino / tVenta;
    const profit = usdIn - usdOut;
    const profitPct = usdIn > 0 ? (profit / usdIn) * 100 : 0;

    if (profit < 0) {
      return <div className="text-red-600 text-[10px] font-bold mt-1.5 bg-red-50 p-2 rounded-lg border border-red-200 shadow-sm">⚠️ ALERTA: Esta tasa genera una PÉRDIDA de ${Math.abs(profit).toFixed(2)} USD ({profitPct.toFixed(1)}%)</div>;
    } else if (profitPct < 2) {
      return <div className="text-amber-600 text-[10px] font-bold mt-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200 shadow-sm">⚠️ ATENCIÓN: Rentabilidad baja. Ganancia: ${profit.toFixed(2)} USD ({profitPct.toFixed(1)}%)</div>;
    } else {
      return <div className="text-emerald-600 text-[10px] font-bold mt-1.5 bg-emerald-50 p-2 rounded-lg border border-emerald-200 shadow-sm">✅ Rentabilidad saludable: +${profit.toFixed(2)} USD ({profitPct.toFixed(1)}%)</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* SECCIÓN 1: RECARGAS WEB */}
      {showWallet && depositos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 text-white px-6 py-4 flex items-center gap-2">
            <Clock className="w-5 h-5 animate-pulse" />
            <h2 className="font-bold text-lg">📥 Recargas Web por Verificar</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase">
                  <th className="p-4">Cliente / Ref</th>
                  <th className="p-4">Monto a Recargar</th>
                  <th className="p-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {depositos.map((dep) => (
                  <tr key={dep.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{dep.cliente}</span>
                      <span className="text-xs text-slate-400">Banco Ref: {dep.ref}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-black text-emerald-600 text-base">+${dep.monto.toFixed(2)} USD</span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedDeposito(dep)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md shadow-emerald-600/10"
                      >
                        Verificar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: REMESAS PENDIENTES */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 text-white px-6 py-4 flex items-center gap-2">
          <Clock className="w-5 h-5 animate-pulse" />
          <h2 className="font-bold text-lg">💸 Pagos de Remesas Pendientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase">
                <th className="p-4">Ruta (Operación)</th>
                <th className="p-4">Monto Destino</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {remesas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-slate-400 font-medium">
                    No tienes remesas pendientes de pago en tu país.
                  </td>
                </tr>
              ) : (
                remesas.map((rem) => (
                  <tr key={rem.id} className="border-b border-slate-100 last:border-b-0 relative overflow-hidden">
                    <td colSpan={3} className="p-0 relative bg-slate-900 overflow-hidden">
                      {/* Swipe Action Background Drawer */}
                      <div className="absolute inset-y-0 left-0 bg-indigo-600 flex items-center px-8 text-white text-xs font-black uppercase pointer-events-none tracking-widest gap-2">
                        <span>💸</span>
                        <span>Pagar</span>
                      </div>

                      {/* Swipable Row Content */}
                      <div
                        onTouchStart={(e) => handleTouchStart(e, rem.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={() => handleTouchEnd(rem)}
                        style={{
                          transform: activeSwipeId === rem.id ? `translateX(${swipeOffset}px)` : 'translateX(0px)',
                          transition: touchStart === null ? 'transform 0.2s ease-out' : 'none'
                        }}
                        className="bg-white flex justify-between items-center w-full p-4 relative z-10 select-none cursor-grab active:cursor-grabbing"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                            <span>{rem.origen}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span>{rem.destino}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">{rem.fecha}</span>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-indigo-600 text-base block">
                            {rem.simboloDestino} {rem.montoDestino.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            In: {rem.simboloOrigen} {rem.montoOrigen.toFixed(2)}
                          </span>
                        </div>

                        <div className="pl-4 flex gap-2">
                          <button
                            onClick={() => onViewTracking && onViewTracking(rem)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-extrabold uppercase tracking-wide px-3.5 py-2 rounded-xl transition shadow-sm"
                          >
                            🔍 Detalle
                          </button>
                          <button
                            onClick={() => setSelectedRemesa(rem)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold uppercase tracking-wide px-3.5 py-2 rounded-xl transition shadow-md shadow-indigo-600/10"
                          >
                            Pagar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: PROCESAR RECARGA (DEPÓSITO) */}
      {selectedDeposito && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-lg">Aprobar Recarga de Billetera</h3>
              <button
                onClick={() => setSelectedDeposito(null)}
                className="text-white hover:text-emerald-100 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleApproveDepositoSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase">Cliente</span>
                  <span className="font-bold text-slate-900">{selectedDeposito.cliente}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200/65">
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase">Monto</span>
                    <span className="font-black text-emerald-600 text-lg">${selectedDeposito.monto.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase">Ref. Bancaria</span>
                    <span className="font-mono text-sm text-slate-700 font-bold">{selectedDeposito.ref}</span>
                  </div>
                </div>
              </div>

              {selectedDeposito.comprobanteUrl && (
                <div className="text-center">
                  <a
                    href={selectedDeposito.comprobanteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <FileText className="w-4 h-4" /> Ver Comprobante Subido (Capture)
                  </a>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tasa Compra USDT (P2P)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={depTasaCompra}
                    onChange={(e) => setDepTasaCompra(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Referencia Compra Binance</label>
                  <input
                    type="text"
                    required
                    value={depRefBinance}
                    onChange={(e) => setDepRefBinance(e.target.value)}
                    placeholder="Ej: Binance Order ID"
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedDeposito(null)}
                  className="w-1/3 py-2.5 rounded-lg font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-lg shadow-emerald-600/20"
                >
                  Validar y Acreditar ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROCESAR PAGO REMESA */}
      {selectedRemesa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-lg">Liquidar Remesa (Egreso)</h3>
              <button
                onClick={() => setSelectedRemesa(null)}
                className="text-white hover:text-indigo-100 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleApproveRemesaSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    Ruta: <strong className="text-indigo-950">{selectedRemesa.origen} ➔ {selectedRemesa.destino}</strong>
                  </span>
                  <span>
                    Remitente: <strong className="text-indigo-950">{selectedRemesa.cliente}</strong>
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-indigo-200/50">
                  <span className="font-bold text-slate-500">Monto a Entregar</span>
                  <span className="font-black text-indigo-700 text-xl">
                    {selectedRemesa.simboloDestino} {selectedRemesa.montoDestino.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Beneficiarios */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Cuentas Destino (Beneficiarios)</span>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {selectedRemesa.beneficiarios.map((b, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between text-slate-800 font-bold mb-1">
                        <span>🏦 {b.banco}</span>
                        <span className="text-emerald-600">{selectedRemesa.simboloDestino} {b.monto.toFixed(2)}</span>
                      </div>
                      <div className="text-slate-500 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p>Cuenta: <span className="font-mono font-bold text-slate-700">{b.cuenta}</span></p>
                          <button type="button" onClick={() => navigator.clipboard.writeText(b.cuenta)} className="opacity-50 hover:opacity-100 p-1 hover:bg-indigo-100 rounded text-indigo-600 transition" title="Copiar Cuenta"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p>Titular: <span className="font-bold text-slate-700">{b.titular}</span></p>
                          <button type="button" onClick={() => navigator.clipboard.writeText(b.titular)} className="opacity-50 hover:opacity-100 p-1 hover:bg-indigo-100 rounded text-indigo-600 transition" title="Copiar Titular"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p>Doc/DNI: <span className="font-bold text-slate-700">{b.cedula}</span></p>
                          <button type="button" onClick={() => navigator.clipboard.writeText(b.cedula)} className="opacity-50 hover:opacity-100 p-1 hover:bg-indigo-100 rounded text-indigo-600 transition" title="Copiar DNI"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                        {b.telefono && (
                          <div className="flex items-center justify-between gap-2">
                            <p>Teléfono: <span className="font-bold text-slate-700">{b.telefono}</span></p>
                            <button type="button" onClick={() => navigator.clipboard.writeText(b.telefono)} className="opacity-50 hover:opacity-100 p-1 hover:bg-indigo-100 rounded text-indigo-600 transition" title="Copiar Teléfono"><Copy className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 mt-1">
                          <p>Monto a transferir: <span className="font-bold text-emerald-600">{b.monto.toFixed(2)}</span></p>
                          <button type="button" onClick={() => navigator.clipboard.writeText(b.monto.toFixed(2))} className="opacity-50 hover:opacity-100 p-1 hover:bg-emerald-100 rounded text-emerald-600 transition" title="Copiar Monto"><Copy className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lógica de Liquidación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Referencia Banco Emisor</label>
                  <input
                    type="text"
                    required
                    value={remRefEmisor}
                    onChange={(e) => setRemRefEmisor(e.target.value)}
                    placeholder="Ej: Nro de Transferencia"
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Tasa Venta USDT (Binance)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={remTasaVentaUsdt}
                    onChange={(e) => setRemTasaVentaUsdt(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {getProfitStatus()}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Referencia Binance Venta</label>
                <input
                  type="text"
                  required
                  value={remRefBinanceVenta}
                  onChange={(e) => setRemRefBinanceVenta(e.target.value)}
                  placeholder="Ej: Binance Order ID de venta"
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Capture / Comprobante (Opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRemComprobanteFileChange}
                  className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSelectedRemesa(null)}
                  className="w-1/3 py-2.5 rounded-lg font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/20"
                >
                  Registrar Pago Completado ✅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
