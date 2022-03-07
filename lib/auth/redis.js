'use strict';

let redis = Bento.Redis;
let error = Bento.Error;
let rndm  = Bento.Helpers.Random;
let log = Bento.Log;
let logoutExpire = 60 * 60 * 24 * 30;

/**
 * @class Redis
 */
let Redis = module.exports = {};

// ### Constants

let userBucket = redis.bucket('auth:user');
let authBucket = redis.bucket('auth:token');

/**
 * Creates and stores a system access token and returns an object
 * with the token value.
 * @param  {String} userId
 * @param  {Object} payload
 * @return {Object}
 */
Redis.getToken = function *getToken(userId, payload) {
  let token  = rndm(64);
  let source = userId;

  // ### From
  // Set the source if it has been defined.

  source += ':' + (payload.source || 'default');

  // ### Previous Token
  // Delete the previous token held by the user.

  /*
  let prevToken = yield userBucket.get(source);
  if (prevToken) {
    yield authBucket.del(prevToken);
  }
  */

  // ### Set
  // Set the new tokens

  let oldList = yield userBucket.lset(source, token);
  //
  // if we are doing cleanup then we try to cleanup the
  // other side of the system here.
  for(var ix of oldList) {
    yield authBucket.del(ix);
  }

  yield authBucket.setJSON(token, {
    user    : userId,
    group   : payload.group || 1,
    source  : source,
    persist : false
  });

  yield setExpiry(source, token);

  return { token : token };
};

Redis.getStore = function *getStore(token) {
  let store = yield getAuthStore(token);
  if (!store) {
    throw error.parse({
      code    : 'AUTH_INVALID_TOKEN',
      message : 'The authentication token provided is invalid ' + token
    }, 401);
  }
  //if (!store.persist) {
  yield setExpiry(store.source, token);
  //}
  return store;
};

Redis.remember = function *remember(token) {
  let store = yield getAuthStore(token);
  if (store) {
    yield authBucket.setJSON(token, {
      user    : store.user,
      group   : store.group,
      source  : store.source,
      persist : false
    });
    //yield userBucket.persist(store.source);
    //yield authBucket.persist(token);
  }
};

/**
 * @param  {String} id
 * @param  {String} from
 * @return {Void}
 */
Redis.logout = function *logout(id, from) {
  let source = id + ':' + (from || 'default');
  let token  = yield userBucket.lget(source, id);
  if (token) {
    yield userBucket.ldel(source, token);
    yield authBucket.del(token);
  } else {
    throw error.parse({
      code    : 'AUTH_LOGOUT_NO_USER',
      message : 'The logout source provided does not exist',
      data    : {
        user : id,
        from : from
      }
    }, 400);
  }
};

function *getAuthStore(token) {
  let store = yield authBucket.getJSON(token);
  if (store) {
    return store;
  }
  return false;
}

/**
 * @param  {String} source
 * @param  {String} token
 * @return {Void}
 */
function *setExpiry(source, token) {
  yield userBucket.expire(source, logoutExpire);
  yield authBucket.expire(token, logoutExpire);
}
