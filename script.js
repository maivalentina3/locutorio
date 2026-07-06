// ============================================
// LOCUTORIO — prototipo funcional
// Una cabina, un recuerdo, una llamada que se corta sola.
// ============================================

const TOTAL_BOOTHS = 6;
const LIT_BOOTH_INDEX = 2; // cabina 3 (0-indexed), pre-cargada con el recuerdo de la autora
const FILLABLE_BOOTH_INDEX = 4; // cabina 5 (0-indexed), la única que se puede completar
// el resto de las cabinas queda en silencio — no todos los locutorios vuelven

// mapa de recuerdos por cabina — índice de cabina -> { meta, text }
// solo vive en esta sesión del navegador (sin backend, ver nota en informe técnico)
const boothMemories = {
  [LIT_BOOTH_INDEX]: {
    meta: "cabina 3 · Costa Azul · enero de los 2000",
    text: `Costa Azul, enero de los 2000. Una de las tantas temporadas en la casa de mis abuelos. Tengo cinco años y estoy de vacaciones con mi mamá, mi tía y primos.

Llamamos a mi papá, que se quedó en Quilmes. A más de 300 kilómetros.

En el placard de mi pieza vive un conejo, me atormentó todas las noches por unos meses. Es rosado y tiene ojos rojos.

Marcamos. Habla mamá, miro a mi alrededor en silencio, me entretengo hasta que me toca a mí. Me pasa el teléfono.

— Hola, pa. ¿Mataste al conejo rosado?
— Sí, hija. No te va a molestar más.
— ¿Estás seguro?
— Te lo prometo.

Volví una semana después y el conejo ya no estaba.`
  }
};

// ---------- estado de audio (Web Audio API, sin archivos externos) ----------
let audioCtx = null;
let ambientNodes = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq, duration, gainValue = 0.04, delay = 0) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.value = 0;
  osc.connect(gain).connect(ctx.destination);
  const start = ctx.currentTime + delay;
  osc.start(start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  osc.stop(start + duration + 0.05);
}

function playDialTone() {
  // dos tonos alternados, como un modem/discado viejo
  beep(620, 0.18, 0.035, 0);
  beep(480, 0.18, 0.035, 0.22);
  beep(620, 0.18, 0.035, 0.44);
  beep(480, 0.18, 0.035, 0.66);
}

function playPickup() {
  beep(220, 0.08, 0.05, 0);
}

function playHangup() {
  beep(180, 0.12, 0.05, 0);
  beep(120, 0.15, 0.04, 0.08);
}

function startAmbientHum() {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 58; // zumbido de tubo fluorescente
  gain.gain.value = 0.008;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  ambientNodes = { osc, gain };
}

function stopAmbientHum() {
  if (ambientNodes) {
    ambientNodes.gain.gain.linearRampToValueAtTime(0, getAudioCtx().currentTime + 0.3);
    ambientNodes.osc.stop(getAudioCtx().currentTime + 0.35);
    ambientNodes = null;
  }
}

function ariaLabelFor(i, hasMemory, isFillable) {
  if (hasMemory) return `Cabina ${i + 1}, llamada disponible`;
  if (isFillable) return `Cabina ${i + 1}, vacía, podés dejar tu recuerdo`;
  return `Cabina ${i + 1}, vacía, sin señal`;
}

// ---------- generar cabinas ----------
const boothRow = document.getElementById("boothRow");
const boothElements = [];

for (let i = 0; i < TOTAL_BOOTHS; i++) {
  const booth = document.createElement("div");
  const hasMemory = Boolean(boothMemories[i]);
  const isFillable = i === FILLABLE_BOOTH_INDEX;
  booth.className = "booth" + (hasMemory ? " lit" : "");
  booth.setAttribute("role", "listitem");
  booth.setAttribute("tabindex", "0");
  booth.setAttribute("aria-label", ariaLabelFor(i, hasMemory, isFillable));

  const glass = document.createElement("div");
  glass.className = "glass";
  booth.appendChild(glass);

  const device = document.createElement("div");
  device.className = "device";

  const slot = document.createElement("div");
  slot.className = "device-slot";
  device.appendChild(slot);

  const screen = document.createElement("div");
  screen.className = "device-screen";
  const screenText = document.createElement("span");
  screenText.textContent = "00:00";
  screen.appendChild(screenText);
  device.appendChild(screen);

  const keys = document.createElement("div");
  keys.className = "device-keys";
  for (let k = 0; k < 9; k++) {
    const key = document.createElement("div");
    key.className = "key";
    keys.appendChild(key);
  }
  device.appendChild(keys);
  booth.appendChild(device);

  const shelf = document.createElement("div");
  shelf.className = "shelf";
  booth.appendChild(shelf);

  const phone = document.createElement("div");
  phone.className = "phone";
  booth.appendChild(phone);

  const number = document.createElement("div");
  number.className = "number";
  number.textContent = String(i + 1).padStart(2, "0");
  booth.appendChild(number);

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "LIBRE";
  label.hidden = !hasMemory;
  booth.appendChild(label);

  const handleActivate = () => {
    if (boothMemories[i]) {
      startCall(i);
    } else if (isFillable) {
      openSubmitForm(i);
    } else {
      showToast("esta cabina quedó en silencio");
    }
  };

  booth.addEventListener("click", handleActivate);
  booth.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate();
    }
  });

  boothRow.appendChild(booth);
  boothElements.push({ booth, label });
}

function markBoothAsFilled(i) {
  const { booth, label } = boothElements[i];
  booth.classList.add("lit");
  label.hidden = false;
  booth.setAttribute("aria-label", ariaLabelFor(i, true, false));
}

// ---------- toast breve de estado ----------
const emptyToast = document.getElementById("emptyToast");
let toastTimeout = null;

function showToast(message) {
  emptyToast.textContent = message;
  emptyToast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    emptyToast.hidden = true;
  }, 2400);
}

// ---------- formulario para dejar un recuerdo ----------
const submitOverlay = document.getElementById("submitOverlay");
const submitMetaInput = document.getElementById("submitMeta");
const submitTextInput = document.getElementById("submitText");
const submitCancelBtn = document.getElementById("submitCancel");
const submitConfirmBtn = document.getElementById("submitConfirm");
let pendingBoothIndex = null;

function openSubmitForm(i) {
  pendingBoothIndex = i;
  submitMetaInput.value = "";
  submitTextInput.value = "";
  submitOverlay.hidden = false;
  submitMetaInput.focus();
}

function closeSubmitForm() {
  submitOverlay.hidden = true;
  pendingBoothIndex = null;
}

function confirmSubmit() {
  const text = submitTextInput.value.trim();
  if (!text) {
    submitTextInput.focus();
    return;
  }
  const metaRaw = submitMetaInput.value.trim();
  const meta = metaRaw
    ? `cabina ${pendingBoothIndex + 1} · ${metaRaw}`
    : `cabina ${pendingBoothIndex + 1} · recuerdo anónimo`;

  boothMemories[pendingBoothIndex] = { meta, text };
  markBoothAsFilled(pendingBoothIndex);

  const filledIndex = pendingBoothIndex;
  closeSubmitForm();
  showToast("recuerdo guardado en esta cabina");

  // escuchamos de inmediato cómo quedó
  setTimeout(() => startCall(filledIndex), 600);
}

submitCancelBtn.addEventListener("click", closeSubmitForm);
submitConfirmBtn.addEventListener("click", confirmSubmit);

// ---------- secuencia de llamada ----------
const callOverlay = document.getElementById("callOverlay");
const callStatus = document.getElementById("callStatus");
const callTimer = document.getElementById("callTimer");
const memoryMeta = document.getElementById("memoryMeta");
const memoryText = document.getElementById("memoryText");
const cursorBlink = document.getElementById("cursorBlink");
const hangUpBtn = document.getElementById("hangUpBtn");

let timerInterval = null;
let typeInterval = null;
let cutoffTimeout = null;
let elapsedSeconds = 0;

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startCall(boothIndex) {
  const memory = boothMemories[boothIndex];
  if (!memory) return;

  getAudioCtx(); // desbloquea el audio con el gesto del usuario
  if (getAudioCtx().state === "suspended") getAudioCtx().resume();

  playPickup();
  startAmbientHum();

  memoryMeta.textContent = memory.meta;
  memoryText.textContent = "";
  callTimer.textContent = "00:00";
  callStatus.textContent = "marcando";
  elapsedSeconds = 0;

  callOverlay.hidden = false;
  hangUpBtn.focus();

  playDialTone();

  setTimeout(() => {
    callStatus.textContent = "conectando";
  }, 1000);

  setTimeout(() => {
    callStatus.textContent = "en llamada";
    beginTyping(memory.text);
    beginTimer();
    const typingDurationMs = memory.text.length * 24;
    const readingBufferMs = 13000;
    const callDurationMs = Math.max(30000, typingDurationMs + readingBufferMs);
    cutoffTimeout = setTimeout(endCall, callDurationMs);
  }, 1900);
}

function beginTyping(fullText) {
  let index = 0;
  clearInterval(typeInterval);
  cursorBlink.style.display = "none";
  typeInterval = setInterval(() => {
    memoryText.textContent = fullText.slice(0, index);
    index++;
    if (index > fullText.length) {
      clearInterval(typeInterval);
      cursorBlink.style.display = "inline";
    }
  }, 24);
}

function beginTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    callTimer.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function endCall(cutShort = false) {
  clearInterval(timerInterval);
  clearInterval(typeInterval);
  clearTimeout(cutoffTimeout);
  stopAmbientHum();
  playHangup();

  callStatus.textContent = cutShort ? "llamada finalizada" : "se cortó la llamada";

  setTimeout(() => {
    callOverlay.hidden = true;
  }, cutShort ? 250 : 900);
}

hangUpBtn.addEventListener("click", () => endCall(true));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!callOverlay.hidden) endCall(true);
    if (!submitOverlay.hidden) closeSubmitForm();
  }
});
