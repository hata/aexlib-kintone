
# aexlib-kintone

[![Build Status](https://travis-ci.org/hata/aexlib-kintone.svg?branch=master)](https://travis-ci.org/hata/aexlib-kintone.svg?branch=master)

JavaScript wrapper library for kintone REST API

This is a helper library to query/update kintone app(table) using the simpler way than the original REST API.


# Usage

Get appId and App info.

```
  var k = aexlib.kintone;

  var app = k.App.getApp();
  // app.appId contains appid which is get from kintone.app.getId()
  
  // Get app list and then return Promise.
  k.App.fetchApps({name:'appName'}).then(function(apps) {
      // apps is an array of k.App instances.
  });
```

Query records.

```
  var k = aexlib.kintone;
  
  var app = k.App.getApp();
  var q = app.select();
  var cond = q.equal('fieldCode', 'foo'); // fieldCode = "foo" is set to query param.
  q.where(q.equal('fieldCode', 'foo')).fetch().then(function(records) {
      // records is an array of k.Record instances.
      for (var i = 0;i < records.length;i++) {
          console.log(records[i].val('fieldCode'));
      }
  });
```

Create a record.

```
   var k = aexlib.kintone;
   
   var app = k.App.getApp();
   var rec = app.newRecord();
   rec.val('fieldCode', 'bar'); // Set a new value.

   // k.Record.prototype.save() send POST request to create a new record
   // when it is a new value(there is no record id.)
   rec.save().then(function(resp) {
       //
   });
```

Update a record.

```
   var k = aexlib.kintone;
   
   var app = k.App.getApp();
   var rec = app.newRecord(event.record);
   rec.val('fieldCode', 'newValue');
   // event.record is an original value and has record id.
   // In this case, save() sends PUT request to update a record.
   rec.save().then(...);
```

Remove a record.

```
  var k = aexlib.kintone;
  
  var app = k.App.getApp();
  var q = app.select();
  var cond = q.equal('fieldCode', 'foo'); // fieldCode = "foo" is set to query param.
  q.where(q.equal('fieldCode', 'foo')).first().then(function(record) {
      if (record) {
          return record.remove(); // Return Promise.
      }
  });
```


