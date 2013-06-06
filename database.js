/*globals Couch */

Couch.Database = SC.Object.extend({

  prefix: null,

  database: null,

  baseUrl: function(){
    return [this.get('prefix'),this.get('database')].join("/");
  }.property('prefix','database').cacheable(),

  urlFor: function(){
    return [this.get('baseUrl')].concat(SC.A(arguments)).join("/");
  },

  _callNotifier: function(notifier,err,result){
    var args = SC.A(arguments);
    if(SC.typeOf(notifier) === "string"){
      if(this.defaultResponder){
        // we cannot patch directly, because statechart#sendEvent only allows for two arguments
        var newargs = [notifier,{ err: err, result: result}, args.splice(3)];
        this.defaultResponder.sendEvent.apply(this.defaultResponder,newargs); // directly patch
      }
      else throw new Error("Couch.Database: Notifier is a string, but no defaultResponder defined");
    }
    else if(SC.typeOf(notifier) === "function"){
      notifier.apply(this,args.slice(1));
    }
    else {
      throw new Error('Couch.Database: Notifier is of a non-supported type');
    }
  },

  _hasValidAuth: function(result,notifier){
    if(result.get('status') === 401){
      var newargs = SC.A(arguments).slice(2).unshift(notifier,new Error("unauthorized"),result);
      this._callNotifier.apply(this,newargs);
      return false;
    }
    else return true;
  },

  exists: function(notifier){
    var req = SC.Request.headUrl(this.get('baseUrl')).json()
      .notify(this,this._existsDidRespond,notifier).send();
  },

  _existsDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    var status = result.get('status');
    switch(status){
      case 404: this._callNotifier(notifier,null,false); break;
      case 200: this._callNotifier(notifier,null,true); break;
      default: this._callNotifier(notifier,new Error('invalid result'),result);
    }
  },

  info: function(notifier){
    var newargs = SC.A(arguments);
    newargs.unshift(this,this._infoDidRespond);
    var req = SC.Request.getUrl(this.get('baseUrl')).json();
    req.notify.apply(req,newargs).send();
  },

  _infoDidRespond: function(result,notifier){
    var newargs = SC.A(arguments).slice(2);
    if(SC.ok(result)){
      newargs.unshift(notifier, null,result.get('body'));
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,result,null);
      this._callNotifier.apply(this,newargs);
    }
  },

  destroy: function(id,notifier){
    SC.Request.deleteUrl(this.get('baseUrl')).json()
      .notify(this,this._destroyDidRespond,notifier).send();
  },

  _destroyDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier, null,result);
    }
    else {
      this._callNotifier(notifier,result,null);
    }
  },

  create: function(notifier){
    SC.Request.putUrl(this.get('baseUrl')).json()
      .notify(this,this._createDidRespond,notifier).send();
  },

  _createDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier, null,result);
    }
    else {
      this._callNotifier(notifier,result,null);
    }
  },

  retrieve: function(id,notifier){ // get should support both id and [id1,id2]
    var keys, newargs, req;
    if(!id || !notifier) throw new Error("Couch.Database#get: Forgot parameters?");

    var getKeys = function(t){
      var type = SC.typeOf(t);
      if(type === "string") return t;
      else if(type === "hash") return t._id;
      else if(type === "object") return t.get('id');
    };

    if(SC.typeOf(id) === "array"){
      keys = id.map(getKeys);
    }
    else keys = getKeys(id);
    if(!keys || (SC.typeOf(keys) === "array" && keys.without(undefined).get('length') === 0)){
      throw new Error("Couch.Database#get: no valid keys found");
    }

    newargs = SC.A(arguments).slice(1);

    if(SC.typeOf(keys) === "array"){ // bulk
      newargs.unshift(this,this._getBulkDidRespond);
      req = SC.Request.postUrl(this.urlFor('_all_docs?include_docs=true')).json();
      req.notify.apply(req,newargs).send({ keys: keys });
    }
    else { // single
      newargs.unshift(this,this._getDidRespond);
      req = SC.Request.getUrl(this.urlFor(keys)).json();
      req.notify.apply(req,newargs).send();
    }
  },

  _getBulkDidRespond: function(result,notifier){
    var args = SC.A(arguments);
    if(!this._hasValidAuth.apply(this,arguments)) return;
    var newargs = args.slice(2);
    if(SC.ok(result)){
      var body = result.get('body');
      newargs.unshift(notifier,null,body.rows);
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error("invalid bulk request"),result);
      this._callNotifier.apply(this,newargs);
    }
  },

  _getDidRespond: function(result,notifier){
    var args = SC.A(arguments);
    if(!this._hasValidAuth.apply(this,arguments)) return;
    var newargs = args.slice(2);
    if(SC.ok(result)){
      var body = result.get('body');
      newargs.unshift(notifier,null,body);
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error('Invalid single request, or doc not found'),null);
      this._callNotifier.apply(this,newargs);
    }
  },

  /* 4 argument scenarios
  A => save: function(id,rec,notifier)
  B => save: function(rec,notifier)
  C => save: function(id,rev,rec,notifier)
  D => save: function([rec1,rec2],notifier)
  */

  save: function(){
    var id,rec,recs,rev,notifier,url,newargs, req;
    var args = SC.A(arguments);
    var firstArgType = SC.typeOf(args[0]);
    var secArgType = SC.typeOf(args[1]);
    if(firstArgType === "string"){
      id = args[0];
      if(secArgType === "hash"){ // scenario A
        rec = args[1];
        notifier = args[2];
        newargs = args.slice(3);
      }
      else if(secArgType === "string"){ // scenario C
        rev = args[1];
        rec = args[2];
        notifier = args[3];
        newargs = args.slice(4);
      }
      url = this.urlFor(id);
      url = rev? url + "?rev=" + rev: url;
      newargs.unshift(this,this._saveDidRespond,notifier);
      req = SC.Request.putUrl(url).json();
      req.notify.apply(req,newargs).send(rec);
    }
    else if(firstArgType === "hash"){ // scenario B
      rec = args[0];
      notifier = args[1];
      newargs = args.slice(2);
      newargs.unshift(this,this._saveDidRespond,notifier);
      req = SC.Request.postUrl(this.get('baseUrl')).json();
      req.notify.apply(req,newargs).send(rec);
    }
    else if(firstArgType === "array"){ // scenario D
      recs = args[0];
      notifier = args[1];
      newargs = args.slice(2);
      newargs.unshift(this,this._saveBulkDidRespond,notifier);
      req = SC.Request.postUrl(this.urlFor('_all_docs')).json();
      req.notify.apply(req,newargs).send({ docs: recs });
    }
  },

  _saveBulkDidRespond: function(result,notifier){
    var args = SC.A(arguments);
    if(!this._hasValidAuth.apply(this,arguments)) return;
    var newargs = args.slice(2);
    if(SC.ok(result)){
      var body = result.get('body');
      newargs.unshift(notifier,null,body.rows);
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error("invalid bulk request while saving"),result);
      this._callNotifier.apply(this,newargs);
    }
  },

  _saveDidRespond: function(result,notifier){
    var args = SC.A(arguments);
    if(!this._hasValidAuth.apply(this,arguments)) return;
    var newargs = args.slice(2);
    if(SC.ok(result)){
      var body = result.get('body');
      newargs.unshift(notifier,null,body);
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error("error while saving"),result);
      this._callNotifier.apply(this,newargs);
    }
  },

  remove: function(id,rev,notifier){
    SC.Request.deleteUrl(this.urlFor(id) + "?rev=" + rev).json()
      .notify(this,this._removeDidRespond,notifier).send();
  },

  _removeDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result.get('body'));
    }
    else {
      this._callNotifier(notifier,new Error("error while deleting"),result);
    }
  },

  // simple view for the moment
  view: function(){
    // id has format designdoc/view
    // needs to become _design/designdoc/_view/view/?opts
    var id, opts, notifier, viewparts,req;
    var ddoc, viewname,url,body,params;
    var args = SC.A(arguments), newargs;
    if(SC.typeOf(args[1]) === "string" || SC.typeOf(args[1]) === 'function'){ // args[1] is notifier
      notifier = args[1];
      id = args[0];
      newargs = args.slice(2); // take remaining as pass through params
    }
    else if(SC.typeOf(args[1]) === 'hash'){
      id = args[0];
      opts = args[1];
      notifier = args[2];
      newargs = args.slice(3);
    }

    viewparts = id.split("/");
    if(!viewparts[0] || !viewparts[1]){
      throw new Error("Couch.Database#view: invalid view id");
    }

    ddoc = "_design/" + viewparts[0];
    viewname = "_view/" + viewparts[1];
    if(opts && opts.keys){// if keys are there, the request needs to be a postUrl
      body = { keys: opts.keys };
      params = SC.copy(opts);
      params.keys = null;
      newargs.unshift(this,this._viewDidRespond,notifier);
      req = SC.Request.postUrl(this.urlFor(ddoc,viewname) + "?" + jQuery.param(params)).json();
      req.notify.apply(req,newargs).send(body);
    }
    else { // we can suffice with a getUrl
      url = opts? this.urlFor(ddoc,viewname) + "?" + jQuery.param(opts): this.urlFor(ddoc,viewname);
      newargs.unshift(this,this._viewDidRespond,notifier);
      req = SC.Request.getUrl(url).json();
      req.notify.apply(req,newargs).send(); // this way, because we need a correct this reference
    }
  },

  _viewDidRespond: function(result,notifier){
    var newargs = SC.A(arguments).slice(2);
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      newargs.unshift(notifier,null,result.get('body'));
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error("error while retrieving view"),result);
      this._callNotifier.apply(this,newargs);
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
  changes: function(opts,notifier){
    var url = this.urlFor('_changes');
    var newopts, args, newargs, req;
    if(opts && !notifier){
      notifier = opts;
      opts = null;
    }
    if(opts && opts.longPoll){ // setup long poll
      newopts = {};
      if(opts.opts) newopts.params = opts.opts;
      if(opts.pollInterval) newopts.timeout = opts.pollInterval * 1000;
      Couch.longPollManager.registerPoll(url,this,'_changesDidRespond',notifier,newopts);
    }
    else {
      args = SC.A(arguments);
      newargs = opts? args.slice(2): args.slice(1);
      url = (opts && opts.opts)? url + "?" + jQuery.param(opts.opts): url;
      newargs.unshift(this,this._changesDidRespond,notifier);
      req = SC.Request.getUrl(url).json();
      req.notify.apply(req,newargs).send();
    }
  },

  _changesDidRespond: function(response,notifier){
    var status = response.get('status');
    var args = SC.A(arguments), newargs = args.slice(2);
    if(!this._hasValidAuth.apply(this,args)){
      if(status === 404 || status === 403 || status === 402 || status === 401){ // if 404, don't retry
        return false;
      }
    }

    var list = response.get('body');
    if(SC.ok(response)){
      // send list
      newargs.unshift(notifier,null,list);
      this._callNotifier.apply(this,newargs);
    }
    else {
      newargs.unshift(notifier,new Error("Error in _changes request"),list);
      this._callNotifier.apply(this,newargs);
    }
    return true; // normally return true in case we are called from a long polling request
  },

  stopChanges: function(){
    Couch.longPollManager.removePoll(this.urlFor('_changes'));
  },

  all: function(opts,notifier){
    if(opts && !notifier){
      notifier = opts;
      opts = null;
    }
    var url = opts? this.urlFor('_all_docs?' + jQuery.param(opts)): this.urlFor('_all_docs');
    SC.Request.getUrl(url).json()
      .notify(this,this._allDidRespond,notifier).send();
  },

  _allDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result.get('body'));
    }
    else {
      this._callNotifier(notifier,new Error("error while retrieving all documents"),result);
    }
  },

  /**
    idData: hash with id and _rev, could be doc
    attachmentData: hash with name, 'content-type', and body
    the body should contain the actual file data
  */
  saveAttachment: function(idData,attachmentData, notifier){
    if(!idData._id || !idData._rev){
      this._callNotifier(notifier, new Error("No _id or _rev in data!"));
      return;
    }
    if(!attachmentData.name || !attachmentData['content-type'] || !attachmentData.body){
      this._callNotifier(notifier, new Error("invalid attachment data!"));
      return;
    }
    var args = SC.A(arguments).slice(3);
    var req = SC.Request.putUrl(this.urlFor(idData._id,attachmentData.name) + "?rev=" + idData._rev)
              .header({ 'Content-Type' : attachmentData['content-type'] });
    args.unshift(this,this._saveAttachmentDidRespond,notifier);
    req.notify.apply(req,args);
    req.send(attachmentData.body);
    return req; // so observers can be attached to listen to progress
  },

  _saveAttachmentDidRespond: function(result, notifier){
    var args = SC.A(arguments).slice(2);
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      args.unshift(notifier,null,result.get('body'));
      this._callNotifier.apply(this,args);
    }
    else {
      this._callNotifier(notifier,new Error('error saving attachment: '), result);
    }
  },

  removeAttachment: function(doc,attachmentName,notifier){
    if(!doc._id || !doc._rev){
      this._callNotifier(notifier, new Error("No _id or _rev in data!"));
      return;
    }
    var args = SC.A(arguments).slice(3);
    var req = SC.Request.deleteUrl(this.urlFor(doc._id,attachmentName) + "?rev=" + doc._rev).json();
    args.unshift(this,this._removeAttachmentDidRespond,notifier);
    req.notify.apply(req,args);
    req.send();
  },

  _removeAttachmentDidRespond: function(result,notifier){
    var args = SC.A(arguments).slice(2);
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      args.unshift(notifier,null,result.get('body'));
      this._callNotifier.apply(this,args);
    }
    else {
      this._callNotifier(notifier,new Error('error removing attachment: '), result);
    }
  }

});