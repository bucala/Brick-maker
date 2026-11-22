import {
  ACESFilmicToneMapping, AmbientLight, Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight,
  DoubleSide, HemisphereLight, Mesh, MeshPhysicalMaterial, PCFShadowMap, PerspectiveCamera,
  Plane, PlaneGeometry, PMREMGenerator, Scene, ShaderMaterial, ShadowMaterial, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PITCH } from './footprint.js';

export function createViewport(host, onCameraChange) {
  const scene = new Scene();
  scene.background = new Color();
  const camera = new PerspectiveCamera(34, 1, 0.1, 1800);
  camera.up.set(0, 0, 1);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-label', 'Interaktívny 3D náhľad dielca');
  host.append(renderer.domElement);

  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, 0.05).texture;
  scene.environmentIntensity = 0.68;
  room.dispose();
  pmrem.dispose();

  scene.add(new HemisphereLight('#ebf2ff', '#593924', 0.8), new AmbientLight('#ffffff', 0.32));
  const keyLight = new DirectionalLight('#fff2e6', 2.5);
  keyLight.position.set(-65, -65, 115);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.normalBias = 0.065;
  keyLight.shadow.bias = -0.00035;
  keyLight.shadow.radius = 2.5;
  const rim = new DirectionalLight('#d8e4ff', 0.85);
  rim.position.set(32, 35, 27);
  scene.add(keyLight, rim);

  const grid = new Mesh(new PlaneGeometry(640, 640), new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { gridTint: { value: new Vector3() }, opacity: { value: 0.33 }, pitch: { value: PITCH } },
    vertexShader: `
      varying vec3 world;
      void main() {
        world = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 gridTint;
      uniform float opacity;
      uniform float pitch;
      varying vec3 world;
      float lines(vec2 p) {
        vec2 width = max(fwidth(p), vec2(0.0001));
        vec2 line = abs(fract(p - 0.5) - 0.5) / width;
        return 1.0 - smoothstep(0.0, 1.1, min(line.x, line.y));
      }
      void main() {
        float fade = 1.0 - smoothstep(2.75, 20.0, distance(cameraPosition, world) / pitch);
        float grid = max(lines(world.xy / pitch), 0.55 * lines(world.xy / (pitch / 4.0)));
        gl_FragColor = vec4(gridTint, grid * fade * opacity * step(world.z, cameraPosition.z));
      }`,
  }));
  grid.position.z = -0.14;
  const floor = new Mesh(new PlaneGeometry(640, 640), new ShadowMaterial({ opacity: 0.23, depthWrite: false }));
  floor.position.z = -0.1;
  floor.receiveShadow = true;
  floor.renderOrder = 2;
  scene.add(grid, floor);

  const material = new MeshPhysicalMaterial({
    color: '#eb551c', roughness: 0.31, metalness: 0, clearcoat: 0.26, clearcoatRoughness: 0.3,
    side: DoubleSide,
  });
  const model = new Mesh(new BufferGeometry(), material);
  model.visible = false;
  model.castShadow = true;
  model.receiveShadow = true;
  scene.add(model);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.16;
  controls.zoomToCursor = true;
  controls.minDistance = 5;
  controls.maxDistance = 680;

  let needsRender = true;
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = scheme.matches;
    const background = getComputedStyle(host).getPropertyValue('--viewport').trim();
    scene.background.setStyle(background);
    const gridTint = dark ? [0.53, 0.46, 0.62] : [0.35, 0.49, 0.67];
    grid.material.uniforms.gridTint.value.set(...gridTint);
    grid.material.uniforms.opacity.value = dark ? 0.32 : 0.33;
    floor.material.opacity = dark ? 0.38 : 0.23;
    needsRender = true;
  }
  applyTheme();
  scheme.addEventListener('change', applyTheme);

  let box = new Box3(new Vector3(-16, -8, 0), new Vector3(16, 8, 12));
  let hasModel = false;
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  const defaultDirection = new Vector3(0.92, -1.45, 1.04).normalize();
  const formatSize = vector => Math.max(vector.x, vector.y, vector.z);

  function fit(view = 'iso') {
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const direction = {
      top: new Vector3(0, -0.0001, 1),
      bottom: new Vector3(0, -0.0001, -1),
      front: new Vector3(0, -1, 0.0001),
      side: new Vector3(1, 0, 0.0001),
    }[view] || defaultDirection;
    const distance = Math.max(32, size.length() * 2.10 / Math.min(camera.aspect, 1.2));
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    controls.update();
    needsRender = true;
  }

  controls.addEventListener('change', () => { needsRender = true; });
  const resize = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    const fitRatio = Math.min(camera.aspect, 1.2) / Math.min(width / height, 1.2);
    if (hasModel && Math.abs(1 - fitRatio) > 0.15) {
      camera.position.sub(controls.target).multiplyScalar(fitRatio).add(controls.target);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    needsRender = true;
  });
  resize.observe(host);
  fit();

  renderer.setAnimationLoop(() => {
    controls.update();
    if (!needsRender) return;
    renderer.render(scene, camera);
    needsRender = false;
    const orientation = camera.quaternion.clone().invert();
    onCameraChange(axes.map(axis => {
      const vector = axis.clone().applyQuaternion(orientation);
      return [vector.x, -vector.y];
    }));
  });

  return {
    fit,
    setModel({ positions, directions, indices, limits }, pitch = PITCH) {
      const previous = formatSize(box.getSize(new Vector3()));
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new BufferAttribute(directions, 3));
      geometry.setIndex(new BufferAttribute(indices, 1));
      model.geometry.dispose();
      model.geometry = geometry;
      box = new Box3(new Vector3(...limits[0]), new Vector3(...limits[1]));
      const size = box.getSize(new Vector3());
      grid.material.uniforms.pitch.value = pitch;
      controls.maxDistance = Math.max(680, size.length() * 4);
      const current = formatSize(size);
      const extent = Math.max(24, current * 0.87);
      Object.assign(keyLight.shadow.camera, { left: -extent, right: extent, bottom: -extent, top: extent, far: 450 });
      keyLight.shadow.camera.updateProjectionMatrix();
      model.visible = true;
      if (!hasModel || current > previous * 1.35 || current < previous * 0.63) fit();
      hasModel = true;
      needsRender = true;
    },
    clear() { model.visible = false; needsRender = true; },
    setSection(axis, amount) {
      const index = ['x', 'y', 'z'].indexOf(axis);
      const position = index === -1 ? 0 : box.min.getComponent(index)
        + (box.max.getComponent(index) - box.min.getComponent(index)) * amount;
      material.clippingPlanes = index === -1 ? [] : [new Plane(axes[index].clone().negate(), position)];
      material.needsUpdate = true;
      grid.visible = floor.visible = index === -1;
      needsRender = true;
    },
  };
}
