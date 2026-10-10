# Control de horas UPANA

Sistema web en español para el control de horas del Call Center UPANA. Incluye panel privado de supervisores, formulario público de solicitudes, aprobación segura e idempotente, registro de movimientos por minuto y exportación Excel.

## Archivos

- `index.html`, `styles.css`, `app.js`: panel de supervisión y balance por agente.
- `solicitudes.html`, `requests.js`: formulario público para los agentes; no requiere autenticación.
- `firebase-config.js`: configuración pública de la aplicación web Firebase del proyecto `lmsupana`.
- `firestore.rules`: permisos y validaciones para solicitudes y movimientos.
- `functions/index.js`: revisión transaccional de solicitudes y creación del movimiento asociado.
- `functions/set-role.js`: herramienta administrativa local para asignar claims de supervisor o admin.
- `firebase.json`, `.firebaserc`, `firestore.indexes.json`: configuración para desplegar Functions, reglas y Hosting.

## Datos y saldo

Cada evento guarda `eventAt` (fecha/hora en que ocurrieron o se programaron las horas) y `createdAt` (fecha/hora de registro, asignada por Firestore). La duración se almacena como minutos enteros para conservar precisión.

- **Horas a favor:** representan tiempo extra ya trabajado; deben llevar una fecha/hora pasada o actual. Al aprobarse suman minutos al saldo.
- **Tiempo por recuperar:** representa tiempo solicitado que el agente debe reponer; puede ser pasado o programado hasta 180 días adelante. Una aprobación crea el movimiento inmediatamente, pero si su `eventAt` es futuro no afecta el saldo actual hasta que llegue ese instante.
- **Balance:** los eventos efectivos se suman con signo: a favor positivo y por recuperar negativo. El panel muestra por separado tiempo a favor, tiempo por recuperar y balance neto en horas/minutos.
- **Registro manual de supervisión:** solo acepta eventos no futuros. También guarda la hora exacta del evento y automáticamente la hora de registro.
- **Solicitudes:** empiezan en `pending`. Rechazar conserva el registro sin crear movimiento. Aprobar actualiza estado y crea el movimiento dentro de una sola transacción. El ID del movimiento deriva del ID de la solicitud; repetir la aprobación no duplica horas.

## Seguridad

- Firebase Authentication por correo/contraseña es solo para supervisores. No hay registro público.
- Los roles se guardan en **custom claims** confiables de Firebase Authentication: `role: "supervisor"` o `role: "admin"`. La app no acepta roles enviados desde el navegador. El acceso al panel, las reglas y Cloud Functions verifican estos claims.
- La página pública solo puede crear documentos nuevos y validados en `hourRequests`. No puede leer solicitudes, balances ni movimientos. No puede cambiar el estado de una solicitud.
- El código admite Firebase App Check con reCAPTCHA v3 para limitar envíos automatizados. Antes de exigir App Check en Firestore, registra la app web en **App Check**, agrega el dominio y coloca la site key pública en `appCheckSiteKey` de `firebase-config.js`.
- Solo supervisores/admin pueden leer solicitudes y movimientos o crear movimientos manuales. Las decisiones pasan por Cloud Functions. Los movimientos existentes no se pueden editar ni borrar desde el cliente.
- Los nombres se resuelven desde el catálogo local usando la extensión validada; el formulario público no puede asignar el nombre de otro agente a una solicitud.

## Preparar Firebase Console

1. Abre el proyecto `lmsupana` en [Firebase Console](https://console.firebase.google.com/).
2. En **Authentication → Sign-in method**, habilita **Correo electrónico/contraseña**. En **Authentication → Users**, crea las cuentas de supervisores. No habilites registro público.
3. Crea **Firestore Database** si aún no existe.
4. Cloud Functions requiere el plan **Blaze** y facturación activa en el proyecto. El runtime configurado es Node.js 22, compatible con Cloud Functions según la [guía oficial de Firebase](https://firebase.google.com/docs/functions/get-started).
5. Añade el dominio de Hosting a **Authentication → Settings → Authorized domains**.
6. Antes de abrir el formulario al público, registra la app web en **App Check** con reCAPTCHA v3, coloca únicamente la site key pública en `appCheckSiteKey` de `firebase-config.js` y revisa las métricas. Mantén la secret key de reCAPTCHA en su consola; nunca la publiques en el sitio. Después activa la aplicación gradual de App Check para Cloud Firestore. Firebase recomienda inicializar App Check en la app web y revisar métricas antes de exigir tokens ([guía oficial](https://firebase.google.com/docs/app-check/web/recaptcha-provider)).

## Asignar roles

Los claims se asignan desde un entorno administrativo confiable; no se crean documentos `users` en Firestore.

1. Instala Node.js 22 y Firebase CLI. Desde la carpeta `outputs`, ejecuta `firebase login`.
2. Entra a `functions` e instala dependencias: `npm install`.
3. Autentica Google Application Default Credentials con una cuenta que tenga permisos IAM para administrar usuarios del proyecto, por ejemplo `gcloud auth application-default login`.
4. Asigna el primer rol admin usando el UID de Authentication: `npm run set-role -- UID_DEL_USUARIO admin`.
5. Asigna supervisores: `npm run set-role -- UID_DEL_USUARIO supervisor`. Para retirar un rol usa `npm run set-role -- UID_DEL_USUARIO none`.
6. El usuario debe cerrar sesión y volver a entrar para obtener el claim actualizado.

El claim `admin` no se puede conceder desde la propia app. La herramienta `set-role.js` usa credenciales administrativas del entorno y no incluye llaves privadas en los archivos.

## Desplegar

Desde la carpeta `outputs`:

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

Al terminar, comparte la página pública de solicitudes con agentes: `https://lmsupana.web.app/solicitudes.html`. El panel privado queda en `https://lmsupana.web.app/`.

## Uso

1. Un agente abre `solicitudes.html`, selecciona su extensión, indica el tipo, fecha/hora exacta, duración, motivo y, si desea, datos de contacto.
2. Una solicitud de horas a favor debe corresponder a tiempo ya trabajado. Para recuperación puede indicarse una fecha futura de hasta seis meses.
3. Un supervisor entra al panel, revisa la solicitud y aprueba o rechaza. La decisión guarda supervisor, momento y nota opcional.
4. La aprobación genera automáticamente un movimiento con referencia a la solicitud. Si se intenta aprobar de nuevo, el backend conserva un solo movimiento.
5. El botón **Exportar Excel** descarga un libro `.xlsx` con pestañas de movimientos y balance por agente, según los filtros del panel.

Los documentos antiguos que tengan `signedHours` y `eventDate` se siguen leyendo en el balance; los nuevos usan minutos y fecha/hora completa.
