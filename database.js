/*globals Couch, jQuery*/

Couch.Database = SC.Object.extend({

  prefix: null,

  database: null,

  baseUrl: function () {
    return [this.get('prefix'), this.get('database')].join("/");
  }.property('prefix', 'database').cacheable(),

  urlFor: function () {
    return [this.get('baseUrl')].concat(SC.A(arguments)).join("/");
  },

  _callNotifier: function (target, action, err, result) {
    //var args = SC.A(arguments), t, m;
    var t, m;

    if (!target && !action) throw new Error('Couch.Connection: Notifier is of a non-supported type');
    if (SC.typeOf(target) === SC.T_FUNCTION && !action) {
      m = target;
      t = this;
    }
    else {
      t = target;
      m = (SC.typeOf(action) === SC.T_STRING) ? target[action]: action;
    }
    m.call(t, err, result);
  },

  // used by the other functions to check whether an action failed because of
  // an invalid authentication
  _hasValidAuth: function (result, target, action) {
    if (result.get('status') === 401) {
      Couch.callNotifier(target, action, Couch.ERROR_NOAUTH, result);
      return false;
    }
    else return true;
  },

  exists: function (target, action) {
    SC.Request.headUrl(this.get('baseUrl')).json()
      .notify(this, this._existsDidRespond, target, action).send();
  },

  _existsDidRespond: function (result, target, action) {
    if (!this._hasValidAuth(result, target, action)) return;
    var status = result.get('status');
    switch (status) {
      case 404:
        Couch.callNotifier(target, action, null, false);
        break;
      case 200:
        Couch.callNotifier(target, action, null, true);
        break;
      default:
        Couch.callNotifier(target, action, Couch.ERROR_INVALIDRESULT, result);
    }
  },

  info: function (target, action) {
    var newargs = SC.A(arguments);
    newargs.unshift(this, this._infoDidRespond);
    var req = SC.Request.getUrl(this.get('baseUrl')).json();
    req.notify.apply(req, newargs).send();
  },

  _infoDidRespond: function (result, target, action) {
    var newargs = SC.A(arguments).slice(2);
    if (SC.ok(result)) {
      newargs.unshift(target, action, null, result.get('body'));
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, result, null);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  destroy: function (id, target, action) {
    SC.Request.deleteUrl(this.get('baseUrl')).json()
      .notify(this, this._destroyDidRespond, target, action).send();
  },

  _destroyDidRespond: function (result, target, action) {
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      Couch.callNotifier(target, action, null, result);
    }
    else {
      Couch.callNotifier(target, action, result, null);
    }
  },

  create: function (target, action) {
    SC.Request.putUrl(this.get('baseUrl')).json()
      .notify(this, this._createDidRespond, target, action).send();
  },

  _createDidRespond: function (result, target, action) {
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      Couch.callNotifier(target, action, null, result);
    }
    else {
      Couch.callNotifier(target, action, Couch.ERROR_COULDNOTCREATEDB, result);
    }
  },

  retrieve: function (id, target, action) { // get should support both id and [id1, id2]
    var keys, newargs, req;
    if (!id || !target) throw Couch.ERROR_INVALIDGETPARAMETERS;

    var getKeys = function (t) {
      var type = SC.typeOf(t);
      if (type === "string") return t;
      else if (type === "hash") return t._id;
      else if (type === "object") return t.get('id');
    };

    if (SC.typeOf(id) === "array") {
      keys = id.map(getKeys);
    }
    else keys = getKeys(id);
    if (!keys || (SC.typeOf(keys) === "array" && keys.without(undefined).get('length') === 0)) {
      throw Couch.ERROR_INVALIDGETPARAMETERS;
    }

    newargs = SC.A(arguments).slice(1);

    if (SC.typeOf(keys) === "array") { // bulk
      newargs.unshift(this, this._getBulkDidRespond);
      req = SC.Request.postUrl(this.urlFor('_all_docs?include_docs=true')).json();
      req.notify.apply(req, newargs).send({ keys: keys });
    }
    else { // single
      newargs.unshift(this, this._getDidRespond);
      req = SC.Request.getUrl(this.urlFor(keys)).json();
      req.notify.apply(req, newargs).send();
    }
  },

  _getBulkDidRespond: function (result, target, action) {
    var args = SC.A(arguments);
    if (!this._hasValidAuth.apply(this, arguments)) return;
    var newargs = args.slice(3);
    if (SC.ok(result)) {
      var body = result.get('body');
      newargs.unshift(target, action, null, body.rows);
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, Couch.ERROR_INVALIDBULKREQUEST, result);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  _getDidRespond: function (result, target, action) {
    var args = SC.A(arguments);
    if (!this._hasValidAuth.apply(this, arguments)) return;
    var newargs = args.slice(3);
    if (SC.ok(result)) {
      var body = result.get('body');
      newargs.unshift(target, action, null, body);
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, Couch.ERROR_DOCNOTFOUND, null);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  /* 4 argument scenarios
  A => save: function (id, rec, target, action)
  B => save: function (rec, target, action)
  C => save: function (id, rev, rec, target, action)
  D => save: function ([rec1, rec2], target, action)
  */

  save: function () {
    var id, rec, recs, rev, target, action, url, newargs, req;
    var args = SC.A(arguments);
    var firstArgType = SC.typeOf(args[0]);
    var secArgType = SC.typeOf(args[1]);
    if (firstArgType === "string") {
      id = args[0];
      if (secArgType === "hash") { // scenario A
        rec = args[1];
        target = args[2];
        action = args[3];
        newargs = args.slice(4);
      }
      else if (secArgType === "string") { // scenario C
        rev = args[1];
        rec = args[2];
        target = args[3];
        action = args[4];
        newargs = args.slice(4);
      }
      url = this.urlFor(id);
      url = rev ? url + "?rev=" + rev : url;
      newargs.unshift(this, this._saveDidRespond, target, action);
      req = SC.Request.putUrl(url).json();
      req.notify.apply(req, newargs).send(rec);
    }
    else if (firstArgType === "hash") { // scenario B
      rec = args[0];
      target = args[1];
      action = args[2];
      newargs = args.slice(3);
      newargs.unshift(this, this._saveDidRespond, target, action);
      req = SC.Request.postUrl(this.get('baseUrl')).json();
      req.notify.apply(req, newargs).send(rec);
    }
    else if (firstArgType === "array") { // scenario D
      recs = args[0];
      target = args[1];
      action = args[2];
      newargs = args.slice(3);
      newargs.unshift(this, this._saveBulkDidRespond, target, action);
      req = SC.Request.postUrl(this.urlFor('_all_docs')).json();
      req.notify.apply(req, newargs).send({ docs: recs });
    }
  },

  _saveBulkDidRespond: function (result, target, action) {
    var args = SC.A(arguments);
    if (!this._hasValidAuth.apply(this, arguments)) return;
    var newargs = args.slice(3);
    if (SC.ok(result)) {
      var body = result.get('body');
      newargs.unshift(target, action, null, body.rows);
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, Couch.ERROR_INVALIDBULKSAVEREQUEST, result);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  _saveDidRespond: function (result, target, action) {
    var args = SC.A(arguments);
    if (!this._hasValidAuth.apply(this, arguments)) return;
    var newargs = args.slice(3);
    if (SC.ok(result)) {
      var body = result.get('body');
      newargs.unshift(target, action, null, body);
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, Couch.ERROR_SAVING, result);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  remove: function (id, rev, target, action) {
    SC.Request.deleteUrl(this.urlFor(id) + "?rev=" + rev).json()
      .notify(this, this._removeDidRespond, target, action).send();
  },

  _removeDidRespond: function (result, target, action) {
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      Couch.callNotifier(target, action, null, result.get('body'));
    }
    else {
      Couch.callNotifier(target, action, Couch.ERROR_DELETING, result);
    }
  },

  // syntax
  // view("designdoc/view", function() )
  // view("designdoc/view", target, method)
  // view("designdoc/view", optionhash, target, method)
  // view("designdoc/view", optionHash, function)
  // any other parameters are passed through to the callbacks
  // simple view for the moment
  view: function () {
    // id has format designdoc/view
    // needs to become _design/designdoc/_view/view/?opts
    var id, opts, target, action, viewparts, req;
    var ddoc, viewname, url, body, params;
    var args = SC.A(arguments), newargs;
    if (SC.typeOf(args[1]) === SC.T_STRING || SC.typeOf(args[1]) === SC.T_FUNCTION) { // args[1] is notifier
      target = args[1];
      action = null;
      id = args[0];
      newargs = args.slice(2); // take remaining as pass through params
    }
    else if (SC.typeOf(args[1]) === SC.T_HASH) {
      id = args[0];
      opts = args[1];
      target = args[2];
      action = args[3];
      newargs = args.slice(4);
    }

    viewparts = id.split("/");
    if (!viewparts[0] || !viewparts[1]) {
      throw Couch.ERROR_INVALIDVIEWID;
    }

    ddoc = "_design/" + viewparts[0];
    viewname = "_view/" + viewparts[1];
    if (opts && opts.keys) {// if keys are there, the request needs to be a postUrl
      body = { keys: opts.keys };
      params = SC.copy(opts);
      params.keys = null;
      newargs.unshift(this, this._viewDidRespond, target, action);
      req = SC.Request.postUrl(this.urlFor(ddoc, viewname) + "?" + jQuery.param(params)).json();
      req.notify.apply(req, newargs).send(body);
    }
    else { // we can suffice with a getUrl
      url = opts ? this.urlFor(ddoc, viewname) + "?" + jQuery.param(opts): this.urlFor(ddoc, viewname);
      newargs.unshift(this, this._viewDidRespond, target, action);
      req = SC.Request.getUrl(url).json();
      req.notify.apply(req, newargs).send(); // this way, because we need a correct this reference
    }
  },

  _viewDidRespond: function (result, target, action) {
    var newargs = SC.A(arguments).slice(2);
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      newargs.unshift(target, action, null, result.get('body'));
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      newargs.unshift(target, action, Couch.ERROR_RETRIEVINGVIEW, result);
      Couch.callNotifier.apply(this, newargs);
    }
  },

  /*
   either changes(notifier) or changes(opts, notifier)
   opts: {
     longPoll: true, // if you want long polling, set this to true, default is one time
     pollInterval: 30, // interval in seconds if you set longPoll
     opts: { // options for the changes feed itself, such as include_docs
        since: 42,
        include_docs: false
     }
   }

   to stop a long polling changes feed, call stopChanges

   pass through options are only supported on non-long-polling changes requests
  */
  changes: function (opts, target, action) {
    var url = this.urlFor('_changes');
    var newopts, args, newargs, req;
    if (opts && !action) {
      action = target;
      target = opts;
      opts = null;
    }
    if (opts && opts.longPoll) { // setup long poll
      newopts = {};
      if (opts.opts) newopts.params = opts.opts;
      if (opts.pollInterval) newopts.timeout = opts.pollInterval * 1000;
      Couch.longPollManager.registerPoll(url, this, '_changesDidRespond', target, action, newopts);
    }
    else {
      args = SC.A(arguments);
      newargs = opts ? args.slice(3): args.slice(2);
      url = (opts && opts.opts) ? url + "?" + jQuery.param(opts.opts): url;
      newargs.unshift(this, this._changesDidRespond, target, action);
      req = SC.Request.getUrl(url).json();
      req.notify.apply(req, newargs).send();
    }
  },

  _changesDidRespond: function (response, target, action) {
    var status = response.get('status');
    var args = SC.A(arguments), newargs = args.slice(3);
    if (!this._hasValidAuth.apply(this, args)) {
      if (status === 404 || status === 403 || status === 402 || status === 401) { // if 404, don't retry
        return false;
      }
    }
    var list = response.get('body');
    if (SC.ok(response)) {
      // send list
      newargs.unshift(target, action, null, list);
      Couch.callNotifier.apply(this, newargs);
    }
    else {
      //window.RESPONSE = response;
      SC.Logger.log("response.get('status'): " + response.get('status'));
      newargs.unshift(target, action, Couch.ERROR_CHANGES, response);
      Couch.callNotifier.apply(this, newargs);
      return false; // we don't want to continue with the polling, in case of an error..
      // for the moment, it should continue... In the end this breaking off should be configurable.. but why should it continue..
    }
    return true; // normally return true in case we are called from a long polling request
  },

  stopChanges: function () {
    Couch.longPollManager.removePoll(this.urlFor('_changes'));
  },

  all: function (opts, target, action) {
    if (opts && !action) {
      action = target;
      target = opts;
      opts = null;
    }
    var url = opts ? this.urlFor('_all_docs?' + jQuery.param(opts)): this.urlFor('_all_docs');
    SC.Request.getUrl(url).json()
      .notify(this, this._allDidRespond, target, action).send();
  },

  _allDidRespond: function (result, target, action) {
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      Couch.callNotifier(target, action, null, result.get('body'));
    }
    else {
      Couch.callNotifier(target, action, Couch.ERROR_RETRIEVEALL, result);
    }
  },

  /**
    idData: hash with id and _rev, could be doc
    attachmentData: hash with name, 'content-type', and body
    the body should contain the actual file data
  */
  saveAttachment: function (idData, attachmentData, target, action) {
    if (!idData._id || !idData._rev) {
      Couch.callNotifier(target, action, new Error("No _id or _rev in data!"));
      return;
    }
    if (!attachmentData.name || !attachmentData['content-type'] || !attachmentData.body) {
      Couch.callNotifier(target, action, new Error("invalid attachment data!"));
      return;
    }
    var args = SC.A(arguments).slice(3);
    var req = SC.Request.putUrl(this.urlFor(idData._id, attachmentData.name) + "?rev=" + idData._rev)
              .header({ 'Content-Type' : attachmentData['content-type'] });
    args.unshift(this, this._saveAttachmentDidRespond, target, action);
    req.notify('progress', this, this._saveAttachmentProgress);
    req.notify.apply(req, args);
    req.send(attachmentData.body);
    return req; // so observers can be attached to listen to progress
  },

  _saveAttachmentDidRespond: function (result, target, action) {
    var args = SC.A(arguments).slice(2);
    if (!this._hasValidAuth(result, target, action)) return;
    if (SC.ok(result)) {
      args.unshift(target, action, null, result.get('body'));
      Couch.callNotifier.apply(this, args);
    }
    else {
      Couch.callNotifier(target, action, new Error('error saving attachment: '), result);
    }
  },

  _saveAttachmentProgress: function () {
    //console.log('_saveAttachmentProgress');
    //console.log(arguments);
  },

  removeAttachment: function (doc, attachmentName, notifier) {
    if (!doc._id || !doc._rev) {
      Couch.callNotifier(notifier, new Error("No _id or _rev in data!"));
      return;
    }
    var args = SC.A(arguments).slice(3);
    var req = SC.Request.deleteUrl(this.urlFor(doc._id, attachmentName) + "?rev=" + doc._rev).json();
    args.unshift(this, this._removeAttachmentDidRespond, notifier);
    req.notify.apply(req, args);
    req.send();
  },

  _removeAttachmentDidRespond: function (result, notifier) {
    var args = SC.A(arguments).slice(2);
    if (!this._hasValidAuth(result, notifier)) return;
    if (SC.ok(result)) {
      args.unshift(notifier, null, result.get('body'));
      Couch.callNotifier.apply(this, args);
    }
    else {
      Couch.callNotifier(notifier, new Error('error removing attachment: '), result);
    }
  }

});