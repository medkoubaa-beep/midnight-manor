const TILE = 48;
const mapLayout = [
  "###############",
  "#.........D...#",
  "#.#####.#####.#",
  "#.#...#.....#.#",
  "#.#.#.#.###.#.#",
  "#...#...#...#.#",
  "###.#####.#.#.#",
  "#...#.....#.#.#",
  "#.#.#.###.#..##",
  "#...#.....#.#.#",
  "###############",
];

const roomZones = [
  { name: "Foyer", x1: 1, y1: 1, x2: 4, y2: 3 },
  { name: "Library", x1: 5, y1: 1, x2: 9, y2: 3 },
  { name: "Dining Hall", x1: 10, y1: 1, x2: 13, y2: 4 },
  { name: "Gallery", x1: 1, y1: 4, x2: 6, y2: 7 },
  { name: "Cellar Entrance", x1: 7, y1: 4, x2: 13, y2: 9 },
];

const items = [
  { id: "study-key", label: "Study Key", x: 3, y: 9, kind: "key" },
  { id: "manor-key", label: "Manor Key", x: 12, y: 8, kind: "key" },
  { id: "clue-diary", label: "Bloodstained Diary", x: 7, y: 2, kind: "clue" },
  { id: "clue-portrait", label: "Shattered Portrait", x: 11, y: 3, kind: "clue" },
  { id: "clue-sigil", label: "Ritual Sigil", x: 2, y: 6, kind: "clue" },
  { id: "battery-pack", label: "Battery Pack", x: 8, y: 9, kind: "battery" },
];

const doors = [
  { id: "study-door", x: 11, y: 8, locked: true, requires: ["study-key"], label: "Study Door" },
  { id: "exit-door", x: 10, y: 1, locked: true, requires: ["manor-key"], clueCount: 3, label: "Front Gate" },
];

const state = {
  running: false,
  flashlight: true,
  battery: 100,
  sanity: 100,
  inventory: [],
  clues: 0,
  player: { x: 1, y: 1 },
  enemy: {
    x: 13,
    y: 9,
    patrol: [
      { x: 13, y: 9 },
      { x: 11, y: 9 },
      { x: 11, y: 5 },
      { x: 13, y: 5 },
    ],
    patrolIndex: 0,
  },
  moveCooldown: 0,
  enemyCooldown: 0,
  damageTick: 0,
  lastFrame: performance.now(),
  message: "",
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const appRoot = document.getElementById("appRoot");
const gameWrap = document.getElementById("gameWrap");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const endTitle = document.getElementById("endTitle");
const endText = document.getElementById("endText");
const announce = document.getElementById("announce");

const sanityValue = document.getElementById("sanityValue");
const batteryValue = document.getElementById("batteryValue");
const inventoryValue = document.getElementById("inventoryValue");
const objectiveValue = document.getElementById("objectiveValue");
const locationValue = document.getElementById("locationValue");

const audio = {
  context: null,
  enabled: false,
};

function inBounds(x, y) {
  return y >= 0 && y < mapLayout.length && x >= 0 && x < mapLayout[0].length;
}

function tileAt(x, y) {
  if (!inBounds(x, y)) return "#";
  const door = doors.find((d) => d.x === x && d.y === y && d.locked);
  if (door) return "D";
  return mapLayout[y][x];
}

function isWalkable(x, y) {
  const tile = tileAt(x, y);
  return tile !== "#" && tile !== "D";
}

function findDoorNearPlayer() {
  return doors.find((door) => Math.abs(door.x - state.player.x) + Math.abs(door.y - state.player.y) === 1);
}

function updateObjective() {
  const manorKey = state.inventory.includes("manor-key");
  if (state.clues < 3) {
    objectiveValue.textContent = `Find clues (${state.clues}/3) and survive the manor.`;
  } else if (!manorKey) {
    objectiveValue.textContent = "Find the Manor Key to unlock the front gate.";
  } else {
    objectiveValue.textContent = "Reach the Front Gate and interact to escape.";
  }
}

function updateHud() {
  sanityValue.textContent = Math.max(0, Math.round(state.sanity));
  batteryValue.textContent = Math.max(0, Math.round(state.battery));
  const labels = items
    .filter((item) => state.inventory.includes(item.id))
    .map((item) => item.label);
  inventoryValue.textContent = labels.length ? labels.join(", ") : "Empty";
  const room = roomZones.find(
    (zone) =>
      state.player.x >= zone.x1 &&
      state.player.x <= zone.x2 &&
      state.player.y >= zone.y1 &&
      state.player.y <= zone.y2
  );
  locationValue.textContent = room ? room.name : "Unknown Corridor";
  updateObjective();
}

function announceText(text) {
  state.message = text;
  announce.textContent = text;
}

function toggleFlashlight() {
  if (state.battery <= 0 && !state.flashlight) {
    announceText("The battery is empty.");
    return;
  }
  state.flashlight = !state.flashlight;
  announceText(state.flashlight ? "Flashlight on." : "Flashlight off.");
  playTone(state.flashlight ? 520 : 260, 0.04, "sawtooth");
}

function triggerHorrorEffect() {
  gameWrap.classList.remove("shake", "flicker");
  void gameWrap.offsetWidth;
  gameWrap.classList.add("shake", "flicker");
}

function playTone(freq, duration = 0.1, type = "sine", volume = 0.03) {
  if (!audio.enabled || !audio.context) return;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(audio.context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audio.context.currentTime + duration);
  oscillator.stop(audio.context.currentTime + duration);
}

function interact() {
  const nearbyDoor = findDoorNearPlayer();
  if (nearbyDoor) {
    if (!nearbyDoor.locked) {
      announceText(`${nearbyDoor.label} is open.`);
      return;
    }

    const hasNeededItems = nearbyDoor.requires.every((req) => state.inventory.includes(req));
    const cluesOk = typeof nearbyDoor.clueCount === "number" ? state.clues >= nearbyDoor.clueCount : true;

    if (hasNeededItems && cluesOk) {
      nearbyDoor.locked = false;
      announceText(`Unlocked ${nearbyDoor.label}.`);
      playTone(650, 0.12, "triangle", 0.04);
      if (nearbyDoor.id === "exit-door") {
        winGame();
      }
    } else {
      const missing = [];
      if (!hasNeededItems) missing.push("required key");
      if (!cluesOk) missing.push("3 clues");
      announceText(`${nearbyDoor.label} is locked: missing ${missing.join(" and ")}.`);
      playTone(180, 0.1, "square", 0.02);
    }
    return;
  }

  const item = items.find((it) => it.x === state.player.x && it.y === state.player.y);
  if (!item || state.inventory.includes(item.id)) {
    announceText("Nothing useful here.");
    return;
  }

  state.inventory.push(item.id);
  if (item.kind === "clue") {
    state.clues += 1;
    announceText(`Clue found: ${item.label}.`);
  } else if (item.kind === "battery") {
    state.battery = Math.min(100, state.battery + 45);
    announceText("Battery pack used. Flashlight power restored.");
  } else {
    announceText(`Picked up ${item.label}.`);
  }
  playTone(720, 0.09, "triangle", 0.05);
  updateHud();
}

function movePlayer(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!isWalkable(nx, ny)) {
    if (tileAt(nx, ny) === "D") {
      announceText("A locked door blocks your path.");
    }
    return;
  }
  state.player.x = nx;
  state.player.y = ny;

  const onItem = items.find((it) => it.x === nx && it.y === ny && !state.inventory.includes(it.id));
  if (onItem) announceText(`You spot: ${onItem.label}. Press Interact.`);

  updateHud();
}

function chaseStep(from, target) {
  const dx = Math.sign(target.x - from.x);
  const dy = Math.sign(target.y - from.y);

  const options = [
    { x: from.x + dx, y: from.y },
    { x: from.x, y: from.y + dy },
    { x: from.x + dx, y: from.y + dy },
  ].filter((step) => isWalkable(step.x, step.y));

  return options[0] || from;
}

function updateEnemy(delta) {
  state.enemyCooldown -= delta;
  state.damageTick -= delta;
  if (state.enemyCooldown > 0) return;
  state.enemyCooldown = 0.35;

  const distance = Math.abs(state.enemy.x - state.player.x) + Math.abs(state.enemy.y - state.player.y);
  if (distance <= 5) {
    const step = chaseStep(state.enemy, state.player);
    state.enemy.x = step.x;
    state.enemy.y = step.y;
  } else {
    const target = state.enemy.patrol[state.enemy.patrolIndex];
    const step = chaseStep(state.enemy, target);
    state.enemy.x = step.x;
    state.enemy.y = step.y;
    if (state.enemy.x === target.x && state.enemy.y === target.y) {
      state.enemy.patrolIndex = (state.enemy.patrolIndex + 1) % state.enemy.patrol.length;
    }
  }

  const newDistance = Math.abs(state.enemy.x - state.player.x) + Math.abs(state.enemy.y - state.player.y);
  if (newDistance <= 1 && state.damageTick <= 0) {
    state.sanity -= 12;
    state.damageTick = 1;
    announceText("The Warden is close. Your sanity drops!");
    triggerHorrorEffect();
    playTone(120, 0.12, "sawtooth", 0.05);
  }

  if (state.enemy.x === state.player.x && state.enemy.y === state.player.y) {
    loseGame("The Warden caught you in the dark.");
  }
}

function updateResources(delta) {
  if (state.flashlight && state.battery > 0) {
    state.battery -= 6 * delta;
    if (state.battery <= 0) {
      state.battery = 0;
      state.flashlight = false;
      announceText("Your flashlight battery died.");
      playTone(170, 0.1, "square", 0.03);
    }
  }

  if (!state.flashlight) {
    state.sanity -= 1.6 * delta;
  }

  if (state.sanity <= 0) {
    loseGame("You lost yourself to the manor's whispers.");
  }
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < mapLayout.length; y++) {
    for (let x = 0; x < mapLayout[y].length; x++) {
      const tile = tileAt(x, y);
      if (tile === "#") drawTile(x, y, "#0f1220");
      else if (tile === "D") drawTile(x, y, "#4b2a2a");
      else drawTile(x, y, "#161e31");

      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  items
    .filter((item) => !state.inventory.includes(item.id))
    .forEach((item) => {
      ctx.fillStyle = item.kind === "clue" ? "#a5d1ff" : item.kind === "battery" ? "#f2e38a" : "#c7b0ff";
      ctx.beginPath();
      ctx.arc(item.x * TILE + TILE / 2, item.y * TILE + TILE / 2, TILE * 0.18, 0, Math.PI * 2);
      ctx.fill();
    });

  ctx.fillStyle = "#de4c5f";
  ctx.beginPath();
  ctx.arc(state.enemy.x * TILE + TILE / 2, state.enemy.y * TILE + TILE / 2, TILE * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#90c1ff";
  ctx.beginPath();
  ctx.arc(state.player.x * TILE + TILE / 2, state.player.y * TILE + TILE / 2, TILE * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lightRadius = state.flashlight ? TILE * 2.4 : TILE * 0.9;
  const gradient = ctx.createRadialGradient(
    state.player.x * TILE + TILE / 2,
    state.player.y * TILE + TILE / 2,
    TILE * 0.2,
    state.player.x * TILE + TILE / 2,
    state.player.y * TILE + TILE / 2,
    lightRadius
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.96)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(state.player.x * TILE + TILE / 2, state.player.y * TILE + TILE / 2, lightRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  if (state.message) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(8, canvas.height - 38, canvas.width - 16, 30);
    ctx.fillStyle = "#e8edf6";
    ctx.font = "16px sans-serif";
    ctx.fillText(state.message, 18, canvas.height - 17);
  }
}

function resetGame() {
  state.running = true;
  state.flashlight = true;
  state.battery = 100;
  state.sanity = 100;
  state.inventory = [];
  state.clues = 0;
  state.player = { x: 1, y: 1 };
  state.enemy = {
    x: 13,
    y: 9,
    patrol: [
      { x: 13, y: 9 },
      { x: 11, y: 9 },
      { x: 11, y: 5 },
      { x: 13, y: 5 },
    ],
    patrolIndex: 0,
  };
  doors.forEach((door) => {
    door.locked = true;
  });
  state.moveCooldown = 0;
  state.enemyCooldown = 0;
  state.damageTick = 0;
  state.message = "The manor groans around you.";
  endScreen.classList.remove("visible");
  startScreen.classList.remove("visible");
  updateHud();
  drawGame();
}

function loseGame(reason) {
  if (!state.running) return;
  state.running = false;
  endTitle.textContent = "You Were Claimed";
  endText.textContent = `${reason} Restart and try a safer route.`;
  endScreen.classList.add("visible");
  announceText(reason);
}

function winGame() {
  if (!state.running) return;
  state.running = false;
  endTitle.textContent = "You Escaped";
  endText.textContent = "The gate opens and dawn breaks over Midnight Manor.";
  endScreen.classList.add("visible");
  announceText("You escaped Midnight Manor.");
  playTone(880, 0.2, "triangle", 0.06);
}

function gameLoop(now) {
  const delta = Math.min(0.05, (now - state.lastFrame) / 1000);
  state.lastFrame = now;

  if (state.running) {
    state.moveCooldown -= delta;
    updateEnemy(delta);
    updateResources(delta);
    updateHud();
  }

  drawGame();
  requestAnimationFrame(gameLoop);
}

const keyToMove = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

document.addEventListener("keydown", (event) => {
  if (!state.running) return;
  const key = event.key.toLowerCase();
  if (key === "f") {
    toggleFlashlight();
    return;
  }
  if (key === "e") {
    interact();
    return;
  }
  const move = keyToMove[event.key] || keyToMove[key];
  if (move && state.moveCooldown <= 0) {
    movePlayer(move[0], move[1]);
    state.moveCooldown = 0.12;
  }
});

function setupAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audio.context = new Ctx();
  audio.enabled = true;
}

document.getElementById("startBtn").addEventListener("click", () => {
  setupAudio();
  resetGame();
});

document.getElementById("restartBtn").addEventListener("click", () => {
  resetGame();
});

document.getElementById("interactBtn").addEventListener("click", () => {
  if (state.running) interact();
});

document.getElementById("lightBtn").addEventListener("click", () => {
  if (state.running) toggleFlashlight();
});

document.querySelectorAll(".dpad button").forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.running) return;
    const moveMap = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const move = moveMap[button.dataset.move];
    if (move) movePlayer(move[0], move[1]);
  });
});

updateHud();
drawGame();
requestAnimationFrame((time) => {
  state.lastFrame = time;
  gameLoop(time);
});
