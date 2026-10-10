import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
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
const db = getFirestore(app);
const byId = (id) => document.getElementById(id);
const nowLocalInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

byId("requestAgent").innerHTML += agents.map((agent) => `<option value="${agent.ext}">${agent.name} · ${agent.ext}</option>`).join("");
byId("requestEventAt").value = nowLocalInput(new Date());

function updateRequestType() {
  const type = new FormData(byId("publicRequestForm")).get("requestType");
  const isFavor = type === "favor";
  const input = byId("requestEventAt");
  input.max = isFavor ? nowLocalInput(new Date()) : nowLocalInput(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
  byId("eventDateHint").textContent = isFavor
    ? "Para horas a favor, selecciona cuándo trabajaste el tiempo extra. La fecha no puede ser futura."
    : "Para recuperación, puedes indicar una fecha pasada o programada (hasta 6 meses). El saldo se ajusta al llegar esa fecha.";
  document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("selected", card.querySelector("input").checked));
}

document.querySelectorAll('input[name="requestType"]').forEach((input) => input.addEventListener("change", updateRequestType));
updateRequestType();

byId("publicRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const agent = agents.find((item) => item.ext === byId("requestAgent").value);
  const type = new FormData(byId("publicRequestForm")).get("requestType");
  const eventAtValue = byId("requestEventAt").value;
  const eventAtDate = new Date(eventAtValue);
  const hours = Number(byId("requestDurationHours").value);
  const minutes = Number(byId("requestDurationMinutes").value);
  const totalMinutes = hours * 60 + minutes;
  const reason = byId("requestReason").value.trim();
  const now = new Date();
  const maxFutureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const invalidDate = !Number.isFinite(eventAtDate.getTime()) || (type === "favor" && eventAtDate > now) || (type === "recuperacion" && eventAtDate > maxFutureDate);
  if (!agent || invalidDate || !Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || totalMinutes < 1 || totalMinutes > 1440 || (hours === 24 && minutes > 0) || reason.length < 8 || reason.length > 500) {
    byId("publicFormMessage").textContent = "Revisa agente, fecha, duración (mínimo 1 minuto y máximo 24 horas) y motivo.";
    return;
  }

  const button = byId("submitRequestButton");
  button.disabled = true;
  button.textContent = "Enviando…";
  byId("publicFormMessage").textContent = "";
  try {
    await addDoc(collection(db, "hourRequests"), {
      agentId: agent.ext,
      requestType: type,
      eventAt: Timestamp.fromDate(eventAtDate),
      durationMinutes: totalMinutes,
      reason,
      contactName: byId("contactName").value.trim(),
      contactEmail: byId("contactEmail").value.trim(),
      contactPhone: byId("contactPhone").value.trim(),
      status: "pending",
      submittedAt: serverTimestamp()
    });
    byId("publicRequestForm").classList.add("hidden");
    byId("requestSuccess").classList.remove("hidden");
  } catch (error) {
    console.error("No se pudo enviar la solicitud", error);
    byId("publicFormMessage").textContent = error.code === "permission-denied"
      ? "No se pudo aceptar la solicitud. Confirma que las reglas de Firestore estén publicadas."
      : "No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.";
    button.disabled = false;
    button.innerHTML = 'Enviar solicitud <span aria-hidden="true">→</span>';
  }
});

byId("anotherRequestButton").addEventListener("click", () => {
  byId("publicRequestForm").reset();
  byId("requestEventAt").value = nowLocalInput(new Date());
  byId("requestDurationHours").value = "0";
  byId("requestDurationMinutes").value = "30";
  byId("requestSuccess").classList.add("hidden");
  byId("publicRequestForm").classList.remove("hidden");
  byId("submitRequestButton").disabled = false;
  byId("submitRequestButton").innerHTML = 'Enviar solicitud <span aria-hidden="true">→</span>';
  updateRequestType();
});
