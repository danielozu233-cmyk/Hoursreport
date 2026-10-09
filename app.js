import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

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
const auth = getAuth(app);
const db = getFirestore(app);
const byId = (id) => document.getElementById(id);
const moneyHours = (value) => `${Math.abs(value).toFixed(2)} h`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let movements = [];
let activeUser = null;
let selectedAgent = null;
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

function agentTotals(agent, start = null) {
  const own = movements.filter((movement) => {
    if (movement.agentId !== agent.ext) return false;
    if (!start) return true;
    const date = movement.createdAt?.toDate ? movement.createdAt.toDate() : movement.createdAt ? new Date(movement.createdAt) : null;
    return date && date >= start;
  });
  const positive = own.reduce((sum, movement) => sum + (movement.signedHours > 0 ? movement.signedHours : 0), 0);
  const pending = own.reduce((sum, movement) => sum + (movement.signedHours < 0 ? Math.abs(movement.signedHours) : 0), 0);
  return { own, positive, pending, net: positive - pending };
}

function periodStart() {
  const now = new Date();
  const period = byId("periodFilter").value;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
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
    const totals = agentTotals(agent);
    const initials = agent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es");
    const balanceClass = totals.net > 0 ? "positive" : totals.net < 0 ? "negative" : "zero";
    const sign = totals.net > 0 ? "+" : totals.net < 0 ? "−" : "";
    return `<tr><td><div class="agent-cell"><div class="agent-avatar">${escapeHtml(initials)}</div><div class="agent-name"><strong>${escapeHtml(agent.name)}</strong><small>Agente UPANA</small></div></div></td><td class="extension">${agent.ext}</td><td class="hours-positive">${moneyHours(totals.positive)}</td><td class="hours-negative">${moneyHours(totals.pending)}</td><td><span class="balance-pill ${balanceClass}">${sign}${moneyHours(totals.net)}</span></td><td><button class="row-action" data-agent="${agent.ext}" title="Ver historial" aria-label="Ver historial de ${escapeHtml(agent.name)}">↗</button></td></tr>`;
  }).join("");
  tbody.querySelectorAll("[data-agent]").forEach((button) => button.addEventListener("click", () => showAgentDetail(button.dataset.agent)));
}

function renderMetrics() {
  const start = periodStart();
  const periodMovements = start ? movements.filter((movement) => {
    const date = movement.createdAt?.toDate ? movement.createdAt.toDate() : movement.createdAt ? new Date(movement.createdAt) : null;
    return date && date >= start;
  }) : movements;
  const positive = periodMovements.reduce((sum, movement) => sum + Math.max(0, movement.signedHours), 0);
  const pending = periodMovements.reduce((sum, movement) => sum + Math.max(0, -movement.signedHours), 0);
  byId("metricAgents").textContent = agents.length;
  byId("metricPositive").innerHTML = `${positive.toFixed(2)} <small>h</small>`;
  byId("metricPending").innerHTML = `${pending.toFixed(2)} <small>h</small>`;
  byId("metricMovements").textContent = periodMovements.length;
  byId("lastUpdated").textContent = "Datos sincronizados";
  renderAgents();
}

function showAgentDetail(agentId) {
  selectedAgent = agents.find((agent) => agent.ext === agentId);
  if (!selectedAgent) return;
  const totals = agentTotals(selectedAgent);
  byId("detailName").textContent = selectedAgent.name;
  byId("detailExt").textContent = `Extensión ${selectedAgent.ext}`;
  byId("detailAvatar").textContent = selectedAgent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("es");
  byId("detailPositive").textContent = moneyHours(totals.positive);
  byId("detailPending").textContent = moneyHours(totals.pending);
  byId("detailNet").textContent = `${totals.net > 0 ? "+" : totals.net < 0 ? "−" : ""}${moneyHours(totals.net)}`;
  const history = totals.own.slice().sort((left, right) => {
    const leftDate = left.createdAt?.toDate ? left.createdAt.toDate().getTime() : new Date(left.createdAt || 0).getTime();
    const rightDate = right.createdAt?.toDate ? right.createdAt.toDate().getTime() : new Date(right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });
  byId("historyList").innerHTML = history.length ? history.map((movement) => {
    const favorable = movement.signedHours > 0;
    const amount = `${favorable ? "+" : "−"}${moneyHours(movement.signedHours)}`;
    return `<div class="history-item"><div class="history-symbol ${favorable ? "favor" : "deuda"}">${favorable ? "↗" : "↙"}</div><div class="history-copy"><strong>${escapeHtml(movement.note || "Movimiento registrado")}</strong><span>${formatDate(movement.createdAt)} · ${favorable ? "Horas a favor" : "Horas pendientes"}</span></div><div class="history-amount ${favorable ? "favor" : "deuda"}">${amount}</div></div>`;
  }).join("") : '<div class="empty-state">Todavía no hay movimientos para este agente.</div>';
  byId("detailAddButton").classList.remove("hidden");
  openModal("detailModal");
}

async function loadMovements() {
  try {
    const snapshot = await getDocs(query(collection(db, "movements"), orderBy("createdAt", "desc")));
    movements = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderMetrics();
  } catch (error) {
    console.error("No se pudo cargar el historial", error);
    showToast("No se pudieron cargar los movimientos. Revisa Firestore y sus reglas.");
    byId("agentsTable").innerHTML = '<tr><td colspan="6" class="empty-state">No fue posible cargar los datos. Verifica que Firestore esté creado y que tu usuario esté autorizado.</td></tr>';
  }
}

function updateRoleControls() {
  byId("addMovementTop").classList.remove("hidden");
  byId("detailAddButton").classList.remove("hidden");
  byId("userRole").textContent = "Supervisor/a";
}

function populateAgents() {
  byId("agentCountNav").textContent = agents.length;
  byId("movementAgent").innerHTML = '<option value="">Selecciona un agente</option>' + agents.map((agent) => `<option value="${agent.ext}">${escapeHtml(agent.name)} · ${agent.ext}</option>`).join("");
}

function exportCsv() {
  const selected = new Set(filteredAgents().map((agent) => agent.ext));
  const start = periodStart();
  const rows = movements.filter((movement) => selected.has(movement.agentId)).filter((movement) => {
    if (!start) return true;
    const date = movement.createdAt?.toDate ? movement.createdAt.toDate() : movement.createdAt ? new Date(movement.createdAt) : null;
    return date && date >= start;
  }).map((movement) => [
    movement.agentId,
    movement.agentName,
    movement.signedHours > 0 ? "A favor" : "Pendiente",
    Math.abs(movement.signedHours).toFixed(2),
    movement.note || "",
    formatDate(movement.createdAt),
    movement.createdByEmail || ""
  ]);
  const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [ ["Extension", "Agente", "Tipo", "Horas", "Motivo", "Fecha", "Registrado por"], ...rows ].map((row) => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `upana-movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`${rows.length} movimientos exportados.`);
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
  updateChoiceCards();
  openModal("movementModal");
});
byId("detailAddButton").addEventListener("click", () => {
  closeModal("detailModal");
  byId("movementForm").reset();
  byId("movementMessage").textContent = "";
  byId("movementAgent").value = selectedAgent?.ext || "";
  updateChoiceCards();
  openModal("movementModal");
});
byId("movementForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const agent = agents.find((item) => item.ext === byId("movementAgent").value);
  const hours = Number(byId("movementHours").value);
  const note = byId("movementNote").value.trim();
  const type = new FormData(byId("movementForm")).get("movementType");
  if (!agent || !Number.isFinite(hours) || hours < 0.01 || hours > 24 || !note) {
    byId("movementMessage").textContent = "Revisa el agente, las horas (0.01 a 24) y el motivo.";
    return;
  }
  const button = byId("saveMovementButton");
  button.disabled = true;
  button.textContent = "Guardando…";
  byId("movementMessage").textContent = "";
  try {
    await addDoc(collection(db, "movements"), {
      agentId: agent.ext,
      agentName: agent.name,
      type,
      signedHours: type === "favor" ? hours : -hours,
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
document.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => closeModal(element.dataset.close === "detail" ? "detailModal" : "movementModal")));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeModal("detailModal"); closeModal("movementModal"); } });
byId("searchInput").addEventListener("input", renderAgents);
byId("statusFilter").addEventListener("change", renderAgents);
byId("periodFilter").addEventListener("change", renderMetrics);
byId("exportButton").addEventListener("click", exportCsv);

populateAgents();
onAuthStateChanged(auth, async (user) => {
  activeUser = user;
  if (!user) {
    byId("appScreen").classList.add("hidden");
    byId("loginScreen").classList.remove("hidden");
    movements = [];
    renderMetrics();
    return;
  }
  byId("loginScreen").classList.add("hidden");
  byId("appScreen").classList.remove("hidden");
  byId("userEmail").textContent = user.email || "Usuario";
  byId("userInitials").textContent = (user.email || "U").slice(0, 1).toLocaleUpperCase("es");
  updateRoleControls();
  await loadMovements();
});
