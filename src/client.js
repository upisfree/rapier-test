import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { OrbitControls } from '../lib/OrbitControls.js';
import Physics from './physics.js';

const Key = {
  W: 'KeyW',
  A: 'KeyA',
  S: 'KeyS',
  D: 'KeyD',
  F: 'KeyF',
  SPACE: 'Space'
};

class Keyboard {
  keys = [];

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  onKeyDown(event) {
    const key = event.code;

    if (this.keys.includes(key) === false) {
      this.keys.push(key);
    }
  }

  onKeyUp(event) {
    const key = event.code;

    const keyIndex = this.keys.indexOf(key);

    if (keyIndex > -1) {
      this.keys.splice(keyIndex, 1);
    }
  }
}

const keyboard = new Keyboard();

const levelUrl = './assets/book.glb';

class Client {
  serverMeshes = new Map();
  gltfLoader = new GLTFLoader();

  constructor(container) {
    this.container = container;

    this.physics = new Physics();
    this.physics.load().then(() => {
      this.initNet();
      this.init3D();
    });

    console.log(this);
  }

  initNet() {
    this.ws = new WebSocket('ws://localhost:23456');

    this.ws.onopen = this.onServerOpened.bind(this);
    this.ws.onmessage = this.onServerMessage.bind(this);

    this.ws.onclose = (reason) => { console.log('websocket closed', reason) };
    this.ws.onerror = (error) => { console.log('websocket error', error) };
  }

  onServerOpened() {
    console.log('connected to the server');
    this.physics.initWorld(levelUrl);
    this.physics.startUpdate();

    // setInterval(() => {
    //   const deltaTime = this.clock.getDelta();
    //
    //   this.physics.update(deltaTime);
    // }, 7);
  }

  onServerMessage(event) {
    const bodies = JSON.parse(event.data);

    bodies.forEach(body => {
      const position = body.position;
      const quaternion = body.quaternion;
      const angvel = body.angvel;
      const linvel = body.linvel;
      let mesh;

      if (this.serverMeshes.has(body.id)) {
        mesh = this.serverMeshes.get(body.id);
      } else {
        // mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());
        // mesh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshNormalMaterial());
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.6 * 1,
            0.6 * 1,
            1.2 * 2
          ),
          new THREE.MeshNormalMaterial()
        );
        // RAPIER.ColliderDesc.cylinder(1.2, 0.6)
        this.serverMeshes.set(body.id, mesh);
        this.scene.add(mesh);

        // тут считаем, что уровень загрузился
        if (body.id === 'character') {
          mesh.add(this.camera);
          this.initHullsMeshes();
        }
      }

      mesh.position.set(position[0], position[1], position[2]);
      mesh.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);

      if (body.id !== 'character') {
        const rigidBody = this.physics.entities.get(body.id).body;

        rigidBody.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
        rigidBody.setRotation({ x: quaternion[0], y: quaternion[1], z: quaternion[2], w: quaternion[3] }, true);
        rigidBody.setAngvel({ x: angvel[0], y: angvel[1], z: angvel[2] }, true);
        rigidBody.setLinvel({ x: linvel[0], y: linvel[1], z: linvel[2] }, true);
      }
    });
  }

  createInputCommand() {
    if (keyboard.keys.length === 0) {
      return null;
    }

    const command = {
      up: keyboard.keys.includes(Key.W),
      down: keyboard.keys.includes(Key.S),
      left: keyboard.keys.includes(Key.A),
      right: keyboard.keys.includes(Key.D),

      jump: keyboard.keys.includes(Key.SPACE),
      bottom: keyboard.keys.includes(Key.F),
    };

    return command;
  }

  init3D() {
    this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color( 0xf0f0f0 );

    this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambientLight);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(this.directionalLight);

    this.clock = new THREE.Clock();

    this.camera.position.set(
      -20.48385149512679,
      15.27528774150322,
      -15.37999864097347
    );
    this.camera.quaternion.set(
      -0.05564945305750404,
      -0.7641190670333173,
      -0.06652315378257069,
      0.6392181629000805
    );

    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild( this.renderer.domElement );

    this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.controls.target.set( 0, 2, 0 );
    this.controls.update();

    const axesHelper = new THREE.AxesHelper(100);
    this.scene.add(axesHelper);

    this.gltfLoader.load(levelUrl, (gltf) => {
      gltf.scene.position.set(15.5, 45.5, -19);
      gltf.scene.rotation.set(0, Math.PI / 2, 0);
      this.scene.add(gltf.scene);

      console.log('scene', gltf.scene);
    });

    this.initDebugPhysicsRendering();



    this.update();
    setInterval(this.updateInputs.bind(this), 1000 / 30); // отправляем 30 раз в секунду, как в реале
  }

  initDebugPhysicsRendering() {
    this.debugMesh = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true })
    );

    this.debugMesh.frustumCulled = false;

    console.log('physics lines', this.debugMesh);

    this.scene.add(this.debugMesh);
  }

  initHullsMeshes() {
    this.hullMeshes = new THREE.Group();
    this.hullMeshes.position.set(0, 50, 0);
    this.hullMeshes.rotation.set(0, Math.PI / 2, 0);

    this.physics.decomposedHulls.forEach(hull => {
      const geometry = new THREE.BufferGeometry();

      // почему-то не работает просто hull.indices
      geometry.setIndex(new THREE.Uint32BufferAttribute(hull.indices, 1));

      // hull.positions: Float64Array
      // three.js и WebGL не поддерживают Float64Array, только Float32Array
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(hull.positions), 3));

      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff * Math.random(),
        opacity: 0.35,
        transparent: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.hullMeshes.add(mesh);
    });

    console.log('hull meshes', this.hullMeshes);

    this.scene.add(this.hullMeshes);
  }

  updateInputs() {
    // if ws connection is not open
    if (this.ws.readyState !== 1) {
      return;
    }

    const inputCommand = this.createInputCommand();

    // ничего не нажато
    if (inputCommand === null) {
      return;
    }

    this.physics.applyInputCommand(inputCommand);

    // TODO: попробовать перенести это в отдельный интервал 30 фпс, чтобы проверить разный интервал отправки
    this.ws.send(JSON.stringify(inputCommand))
  }

  // 144 fps
  update() {
    requestAnimationFrame(this.update.bind(this));

    const buffers = this.physics.world.debugRender();

    // https://github.com/pmndrs/react-three-rapier/blob/main/packages/react-three-rapier/src/components/Debug.tsx
    this.debugMesh.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(buffers.vertices, 3)
    );
    this.debugMesh.geometry.setAttribute(
      'colors',
      new THREE.BufferAttribute(buffers.colors, 4)
    );

    this.renderer.render( this.scene, this.camera );
  }
}

export default Client;
