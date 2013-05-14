/*globals Couch */

/**
  Poll manager - initiates poll requests every N periods or when the
  request returns, whichever comes first.  Call start() to begin the
  process, stop() to cancel it.  The method handleChanges() must know
  how to process info from the poll request.
  
  The poller will automatically call the callback on every poll, unless
  there was a time out. The callback should return true when the poll
  can continue, or false when the polling should halt.
*/

Couch.LongPoller = SC.Object.extend({
  
  url: null, // url to db or view
  
  target: null,
  
  method: null,
  
  opts: null,
  
  notifier: null,
  
  timeout: 30000,
  
  init: function(){
    if(!this.url || !this.target || !this.method){
      throw new Error("invalid longPoll request");
    }   
    if(this.opts){
      if(this.opts.since){
        this._since = this.opts.since;
      }
      // timeout has already been set, and should not be forwarded to couch
      if(this.opts.timeout) delete this.opts.timeout; 
    }
    this._pollRequest = this.createPollRequest();
  },
  
  createPollRequest: function(){
    var params = this.opts && this.opts.params? this.opts.params : { feed: 'longpoll' };
    var url = this.url;
    if(!url) throw new Error("Couch.LongPoll: no url given to poll");
    if(this._since){
      if(!params) params = {};
      else {
        params.since = this._since;
      }
    } 
    if(!params.feed) params.feed = 'longpoll'; // make sure that we are doing longpolling
    url += "?" + jQuery.param(params);
    return SC.Request.getUrl(url).json().notify(this,'pollDidRespond',this.opts);
  },
  
  start: function() {
    if (!this._running) {
      this._running = true;
      this.poll(); // initiate a poll
    }
  },  
  
  // starts a new poll immediately - canceling any outstanding
  poll: function() {
    //debugger;
    // cancel outstanding
    if (this._request){
      this._request.cancel();
      this._request.destroy();
    } 
    if (this._timer){
      this._timer.invalidate();
      this._timer = null;
    } 

    // start new request to server;
    if(this._pollRequest && this._pollRequest.destroy) this._pollRequest.destroy(); // prevent memory leak
    this._pollRequest = this.createPollRequest();    
    this._request = this._pollRequest.send();

    // set timeout to restart poll in 5 sec no matter what
    this._timer = this.invokeLater(this.poll, this.timeout);
  },
 
  stop: function() {
    if (this._running) {
      this._running = false;
 
      // cancel any outstanding request.  aborts the XHR
      if (this._request) this._request.cancel();
  
      // clear any timer too
      if (this._timer) this._timer.invalidate();
 
      this._timer = this._request = null;
    }
  },
 
  // called by the request when it returns
  pollDidRespond: function(response,opts) {
    
    // always
    var m, status = response.get('status'), shouldContinue;
    
    if(SC.typeOf(this.method) === "string"){
      m = this.target[this.method];
    }
    else m = this.method;
    shouldContinue = m.call(this.target,response,this.notifier);

    if(shouldContinue){
      if (SC.ok(response)){
        var body = response.get('body');
        if(body.last_seq) this._since = body.last_seq; // update since
      } //this.handleChanges(response);
      this.poll();
    }
    else {
      this.stop();
    }
  }
});

Couch.longPollManager = SC.Object.create({
  
  polls: null,
  
  init: function(){
    this.polls = {};
  },
  
  registerPoll: function(url,target,method,notifier,opts){
    if(this.polls[url]) return false; // don't re-register
    var timeout = opts? opts.timeout || 30000: 30000;
    this.polls[url] = Couch.LongPoller.create({
      url: url, target: target, method: method, timeout: timeout, opts: opts, notifier: notifier
    });
    this.polls[url].start();
  },
  
  removePoll: function(url){
    this.stopPoller(url);
    delete this.polls[url];
  },
  
  removeAll: function(){
    if(this.polls){
      for(var i in this.polls){
        this.removePoll(i);
      }
    }
  },
  
  getPollFor: function(url){
    return this.polls[url];
  },
  
  stopPoller: function(url){
    if(this.polls[url]) this.polls[url].stop();
  },
  
  startPoller: function(url){
    if(this.polls[url]) this.polls[url].start();
  }
  
});
