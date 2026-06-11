-- =====================================================================
-- transfercash-app: Políticas RLS en Supabase
-- =====================================================================
-- Ejecuta este script en el editor SQL de tu panel de Supabase.
-- Enforce que los cajeros solo puedan ver sus propios movimientos.
-- =====================================================================

-- 1. Habilitar RLS en la tabla remesas
ALTER TABLE remesas ENABLE ROW LEVEL SECURITY;

-- 2. Asegurar que las políticas antiguas se limpien si existen
DROP POLICY IF EXISTS admin_all_policy ON remesas;
DROP POLICY IF EXISTS cajero_self_policy ON remesas;
DROP POLICY IF EXISTS cajero_update_policy ON remesas;

-- 3. POLÍTICA PARA ADMINISTRADORES: Acceso completo a todas las remesas
CREATE POLICY admin_all_policy ON remesas
  FOR ALL
  TO authenticated
  USING (
    -- Valida si el rol en JWT coincide con administrator o es un admin de Supabase Auth
    auth.jwt() ->> 'role' = 'administrator'
  );

-- 4. POLÍTICA PARA CAJEROS: Solo leer transacciones donde intervienen como origen o destino
CREATE POLICY cajero_self_policy ON remesas
  FOR SELECT
  TO authenticated
  USING (
    cajero_origen = auth.uid()::text 
    OR 
    cajero_destino = auth.uid()::text
  );

-- 5. POLÍTICA PARA CAJEROS: Solo actualizar transacciones donde intervienen como origen o destino
CREATE POLICY cajero_update_policy ON remesas
  FOR UPDATE
  TO authenticated
  USING (
    cajero_origen = auth.uid()::text 
    OR 
    cajero_destino = auth.uid()::text
  )
  WITH CHECK (
    cajero_origen = auth.uid()::text 
    OR 
    cajero_destino = auth.uid()::text
  );
