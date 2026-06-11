import { useState, useEffect, useMemo } from 'react';
import { CalculadoraRemesa, defaultPaisesData } from './components/CalculadoraRemesa';
import type { PaisData } from './components/CalculadoraRemesa';
import { TablaPendientes } from './components/TablaPendientes';
import { SeccionRetiros } from './components/SeccionRetiros';
import { SeccionSan } from './components/SeccionSan';
import { GeneradorPlantilla } from './components/GeneradorPlantilla';
import { LogOut, Bell, AlertTriangle, Send, Settings } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AdminWorkspace } from './components/AdminWorkspace';
import type { Cliente, CajeroPerfil } from './components/AdminWorkspace';

interface Deposito {
  id: number;
  cliente: string;
  monto: number;
  ref: string;
  comprobanteUrl: string;
  cedula?: string;
  estado?: string;
  tasaCompra?: number;
  refBinance?: string;
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
  beneficiarios: {
    banco: string;
    cuenta: string;
    telefono: string;
    titular: string;
    cedula: string;
    monto: number;
  }[];
  telefono?: string;
  estado?: string;
  cajeroOrigen?: string;
  cajeroDestino?: string;
  tasaCompra?: number;
  tasaVenta?: number;
  refOrigen?: string;
  refBinanceCompra?: string;
  refDestino?: string;
  refBinanceVenta?: string;
  gananciaCalculada?: number;
  motivoCancelacion?: string;
}

interface Retiro {
  id: number;
  fecha: string;
  monto: number;
  fee: number;
  totalRecibir: number;
  estado: 'PAGADO' | 'PENDIENTE' | 'RECHAZADO';
  cajeroId?: string;
  cajeroName?: string;
}

interface GrupoSan {
  id: number;
  nombre: string;
  cuota: number;
  moneda: string;
  estado: 'ABIERTO' | 'EN PROGRESO';
  participantesCount: number;
  miTurno: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculadora' | 'pendientes' | 'retiros' | 'san' | 'plantilla'>('calculadora');
  const [cajeroPais] = useState('VE'); // Venezuela
  const [saldoAcumulado, setSaldoAcumulado] = useState(1280.45);
  const [reputacionSan, setReputacionSan] = useState(85);
  const [nivelSan, setNivelSan] = useState<'Bronce' | 'Plata' | 'Oro'>('Plata');

  // Margen global controlado por el Administrador
  const [margenGlobal, setMargenGlobal] = useState<number>(() => {
    const local = localStorage.getItem('tc_margenGlobal');
    return local ? parseFloat(local) : 5.0;
  });


  // Control de visibilidad del admin
  const [showSanTab, setShowSanTab] = useState<boolean>(() => {
    const local = localStorage.getItem('tc_showSanTab');
    return local ? local === 'true' : false;
  });
  const [showWalletFeatures, setShowWalletFeatures] = useState<boolean>(() => {
    const local = localStorage.getItem('tc_showWalletFeatures');
    return local ? local === 'true' : false;
  });
  const [paises, setPaises] = useState<Record<string, PaisData>>(() => {
    const local = localStorage.getItem('tc_paisesData');
    return local ? JSON.parse(local) : defaultPaisesData;
  });

  // Workspace Admin
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [cajeros, setCajeros] = useState<CajeroPerfil[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saldoEmpresa, setSaldoEmpresa] = useState(25.00);

  const [auditLogs, setAuditLogs] = useState<any[]>(() => {
    const local = localStorage.getItem('tc_auditLogs');
    return local ? JSON.parse(local) : [
      { id: 1, fecha: new Date(Date.now() - 3600000 * 2).toLocaleString(), usuario: 'Administrador', accion: 'Inicialización de tasas manuales del día' },
      { id: 2, fecha: new Date(Date.now() - 3600000).toLocaleString(), usuario: 'Administrador', accion: 'Activación de módulo de visibilidad de Billetera Digital' }
    ];
  });

  const [binanceMarketRates, setBinanceMarketRates] = useState<Record<string, { compra: number; venta: number }>>({
    VE: { compra: 38.10, venta: 38.65 },
    PE: { compra: 3.73, venta: 3.82 },
    CO: { compra: 3950, venta: 4180 },
    CL: { compra: 915, venta: 945 },
    AR: { compra: 990, venta: 1210 },
    ES: { compra: 0.92, venta: 0.94 },
    BR: { compra: 5.30, venta: 5.48 },
    DO: { compra: 58.7, venta: 59.9 },
    PA: { compra: 1.0, venta: 1.0 },
    US: { compra: 1.0, venta: 1.0 },
    ZI: { compra: 1.0, venta: 1.0 },
    WA: { compra: 1.0, venta: 1.0 },
    AI: { compra: 1.0, venta: 1.0 }
  });

  // Fluctuar ligeramente las tasas de Binance para simular realismo en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setBinanceMarketRates(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(code => {
          if (code === 'PA' || code === 'US' || code === 'ZI' || code === 'WA' || code === 'AI') return;
          const fluctuationPercent = (Math.random() - 0.5) * 0.004; // ±0.2%
          updated[code] = {
            compra: Number((updated[code].compra * (1 + fluctuationPercent)).toFixed(code === 'CO' || code === 'CL' || code === 'AR' ? 0 : 4)),
            venta: Number((updated[code].venta * (1 + fluctuationPercent)).toFixed(code === 'CO' || code === 'CL' || code === 'AR' ? 0 : 4))
          };
        });
        return updated;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Rastreo de alertas de desfase de tasas enviadas a Telegram
  const [paisesConAlertaEnviada, setPaisesConAlertaEnviada] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      Object.entries(paises).forEach(([code, info]) => {
        const marketVal = binanceMarketRates[code]?.venta || 0;
        if (marketVal > 0 && info.venta > 0) {
          const diff = Math.abs((info.venta - marketVal) / marketVal) * 100;
          const yaEnviada = paisesConAlertaEnviada[code] || false;

          if (diff > 1.5 && !yaEnviada) {
            const text = `🚨 *ALERTA: DESFASE DE TASA EN ${info.flag} ${info.nombre}* 🚨\n\n` +
              `• *Tasa Manual:* ${info.venta.toFixed(2)} ${info.simbolo}\n` +
              `• *Tasa Binance P2P:* ${marketVal.toFixed(2)} ${info.simbolo}\n` +
              `• *Desviación:* *${diff.toFixed(1)}%*\n\n` +
              `⚠️ _Se requiere atención administrativa para corregir el desfase en el sistema._`;

            fetch(`https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: '-5201919939',
                text,
                parse_mode: 'Markdown'
              })
            }).then(() => {
              setPaisesConAlertaEnviada(prev => ({ ...prev, [code]: true }));
            }).catch(e => console.error('Error enviando alerta de tasa a Telegram:', e));
          } else if (diff <= 1.5 && yaEnviada) {
            const text = `✅ *RESOLUCIÓN: TASA ALINEADA EN ${info.flag} ${info.nombre}* \n\n` +
              `• La tasa manual (${info.venta.toFixed(2)}) ya se encuentra alineada con Binance P2P (${marketVal.toFixed(2)} ${info.simbolo}) con un desfase menor al 1.5%.`;

            fetch(`https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: '-5201919939',
                text,
                parse_mode: 'Markdown'
              })
            }).then(() => {
              setPaisesConAlertaEnviada(prev => ({ ...prev, [code]: false }));
            }).catch(e => console.error('Error enviando resolución de tasa a Telegram:', e));
          }
        }
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [binanceMarketRates, paises, paisesConAlertaEnviada]);


  // Modo simulación vs Supabase Real
  const [isSimulationMode, setIsSimulationMode] = useState(true);

  // Notificaciones
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');

  // Estados de datos
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [remesas, setRemesas] = useState<Remesa[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [gruposSan] = useState<GrupoSan[]>([
    { id: 1, nombre: 'Ahorro Navideño 🎅', cuota: 20.00, moneda: 'USD', estado: 'EN PROGRESO', participantesCount: 10, miTurno: 4 },
    { id: 2, nombre: 'Caja Semanal Taquilla', cuota: 500.00, moneda: 'VES', estado: 'ABIERTO', participantesCount: 5, miTurno: 2 }
  ]);

  // Verificar la conexión de Supabase al iniciar
  useEffect(() => {
    const checkSupabaseConnection = () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!url || url.includes('placeholder-project') || !key || key.includes('placeholder-anon-key')) {
        // Credenciales sin configurar: Forzar modo simulación con datos de ejemplo
        setIsSimulationMode(true);
        cargarMocks();
      } else {
        // Intentar usar conexión real
        setIsSimulationMode(false);
        fetchDatosSupabase();
        suscribirseCambiosSupabase();
      }
    };

    checkSupabaseConnection();
  }, []);

  const cargarMocks = () => {
    // Cajeros mock
    const mockCajeros: CajeroPerfil[] = [
      { id: 'caj-1', nombre: 'Carlos Mendoza', email: 'carlos.m@transfercash.com', pais_operacion: 'VE', saldo_acumulado: 1280.45, reputacion_san: 85, nivel_san: 'Plata' },
      { id: 'caj-2', nombre: 'Ana Gómez', email: 'ana.g@transfercash.com', pais_operacion: 'ES', saldo_acumulado: 4320.10, reputacion_san: 98, nivel_san: 'Oro' },
      { id: 'caj-3', nombre: 'Juan Silva', email: 'juan.s@transfercash.com', pais_operacion: 'PE', saldo_acumulado: 950.00, reputacion_san: 70, nivel_san: 'Bronce' }
    ];
    setCajeros(mockCajeros);

    // Clientes mock
    setClientes([
      { id: 'cli-1', nombre: 'Juan Pérez', cedula_dni: '12345678', telefono: '+584121234567', email: 'juan.perez@email.com', wallet_saldo: 450.50 },
      { id: 'cli-2', nombre: 'Lucía Fernández', cedula_dni: 'V-20123456', telefono: '+34612345678', email: 'lucia.f@email.com', wallet_saldo: 0.00 }
    ]);

    setDepositos([
      {
        id: 101,
        cliente: 'Juan Pérez',
        cedula: '12345678',
        monto: 150.00,
        ref: 'REF-87429',
        comprobanteUrl: 'https://images.unsplash.com/photo-1616077168712-fc6c788bc4ee?q=80&w=400&auto=format&fit=crop',
        estado: 'PENDIENTE',
        tasaCompra: 1.0,
        refBinance: ''
      },
      {
        id: 102,
        cliente: 'Pedro Torres',
        cedula: '87654321',
        monto: 300.00,
        ref: 'REF-99881',
        comprobanteUrl: '',
        estado: 'PAGADO',
        tasaCompra: 1.0,
        refBinance: 'B-ORDER-8712'
      }
    ]);

    setRemesas([
      {
        id: 201,
        origen: 'ES',
        destino: 'VE',
        montoOrigen: 100.00,
        montoDestino: 3820.00,
        simboloOrigen: 'EUR',
        simboloDestino: 'VES',
        cliente: 'Lucía Fernández',
        cedula: 'V-20123456',
        telefono: '+34612345678',
        fecha: '11/06 09:15',
        estado: 'PENDIENTE',
        cajeroOrigen: 'Ana Gómez',
        cajeroDestino: 'Carlos Mendoza',
        tasaCompra: 0.92,
        tasaVenta: 38.2,
        refOrigen: 'REF-88219',
        refBinanceCompra: 'BIN-COMP-1',
        refDestino: '',
        refBinanceVenta: '',
        gananciaCalculada: 8.70,
        beneficiarios: [
          {
            banco: 'Banesco',
            cuenta: '0102-0100-22-1234567890',
            telefono: '04141234567',
            titular: 'María Fernández',
            cedula: 'V-9876543',
            monto: 3820.00
          }
        ]
      },
      {
        id: 202,
        origen: 'PE',
        destino: 'VE',
        montoOrigen: 400.00,
        montoDestino: 4050.00,
        simboloOrigen: 'PEN',
        simboloDestino: 'VES',
        cliente: 'Juan Pérez',
        cedula: '12345678',
        telefono: '+584121234567',
        fecha: '10/06 14:30',
        estado: 'PAGADO',
        cajeroOrigen: 'Juan Silva',
        cajeroDestino: 'Carlos Mendoza',
        tasaCompra: 3.72,
        tasaVenta: 38.2,
        refOrigen: 'REF-77112',
        refBinanceCompra: 'BIN-COMP-2',
        refDestino: 'REF-EM-9921',
        refBinanceVenta: 'BIN-VENT-2',
        gananciaCalculada: 22.45,
        beneficiarios: [
          {
            banco: 'Mercantil',
            cuenta: '0105-0200-33-0987654321',
            telefono: '04127654321',
            titular: 'José Pérez',
            cedula: 'V-7654321',
            monto: 4050.00
          }
        ]
      }
    ]);

    setRetiros([
      { id: 1, fecha: '05/06/2026', cajeroId: 'caj-1', cajeroName: 'Carlos Mendoza', monto: 100.00, fee: 10.00, totalRecibir: 90.00, estado: 'PAGADO' },
      { id: 2, fecha: '09/06/2026', cajeroId: 'caj-1', cajeroName: 'Carlos Mendoza', monto: 250.00, fee: 25.00, totalRecibir: 225.00, estado: 'PENDIENTE' }
    ]);
  };

  const fetchDatosSupabase = async () => {
    // 0. Fetch cajeros first to map names and details
    const { data: cajerosData } = await supabase
      .from('perfiles_cajeros')
      .select('*');

    const cajeroMap: Record<string, string> = {};
    if (cajerosData) {
      cajerosData.forEach((c: any) => {
        cajeroMap[c.id] = `${c.nombre} ${c.apellido}`;
      });
      setCajeros(cajerosData.map((c: any) => ({
        id: c.id,
        nombre: `${c.nombre} ${c.apellido}`,
        email: c.binance_email || 'cajero@transfercash.com',
        pais_operacion: c.pais_operacion,
        saldo_acumulado: parseFloat(c.saldo_acumulado) || 0,
        reputacion_san: c.reputacion_san || 0,
        nivel_san: c.nivel_san || 'Bronce',
      })));
    }

    // 0.1 Fetch clientes
    const { data: clientesData } = await supabase
      .from('clientes')
      .select('*');

    if (clientesData) {
      setClientes(clientesData.map((cli: any) => ({
        id: cli.id,
        nombre: cli.nombre,
        cedula_dni: cli.cedula_dni,
        telefono: cli.telefono || '',
        email: cli.email || '',
        wallet_saldo: parseFloat(cli.wallet_saldo) || 0,
      })));
    }

    // 1. Fetch depositos
    const { data: depData } = await supabase
      .from('depositos')
      .select('*, clientes(nombre, cedula_dni)')
      .order('created_at', { ascending: false });

    if (depData) {
      setDepositos(depData.map((d: any) => ({
        id: d.id,
        cliente: d.clientes?.nombre || 'Desconocido',
        cedula: d.clientes?.cedula_dni || 'N/A',
        monto: parseFloat(d.monto),
        ref: d.referencia_banco_receptor || 'N/A',
        comprobanteUrl: '',
        estado: d.estado,
        tasaCompra: parseFloat(d.tasa_compra_usdt) || 1.0,
        refBinance: d.referencia_compra_binance || ''
      })));
    }

    // 2. Fetch remesas
    const { data: remData } = await supabase
      .from('remesas')
      .select('*, clientes(nombre, cedula_dni, telefono), remesas_beneficiarios(*)')
      .order('created_at', { ascending: false });

    if (remData) {
      setRemesas(remData.map((r: any) => ({
        id: r.id,
        origen: r.pais_origen,
        destino: r.pais_destino,
        montoOrigen: parseFloat(r.monto_origen),
        montoDestino: parseFloat(r.monto_destino),
        simboloOrigen: r.pais_origen === 'ES' ? 'EUR' : 'USD',
        simboloDestino: r.pais_destino === 'VE' ? 'VES' : 'USD',
        cliente: r.clientes?.nombre || 'Desconocido',
        cedula: r.clientes?.cedula_dni || 'N/A',
        telefono: r.clientes?.telefono || '',
        fecha: new Date(r.created_at).toLocaleString(),
        estado: r.estado,
        cajeroOrigen: r.cajero_origen ? (cajeroMap[r.cajero_origen] || 'Desconocido') : 'Cliente Directo',
        cajeroDestino: r.cajero_destino ? (cajeroMap[r.cajero_destino] || 'N/A') : 'N/A',
        tasaCompra: parseFloat(r.tasa_compra_usdt) || 1.0,
        tasaVenta: parseFloat(r.tasa_venta_usdt) || 1.0,
        refOrigen: r.referencia_banco_receptor || '',
        refBinanceCompra: r.referencia_compra_binance || '',
        refDestino: r.referencia_banco_emisor || '',
        refBinanceVenta: r.referencia_venta_binance || '',
        gananciaCalculada: parseFloat(r.ganancia_neta_usd) || 0,
        motivoCancelacion: r.motivo_cancelacion || '',
        beneficiarios: (r.remesas_beneficiarios || []).map((b: any) => ({
          banco: b.banco,
          cuenta: b.cuenta,
          telefono: b.telefono || '',
          titular: b.titular,
          cedula: b.cedula_dni,
          monto: parseFloat(b.monto)
        }))
      })));
    }

    // 3. Fetch retiros
    const { data: retData } = await supabase
      .from('retiros')
      .select('*')
      .order('created_at', { ascending: false });

    if (retData) {
      setRetiros(retData.map((rt: any) => ({
        id: rt.id,
        fecha: new Date(rt.created_at).toLocaleDateString(),
        cajeroId: rt.cajero_id,
        cajeroName: cajeroMap[rt.cajero_id] || 'Desconocido',
        monto: parseFloat(rt.monto),
        fee: parseFloat(rt.fee),
        totalRecibir: parseFloat(rt.total_recibir),
        estado: rt.estado as any
      })));

      const totalFee = retData
        .filter((rt: any) => rt.estado === 'PAGADO')
        .reduce((acc: number, curr: any) => acc + (parseFloat(curr.fee) || 0), 0);
      setSaldoEmpresa(totalFee);
    }

    // 4. Fetch global configuration
    const { data: configData } = await supabase
      .from('configuracion_global')
      .select('*');

    if (configData) {
      const sanConfig = configData.find((c: any) => c.clave === 'showSanTab');
      const walletConfig = configData.find((c: any) => c.clave === 'showWalletFeatures');
      if (sanConfig) {
        setShowSanTab(sanConfig.valor === 'true');
        localStorage.setItem('tc_showSanTab', sanConfig.valor);
      }
      if (walletConfig) {
        setShowWalletFeatures(walletConfig.valor === 'true');
        localStorage.setItem('tc_showWalletFeatures', walletConfig.valor);
      }
    }

    // 5. Fetch configuracion_tasas
    const { data: tasasData } = await supabase
      .from('configuracion_tasas')
      .select('*');

    if (tasasData) {
      setPaises(prev => {
        const updated = { ...prev };
        tasasData.forEach((t: any) => {
          if (updated[t.pais_codigo]) {
            updated[t.pais_codigo] = {
              ...updated[t.pais_codigo],
              compra: parseFloat(t.compra) || 0,
              venta: parseFloat(t.venta) || 0,
            };
          }
        });
        localStorage.setItem('tc_paisesData', JSON.stringify(updated));
        return updated;
      });
    }
  };

  const suscribirseCambiosSupabase = () => {
    supabase
      .channel('realtime-tabla-pendientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remesas' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Cola de remesas actualizada en tiempo real!');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'depositos' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Recargas actualizadas en tiempo real!');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_global' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Configuración global de visualización actualizada!');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_tasas' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Tasas de cambio actualizadas por el administrador!');
      })
      .subscribe();
  };

  const triggerToast = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotificationToast(true);
    setTimeout(() => {
      setShowNotificationToast(false);
    }, 4500);
  };

  const handleRegisterOperation = async (data: any) => {
    if (isSimulationMode) {
      triggerToast(`Operación de $${data.montoOrigen} registrada (MODO SIMULACIÓN).`);
      return;
    }

    try {
      // 1. Validar o registrar cliente
      let clienteId = '';
      const { data: cliExist } = await supabase
        .from('clientes')
        .select('id')
        .eq('cedula_dni', data.clienteDoc)
        .single();

      if (cliExist) {
        clienteId = cliExist.id;
      } else {
        const { data: newCli } = await supabase
          .from('clientes')
          .insert({
            nombre: data.clienteNombre,
            cedula_dni: data.clienteDoc,
            telefono: data.clienteTlf,
            email: data.clienteEmail,
            wallet_token: 'W-' + Math.random().toString(36).substring(2, 12).toUpperCase()
          })
          .select('id')
          .single();
        if (newCli) clienteId = newCli.id;
      }

      // 2. Insertar Remesa
      const { data: newRemesa, error: remError } = await supabase
        .from('remesas')
        .insert({
          cliente_id: clienteId,
          pais_origen: data.paisOrigen,
          pais_destino: data.paisDestino,
          monto_origen: data.montoOrigen,
          monto_destino: data.montoDestino,
          tasa_venta_aplicada: data.tasaVenta,
          estado: 'PENDIENTE'
        })
        .select('id')
        .single();

      if (remError) throw remError;

      // 3. Insertar Beneficiarios en lote
      if (newRemesa) {
        const benPayloads = data.beneficiarios.map((b: any) => ({
          remesa_id: newRemesa.id,
          banco: b.banco,
          cuenta: b.cuenta,
          telefono: b.telefono,
          titular: b.titular,
          cedula_dni: b.cedula,
          monto: parseFloat(b.monto)
        }));

        await supabase.from('remesas_beneficiarios').insert(benPayloads);
        triggerToast('Operación registrada exitosamente en Supabase.');
        fetchDatosSupabase();
      }
    } catch (e: any) {
      triggerToast(`Error al registrar operación: ${e.message}`);
    }
  };

  const addAuditLog = (accion: string) => {
    const newLog = {
      id: Date.now(),
      fecha: new Date().toLocaleString(),
      usuario: 'Administrador',
      accion
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('tc_auditLogs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleApproveDeposito = async (id: number, binanceRef: string, binanceTasa: number) => {
    addAuditLog(`Aprobó recarga web ID ${id} (Tasa Binance: ${binanceTasa.toFixed(4)}, Ref: ${binanceRef})`);
    if (isSimulationMode) {
      setDepositos(depositos.filter(d => d.id !== id));
      triggerToast(`Recarga ${id} aprobada (MODO SIMULACIÓN).`);
      return;
    }

    const { error } = await supabase
      .from('depositos')
      .update({
        estado: 'PAGADO',
        referencia_compra_binance: binanceRef,
        tasa_compra_usdt: binanceTasa
      })
      .eq('id', id);

    if (!error) {
      triggerToast('Depósito de Billetera acreditado y cerrado.');
      fetchDatosSupabase();
    }
  };

  const handleApproveRemesa = async (id: number, bancoRef: string, binanceRef: string, binanceTasa: number, comprobanteFile?: File) => {
    if (isSimulationMode) {
      setRemesas(remesas.filter(r => r.id !== id));
      setSaldoAcumulado(prev => prev + 12.50);
      triggerToast(`Remesa liquidada (MODO SIMULACIÓN). Ganancia: +$12.50`);
      return;
    }

    let comprobanteUrl = '';
    if (comprobanteFile) {
      const fileExt = comprobanteFile.name.split('.').pop();
      const fileName = `remesa_${id}_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(`pagos/${fileName}`, comprobanteFile);

      if (uploadError) {
        triggerToast(`Error subiendo la imagen: ${uploadError.message}`);
      } else if (uploadData) {
        const { data: publicUrlData } = supabase.storage.from('comprobantes').getPublicUrl(`pagos/${fileName}`);
        comprobanteUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from('remesas')
      .update({
        estado: 'PAGADO',
        referencia_banco_emisor: bancoRef,
        referencia_venta_binance: binanceRef,
        tasa_venta_usdt: binanceTasa,
        fecha_pago: new Date().toISOString(),
        ...(comprobanteUrl ? { comprobante_banco_emisor: comprobanteUrl } : {})
      })
      .eq('id', id);

    if (!error) {
      triggerToast('Remesa liquidada y cerrada exitosamente.');
      fetchDatosSupabase();
    }
  };

  const handleRequestRetiro = async (monto: number) => {
    if (isSimulationMode) {
      setSaldoAcumulado(prev => prev - monto);
      const newRetiro: Retiro = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString(),
        monto,
        fee: monto * 0.10,
        totalRecibir: monto * 0.90,
        estado: 'PENDIENTE'
      };
      setRetiros([newRetiro, ...retiros]);
      triggerToast(`Retiro de $${monto} solicitado (MODO SIMULACIÓN).`);
      return;
    }

    const fee = monto * 0.10;
    const { error } = await supabase
      .from('retiros')
      .insert({
        monto,
        fee,
        total_recibir: monto - fee,
        estado: 'PENDIENTE'
      });

    if (!error) {
      triggerToast('Solicitud de retiro registrada en Supabase.');
      fetchDatosSupabase();
    }
  };

  const handlePayAporte = (grupoId: number) => {
    setReputacionSan(prev => prev + 5);
    if (reputacionSan + 5 >= 100) setNivelSan('Oro');
    triggerToast(`Aporte al grupo SAN ${grupoId} pagado con éxito.`);
  };

  const simularReporteTelegram = () => {
    const totalVolume = 150.00 + 100.00; // Mock de volumen
    const totalGanancia = 12.50; // Mock de ganancia
    const msg = `🤖 Bot Telegram (Resumen Diario):\n---------------------------\n🌍 Volumen Total: $${totalVolume.toFixed(2)} USD\n📈 Ganancia Neta: $${totalGanancia.toFixed(2)} USD\n👥 Cajero: Carlos Mendoza\n📍 País: Venezuela 🇻🇪\n✅ Reporte enviado al canal privado de la empresa.`;
    triggerToast(msg);
  };

  const handleToggleSanTab = async (newValue: boolean) => {
    addAuditLog(`Modificó visibilidad del módulo Ahorro Circular SAN a: ${newValue ? 'ACTIVO' : 'INACTIVO'}`);
    setShowSanTab(newValue);
    localStorage.setItem('tc_showSanTab', String(newValue));
    if (!isSimulationMode) {
      await supabase
        .from('configuracion_global')
        .upsert({ clave: 'showSanTab', valor: String(newValue) }, { onConflict: 'clave' });
    }
    if (!newValue && activeTab === 'san') {
      setActiveTab('calculadora');
    }
  };

  const handleToggleWalletFeatures = async (newValue: boolean) => {
    addAuditLog(`Modificó visibilidad del módulo Billetera Digital a: ${newValue ? 'ACTIVO' : 'INACTIVO'}`);
    setShowWalletFeatures(newValue);
    localStorage.setItem('tc_showWalletFeatures', String(newValue));
    if (!isSimulationMode) {
      await supabase
        .from('configuracion_global')
        .upsert({ clave: 'showWalletFeatures', valor: String(newValue) }, { onConflict: 'clave' });
    }
  };

  const handleUpdateExchangeRate = async (code: string, compra: number, venta: number) => {
    addAuditLog(`Actualizó tasa manual de ${paises[code]?.nombre || code} a Compra: ${compra}, Venta: ${venta}`);
    const updated = {
      ...paises,
      [code]: {
        ...paises[code],
        compra,
        venta
      }
    };
    setPaises(updated);
    localStorage.setItem('tc_paisesData', JSON.stringify(updated));

    if (!isSimulationMode) {
      await supabase
        .from('configuracion_tasas')
        .upsert({ pais_codigo: code, compra, venta }, { onConflict: 'pais_codigo' });
    }
    triggerToast(`Tasa de ${paises[code]?.nombre || code} actualizada con éxito.`);
  };

  const handleUpdateMargenGlobal = (newMargin: number) => {
    addAuditLog(`Actualizó el margen global a: ${newMargin}%`);
    setMargenGlobal(newMargin);
    localStorage.setItem('tc_margenGlobal', String(newMargin));
    triggerToast(`Margen global actualizado a ${newMargin}%`);
  };


  const handleCancelRemesa = async (id: number, motivo: string) => {
    addAuditLog(`Canceló remesa TRX-${id} con motivo: ${motivo}`);
    if (isSimulationMode) {
      setRemesas(prev => prev.map(r => r.id === id ? { ...r, estado: 'CANCELADO', motivoCancelacion: motivo } : r));
      triggerToast(`Operación ${id} cancelada con motivo: ${motivo} (SIMULACIÓN).`);
      return;
    }

    const { error } = await supabase
      .from('remesas')
      .update({ estado: 'CANCELADO', motivo_cancelacion: motivo })
      .eq('id', id);

    if (!error) {
      triggerToast('Transacción cancelada exitosamente.');
      fetchDatosSupabase();
    }
  };

  const handleRejectDeposito = async (id: number) => {
    addAuditLog(`Rechazó la solicitud de recarga web ID ${id}`);
    if (isSimulationMode) {
      setDepositos(prev => prev.map(d => d.id === id ? { ...d, estado: 'CANCELADO' } : d));
      triggerToast(`Depósito ${id} rechazado (SIMULACIÓN).`);
      return;
    }

    const { error } = await supabase
      .from('depositos')
      .update({ estado: 'CANCELADO' })
      .eq('id', id);

    if (!error) {
      triggerToast('Depósito rechazado y cancelado.');
      fetchDatosSupabase();
    }
  };

  const handleApproveRetiro = async (id: number) => {
    addAuditLog(`Aprobó solicitud de retiro de caja chica ID ${id}`);
    if (isSimulationMode) {
      setRetiros(prev => prev.map(r => r.id === id ? { ...r, estado: 'PAGADO' } : r));
      const ret = retiros.find(r => r.id === id);
      if (ret) {
        setSaldoEmpresa(prev => prev + ret.fee);
      }
      triggerToast(`Retiro ${id} pagado y aprobado (SIMULACIÓN).`);
      return;
    }

    const { error } = await supabase
      .from('retiros')
      .update({ estado: 'PAGADO' })
      .eq('id', id);

    if (!error) {
      triggerToast('Solicitud de retiro pagada y completada.');
      fetchDatosSupabase();
    }
  };

  const handleRejectRetiro = async (id: number) => {
    addAuditLog(`Rechazó solicitud de retiro de caja chica ID ${id} (Fondos devueltos al cajero)`);
    if (isSimulationMode) {
      const ret = retiros.find(r => r.id === id);
      if (ret) {
        if (ret.cajeroId === 'caj-1') {
          setSaldoAcumulado(prev => prev + ret.monto);
        }
        setRetiros(prev => prev.map(r => r.id === id ? { ...r, estado: 'RECHAZADO' } : r));
      }
      triggerToast(`Retiro ${id} rechazado. Saldo reembolsado (SIMULACIÓN).`);
      return;
    }

    try {
      const { data: retData } = await supabase
        .from('retiros')
        .select('*')
        .eq('id', id)
        .single();

      if (retData) {
        const cajerId = retData.cajero_id;
        const montoVal = parseFloat(retData.monto);

        const { data: cajero } = await supabase
          .from('perfiles_cajeros')
          .select('saldo_acumulado')
          .eq('id', cajerId)
          .single();

        if (cajero) {
          const nuevoSaldo = (parseFloat(cajero.saldo_acumulado) || 0) + montoVal;
          await supabase
            .from('perfiles_cajeros')
            .update({ saldo_acumulado: nuevoSaldo })
            .eq('id', cajerId);
        }

        await supabase
          .from('retiros')
          .update({ estado: 'RECHAZADO' })
          .eq('id', id);

        triggerToast('Retiro rechazado. Fondos devueltos al cajero.');
        fetchDatosSupabase();
      }
    } catch (e: any) {
      triggerToast(`Error al rechazar retiro: ${e.message}`);
    }
  };

  const pendingDepositos = useMemo(() => {
    return depositos.filter(d => d.estado === 'PENDIENTE');
  }, [depositos]);

  const pendingRemesas = useMemo(() => {
    return remesas.filter(r => r.estado === 'PENDIENTE' && r.destino === cajeroPais);
  }, [remesas, cajeroPais]);

  const cashierRetiros = useMemo(() => {
    return retiros.filter(rt => rt.cajeroId === 'caj-1');
  }, [retiros]);

  const pendingNotifsCount = pendingDepositos.length + pendingRemesas.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden md:py-6 justify-center items-center">
      {/* Banner de Modo Simulación */}
      {isSimulationMode && (
        <div className="w-full max-w-4xl bg-amber-500/10 border border-amber-500/30 text-amber-300 px-6 py-2.5 md:rounded-xl mb-4 text-xs font-bold flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Modo Simulación Activo. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env.local para conectar la base de datos real.
          </span>
        </div>
      )}

      {/* Toast Notificación */}
      {showNotificationToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-950 text-white rounded-xl shadow-2xl border border-indigo-500/40 p-4 max-w-sm flex items-start gap-3 animate-in slide-in-from-top-6 duration-300">
          <div className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <span className="font-extrabold text-sm block">Notificación de la Red</span>
            <p className="text-xs text-slate-300 mt-0.5 leading-normal">{notificationMsg}</p>
          </div>
        </div>
      )}

      {/* Contenedor Principal / Admin Workspace */}
      {isAdminMode ? (
        <AdminWorkspace
          remesas={remesas}
          depositos={depositos}
          retiros={retiros}
          cajeros={cajeros}
          clientes={clientes}
          paises={paises}
          showSanTab={showSanTab}
          showWalletFeatures={showWalletFeatures}
          saldoEmpresa={saldoEmpresa}
          auditLogs={auditLogs}
          binanceMarketRates={binanceMarketRates}
          margenGlobal={margenGlobal}
          onUpdateMargenGlobal={handleUpdateMargenGlobal}
          onToggleSanTab={handleToggleSanTab}
          onToggleWalletFeatures={handleToggleWalletFeatures}
          onUpdateExchangeRate={handleUpdateExchangeRate}
          onApproveDeposito={handleApproveDeposito}
          onRejectDeposito={handleRejectDeposito}
          onApproveRetiro={handleApproveRetiro}
          onRejectRetiro={handleRejectRetiro}
          onCancelRemesa={handleCancelRemesa}
          onClose={() => setIsAdminMode(false)}
        />
      ) : (
        <div className="w-full max-w-4xl bg-slate-950 md:rounded-3xl shadow-2xl md:border md:border-slate-800/80 flex flex-col md:h-[90vh] overflow-hidden min-h-screen md:min-h-0">

          {/* Cabecera Premium */}
          <header className="bg-slate-950 border-b border-slate-900 px-6 py-4 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-indigo-600/30">
                TC
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wide text-white uppercase">TransferCash</h1>
                <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-indigo-400 font-bold border border-indigo-950/80">
                  Cajero: Venezuela 🇻🇪
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsAdminMode(true)}
                title="Workspace de Administración"
                className="text-slate-400 hover:text-indigo-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900 flex items-center gap-1.5 text-xs font-bold"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-400" /> Admin
              </button>
              <button
                onClick={simularReporteTelegram}
                title="Simular Reporte Diario Telegram"
                className="text-slate-400 hover:text-indigo-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900 flex items-center gap-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" /> Bot Reporte
              </button>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mi Caja Chica</span>
                <span className="text-sm font-black text-indigo-400">${saldoAcumulado.toFixed(2)} USD</span>
              </div>
              <button className="text-slate-400 hover:text-red-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Contenido Dinámico con Scrollbox */}
          <main className="flex-grow overflow-y-auto bg-slate-900 text-slate-900 pb-20 md:pb-6 scrollbar-none">
            {activeTab === 'calculadora' && (
              <CalculadoraRemesa
                onRegisterOperation={handleRegisterOperation}
                showWallet={showWalletFeatures}
                paisesData={paises}
                margen={margenGlobal}
                binanceMarketRates={binanceMarketRates}
              />
            )}
            {activeTab === 'pendientes' && (
              <TablaPendientes
                depositos={pendingDepositos}
                remesas={pendingRemesas}
                onApproveDeposito={handleApproveDeposito}
                onApproveRemesa={handleApproveRemesa}
                showWallet={showWalletFeatures}
              />
            )}
            {activeTab === 'retiros' && (
              <SeccionRetiros
                saldoDisponible={saldoAcumulado}
                historialRetiros={cashierRetiros}
                onRequestRetiro={handleRequestRetiro}
              />
            )}
            {activeTab === 'san' && showSanTab && (
              <SeccionSan
                reputacion={reputacionSan}
                nivel={nivelSan}
                grupos={gruposSan}
                onPayAporte={handlePayAporte}
              />
            )}
            {activeTab === 'plantilla' && (
              <GeneradorPlantilla isAdmin={isAdminMode} />
            )}
          </main>

          {/* Tab Bar de Navegación Nativo Móvil */}
          <nav className="fixed bottom-0 left-0 right-0 md:relative bg-slate-950/90 backdrop-blur-md border-t border-slate-900 px-4 py-2 flex justify-around items-center z-40 flex-shrink-0">
            <button
              onClick={() => setActiveTab('calculadora')}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'calculadora' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="text-lg">💸</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Operar</span>
            </button>

            <button
              onClick={() => setActiveTab('pendientes')}
              className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'pendientes' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="text-lg">⏳</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Pendientes</span>
              {pendingNotifsCount > 0 && (
                <span className="absolute -top-1 right-2 w-4.5 h-4.5 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-slate-950">
                  {pendingNotifsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('retiros')}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'retiros' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="text-lg">💼</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Mi Caja</span>
            </button>

            {showSanTab && (
              <button
                onClick={() => setActiveTab('san')}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'san' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                <span className="text-lg">🛡️</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold">Ahorro SAN</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('plantilla')}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'plantilla' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="text-lg">🖼️</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Plantilla</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
