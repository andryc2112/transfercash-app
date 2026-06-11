import { useState, useEffect, useMemo } from 'react';
import { CalculadoraRemesa, defaultPaisesData } from './components/CalculadoraRemesa';
import type { PaisData } from './components/CalculadoraRemesa';
import { TablaPendientes } from './components/TablaPendientes';
import { SeccionRetiros } from './components/SeccionRetiros';
import { SeccionSan } from './components/SeccionSan';
import { LogOut, Bell, Send, Settings } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'calculadora' | 'pendientes' | 'retiros' | 'san' | 'historial'>('calculadora');
  const [cajeroPais] = useState('VE'); // Venezuela
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
                chat_id: telegramChatId,
                text,
                parse_mode: 'Markdown'
              })
            }).then(async res => {
              if (res.ok) setPaisesConAlertaEnviada(prev => ({ ...prev, [code]: true }));
              else console.error('Telegram Error:', await res.json());
            }).catch(e => console.error('Error de red enviando alerta:', e));
          } else if (diff <= 1.5 && yaEnviada) {
            const text = `✅ *RESOLUCIÓN: TASA ALINEADA EN ${info.flag} ${info.nombre}* \n\n` +
              `• La tasa manual (${info.venta.toFixed(2)}) ya se encuentra alineada con Binance P2P (${marketVal.toFixed(2)} ${info.simbolo}) con un desfase menor al 1.5%.`;

            fetch(`https://api.telegram.org/bot8576377601:AAFlnEF38oYA2i1RmwAMGIHY6slsVIvat8c/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text,
                parse_mode: 'Markdown'
              })
            }).then(async res => {
              if (res.ok) setPaisesConAlertaEnviada(prev => ({ ...prev, [code]: false }));
              else console.error('Telegram Error:', await res.json());
            }).catch(e => console.error('Error de red enviando resolución:', e));
          }
        }
      });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [binanceMarketRates, paises, paisesConAlertaEnviada]);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchDatosSupabase();
        suscribirseCambiosSupabase();
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


  const fetchDatosSupabase = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

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

      if (currentSession?.user) {
        const miPerfil = cajerosData.find((c: any) => c.id === currentSession.user.id);
        if (miPerfil) {
          setSaldoAcumulado(parseFloat(miPerfil.saldo_acumulado) || 0);
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
      const adminConfig = configData.find((c: any) => c.clave === 'admin_emails');
      if (adminConfig) {
        setAdminEmails(JSON.parse(adminConfig.valor));
      }
      const tgConfig = configData.find((c: any) => c.clave === 'telegram_chat_id');
      if (tgConfig) {
        setTelegramChatId(tgConfig.valor);
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
          estado: 'PENDIENTE',
          cajero_origen: session?.user?.id
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
    } catch (error: any) {
      triggerToast(`Error al registrar operación: ${error.message}`);
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

    const { error } = await supabase
      .from('remesas')
      .update({
        estado: 'PAGADO',
        referencia_banco_emisor: bancoRef,
        referencia_venta_binance: binanceRef,
        tasa_venta_usdt: binanceTasa,
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
    const { error } = await supabase
      .from('retiros')
      .insert({
        cajero_id: session?.user?.id,
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

    await supabase
      .from('configuracion_tasas')
      .upsert({ pais_codigo: code, compra, venta }, { onConflict: 'pais_codigo' });
    triggerToast(`Tasa de ${paises[code]?.nombre || code} actualizada con éxito.`);
  };

  const handleUpdateMargenGlobal = (newMargin: number) => {
    addAuditLog(`Actualizó el margen global a: ${newMargin}%`);
    setMargenGlobal(newMargin);
    localStorage.setItem('tc_margenGlobal', String(newMargin));
    triggerToast(`Margen global actualizado a ${newMargin}%`);
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

  const pendingDepositos = useMemo(() => {
    return depositos.filter(d => d.estado === 'PENDIENTE');
  }, [depositos]);

  const pendingRemesas = useMemo(() => {
    return remesas.filter(r => r.estado === 'PENDIENTE' && r.destino === cajeroPais);
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
                  await supabase.from('perfiles_cajeros').upsert({
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
              <button onClick={() => supabase.auth.signOut()} title="Cerrar Sesión" className="text-slate-400 hover:text-red-400 transition p-2 bg-slate-900/60 rounded-xl border border-slate-900">
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
                          <th className="p-4 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remesas.filter(r => r.estado !== 'PENDIENTE').map(rem => (
                          <tr key={rem.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="p-4 text-xs">
                              <span className="font-bold text-slate-900 block">{rem.cliente}</span>
                              <span className="text-slate-500">{rem.fecha}</span>
                            </td>
                            <td className="p-4 text-xs">
                              <span className="font-bold text-slate-800">{rem.origen} ➔ {rem.destino}</span>
                              <span className="block text-slate-500">Monto: {rem.simboloDestino} {rem.montoDestino.toFixed(2)}</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${rem.estado === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {rem.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {remesas.filter(r => r.estado !== 'PENDIENTE').length === 0 && (
                          <tr><td colSpan={3} className="text-center p-8 text-slate-500">No hay transacciones en el historial.</td></tr>
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
    </div>
  );
}
