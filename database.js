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
    if(SC.typeOf(notifier) === "string"){
      if(this.defaultResponder){
        this.defaultResponder.sendEvent(notifier,err,result);
      }
      else throw new Error("Couch.Database: Notifier is a string, but no defaultResponder defined");
    }
    else if(SC.typeOf(notifier) === "function"){
      notifier(err,result);
    }
    else {
      throw new Error('Couch.Database: Notifier is of a non-supported type');
    }
  },
  
  _hasValidAuth: function(result,notifier){
    if(result.get('status') === 401){
      this._callNotifier(notifier,new Error("unauthorized"),result);
      return false;
    }
    else return true;
  },

  exists: function(notifier){
    SC.Request.headUrl(this.get('baseUrl')).json()
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
    SC.Request.getUrl(this.get('baseUrl')).json()
      .notify(this,this._infoDidRespond,notifier).send();
  },
  
  _infoDidRespond: function(result,notifier){
    if(SC.ok(result)){
      this._callNotifier(notifier, null,result);
    }
    else {
      this._callNotifier(notifier,result,null);
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
  
  get: function(id,notifier){ // get should support both id and [id1,id2]
    if(!id || !notifier) throw new Error("Couch.Database#get: Forgot parameters?");

    var getKeys = function(t){
      var type = SC.typeOf(t);
      if(type === "string") return t;
      else if(type === "hash") return t._id;
      else if(type === "object") return t.get('id');
    };
    
    var keys;
    if(SC.typeOf(id) === "array"){
      keys = id.map(getKeys);
    }
    else keys = getKeys(id);
    if(!keys || keys.without(undefined).get('length') === 0){
      throw new Error("Couch.Database#get: no valid keys found");
    } 
    
    if(SC.typeOf(keys) === "array"){ // bulk
      SC.Request.postUrl(this.urlFor('_all_docs?include_docs=true')).json()
        .notify(this,this._getBulkDidRespond,notifier)
        .send({ keys: keys });
    }
    else { // single
      SC.Request.getUrl(this.urlFor(keys)).json()
          .notify(this,this._getDidRespond,notifier).send();
    }
  },
  
  _getBulkDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;   
    if(SC.ok(result)){
      var body = result.get('body');
      this._callNotifier(notifier,null,body.rows);
    }
    else {
      this._callNotifier(notifier,new Error("invalid bulk request"),result);
    }
  },
  
  _getDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      var body = result.get('body');
      this._callNotifier(notifier,null,body);
    }
    else { 
      this._callNotifier(notifier,new Error('Invalid single request, or doc not found'),null);
    }
  },
  
  /*
  save: function(id,rec,notifier)
  save: function(rec,notifier)
  save: function(id,rev,rec,notifier)
  save: function([rec1,rec2],notifier)
  */
  
  save: function(){
    var id,rec,rev,notifier,url;
    switch(arguments.length){
      case 2: id = arguments[0]; notifier = arguments[1]; break;
      case 3: id = arguments[0]; rec = arguments[1]; notifier = arguments[2]; break;
      case 4: id = arguments[0]; rev = arguments[1]; rec = arguments[2]; notifier = arguments[3]; break;
      default: throw new Error("Too few or too many arguments to Couch.Database#save");
    }
    if(SC.typeOf(id) === "array"){ // only with two arguments, bulk
      SC.Request.postUrl(this.urlFor('_all_docs')).json()
        .notify(this,this._saveBulkDidRespond,notifier)
        .send({
          docs: id
        });
    }
    else {
      if(SC.typeOf(id) === "hash"){ // two arguments, let couch assign
        SC.Request.postUrl(this.get('baseUrl')).json()
          .notify(this,this._saveDidRespond,notifier)
          .send(id);
      }
      else { // 3 or 4 args
        url = this.urlFor(id);
        url = rev? url + "?rev=" + rev: url;
        SC.Request.putUrl(url).json()
          .notify(this,this._saveDidRespond,notifier)
          .send(rec);
      }
    }
  },
  
  _saveBulkDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result);
    }
    else {
      this._callNotifier(notifier,new Error("error while saving"),result);
    }
  },
  
  _saveDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result);
    }
    else {
      this._callNotifier(notifier,new Error("error while saving"),result);
    }    
  },
  
  remove: function(id,rev,notifier){
    SC.Request.deleteUrl(this.urlFor(id) + "?rev=" + rev).json()
      .notify(this,this._removeDidRespond,notifier).send();
  },
  
  _removeDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result);
    }
    else {
      this._callNotifier(notifier,new Error("error while deleting"),result);
    }
  },
  
  // simple view for the moment
  view: function(id,opts,notifier){
    // id has format designdoc/view
    // needs to become _design/designdoc/_view/view/?opts
    var ddoc, viewname,url,body,params;
    var viewparts = id.split("/");
    if(!viewparts[0] || viewparts[1]){
      throw new Error("Couch.Database#view: invalid view id");
    }
    if(!notifier && opts){
      notifier = opts;
      opts = null;
    }
    
    ddoc = "_design/" + viewparts[0];
    viewname = "_view/" + viewparts[1];
    if(opts.keys){// if keys are there, the request needs to be a post
      body = { keys: opts.keys };
      params = SC.copy(opts);
      delete params.keys;
      SC.Request.postUrl(this.urlFor(ddoc,viewname) + "?" + jQuery.param(params)).json()
        .notify(this,this._viewDidRespond,notifier).send(body);
    } 
    else { // we can suffice with a get
      SC.Request.getUrl(this.urlFor(ddoc,viewname) + "?" + jQuery.param(opts)).json()
        .notify(this,this._viewDidRespond,notifier).send();
    }
  },
  
  _viewDidRespond: function(result,notifier){
    if(!this._hasValidAuth(result,notifier)) return;
    if(SC.ok(result)){
      this._callNotifier(notifier,null,result);
    }
    else {
      this._callNotifier(notifier,new Error("error while retrieving view"),result);
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
   
  */
  changes: function(opts,notifier){
    var url = this.urlFor('_changes');
    var newopts;
    if(opts && !notifier){
      notifier = opts;
      opts = null;
    }
    if(opts && opts.longPoll){ // setup long poll
      newopts = {};
      if(opts.opts) newopts.opts = opts.opts;
      if(opts.pollInterval) newopts.timeout = opts.pollInterval * 1000;  
      Couch.longPollManager.registerPoll(url,this,'_changesDidRespond',notifier,newopts);
    }
    else {
      url = (opts && opts.opts)? url + "?" + jQuery.param(opts.opts): url;
      SC.Request.getUrl(url).json()
        .notify(this,this._changesDidRespond,notifier).send();
    }
  },
  
  _changesDidRespond: function(response,notifier){
    var status = response.get('status');
    if(!this._hasValidAuth(response,notifier)){
      if(status === 404 || status === 403 || status === 402 || status === 401){ // if 404, don't retry
        return false;
      }      
    }

    var list = response.get('body');
    if(SC.ok(response)){
      // send list
      this._callNotifier(notifier,null,list);
    }
    else {
      this._callNotifier(notifier,new Error("Error in _changes request"),list);
    }
    return true; // normally return true in case we are called from a long polling request
  },
  
  stopChanges: function(){
    Couch.longPollManager.removePoll(this.urlFor('_changes'));
  }
  
});