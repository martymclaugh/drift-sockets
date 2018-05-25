import io from 'socket.io';
import { gameActions } from './game-actions';
import { stars } from '../helpers/star-list';
import initialPlayerResources from '../helpers/initial-player-resources'
import initialPlayerPlanets from '../helpers/initial-player-planets';
import initialPlayerMonuments from '../helpers/initial-player-monuments';
import _ from 'lodash';

export default function (server) {
  const socketServer = io(server);
  const connections = [];
  const userNames = ['marty'];
  const emptyServers = stars.map(star => (
    _.kebabCase(star.toLowerCase())
  ));
  const lobbyMessages = [];
  const lobbyActivelyTyping = [];
  // need games array for password checking
  const games = [];
  const lobbyGames = {};
  const serversInUse = [];
  var userId = 0;
  const LOBBY_ROOM = 'lobby';

  socketServer.on('connection', socket => {
    connections.push(socket);
    userId += 1;

    Object.keys(gameActions).map(action => {
      socket.on(action, data => {
        socket.broadcast.to(data.server).emit(gameActions[action], data);
      });
    });
    socket.on('disconnect', () => {
      const index = connections.indexOf(socket);
      connections.splice(index, 1);
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
      const randomStar = emptyServers.splice(Math.random() * emptyServers.length | 0, 1)[0];

      serversInUse.push(randomStar);

      socket.emit('receiveServer', randomStar);
    });
    socket.on('recycleServer', data => {
      const index = serversInUse.indexOf(data);

      serversInUse.splice(index, 1);

      emptyServers.push(data);
    });
    socket.on('createGame', data => {
      const { game } = data;
      const lobbyGame = {
        user: game.user,
        server: game.server,
        numberOfPlayers: game.numberOfPlayers,
        isPrivate: !!game.password,
        playersJoined: 0,
        users: {},
      };
      game.playersJoined = lobbyGame.playersJoined;

      games.push(game);
      lobbyGames[game.server] = (lobbyGame);
      socket.broadcast.to(LOBBY_ROOM).emit('updateGamesList', lobbyGames);
    });
    socket.on('checkPassword', data => {
      const index = _.findIndex(games, data.game);

      if (index > -1) {
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
    socket.on('joinGame', data => {
      // player joins the game room
      const { server } = data;
      socket.leave(LOBBY_ROOM);
      socket.join(server);

      // update lobby game
      lobbyGames[server].playersJoined += 1;
      // add user to game and populate user with initial game state
      lobbyGames[server].users[data.user] = {
        resources: initialPlayerResources,
        planets: initialPlayerPlanets,
        monuments: initialPlayerMonuments,
        upgrades: {},
      };
      const index = _.findIndex(games, data.game);
      const updatedGame = games[index];

      // update game with password attached
      updatedGame.playersJoined += 1;

      games.splice(index, 1, updatedGame);
      socket.broadcast.to(LOBBY_ROOM).emit('updateGamesList', lobbyGames);

      socket.emit('playerJoined', {
        game: lobbyGames[server],
      });
      socket.broadcast.to(server).emit('playerJoined', {
        game: lobbyGames[server],
      });
    });
  });
}
