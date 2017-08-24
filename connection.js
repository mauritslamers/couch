/*globals Couch */

sc_require('database');

Couch.Connection = SC.Object.extend({

  init: function () {
    sc_super();
    // trigger retrieval of uuids
    this._retrieveUuids();
  },

  prefix: null, // prefix to add in front of db names

  sessionTimeout: 600, // timeout in seconds, same default setting as default couch,
                        // adjust if your couch has a different setting. The automatic
                        // login checker will check every 1/2 of this time

  baseUrl: function () {
    return [this.get('prefix')].join("/");
  }.property('prefix').cacheable(),

  urlFor: function () {
    return [this.get('baseUrl')].concat(SC.A(arguments)).join("/");
  },

  database: function (dbname) {
    return Couch.Database.create({
      database: dbname,
      prefix: this.get('prefix')
    });
  },

  sessionState: function (target, action) {
    SC.Request.getUrl(this.urlFor('_session')).json()
      .notify(this, this._sessionStateDidRespond, target, action).send();
  },

  _sessionStateDidRespond: function (result, target, action) {
    SC.Logger.log("_sessionStateDidRespond");
    var loggedin = false;
    if (SC.ok(result)) {
      var body = result.get('body');
      if (body && body.ok && body.userCtx && body.userCtx.name) {
        //SC.Logger.log("body is ok");
        this._username = body.userCtx.name;
        if (this._username) loggedin = body.userCtx;
        Couch.callNotifier(target, action, null, result);
        return;
      }
    }
    Couch.callNotifier(target, action, Couch.ERROR_NOAUTH, result);
  },

  login: function (username, password, target, action) {
    SC.Logger.log("performing login for " + username);
    var obj = { name: username, password: password };
    SC.Request.postUrl(this.urlFor('_session')).json()
      .notify(this, this._notifyLoginDidRespond, target, action)
      .send(obj);
    this._username = username;
  },

  _notifyLoginDidRespond: function (result, target, action) {
    if (SC.ok(result)) {
      var body = result.get('body');
      if (body && body.ok) {
        SC.Logger.log("successfully logged in");
        Couch.callNotifier(target, action, null, body);
      }
      else Couch.callNotifier(target, action, null, body);
    }
    else {
      if (result.get('status') === 401) {
        Couch.callNotifier(target, action, Couch.ERROR_INCORRECTPASSWORD, result);
      }
      else {
        Couch.callNotifier(target, action, Couch.ERROR_NOAUTH, result);
      }
    }
  },

  // the keepAlive is something that should be started by the application
  // This way, if the keepAlive is lost somehow, or the app suddenly loses
  // auth, the app can prompt for a login
  // so, the target/method will be called every time a request has been performed
  // and the app can react as soon as the session seems to be lost
  startSessionKeepAlive: function (target, method, interval) {
    var me = this;
    if (this._keepAlive) {
      SC.Logger.log("You cannot start a new session keep alive when there is already one running");
      return;
    }
    this._keepAlive = SC.Timer.schedule({
      action: function () {
        SC.Logger.log("sessionKeepAlive");
        me.sessionState(target, method);
      },
      interval: interval || (this.sessionTimeout / 2) * 1000,
      repeats: true
    });
  },

  _keepAlive: null,

  stopSessionKeepAlive: function () {
    if (this._keepAlive) {
      this._keepAlive.invalidate();
      this._keepAlive = null;
    }
  },

  logout: function (target, action) {
    SC.Request.deleteUrl(this.urlFor("_session")).json()
              .notify(this, this._notifyLogoutDidRespond, target, action)
              .send();
  },

  _notifyLogoutDidRespond: function (result, target, action) {
    this.stopSessionKeepAlive(); // always end heartbeat
    if (SC.ok(result)) {
      Couch.callNotifier(target, action, null, true);
    }
    else {
      Couch.callNotifier(target, action, Couch.ERROR_LOGOUT, result);
    }
  },

  _retrieveUuids: function () {
    var count = this._uuidBufferSize;
    SC.Request.getUrl(this.urlFor("_uuids")).json()
      .notify(this, this._uuidsDidRetrieve).send({ count: count });
  },

  _uuidsDidRetrieve: function (result) {
    if (SC.ok(result)) {
      this._uuids = result.get('body').uuids;
    }
    else SC.warn("Couch#_uuidsDidRetrieve: impossible to retrieve uuids?");
  },

  _uuidBufferSize: 50,

  // convenience for a single uuid
  uuid: function () {
    return this.uuids();
  },

  // will return only as many as present, so if count is too high,
  // you need to get a new series afterwards, or do it yourself.
  uuids: function (count) { // function to get uuids
    var ret;
    if (!this._uuids) {
      SC.warn("Couch#uuids: something is wrong, no uuids loaded?");
      return null;
    }
    var c = count ? count : 1;
    if (c === 1) {
      ret = this._uuids.pop();
    }
    else {
      ret = [];
      for (var i = 0; i < count; i += 1) {
        ret.push(this._uuids.pop()); // this way we know that the array is being adjusted immediately
      }
    }
    if (this._uuids.length < (this._uuidBufferSize / 10)) {
      this._retrieveUuids();
    }
    return ret;
  }

});