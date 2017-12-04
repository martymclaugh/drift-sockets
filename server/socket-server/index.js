import io from 'socket.io';
import { socketEventTypes } from './socket-event-types';

export default function (server) {
  const socketServer = io(server);
  const connections = [];
  const userNames = ['marty'];
  const lobbyMessages = [];
  var userId = 0;

  socketServer.on('connection', socket => {
    connections.push(socket);
    userId += 1;

    Object.keys(socketEventTypes).map(action => {
      socket.on(action, data => {
        socket.broadcast.emit(socketEventTypes[action], data);
      });
    });

    socket.on('createUsername', data => {
      if (userNames.includes(data.username)) {
        socket.emit('receiveUsernameTaken', data.username);
      } else {
        userNames.push(data.username);
        socket.emit('receiveUsernameSuccess', {
          username: data.username,
          id: userId,
        });
        const lastFiftyLobbyMessages = lobbyMessages.slice(lobbyMessages.length - 50);
        socket.emit('receiveLobbyMessage', lastFiftyLobbyMessages);
      }
    });
    socket.on('sendLobbyMessage', data => {
      lobbyMessages.push(data);
      socket.broadcast.emit('receiveLobbyMessage', data);
    });

    socket.on('disconnect', () => {
      const index = connections.indexOf(socket);
      connections.splice(index, 1);
    });
  });
}
