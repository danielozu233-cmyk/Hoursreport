import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, writeBatch, query, orderBy, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
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

const adminEmails = new Set(["jmjuarez@upana.edu.gt", "nozuna@upana.edu.gt", "ccoyoy@upana.edu.gt"]);
const app = initializeApp(firebaseConfig);
if (appCheckSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
const auth = getAuth(app);
const db = getFirestore(app);
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let movements = [];
let activeUser = null;
let selectedAgent = null;
let selectedMovement = null;
let toastTimeout;

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function openModal(id) {
  byId(id).classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  byId(id).classList.add("hidden");
  if (!document.querySelector(".modal:not(.hidden)")) document.body.style.overflow = "";
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
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

function localDateTimeValue(date) {
  return `${localDateString(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eventDateOf(movement) {
  if (movement.eventAt?.toDate) return movement.eventAt.toDate();
  if (typeof movement.eventDate === "string" && movement.eventDate.length === 10) return new Date(`${movement.eventDate}T00:00:00`);
  return movement.createdAt?.toDate ? movement.createdAt.toDate() : movement.createdAt ? new Date(movement.createdAt) : null;
}

function signedMinutesOf(movement) {
  if (Number.isInteger(movement.signedMinutes)) return movement.signedMinutes;
  return Math.round((Number(movement.signedHours) || 0) * 60);
}

function actorOf(movement) {
  return movement.createdByEmail || movement.createdBy || "Registro anterior a la auditoría";
}

function auditActionOf(movement) {
  if (/^ANULACIÓN/i.test(movement.note || "")) return "Anulación";
  if (/^CORRECCIÓN/i.test(movement.note || "")) return "Corrección";
  return "Registro";
}

function periodStart() {
  const now = new Date();
  const period = byId("periodFilter").value;
  if (period === "month") return localDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  if (period === "quarter") return localDateString(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  return null;
}

function agentTotals(agent, start = null) {
  const own = movements.filter((movement) => {
    if (movement.agentId !== agent.ext) return false;
    const eventAt = eventDateOf(movement);
    return eventAt && eventAt <= new Date() && (!start || localDateString(eventAt) >= start);
  });
  const positive = own.reduce((sum, movement) => sum + Math.max(0, signedMinutesOf(movement)), 0);
  const pending = own.reduce((sum, movement) => sum + Math.max(0, -signedMinutesOf(movement)), 0);
  return { own: movements.filter((movement) => movement.agentId === agent.ext), positive, pending, net: positive - pending };
}

function filteredAgents() {
  const search = byId("searchInput").value.trim().toLocaleLowerCase("es");
  const status = byId("statusFilter").value;
  const start = periodStart();
  return agents.filter((agent) => {
    const totals = agentTotals(agent, start);
    const matchesSearch = `${agent.name} ${agent.ext}`.toLocaleLowerCase("es").includes(search);
    const matchesStatus = status === "all" || (status === "positive" && totals.net > 0) || (status === "negative" && totals.net < 0) || (status === "zero" && totals.net === 0);
    return matchesSearch && matchesStatus;
  });
}

function renderAgents() {
  const visible = filteredAgents();
  byId("tableCount").textContent = `Mostrando ${visible.length} de ${agents.length} agentes`;
  byId("agentsTable").innerHTML = visible.length ? visible.map((agent) => {
    const totals = agentTotals(agent, periodStart());
    const initials = agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es");
    const balanceClass = totals.net > 0 ? "positive" : totals.net < 0 ? "negative" : "zero";
    const sign = totals.net > 0 ? "+" : totals.net < 0 ? "−" : "";
    return `<tr><td><div class="agent-cell"><div class="agent-avatar">${escapeHtml(initials)}</div><div class="agent-name"><strong>${escapeHtml(agent.name)}</strong><small>Agente UPANA</small></div></div></td><td class="extension">${agent.ext}</td><td class="hours-positive">${formatDuration(totals.positive)}</td><td class="hours-negative">${formatDuration(totals.pending)}</td><td><span class="balance-pill ${balanceClass}">${sign}${formatDuration(totals.net)}</span></td><td><button class="row-action" data-agent="${agent.ext}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(agent.name)}">↗</button></td></tr>`;
  }).join("") : '<tr><td colspan="6" class="empty-state">No hay agentes que coincidan con estos filtros.</td></tr>';
  byId("agentsTable").querySelectorAll("[data-agent]").forEach((button) => button.addEventListener("click", () => showAgentDetail(button.dataset.agent)));
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
  const history = totals.own.slice().sort((left, right) => (eventDateOf(right)?.getTime() || 0) - (eventDateOf(left)?.getTime() || 0));
  byId("historyList").innerHTML = history.length ? history.map((movement) => {
    const favorable = signedMinutesOf(movement) > 0;
    const eventDate = eventDateOf(movement);
    const canCorrect = eventDate && eventDate <= new Date() && Math.abs(signedMinutesOf(movement)) <= 1440;
    return `<div class="history-item"><div class="history-symbol ${favorable ? "favor" : "deuda"}">${favorable ? "↗" : "↙"}</div><div class="history-copy"><strong>${escapeHtml(movement.note || "Movimiento registrado")}</strong><span>${formatDate(eventDate)} · Registrado ${formatDate(movement.createdAt)} · ${escapeHtml(actorOf(movement))}</span></div><div class="history-amount ${favorable ? "favor" : "deuda"}">${favorable ? "+" : "−"}${formatDuration(signedMinutesOf(movement))}${canCorrect ? `<button class="text-action" data-correct="${escapeHtml(movement.id)}">Corregir / anular</button>` : ""}</div></div>`;
  }).join("") : '<div class="empty-state">Todavía no hay movimientos para este agente.</div>';
  byId("historyList").querySelectorAll("[data-correct]").forEach((button) => button.addEventListener("click", () => openCorrection(button.dataset.correct)));
  openModal("detailModal");
}

function renderAudit() {
  const search = byId("auditSearch").value.trim().toLocaleLowerCase("es");
  const actionFilter = byId("auditActionFilter").value;
  const agentFilter = byId("auditAgentFilter").value;
  const filtered = movements.filter((movement) => {
    const agent = agents.find((item) => item.ext === movement.agentId);
    const action = auditActionOf(movement);
    const haystack = `${agent?.name || ""} ${movement.agentId} ${movement.id} ${movement.note || ""} ${actorOf(movement)}`.toLocaleLowerCase("es");
    return (actionFilter === "all" || action === actionFilter)
      && (agentFilter === "all" || movement.agentId === agentFilter)
      && (!search || haystack.includes(search));
  });
  byId("auditCount").textContent = `${filtered.length} ${filtered.length === 1 ? "actividad" : "actividades"}`;
  byId("auditTable").innerHTML = filtered.length ? filtered.map((movement) => {
    const agent = agents.find((item) => item.ext === movement.agentId);
    const action = auditActionOf(movement);
    const favorable = signedMinutesOf(movement) > 0;
    const canCorrect = eventDateOf(movement) && eventDateOf(movement) <= new Date() && Math.abs(signedMinutesOf(movement)) <= 1440;
    const actionClass = action === "Corrección" ? "correccion" : action === "Anulación" ? "anulacion" : "registro";
    return `<tr><td>${formatDate(movement.createdAt)}</td><td><span class="audit-action ${actionClass}">${action}</span></td><td><div class="audit-agent"><strong>${escapeHtml(agent?.name || "Agente")}</strong><small>Ext. ${escapeHtml(movement.agentId || "—")}</small></div></td><td>${formatDate(eventDateOf(movement))}</td><td>${escapeHtml(actorOf(movement))}</td><td><span class="audit-detail ${favorable ? "favor" : "deuda"}">${favorable ? "+" : "−"}${formatDuration(signedMinutesOf(movement))}</span><small class="audit-note">#${escapeHtml(movement.id)}</small><small class="audit-note">${escapeHtml(movement.note || "Sin motivo")}</small></td><td>${canCorrect ? `<button class="text-action" data-correct="${escapeHtml(movement.id)}">Revisar</button>` : "—"}</td></tr>`;
  }).join("") : '<tr><td colspan="7" class="empty-state">No hay actividad con esos filtros.</td></tr>';
  byId("auditTable").querySelectorAll("[data-correct]").forEach((button) => button.addEventListener("click", () => openCorrection(button.dataset.correct)));
}

async function loadMovements() {
  try {
    const snapshot = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc")));
    movements = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderAgents();
    renderAudit();
    byId("lastUpdated").textContent = `Actualizado ${new Intl.DateTimeFormat("es-GT", { timeStyle: "short" }).format(new Date())}`;
  } catch (error) {
    console.error("No se pudo cargar el libro de movimientos", error);
    showToast("No se pudieron cargar los datos. Revisa el acceso a Firestore.");
    byId("agentsTable").innerHTML = '<tr><td colspan="6" class="empty-state">No fue posible cargar los datos. Verifica tu conexión y autorización.</td></tr>';
    byId("auditTable").innerHTML = '<tr><td colspan="7" class="empty-state">No fue posible cargar la auditoría.</td></tr>';
  }
}

function populateAgents() {
  byId("agentCountNav").textContent = agents.length;
  const options = agents.map((agent) => `<option value="${agent.ext}">${escapeHtml(agent.name)} · ${agent.ext}</option>`).join("");
  byId("movementAgent").innerHTML = '<option value="">Selecciona un agente</option>' + options;
  byId("auditAgentFilter").innerHTML = '<option value="all">Todos los agentes</option>' + options;
}

async function exportExcel() {
  const selected = new Set(filteredAgents().map((agent) => agent.ext));
  const start = periodStart();
  const matching = movements.filter((movement) => selected.has(movement.agentId) && (!start || localDateString(eventDateOf(movement) || new Date(0)) >= start));
  try {
    const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
    const workbook = XLSX.utils.book_new();
    const movementRows = [
      ["Extensión", "Agente", "Tipo", "Duración (minutos)", "Duración", "Fecha y hora del evento", "Motivo / acción", "Fecha de registro", "Registrado por"],
      ...matching.map((movement) => [movement.agentId, agents.find((agent) => agent.ext === movement.agentId)?.name || "Agente", signedMinutesOf(movement) > 0 ? "A favor" : "Pendiente de recuperar", Math.abs(signedMinutesOf(movement)), formatDuration(signedMinutesOf(movement)), formatDate(eventDateOf(movement)), movement.note || "", formatDate(movement.createdAt), actorOf(movement)])
    ];
    const movementSheet = XLSX.utils.aoa_to_sheet(movementRows);
    movementSheet["!cols"] = [{ wch: 12 }, { wch: 34 }, { wch: 22 }, { wch: 19 }, { wch: 18 }, { wch: 25 }, { wch: 44 }, { wch: 25 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(workbook, movementSheet, "Movimientos y auditoría");
    const balanceRows = [["Extensión", "Agente", "A favor (min)", "A favor", "Pendiente (min)", "Pendiente", "Neto (min)", "Balance neto"], ...filteredAgents().map((agent) => {
      const totals = agentTotals(agent, start);
      return [agent.ext, agent.name, totals.positive, formatDuration(totals.positive), totals.pending, formatDuration(totals.pending), totals.net, `${totals.net < 0 ? "−" : totals.net > 0 ? "+" : ""}${formatDuration(totals.net)}`];
    })];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(balanceRows), "Balance por agente");
    XLSX.writeFile(workbook, `upana-reporte-horas-${localDateString(new Date())}.xlsx`);
    showToast(`${matching.length} movimientos exportados a Excel.`);
  } catch (error) {
    console.error("No se pudo crear el archivo Excel", error);
    showToast("No se pudo crear el Excel. Revisa tu conexión e inténtalo de nuevo.");
  }
}

function setDefaultMovementDate() {
  const now = new Date();
  byId("movementDate").value = localDateTimeValue(now);
  byId("movementDate").max = localDateTimeValue(now);
}

function setLoginMessage(message) {
  byId("loginMessage").textContent = message;
}

function movementData({ agentId, type, durationMinutes, eventAt, note }) {
  return {
    agentId,
    type,
    signedMinutes: type === "favor" ? durationMinutes : -durationMinutes,
    durationMinutes,
    eventAt: Timestamp.fromDate(eventAt),
    note,
    createdAt: serverTimestamp(),
    createdBy: activeUser.uid,
    createdByEmail: activeUser.email || ""
  };
}

function openCorrection(movementId) {
  selectedMovement = movements.find((movement) => movement.id === movementId);
  if (!selectedMovement) return;
  const eventAt = eventDateOf(selectedMovement);
  if (!eventAt || eventAt > new Date() || Math.abs(signedMinutesOf(selectedMovement)) > 1440) {
    showToast("Ese registro no se puede ajustar desde el panel actual.");
    return;
  }
  const signed = signedMinutesOf(selectedMovement);
  const agent = agents.find((item) => item.ext === selectedMovement.agentId);
  byId("correctionOriginal").textContent = `${agent?.name || "Agente"} · ${formatDuration(signed)} · ${formatDate(eventAt)} · ${actorOf(selectedMovement)}`;
  byId("correctionDate").value = localDateTimeValue(eventAt);
  byId("correctionDate").max = localDateTimeValue(new Date());
  byId("correctionHours").value = Math.floor(Math.abs(signed) / 60);
  byId("correctionMinutes").value = Math.abs(signed) % 60;
  document.querySelector(`input[name="correctionType"][value="${signed > 0 ? "favor" : "deuda"}"]`).checked = true;
  byId("correctionNote").value = selectedMovement.note || "";
  byId("correctionReason").value = "";
  byId("correctionMessage").textContent = "";
  byId("replaceOriginal").checked = true;
  toggleReplacementFields();
  updateChoiceCards();
  openModal("correctionModal");
}

function toggleReplacementFields() {
  const replace = byId("replaceOriginal").checked;
  byId("replacementFields").classList.toggle("hidden", !replace);
  byId("correctionDate").required = replace;
  byId("correctionHours").required = replace;
  byId("correctionMinutes").required = replace;
  byId("correctionNote").required = replace;
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
  const eventAt = new Date(byId("movementDate").value);
  const note = byId("movementNote").value.trim();
  const type = new FormData(byId("movementForm")).get("movementType");
  if (!agent || Number.isNaN(eventAt.getTime()) || eventAt > new Date() || !Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || durationMinutes < 1 || durationMinutes > 1440 || (hours === 24 && minutes > 0) || !note) {
    byId("movementMessage").textContent = "Revisa agente, fecha y hora, duración y motivo.";
    return;
  }
  const button = byId("saveMovementButton");
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    await addDoc(collection(db, "movements"), movementData({ agentId: agent.ext, type, durationMinutes, eventAt, note }));
    closeModal("movementModal");
    selectedAgent = agent;
    await loadMovements();
    showToast("Movimiento registrado y añadido a auditoría.");
    if (!byId("detailModal").classList.contains("hidden")) showAgentDetail(agent.ext);
  } catch (error) {
    console.error("No se pudo guardar el movimiento", error);
    byId("movementMessage").textContent = error.code === "permission-denied" ? "Tu cuenta no tiene permiso para registrar movimientos." : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
  } finally {
    button.disabled = false;
    button.textContent = "Guardar movimiento";
  }
});

byId("replaceOriginal").addEventListener("change", toggleReplacementFields);
byId("correctionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedMovement || !activeUser) return;
  const replace = byId("replaceOriginal").checked;
  const reason = byId("correctionReason").value.trim();
  const replacementAt = new Date(byId("correctionDate").value);
  const replacementHours = Number(byId("correctionHours").value);
  const replacementMinutes = Number(byId("correctionMinutes").value);
  const replacementDuration = replacementHours * 60 + replacementMinutes;
  const replacementType = new FormData(byId("correctionForm")).get("correctionType");
  const originalSigned = signedMinutesOf(selectedMovement);
  if (reason.length < 3 || (replace && (!Number.isFinite(replacementAt.getTime()) || replacementAt > new Date() || !Number.isInteger(replacementHours) || replacementHours < 0 || replacementHours > 24 || !Number.isInteger(replacementMinutes) || replacementMinutes < 0 || replacementMinutes > 59 || replacementDuration < 1 || replacementDuration > 1440 || (replacementHours === 24 && replacementMinutes > 0) || byId("correctionNote").value.trim().length === 0))) {
    byId("correctionMessage").textContent = "Revisa el motivo y los datos del movimiento corregido.";
    return;
  }
  const button = byId("saveCorrectionButton");
  button.disabled = true;
  button.textContent = "Guardando…";
  try {
    const batch = writeBatch(db);
    const originalEventAt = eventDateOf(selectedMovement);
    const reversalType = originalSigned > 0 ? "deuda" : "favor";
    batch.set(doc(collection(db, "movements")), movementData({
      agentId: selectedMovement.agentId,
      type: reversalType,
      durationMinutes: Math.abs(originalSigned),
      eventAt: originalEventAt,
      note: `ANULACIÓN del registro ${selectedMovement.id}: ${reason}`
    }));
    if (replace) {
      batch.set(doc(collection(db, "movements")), movementData({
        agentId: selectedMovement.agentId,
        type: replacementType,
        durationMinutes: replacementDuration,
        eventAt: replacementAt,
        note: `CORRECCIÓN del registro ${selectedMovement.id}: ${byId("correctionNote").value.trim()}`
      }));
    }
    await batch.commit();
    closeModal("correctionModal");
    await loadMovements();
    if (selectedAgent) showAgentDetail(selectedAgent.ext);
    showToast(replace ? "Corrección guardada en auditoría." : "Registro anulado sin borrar el historial.");
  } catch (error) {
    console.error("No se pudo guardar la corrección", error);
    byId("correctionMessage").textContent = error.code === "permission-denied" ? "Firestore bloqueó la corrección. Revisa las reglas actuales." : "No se pudo guardar la corrección. Inténtalo de nuevo.";
  } finally {
    button.disabled = false;
    button.textContent = "Guardar en auditoría";
  }
});

function updateChoiceCards() {
  document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("selected", card.querySelector("input").checked));
}

document.querySelectorAll('input[name="movementType"], input[name="correctionType"]').forEach((radio) => radio.addEventListener("change", updateChoiceCards));
document.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => {
  const modalId = { detail: "detailModal", movement: "movementModal", correction: "correctionModal" }[element.dataset.close];
  if (modalId) closeModal(modalId);
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") ["detailModal", "movementModal", "correctionModal"].forEach(closeModal);
});
byId("searchInput").addEventListener("input", renderAgents);
byId("statusFilter").addEventListener("change", renderAgents);
byId("periodFilter").addEventListener("change", renderAgents);
byId("exportButton").addEventListener("click", exportExcel);
byId("auditSearch").addEventListener("input", renderAudit);
byId("auditActionFilter").addEventListener("change", renderAudit);
byId("auditAgentFilter").addEventListener("change", renderAudit);

populateAgents();
onAuthStateChanged(auth, async (user) => {
  activeUser = user;
  if (!user) {
    byId("appScreen").classList.add("hidden");
    byId("loginScreen").classList.remove("hidden");
    movements = [];
    renderAgents();
    renderAudit();
    return;
  }
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.add("hidden");
  if (!adminEmails.has((user.email || "").toLowerCase())) {
    await signOut(auth);
    byId("loginScreen").classList.remove("hidden");
    setLoginMessage("Este correo no está autorizado para el panel de supervisión.");
    return;
  }
  byId("appScreen").classList.remove("hidden");
  byId("userEmail").textContent = user.email || "Usuario";
  byId("userInitials").textContent = (user.email || "U").slice(0, 1).toLocaleUpperCase("es");
  byId("userRole").textContent = "Supervisión";
  await loadMovements();
});

setInterval(() => {
  if (!activeUser) return;
  renderAgents();
  renderAudit();
  if (!byId("detailModal").classList.contains("hidden") && selectedAgent) showAgentDetail(selectedAgent.ext);
}, 60000);
