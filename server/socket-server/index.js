import io from 'socket.io';
import { socketEventTypes } from './socket-event-types';

export default function (server) {
  const socketServer = io(server);
  const connections = [];
  var userId = 0;

  socketServer.on('connection', socket => {
    connections.push(socket);
    userId += 1;
    console.log('here', userId)

    Object.keys(socketEventTypes).map(action => {
      socket.on(action, data => {
        socket.broadcast.emit(socketEventTypes[action], data);
      });
    });

    socket.on('disconnect', () => {
      const index = connections.indexOf(socket);
      connections.splice(index, 1);
    });
  });
}
