/*globals Couch */

sc_require('database');

Couch.Connection = SC.Object.extend({
  
  prefix: null, // prefix to add in front of db names
  
  defaultResponder: null,
  
  sessionTimeout: 600, // timeout in seconds, same default setting as default couch, 
                        // adjust if your couch has a different setting. The automatic
                        // login checker will check every 1/2 of this time
  
  baseUrl: function(){
    return [this.get('prefix')].join("/");
  }.property('prefix').cacheable(),

  urlFor: function(){
    return [this.get('baseUrl')].concat(SC.A(arguments)).join("/");
  },
  
  database: function(dbname){
    return Couch.Database.create({
      defaultResponder: this.get('defaultResponder'), 
      database: dbname, 
      prefix: this.get('prefix') 
    });
  },
  
  sessionState: function(notifier){
    SC.Request.getUrl(this.urlFor('_session')).json()
      .notify(this,this._sessionStateDidRespond,notifier).send();
  },
  
  _sessionStateDidRespond: function(result,notifier){
    var loggedin = false;
    if(SC.ok(result)){
      var body = result.get('body');
      if(body && body.ok){
        this._username = body.userCtx.name;
        if(this._username) loggedin = body.userCtx;
        if(!this._keepAlive) this._startSessionKeepAlive();
      } 
      this._callNotifier(notifier,null,loggedin);
    }
    else {
      this._callNotifier(notifier,new Error("Problem with authenticating"),result);
    }
  },
  
  /* a successfull login also sets a session checker in motion to keep the session valid*/
  
  login: function(username,password,notifier){
    SC.Logger.log("performing login for " + username);
    var obj = { name: username, password: password };
    SC.Request.postUrl(this.urlFor('_session')).json()
      .notify(this,this._notifyLoginDidRespond,notifier)
      .send(obj);
    this._username = username;    
  },
  
  _notifyLoginDidRespond: function(result,notifier){
    if(SC.ok(result)){
      var body = result.get('body');
      if(body && body.ok){
        SC.Logger.log("successfully logged in");
        this._callNotifier(notifier,null,body);
        this._startSessionKeepAlive();
      } 
      else this._callNotifier(notifier,null,body);
    }
    else this._callNotifier(notifier,new Error("Error on login"), result);
  },
  
  _keepAlive: null,
  
  _startSessionKeepAlive: function(){
    var me = this;
    this._keepAlive = SC.Timer.schedule({
      action: function(){
        console.log('sessionKeepAlive....');
        me.sessionState('sessionIsAlive');
      },
      interval: (this.sessionTimeout / 2) * 1000,
      repeats: true
    });
  },
  
  _endSessionKeepAlive: function(){
    if(this._keepAlive) {
      this._keepAlive.invalidate();
      this._keepAlive = null;
    }
  },
  
  logout: function(notifier){
    SC.Request.deleteUrl(this.urlFor("_session")).json()
              .notify(this,this._notifyLogoutDidRespond,notifier)
              .send();
  },
  
  _notifyLogoutDidRespond: function(result,notifier){
    this._endSessionKeepAlive(); // always end heartbeat
    if(SC.ok(result)){
      this._callNotifier(notifier,null,true);
    }
    else {
      this._callNotifier(notifier,new Error("logout error"), result);
    }    
  },
  
  uuids: function(count){ // function to get uuids
    
  },
  
  _callNotifier: function(notifier,err,result){
    var args = SC.A(arguments);
    if(SC.typeOf(notifier) === "string"){
      if(this.defaultResponder){
        this.defaultResponder.sendEvent.apply(this.defaultResponder,arguments); // directly patch
      }
      else throw new Error("Couch.Connection: Notifier is a string, but no defaultResponder defined");
    }
    else if(SC.typeOf(notifier) === "function"){
      notifier.apply(this,args.slice(1));
    }
    else {
      throw new Error('Couch.Connection: Notifier is of a non-supported type');
    }
  }
  
});