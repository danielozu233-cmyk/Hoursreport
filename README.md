# Control de horas UPANA

Aplicación web en español para consultar el balance de horas por agente, registrar movimientos y descargar el historial en CSV. Usa Firebase Authentication y Cloud Firestore del proyecto `lmsupana`.

## Estructura y seguridad

- `index.html`, `styles.css` y `app.js`: interfaz y lógica del sistema.
- `firebase-config.js`: configuración pública del cliente web Firebase facilitada por el usuario. No contiene credenciales de servicio ni contraseñas.
- `firestore.rules`: reglas para publicar en Firestore.
- El catálogo completo de 25 agentes se mantiene en `app.js` con su extensión como identificador estable.
- Los movimientos se guardan en `movements/{id}` con `agentId`, `agentName`, `type` (`favor` o `deuda`), `signedHours`, `note`, `createdAt`, `createdBy` y `createdByEmail`.
- Los saldos se calculan sumando el historial: horas positivas son a favor; horas negativas son pendientes. Los movimientos no se pueden editar ni borrar desde el cliente.
- Los perfiles de autorización se guardan en `users/{uid}` con `role` (`admin`, `editor` o `viewer`) y `active` (`true` o `false`). Solo administración gestiona perfiles; editores y admins registran movimientos.

Las reglas permiten leer datos solo a usuarios autenticados con perfil activo. El rol se valida en reglas de Firestore, así que ocultar botones en la interfaz no es la protección de seguridad. La configuración web Firebase es pública por diseño; la protección real está en Authentication y las reglas.

## Activación en Firebase Console

1. Abre el proyecto `lmsupana` en [Firebase Console](https://console.firebase.google.com/).
2. En **Authentication → Sign-in method**, habilita **Correo electrónico/contraseña**.
3. En **Authentication → Users**, agrega las cuentas autorizadas. No existe registro público desde esta aplicación.
4. En **Firestore Database**, crea la base de datos si aún no existe.
5. En **Firestore Database → Rules**, pega el contenido de `firestore.rules` y publícalo.
6. En **Firestore Database → Data**, crea la colección `users`. Para cada usuario, usa su UID exacto como ID de documento y estos campos:

   ```
   role: "admin"       // admin, editor o viewer
   active: true
   displayName: "Nombre de la persona"  // opcional
   ```

7. Crea primero el usuario en Authentication y luego el documento `users/{uid}` para asignar el primer admin. La aplicación no concede roles automáticamente.
8. Publica la carpeta completa en un hosting estático con HTTPS (por ejemplo Firebase Hosting). Añade el dominio del sitio a **Authentication → Settings → Authorized domains**. Para probar localmente, sirve la carpeta con un servidor local; abrir `index.html` directamente puede bloquear los módulos JavaScript.

## Roles

- `admin`: lee datos, registra movimientos y administra perfiles en Firestore Console.
- `editor`: lee datos y registra movimientos.
- `viewer`: solo consulta y exporta CSV.
- `active: false`: deniega el acceso aunque exista una sesión de Authentication.

Para dar o retirar acceso, cambia el documento del usuario desde Firestore Console. No elimines reglas ni uses reglas abiertas de prueba. Las reglas incluidas son una base lista para desplegar y deben revisarse junto con la política interna de acceso de UPANA.

## Uso

1. Inicia sesión con una cuenta habilitada y con perfil activo.
2. Filtra agentes por nombre/extensión, estado de saldo o período.
3. Abre el historial de una persona para revisar sus movimientos y balance.
4. Registra horas a favor o pendientes con cantidad y motivo. Cada registro queda asociado a la cuenta que lo creó y no se puede modificar desde la app.
5. Usa **Exportar CSV** para descargar los movimientos que coinciden con los filtros aplicados.

La interfaz importa Firebase JS SDK modular desde el CDN oficial (`12.19.0`) y necesita conexión a internet.
