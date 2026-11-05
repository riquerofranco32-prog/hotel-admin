# Hotel PMS — Panel de administración

Panel de gestión hotelera (tipo CRM / PMS) hecho con **Next.js 15 + React 19 + Tailwind**, base de datos **Firebase Firestore** (tiempo real, multiusuario) y autenticación **Firebase Auth**. Listo para desplegar en **Vercel** desde **GitHub**.

> Sin variables de Firebase la app arranca en **modo demo**: datos de ejemplo guardados en el navegador, y podés entrar como cualquier usuario para probar los roles.

## Secciones

| Sección | Qué hace |
|---|---|
| **Dashboard** | Saludo + indicadores del día (ocupación, llegadas, salidas, housekeeping, cobrado hoy, ADR). Calendario mensual habitación × día con colores: 🟢 Ocupada · 🔵 Reservada · 🔴 Próxima a salir · ⚪ Otros · rayado = mantenimiento. Clic en día libre = reservar, clic en barra = ficha, **arrastrar** = mover de habitación/fecha. Abajo: llegadas y salidas de hoy, estado de habitaciones y **actividad en vivo** del personal. |
| **Mi jornada** | Vista para mucamas, mantenimiento y restaurante (pensada para celular): mis tareas con checklist de un toque, botones grandes Empezar/Terminar, tareas libres para “tomar”, **reportar problema** (crea la reparación para mantenimiento) y estado de todas las habitaciones. |
| **Recepción** | Llegadas, salidas y huéspedes en casa con check-in / check-out en un clic, walk-ins, estado de limpieza de la habitación antes de entregarla. |
| **Reservas** | Listado con filtros rápidos por estado, fechas y canal; alta/edición con control de superposición y capacidad. |
| **Huéspedes (CRM)** | Segmentos (en casa, próximas llegadas, VIP, frecuentes, empresas, cumpleaños del mes, bloqueados), valor de cada cliente, etiquetas, preferencias (aparecen al preparar la habitación), historial y acceso directo a WhatsApp. |
| **Mantenimiento** | Tablero de tareas, estado de habitaciones, rendimiento del personal y registro de **quién hizo qué y cuándo**. |
| **Menús** | Carta y pedidos de room service: cada pedido se carga solo al folio. |
| **WhatsApp** | Plantillas, envíos sugeridos del día, avisos de tareas al personal, historial. |
| **Facturación** | Folio por reserva, pagos, saldo, facturas imprimibles, resumen del mes. |
| **Finanzas** | Producción, cobranzas, ocupación diaria, ADR, RevPAR, canales, medios de pago, cuentas por cobrar y mejores clientes. Exportable. |
| **Automatizaciones** | Centro de reglas por panel: cada una se activa/desactiva y se ajusta (anticipación, tareas de check-out, auto-asignación, escalamiento, no-show, avisos en vivo). Historial de ejecuciones. |
| **Administradores** | Personal y cargos (con quién está en línea), **matriz de permisos editable**, habitaciones, configuración, auditoría y base de datos. |

Búsqueda global con **Ctrl + K** (huéspedes, reservas, habitaciones) y alertas 🔔 en la barra superior.

## Cargos y permisos

| Cargo | Ve por defecto |
|---|---|
| **Administrador general** | Todo, incluidas finanzas, automatizaciones y administración. |
| **Gerencia** | Todo lo operativo + facturación y finanzas (no usuarios ni automatizaciones). |
| **Recepción** | Dashboard, recepción, reservas, huéspedes, mantenimiento, menús, WhatsApp y facturación. Sin reportes financieros. |
| **Mucama / Housekeeping** | Mi jornada y Mantenimiento. **Nunca ve montos, pagos ni facturas.** |
| **Mantenimiento técnico** | Mi jornada y Mantenimiento. |
| **Restaurante** | Menús / room service y Mi jornada. |

El administrador ajusta todo desde *Administradores → Permisos por cargo*. La seguridad también está aplicada en la base de datos (`firestore.rules`): aunque alguien intente leer pagos o facturas por fuera de la app sin tener el cargo, Firestore lo rechaza.

## Automatización y tiempo real

| Cuando… | Entonces se crea automáticamente |
|---|---|
| 🔴 La reserva pasa a **Próxima a salir** (sale hoy o mañana) | *Pre-salida*: revisar minibar y consumos, daños, confirmar horario (Recepción). Se cierra sola al hacer check-out. |
| Se hace el **check-out** | 🛏️ Cambio de sábanas y toallas · 🧹 Limpieza de salida · 🧴 Reposición de amenities · 🔍 Inspección final. La habitación queda **Sucia** → **En limpieza** → **Lista** al completarlas. |
| 🔵 Hay una **llegada** hoy o mañana | *Preparar habitación* con los pedidos especiales del huésped. Si la habitación sigue sucia el día de llegada → alerta. |
| 🟢 Huésped en casa (opcional) | *Repaso diario*. |
| Reparación marcada “bloquea habitación” | La habitación queda **En mantenimiento** (rayada en el calendario) hasta completarla. |

Las tareas se asignan solas a la persona del rol correspondiente con menos carga, tienen IDs determinísticos (no se duplican aunque haya varias PCs abiertas) y cada acción queda registrada con usuario y hora. Además: tareas vencidas se escalan a urgente, no-shows automáticos (opcional), cierre automático de tareas al hacer check-in/out, y avisos en vivo a todos los conectados (por ejemplo, cuando una mucama termina una habitación, recepción y el admin lo ven al instante en el dashboard). Todo se configura en **Automatizaciones**.

### Performance

- Índices en memoria (habitación, huésped, reserva, folio) para que cada pantalla calcule al instante.
- Calendario con filas memorizadas, tooltip y eventos fuera del render principal.
- Firestore con caché persistente (IndexedDB): recargas instantáneas y funciona sin conexión.
- Cada cargo sólo descarga las colecciones que puede ver, y sólo la historia reciente (reservas/pagos del último año, tareas de 90 días, auditoría: últimos 1000 eventos).


## Correr localmente

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 (modo demo).

### Probar con Firebase sin crear un proyecto (emulador local)

Requiere Java 11+. En una terminal:

```bash
npm run emulators
```

En otra, creá `.env.local` con `NEXT_PUBLIC_FIREBASE_EMULATOR=1`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-hotel` y valores cualquiera en las demás `NEXT_PUBLIC_FIREBASE_*`, y corré `npm run dev`. Usa las mismas reglas de seguridad que producción.

## Configurar Firebase

1. En https://console.firebase.google.com creá un proyecto.
2. **Authentication → Sign-in method →** habilitá *Correo electrónico/contraseña*.
3. **Firestore Database →** crear base (modo producción).
4. **Reglas**: copiá el contenido de `firestore.rules` en *Firestore → Reglas* y publicá (o `npx firebase-tools deploy --only firestore:rules`).
5. **Configuración del proyecto → Tus apps → Web (</>)**: registrá una app y copiá los valores a `.env.local` (ver `.env.example`).
6. Entrá a la app y elegí **Crear cuenta**: el **primer usuario queda como administrador**.
7. En *Administradores → Base de datos* podés **cargar datos de demostración** o empezar de cero y cargar tus habitaciones reales.
8. Para sumar personal: *Administradores → Usuarios → Nuevo usuario* con su email; esa persona entra con “Crear cuenta” usando el mismo email.

## Deploy en Vercel + GitHub

```bash
git remote add origin https://github.com/TU_USUARIO/hotel-admin.git
git push -u origin main
```

En https://vercel.com/new importá el repo (detecta Next.js solo). En *Settings → Environment Variables* cargá las 6 variables `NEXT_PUBLIC_FIREBASE_*` y redeployá. Agregá el dominio de Vercel en *Firebase → Authentication → Settings → Authorized domains*.

## Estructura

```
app/(panel)/…        páginas de cada sección
app/login            inicio de sesión
components/          Shell (menú, búsqueda, avisos en vivo), AppProvider (datos, índices, permisos), reservas, tareas, UI
lib/types.ts         modelo de datos
lib/logic.ts         colores, estados, folio, cargos y permisos, configuración de automatizaciones
lib/automation.ts    motor reservas → mantenimiento
lib/actions.ts       todas las operaciones (check-in, check-out, pagos, tareas…)
lib/db.ts            adaptador Firestore / localStorage
lib/seed.ts          datos de demostración
firestore.rules      reglas de seguridad
```
