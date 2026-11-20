// live.js - presenter tools: 5-second alarm sound, visual alarm, theme, simulate, reset, fullscreen, shortcuts.

const ALARM_SECONDS = 5;
let audioCtx = null;
let alarmNodes = [];
let alarmTimer = null;
let visualTimer = null;

function soundOn() {
  return localStorage.getItem("canary-sound") !== "off";
}

function audioReady() {
  return Boolean(audioCtx && audioCtx.state === "running");
}

// Browsers only allow sound after a user gesture, so the first click, tap or key press unlocks it.
function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.onstatechange = updateSoundButtons;
    }
    if (audioCtx.state !== "running") audioCtx.resume().catch(() => {});
  } catch (err) { /* no Web Audio support: stay silent */ }
}
document.addEventListener("pointerdown", unlockAudio);
document.addEventListener("keydown", unlockAudio);

function updateSoundButtons() {
  const text = !soundOn() ? "Sound off" : audioReady() ? "Sound on" : "Enable sound";
  document.querySelectorAll('[data-action="sound"]').forEach((b) => {
    (b.querySelector(".lbl") || b).textContent = text;
  });
}

function updateThemeButtons() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.querySelectorAll('[data-action="theme"]').forEach((b) => (b.textContent = dark ? "Light" : "Dark"));
}

// Alarm: one tone every 0.5 s for 5 seconds. High and critical alerts use a higher two-tone pattern.
function playAlarmSound(level) {
  stopAlarmSound();
  if (!soundOn() || !audioReady()) return;
  const high = ["high", "critical"].includes(String(level).toLowerCase());
  const start = audioCtx.currentTime;
  for (let t = 0; t < ALARM_SECONDS; t += 0.5) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = high ? (t % 1 === 0 ? 1046 : 880) : 740;
    gain.gain.setValueAtTime(0, start + t);
    gain.gain.linearRampToValueAtTime(0.16, start + t + 0.02);
    gain.gain.linearRampToValueAtTime(0, start + t + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start + t);
    osc.stop(start + t + 0.24);
    alarmNodes.push(osc);
  }
  alarmTimer = setTimeout(stopAlarmSound, ALARM_SECONDS * 1000);
}

function stopAlarmSound() {
  alarmNodes.forEach((node) => { try { node.stop(); } catch (err) { /* already finished */ } });
  alarmNodes = [];
  clearTimeout(alarmTimer);
}

// Called when someone else opens a canary file: sound plus a red edge glow, both for 5 seconds.
function startAlarm(level) {
  playAlarmSound(level);
  clearTimeout(visualTimer);
  document.body.classList.remove("alarm");
  void document.body.offsetWidth; // restart the CSS animation
  document.body.classList.add("alarm");
  visualTimer = setTimeout(() => document.body.classList.remove("alarm"), ALARM_SECONDS * 1000);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("canary-theme", next);
  updateThemeButtons();
}

async function simulateIntruder() {
  const res = await fetch("/api/demo/simulate", { method: "POST" });
  const data = await res.json();
  if (!res.ok) showToast("Error: " + data.error, 5, "medium");
}

async function resetDemo() {
  if (!confirm("Delete ALL tokens and alerts? This cannot be undone.")) return;
  await fetch("/api/demo/reset", { method: "POST" });
  location.reload();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}

const ACTIONS = {
  theme: toggleTheme,
  simulate: simulateIntruder,
  reset: resetDemo,
  fullscreen: toggleFullscreen,
  sound: () => {
    localStorage.setItem("canary-sound", soundOn() ? "off" : "on");
    if (soundOn()) unlockAudio();
    else stopAlarmSound();
    updateSoundButtons();
  },
};

// Buttons with data-action="..." (event delegation, works on every page)
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  unlockAudio();
  ACTIONS[button.dataset.action]?.();
});

// Keyboard shortcuts: S = simulate, F = fullscreen, M = sound. Ignored while typing in a form.
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  const action = { s: "simulate", f: "fullscreen", m: "sound" }[event.key.toLowerCase()];
  if (action) ACTIONS[action]();
});

updateSoundButtons();
updateThemeButtons();
