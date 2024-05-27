import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ProductsGateway {
  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  server: Server;

  handleProductUpdated() {
    this.server.emit('productUpdated');
  }

  handleConnection(client: Socket) {
    try {
      this.jwtService.verify(client.handshake.auth.Authentication.value);
    } catch (err) {
      throw new WsException('Unauthorized.');
    }
  }
}
