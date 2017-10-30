import server from './server';
import socketServer from './server/socket-server';

var config = {};

if (process.env.NODE_ENV === 'development') {
  config.port = 3000;
  config.host = 'localhost';
}

const webServer = server.listen(config.port, config.host, (err) => {
  if (err) throw err;
  console.log('Web server listening at http://%s:%d', config.host, config.port);
});

socketServer(webServer);
