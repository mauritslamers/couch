/*globals Couch */

sc_require('database');

Couch.Connection = SC.Object.extend({
  
  prefix: null, // prefix to add in front of db names
  
  defaultResponder: null,
  
  database: function(dbname){
    return Couch.Database.create({
      defaultResponder: this.get('defaultResponder'), 
      database: dbname, 
      prefix: this.get('prefix') 
    });
  },
  
  login: function(username,password,notifier){
    
  },
  
  logout: function(notifier){
    
  },
  
  uuids: function(count){ // function to get uuids
    
  }
  
});