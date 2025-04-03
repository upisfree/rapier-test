import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { prng_alea } from '../node_modules/esm-seedrandom/esm/index.mjs';
import MainLoop from '../lib/MainLoop.js';
import { ConvexMeshDecomposition } from '../node_modules/vhacd-js/lib/vhacd.js';

const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const GRAVITY = -17;
const MARGIN = 0.05;

let RAPIER;

let id = 0;

const random = prng_alea('seed');

function randomInt(min = 0, max = 100_000_000) {
  return Math.round(min - 0.5 + random() * (max - min + 1));
}

/** Returns random float. */
function randomFloat(min = 0, max = 1) {
  return random() * (max - min) + min;
}

/** Returns random boolean. */
function randomBoolean() {
  return Boolean(randomInt(0, 1));
}

export class Body {
  constructor(world, position, shape, mass) {
    this.world = world;
    this.id = id;
    id++;

    // Create a dynamic rigid-body.
    this.description = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      // .setCcdEnabled(true);
    this.body = this.world.createRigidBody(this.description);

    console.log(this);

    // Create a cuboid collider attached to the dynamic rigidBody.
    let colliderDesc = RAPIER.ColliderDesc.cylinder(1.2, 0.6);
    this.collider = this.world.createCollider(colliderDesc, this.body);
  }

  setPosition(x, y, z) {

  }

  setQuaternion(x, y, z, w) {

  }

  toJSON() {
    const position = this.body.translation();
    const quaternion = this.body.rotation();
    const angvel = this.body.angvel();
    const linvel = this.body.linvel();

    return {
      id: this.id,
      // mass: this.mass,
      position: [position.x, position.y, position.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      angvel: [angvel.x, angvel.y, angvel.z],
      linvel: [linvel.x, linvel.y, linvel.z]
    };
  }
}

export class Character {
  id = 'character';

  constructor(world, entities) {
    this.world = world;
    this.entities = entities;

    let characterDesc =
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        0.0,
        0.0,
        0.0,
      );
    this.body = this.world.createRigidBody(characterDesc);
    this.entities.set('character', this);

    let characterColliderDesc = RAPIER.ColliderDesc.cylinder(1.2, 0.6);
    this.characterCollider = this.world.createCollider(
      characterColliderDesc,
      this.body,
    );
  }

  toJSON() {
    const position = this.body.translation();
    const quaternion = this.body.rotation();
    const angvel = this.body.angvel();
    const linvel = this.body.linvel();

    return {
      id: this.id,
      // mass: this.mass,
      position: [position.x, position.y, position.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
      angvel: [angvel.x, angvel.y, angvel.z],
      linvel: [linvel.x, linvel.y, linvel.z],
    };
  }
}

class Physics {
  entities = new Map();

  playerSpeed = 0.5;

  constructor() {
    this.movementDirection = {x: 0.0, y: -this.playerSpeed, z: 0.0};

    if (isBrowser) {
      this.gltfLoader = new GLTFLoader();
    } else {
      import('node-three-gltf').then(module => {
        this.gltfLoader = new module.GLTFLoader();
      });
    }

    console.log(this);
  }

  createRigidBody( position, physicsShape, mass, pos, quat ) {
    const body = new Body(this.world, position);

    this.entities.set(body.id, body);

    return body;
  }

  createParalellepiped( sx, sy, sz, mass, pos, quat ) {

  }

  createSphere( mass, pos, quat ) {

  }

  createPlayer() {
    // Character.
    this.character = new Character(this.world, this.entities);

    this.characterController = this.world.createCharacterController(0.1);
    this.characterController.enableAutostep(0.7, 0.3, true);
    this.characterController.enableSnapToGround(0.5);
    this.characterController.setApplyImpulsesToDynamicBodies(true);

    // The gap the controller will leave between the character and its environment.
    // let offset = 0.01;
    // Create the controller.
    // this.characterController = this.world.createCharacterController(offset);

    // this.characterController.setApplyImpulsesToDynamicBodies(true);
  }

  applyInputCommand(input) {
    // this.movementDirection.x = 0;
    // this.movementDirection.y = -this.playerSpeed;
    // this.movementDirection.z = 0;

    let x = 0;
    let y = 0;
    let z = 0;

    if (input.up) {
      z = this.playerSpeed;
    } else if (input.down) {
      z = -this.playerSpeed;
    }

    if (input.left) {
      x = this.playerSpeed;
    } else if (input.right) {
      x = -this.playerSpeed;
    }

    if (input.jump) {
      y = this.playerSpeed;
    } else if (input.bottom) {
      y = -this.playerSpeed;
    }

    this.movementDirection.x = x;
    this.movementDirection.y = y;
    this.movementDirection.z = z;



    this.characterController.computeColliderMovement(
      this.character.characterCollider,
      this.movementDirection,
    );

    let movement = this.characterController.computedMovement();
    let newPos = this.character.body.translation();
    newPos.x += movement.x;
    newPos.y += movement.y;
    newPos.z += movement.z;
    this.character.body.setNextKinematicTranslation(newPos);
  }

  createWalls() {
    const size = 200;
    const thickness = 0.1;

    const euler = new THREE.Euler();
    const quat = new THREE.Quaternion();

    let bottom = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(0, -size, 0)
    this.world.createCollider(bottom);

    let top = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(0, size, 0)
    this.world.createCollider(top);

    euler.set(-Math.PI / 2, 0, 0);
    quat.setFromEuler(euler);
    let left = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(0, 0, -size)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    this.world.createCollider(left);

    euler.set(-Math.PI / 2, 0, 0);
    quat.setFromEuler(euler);
    let right = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(0, 0, size)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    this.world.createCollider(right);

    euler.set(0, 0, Math.PI / 2);
    quat.setFromEuler(euler);
    let near = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(size, 0, 0)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    this.world.createCollider(near);

    euler.set(0, 0, Math.PI / 2);
    quat.setFromEuler(euler);
    let far = RAPIER.ColliderDesc.cuboid(size, thickness, size)
      .setTranslation(-size, 0, 0)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
    this.world.createCollider(far);
  }

  startUpdate() {
    MainLoop.setUpdate(this.update.bind(this)).start();

    if (isBrowser) {
      MainLoop.setMaxAllowedFPS(60);
    } else {
      MainLoop.setMaxAllowedFPS(60);
    }

  }

  update() {
    this.world.step();
  }

  init() {
    let gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    this.createWalls();
  }

  initWorld(levelUrl) {
    this.loadLevel(levelUrl).then(() => {
      this.createPlayer();
      this.generateRandomBodies();
    });

    // setInterval(() => {
    //   this.shakeBodies();
    // }, 10000);

    // setInterval(() => {
    //   this.randomInputCommands();
    // }, 2000);
  }

  randomInputCommands() {
    const command = {
      up: randomBoolean(),
      down: randomBoolean(),
      left: randomBoolean(),
      right: randomBoolean(),
      jump: randomBoolean()
    }

    this.applyInputCommand(command);
  }

  generateRandomBodies() {
    const spread = 10;

    for (let i = 0; i < 100; i++) {
      const position = {
        x: randomInt(-spread, spread),
        y: randomInt(60, 900),
        z: randomInt(-spread, spread)
      };

      const body = this.createRigidBody(position);
      // console.log(body);
    }
  }

  // shakeBodies() {
  //   Array.from(this.entities.values()).forEach(body => {
  //     const impulse = 1000;
  //     const torque = 200;
  //
  //     this._btMoveImpulse.setValue(
  //       randomInt(-impulse, impulse),
  //       randomInt(-impulse, impulse),
  //       randomInt(-impulse, impulse)
  //     );
  //
  //     this._btTorque.setValue(
  //       randomInt(-torque, torque),
  //       randomInt(-torque, torque),
  //       randomInt(-torque, torque)
  //     );
  //
  //     body.body.applyImpulse(this._btMoveImpulse);
  //     body.body.applyTorqueImpulse(this._btTorque);
  //   });
  // }

  loadLevel(url) {
    return new Promise(async (resolve, reject) => {
      this.gltfLoader.load(url, (gltf) => {
        const geometries = []

        gltf.scene.traverse((obj) => {
          if (obj.geometry && obj.visible) {
            obj.geometry.morphAttributes = {};
            obj.geometry.morphTargetsRelative = false;

            geometries.push(obj.geometry);
          }
        });

        const geometry = mergeGeometries(geometries);

        // работает медленно. это ожидаемо
        const hulls = this.decomposeLevel(geometry.attributes.position.array, geometry.index.array);
        console.log(hulls);
        hulls.forEach(hull => {
          const { positions, indices } = hull;

          const levelBodyDescription = RAPIER.RigidBodyDesc.fixed();
          const levelBody = this.world.createRigidBody(levelBodyDescription);

          debugger;

          let colliderDesc = RAPIER.ColliderDesc.convexMesh(positions, indices);
          const levelCollider = this.world.createCollider(colliderDesc, levelBody);

          levelBody.setTranslation({ x: 0, y: 50, z: 0 }, true);
          levelBody.setRotation({ x: 0, y: 0.7071067811865475, z: 0, w: 0.7071067811865475 }, true);
        });

        // для отрисовки на клиенте
        this.decomposedHulls = hulls;

        resolve();
      }, () => {}, reject);
    });
  }

  decomposeLevel(positions, indices) {
    const options = { maxHulls: 1024, messages: 'all' };
    const hulls = this.convexMeshDecomposer.computeConvexHulls({ positions, indices }, options);

    return hulls;
  }

  async load() {
    return new Promise(async (resolve, reject) => {
      // так? из-за бандлера на клиенте
      // client: @dimforge/rapier3d
      // server: @dimforge/rapier3d-compat
      const rapierModuleUrl = (isBrowser) ?
        'https://cdn.skypack.dev/@dimforge/rapier3d-compat' : '@dimforge/rapier3d-compat';
      RAPIER = await import(rapierModuleUrl);
      await RAPIER.init();

      this.convexMeshDecomposer = await ConvexMeshDecomposition.create();

      this.init();

      resolve();
    });

      // return;
      //
      // if (isBrowser) {
      //   RAPIER = await import('https://cdn.skypack.dev/@dimforge/rapier3d-compat');
      //   RAPIER.init().then(() => {
      //     this.init();
      //
      //     resolve();
      //   });
      // } else {
      //   const module = await import('module');
      //   const require = module.createRequire(import.meta.url);
      //   RAPIER = require('../lib/rapier-node');
      //
      //   this.init();
      //
      //   resolve();
      // }
      //
      // console.log(RAPIER);
      //
      // RAPIER.init().then(() => {
      //   this.init();
      // });
  }
}

export default Physics;
