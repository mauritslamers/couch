CouchDB framework for Sproutcore

This framework is a port of a part of the very elegant API from cradle 
(https://github.com/cloudhead/cradle) by Alexis Sellier.

It supports most parts of the API, with the exception of:
- attachments
- autodetecting design document saving
- caching

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

Licensed under MIT

Copyright (c) 2013 Maurits Lamers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 