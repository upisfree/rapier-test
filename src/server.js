import { createServer } from 'http';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Clock } from '../lib/three.module.js';
import Physics from './physics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Server {
  constructor() {
    this.clock = new Clock();

    const httpServer = createServer({
      // cert: readFileSync(process.env.CERT_PATH),
      // key: readFileSync(process.env.KEY_PATH)
    });

    this.server = new WebSocketServer({
      server: httpServer,
      // maxPayload: this.guga.config.maxWebSocketPayload
    });

    httpServer.listen(23456);

    this.server.on('connection', (ws) => {
      this.clientSocket = ws;
      this.clientSocket.on('message', this.onClientMessage.bind(this));

      const levelUrl = path.join(__dirname, '..', 'assets', 'book.glb');
      this.physics.initWorld(levelUrl);
    });

    this.physics = new Physics();
    this.physics.load().then(() => {
      console.log('physics started');

      // physics loop
      this.physics.startUpdate();
      setInterval(this.update.bind(this), 1000 / 30); // отправляем 30 раз в секунду, как в реале
    });

    console.log('server started');
  }

  update() {
    const { physics } = this;

    // const deltaTime = this.clock.getDelta();
    // physics.update(deltaTime);

    if (this.clientSocket) {
      const dynamicBodies = Array.from(physics.entities.values());
      const serialized = dynamicBodies.map(body => body.toJSON());

      this.clientSocket.send(
        JSON.stringify(serialized)
      );
    }
  }

  onClientMessage(message) {
    // setTimeout(() => {
      const inputCommand = JSON.parse(message);

      this.physics.applyInputCommand(inputCommand);
    // }, 50);
  }
}

const server = new Server();

// export default Server;
