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

});

// extending SC.Request to also include a head call
SC.mixin(SC.Request,{
  headUrl: function(address){
    return this.create().set('address','address').set('type','HEAD');
  }
});

// we have to monkeypatch XHRResponse to allow upload progress
// this is only for sc 1.4.5, as SC master already has a different way of attaching to progress
SC.mixin(SC.XHRResponse.prototype, {
  uploadProgress: function(evt){
    SC.RunLoop.begin();
    var e = evt.originalEvent;
    var done = e.position || e.loaded, total = e.totalSize || e.total;
    e.percentage = (done/total*1000)/10;
    this.get('originalRequest').set('progress',e);
    SC.RunLoop.end();
    //console.log('xhr.upload progress: ' + done + '/' + total + "=" + Math.floor(done/total*1000)/10 + "%");
  },

  invokeTransport: function() {
    var rawRequest, transport, handleReadyStateChange, async, headers;

    rawRequest = this.createRequest();

    // save it
    this.set('rawRequest', rawRequest);

    // configure async callback - differs per browser...
    async = !!this.getPath('request.isAsynchronous') ;
    if (async) {
      if (!SC.browser.msie && !SC.browser.opera ) {
        SC.Event.add(rawRequest, 'readystatechange', this,
                     this.finishRequest, rawRequest) ;
        if(rawRequest.upload){
          console.log('attaching upload.onprogress');
          SC.Event.add(rawRequest.upload, 'progress', this, this.uploadProgress, rawRequest);
          // transport = this;
          // rawRequest.upload.onprogress = function(e){
          //   transport.uploadProgress(e);
          // };

        }
      } else {
        transport=this;
        handleReadyStateChange = function() {
          if (!transport) return null ;
          var ret = transport.finishRequest();
          if (ret) transport = null ; // cleanup memory
          return ret ;
        };
        rawRequest.onreadystatechange = handleReadyStateChange;
        if(rawRequest.upload){
          rawRequest.upload.onprogress = function(e){
            if(!transport) return null;
            var ret = transport.uploadProgress(e);
            if (ret) transport = null;
            return ret;
          };
        }
      }
    }

    // initiate request.
    rawRequest.open(this.get('type'), this.get('address'), async ) ;

    // headers need to be set *after* the open call.
    headers = this.getPath('request.headers') ;
    for (var headerKey in headers) {
      rawRequest.setRequestHeader(headerKey, headers[headerKey]) ;
    }

    // now send the actual request body - for sync requests browser will
    // block here
    rawRequest.send(this.getPath('request.encodedBody')) ;
    if (!async) this.finishRequest() ; // not async

    return rawRequest ;
  },

  finishRequest: function(evt) {
    var rawRequest = this.get('rawRequest'),
        readyState = rawRequest.readyState,
        error, status, msg;

    if (readyState === 4 && !this.get('timedOut')) {
      this.receive(function(proceed) {
        if (!proceed) return ; // skip receiving...

        // collect the status and decide if we're in an error state or not
        status = -1 ;
        try {
          status = rawRequest.status || 0;
        } catch (e) {}

        // if there was an error - setup error and save it
        if ((status < 200) || (status >= 300)) {

          try {
            msg = rawRequest.statusText || '';
          } catch(e2) {
            msg = '';
          }

          error = SC.$error(msg || "HTTP Request failed", "Request", status) ;
          error.set("errorValue", this) ;
          this.set('isError', YES);
          this.set('errorObject', error);
        }

        // set the status - this will trigger changes on relatedp properties
        this.set('status', status);

      }, this);

      // Avoid memory leaks
      if (!SC.browser.msie && !SC.browser.opera) {
        SC.Event.remove(rawRequest, 'readystatechange', this, this.finishRequest);
        if(rawRequest.upload){
          SC.Event.remove(rawRequest.upload, 'progress', this, this.uploadProgress);
        }
      } else {
        rawRequest.onreadystatechange = null;
        if(rawRequest.upload){
          rawRequest.upload.onprogress = null;
        }
      }

      return YES;
    }
    return NO;
  }
});


