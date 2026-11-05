# Hotel PMS — Panel de administración

Panel de gestión hotelera (tipo CRM / PMS) hecho con **Next.js 15 + React 19 + Tailwind**, base de datos **Firebase Firestore** (tiempo real, multiusuario) y autenticación **Firebase Auth**. Listo para desplegar en **Vercel** desde **GitHub**.

> Sin variables de Firebase la app arranca en **modo demo**: datos de ejemplo guardados en el navegador, y podés entrar como cualquier usuario para probar los roles.

## Secciones

| Sección | Qué hace |
|---|---|
| **Dashboard** | Calendario mensual habitación × día. Colores: 🟢 Ocupada · 🔵 Reservada · 🔴 Próxima a salir · ⚪ Otros estados · rayado = mantenimiento. Filtros por piso/estado, búsqueda, vista compacta, alertas 🔔, exportar CSV, clic en celda vacía = nueva reserva, clic en barra = ficha de la reserva. Punto de color junto a cada habitación = estado de limpieza. |
| **Reservas** | Listado con filtros, alta/edición con control de superposición y capacidad, ficha y historial de huéspedes. |
| **Recepción** | Llegadas, salidas y huéspedes en casa del día con check-in / check-out en un clic, walk-ins, estado de limpieza de cada habitación antes de entregarla. |
| **Facturación** | Folio por reserva (alojamiento + consumos), pagos por medio, saldo, emisión e impresión de facturas, resumen del mes. |
| **Menús** | Carta del restaurante y pedidos de room service: cada pedido se carga solo al folio del huésped. |
| **Mantenimiento** | Tablero de tareas (pendiente / en progreso / completada), checklist por tarea, estado de habitaciones, rendimiento del personal y registro de **quién hizo qué y cuándo**. |
| **WhatsApp** | Plantillas con variables, envíos sugeridos del día (pre-llegada, check-out, agradecimiento), aviso de tareas al personal, historial. Abre WhatsApp con el mensaje listo (`wa.me`). |
| **Administradores** | Usuarios y roles, permisos, habitaciones, configuración, auditoría de todas las acciones, carga de datos demo. |

## Cómo se conecta reservas ↔ mantenimiento

| Cuando… | Entonces se crea automáticamente |
|---|---|
| 🔴 La reserva pasa a **Próxima a salir** (sale hoy o mañana) | *Pre-salida*: revisar minibar y consumos, daños, confirmar horario (Recepción). Se cierra sola al hacer check-out. |
| Se hace el **check-out** | 🛏️ Cambio de sábanas y toallas · 🧹 Limpieza de salida · 🧴 Reposición de amenities · 🔍 Inspección final. La habitación queda **Sucia** → **En limpieza** → **Lista** al completarlas. |
| 🔵 Hay una **llegada** hoy o mañana | *Preparar habitación* con los pedidos especiales del huésped. Si la habitación sigue sucia el día de llegada → alerta. |
| 🟢 Huésped en casa (opcional) | *Repaso diario*. |
| Reparación marcada “bloquea habitación” | La habitación queda **En mantenimiento** (rayada en el calendario) hasta completarla. |

Las tareas se asignan solas a la persona del rol correspondiente con menos carga, tienen IDs determinísticos (no se duplican aunque haya varias PCs abiertas) y cada acción queda registrada con usuario y hora. Las reglas se activan/desactivan en *Mantenimiento → Reglas automáticas*.

## Roles

- **Administrador**: todo.
- **Recepción**: todo menos Administradores.
- **Limpieza / Mantenimiento técnico**: Dashboard y Mantenimiento (ven sus tareas asignadas).

## Correr localmente

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 (modo demo).

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
components/          Shell (menú), AppProvider (datos + auth), reservas, tareas, UI
lib/types.ts         modelo de datos
lib/logic.ts         colores, estados, folio, permisos, plantillas de tareas
lib/automation.ts    motor reservas → mantenimiento
lib/actions.ts       todas las operaciones (check-in, check-out, pagos, tareas…)
lib/db.ts            adaptador Firestore / localStorage
lib/seed.ts          datos de demostración
firestore.rules      reglas de seguridad
```
