/*globals CouchDB */

sc_require('database');

CouchDB.Connection = SC.Object.extend({
  
  prefix: null, // prefix to add in front of db names
  
  defaultResponder: null,
  
  database: function(dbname){
    return CouchDB.Database.create({ 
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