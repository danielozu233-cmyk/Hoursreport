import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = getFirestore();
const allowedAgents = new Set([
  "8001", "8002", "8003", "8004", "8005", "8007", "8008", "8009", "8010",
  "8011", "8013", "8014", "8016", "8017", "8018", "8020", "8021", "8022",
  "8023", "8024", "8025", "8026", "8027", "8028", "8029"
]);

function requireSupervisor(request) {
  const role = request.auth?.token?.role;
  if (!request.auth || !["supervisor", "admin"].includes(role)) {
    throw new HttpsError("permission-denied", "Se requiere una cuenta de supervisión autorizada.");
  }
  return request.auth;
}

export const reviewHourRequest = onCall(async (request) => {
  const reviewer = requireSupervisor(request);
  const { requestId, decision, decisionNote = "" } = request.data ?? {};
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{12,40}$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "La solicitud indicada no es válida.");
  }
  if (!["approved", "rejected"].includes(decision)) {
    throw new HttpsError("invalid-argument", "La decisión debe ser aprobar o rechazar.");
  }
  if (typeof decisionNote !== "string" || decisionNote.length > 500) {
    throw new HttpsError("invalid-argument", "La nota de decisión no puede exceder 500 caracteres.");
  }

  const requestRef = db.collection("hourRequests").doc(requestId);
  const movementRef = db.collection("movements").doc(`request_${requestId}`);
  return db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) throw new HttpsError("not-found", "La solicitud ya no existe.");
    const requestData = requestSnapshot.data();

    if (requestData.status !== "pending") {
      if (requestData.status === decision) return { status: decision, alreadyProcessed: true };
      throw new HttpsError("failed-precondition", "Esta solicitud ya fue resuelta por otra persona.");
    }

    const durationMinutes = requestData.durationMinutes;
    const eventAt = requestData.eventAt;
    const now = Date.now();
    if (!allowedAgents.has(requestData.agentId)
      || !["favor", "recuperacion"].includes(requestData.requestType)
      || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440
      || !(eventAt instanceof Timestamp)
      || typeof requestData.reason !== "string" || requestData.reason.length < 8 || requestData.reason.length > 500
      || (requestData.requestType === "favor" && eventAt.toMillis() > now)
      || (requestData.requestType === "recuperacion" && eventAt.toMillis() > now + 180 * 24 * 60 * 60 * 1000)) {
      throw new HttpsError("failed-precondition", "La solicitud contiene datos que no se pueden procesar.");
    }

    if (decision === "approved") {
      const movementSnapshot = await transaction.get(movementRef);
      if (movementSnapshot.exists) {
        throw new HttpsError("already-exists", "El movimiento asociado ya existe; no se creó otro.");
      }
      const isFavor = requestData.requestType === "favor";
      transaction.create(movementRef, {
        agentId: requestData.agentId,
        type: isFavor ? "favor" : "deuda",
        signedMinutes: isFavor ? durationMinutes : -durationMinutes,
        durationMinutes,
        eventAt,
        note: requestData.reason,
        requestId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: reviewer.uid,
        createdByEmail: reviewer.token.email ?? "",
        decidedBy: reviewer.uid
      });
    }

    transaction.update(requestRef, {
      status: decision,
      decidedAt: FieldValue.serverTimestamp(),
      decidedBy: reviewer.uid,
      decidedByEmail: reviewer.token.email ?? "",
      decisionNote: decisionNote.trim()
    });
    return { status: decision, alreadyProcessed: false };
  });
});
