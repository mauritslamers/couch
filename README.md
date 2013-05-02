CouchDB framework for Sproutcore

This framework is a port of a part of the very elegant API from cradle 
(https://github.com/cloudhead/cradle) by Alexis Sellier.

It supports most parts of the API, with the exception of:
- attachments
- autodetecting design document saving
- caching
- changes feed (yet to be implemented)

synopsis
--------

``` js
  var connection = CouchDB.Connection.create({
    defaultResponder: myApp.statechart, // you can set this, and then use strings for the notifier functions
    prefix: '/couch' // in case your couch is not available at the server root.
  });
  var db = connection.database('starwars');

  db.get('vader', function (err, doc) {
      doc.name; // 'Darth Vader'
  });
  
  db.get('vader', 'retrievedDoc'); // this will forward the call to the statechart

  db.save('skywalker', {
      force: 'light',
      name: 'Luke Skywalker'
  }, function (err, res) {
      if (err) {
          // Handle error
      } else {
          // Handle success
      }
  });
  
  db.save('skywalker', {
      force: 'light',
      name: 'Luke Skywalker'
  }, 'documentSaved');
  
```

(For the rest of the API, please consult (https://github.com/cloudhead/cradle) )
