/*globals Couch */

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
  Both the defaultResponder as well as the function should accept (err,result) as arguments
  
  Extra arguments are allowed and are passed on to the notifier for the following functions:
  - receive 
  - info

*/

// extending SC.Request to also include a head call
SC.mixin(SC.Request,{
  headUrl: function(address){
    return this.create().set('address','address').set('type','HEAD');
  }
});


Couch = SC.Object.create({
  
  
});