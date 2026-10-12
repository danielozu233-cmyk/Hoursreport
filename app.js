import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { firebaseConfig, appCheckSiteKey } from "./firebase-config.js";

const agents = [
  { name: "Evelin Saraí Churumía Gomez", ext: "8001" },
  { name: "Justa Gabriela Jaes Sánchez", ext: "8002" },
  { name: "Javier Sebastian Alvarez Ruano", ext: "8003" },
  { name: "Merlin Carolina Bajan Ibañez", ext: "8004" },
  { name: "Mónica Paola Ordoñez Morales", ext: "8005" },
  { name: "Joselyne Andrea Velásquez Padilla", ext: "8007" },
  { name: "Jackeline Stephanie Castillo Calderón", ext: "8008" },
  { name: "Mildred Gabriela Cordero Canté", ext: "8009" },
  { name: "Tania Izamar de León Quiñonez", ext: "8010" },
  { name: "Jorge Eduardo Hernández Lima", ext: "8011" },
  { name: "Jorge Mario Veliz Acajabón", ext: "8013" },
  { name: "Madelin Gabriela Ovando Franco", ext: "8014" },
  { name: "Andrea María Jiménez Orellana", ext: "8016" },
  { name: "Diego Rolando Chiché Pineda", ext: "8017" },
  { name: "Ashley Dinora Mishelle Alvarado López", ext: "8018" },
  { name: "Synndy Elizabeth Sanchez Salazar", ext: "8020" },
  { name: "Josabeth Mishell de León Flores", ext: "8021" },
  { name: "Angelica Abigaíl Gálvez Alvarez", ext: "8022" },
  { name: "Jose David López Morales", ext: "8023" },
  { name: "Evelyn Sarahí de León Lorenzana", ext: "8024" },
  { name: "Marilyn Alexandra Molina Ramírez", ext: "8025" },
  { name: "Bryan Christofer Hernandez Cruz", ext: "8026" },
  { name: "Jonatan Rafael Sánchez Tinti", ext: "8027" },
  { name: "Marta Julia Morales Solorzano", ext: "8028" },
  { name: "José Pablo Ibañez", ext: "8029" }
];

const app = initializeApp(firebaseConfig);
if (appCheckSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");
const reviewRequestCall = httpsCallable(functions, "reviewHourRequest");
const byId = (id) => document.getElementById(id);
const adminEmails = new Set(["jmjuarez@upana.edu.gt", "nozuna@upana.edu.gt", "ccoyoy@upana.edu.gt"]);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let movements = [];
let hourRequests = [];
let activeUser = null;
let activeRole = null;
let selectedAgent = null;
let selectedRequest = null;
let toastTimeout;

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function openModal(id) {
  byId(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  byId(id).classList.add("hidden");
  if (document.querySelectorAll(".modal:not(.hidden)").length === 0) document.body.style.overflow = "";
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Fecha pendiente";
}

function formatDuration(minutes) {
  const total = Math.abs(Math.trunc(minutes));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${remainder} min`;
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDateOf(movement) {
  if (movement.eventAt?.toDate) return movement.eventAt.toDate();
  if (typeof movement.eventDate === "string" && movement.eventDate.length === 10) return new Date(`${movement.eventDate}T00:00:00`);
  return movement.createdAt?.toDate ? movement.createdAt.toDate() : movement.createdAt ? new Date(movement.createdAt) : null;
}

function movementDateString(movement) {
  const date = eventDateOf(movement);
  return date && !Number.isNaN(date.getTime()) ? localDateString(date) : "";
}

function signedMinutesOf(movement) {
  if (Number.isInteger(movement.signedMinutes)) return movement.signedMinutes;
  return Math.round((Number(movement.signedHours) || 0) * 60);
}

function formatEventDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(new Date(year, month - 1, day, 12));
  }
  return formatDate(value);
}

function agentTotals(agent, start = null) {
  const own = movements.filter((movement) => {
    if (movement.agentId !== agent.ext) return false;
    const eventAt = eventDateOf(movement);
    if (!eventAt || eventAt > new Date()) return false;
    return !start || movementDateString(movement) >= start;
  });
  const positive = own.reduce((sum, movement) => sum + Math.max(0, signedMinutesOf(movement)), 0);
  const pending = own.reduce((sum, movement) => sum + Math.max(0, -signedMinutesOf(movement)), 0);
  const history = movements.filter((movement) => movement.agentId === agent.ext);
  return { own: history, positive, pending, net: positive - pending };
}

function periodStart() {
  const now = new Date();
  const period = byId("periodFilter").value;
  if (period === "month") return localDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  if (period === "quarter") return localDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  return null;
}

function filteredAgents() {
  const search = byId("searchInput").value.trim().toLocaleLowerCase("es");
  const status = byId("statusFilter").value;
  const start = periodStart();
  return agents.filter((agent) => {
    const matchesSearch = `${agent.name} ${agent.ext}`.toLocaleLowerCase("es").includes(search);
    const totals = agentTotals(agent, start);
    const matchesStatus = status === "all" || (status === "positive" && totals.net > 0) || (status === "negative" && totals.net < 0) || (status === "zero" && totals.net === 0);
    return matchesSearch && matchesStatus;
  });
}

function renderAgents() {
  const visibleAgents = filteredAgents();
  const tbody = byId("agentsTable");
  byId("tableCount").textContent = `Mostrando ${visibleAgents.length} de ${agents.length} agentes`;
  if (!visibleAgents.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay agentes que coincidan con estos filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = visibleAgents.map((agent) => {
    const totals = agentTotals(agent, periodStart());
    const initials = agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es");
    const balanceClass = totals.net > 0 ? "positive" : totals.net < 0 ? "negative" : "zero";
    const sign = totals.net > 0 ? "+" : totals.net < 0 ? "−" : "";
    return `<tr><td><div class="agent-cell"><div class="agent-avatar">${escapeHtml(initials)}</div><div class="agent-name"><strong>${escapeHtml(agent.name)}</strong><small>Agente UPANA</small></div></div></td><td class="extension">${agent.ext}</td><td class="hours-positive">${formatDuration(totals.positive)}</td><td class="hours-negative">${formatDuration(totals.pending)}</td><td><span class="balance-pill ${balanceClass}">${sign}${formatDuration(totals.net)}</span></td><td><button class="row-action" data-agent="${agent.ext}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(agent.name)}">↗</button></td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-agent]").forEach((button) => button.addEventListener("click", () => showAgentDetail(button.dataset.agent)));
}

function showAgentDetail(agentId) {
  selectedAgent = agents.find((agent) => agent.ext === agentId);
  if (!selectedAgent) return;
  const totals = agentTotals(selectedAgent);
  byId("detailName").textContent = selectedAgent.name;
  byId("detailExt").textContent = `Extensión ${selectedAgent.ext}`;
  byId("detailAvatar").textContent = selectedAgent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es");
  byId("detailPositive").textContent = formatDuration(totals.positive);
  byId("detailPending").textContent = formatDuration(totals.pending);
  byId("detailNet").textContent = `${totals.net > 0 ? "+" : totals.net < 0 ? "−" : ""}${formatDuration(totals.net)}`;
  const history = totals.own.slice().sort((left, right) => eventDateOf(right) - eventDateOf(left));
  byId("historyList").innerHTML = history.length ? history.map((movement) => {
    const favorable = signedMinutesOf(movement) > 0;
    const eventDate = eventDateOf(movement);
    const scheduled = eventDate && eventDate > new Date();
    const amount = `${favorable ? "+" : "−"}${formatDuration(signedMinutesOf(movement))}`;
    return `<div class="history-item"><div class="history-symbol ${favorable ? "favor" : "deuda"}">${favorable ? "↗" : "↙"}</div><div class="history-copy"><strong>${escapeHtml(movement.note || "Movimiento registrado")}</strong><span>${scheduled ? "Programado para" : "Ocurrió"} ${formatDate(eventDate)} · Registrado ${formatDate(movement.createdAt)} · ${favorable ? "Horas a favor" : "Horas pendientes"}</span></div><div class="history-amount ${favorable ? "favor" : "deuda"}">${amount}</div></div>`;
  }).join("") : '<div class="empty-state">Todavía no hay movimientos para este agente.</div>';
  byId("detailAddButton").classList.remove("hidden");
  openModal("detailModal");
}

async function loadMovements() {
  try {
    const snapshot = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc")));
    movements = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderAgents();
  } catch (error) {
    console.error("No se pudo cargar el historial", error);
    showToast("No se pudieron cargar los movimientos. Revisa Firestore y sus reglas.");
    byId("agentsTable").innerHTML = '<tr><td colspan="6" class="empty-state">No fue posible cargar los datos. Verifica que Firestore esté creado y que tu usuario esté autorizado.</td></tr>';
  }
}

async function loadRequests() {
  try {
    const snapshot = await getDocs(query(collection(db, "hourRequests"), orderBy("submittedAt", "desc")));
    hourRequests = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderRequests();
  } catch (error) {
    console.error("No se pudieron cargar las solicitudes", error);
    byId("requestsTable").innerHTML = '<tr><td colspan="6" class="empty-state">No se pudieron cargar las solicitudes. Revisa la autorización de supervisión y las reglas.</td></tr>';
  }
}

function renderRequests() {
  const filter = byId("requestStatusFilter").value;
  const filtered = hourRequests.filter((item) => filter === "all" || item.status === filter);
  const pending = hourRequests.filter((item) => item.status === "pending").length;
  byId("pendingRequestCount").textContent = pending;
  byId("requestsCount").textContent = `${filtered.length} solicitudes · ${pending} pendientes`;
  if (!filtered.length) {
    byId("requestsTable").innerHTML = `<tr><td colspan="6" class="empty-state">${filter === "pending" ? "No hay solicitudes pendientes." : "No hay solicitudes para mostrar."}</td></tr>`;
    return;
  }
  byId("requestsTable").innerHTML = filtered.map((item) => {
    const agent = agents.find((entry) => entry.ext === item.agentId);
    const typeLabel = item.requestType === "favor" ? "Horas a favor" : "Tiempo por recuperar";
    const statusLabel = item.status === "approved" ? "Aprobada" : item.status === "rejected" ? "Rechazada" : "Pendiente";
    return `<tr><td><div class="request-agent-cell"><strong>${escapeHtml(agent?.name || "Agente")}</strong><span>Ext. ${escapeHtml(item.agentId)}</span></div></td><td><span class="request-type-chip ${item.requestType}">${typeLabel}</span></td><td>${formatDate(item.eventAt)}</td><td>${formatDuration(item.durationMinutes)}</td><td><span class="request-status ${item.status}">${statusLabel}</span></td><td><button class="request-open-button" data-request="${escapeHtml(item.id)}">${item.status === "pending" ? "Revisar" : "Ver detalle"}</button></td></tr>`;
  }).join("");
  byId("requestsTable").querySelectorAll("[data-request]").forEach((button) => button.addEventListener("click", () => showRequestDetail(button.dataset.request)));
}

function showRequestDetail(requestId) {
  selectedRequest = hourRequests.find((item) => item.id === requestId);
  if (!selectedRequest) return;
  const agent = agents.find((entry) => entry.ext === selectedRequest.agentId);
  byId("requestDetailTitle").textContent = `Solicitud ${selectedRequest.status === "pending" ? "pendiente" : selectedRequest.status === "approved" ? "aprobada" : "rechazada"}`;
  byId("requestAgentName").textContent = `${agent?.name || "Agente"} · Ext. ${selectedRequest.agentId}`;
  byId("requestTypeLabel").textContent = selectedRequest.requestType === "favor" ? "Horas a favor · tiempo extra ya trabajado" : "Tiempo por recuperar · horas pendientes";
  byId("requestEventAt").textContent = formatDate(selectedRequest.eventAt);
  byId("requestDuration").textContent = formatDuration(selectedRequest.durationMinutes);
  byId("requestContact").textContent = [selectedRequest.contactName, selectedRequest.contactEmail, selectedRequest.contactPhone].filter(Boolean).join(" · ") || "Sin datos de contacto";
  byId("requestSubmittedAt").textContent = formatDate(selectedRequest.submittedAt);
  byId("requestDecidedBy").textContent = selectedRequest.decidedByEmail || selectedRequest.decidedBy || "—";
  byId("requestDecidedAt").textContent = selectedRequest.decidedAt ? `Decidida ${formatDate(selectedRequest.decidedAt)}` : "";
  byId("decisionMetadata").classList.toggle("hidden", !selectedRequest.decidedAt);
  byId("requestReason").textContent = selectedRequest.reason;
  byId("decisionNote").value = selectedRequest.decisionNote || "";
  byId("decisionNote").disabled = selectedRequest.status !== "pending";
  byId("reviewMessage").textContent = "";
  byId("requestDecisionActions").classList.toggle("hidden", selectedRequest.status !== "pending");
  openModal("requestDetailModal");
}

async function decideRequest(decision) {
  if (!selectedRequest || selectedRequest.status !== "pending") return;
  const buttons = [byId("approveRequestButton"), byId("rejectRequestButton")];
  buttons.forEach((button) => { button.disabled = true; });
  byId("reviewMessage").textContent = "Guardando decisión…";
  try {
    const result = await reviewRequestCall({
      requestId: selectedRequest.id,
      decision,
      decisionNote: byId("decisionNote").value.trim()
    });
    closeModal("requestDetailModal");
    await Promise.all([loadRequests(), ...(decision === "approved" ? [loadMovements()] : [])]);
    showToast(result.data.alreadyProcessed ? "Esta solicitud ya estaba procesada." : decision === "approved" ? "Solicitud aprobada y movimiento registrado." : "Solicitud rechazada.");
  } catch (error) {
    console.error("No se pudo resolver la solicitud", error);
    byId("reviewMessage").textContent = error.code === "functions/failed-precondition"
      ? "Otra persona ya resolvió esta solicitud. Actualiza la lista."
      : error.code === "functions/internal" || error.code === "functions/unavailable"
        ? "El servicio de aprobación en Firebase no responde. Debe actualizarse la función reviewHourRequest."
        : "No se pudo guardar la decisión. Revisa tu conexión y vuelve a intentar.";
    if (error.code === "functions/failed-precondition") {
      await loadRequests();
      const refreshed = hourRequests.find((item) => item.id === selectedRequest.id);
      if (refreshed && refreshed.status !== "pending") showRequestDetail(refreshed.id);
    }
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function updateRoleControls() {
  const isSupervisor = ["supervisor", "admin"].includes(activeRole);
  byId("addMovementTop").classList.toggle("hidden", !isSupervisor);
  byId("detailAddButton").classList.toggle("hidden", !isSupervisor);
  byId("userRole").textContent = activeRole === "admin" ? "Administración" : "Supervisor/a";
}

function populateAgents() {
  byId("agentCountNav").textContent = agents.length;
  byId("movementAgent").innerHTML = '<option value="">Selecciona un agente</option>' + agents.map((agent) => `<option value="${agent.ext}">${escapeHtml(agent.name)} · ${agent.ext}</option>`).join("");
}

async function exportExcel() {
  const selected = new Set(filteredAgents().map((agent) => agent.ext));
  const start = periodStart();
  const matchingMovements = movements.filter((movement) => selected.has(movement.agentId) && (!start || movementDateString(movement) >= start));
  try {
    const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
    const workbook = XLSX.utils.book_new();
    const movementRows = [
      ["Extensión", "Agente", "Tipo", "Duración (minutos)", "Duración", "Fecha y hora del evento", "Motivo", "Fecha de registro", "Registrado por", "Solicitud"],
      ...matchingMovements.map((movement) => [
        movement.agentId,
        agents.find((agent) => agent.ext === movement.agentId)?.name || "Agente",
        signedMinutesOf(movement) > 0 ? "A favor" : "Pendiente de recuperar",
        Math.abs(signedMinutesOf(movement)),
        formatDuration(signedMinutesOf(movement)),
        formatDate(eventDateOf(movement)),
        movement.note || "",
        formatDate(movement.createdAt),
        movement.createdByEmail || "",
        movement.requestId || "Movimiento manual"
      ])
    ];
    const movementsSheet = XLSX.utils.aoa_to_sheet(movementRows);
    movementsSheet["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 22 }, { wch: 19 }, { wch: 18 }, { wch: 25 }, { wch: 38 }, { wch: 25 }, { wch: 30 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, movementsSheet, "Movimientos");

    const balanceRows = [
      ["Extensión", "Agente", "A favor (min)", "A favor", "Pendiente (min)", "Pendiente", "Neto (min)", "Balance neto"],
      ...filteredAgents().map((agent) => {
        const totals = agentTotals(agent, start);
        return [agent.ext, agent.name, totals.positive, formatDuration(totals.positive), totals.pending, formatDuration(totals.pending), totals.net, `${totals.net < 0 ? "−" : totals.net > 0 ? "+" : ""}${formatDuration(totals.net)}`];
      })
    ];
    const balanceSheet = XLSX.utils.aoa_to_sheet(balanceRows);
    balanceSheet["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 17 }, { wch: 16 }, { wch: 19 }, { wch: 17 }, { wch: 14 }, { wch: 17 }];
    XLSX.utils.book_append_sheet(workbook, balanceSheet, "Balance por agente");
    XLSX.writeFile(workbook, `upana-reporte-horas-${localDateString(new Date())}.xlsx`);
    showToast(`${matchingMovements.length} movimientos exportados a Excel.`);
  } catch (error) {
    console.error("No se pudo crear el archivo Excel", error);
    showToast("No se pudo crear el Excel. Revisa tu conexión e inténtalo de nuevo.");
  }
}

function setDefaultMovementDate() {
  const now = new Date();
  byId("movementDate").value = `${localDateString(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  byId("movementDate").max = byId("movementDate").value;
}

function setLoginMessage(message) {
  byId("loginMessage").textContent = message;
}

byId("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginMessage("");
  try {
    await signInWithEmailAndPassword(auth, byId("loginEmail").value.trim(), byId("loginPassword").value);
  } catch (error) {
    setLoginMessage(error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" ? "Correo o contraseña incorrectos." : error.code === "auth/too-many-requests" ? "Demasiados intentos. Espera un momento y vuelve a intentar." : "No se pudo iniciar sesión. Verifica los datos y la configuración de Firebase.");
  }
});

byId("logoutButton").addEventListener("click", () => signOut(auth));
byId("addMovementTop").addEventListener("click", () => {
  byId("movementForm").reset();
  byId("movementMessage").textContent = "";
  byId("movementAgent").value = selectedAgent?.ext || "";
  setDefaultMovementDate();
  updateChoiceCards();
  openModal("movementModal");
});
byId("detailAddButton").addEventListener("click", () => {
  closeModal("detailModal");
  byId("movementForm").reset();
  byId("movementMessage").textContent = "";
  byId("movementAgent").value = selectedAgent?.ext || "";
  setDefaultMovementDate();
  updateChoiceCards();
  openModal("movementModal");
});
byId("movementForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const agent = agents.find((item) => item.ext === byId("movementAgent").value);
  const hours = Number(byId("movementHours").value);
  const minutes = Number(byId("movementMinutes").value);
  const durationMinutes = hours * 60 + minutes;
  const eventAtDate = new Date(byId("movementDate").value);
  const note = byId("movementNote").value.trim();
  const type = new FormData(byId("movementForm")).get("movementType");
  if (!agent || Number.isNaN(eventAtDate.getTime()) || eventAtDate > new Date() || !Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || durationMinutes < 1 || durationMinutes > 1440 || (hours === 24 && minutes > 0) || !note) {
    byId("movementMessage").textContent = "Revisa agente, fecha y hora (no futuras), duración y motivo.";
    return;
  }
  const button = byId("saveMovementButton");
  button.disabled = true;
  button.textContent = "Guardando…";
  byId("movementMessage").textContent = "";
  try {
    await addDoc(collection(db, "movements"), {
      agentId: agent.ext,
      type,
      signedMinutes: type === "favor" ? durationMinutes : -durationMinutes,
      durationMinutes,
      eventAt: Timestamp.fromDate(eventAtDate),
      note,
      createdAt: serverTimestamp(),
      createdBy: activeUser.uid,
      createdByEmail: activeUser.email || ""
    });
    closeModal("movementModal");
    selectedAgent = agent;
    await loadMovements();
    showToast("Movimiento registrado correctamente.");
    if (!byId("detailModal").classList.contains("hidden")) showAgentDetail(agent.ext);
  } catch (error) {
    console.error("No se pudo guardar el movimiento", error);
    byId("movementMessage").textContent = error.code === "permission-denied" ? "Tu cuenta no tiene permiso para registrar movimientos." : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
  } finally {
    button.disabled = false;
    button.textContent = "Guardar movimiento";
  }
});

function updateChoiceCards() {
  document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("selected", card.querySelector("input").checked));
}

document.querySelectorAll('input[name="movementType"]').forEach((radio) => radio.addEventListener("change", updateChoiceCards));
document.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => {
  const modalId = { detail: "detailModal", movement: "movementModal", requestDetail: "requestDetailModal" }[element.dataset.close];
  if (modalId) closeModal(modalId);
}));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeModal("detailModal"); closeModal("movementModal"); closeModal("requestDetailModal"); } });
byId("searchInput").addEventListener("input", renderAgents);
byId("statusFilter").addEventListener("change", renderAgents);
byId("periodFilter").addEventListener("change", renderAgents);
byId("exportButton").addEventListener("click", exportExcel);
byId("requestStatusFilter").addEventListener("change", renderRequests);
byId("approveRequestButton").addEventListener("click", () => decideRequest("approved"));
byId("rejectRequestButton").addEventListener("click", () => decideRequest("rejected"));

populateAgents();
onAuthStateChanged(auth, async (user) => {
  activeUser = user;
  if (!user) {
    byId("appScreen").classList.add("hidden");
    byId("loginScreen").classList.remove("hidden");
    movements = [];
    hourRequests = [];
    activeRole = null;
    renderAgents();
    return;
  }
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.add("hidden");
  try {
    const token = await user.getIdTokenResult();
    if (!adminEmails.has((user.email || "").toLowerCase())) {
      await signOut(auth);
      byId("loginScreen").classList.remove("hidden");
      setLoginMessage("Este correo no está autorizado para el panel de supervisión.");
      return;
    }
    activeRole = "admin";
  } catch (error) {
    console.error("No se pudo verificar el rol de supervisión", error);
    await signOut(auth);
    byId("loginScreen").classList.remove("hidden");
    setLoginMessage("No se pudo verificar tu autorización. Vuelve a iniciar sesión.");
    return;
  }
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");
  byId("userEmail").textContent = user.email || "Usuario";
  byId("userInitials").textContent = (user.email || "U").slice(0, 1).toLocaleUpperCase("es");
  updateRoleControls();
  await Promise.all([loadMovements(), loadRequests()]);
});

setInterval(() => {
  if (!activeRole) return;
  renderAgents();
  if (!byId("detailModal").classList.contains("hidden") && selectedAgent) showAgentDetail(selectedAgent.ext);
}, 60000);
