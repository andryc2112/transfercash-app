import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Check, AlertCircle } from 'lucide-react';

export interface PaisData {
  nombre: string;
  simbolo: string;
  flag: string;
  compra: number;
  venta: number;
  color: string;
}

export const defaultPaisesData: Record<string, PaisData> = {
  VE: { nombre: 'Venezuela', simbolo: 'VES', flag: '🇻🇪', compra: 36.5, venta: 38.2, color: '#c0392b' },
  PE: { nombre: 'Perú', simbolo: 'PEN', flag: '🇵🇪', compra: 3.72, venta: 3.85, color: '#c0392b' },
  CO: { nombre: 'Colombia', simbolo: 'COP', flag: '🇨🇴', compra: 3850, venta: 4100, color: '#f1c40f' },
  CL: { nombre: 'Chile', simbolo: 'CLP', flag: '🇨🇱', compra: 920, venta: 960, color: '#2980b9' },
  AR: { nombre: 'Argentina', simbolo: 'ARS', flag: '🇦🇷', compra: 950, venta: 1200, color: '#3498db' },
  ES: { nombre: 'España', simbolo: 'EUR', flag: '🇪🇸', compra: 0.92, venta: 0.94, color: '#e67e22' },
  BR: { nombre: 'Brasil', simbolo: 'BRL', flag: '🇧🇷', compra: 5.25, venta: 5.50, color: '#27ae60' },
  DO: { nombre: 'Rep. Dom', simbolo: 'DOP', flag: '🇩🇴', compra: 58.5, venta: 59.8, color: '#2980b9' },
  PA: { nombre: 'Panamá', simbolo: 'USD', flag: '🇵🇦', compra: 1.0, venta: 1.0, color: '#2c3e50' },
  US: { nombre: 'USA', simbolo: 'USD', flag: '🇺🇸', compra: 1.0, venta: 1.0, color: '#2c3e50' },
  ZI: { nombre: 'Zinli', simbolo: 'USD', flag: '📱', compra: 1.0, venta: 1.0, color: '#8e44ad' },
  WA: { nombre: 'Wally', simbolo: 'USD', flag: '📲', compra: 1.0, venta: 1.0, color: '#8e44ad' },
  AI: { nombre: 'Airtm', simbolo: 'USDC', flag: '☁️', compra: 1.0, venta: 1.0, color: '#2980b9' },
};

export const bancosDB: Record<string, string[]> = {
  'VE': ['Banesco', 'Banco de Venezuela', 'Mercantil', 'Provincial', 'BNC', 'Banco del Tesoro', 'Bicentenario', 'Banplus', 'Banco Plaza', 'Banco Exterior', 'Pago Móvil'],
  'CO': ['Bancolombia', 'Nequi', 'Daviplata', 'BBVA Colombia', 'Banco de Bogotá', 'Davivienda', 'Colpatria', 'Banco de Occidente', 'Banco Popular', 'Banco AV Villas', 'Caja Social', 'Lulo Bank', 'Dale!'],
  'PE': ['BCP (Crédito)', 'Interbank', 'BBVA Perú', 'Scotiabank', 'Yape', 'Plin', 'Banco de la Nación', 'BanBif', 'Banco Pichincha', 'Caja Arequipa', 'Caja Huancayo'],
  'CL': ['BancoEstado (CuentaRUT)', 'Santander', 'Banco de Chile', 'Falabella', 'BCI', 'Tenpo', 'Mach', 'Scotiabank', 'Itaú Chile', 'Banco Security', 'Banco BICE', 'Coopeuch'],
  'AR': ['MercadoPago', 'Brubank', 'Ualá', 'Santander Río', 'Galicia', 'BBVA Francés', 'Banco Nación', 'Macro', 'Banco Provincia', 'ICBC', 'Supervielle', 'Naranja X', 'Personal Pay', 'Prex'],
  'ES': ['BBVA', 'Santander', 'CaixaBank', 'Revolut', 'Bizum', 'ING', 'Sabadell', 'Bankinter', 'Kutxabank', 'Abanca', 'Unicaja', 'N26', 'Openbank'],
  'BR': ['Pix', 'Nubank', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa Econômica', 'Inter', 'Santander Brasil', 'C6 Bank', 'PicPay', 'Mercado Pago', 'PagBank'],
  'DO': ['Banreservas', 'Banco Popular', 'BHD León', 'Scotiabank', 'Promerica', 'Qik Banco Digital', 'Banco Santa Cruz', 'Asociación Popular (APAP)'],
  'PA': ['Banco General (Yappy)', 'Banistmo', 'Bac Credomatic', 'Global Bank', 'Multibank', 'Scotiabank', 'Caja de Ahorros', 'Banesco Panamá', 'Nequi Panamá'],
  'US': ['Zelle', 'Bank of America', 'Wells Fargo', 'Chase', 'Citibank', 'PNC', 'Capital One', 'US Bank', 'Truist', 'TD Bank', 'Cash App', 'Venmo', 'PayPal'],
  'ZI': ['Zinli (Correo Electrónico)'],
  'WA': ['Wally Tech (Número de Teléfono)'],
  'AI': ['Airtm (Correo Electrónico)']
};

interface CalculadoraRemesaProps {
  onRegisterOperation?: (data: any) => Promise<boolean>;
  onBuscarCliente?: (cedula: string) => Promise<any>;
  showWallet?: boolean;
  paisesData?: Record<string, PaisData>;
  margen?: number;
  binanceMarketRates?: Record<string, { compra: number; venta: number }>;
}

export const CalculadoraRemesa: React.FC<CalculadoraRemesaProps> = ({
  onRegisterOperation,
  onBuscarCliente,
  showWallet = true,
  paisesData = defaultPaisesData,
  margen = 5.0,
  binanceMarketRates
}) => {
  // Recuperar borrador de la memoria si existe
  const getDraft = () => JSON.parse(localStorage.getItem('tc_draft_remesa') || '{}');

  const [paisOrigen, setPaisOrigen] = useState(() => getDraft().paisOrigen || 'ES');
  const [paisDestino, setPaisDestino] = useState(() => getDraft().paisDestino || 'VE');
  const [montoOrigen, setMontoOrigen] = useState(() => getDraft().montoOrigen || '100');
  const [montoDestino, setMontoDestino] = useState(() => getDraft().montoDestino || '');
  const [usarWallet, setUsarWallet] = useState(() => getDraft().usarWallet || false);
  const [tasaVenta, setTasaVenta] = useState(() => getDraft().tasaVenta || '0');
  const [clienteDoc, setClienteDoc] = useState(() => getDraft().clienteDoc || '');
  const [clienteNombre, setClienteNombre] = useState(() => getDraft().clienteNombre || '');
  const [clienteTlf, setClienteTlf] = useState(() => getDraft().clienteTlf || '');
  const [clienteEmail, setClienteEmail] = useState(() => getDraft().clienteEmail || '');
  const [beneficiarios, setBeneficiarios] = useState<any[]>(() => getDraft().beneficiarios || [
    { banco: '', cuenta: '', telefono: '', titular: '', cedula: '', monto: '' }
  ]);
  const [walletSaldo, setWalletSaldo] = useState<number | null>(null);

  // Autoguardado (Memoria del formulario en tiempo real)
  useEffect(() => {
    const draft = {
      paisOrigen, paisDestino, montoOrigen, montoDestino,
      usarWallet, tasaVenta, clienteDoc, clienteNombre,
      clienteTlf, clienteEmail, beneficiarios
    };
    localStorage.setItem('tc_draft_remesa', JSON.stringify(draft));
  }, [paisOrigen, paisDestino, montoOrigen, montoDestino, usarWallet, tasaVenta, clienteDoc, clienteNombre, clienteTlf, clienteEmail, beneficiarios]);

  const handleClearForm = (skipConfirm = false) => {
    if (skipConfirm || window.confirm('¿Estás seguro de que deseas limpiar todos los datos del formulario?')) {
      setPaisOrigen('ES');
      setPaisDestino('VE');
      setMontoOrigen('100');
      setMontoDestino('');
      setUsarWallet(false);
      setTasaVenta('0');
      setClienteDoc('');
      setClienteNombre('');
      setClienteTlf('');
      setClienteEmail('');
      setBeneficiarios([{ banco: '', cuenta: '', telefono: '', titular: '', cedula: '', monto: '' }]);
      setWalletSaldo(null);
    }
  };

  // Historial local de beneficiarios para autocompletado automático
  const [beneficiariosHistoricos, setBeneficiariosHistoricos] = useState<any[]>(() => {
    const local = localStorage.getItem('tc_beneficiarios_historicos');
    return local ? JSON.parse(local) : [
      { cedula: 'V-9876543', titular: 'María Fernández', banco: 'Banesco', cuenta: '0102-0100-22-1234567890', telefono: '04141234567' },
      { cedula: 'V-7654321', titular: 'José Pérez', banco: 'Mercantil', cuenta: '0105-0200-33-0987654321', telefono: '04127654321' }
    ];
  });


  // Búsqueda real de cliente en base de datos
  const buscarCliente = async () => {
    if (clienteDoc.length >= 4 && onBuscarCliente) {
      const cli = await onBuscarCliente(clienteDoc);
      if (cli) {
        setClienteNombre(cli.nombre || '');
        setClienteTlf(cli.telefono || '');
        setClienteEmail(cli.email || '');
        setWalletSaldo(cli.wallet_saldo || 0);
      } else {
        setClienteNombre('');
        setClienteTlf('');
        setClienteEmail('');
        setWalletSaldo(0);
      }
    }
  };

  useEffect(() => {
    calcularDesdeOrigen();
  }, [paisOrigen, paisDestino, montoOrigen, margen, usarWallet]);

  useEffect(() => {
    if (!showWallet) {
      setUsarWallet(false);
    }
  }, [showWallet]);

  const calcularDesdeOrigen = () => {
    const origData = paisesData[paisOrigen];
    const destData = paisesData[paisDestino];
    const monto = parseFloat(montoOrigen);

    if (!isNaN(monto) && origData && destData && origData.compra > 0) {
      let usdt = 0;
      if (usarWallet) {
        // 1 a 1 ya que se descuenta en USD directamente de la wallet
        usdt = monto;
      } else {
        usdt = monto / origData.compra;
      }
      const bruto = usdt * destData.venta;
      const neto = bruto * (1 - margen / 100);
      const netoStr = neto.toFixed(2);
      setMontoDestino(netoStr);

      setBeneficiarios(prev => {
        if (prev.length === 1) {
          return [{ ...prev[0], monto: netoStr }];
        }
        return prev;
      });

      const tasaImpl = neto / (usarWallet ? 1 : monto);
      setTasaVenta(tasaImpl.toFixed(6));
    }
  };

  const handleMontoDestinoChange = (val: string) => {
    setMontoDestino(val);
    setBeneficiarios(prev => {
      if (prev.length === 1) {
        return [{ ...prev[0], monto: val }];
      }
      return prev;
    });

    const origData = paisesData[paisOrigen];
    const destData = paisesData[paisDestino];
    const montoDest = parseFloat(val);

    if (!isNaN(montoDest) && origData && destData && destData.venta > 0) {
      const bruto = montoDest / (1 - margen / 100);
      const usdt = bruto / destData.venta;
      let montoOrig = 0;
      if (usarWallet) {
        montoOrig = usdt;
      } else {
        montoOrig = usdt * origData.compra;
      }
      setMontoOrigen(montoOrig.toFixed(2));

      const tasaImpl = montoDest / (usarWallet ? usdt : montoOrig);
      setTasaVenta(tasaImpl.toFixed(6));
    }
  };

  const handleAddBeneficiario = () => {
    const totalDestino = parseFloat(montoDestino) || 0;
    const asignado = beneficiarios.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
    const sugerido = Math.max(0, totalDestino - asignado);

    setBeneficiarios([
      ...beneficiarios,
      { banco: '', cuenta: '', telefono: '', titular: '', cedula: '', monto: sugerido.toFixed(2) }
    ]);
  };

  const handleRemoveBeneficiario = (index: number) => {
    setBeneficiarios(beneficiarios.filter((_, i) => i !== index));
  };

  const handleBeneficiarioChange = (index: number, field: string, value: string) => {
    const updated = [...beneficiarios];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'cedula' && value.length >= 4) {
      const match = beneficiariosHistoricos.find(
        (b) => b.cedula.toLowerCase().trim() === value.toLowerCase().trim()
      );
      if (match) {
        updated[index] = {
          ...updated[index],
          banco: match.banco,
          cuenta: match.cuenta,
          titular: match.titular,
          telefono: match.telefono || '',
        };
      }
    }

    setBeneficiarios(updated);
  };

  const isMetodoDigital = (bancoNombre: string) => {
    if (!bancoNombre) return false;
    const metodosDigitales = [
      'Pago Móvil', 'Nequi', 'Daviplata', 'Yape', 'Plin', 'Yappy',
      'Zelle', 'Cash App', 'Venmo', 'PayPal', 'Zinli', 'Wally', 'Airtm',
      'Bizum', 'Tenpo', 'Mach', 'MercadoPago', 'Ualá', 'Brubank', 'Naranja X'
    ];
    return metodosDigitales.some(m => bancoNombre.toLowerCase().includes(m.toLowerCase()));
  };

  const totalBeneficiariosMonto = beneficiarios.reduce(
    (acc, curr) => acc + (parseFloat(curr.monto) || 0),
    0
  );

  const diferenciaDistribucion = (parseFloat(montoDestino) || 0) - totalBeneficiariosMonto;
  const isDistribucionCompleta = Math.abs(diferenciaDistribucion) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guardar los beneficiarios de la transacción en el historial del navegador
    setBeneficiariosHistoricos(prev => {
      const updated = [...prev];
      beneficiarios.forEach(b => {
        if (b.cedula) {
          const exists = updated.some(
            h => h.cedula.toLowerCase().trim() === b.cedula.toLowerCase().trim()
          );
          if (!exists) {
            updated.push({
              cedula: b.cedula,
              titular: b.titular,
              banco: b.banco,
              cuenta: b.cuenta,
              telefono: b.telefono
            });
          }
        }
      });
      localStorage.setItem('tc_beneficiarios_historicos', JSON.stringify(updated));
      return updated;
    });

    if (onRegisterOperation) {
      const success = await onRegisterOperation({
        paisOrigen: usarWallet ? 'Billetera (Web)' : paisOrigen,
        paisDestino,
        montoOrigen: parseFloat(montoOrigen),
        montoDestino: parseFloat(montoDestino),
        tasaVenta: parseFloat(tasaVenta),
        tasaCompra: usarWallet ? 1 : (paisesData[paisOrigen]?.compra || 1.0),
        clienteDoc,
        clienteNombre,
        clienteTlf,
        clienteEmail,
        beneficiarios,
        usarWallet,
      });

      if (success) {
        handleClearForm(true);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>💸</span> Registrar Nueva Operación
            </h2>
            <p className="text-slate-400 text-sm mt-1">Calculadora de remesas y billetera digital</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[10px] bg-indigo-50 px-2 py-1 rounded text-indigo-700 font-bold uppercase border border-indigo-100">
              Operación Directa
            </span>
            <button
              type="button"
              onClick={() => handleClearForm(false)}
              className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded font-bold uppercase transition flex items-center gap-1"
            >
              🗑️ Limpiar Datos
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SECCIÓN 1: CLIENTE */}
          <div className="space-y-4">
            <h3 className="text-slate-900 font-bold border-b pb-2 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              Datos del Cliente Remitente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Documento / Cédula</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={clienteDoc}
                    onChange={(e) => setClienteDoc(e.target.value)}
                    placeholder="Ej: 12345678"
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={buscarCliente}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 rounded-lg transition"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  required
                  value={clienteTlf}
                  onChange={(e) => setClienteTlf(e.target.value)}
                  placeholder="Ej: +58412..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {showWallet && walletSaldo !== null && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-purple-700 text-xs font-bold uppercase tracking-wider block">Billetera Virtual del Cliente</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-purple-950">${walletSaldo.toFixed(2)}</span>
                    <span className="text-xs text-purple-600">USD de saldo disponible</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {walletSaldo > 0 && (
                    <label className="flex items-center gap-2 bg-purple-900 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-purple-800 transition text-sm font-bold shadow-md">
                      <input
                        type="checkbox"
                        checked={usarWallet}
                        onChange={(e) => setUsarWallet(e.target.checked)}
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      Cobrar de la Billetera
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: CALCULADORA DE ARBITRAJE */}
          <div className="space-y-4">
            <h3 className="text-slate-900 font-bold border-b pb-2 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              Cálculo de Conversión (Arbitraje)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
              {/* Bloque Origen */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block">Origen (Dinero Recibido)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      disabled={usarWallet}
                      value={paisOrigen}
                      onChange={(e) => setPaisOrigen(e.target.value)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {Object.entries(paisesData).map(([code, info]) => (
                        <option key={code} value={code}>
                          {info.flag} {code} ({info.simbolo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={montoOrigen}
                      onChange={(e) => setMontoOrigen(e.target.value)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2.5 pr-12 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute right-3 top-3 text-xs font-bold text-slate-400">
                      {usarWallet ? 'USD' : paisesData[paisOrigen]?.simbolo}
                    </span>
                  </div>
                </div>
                {!usarWallet && (
                  <div className="text-xs text-slate-400 mt-1">
                    Tasa de Compra Binance: <span className="font-semibold text-slate-600">{paisesData[paisOrigen]?.compra}</span>
                  </div>
                )}
              </div>

              {/* Bloque Destino */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block">Destino (Monto Prometido)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <select
                      value={paisDestino}
                      onChange={(e) => setPaisDestino(e.target.value)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {Object.entries(paisesData)
                        .filter(([code]) => code !== paisOrigen)
                        .map(([code, info]) => (
                          <option key={code} value={code}>
                            {info.flag} {code} ({info.simbolo})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-2 relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={montoDestino}
                      onChange={(e) => handleMontoDestinoChange(e.target.value)}
                      className="w-full bg-white rounded-lg border border-slate-200 p-2.5 pr-12 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="absolute right-3 top-3 text-xs font-bold text-slate-400">
                      {paisesData[paisDestino]?.simbolo}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Tasa de Venta Binance: <span className="font-semibold text-slate-600">{paisesData[paisDestino]?.venta}</span>
                </div>
              </div>
            </div>

            {/* Display Tasa de Cambio Implícita */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-indigo-950 font-semibold">
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Tasa de Venta Aplicada:
                </span>
                <span className="text-indigo-700 font-extrabold text-base">
                  1 {usarWallet ? 'USD' : paisesData[paisOrigen]?.simbolo} = {parseFloat(tasaVenta).toFixed(4)} {paisesData[paisDestino]?.simbolo}
                </span>
              </div>
              {binanceMarketRates && binanceMarketRates[paisDestino] && (
                <div className="flex justify-between px-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Referencia Binance Mercado ({paisesData[paisDestino]?.flag}):</span>
                  <span className="text-indigo-600 font-extrabold">
                    1 USD = {binanceMarketRates[paisDestino].venta.toFixed(2)} {paisesData[paisDestino]?.simbolo}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 3: BENEFICIARIOS */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-slate-900 font-bold flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                Distribución de Cuentas Destino
              </h3>
              <button
                type="button"
                onClick={handleAddBeneficiario}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-md"
              >
                + Añadir Cuenta
              </button>
            </div>

            <div className="space-y-4">
              {beneficiarios.map((b, idx) => {
                const isDigital = isMetodoDigital(b.banco);

                return (
                  <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 transition-all">
                    {beneficiarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBeneficiario(idx)}
                        className="absolute right-4 top-4 text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        Remover
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Banco Beneficiario</label>
                        <select
                          required
                          value={b.banco}
                          onChange={(e) => handleBeneficiarioChange(idx, 'banco', e.target.value)}
                          className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="">Seleccione Banco...</option>
                          {(bancosDB[paisDestino] || []).map((bancoName) => (
                            <option key={bancoName} value={bancoName}>{bancoName}</option>
                          ))}
                          {b.banco && !(bancosDB[paisDestino] || []).includes(b.banco) && b.banco !== 'Otro' && (
                            <option value={b.banco}>{b.banco}</option>
                          )}
                          <option value="Otro">Otro (Especificar en cuenta)</option>
                        </select>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className={`text-xs font-bold uppercase transition-colors ${isDigital ? 'text-indigo-600' : 'text-slate-500'}`}>
                          {isDigital ? 'Número de Teléfono / Correo' : 'Número de Cuenta'}
                        </label>
                        <input
                          type="text"
                          required
                          value={b.cuenta}
                          onChange={(e) => handleBeneficiarioChange(idx, 'cuenta', e.target.value)}
                          placeholder={isDigital ? 'Ej: +58412... o usuario@email.com' : 'Ej: 0102-0000...'}
                          className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                    <div className={`grid grid-cols-1 ${isDigital ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Titular Cuenta</label>
                        <input
                          type="text"
                          required
                          value={b.titular}
                          onChange={(e) => handleBeneficiarioChange(idx, 'titular', e.target.value)}
                          className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Cédula / DNI</label>
                        <input
                          type="text"
                          required
                          value={b.cedula}
                          onChange={(e) => handleBeneficiarioChange(idx, 'cedula', e.target.value)}
                          className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      {!isDigital && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Teléfono (Opcional)</label>
                          <input
                            type="text"
                            value={b.telefono}
                            onChange={(e) => handleBeneficiarioChange(idx, 'telefono', e.target.value)}
                            className="w-full bg-white rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Monto a Enviar</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={b.monto}
                            onChange={(e) => handleBeneficiarioChange(idx, 'monto', e.target.value)}
                            className="w-full bg-white rounded-lg border border-slate-200 p-2 pr-10 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                            {paisesData[paisDestino]?.simbolo}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cuadro de comprobación de la distribución */}
            <div className={`p-4 rounded-xl border flex items-center justify-between text-sm transition-colors ${isDistribucionCompleta
              ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
              : 'bg-amber-50 border-amber-100 text-amber-900'
              }`}>
              <div className="flex items-center gap-2">
                {isDistribucionCompleta ? (
                  <Check className="w-5 h-5 text-emerald-500 font-extrabold" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                <div>
                  <span className="font-bold block">
                    {isDistribucionCompleta
                      ? 'Distribución Completada con éxito'
                      : 'Distribución incompleta'
                    }
                  </span>
                  <span className="text-xs opacity-80">
                    Monto Total: {montoDestino} | Asignado: {totalBeneficiariosMonto.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase opacity-70 block font-semibold">Diferencia</span>
                <span className="font-extrabold text-base">
                  {diferenciaDistribucion.toFixed(2)} {paisesData[paisDestino]?.simbolo}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isDistribucionCompleta}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider text-white transition-all shadow-lg ${isDistribucionCompleta
              ? 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md'
              : 'bg-slate-300 cursor-not-allowed shadow-none'
              }`}
          >
            Registrar Operación 🚀
          </button>
        </form>
      </div>
    </div>
  );
};
