# Control de horas UPANA

Panel privado de supervisión para consultar balances, registrar horas y revisar una auditoría de movimientos. La aplicación web usa Firebase Authentication y Cloud Firestore directamente desde GitHub Pages: no usa Cloud Functions ni requiere Firebase Hosting.

## Publicar la página

Sube a tu repositorio de GitHub los archivos `index.html`, `app.js`, `styles.css`, `firebase-config.js` y `favicon.svg`. Configura GitHub Pages para publicar la rama/carpeta donde estén esos archivos. Los cambios visuales y de interfaz se publican con un `push` a GitHub; no se ejecuta `firebase deploy`.

## Acceso y base de datos

- El inicio de sesión usa las cuentas de correo/contraseña ya existentes en Firebase Authentication.
- Los correos habilitados en la interfaz son `jmjuarez@upana.edu.gt`, `nozuna@upana.edu.gt` y `ccoyoy@upana.edu.gt`.
- El catálogo de agentes vive en `app.js`; los movimientos se guardan en la colección `movements` de Firestore.
- La página no contiene formularios públicos, solicitudes de agentes, aprobaciones ni llamadas a Cloud Functions.
- El acceso real a Firestore sigue sujeto a las reglas ya configuradas en el proyecto. `firestore.rules` se conserva como referencia del esquema; no se carga ni modifica automáticamente desde GitHub Pages.

## Auditoría y correcciones

Cada movimiento contiene agente, tipo, duración en minutos, fecha/hora del evento, motivo, fecha de registro, UID y correo autenticado del supervisor que lo registró. La pestaña **Auditoría** consulta esos mismos documentos y filtra por acción, agente, usuario o texto.

Los movimientos no se editan ni se borran físicamente. Para corregir un registro, el sistema agrega en una sola operación un movimiento inverso y, si corresponde, el movimiento corregido. Para anular, agrega solo el movimiento inverso. Ambos quedan asociados al supervisor, fecha de creación y referencia en el motivo; el original permanece visible. Esta bitácora cubre las acciones hechas desde la aplicación y conserva un libro de solo anexado.

## Datos

- Las duraciones se guardan como minutos enteros.
- Las horas a favor suman al balance; las pendientes de recuperar/pagar restan.
- El saldo actual excluye eventos futuros.
- El Excel exporta el detalle de movimientos/auditoría y el balance por agente con los filtros aplicados.

## Nota sobre reglas antiguas

La versión anterior permitía crear documentos públicos en `hourRequests`. Este panel ya no usa esa colección. Si se quiere cerrar también ese acceso en Firebase, alguien con permisos del proyecto debe quitar la regla antigua de `hourRequests` desde Firebase Console y publicar las reglas. Eso es una limpieza de seguridad opcional para el panel nuevo, no un despliegue de la aplicación.
