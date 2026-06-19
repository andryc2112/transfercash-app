import { useState, useEffect, useMemo, useRef } from 'react';
import { CalculadoraRemesa, defaultPaisesData, bancosDB } from './components/CalculadoraRemesa';
import type { PaisData } from './components/CalculadoraRemesa';
import { TablaPendientes } from './components/TablaPendientes';
import { SeccionRetiros } from './components/SeccionRetiros';
import { SeccionSan } from './components/SeccionSan';
import { LogOut, Bell, Settings } from 'lucide-react';
import { supabase } from './lib/supabase';
import { AdminWorkspace } from './components/AdminWorkspace';
import type { Cliente, CajeroPerfil, BancoCuentaConfig } from './components/AdminWorkspace';

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
  cajeroOrigenId?: string;
  cajeroDestinoId?: string;
  tasaCompra?: number;
  tasaVenta?: number;
  tasaVentaAplicada?: number;
  refOrigen?: string;
  refBinanceCompra?: string;
  refDestino?: string;
  refBinanceVenta?: string;
  gananciaCalculada?: number;
  motivoCancelacion?: string;
  created_at?: string;
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
  const [activeTab, setActiveTab] = useState<'calculadora' | 'pendientes' | 'retiros' | 'san' | 'historial'>('calculadora');
  const [cajeroPais, setCajeroPais] = useState('VE'); // Actualizado dinámicamente
  const [saldoAcumulado, setSaldoAcumulado] = useState(0);
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
  const [adminEmails, setAdminEmails] = useState<string[]>(['andryc2112@gmail.com']);
  const [telegramChatId, setTelegramChatId] = useState<string>('-1005171951585');
  const [paises, setPaises] = useState<Record<string, PaisData>>(() => {
    const local = localStorage.getItem('tc_paisesData');
    return local ? JSON.parse(local) : defaultPaisesData;
  });
  const [bancos, setBancos] = useState<Record<string, string[]>>(() => {
    const local = localStorage.getItem('tc_bancosData');
    return local ? JSON.parse(local) : bancosDB;
  });

  // Workspace Admin
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isEditingSelfBanks, setIsEditingSelfBanks] = useState(false);
  const [selfBanksForm, setSelfBanksForm] = useState<Partial<CajeroPerfil>>({});
  const [solicitudesPerfil, setSolicitudesPerfil] = useState<any[]>([]);

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

  // Conexión real a la API pública de CriptoYa (Binance P2P Real sin CORS)
  useEffect(() => {
    const fetchRealRates = async () => {
      try {
        const currencies: Record<string, string> = {
          VE: 'ves',
          PE: 'pen',
          CO: 'cop',
          CL: 'clp',
          AR: 'ars',
          ES: 'eur',
          BR: 'brl',
          DO: 'dop'
        };

        const updatedRates: Record<string, { compra: number; venta: number }> = {};

        await Promise.all(
          Object.entries(currencies).map(async ([code, fiat]) => {
            try {
              const res = await fetch(`https://criptoya.com/api/binancep2p/usdt/${fiat}/0.1`);
              if (res.ok) {
                const data = await res.json();
                if (data.ask && data.bid) {
                  updatedRates[code] = {
                    compra: parseFloat(data.bid), // Bid es el precio más bajo (al que el cajero compra USDT)
                    venta: parseFloat(data.ask)   // Ask es el precio más alto (al que el cajero vende USDT)
                  };
                }
              }
            } catch (e) {
              // Ignoramos silenciosamente si una moneda falla para no detener las demás
            }
          })
        );

        if (Object.keys(updatedRates).length > 0) {
          setBinanceMarketRates(prev => ({ ...prev, ...updatedRates }));
        }
      } catch (error) {
        console.error('Error obteniendo tasas reales:', error);
      }
    };

    fetchRealRates(); // Llamada inicial apenas abre la app
    const interval = setInterval(fetchRealRates, 60000); // Consultar y actualizar en tiempo real cada 60 segundos
    return () => clearInterval(interval);
  }, []);

  // Estados iniciales para deep linking desde Telegram
  const [initialAdminTab, setInitialAdminTab] = useState<string | undefined>(undefined);
  const [initialAdminSearch, setInitialAdminSearch] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const searchParam = params.get('search');
    if (tabParam) {
      setInitialAdminTab(tabParam);
      setIsAdminMode(true);
    }
    if (searchParam) {
      setInitialAdminSearch(searchParam);
      setIsAdminMode(true);
    }
  }, []);

  // Autenticación Supabase
  const [session, setSession] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authNombre, setAuthNombre] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Campos de registro extendidos
  const [authPais, setAuthPais] = useState('VE');
  const [authBancoNombre, setAuthBancoNombre] = useState('');
  const [authBancoCuenta, setAuthBancoCuenta] = useState('');
  const [authBancoTitular, setAuthBancoTitular] = useState('');
  const [authBancoCedula, setAuthBancoCedula] = useState('');
  const [authBinanceWallet, setAuthBinanceWallet] = useState('');

  useEffect(() => {
    if (isEditingSelfBanks && session?.user) {
      const miPerfil = cajeros.find(c => c.id === session.user.id);
      if (miPerfil) {
        setSelfBanksForm(JSON.parse(JSON.stringify(miPerfil)));
      }
    }
  }, [isEditingSelfBanks, cajeros, session]);

  // Notificaciones
  const [showNotificationToast, setShowNotificationToast] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState('');

  // Estados de datos
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [remesas, setRemesas] = useState<Remesa[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [selectedTracking, setSelectedTracking] = useState<any | null>(null);
  const [gruposSan] = useState<GrupoSan[]>([
    { id: 1, nombre: 'Ahorro Navideño 🎅', cuota: 20.00, moneda: 'USD', estado: 'EN PROGRESO', participantesCount: 10, miTurno: 4 },
    { id: 2, nombre: 'Caja Semanal Taquilla', cuota: 500.00, moneda: 'VES', estado: 'ABIERTO', participantesCount: 5, miTurno: 2 }
  ]);

  // Verificar la conexión de Supabase al iniciar
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchDatosSupabase();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchDatosSupabase();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Solicitar permisos del navegador
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Referencias para leer el estado más reciente dentro de los callbacks de Supabase sin reiniciar la conexión
  const sessionRef = useRef(session);
  const cajeroPaisRef = useRef(cajeroPais);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    cajeroPaisRef.current = cajeroPais;
  }, [cajeroPais]);

  const showBrowserNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  };


  const fetchDatosSupabase = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    // 0. Fetch cajeros first to map names and details
    const { data: cajerosData } = await supabase
      .from('perfiles_cajeros')
      .select('*');

    const cajeroMap: Record<string, string> = {};
    if (cajerosData) {
      cajerosData.forEach((c: any) => {
        cajeroMap[c.id] = c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;
      });
      setCajeros(cajerosData.map((c: any) => {
        let bancoConfig: Record<string, BancoCuentaConfig> = {};
        if (c.banco_cuenta && c.banco_cuenta.startsWith('{')) {
          try {
            bancoConfig = JSON.parse(c.banco_cuenta);
          } catch (e) {
            console.error("Error parsing bank config:", e);
          }
        } else {
          // Fallback legacy
          const firstPais = (c.pais_operacion || 'VE').split(',')[0].trim();
          bancoConfig = {
            [firstPais]: {
              banco: c.banco_nombre || '',
              cuenta: c.banco_cuenta || '',
              titular: c.banco_titular || '',
              cedula: c.banco_cedula || ''
            }
          };
        }

        return {
          id: c.id,
          nombre: c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre,
          email: c.binance_email || 'cajero@transfercash.com',
          pais_operacion: c.pais_operacion,
          saldo_acumulado: parseFloat(c.saldo_acumulado) || 0,
          reputacion_san: c.reputacion_san || 0,
          nivel_san: c.nivel_san || 'Bronce',
          estado: c.estado || 'PENDIENTE',
          banco_nombre: c.banco_nombre || '',
          banco_cuenta: c.banco_cuenta || '',
          banco_titular: c.banco_titular || '',
          banco_cedula: c.banco_cedula || '',
          binance_wallet: c.binance_wallet || '',
          bancoConfig
        };
      }));

      if (currentSession?.user) {
        const miPerfil = cajerosData.find((c: any) => c.id === currentSession.user.id);
        if (miPerfil) {
          setSaldoAcumulado(parseFloat(miPerfil.saldo_acumulado) || 0);
          setCajeroPais(miPerfil.pais_operacion || 'VE');
        }
      }
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
        simboloOrigen: paises[r.pais_origen]?.simbolo || defaultPaisesData[r.pais_origen]?.simbolo || 'USD',
        simboloDestino: paises[r.pais_destino]?.simbolo || defaultPaisesData[r.pais_destino]?.simbolo || 'USD',
        cliente: r.clientes?.nombre || 'Desconocido',
        cedula: r.clientes?.cedula_dni || 'N/A',
        telefono: r.clientes?.telefono || '',
        fecha: new Date(r.created_at).toLocaleString(),
        estado: r.estado,
        cajeroOrigen: r.cajero_origen ? (cajeroMap[r.cajero_origen] || 'Desconocido') : 'Cliente Directo',
        cajeroDestino: r.cajero_destino ? (cajeroMap[r.cajero_destino] || 'N/A') : 'N/A',
        cajeroOrigenId: r.cajero_origen,
        cajeroDestinoId: r.cajero_destino,
        tasaCompra: parseFloat(r.tasa_compra_usdt) || 1.0,
        tasaVenta: parseFloat(r.tasa_venta_usdt) || 1.0,
        tasaVentaAplicada: parseFloat(r.tasa_venta_aplicada) || 1.0,
        refOrigen: r.referencia_banco_receptor || '',
        refBinanceCompra: r.referencia_compra_binance || '',
        refDestino: r.referencia_banco_emisor || '',
        refBinanceVenta: r.referencia_venta_binance || '',
        gananciaCalculada: parseFloat(r.ganancia_neta_usd) || 0,
        motivoCancelacion: r.motivo_cancelacion || '',
        created_at: r.created_at,
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

    let customPaises: Record<string, PaisData> = {};
    let customBancos: Record<string, string[]> = {};

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
      const adminConfig = configData.find((c: any) => c.clave === 'admin_emails');
      if (adminConfig) {
        setAdminEmails(JSON.parse(adminConfig.valor));
      }
      const tgConfig = configData.find((c: any) => c.clave === 'telegram_chat_id');
      if (tgConfig) {
        setTelegramChatId(tgConfig.valor);
      }
      const customPaisesConfig = configData.find((c: any) => c.clave === 'custom_paises_metadata');
      if (customPaisesConfig) {
        try {
          customPaises = JSON.parse(customPaisesConfig.valor);
        } catch (e) {
          console.error("Error parsing custom_paises_metadata:", e);
        }
      }
      const customBancosConfig = configData.find((c: any) => c.clave === 'custom_bancos_db');
      if (customBancosConfig) {
        try {
          customBancos = JSON.parse(customBancosConfig.valor);
        } catch (e) {
          console.error("Error parsing custom_bancos_db:", e);
        }
      }

      const requests = configData
        .filter((c: any) => c.clave.startsWith('solicitud_perfil_'))
        .map((c: any) => {
          try {
            return {
              cajeroId: c.clave.replace('solicitud_perfil_', ''),
              datos: JSON.parse(c.valor)
            };
          } catch (e) {
            return null;
          }
        })
        .filter((r: any): r is any => r !== null);
      setSolicitudesPerfil(requests);
    }

    const mergedPaises = { ...defaultPaisesData, ...customPaises };
    const mergedBancos = { ...bancosDB, ...customBancos };
    setBancos(mergedBancos);
    localStorage.setItem('tc_bancosData', JSON.stringify(mergedBancos));

    // 5. Fetch configuracion_tasas
    const { data: tasasData } = await supabase
      .from('configuracion_tasas')
      .select('*');

    const finalPaises = { ...mergedPaises };
    if (tasasData) {
      tasasData.forEach((t: any) => {
        if (finalPaises[t.pais_codigo]) {
          finalPaises[t.pais_codigo] = {
            ...finalPaises[t.pais_codigo],
            compra: parseFloat(t.compra) || 0,
            venta: parseFloat(t.venta) || 0,
          };
        }
      });
    }
    setPaises(finalPaises);
    localStorage.setItem('tc_paisesData', JSON.stringify(finalPaises));
  };

  // Controlador inteligente en tiempo real
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('realtime-tabla-pendientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'remesas' }, (payload) => {
        fetchDatosSupabase();

        if (payload.eventType === 'INSERT') {
          const newRemesa = payload.new as any;
          const paisesCajero = cajeroPaisRef.current.split(',').map(p => p.trim()).filter(Boolean);
          if (paisesCajero.includes(newRemesa.pais_destino)) {
            triggerToast('¡Nueva remesa para pagar en tu país! 💸');
            showBrowserNotification('Nuevo Pago Pendiente 💸', `Tienes una nueva remesa para pagar por ${newRemesa.monto_destino}`);
          } else {
            triggerToast('¡Nueva remesa registrada en la red!');
          }
        } else if (payload.eventType === 'UPDATE') {
          const newRemesa = payload.new as any;
          if (newRemesa.estado === 'PAGADO' && newRemesa.cajero_origen === sessionRef.current?.user?.id) {
            triggerToast('¡Tu envío ha sido pagado por el cajero destino! ✅');
            showBrowserNotification('Operación Completada ✅', `El cajero destino completó tu envío TRX-${newRemesa.id}`);
          } else if (newRemesa.estado === 'CANCELADO' && newRemesa.cajero_origen === sessionRef.current?.user?.id) {
            triggerToast(`Tu remesa TRX-${newRemesa.id} fue cancelada. ❌`);
            showBrowserNotification('Operación Cancelada ❌', `Motivo: ${newRemesa.motivo_cancelacion || 'N/A'}`);
          } else {
            triggerToast('¡Cola de remesas actualizada!');
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'depositos' }, (payload) => {
        fetchDatosSupabase();
        if (payload.eventType === 'INSERT') {
          triggerToast('¡Nueva solicitud de recarga web! 📥');
        } else if (payload.eventType === 'UPDATE') {
          triggerToast('¡Estado de recarga actualizado!');
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'retiros' }, (payload) => {
        fetchDatosSupabase();
        const newRetiro = payload.new as any;
        if (newRetiro.cajero_id === sessionRef.current?.user?.id) {
          if (newRetiro.estado === 'PAGADO') {
            triggerToast('¡Tu retiro ha sido aprobado y pagado! 💸');
            showBrowserNotification('Retiro Aprobado 💸', `Tu retiro de $${newRetiro.monto} ha sido completado exitosamente.`);
          } else if (newRetiro.estado === 'RECHAZADO') {
            triggerToast('Tu solicitud de retiro fue rechazada. ❌');
            showBrowserNotification('Retiro Rechazado ❌', `Los fondos han sido devueltos a tu caja.`);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_global' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Configuración global de visualización actualizada!');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_tasas' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Tasas de cambio actualizadas por el administrador!');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles_cajeros' }, () => {
        fetchDatosSupabase();
        triggerToast('¡Nuevo cajero registrado o modificado!');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const triggerToast = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotificationToast(true);
    setTimeout(() => {
      setShowNotificationToast(false);
    }, 4500);
  };

  const handleBuscarCliente = async (cedula: string) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('cedula_dni', cedula)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        triggerToast(`✅ Cliente ${data.nombre} encontrado.`);
        return data;
      } else {
        triggerToast(`ℹ️ Cliente nuevo. Se guardará automáticamente al registrar.`);
        return null;
      }
    } catch (err: any) {
      triggerToast(`❌ Error buscando cliente: ${err.message}`);
      return null;
    }
  };

  const handleRegisterOperation = async (data: any): Promise<boolean> => {
    try {
      // 1. Validar o registrar cliente
      let clienteId: string | null = null;
      const { data: cliExist, error: searchErr } = await supabase
        .from('clientes')
        .select('id')
        .eq('cedula_dni', data.clienteDoc)
        .maybeSingle();

      if (searchErr) throw new Error(`Error validando cliente: ${searchErr.message}`);

      if (cliExist) {
        clienteId = cliExist.id;
      } else {
        const { data: newCli, error: cliErr } = await supabase
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
        if (cliErr) throw new Error(`Fallo guardando cliente: ${cliErr.message}`);
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
          estado: 'PENDIENTE',
          cajero_origen: session?.user?.id
        })
        .select('id')
        .single();

      if (remError) throw new Error(`Fallo guardando remesa: ${remError.message}`);

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

        const { error: benError } = await supabase.from('remesas_beneficiarios').insert(benPayloads);
        if (benError) throw new Error(`Fallo guardando cuentas destino: ${benError.message}`);
        triggerToast('Operación registrada exitosamente en Supabase.');

        // Alerta Telegram de nuevo envio
        try {
          const originCashier = cajeros.find(c => c.id === session?.user?.id);
          const originName = originCashier ? originCashier.nombre : (session?.user?.email || 'Cliente Directo');
          const destCashiers = cajeros
            .filter(c => c.pais_operacion.split(',').map(p => p.trim()).includes(data.paisDestino))
            .map(c => c.nombre);
          const destNames = destCashiers.length > 0 ? destCashiers.join(', ') : 'Sin cajero asignado';
          const linkApp = window.location.origin;
          const linkCliente = `${window.location.origin}/?tab=clientes&search=${data.clienteDoc}`;

          const tgText = `🚀 *Nuevo envío registrado en la red* 🚀\n\n` +
            `• *Cajero Destino:* ${destNames}\n` +
            `• *Cajero Envío:* ${originName}\n` +
            `• *Monto enviado:* ${parseFloat(data.montoOrigen).toFixed(2)} ${paises[data.paisOrigen]?.simbolo || defaultPaisesData[data.paisOrigen]?.simbolo || data.paisOrigen}\n` +
            `• *Monto a enviar:* ${parseFloat(data.montoDestino).toFixed(2)} ${paises[data.paisDestino]?.simbolo || defaultPaisesData[data.paisDestino]?.simbolo || data.paisDestino}\n\n` +
            `🔗 [Acceder a la App](${linkApp})\n` +
            `👤 [Ver Información del Cliente](${linkCliente})`;

          fetch(`https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: telegramChatId, text: tgText, parse_mode: 'Markdown' })
          }).catch(err => console.error('Error enviando alerta de nuevo envio a Telegram:', err));
        } catch (tgErr) {
          console.error('Error preparando alerta de Telegram:', tgErr);
        }

        fetchDatosSupabase();
        return true;
      }
      return false;
    } catch (error: any) {
      triggerToast(`❌ ${error.message}`);
      return false;
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

    // 1. Obtener la remesa para calcular y repartir la ganancia
    let gananciaNeta = 0;
    try {
      const { data: remData } = await supabase.from('remesas').select('*').eq('id', id).single();
      if (remData) {
        const tCompra = parseFloat(remData.tasa_compra_usdt) || 1.0;
        const usdIn = tCompra > 0 ? (parseFloat(remData.monto_origen) / tCompra) : 0;
        const usdOut = binanceTasa > 0 ? (parseFloat(remData.monto_destino) / binanceTasa) : 0;
        gananciaNeta = usdIn - usdOut;

        const mitad = gananciaNeta / 2;
        const cajeroOrigenId = remData.cajero_origen;
        const cajeroDestinoId = session?.user?.id;

        // Función auxiliar para sumar saldo a un cajero
        const sumarSaldo = async (cajeroId: string, montoSumar: number) => {
          if (!cajeroId || montoSumar === 0) return;
          const { data: cData } = await supabase.from('perfiles_cajeros').select('saldo_acumulado').eq('id', cajeroId).single();
          if (cData) {
            const nuevoSaldo = (parseFloat(cData.saldo_acumulado) || 0) + montoSumar;
            await supabase.from('perfiles_cajeros').update({ saldo_acumulado: nuevoSaldo }).eq('id', cajeroId);
          }
        };

        if (cajeroOrigenId === cajeroDestinoId) {
          // Si es el mismo cajero, se lleva el 100% de la comisión
          await sumarSaldo(cajeroDestinoId, gananciaNeta);
        } else {
          // Repartir 50/50 entre ambos
          if (cajeroOrigenId) await sumarSaldo(cajeroOrigenId, mitad);
          if (cajeroDestinoId) await sumarSaldo(cajeroDestinoId, mitad);
        }
      }
    } catch (e) {
      console.error('Error calculando y repartiendo ganancias:', e);
    }

    const { error } = await supabase
      .from('remesas')
      .update({
        estado: 'PAGADO',
        referencia_banco_emisor: bancoRef,
        referencia_venta_binance: binanceRef,
        tasa_venta_usdt: binanceTasa,
        ganancia_neta_usd: gananciaNeta,
        fecha_pago: new Date().toISOString(),
        cajero_destino: session?.user?.id,
        ...(comprobanteUrl ? { comprobante_banco_emisor: comprobanteUrl } : {})
      })
      .eq('id', id);

    if (!error) {
      triggerToast('Remesa liquidada y cerrada exitosamente.');
      fetchDatosSupabase();
    }
  };

  const handleRequestRetiro = async (monto: number) => {
    const fee = monto * 0.10;
    const cajeroId = session?.user?.id;

    if (cajeroId) {
      const { data: cData } = await supabase.from('perfiles_cajeros').select('saldo_acumulado').eq('id', cajeroId).single();
      if (cData) {
        const nuevoSaldo = (parseFloat(cData.saldo_acumulado) || 0) - monto;
        await supabase.from('perfiles_cajeros').update({ saldo_acumulado: nuevoSaldo }).eq('id', cajeroId);
      }
    }

    const { error } = await supabase
      .from('retiros')
      .insert({
        cajero_id: cajeroId,
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
    if (!session) return;
    const hoy = new Date().toLocaleDateString();
    const pagadasHoy = remesas.filter(r => r.estado === 'PAGADO' && new Date(r.fecha).toLocaleDateString() === hoy);
    const totalVolume = pagadasHoy.reduce((acc, r) => acc + (r.montoOrigen / (r.tasaCompra || 1)), 0);
    const totalGanancia = pagadasHoy.reduce((acc, r) => acc + (r.gananciaCalculada || 0), 0);
    const email = session.user.email;
    const msg = `🤖 *Reporte Diario (Cajero)*\n---------------------------\n🌍 *Volumen Total:* $${totalVolume.toFixed(2)} USD\n📈 *Ganancia Neta:* $${totalGanancia.toFixed(2)} USD\n👥 *Cajero:* ${email}\n📍 *País:* Venezuela 🇻🇪`;

    fetch(`https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' })
    }).then(async res => {
      if (res.ok) triggerToast('✅ Reporte enviado a Telegram exitosamente.');
      else {
        const err = await res.json();
        triggerToast(`Error Telegram: ${err.description}`);
      }
    }).catch(() => triggerToast('Error de red enviando a Telegram.'));
  };

  const handleToggleSanTab = async (newValue: boolean) => {
    addAuditLog(`Modificó visibilidad del módulo Ahorro Circular SAN a: ${newValue ? 'ACTIVO' : 'INACTIVO'}`);
    setShowSanTab(newValue);
    localStorage.setItem('tc_showSanTab', String(newValue));
    await supabase
      .from('configuracion_global')
      .upsert({ clave: 'showSanTab', valor: String(newValue) }, { onConflict: 'clave' });
    if (!newValue && activeTab === 'san') {
      setActiveTab('calculadora');
    }
  };

  const handleToggleWalletFeatures = async (newValue: boolean) => {
    addAuditLog(`Modificó visibilidad del módulo Billetera Digital a: ${newValue ? 'ACTIVO' : 'INACTIVO'}`);
    setShowWalletFeatures(newValue);
    localStorage.setItem('tc_showWalletFeatures', String(newValue));
    await supabase
      .from('configuracion_global')
      .upsert({ clave: 'showWalletFeatures', valor: String(newValue) }, { onConflict: 'clave' });
  };

  const handleUpdateExchangeRate = (code: string, compra: number, venta: number) => {
    const updated = {
      ...paises,
      [code]: {
        ...paises[code],
        compra,
        venta
      }
    };
    setPaises(updated);
  };

  const handleSaveExchangeRate = async (code: string, customCompra?: number, customVenta?: number) => {
    const info = paises[code];
    const finalCompra = customCompra !== undefined ? customCompra : info.compra;
    const finalVenta = customVenta !== undefined ? customVenta : info.venta;

    addAuditLog(`Guardó tasa manual de ${info.nombre} a Compra: ${finalCompra}, Venta: ${finalVenta}`);

    let updatedPaises = { ...paises };
    setPaises(prev => {
      updatedPaises = {
        ...prev,
        [code]: {
          ...prev[code],
          compra: finalCompra,
          venta: finalVenta
        }
      };
      localStorage.setItem('tc_paisesData', JSON.stringify(updatedPaises));
      return updatedPaises;
    });

    const { error } = await supabase
      .from('configuracion_tasas')
      .upsert({ pais_codigo: code, compra: finalCompra, venta: finalVenta }, { onConflict: 'pais_codigo' });

    if (error) triggerToast(`Error de Servidor: ${error.message}`);
    else triggerToast(`Tasa de ${paises[code]?.nombre || code} guardada en el servidor con éxito.`);
  };

  const handleAddCountry = async (code: string, newCountry: PaisData, bankList: string[]) => {
    // 1. Fetch current custom_paises_metadata from Supabase
    const { data: configData } = await supabase
      .from('configuracion_global')
      .select('*')
      .eq('clave', 'custom_paises_metadata');
    
    let currentCustomPaises = {};
    if (configData && configData.length > 0) {
      try {
        currentCustomPaises = JSON.parse(configData[0].valor);
      } catch (e) {
        console.error("Error parsing custom_paises_metadata from db:", e);
      }
    }
    
    // Merge new country
    const updatedCustomPaises = {
      ...currentCustomPaises,
      [code]: {
        nombre: newCountry.nombre,
        simbolo: newCountry.simbolo,
        flag: newCountry.flag,
        compra: newCountry.compra,
        venta: newCountry.venta,
        color: newCountry.color
      }
    };
    
    // Save to configuracion_global
    const { error: errPaises } = await supabase
      .from('configuracion_global')
      .upsert({ clave: 'custom_paises_metadata', valor: JSON.stringify(updatedCustomPaises) }, { onConflict: 'clave' });
      
    if (errPaises) {
      triggerToast(`Error al guardar metadatos de país: ${errPaises.message}`);
      return;
    }
    
    // 2. Save banks if provided
    if (bankList.length > 0) {
      const { data: bankConfigData } = await supabase
        .from('configuracion_global')
        .select('*')
        .eq('clave', 'custom_bancos_db');
        
      let currentCustomBancos = {};
      if (bankConfigData && bankConfigData.length > 0) {
        try {
          currentCustomBancos = JSON.parse(bankConfigData[0].valor);
        } catch (e) {
          console.error("Error parsing custom_bancos_db from db:", e);
        }
      }
      
      const updatedCustomBancos = {
        ...currentCustomBancos,
        [code]: bankList
      };
      
      const { error: errBancos } = await supabase
        .from('configuracion_global')
        .upsert({ clave: 'custom_bancos_db', valor: JSON.stringify(updatedCustomBancos) }, { onConflict: 'clave' });
        
      if (errBancos) {
        triggerToast(`Error al guardar bancos sugeridos: ${errBancos.message}`);
      }
    }
    
    // 3. Upsert rates to configuracion_tasas
    const { error: errRates } = await supabase
      .from('configuracion_tasas')
      .upsert({ pais_codigo: code, compra: newCountry.compra, venta: newCountry.venta }, { onConflict: 'pais_codigo' });
      
    if (errRates) {
      triggerToast(`Error al guardar tasas del país: ${errRates.message}`);
    }
    
    addAuditLog(`Agregó nuevo país/cuenta digital: ${newCountry.nombre} (${code})`);
    triggerToast(`País/Cuenta digital ${newCountry.nombre} creado con éxito.`);
    
    // Reload state
    await fetchDatosSupabase();
  };

  const handleUpdateMargenGlobal = (newMargin: number) => {
    setMargenGlobal(newMargin);
  };

  const handleSaveMargenGlobal = async (customMargen?: number) => {
    const finalMargen = customMargen !== undefined ? customMargen : margenGlobal;
    setMargenGlobal(finalMargen);
    addAuditLog(`Actualizó y guardó el margen global a: ${finalMargen}%`);
    localStorage.setItem('tc_margenGlobal', String(finalMargen));
    const { error } = await supabase.from('configuracion_global').upsert({ clave: 'tc_margen_global', valor: String(finalMargen) }, { onConflict: 'clave' });
    if (error) triggerToast(`Error de Servidor: ${error.message}`);
    else triggerToast(`Margen global guardado exitosamente en el servidor.`);
  };

  const handleUpdateAdminEmails = async (emails: string[]) => {
    const uniqueEmails = Array.from(new Set(['andryc2112@gmail.com', ...emails])).filter(e => e);
    setAdminEmails(uniqueEmails);
    addAuditLog('Actualizó la lista de administradores del sistema');
    await supabase.from('configuracion_global').upsert({ clave: 'admin_emails', valor: JSON.stringify(uniqueEmails) }, { onConflict: 'clave' });
    triggerToast('Lista de administradores actualizada.');
  };

  const handleUpdateTelegramChatId = async (id: string) => {
    setTelegramChatId(id);
    addAuditLog('Actualizó el Chat ID de Telegram');
    await supabase.from('configuracion_global').upsert({ clave: 'telegram_chat_id', valor: id }, { onConflict: 'clave' });
    triggerToast('Chat ID de Telegram actualizado.');
  };


  const handleCancelRemesa = async (id: number, motivo: string) => {
    addAuditLog(`Canceló remesa TRX-${id} con motivo: ${motivo}`);

    const { error } = await supabase
      .from('remesas')
      .update({ estado: 'CANCELADO', motivo_cancelacion: motivo })
      .eq('id', id);

    if (!error) {
      triggerToast('Transacción cancelada exitosamente.');
      fetchDatosSupabase();
    }
  };

  const handleEditRemesa = async (id: number, data: any) => {
    addAuditLog(`Editó los datos de la remesa TRX-${id}`);

    const tCompra = parseFloat(data.tasaCompra) || 1.0;
    const tVenta = parseFloat(data.tasaVenta) || 1.0;
    const usdIn = tCompra > 0 ? (parseFloat(data.montoOrigen) / tCompra) : 0;
    const usdOut = tVenta > 0 ? (parseFloat(data.montoDestino) / tVenta) : 0;
    const nuevaGanancia = usdIn - usdOut;

    const { error } = await supabase
      .from('remesas')
      .update({
        monto_origen: parseFloat(data.montoOrigen),
        monto_destino: parseFloat(data.montoDestino),
        tasa_compra_usdt: tCompra,
        tasa_venta_usdt: tVenta,
        tasa_venta_aplicada: parseFloat(data.tasaVentaAplicada) || 1.0,
        referencia_banco_receptor: data.refOrigen,
        referencia_banco_emisor: data.refDestino,
        referencia_compra_binance: data.refBinanceCompra,
        referencia_venta_binance: data.refBinanceVenta,
        estado: data.estado,
        motivo_cancelacion: data.motivoCancelacion,
        ganancia_neta_usd: nuevaGanancia
      })
      .eq('id', id);

    if (error) {
      triggerToast(`❌ Error al editar remesa: ${error.message}`);
    } else {
      triggerToast('✅ Datos de la remesa actualizados correctamente.');
      fetchDatosSupabase();
    }
  };

  const handleEditCliente = async (id: string, data: Partial<Cliente>) => {
    addAuditLog(`Editó los datos del cliente ${data.nombre}`);
    const { error } = await supabase
      .from('clientes')
      .update({
        nombre: data.nombre,
        cedula_dni: data.cedula_dni,
        telefono: data.telefono,
        email: data.email,
        wallet_saldo: parseFloat(data.wallet_saldo?.toString() || '0')
      })
      .eq('id', id);
    if (!error) {
      triggerToast(`Datos del cliente ${data.nombre} actualizados exitosamente.`);
      fetchDatosSupabase();
    } else {
      triggerToast(`❌ Error al editar cliente: ${error.message}`);
    }
  };

  const handleRejectDeposito = async (id: number) => {
    addAuditLog(`Rechazó la solicitud de recarga web ID ${id}`);

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
    } catch (error: any) {
      triggerToast(`Error al rechazar retiro: ${error.message}`);
    }
  };

  const handleToggleEstadoCajero = async (id: string, nuevoEstado: string) => {
    addAuditLog(`Cambió el estado de acceso del cajero a ${nuevoEstado}`);
    const { error } = await supabase
      .from('perfiles_cajeros')
      .update({ estado: nuevoEstado })
      .eq('id', id);
    if (!error) {
      triggerToast(`Estado del cajero actualizado a ${nuevoEstado}.`);
      fetchDatosSupabase();
    }
  };

  const handleEditCajero = async (id: string, data: Partial<CajeroPerfil>) => {
    addAuditLog(`Editó los datos del cajero ${data.nombre}`);
    
    // Serializar el bancoConfig completo como JSON en el campo banco_cuenta
    const serializedBancos = JSON.stringify(data.bancoConfig || {});
    
    // Detalles del primer país para compatibilidad con código antiguo y WP
    const firstPais = (data.pais_operacion || 'VE').split(',')[0].trim();
    const firstConfig = data.bancoConfig?.[firstPais] || { banco: '', cuenta: '', titular: '', cedula: '' };

    const { error } = await supabase
      .from('perfiles_cajeros')
      .update({
        nombre: data.nombre,
        pais_operacion: data.pais_operacion,
        banco_nombre: firstConfig.banco,
        banco_cuenta: serializedBancos,
        banco_titular: firstConfig.titular,
        banco_cedula: firstConfig.cedula,
        binance_wallet: data.binance_wallet
      })
      .eq('id', id);
    if (!error) {
      triggerToast(`Datos del cajero ${data.nombre} actualizados exitosamente.`);
      fetchDatosSupabase();
    }
  };

  const handleRequestEditPerfil = async (id: string, data: Partial<CajeroPerfil>) => {
    addAuditLog(`Solicitó una actualización de perfil para el cajero ${data.nombre}`);
    const { error } = await supabase
      .from('configuracion_global')
      .upsert({
        clave: `solicitud_perfil_${id}`,
        valor: JSON.stringify(data)
      }, { onConflict: 'clave' });
      
    if (!error) {
      triggerToast('✅ Solicitud de cambio enviada. El administrador deberá aprobarla.');
      fetchDatosSupabase();
    } else {
      triggerToast(`❌ Error al enviar la solicitud: ${error.message}`);
    }
  };

  const handleCancelRequestPerfil = async (id: string) => {
    addAuditLog(`Canceló su solicitud de cambio de perfil.`);
    const { error } = await supabase
      .from('configuracion_global')
      .delete()
      .eq('clave', `solicitud_perfil_${id}`);
      
    if (!error) {
      triggerToast('✅ Solicitud cancelada y retirada.');
      fetchDatosSupabase();
    } else {
      triggerToast(`❌ Error al cancelar la solicitud: ${error.message}`);
    }
  };

  const handleApprovePerfil = async (cajeroId: string, datos: any) => {
    addAuditLog(`Aprobó actualización de perfil para el cajero ${datos.nombre}`);
    
    const serializedBancos = JSON.stringify(datos.bancoConfig || {});
    const firstPais = (datos.pais_operacion || 'VE').split(',')[0].trim();
    const firstConfig = datos.bancoConfig?.[firstPais] || { banco: '', cuenta: '', titular: '', cedula: '' };

    const { error } = await supabase
      .from('perfiles_cajeros')
      .update({
        nombre: datos.nombre,
        binance_wallet: datos.binance_wallet,
        banco_nombre: firstConfig.banco,
        banco_cuenta: serializedBancos,
        banco_titular: firstConfig.titular,
        banco_cedula: firstConfig.cedula
      })
      .eq('id', cajeroId);

    if (error) {
      triggerToast(`❌ Error al actualizar perfil: ${error.message}`);
      return;
    }

    const { error: delError } = await supabase
      .from('configuracion_global')
      .delete()
      .eq('clave', `solicitud_perfil_${cajeroId}`);

    if (!delError) {
      triggerToast('✅ Perfil del cajero aprobado y actualizado.');
      fetchDatosSupabase();
    } else {
      triggerToast('⚠️ Perfil actualizado pero la solicitud no se pudo borrar.');
    }
  };

  const handleRejectPerfil = async (cajeroId: string) => {
    addAuditLog(`Rechazó actualización de perfil para el cajero ID ${cajeroId}`);
    
    const { error } = await supabase
      .from('configuracion_global')
      .delete()
      .eq('clave', `solicitud_perfil_${cajeroId}`);

    if (!error) {
      triggerToast('❌ Solicitud de cambio de perfil rechazada.');
      fetchDatosSupabase();
    } else {
      triggerToast(`❌ Error al rechazar la solicitud: ${error.message}`);
    }
  };

  const handleSyncSystem = async () => {
    triggerToast('🔄 Iniciando sincronización profunda. Por favor, no cierres la ventana...');
    try {
      const { data: allRemesas, error: errRem } = await supabase.from('remesas').select('*').eq('estado', 'PAGADO');
      if (errRem) throw errRem;

      // Traer retiros pagados y pendientes (ya que el dinero pendiente está congelado/descontado)
      const { data: allRetiros, error: errRet } = await supabase.from('retiros').select('*').in('estado', ['PAGADO', 'PENDIENTE']);
      if (errRet) throw errRet;

      const { data: allCajeros, error: errCaj } = await supabase.from('perfiles_cajeros').select('id');
      if (errCaj) throw errCaj;

      let cajeroBalances: Record<string, number> = {};
      allCajeros.forEach((c: any) => { cajeroBalances[c.id] = 0; });

      for (const rem of allRemesas) {
        const tCompra = parseFloat(rem.tasa_compra_usdt) || 1.0;
        const tVenta = parseFloat(rem.tasa_venta_usdt) || 1.0;
        const usdIn = tCompra > 0 ? (parseFloat(rem.monto_origen) / tCompra) : 0;
        const usdOut = tVenta > 0 ? (parseFloat(rem.monto_destino) / tVenta) : 0;

        let ganancia = usdIn - usdOut;
        if (tVenta === 1.0 && rem.pais_destino !== 'US' && rem.pais_destino !== 'PA') {
          ganancia = parseFloat(rem.ganancia_neta_usd) || (usdIn * 0.05);
        }

        await supabase.from('remesas').update({ ganancia_neta_usd: ganancia }).eq('id', rem.id);

        const mitad = ganancia / 2;
        const orig = rem.cajero_origen;
        const dest = rem.cajero_destino;

        if (orig === dest) {
          if (orig && cajeroBalances[orig] !== undefined) cajeroBalances[orig] += ganancia;
        } else {
          if (orig && cajeroBalances[orig] !== undefined) cajeroBalances[orig] += mitad;
          if (dest && cajeroBalances[dest] !== undefined) cajeroBalances[dest] += mitad;
        }
      }

      for (const ret of allRetiros) {
        const cid = ret.cajero_id;
        if (cid && cajeroBalances[cid] !== undefined) {
          cajeroBalances[cid] -= parseFloat(ret.monto);
        }
      }

      for (const cid of Object.keys(cajeroBalances)) {
        await supabase.from('perfiles_cajeros').update({ saldo_acumulado: cajeroBalances[cid] }).eq('id', cid);
      }

      addAuditLog('Sincronizó y recalculó ganancias y saldos históricos');
      triggerToast('✅ Sincronización completada con éxito. Base de datos perfecta.');
      fetchDatosSupabase();
    } catch (error: any) {
      triggerToast(`❌ Error en sincronización: ${error.message}`);
    }
  };

  const pendingDepositos = useMemo(() => {
    return depositos.filter(d => d.estado === 'PENDIENTE');
  }, [depositos]);

  const pendingRemesas = useMemo(() => {
    const paisesCajero = cajeroPais.split(',').map(p => p.trim()).filter(Boolean);
    return remesas.filter(r => r.estado === 'PENDIENTE' && paisesCajero.includes(r.destino));
  }, [remesas, cajeroPais]);

  const cashierRetiros = useMemo(() => {
    return retiros.filter(rt => rt.cajeroId === session?.user?.id);
  }, [retiros]);

  const pendingNotifsCount = pendingDepositos.length + pendingRemesas.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden md:py-6 justify-center items-center">

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
      {!session ? (
        <div className="w-full max-w-md bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-none">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-600/30 mb-4">TC</div>
            <h1 className="text-2xl font-black text-white uppercase tracking-wide">TransferCash</h1>
            <p className="text-slate-400 text-sm mt-2">Acceso de Cajeros</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setAuthLoading(true);
            if (authMode === 'login') {
              const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
              if (error) triggerToast(`Error: ${error.message}`);
            } else {
              const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
              if (error) {
                triggerToast(`Error: ${error.message}`);
              } else {
                triggerToast('Cuenta creada exitosamente. Iniciando sesión...');
                if (data.user) {
                  const { error: profileError } = await supabase.from('perfiles_cajeros').upsert({
                    id: data.user.id,
                    nombre: authNombre || authEmail.split('@')[0],
                    binance_email: authEmail,
                    pais_operacion: authPais,
                    banco_nombre: authBancoNombre,
                    banco_cuenta: authBancoCuenta,
                    banco_titular: authBancoTitular,
                    banco_cedula: authBancoCedula,
                    binance_wallet: authBinanceWallet
                  });
                  if (profileError) {
                    triggerToast(`Error interno guardando perfil: ${profileError.message}`);
                  }
                }
              }
            }
            setAuthLoading(false);
          }} className="space-y-4">

            {authMode === 'register' && (
              <h3 className="text-indigo-400 font-black text-xs uppercase tracking-widest border-b border-slate-800 pb-2 mt-4">1. Credenciales y Datos Personales</h3>
            )}

            {authMode === 'register' && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre y Apellido</label>
                <input type="text" value={authNombre} onChange={e => setAuthNombre(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Correo Electrónico</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contraseña</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={6} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
            </div>

            {authMode === 'register' && (
              <>
                <h3 className="text-indigo-400 font-black text-xs uppercase tracking-widest border-b border-slate-800 pb-2 pt-4">2. País y Cuenta Bancaria Local</h3>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">País de Operación</label>
                  <select value={authPais} onChange={e => setAuthPais(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm">
                    {Object.entries(paises).map(([code, info]) => {
                      if (code === 'US' || code === 'PA' || code === 'ZI' || code === 'WA' || code === 'AI') return null;
                      return <option key={code} value={code}>{info.flag} {info.nombre}</option>;
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre del Banco</label>
                    <input type="text" value={authBancoNombre} onChange={e => setAuthBancoNombre(e.target.value)} required placeholder="Ej: Banesco" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nro de Cuenta</label>
                    <input type="text" value={authBancoCuenta} onChange={e => setAuthBancoCuenta(e.target.value)} required placeholder="0102..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Titular de Cuenta</label>
                    <input type="text" value={authBancoTitular} onChange={e => setAuthBancoTitular(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Doc. Identidad Titular</label>
                    <input type="text" value={authBancoCedula} onChange={e => setAuthBancoCedula(e.target.value)} required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
                  </div>
                </div>

                <h3 className="text-indigo-400 font-black text-xs uppercase tracking-widest border-b border-slate-800 pb-2 pt-4">3. Recepción Global</h3>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Binance Pay ID o Wallet USDT</label>
                  <input type="text" value={authBinanceWallet} onChange={e => setAuthBinanceWallet(e.target.value)} required placeholder="Ej: 0x... / Pay ID" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white mt-1 focus:outline-none focus:border-indigo-500 text-sm" />
                </div>
              </>
            )}

            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition mt-4 shadow-lg shadow-indigo-600/20">
              {authLoading ? 'Procesando...' : (authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs text-indigo-400 font-bold hover:text-indigo-300">
                {authMode === 'login' ? '¿No tienes cuenta? Regístrate aquí' : 'Ya tengo cuenta, iniciar sesión'}
              </button>
            </div>
          </form>
        </div>
      ) : isAdminMode ? (
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
          adminEmails={adminEmails}
          telegramChatId={telegramChatId}
          onUpdateTelegramChatId={handleUpdateTelegramChatId}
          onUpdateAdminEmails={handleUpdateAdminEmails}
          onUpdateMargenGlobal={handleUpdateMargenGlobal}
          onSaveMargenGlobal={handleSaveMargenGlobal}
          onToggleSanTab={handleToggleSanTab}
          onToggleWalletFeatures={handleToggleWalletFeatures}
          onUpdateExchangeRate={handleUpdateExchangeRate}
          onSaveExchangeRate={handleSaveExchangeRate}
          onApproveDeposito={handleApproveDeposito}
          onRejectDeposito={handleRejectDeposito}
          onApproveRetiro={handleApproveRetiro}
          onRejectRetiro={handleRejectRetiro}
          onCancelRemesa={handleCancelRemesa}
          onEditRemesa={handleEditRemesa}
          onEditCliente={handleEditCliente}
          onToggleEstadoCajero={handleToggleEstadoCajero}
          onEditCajero={handleEditCajero}
          solicitudesPerfil={solicitudesPerfil}
          onApprovePerfil={handleApprovePerfil}
          onRejectPerfil={handleRejectPerfil}
          initialTab={initialAdminTab}
          initialSearch={initialAdminSearch}
          onSyncSystem={handleSyncSystem}
          onAddCountry={handleAddCountry}
          onClose={() => setIsAdminMode(false)}
        />
      ) : !adminEmails.includes(session?.user?.email) && cajeros.find(c => c.id === session?.user?.id)?.estado !== 'ACTIVO' ? (
        <div className="w-full max-w-md bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-2xl text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold text-white mb-2">Cuenta en Revisión</h2>
          <p className="text-slate-400 text-sm mb-6">Tu perfil está a la espera de ser aprobado por un administrador para que puedas comenzar a operar.</p>
          <button onClick={() => supabase.auth.signOut()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 w-full">
            Cerrar Sesión
          </button>
        </div>
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
                  Cajero: {cajeroPais ? cajeroPais.split(',').map(p => {
                    const code = p.trim();
                    const info = paises[code] || defaultPaisesData[code];
                    return info ? `${info.flag} ${info.nombre}` : code;
                  }).join(', ') : 'Ninguno'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {adminEmails.includes(session?.user?.email) && (
                <button
                  onClick={() => setIsAdminMode(true)}
                  title="Workspace de Administración"
                  className="text-slate-400 hover:text-indigo-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900 flex items-center gap-1.5 text-xs font-bold"
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" /> Admin
                </button>
              )}
              <button
                onClick={() => setIsEditingSelfBanks(true)}
                title="Editar Mi Perfil / Datos Bancarios"
                className="text-slate-400 hover:text-indigo-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900 flex items-center gap-1.5 text-xs font-bold"
              >
                👤 Mi Perfil
              </button>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mi Caja Chica</span>
                <span className="text-sm font-black text-indigo-400">${saldoAcumulado.toFixed(2)} USD</span>
              </div>
              <button onClick={() => { simularReporteTelegram(); supabase.auth.signOut(); }} title="Cerrar Sesión y Enviar Reporte de Cierre" className="text-slate-400 hover:text-red-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Contenido Dinámico con Scrollbox */}
          <main className="flex-grow overflow-y-auto bg-slate-900 text-slate-900 pb-20 md:pb-6 scrollbar-none">
            {activeTab === 'calculadora' && (
              <CalculadoraRemesa
                onRegisterOperation={handleRegisterOperation}
                onBuscarCliente={handleBuscarCliente}
                showWallet={showWalletFeatures}
                paisesData={paises}
                bancosData={bancos}
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
                onViewTracking={setSelectedTracking}
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
            {activeTab === 'historial' && (
              <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-indigo-600 text-white px-6 py-4">
                    <h2 className="font-bold text-lg">📋 Historial de Transacciones</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase">
                          <th className="p-4">Fecha / Cliente</th>
                          <th className="p-4">Ruta / Monto</th>
                          <th className="p-4 text-center">Ganancia</th>
                          <th className="p-4 text-center">Estado</th>
                          <th className="p-4 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remesas.filter(r => r.cajeroOrigenId === session?.user?.id || r.cajeroDestinoId === session?.user?.id).map(rem => (
                          <tr key={rem.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="p-4 text-xs">
                              <span className="font-bold text-slate-900 block">{rem.cliente}</span>
                              <span className="text-slate-500">{rem.fecha}</span>
                            </td>
                            <td className="p-4 text-xs">
                              <span className="font-bold text-slate-800">{rem.origen} ➔ {rem.destino}</span>
                              <span className="block text-slate-500">Monto: {rem.simboloDestino} {rem.montoDestino.toFixed(2)}</span>
                            </td>
                            <td className="p-4 text-center text-xs">
                              <span className="font-bold text-emerald-600">${(rem.gananciaCalculada || 0).toFixed(2)}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase inline-block ${rem.estado === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : rem.estado === 'CANCELADO' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                {rem.estado}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => setSelectedTracking(rem)}
                                  className="text-[14px] bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 p-1.5 rounded transition"
                                  title="Ver Tracking"
                                >
                                  🔍
                                </button>
                                {rem.estado === 'PAGADO' && (
                                  <button
                                    onClick={() => {
                                      let text = `✅ *RECIBO DE OPERACIÓN*\n------------------------\n`;
                                      text += `👤 *Cliente:* ${rem.cliente}\n`;
                                      text += `🆔 *Transacción ID:* TRX-${rem.id}\n`;
                                      text += `💵 *Monto Enviado:* ${rem.simboloOrigen} ${rem.montoOrigen.toFixed(2)}\n`;
                                      text += `------------------------\n`;
                                      rem.beneficiarios.forEach((b: any, idx: number) => {
                                        text += `🏦 *Cuenta Destino ${rem.beneficiarios.length > 1 ? idx + 1 : ''}*\n`;
                                        text += `*Banco:* ${b.banco}\n`;
                                        text += `*Titular:* ${b.titular}\n`;
                                        text += `*Referencia:* ${rem.refDestino || 'N/A'}\n`;
                                        text += `*Monto Recibido:* ${rem.simboloDestino} ${b.monto.toFixed(2)}\n\n`;
                                      });
                                      text += `🚀 ¡Gracias por usar TransferCash!`;
                                      navigator.clipboard.writeText(text);
                                      triggerToast('Recibo copiado al portapapeles');
                                    }}
                                    className="text-[14px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 p-1.5 rounded transition"
                                    title="Copiar Recibo"
                                  >
                                    📋
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {remesas.filter(r => r.cajeroOrigenId === session?.user?.id || r.cajeroDestinoId === session?.user?.id).length === 0 && (
                          <tr><td colSpan={5} className="text-center p-8 text-slate-500">No hay transacciones en el historial.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
              onClick={() => setActiveTab('historial')}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeTab === 'historial' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <span className="text-lg">📋</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold">Historial</span>
            </button>
          </nav>
        </div>
      )}

      {/* MODAL: TRACKING DE OPERACIÓN (CAJEROS) */}
      {selectedTracking && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 border-b border-slate-800 p-5 flex justify-between items-center">
              <h3 className="font-extrabold text-base uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                🔍 Detalle y Tracking de Operación (TRX-{selectedTracking.id})
              </h3>
              <button
                onClick={() => setSelectedTracking(null)}
                className="text-slate-400 hover:text-white text-2xl font-bold transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-grow scrollbar-none text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Bloque Cajero Origen */}
                <div className="bg-slate-900/40 border-l-4 border-indigo-500 p-5 rounded-r-xl space-y-3">
                  <h4 className="font-extrabold text-sm text-indigo-400 flex items-center gap-1.5 uppercase">🛫 Cajero Origen</h4>
                  <p><strong>Cajero:</strong> {selectedTracking.cajeroOrigen || 'Desconocido'}</p>
                  <p><strong>Fecha Operación:</strong> {selectedTracking.fecha}</p>
                  <p><strong>País (Desde):</strong> {paises[selectedTracking.origen]?.nombre || selectedTracking.origen}</p>
                  <p>
                    <strong>Recibió del Cliente:</strong>{' '}
                    <span className="text-indigo-400 font-extrabold text-sm">
                      {paises[selectedTracking.origen]?.simbolo || '$'} {selectedTracking.montoOrigen.toFixed(2)}
                    </span>
                  </p>
                  <p><strong>Referencia Banco:</strong> <span className="font-mono text-slate-300">{selectedTracking.refOrigen || 'N/A'}</span></p>
                  <hr className="border-slate-800 border-dashed" />
                  <p className="text-amber-500 font-bold">🔶 Compra en Binance (P2P): {selectedTracking.tasaCompra?.toFixed(4) || '1.0'}</p>
                  <p><strong>Ref. Binance Compra:</strong> <span className="font-mono text-slate-300">{selectedTracking.refBinanceCompra || 'N/A'}</span></p>
                </div>

                {/* Bloque Cajero Destino */}
                <div className="bg-slate-900/40 border-l-4 border-emerald-500 p-5 rounded-r-xl space-y-3">
                  <h4 className="font-extrabold text-sm text-emerald-400 flex items-center gap-1.5 uppercase">🛬 Cajero Destino</h4>
                  <p><strong>Cajero:</strong> {selectedTracking.cajeroDestino || 'N/A'}</p>
                  <p><strong>Estado:</strong>{' '}
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${selectedTracking.estado === 'PAGADO'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : selectedTracking.estado === 'CANCELADO'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400'
                      }`}>
                      {selectedTracking.estado}
                    </span>
                  </p>
                  <p><strong>País (Hacia):</strong> {paises[selectedTracking.destino]?.nombre || selectedTracking.destino}</p>
                  <p>
                    <strong>Entregó al Beneficiario:</strong>{' '}
                    <span className="text-emerald-400 font-extrabold text-sm">
                      {paises[selectedTracking.destino]?.simbolo || '$'} {selectedTracking.montoDestino.toFixed(2)}
                    </span>
                  </p>
                  <p><strong>Referencia Emisor:</strong> <span className="font-mono text-slate-300">{selectedTracking.refDestino || 'N/A'}</span></p>
                  <hr className="border-slate-800 border-dashed" />
                  <p className="text-amber-500 font-bold">🔶 Venta en Binance: {selectedTracking.tasaVenta?.toFixed(4) || '1.0'}</p>
                  <p><strong>Ref. Binance Venta:</strong> <span className="font-mono text-slate-300">{selectedTracking.refBinanceVenta || 'N/A'}</span></p>
                </div>

              </div>

              {/* Datos del Cliente Remitente */}
              <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-5 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-200 uppercase">👤 Datos del Cliente Remitente</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <p><strong>Nombre:</strong> {selectedTracking.cliente}</p>
                  <p><strong>Cédula / DNI:</strong> {selectedTracking.cedula}</p>
                  <p><strong>Teléfono:</strong> {selectedTracking.telefono || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border-t border-slate-800 p-5 flex justify-end">
              <button onClick={() => setSelectedTracking(null)} className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase transition">Cerrar Detalle</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUTOGESTIÓN DE CUENTAS DEL PROPIO CAJERO */}
      {isEditingSelfBanks && selfBanksForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-100">
            <div className="bg-indigo-600 text-white p-5 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-base uppercase tracking-wider flex items-center gap-2">
                👤 Editar Mi Perfil / Datos Bancarios
              </h3>
              <button onClick={() => setIsEditingSelfBanks(false)} className="text-white hover:text-indigo-100 text-2xl font-bold">&times;</button>
            </div>
            
            {(() => {
              const myPendingRequest = solicitudesPerfil.find(r => r.cajeroId === session?.user?.id);
              if (myPendingRequest) {
                return (
                  <div className="p-6 space-y-5 text-slate-100 text-xs">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-400 space-y-3 leading-relaxed">
                      <span className="font-extrabold text-sm block">⏳ Solicitud Pendiente de Aprobación</span>
                      <p>Ya has enviado una solicitud de cambios en tu perfil. El administrador la revisará a la brevedad. Mientras tanto, no puedes realizar nuevas modificaciones.</p>
                      
                      <div className="border-t border-amber-500/20 pt-3.5 space-y-2">
                        <span className="font-black text-[10px] uppercase text-amber-300 tracking-wider">Cambios propuestos:</span>
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80 font-bold">
                          <div>Nombre: <span className="text-amber-200">{myPendingRequest.datos.nombre}</span></div>
                          <div>Binance Pay ID: <span className="text-amber-200">{myPendingRequest.datos.binance_wallet || 'N/A'}</span></div>
                        </div>
                        <div className="space-y-1 mt-2">
                          <strong className="text-amber-350 text-[10px] uppercase tracking-wide block">Cuentas Bancarias Propuestas:</strong>
                          {Object.entries(myPendingRequest.datos.bancoConfig || {}).map(([code, b]: [string, any]) => (
                            <div key={code} className="bg-slate-900/30 p-2 rounded border border-slate-800/50">
                              <span className="font-bold text-[9px] uppercase text-amber-200/80">{code}:</span> {b.banco} | {b.cuenta} | {b.titular} | {b.cedula}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setIsEditingSelfBanks(false)} className="w-1/3 py-2.5 rounded-xl font-bold border border-slate-800 hover:bg-slate-900 text-slate-400 transition text-[10px] uppercase tracking-wider">Cerrar</button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleCancelRequestPerfil(session.user.id);
                          setIsEditingSelfBanks(false);
                        }}
                        className="w-2/3 py-2.5 rounded-xl font-extrabold bg-red-950/40 hover:bg-red-950/60 border border-red-900/35 text-red-400 transition text-[10px] uppercase tracking-wider animate-pulse hover:animate-none"
                      >
                        ❌ Retirar Solicitud
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (session?.user?.id) {
                    await handleRequestEditPerfil(session.user.id, selfBanksForm);
                    setIsEditingSelfBanks(false);
                  }
                }} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-none text-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Mi Nombre</label>
                    <input
                      type="text"
                      required
                      value={selfBanksForm.nombre || ''}
                      onChange={e => setSelfBanksForm({ ...selfBanksForm, nombre: e.target.value })}
                      className="w-full bg-slate-900 rounded-lg border border-slate-800 p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                    />
                  </div>

                  <h4 className="text-indigo-400 font-black text-[10px] uppercase tracking-widest pt-2 border-t border-slate-800">Cuentas Bancarias por País / Canal</h4>
                  <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
                    {(selfBanksForm.pais_operacion || '').split(',').map(p => p.trim()).filter(Boolean).map(code => {
                      const info = paises[code] || { nombre: code, flag: '🏳️' };
                      const config = selfBanksForm.bancoConfig?.[code] || { banco: '', cuenta: '', titular: '', cedula: '' };
                      const updateConfig = (field: keyof BancoCuentaConfig, value: string) => {
                        const nextConfig = {
                          ...(selfBanksForm.bancoConfig || {}),
                          [code]: {
                            ...config,
                            [field]: value
                          }
                        };
                        setSelfBanksForm({
                          ...selfBanksForm,
                          bancoConfig: nextConfig
                        });
                      };

                      return (
                        <div key={code} className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl space-y-2">
                          <span className="text-[10px] font-black text-indigo-350 uppercase flex items-center gap-1.5 border-b border-slate-800/60 pb-1.5">
                            {info.flag} {info.nombre} ({code})
                          </span>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Banco / Proveedor</label>
                              <input
                                type="text"
                                placeholder="Ej: Banesco / Yappy"
                                value={config.banco}
                                onChange={e => updateConfig('banco', e.target.value)}
                                className="w-full bg-slate-950 rounded-lg border border-slate-800/80 p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                                required
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Número Cuenta / Teléfono</label>
                              <input
                                type="text"
                                placeholder="0102... / +58412..."
                                value={config.cuenta}
                                onChange={e => updateConfig('cuenta', e.target.value)}
                                className="w-full bg-slate-950 rounded-lg border border-slate-800/80 p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                                required
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Titular</label>
                              <input
                                type="text"
                                placeholder="Nombre del Titular"
                                value={config.titular}
                                onChange={e => updateConfig('titular', e.target.value)}
                                className="w-full bg-slate-950 rounded-lg border border-slate-800/80 p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                                required
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Identificación (ID/DNI)</label>
                              <input
                                type="text"
                                placeholder="V-12345678"
                                value={config.cedula}
                                onChange={e => updateConfig('cedula', e.target.value)}
                                className="w-full bg-slate-950 rounded-lg border border-slate-800/80 p-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(selfBanksForm.pais_operacion || '').split(',').map(p => p.trim()).filter(Boolean).length === 0 && (
                      <span className="text-[10px] text-slate-500 italic block text-center py-2">No tienes países asignados para configurar bancos.</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Binance Wallet / Pay ID (Global)</label>
                    <input
                      type="text"
                      required
                      value={selfBanksForm.binance_wallet || ''}
                      onChange={e => setSelfBanksForm({ ...selfBanksForm, binance_wallet: e.target.value })}
                      className="w-full bg-slate-900 rounded-lg border border-slate-800 p-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                    <button type="button" onClick={() => setIsEditingSelfBanks(false)} className="w-1/3 py-2.5 rounded-lg font-bold border border-slate-800 hover:bg-slate-900 text-slate-400 transition text-xs uppercase">Cancelar</button>
                    <button type="submit" className="w-2/3 py-2.5 rounded-lg font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/20 text-xs uppercase">Enviar Solicitud 🚀</button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
