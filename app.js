import * as THREE from 'three';
import { OrbitControls } from 'orbit';

const ui = {
  starName: document.getElementById('starName'),
  starType: document.getElementById('starType'),
  systemAge: document.getElementById('systemAge'),
  planetCount: document.getElementById('planetCount'),
  planetCountLabel: document.getElementById('planetCountLabel'),
  habBias: document.getElementById('habBias'),
  habBiasLabel: document.getElementById('habBiasLabel'),
  generateSystem: document.getElementById('generateSystem'),
  planetList: document.getElementById('planetList'),
  planetTitle: document.getElementById('planetTitle'),
  planetSummary: document.getElementById('planetSummary'),
  atlasCanvas: document.getElementById('atlasCanvas'),
  atlasInfo: document.getElementById('atlasInfo'),
  reportOutput: document.getElementById('reportOutput'),
  latitudeSlider: document.getElementById('latitudeSlider'),
  latitudeReadout: document.getElementById('latitudeReadout'),
  planExpedition: document.getElementById('planExpedition'),
  expeditionRoute: document.getElementById('expeditionRoute'),
  advanceSeason: document.getElementById('advanceSeason'),
  seasonStatus: document.getElementById('seasonStatus')
};

const sceneContainer = document.getElementById('sceneContainer');
const seasonCycle = ['Vernal', 'Estival', 'Autumnal', 'Hibernal'];
let currentSeason = 0;
let systemState = null;
let selectedPlanet = null;
let visualObjects = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b17');
const camera = new THREE.PerspectiveCamera(55, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
camera.position.set(0, 30, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
sceneContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight('#fff6de', 0.5));
const keyLight = new THREE.PointLight('#ffd9a0', 2.2, 300);
scene.add(keyLight);

function createSystem() {
  const count = Number(ui.planetCount.value);
  const habBias = Number(ui.habBias.value) / 100;

  const planets = Array.from({ length: count }, (_, i) => {
    const orbitalRadius = 8 + i * 4.5 + Math.random() * 1.5;
    const tempIndex = Math.max(0, 1 - Math.abs(i - count * habBias) / count);
    const lifeScore = Number((tempIndex * (0.4 + Math.random() * 0.6)).toFixed(2));
    const supportsMulticellular = lifeScore > 0.52;
    return {
      id: i,
      name: `${ui.starName.value}-${String.fromCharCode(98 + i)}`,
      type: i < 2 ? 'Rocky' : (Math.random() > 0.7 ? 'Gas Giant' : 'Super-Earth'),
      orbitalRadius,
      dayLength: (14 + Math.random() * 40).toFixed(1),
      tempC: Math.round(-90 + tempIndex * 130),
      atmosphere: ['Thin N2/CO2', 'N2/O2', 'Dense H2/He', 'Moist N2/O2/Ar'][Math.floor(Math.random() * 4)],
      gravity: (0.5 + Math.random() * 1.8).toFixed(2),
      lifeScore,
      supportsMulticellular,
      waterCoverage: Math.round(10 + Math.random() * 80)
    };
  });

  if (!planets.some((p) => p.supportsMulticellular)) {
    planets[Math.floor(count / 2)].supportsMulticellular = true;
    planets[Math.floor(count / 2)].lifeScore = 0.68;
  }

  return {
    star: {
      name: ui.starName.value,
      type: ui.starType.value,
      age: Number(ui.systemAge.value)
    },
    planets
  };
}

function renderSystem3D(system) {
  visualObjects.forEach((obj) => scene.remove(obj));
  visualObjects = [];

  const star = new THREE.Mesh(
    new THREE.SphereGeometry(2.7, 24, 24),
    new THREE.MeshStandardMaterial({ color: '#ffd47e', emissive: '#ffaa00', emissiveIntensity: 1.0 })
  );
  scene.add(star);
  visualObjects.push(star);

  system.planets.forEach((planet, i) => {
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(planet.orbitalRadius - 0.03, planet.orbitalRadius + 0.03, 96),
      new THREE.MeshBasicMaterial({ color: '#30558f', side: THREE.DoubleSide })
    );
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);
    visualObjects.push(orbit);

    const color = planet.supportsMulticellular ? '#5cf39c' : ['#b88f6b', '#72a7ff', '#c0a8ff'][i % 3];
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8 + (i % 4) * 0.22, 24, 24),
      new THREE.MeshStandardMaterial({ color })
    );
    mesh.userData = { planetId: planet.id, baseRadius: planet.orbitalRadius, phase: Math.random() * Math.PI * 2 };
    scene.add(mesh);
    visualObjects.push(mesh);
  });
}

function updatePlanetList(system) {
  ui.planetList.innerHTML = '';
  system.planets.forEach((planet) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = `${planet.name} (${planet.type}) ${planet.supportsMulticellular ? '🧬' : ''}`;
    button.addEventListener('click', () => selectPlanet(planet));
    li.appendChild(button);
    ui.planetList.appendChild(li);
  });
}

function selectPlanet(planet) {
  selectedPlanet = planet;
  ui.planetTitle.textContent = `${planet.name} — ${planet.supportsMulticellular ? 'Multicellular-compatible candidate' : 'Survey target'}`;
  ui.planetSummary.innerHTML = '';

  const facts = [
    ['Estimated Surface Temp', `${planet.tempC} °C`],
    ['Atmosphere', planet.atmosphere],
    ['Gravity', `${planet.gravity} g`],
    ['Water Coverage', `${planet.waterCoverage}%`],
    ['Life Support Index', `${Math.round(planet.lifeScore * 100)} / 100`],
    ['Day Length', `${planet.dayLength} hours`]
  ];

  facts.forEach(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<strong>${label}</strong><br/>${value}`;
    ui.planetSummary.appendChild(card);
  });

  drawAtlas(planet);
  ui.reportOutput.textContent = buildReport('fauna', planet);
}

function drawAtlas(planet) {
  const canvas = ui.atlasCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#93d6ff');
  gradient.addColorStop(0.4, '#4ea5c4');
  gradient.addColorStop(1, '#20415c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 4) {
    const latitude = Math.abs((x / canvas.width) * 180 - 90);
    const noise = (Math.sin(x * 0.03) + Math.sin(x * 0.011 + 1.3)) * 0.5;
    const elevation = (planet.waterCoverage / 100) - 0.05 + noise * 0.25 - latitude / 180 * 0.2;
    ctx.fillStyle = elevation > 0.2 ? '#6da35e' : elevation > 0 ? '#9dc68a' : '#3a7ab4';
    ctx.fillRect(x, 0, 4, canvas.height);
  }

  for (let y = 0; y < canvas.height; y += 36) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function buildReport(type, planet) {
  const templates = {
    fauna: [
      `Field Team Delta reports gliding filter-feeders near oceanic upwelling zones on ${planet.name}.`,
      `Burrowing hexapods dominate temperate plains; social behavior suggests pack defense against aerial predators.`,
      `Bioluminescent reef colonies show synchronized night-cycle signaling.`
    ],
    flora: [
      `Silicate-stem forests anchor in mineral-rich floodplains and store water through dry seasonal intervals.`,
      `Low-latitude regions host broad mat-canopies with rapid spore dispersal during vernal storms.`,
      `Alpine zones exhibit compact, dark-pigmented fronds optimized for high UV.`
    ],
    biomes: [
      `Primary biomes: equatorial rainbelt, sub-tropical steppe, temperate oceanic woodland, polar lichen desert.`,
      `Transitional estuary belts connect major inland seas and support high species density.`,
      `Rift highlands create altitudinal micro-biomes over short travel distances.`
    ],
    climate: [
      `Climate zoning indicates wet equator, dual subtropical arid belts, and storm-active mid-latitudes.`,
      `Seasonal sea-ice pulses regulate nutrient turnover and coastal productivity.`,
      `Monsoonal circulation shifts by approximately 17° latitude between estival and hibernal periods.`
    ],
    geo: [
      `Notable features include the Tharsis-like shield arc, a 4200 km canyon trench, and fractured basaltic plateaus.`,
      `A chain of shallow inland seas marks an ancient impact basin with active hydrothermal vents.`,
      `Polar cap scarps reveal layered climate history potentially spanning 1.2 million years.`
    ]
  };

  return `=== ${type.toUpperCase()} REPORT :: ${planet.name} ===\n` + templates[type].join('\n');
}

document.querySelectorAll('[data-report]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!selectedPlanet) return;
    ui.reportOutput.textContent = buildReport(button.dataset.report, selectedPlanet);
  });
});

ui.latitudeSlider.addEventListener('input', () => {
  const latitude = Number(ui.latitudeSlider.value);
  ui.latitudeReadout.textContent = `Latitude ${latitude}° — ${Math.abs(latitude) < 18 ? 'Tropical humid band' : Math.abs(latitude) < 42 ? 'Temperate transition' : 'Cold/arid dominance'}`;
});

ui.planExpedition.addEventListener('click', () => {
  if (!selectedPlanet) return;
  ui.expeditionRoute.textContent = `Route: Orbital insertion → ${selectedPlanet.name} coastal shelf → equatorial forest transect → highland observatory ridge.`;
});

ui.advanceSeason.addEventListener('click', () => {
  currentSeason = (currentSeason + 1) % seasonCycle.length;
  ui.seasonStatus.textContent = `Current season: ${seasonCycle[currentSeason]}`;
});

ui.planetCount.addEventListener('input', () => {
  ui.planetCountLabel.textContent = ui.planetCount.value;
});
ui.habBias.addEventListener('input', () => {
  ui.habBiasLabel.textContent = `${ui.habBias.value}%`;
});

ui.atlasCanvas.addEventListener('mousemove', (event) => {
  if (!selectedPlanet) return;
  const rect = ui.atlasCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const lat = Math.round(90 - (y / rect.height) * 180);
  const lon = Math.round((x / rect.width) * 360 - 180);
  const biome = Math.abs(lat) < 20 ? 'Rainbelt/Monsoon' : Math.abs(lat) < 45 ? 'Mixed woodland-steppe' : 'Tundra/Cold desert';
  ui.atlasInfo.textContent = `Lat ${lat}°, Lon ${lon}° — probable biome: ${biome}`;
});

ui.generateSystem.addEventListener('click', () => {
  systemState = createSystem();
  renderSystem3D(systemState);
  updatePlanetList(systemState);
  const bestCandidate = systemState.planets.sort((a, b) => b.lifeScore - a.lifeScore)[0];
  selectPlanet(bestCandidate);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  scene.children.forEach((obj) => {
    if (obj.userData?.planetId !== undefined) {
      const { baseRadius, phase } = obj.userData;
      obj.position.x = Math.cos(t * 0.2 + phase) * baseRadius;
      obj.position.z = Math.sin(t * 0.2 + phase) * baseRadius;
      obj.rotation.y += 0.01;
    }
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
});

ui.generateSystem.click();
