
const $ = (id) => document.getElementById(id);

const player = $("player");
const runner = $("runner");
const carried = $("carried");
const entitiesEl = $("entities");
const gameScreen = $("gameScreen");

const scoreEl = $("score");
const bestEl = $("best");
const speedLabel = $("speedLabel");

const startScreen = $("startScreen");
const gameOverScreen = $("gameOverScreen");
const pauseLabel = $("pauseLabel");

const startBtn = $("startBtn");
const restartBtn = $("restartBtn");
const pauseBtn = $("pauseBtn");
const upBtn = $("upBtn");
const downBtn = $("downBtn");

const LANES = 3;
const POINTS_PER_TRASH = 10;
const MAX_CARRY = 5;

let lane = 1;
let score = 0;
let best = loadBest();
let trashCount = 0;

let running = false;
let paused = false;
let gameOver = false;

let speed = 250;
let elapsed = 0;
let spawnTimer = 0;
let lastTime = 0;
let animationId = 0;
let nextId = 0;

let entities = [];

bestEl.textContent = best;

function loadBest() {
  try {
    return Number(localStorage.getItem("ecoRunnerBest")) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem("ecoRunnerBest", String(best));
  } catch {
    // O jogo continua mesmo se o armazenamento estiver indisponível.
  }
}

function updateScore() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  carried.textContent = "🥫".repeat(trashCount);

  if (score > best) {
    best = score;
    bestEl.textContent = best;
    saveBest();
  }
}

function setLane(nextLane) {
  if (!running || paused || gameOver) return;

  lane = Math.max(0, Math.min(LANES - 1, nextLane));

  player.classList.remove("lane-0", "lane-1", "lane-2");
  player.classList.add(`lane-${lane}`);
}

function moveUp() {
  setLane(lane - 1);
}

function moveDown() {
  setLane(lane + 1);
}

function setWalking(walking) {
  player.classList.toggle("walking", walking);
  runner.textContent = walking ? "🚶‍➡️" : "🏃‍➡️";
}

function createEntity(type, entityLane, x = 105) {
  const el = document.createElement("div");

  const emoji = {
    can: "🥫",
    obstacle: "🛢️",
    bin: "🗑️"
  }[type];

  el.className = `entity ${type}`;
  el.textContent = emoji;

  const entity = {
    id: nextId++,
    type,
    lane: entityLane,
    x,
    el,
    collected: false,
    used: false
  };

  el.style.left = `${x}%`;
  el.style.top = `${entityLane * (100 / LANES)}%`;
  entitiesEl.appendChild(el);
  entities.push(entity);

  return entity;
}

function removeEntity(entity) {
  entity.el.remove();
  entities = entities.filter((item) => item.id !== entity.id);
}

function spawnEntity() {
  const availableLanes = [0, 1, 2];
  const chosenLane =
    availableLanes[Math.floor(Math.random() * availableLanes.length)];

  const roll = Math.random();

  if (roll < 0.54) {
    createEntity("can", chosenLane);
  } else if (roll < 0.82) {
    createEntity("obstacle", chosenLane);
  } else {
    createEntity("bin", chosenLane);
  }
}

function getPlayerX() {
  return 9 + (54 / gameScreen.clientWidth) * 100;
}

function handleCollision(entity) {
  if (entity.lane !== lane || entity.used) return;

  if (entity.type === "can") {
    if (trashCount < MAX_CARRY) {
      trashCount++;
      entity.used = true;
      updateScore();
      removeEntity(entity);
    } else {
      entity.el.classList.add("full");
    }
  }

  if (entity.type === "obstacle") {
    endGame();
  }

  if (entity.type === "bin") {
    entity.used = true;

    if (trashCount > 0) {
      score += trashCount * POINTS_PER_TRASH;
      trashCount = 0;
      updateScore();

      // Feedback visual sem interromper a partida.
      entity.el.textContent = "✨";
      setTimeout(() => {
        if (entity.el.isConnected && running) {
          entity.el.textContent = "🗑️";
        }
      }, 350);
    } else {
      entity.el.textContent = "🗑️";
      entity.used = false;
    }
  }
}

function updateEntities(deltaSeconds) {
  const roadWidth = gameScreen.clientWidth;
  const playerRight = 9 + (65 / roadWidth) * 100;
  const movement = speed * deltaSeconds;

  for (const entity of [...entities]) {
    entity.x -= (movement / roadWidth) * 100;
    entity.el.style.left = `${entity.x}%`;

    const overlapsPlayer =
      entity.x < playerRight &&
      entity.x + (45 / roadWidth) * 100 > 9;

    if (
      overlapsPlayer &&
      entity.lane === lane &&
      !entity.used
    ) {
      handleCollision(entity);
    }

    if (entity.x < -12) {
      removeEntity(entity);
    }

    if (gameOver) return;
  }
}

function updateDifficulty(deltaSeconds) {
  elapsed += deltaSeconds;

  // A velocidade sobe devagar e tem um limite para manter o equilíbrio.
  speed = Math.min(250 + elapsed * 3.1, 480);

  speedLabel.textContent =
    `Velocidade: ${(speed / 250).toFixed(1)}x`;
}

function gameLoop(timestamp) {
  if (!running || paused || gameOver) return;

  const deltaSeconds = Math.min(
    (timestamp - lastTime) / 1000 || 0,
    0.05
  );

  lastTime = timestamp;

  updateDifficulty(deltaSeconds);
  updateEntities(deltaSeconds);

  if (!running || gameOver || paused) return;

  spawnTimer += deltaSeconds;

  // Os objetos aparecem progressivamente mais próximos,
  // sem permitir intervalos excessivamente curtos.
  const spawnInterval = Math.max(0.82, 1.65 - elapsed * 0.008);

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEntity();
  }

  animationId = requestAnimationFrame(gameLoop);
}

function resetGame() {
  cancelAnimationFrame(animationId);

  entities.forEach((entity) => entity.el.remove());
  entities = [];

  lane = 1;
  score = 0;
  trashCount = 0;
  speed = 250;
  elapsed = 0;
  spawnTimer = 0;
  nextId = 0;

  running = false;
  paused = false;
  gameOver = false;

  player.classList.remove("lane-0", "lane-2", "walking");
  player.classList.add("lane-1");

  runner.textContent = "🏃‍➡️";
  carried.textContent = "";

  updateScore();

  speedLabel.textContent = "Velocidade: 1.0x";
  pauseBtn.textContent = "⏸";

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  pauseLabel.classList.add("hidden");
}

function startGame() {
  resetGame();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  running = true;
  lastTime = performance.now();

  // Um pequeno intervalo inicial para o jogador se preparar.
  createEntity("can", 1, 100);

  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  if (gameOver) return;

  gameOver = true;
  running = false;
  paused = false;

  cancelAnimationFrame(animationId);

  $("finalScore").textContent = score;
  gameOverScreen.classList.remove("hidden");
  pauseLabel.classList.add("hidden");
  pauseBtn.textContent = "⏸";

  updateScore();
}

function togglePause() {
  if (!running || gameOver) return;

  paused = !paused;
  pauseBtn.textContent = paused ? "▶" : "⏸";
  pauseLabel.classList.toggle("hidden", !paused);

  if (paused) {
    cancelAnimationFrame(animationId);
  } else {
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
  }
}

// Teclado
document.addEventListener("keydown", (event) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
    moveUp();
  }

  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
    moveDown();
  }

  if (event.key === " " || event.key.toLowerCase() === "p") {
    togglePause();
  }

  if (event.key === "Enter" && !running && !gameOver) {
    startGame();
  }
});

// Botões para celulares e computadores
upBtn.addEventListener("click", moveUp);
downBtn.addEventListener("click", moveDown);
pauseBtn.addEventListener("click", togglePause);
startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

// Andar ao pressionar e correr ao soltar.
document.addEventListener("keydown", (event) => {
  if (
    ["ArrowUp", "ArrowDown", "w", "s"].includes(event.key) &&
    running &&
    !paused
  ) {
    setWalking(true);
  }
});

document.addEventListener("keyup", (event) => {
  if (["ArrowUp", "ArrowDown", "w", "s"].includes(event.key)) {
    setWalking(false);
  }
});

window.addEventListener("blur", () => {
  if (running && !paused) {
    togglePause();
  }
});

// Evita manter um botão de pista pressionado em telas sensíveis ao toque.
for (const btn of [upBtn, downBtn]) {
  btn.addEventListener("pointerdown", () => setWalking(true));
  btn.addEventListener("pointerup", () => setWalking(false));
  btn.addEventListener("pointercancel", () => setWalking(false));
  btn.addEventListener("pointerleave", () => setWalking(false));
}
