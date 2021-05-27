'use strict';

let fs    = require('fs');
let path  = require('path');
let app   = require('koa')();
let log   = Bento.Log;
const cors = require('@koa/cors');

Bento._app = function *() {
  yield Bento._bootstrap();
  yield registerMiddleware();
  yield startServer();
};

function *registerMiddleware() {
  log.title('MIDDLEWARE');
  Bento.api('middleware').forEach((target) => {
    let targetPath = path.join(Bento.ROOT_PATH, 'middleware', target + '.js');
    if (fs.existsSync(targetPath)) {
      log.silent('info')(`Loading [${ target }]`);
      require(targetPath)(app);
    }
  });
}

function *startServer() {
  log.title('STARTING SERVERS');
  log.silent('info')(`listening on server port: ${ Bento.config.api.port }`);

  yield require('./bootstrap/modules');

  app.use(cors());
  app.listen(Bento.config.api.port);
}
