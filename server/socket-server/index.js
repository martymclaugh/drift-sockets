import io from 'socket.io';
import { socketEventTypes } from './socket-event-types';
import { stars } from '../helpers/star-list';
import _ from 'lodash';

export default function (server) {
  const socketServer = io(server);
  const connections = [];
  const userNames = ['marty'];
  const starServers = stars.map(star => (
    _.kebabCase(star.toLowerCase())
  ));
  const lobbyMessages = [];
  const lobbyActivelyTyping = [];
  // need games array for password checking
  const games = [];
  const lobbyGames = {};
  var userId = 0;
  const LOBBY_ROOM = 'lobby';

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
      }
    });
    socket.on('joinLobbyRoom', () => {
      const lastFiftyLobbyMessages = lobbyMessages.slice(lobbyMessages.length - 50);

      socket.join(LOBBY_ROOM);
      socket.emit('receiveLobbyMessage', lastFiftyLobbyMessages);
      Object.keys(lobbyGames).length > 0 && socket.emit('updateGamesList', lobbyGames);
    })
    socket.on('sendLobbyMessage', data => {
      lobbyMessages.push(data);
      socket.broadcast.to(LOBBY_ROOM).emit('receiveLobbyMessage', data);
    });
    socket.on('requestServer', data => {
      const randomStar = starServers.splice(Math.random() * starServers.length | 0, 1)[0];
      socket.emit('receiveServer', randomStar);
    });
    socket.on('recycleServer', data => {
      starServers.push(data);
    });
    socket.on('createGame', data => {
      const { game } = data;
      const lobbyGame = {
        user: game.user,
        server: game.server,
        numberOfPlayers: game.numberOfPlayers,
        isPrivate: !!game.password,
        playersJoined: 0,
      };
      game.playersJoined = lobbyGame.playersJoined;

      games.push(game);
      lobbyGames[game.server] = (lobbyGame);
      socket.broadcast.to(LOBBY_ROOM).emit('updateGamesList', lobbyGames);
    });
    socket.on('joinGame', data => {
      console.log(data);
      lobbyGames[data.server].playersJoined += 1;
      const index = _.findIndex(games, data.game);
      const updatedGame = games[index];
      updatedGame.playersJoined += 1;

      games.splice(index, 1, updatedGame);
      socket.broadcast.to(LOBBY_ROOM).emit('updateGamesList', lobbyGames);
    });
    socket.on('checkPassword', data => {
      console.log(data.game);
      console.log(games);
      const index = _.findIndex(games, data.game);

      if (index > -1) {
        // const {
        //   playersJoined,
        //   user,
        //   server,
        //   numberOfPlayers,
        //   password,
        // } = data.game;

        // const lobbyGame = {
        //   user,
        //   server,
        //   numberOfPlayers,
        //   playersJoined,
        //   isPrivate: !!password,
        // }
        // const updatedGame = data.game;
        // updatedGame.playersJoined = playersJoined + 1;
        // lobbyGame.playersJoined = lobbyGame.playersJoined + 1;
        // Replace game at index in lobbyGames and games
        // lobbyGames[server].playersJoined += 1;

        socket.emit('passwordSuccess', data.game);
        socket.broadcast.to(LOBBY_ROOM).emit('updateGamesList', lobbyGames);
      } else {
        socket.emit('wrongPassword', { error: 'Incorrect Password' });
      }
    });
    socket.on('sendUserTyping', data => {
      lobbyActivelyTyping.push(data.username);

      socket.broadcast.to(LOBBY_ROOM).emit('receiveLobbyActivelyTyping', lobbyActivelyTyping);
    });
    socket.on('removeUserTyping', data => {
      const index = lobbyActivelyTyping.indexOf(data.username);
      lobbyActivelyTyping.splice(index, 1);

      socket.broadcast.to(LOBBY_ROOM).emit('receiveLobbyActivelyTyping', lobbyActivelyTyping);
    });

    socket.on('disconnect', () => {
      const index = connections.indexOf(socket);
      connections.splice(index, 1);
    });
  });
}
