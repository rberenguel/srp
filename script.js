import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.138.3/build/three.module.js";

// --- CONFIG ---
const GRID_SIZE = 14;
const BOX_SIZE = 1;
const HALF_GRID = GRID_SIZE / 2;
const GAME_SPEED = 350; // Slower game speed

// --- DOM ELEMENTS ---
const scoreElement = document.getElementById("score");
const finalScoreElement = document.getElementById("final-score");
const gameOverPanel = document.getElementById("game-over");
const startMessagePanel = document.getElementById("start-message");
const restartButton = document.getElementById("restart-button");
const controlElements = document.querySelectorAll(".controls-text");

// --- SCENE SETUP ---
const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const gameContainer = new THREE.Group();
scene.add(gameContainer);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0x93a1a1, 0.8);
const directionalLight = new THREE.DirectionalLight(0xfdf6e3, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(ambientLight, directionalLight);

// --- MATERIALS & GEOMETRY ---
const snakeHeadMaterial = new THREE.MeshLambertMaterial({ color: 0x268bd2 }); // Blue
const snakeBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2aa198 }); // Cyan
const fruitMaterial = new THREE.MeshLambertMaterial({ color: 0x859900 }); // Green
const bombMaterial = new THREE.MeshLambertMaterial({ color: 0xdc322f }); // Red

const sphereGeometry = new THREE.SphereGeometry(BOX_SIZE / 2, 16, 16);
const shadowGeometry = new THREE.PlaneGeometry(BOX_SIZE * 0.9, BOX_SIZE * 0.9);

// --- PLAY SPACE VISUALS ---
const boxGeom = new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE);
const edges = new THREE.EdgesGeometry(boxGeom);
const cubeOutline = new THREE.LineSegments(
  edges,
  new THREE.LineBasicMaterial({
    color: 0x93a1a1,
    transparent: true,
    opacity: 0.5,
  }),
);
gameContainer.add(cubeOutline);

const baseGridColorHex = 0x586e75;
const gridMaterialProps = {
  opacity: 0.35,
  transparent: true,
  color: baseGridColorHex,
};

// We create the grids with a base material that we can modify later
const gridHelperNY = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperNY.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperNY.position.y = -HALF_GRID;
gameContainer.add(gridHelperNY);

const gridHelperPY = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperPY.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperPY.position.y = HALF_GRID;
gameContainer.add(gridHelperPY);

const gridHelperNZ = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperNZ.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperNZ.position.z = -HALF_GRID;
gridHelperNZ.rotation.x = Math.PI / 2;
gameContainer.add(gridHelperNZ);

const gridHelperPZ = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperPZ.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperPZ.position.z = HALF_GRID;
gridHelperPZ.rotation.x = Math.PI / 2;
gameContainer.add(gridHelperPZ);

const gridHelperNX = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperNX.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperNX.position.x = -HALF_GRID;
gridHelperNX.rotation.z = Math.PI / 2;
gameContainer.add(gridHelperNX);

const gridHelperPX = new THREE.GridHelper(
  GRID_SIZE,
  GRID_SIZE,
  baseGridColorHex,
  baseGridColorHex,
);
gridHelperPX.material = new THREE.LineBasicMaterial(gridMaterialProps);
gridHelperPX.position.x = HALF_GRID;
gridHelperPX.rotation.z = Math.PI / 2;
gameContainer.add(gridHelperPX);

const faces = [
  { name: "px", normal: new THREE.Vector3(1, 0, 0), grid: gridHelperPX },
  { name: "nx", normal: new THREE.Vector3(-1, 0, 0), grid: gridHelperNX },
  { name: "py", normal: new THREE.Vector3(0, 1, 0), grid: gridHelperPY },
  { name: "ny", normal: new THREE.Vector3(0, -1, 0), grid: gridHelperNY },
  { name: "pz", normal: new THREE.Vector3(0, 0, 1), grid: gridHelperPZ },
  { name: "nz", normal: new THREE.Vector3(0, 0, -1), grid: gridHelperNZ },
];
let visibleFaceNames = [];

// --- GAME STATE ---
let snake, direction, nextDirection, fruit, fruitPart, bombs, bombParts;
let upVector, nextUpVector;
let snakeHeadMesh, snakeTubeMeshes, snakeShadows, snakeTailMesh;
let score,
  gameOver,
  gamePaused,
  gameInterval,
  frameCount = 0;
let particleSystems = [];
let clock = new THREE.Clock();
let delta;

// --- COLORS FROM CSS ---
const style = getComputedStyle(document.documentElement);
const magentaColor = new THREE.Color(
  style.getPropertyValue("--magenta").trim(),
);
const yellowColor = new THREE.Color(style.getPropertyValue("--yellow").trim());
const greyColor = new THREE.Color(style.getPropertyValue("--base01").trim()); // Dull grey

function createExplosion(position, color) {
  const particleCount = 200;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4 + 2,
      (Math.random() - 0.5) * 4,
    );
    velocities.push(velocity);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: color,
    size: 0.08,
    transparent: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geometry, material);
  particles.position.copy(position);
  gameContainer.add(particles); // Add to gameContainer instead of scene

  particleSystems.push({
    mesh: particles,
    velocities: velocities,
    lifetime: 1.5,
  });
}

function createGamePart(pos, material, geometry) {
  const worldPos = gridToWorld(pos);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(worldPos);
  gameContainer.add(mesh);
  const shadows = createShadowsForPos(pos, material);
  return { mesh, shadows };
}

function createShadowsForPos(pos, material) {
  const worldPos = gridToWorld(pos);
  const shadows = {};
  const shadowMaterial = material.clone();
  shadowMaterial.transparent = true;
  shadowMaterial.opacity = 0.3;

  // Only create shadows for faces that have grids
  faces.forEach((face) => {
    const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    switch (face.name) {
      case "px":
        shadowMesh.position.set(HALF_GRID - 0.01, worldPos.y, worldPos.z);
        shadowMesh.rotation.y = -Math.PI / 2;
        break;
      case "nx":
        shadowMesh.position.set(-HALF_GRID + 0.01, worldPos.y, worldPos.z);
        shadowMesh.rotation.y = Math.PI / 2;
        break;
      case "py":
        shadowMesh.position.set(worldPos.x, HALF_GRID - 0.01, worldPos.z);
        shadowMesh.rotation.x = Math.PI / 2;
        break;
      case "ny":
        shadowMesh.position.set(worldPos.x, -HALF_GRID + 0.01, worldPos.z);
        shadowMesh.rotation.x = -Math.PI / 2;
        break;
      case "pz":
        shadowMesh.position.set(worldPos.x, worldPos.y, HALF_GRID - 0.01);
        shadowMesh.rotation.y = Math.PI;
        break;
      case "nz":
        shadowMesh.position.set(worldPos.x, worldPos.y, -HALF_GRID + 0.01);
        break;
      default:
        return; // Skip if face name is not recognized
    }
    gameContainer.add(shadowMesh);
    shadows[face.name] = shadowMesh;
  });

  return shadows;
}

function gridToWorld(pos) {
  return new THREE.Vector3(
    pos.x - Math.floor(GRID_SIZE / 2),
    pos.y - Math.floor(GRID_SIZE / 2),
    pos.z - Math.floor(GRID_SIZE / 2),
  );
}

function getRandomPosition() {
  return new THREE.Vector3(
    Math.floor(Math.random() * GRID_SIZE),
    Math.floor(Math.random() * GRID_SIZE),
    Math.floor(Math.random() * GRID_SIZE),
  );
}

function isPositionOccupied(pos, checkBombs = true, checkFruit = true) {
  if (snake.some((segment) => segment.equals(pos))) return true;
  if (checkBombs && bombs.some((bomb) => bomb.equals(pos))) return true;
  if (checkFruit && fruit && fruit.equals(pos)) return true;
  return false;
}

function removePart(part) {
  if (!part) return;
  gameContainer.remove(part.mesh);
  if (part.shadows) {
    Object.values(part.shadows).forEach((shadow) =>
      gameContainer.remove(shadow),
    );
  }
}

function spawnFruit() {
  do {
    fruit = getRandomPosition();
  } while (isPositionOccupied(fruit, true, false));
  removePart(fruitPart);
  fruitPart = createGamePart(fruit, fruitMaterial, sphereGeometry);
}

function spawnBomb() {
  let bombPos;
  const head = snake[0];
  const nextPos = head.clone().add(direction);
  do {
    bombPos = getRandomPosition();
  } while (isPositionOccupied(bombPos, true, true) || bombPos.equals(nextPos));
  bombs.push(bombPos);
  bombParts.push(createGamePart(bombPos, bombMaterial, sphereGeometry));
}

function updateSnakeMesh() {
  if (!snakeHeadMesh) return;
  const headPos = gridToWorld(snake[0]);
  snakeHeadMesh.position.copy(headPos);

  if (snakeTubeMeshes && snakeTubeMeshes.length > 0) {
    snakeTubeMeshes.forEach((mesh) => {
      gameContainer.remove(mesh);
      mesh.geometry.dispose();
    });
  }
  snakeTubeMeshes = [];

  if (snake.length > 1) {
    const tailPos = gridToWorld(snake[snake.length - 1]);
    snakeTailMesh.position.copy(tailPos);
    snakeTailMesh.visible = true;

    let currentPathPoints = [gridToWorld(snake[0])];
    for (let i = 0; i < snake.length - 1; i++) {
      const currentSegment = snake[i];
      const nextSegment = snake[i + 1];

      if (currentSegment.distanceTo(nextSegment) > 1.5) {
        if (currentPathPoints.length > 1) {
          const curve = new THREE.CatmullRomCurve3(currentPathPoints);
          const tubeGeometry = new THREE.TubeGeometry(
            curve,
            currentPathPoints.length * 4,
            BOX_SIZE / 2,
            8,
            false,
          );
          const tubeMesh = new THREE.Mesh(tubeGeometry, snakeBodyMaterial);
          gameContainer.add(tubeMesh);
          snakeTubeMeshes.push(tubeMesh);
        }
        currentPathPoints = [gridToWorld(nextSegment)];
      } else {
        currentPathPoints.push(gridToWorld(nextSegment));
      }
    }

    if (currentPathPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(currentPathPoints);
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        currentPathPoints.length * 4,
        BOX_SIZE / 2,
        8,
        false,
      );
      const tubeMesh = new THREE.Mesh(tubeGeometry, snakeBodyMaterial);
      gameContainer.add(tubeMesh);
      snakeTubeMeshes.push(tubeMesh);
    }
  } else {
    snakeTailMesh.visible = false;
  }
}

function updateSnakeShadows() {
  // Remove excess shadows if snake shrunk
  while (snakeShadows.length > snake.length) {
    const shadowGroup = snakeShadows.pop();
    Object.values(shadowGroup).forEach((shadow) =>
      gameContainer.remove(shadow),
    );
  }

  // Update existing shadows or create new ones if snake grew
  snake.forEach((segmentPos, index) => {
    if (index < snakeShadows.length) {
      // Update existing shadows
      const shadowGroup = snakeShadows[index];
      const worldPos = gridToWorld(segmentPos);
      faces.forEach((face) => {
        const shadowMesh = shadowGroup[face.name];
        if (shadowMesh) {
          switch (face.name) {
            case "px":
              shadowMesh.position.set(HALF_GRID - 0.01, worldPos.y, worldPos.z);
              break;
            case "nx":
              shadowMesh.position.set(
                -HALF_GRID + 0.01,
                worldPos.y,
                worldPos.z,
              );
              break;
            case "py":
              shadowMesh.position.set(worldPos.x, HALF_GRID - 0.01, worldPos.z);
              break;
            case "ny":
              shadowMesh.position.set(
                worldPos.x,
                -HALF_GRID + 0.01,
                worldPos.z,
              );
              break;
            case "pz":
              shadowMesh.position.set(worldPos.x, worldPos.y, HALF_GRID - 0.01);
              break;
            case "nz":
              shadowMesh.position.set(
                worldPos.x,
                worldPos.y,
                -HALF_GRID + 0.01,
              );
              break;
          }
        }
      });
    } else {
      // Create new shadows if snake grew
      snakeShadows.push(createShadowsForPos(segmentPos, snakeBodyMaterial));
    }
  });
}

function init() {
  snake = [
    new THREE.Vector3(
      Math.floor(GRID_SIZE / 2),
      Math.floor(GRID_SIZE / 2),
      Math.floor(GRID_SIZE / 2),
    ),
  ];
  direction = new THREE.Vector3(1, 0, 0);
  upVector = new THREE.Vector3(0, 1, 0);
  nextDirection = direction.clone();
  nextUpVector = upVector.clone();

  if (snakeHeadMesh) gameContainer.remove(snakeHeadMesh);
  if (snakeTubeMeshes) {
    snakeTubeMeshes.forEach((mesh) => {
      gameContainer.remove(mesh);
      mesh.geometry.dispose();
    });
  }
  if (snakeTailMesh) gameContainer.remove(snakeTailMesh);
  snakeShadows?.forEach((shadowGroup) =>
    Object.values(shadowGroup).forEach((s) => gameContainer.remove(s)),
  );
  bombParts?.forEach(removePart);
  removePart(fruitPart);

  bombs = [];
  bombParts = [];
  snakeShadows = [];
  fruit = null;
  fruitPart = null;

  // Clear existing particle systems
  particleSystems.forEach((system) => {
    gameContainer.remove(system.mesh);
    system.mesh.geometry.dispose();
    system.mesh.material.dispose();
  });
  particleSystems = [];

  score = 0;
  gameOver = false;
  gamePaused = true;
  frameCount = 0;

  scoreElement.textContent = score;
  gameOverPanel.style.display = "none";
  startMessagePanel.style.display = "flex";
  controlElements.forEach((el) => (el.style.display = "block"));

  snakeHeadMesh = new THREE.Mesh(sphereGeometry, snakeHeadMaterial);
  gameContainer.add(snakeHeadMesh);
  snakeTailMesh = new THREE.Mesh(sphereGeometry, snakeBodyMaterial);
  gameContainer.add(snakeTailMesh);

  updateSnakeMesh();
  updateSnakeShadows();
  spawnFruit();
}

function update() {
  if (gameOver || gamePaused) return;

  direction.copy(nextDirection);
  upVector.copy(nextUpVector);

  const head = snake[0].clone();
  head.add(direction);

  head.x = (head.x + GRID_SIZE) % GRID_SIZE;
  head.y = (head.y + GRID_SIZE) % GRID_SIZE;
  head.z = (head.z + GRID_SIZE) % GRID_SIZE;

  if (
    snake.slice(1).some((segment) => segment.equals(head)) ||
    bombs.some((bomb) => bomb.equals(head))
  ) {
    endGame();
    return;
  }
  snake.unshift(head);

  if (head.equals(fruit)) {
    score++;
    scoreElement.textContent = score;
    createExplosion(gridToWorld(fruit), fruitMaterial.color);
    spawnFruit();
    spawnBomb();
  } else {
    snake.pop();
  }
  updateSnakeMesh();
  updateSnakeShadows();
}

function endGame() {
  gameOver = true;
  clearInterval(gameInterval);
  finalScoreElement.textContent = score;
  gameOverPanel.style.display = "flex";
  startMessagePanel.style.display = "none";
}

function startGame() {
  if (gameInterval) clearInterval(gameInterval);
  init();
  gameInterval = setInterval(update, GAME_SPEED);
}

function handleTurn(turnDirection, event = null) {
  if (gameOver) return;

  if (gamePaused) {
    gamePaused = false;
    startMessagePanel.style.display = "none";
    controlElements.forEach((el) => (el.style.display = "none"));
  }

  const rightVector = direction.clone().cross(upVector);
  let potentialNextDir, potentialNextUp;

  switch (turnDirection) {
    case "up":
      potentialNextDir = upVector.clone();
      potentialNextUp = direction.clone().negate();
      break;
    case "down":
      potentialNextDir = upVector.clone().negate();
      potentialNextUp = direction.clone();
      break;
    case "left":
      potentialNextDir = rightVector.clone().negate();
      potentialNextUp = upVector.clone();
      break;
    case "right":
      potentialNextDir = rightVector.clone();
      potentialNextUp = upVector.clone();
      break;
  }

  if (potentialNextDir && direction.dot(potentialNextDir) === 0) {
    nextDirection.copy(potentialNextDir);
    nextUpVector.copy(potentialNextUp);
  }
}

window.addEventListener("keydown", (event) => {
  let turn;
  switch (event.key) {
    case "ArrowUp":
      turn = "up";
      break;
    case "ArrowDown":
      turn = "down";
      break;
    case "ArrowLeft":
      turn = "left";
      break;
    case "ArrowRight":
      turn = "right";
      break;
    default:
      return;
  }
  handleTurn(turn, event);
});

window.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    if (gameOver) return;

    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const headPosWorld = gridToWorld(snake[0]).applyQuaternion(
      gameContainer.quaternion,
    );

    let turnOptions = {};

    if (touchX < screenWidth / 2) {
      // Left (Magenta) side for up/down turns
      const upDirWorld = upVector
        .clone()
        .applyQuaternion(gameContainer.quaternion);
      const downDirWorld = upVector
        .clone()
        .negate()
        .applyQuaternion(gameContainer.quaternion);

      const upTurnPosProjected = headPosWorld
        .clone()
        .add(upDirWorld)
        .project(camera);
      const downTurnPosProjected = headPosWorld
        .clone()
        .add(downDirWorld)
        .project(camera);

      turnOptions = {
        upper: upTurnPosProjected.y > downTurnPosProjected.y ? "up" : "down",
        lower: upTurnPosProjected.y < downTurnPosProjected.y ? "up" : "down",
      };
    } else {
      // Right (Yellow) side for left/right turns
      const rightVector = direction.clone().cross(upVector);
      const rightDirWorld = rightVector
        .clone()
        .applyQuaternion(gameContainer.quaternion);
      const leftDirWorld = rightVector
        .clone()
        .negate()
        .applyQuaternion(gameContainer.quaternion);

      const rightTurnPosProjected = headPosWorld
        .clone()
        .add(rightDirWorld)
        .project(camera);
      const leftTurnPosProjected = headPosWorld
        .clone()
        .add(leftDirWorld)
        .project(camera);

      turnOptions = {
        upper:
          rightTurnPosProjected.y > leftTurnPosProjected.y ? "right" : "left",
        lower:
          rightTurnPosProjected.y < leftTurnPosProjected.y ? "right" : "left",
      };
    }

    const finalTurn =
      touchY < screenHeight / 2 ? turnOptions.upper : turnOptions.lower;
    handleTurn(finalTurn, event);
  },
  { passive: false },
);

window.addEventListener(
  "mousedown",
  (event) => {
    event.preventDefault();
    if (gameOver) return;

    const touchX = event.clientX;
    const touchY = event.clientY;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const headPosWorld = gridToWorld(snake[0]).applyQuaternion(
      gameContainer.quaternion,
    );

    let turnOptions = {};

    if (touchX < screenWidth / 2) {
      // Left (Magenta) side for up/down turns
      const upDirWorld = upVector
        .clone()
        .applyQuaternion(gameContainer.quaternion);
      const downDirWorld = upVector
        .clone()
        .negate()
        .applyQuaternion(gameContainer.quaternion);

      const upTurnPosProjected = headPosWorld
        .clone()
        .add(upDirWorld)
        .project(camera);
      const downTurnPosProjected = headPosWorld
        .clone()
        .add(downDirWorld)
        .project(camera);

      turnOptions = {
        upper: upTurnPosProjected.y > downTurnPosProjected.y ? "up" : "down",
        lower: upTurnPosProjected.y < downTurnPosProjected.y ? "up" : "down",
      };
    } else {
      // Right (Yellow) side for left/right turns
      const rightVector = direction.clone().cross(upVector);
      const rightDirWorld = rightVector
        .clone()
        .applyQuaternion(gameContainer.quaternion);
      const leftDirWorld = rightVector
        .clone()
        .negate()
        .applyQuaternion(gameContainer.quaternion);

      const rightTurnPosProjected = headPosWorld
        .clone()
        .add(rightDirWorld)
        .project(camera);
      const leftTurnPosProjected = headPosWorld
        .clone()
        .add(leftDirWorld)
        .project(camera);

      turnOptions = {
        upper:
          rightTurnPosProjected.y > leftTurnPosProjected.y ? "right" : "left",
        lower:
          rightTurnPosProjected.y < leftTurnPosProjected.y ? "right" : "left",
      };
    }

    const finalTurn =
      touchY < screenHeight / 2 ? turnOptions.upper : turnOptions.lower;
    handleTurn(finalTurn, event);
  },
  { passive: false },
);

scoreElement.addEventListener("click", () => {
  if (gameOver) return;

  gamePaused = !gamePaused;
  if (gamePaused) {
    startMessagePanel.style.display = "flex";
    controlElements.forEach((el) => (el.style.display = "block"));
  } else {
    startMessagePanel.style.display = "none";
    controlElements.forEach((el) => (el.style.display = "none"));
  }
});

function updateCameraForAspectRatio() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  const fovInRadians = THREE.MathUtils.degToRad(camera.fov);
  const size = GRID_SIZE * 1.3;

  const distanceForHeight = size / (2 * Math.tan(fovInRadians / 2));
  const distanceForWidth = size / (2 * Math.tan(fovInRadians / 2) * aspect);

  const distance = Math.max(distanceForHeight, distanceForWidth);

  camera.position.z = distance;
  camera.position.y = size * 0.4;
  camera.lookAt(0, 0, 0);

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", updateCameraForAspectRatio, false);

function animate() {
  requestAnimationFrame(animate);
  delta = clock.getDelta();

  if (!gameOver) {
    gameContainer.rotation.y += 0.0005;
    gameContainer.rotation.x += 0.0002;

    // Debounce expensive updates to visible faces, grid colors, and shadow visibility
    if (frameCount % 10 === 0) {
      const cameraVec = new THREE.Vector3()
        .subVectors(camera.position, gameContainer.position)
        .normalize();
      faces.forEach((face) => {
        const worldNormal = face.normal
          .clone()
          .applyQuaternion(gameContainer.quaternion);
        face.dot = worldNormal.dot(cameraVec);
      });
      faces.sort((a, b) => a.dot - b.dot);
      visibleFaceNames = faces.slice(0, 3).map((f) => f.name);

      // Update grid colors and visibility
      const worldUp = upVector
        .clone()
        .applyQuaternion(gameContainer.quaternion);
      const worldRight = new THREE.Vector3()
        .crossVectors(direction, upVector)
        .applyQuaternion(gameContainer.quaternion);
      const worldForward = direction
        .clone()
        .applyQuaternion(gameContainer.quaternion);

      for (const face of faces) {
        if (visibleFaceNames.includes(face.name)) {
          face.grid.visible = true;

          const worldNormal = face.normal
            .clone()
            .applyQuaternion(gameContainer.quaternion);
          // SWAPPED LOGIC: Magenta is for up/down turns (aligned with upVector), Yellow is for left/right (aligned with rightVector)
          const magentaFactor = Math.abs(worldNormal.dot(worldUp));
          const yellowFactor = Math.abs(worldNormal.dot(worldRight));
          const greyFactor = Math.abs(worldNormal.dot(worldForward));

          // If the face normal is most aligned with the forward/backward direction, make it a dull, transparent grey
          if (greyFactor > magentaFactor && greyFactor > yellowFactor) {
            face.grid.material.color.copy(greyColor);
            face.grid.material.opacity = 0.15; // More transparent
          } else {
            // Otherwise, blend between magenta and yellow for the control-relevant planes
            const totalFactor = magentaFactor + yellowFactor;
            const yellowRatio =
              totalFactor > 1e-6 ? yellowFactor / totalFactor : 0.5;

            const finalColor = magentaColor
              .clone()
              .lerp(yellowColor, yellowRatio);
            face.grid.material.color.copy(finalColor);
            face.grid.material.opacity = 0.35; // Restore normal opacity
          }
        } else {
          face.grid.visible = false;
        }
      }

      const allParts = [...bombParts];
      if (fruitPart) allParts.push(fruitPart);

      allParts.forEach((part) => {
        if (part && part.shadows) {
          for (const faceName in part.shadows) {
            part.shadows[faceName].visible =
              visibleFaceNames.includes(faceName);
          }
        }
      });
      snakeShadows.forEach((shadowGroup) => {
        for (const faceName in shadowGroup) {
          shadowGroup[faceName].visible = visibleFaceNames.includes(faceName);
        }
      });
    }
    frameCount++;

    for (let i = particleSystems.length - 1; i >= 0; i--) {
      const system = particleSystems[i];
      system.lifetime -= delta;

      if (system.lifetime <= 0) {
        gameContainer.remove(system.mesh);
        system.mesh.geometry.dispose();
        system.mesh.material.dispose();
        particleSystems.splice(i, 1);
        continue;
      }

      system.mesh.material.opacity = system.lifetime;
      const positions = system.mesh.geometry.attributes.position.array;
      for (let j = 0; j < system.velocities.length; j++) {
        system.velocities[j].y -= 5.0 * delta; // gravity
        positions[j * 3] += system.velocities[j].x * delta;
        positions[j * 3 + 1] += system.velocities[j].y * delta;
        positions[j * 3 + 2] += system.velocities[j].z * delta;
      }
      system.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  renderer.render(scene, camera);
}

updateCameraForAspectRatio();
startGame();
animate();
