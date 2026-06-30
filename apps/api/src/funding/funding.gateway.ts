import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

/**
 * Live funding-counter fan-out.
 *
 * Browser project pages join `project:<id>` room and receive a tick
 * after every successful pledge — much lighter than 5s polling once
 * we have thousands of concurrent viewers on a viral project.
 *
 * Public namespace (`/funding`), no auth: the data we broadcast is
 * the same `raisedHalalas` + `backersCount` already visible on the
 * public project page.
 */
export interface FundingTick {
  projectId: string;
  raisedHalalas: string;
  backersCount: number;
  /** Server epoch ms, for client-side deduplication if needed. */
  at: number;
}

@WebSocketGateway({
  namespace: '/funding',
  cors: { origin: true, credentials: false },
  transports: ['websocket', 'polling'],
})
export class FundingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(FundingGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.log.debug?.(`ws connect ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.log.debug?.(`ws disconnect ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId?: string },
  ): Promise<{ ok: boolean; room?: string }> {
    const id = payload?.projectId;
    if (!id || typeof id !== 'string') return { ok: false };
    const room = `project:${id}`;
    await client.join(room);
    return { ok: true, room };
  }

  @SubscribeMessage('unsubscribe')
  async onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId?: string },
  ): Promise<{ ok: boolean }> {
    const id = payload?.projectId;
    if (!id) return { ok: false };
    await client.leave(`project:${id}`);
    return { ok: true };
  }

  /** Called by FundingService after a pledge commit. */
  emitTick(tick: FundingTick): void {
    this.server?.to(`project:${tick.projectId}`).emit('funding.tick', tick);
  }
}
