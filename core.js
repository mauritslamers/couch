/* globals Couch */

/*
This library exports the following functions:

login: function(username,password,notifier)
uuids: function(count)
logout: function(notifier)
database: function(database)

  retrieve: function(id,notifier)
  retrieve: function([id1,id2],notifier)
  all: function(notifier)
  all: function(opts,notifier)
  save: function(id,rec,notifier)
  save: function(rec,notifier)
  save: function(id,rev,rec,notifier)
  save: function([rec1,rec2],notifier)
  // not copying the save view guessing behaviour!
  create: function(id,rec,notifier)
  destroy: function(notifier)
  remove: function(id,notifier)
  exists: function(notifier)
  view: function(id,notifier)
  view: function(id,opts,notifier) (opts: reduce,group,startkey,endkey)
  //merge: function(id,objtomerge,notifier)
  //changes: function(notifier) // one time
  //changes: function(opts,notifier) //opts: { since: 32 } one time
  //changes: function(opts) // no notifier
  //saveAttachment: function(idData,attachmentData,notifier)
  //getAttachment: function(id,attachmentId,notifier)
  // removeAttachment: function(id,attachmentId,notifier)


  notifier is either a string or a function. If the notifier is a function it will be called,
  if it is a string, it will be sent as an event to the defaultResponder set to the
  defaultResponder property.
  Extra arguments are allowed and are passed on to the notifier all functions.

  If the notifier is a function, the arguments are patched through.
  Because the defaultResponder argument signature is limited by the statechart to a maximum of two arguments
  at the time of writing, the signature is different:
  [eventName]: function( { err: err, result: result }, [array,of,extra,arguments]);


*/

Couch = SC.Object.create({
  ERROR_NOAUTH: SC.Error.desc("No authentication or authentication lost", "Not authenticated", null, -2500),
  ERROR_INVALIDRESULT: SC.Error.desc("Invalid result", "Invalid result", null, -2501),
  ERROR_INVALIDGETPARAMETERS: SC.Error.desc("Missing GET parameters in Couch.Database#retrieve", "Missing GET parameters", null, -2502),
  ERROR_INVALIDBULKREQUEST: SC.Error.desc("invalid bulk request", "invalid bulk request", null, -2503),
  ERROR_DOCNOTFOUND: SC.Error.desc('Invalid single request, or doc not found', "doc not found", null, -2504),
  ERROR_INVALIDBULKSAVEREQUEST: SC.Error.desc("invalid bulk request while saving", "invalid bulk request while saving", null, -2505),
  ERROR_SAVING: SC.Error.desc("Error while saving", "Error while saving", null, -2506),
  ERROR_DELETING: SC.Error.desc("error while deleting", "error while deleting", null, -2507),
  ERROR_INVALIDVIEWID: SC.Error.desc("Invalid view id", "Invalid view id", null, -2508),
  ERROR_RETRIEVINGVIEW: SC.Error.desc("error while retrieving view", "error while retrieving view", null, -2509),
  ERROR_CHANGES: SC.Error.desc("Error in _changes request", "Error in _changes request", null, -2510),
  ERROR_RETRIEVEALL: SC.Error.desc("error while retrieving all documents", "error while retrieving all documents", null, -2511),
  ERROR_LOGOUT: SC.Error.desc("Error while logging out, connection lost?", "Logout error", null, -2512),
  ERROR_INCORRECTPASSWORD: SC.Error.desc("Username or password incorrect", "Login error", null, -2513),
  ERROR_COULDNOTCREATEDB: SC.Error.desc("Couldn't create the database", "Database create error", null, -2514),

  callNotifier: function (target, action, err, result) {
    var newargs;
    //var args = SC.A(arguments), t, m;
    var t, m;

    if (!target && !action) throw new Error('Couch.Connection: Notifier is of a non-supported type');

    if (SC.typeOf(target) === SC.T_FUNCTION && !action) {
      m = target;
      t = this;
      newargs = SC.A(arguments).slice(1);
    }
    else {
      newargs = SC.A(arguments).slice(2);
      t = target;
      m = (SC.typeOf(action) === SC.T_STRING) ? target[action]: action;
    }
    if (t === window && m === undefined) {
      throw new Error("Couch: Undefined method and target is window. This can happen when the action " +
        " is called in a loop (forEach) and no proper this reference is present.");
    }
    if (m === undefined) {
      throw new Error("Couch: Cannot find the method you asked for. Did you make a typo?");
    }
    m.apply(t, newargs);
  }

});

if (!SC.Request.headUrl) {
  // extending SC.Request to also include a head call
  SC.mixin(SC.Request, {
    headUrl: function (address) {
      return this.create().set('address', address).set('type', 'HEAD');
    }
  });
}

// overwrite json encode to allow functions in json
SC.json.encode = function (ret) {
  return JSON.stringify(ret, function (k, v) {
    if (typeof(v) === "function") return v.toString();
    else return v;
  });
};



