/*
The MIT License (MIT)

Copyright (c) 2015 hata

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
*/

describe("aexlib.kintone tests", function() {
  var k = aexlib.kintone;
  var a;
  var q;

  beforeEach(function() {
    a = k.App.getApp('1');
    q = a.select();
  });

  it("aexlib.kintone._reject returns Promise to return reject result.", function(done) {
    k._reject('Failed').then(function() {}, function(message) {
      expect(message).toEqual('Failed');
      done();
    });
  });

  it("aexlib.kintone.App.getApp returns a current app's App instance.", function() {
    spyOn(kintone.app, 'getId').and.callFake(function() {
      return 'currentId';
    });

    expect(k.App.getApp().appId).toEqual('currentId');
  });

  it("aexlib.kintone.App.getApp(appId) returns the argument's App instance.", function() {
    expect(k.App.getApp('appId').appId).toEqual('appId');
  });


  it("aexlib.kintone.App.fetchApps", function(done) {
    var result = {
      apps: [
        { app: '1' },
        { app: '2' }
      ]
    };

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/apps');
      expect(request).toEqual('GET');
      expect(params.limit).toEqual(100);
      expect(params.offset).toEqual(0);
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.fetchApps().then(function(apps) {
      expect(apps[0].appId).toEqual(result.apps[0].app);
      expect(apps[1].appId).toEqual(result.apps[1].app);
      expect(apps[0].app).toBeDefined();
      expect(apps[1].app).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchApps calls reject function when it failed.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/apps');
      return new Promise(function(resolve, reject) { reject({message: 'failed'}); });
    });

    k.App.fetchApps().then(function() {}, function(message) {
      expect(message).toEqual('failed');
      done();
    });
  });

  it("aexlib.kintone.App.fetchApps calls reject and may return Unknown error function when it failed.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/apps');
      return new Promise(function(resolve, reject) { reject({}); });
    });

    k.App.fetchApps().then(function() {}, function(message) {
      expect(message).toEqual('Unknown error');
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can call more than limit and return as an array.", function(done) {
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result' };
    var result;
    var i;

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/url');
      expect(request).toEqual('GET');
      result = [];
      if (params.offset === 0) {
          for (i = 0;i < 100;i++) {
              result.push({ id: i });
          }
      } else {
          result.push({ id: params.offset });
      }
      return new Promise(function(resolve, reject) { resolve({result: result}); });
    });

    k._recursiveFetch(fetchParams).then(function(resp) {
      expect(resp.length).toEqual(101);
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can set the number of the max entries.", function(done) {
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result', max: 2 };
    var result;
    var i;

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/url');
      expect(request).toEqual('GET');
      expect(params.limit).toEqual(2);
      result = [];
      if (params.offset === 0) {
          for (i = 0;i < 2;i++) {
              result.push({ id: i });
          }
      } else {
          throw new Error('This should not be called.');
      }
      return new Promise(function(resolve, reject) { resolve({'result': result}); });
    });

    k._recursiveFetch(fetchParams).then(function(resp) {
      expect(resp.length).toEqual(2);
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can set the number of the max entries for more than 100 entries.", function(done) {
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result', max: 101 };
    var result;
    var i;

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/url');
      expect(request).toEqual('GET');
      result = [];
      if (params.offset === 0) {
          expect(params.limit).toEqual(100);
          for (i = 0;i < 100;i++) {
              result.push({ id: i });
          }
      } else if (params.offset === 100) {
          expect(params.limit).toEqual(1);
          for (i = 100;i < 101;i++) {
              result.push({ id: i });
          }
      } else {
          throw new Error('This should not be called.');
      }
      return new Promise(function(resolve, reject) { resolve({'result': result}); });
    });

    k._recursiveFetch(fetchParams).then(function(resp) {
      expect(resp.length).toEqual(101);
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can set additional params.", function(done) {
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result', params: { name: 'foo' } };

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.name).toEqual('foo');
      return new Promise(function(resolve, reject) { resolve({result: {id: '1'}}); });
    });

    k._recursiveFetch(fetchParams).then(function(resp) {
      done();
    });
  });

  it("aexlib.kintone._recursiveUpdate can update more than 100 records.", function(done) {
    var updateParams = k.Record._getCreateParams();
    var records = [
      a.newRecord({foo:{value:'bar'}}),
      a.newRecord({foo:{value:'hoge'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual([{foo:{value:'bar'}},{foo:{value:'hoge'}}]);
      return new Promise(function(resolve, reject) { resolve({ids:['1','2'], revisions:['3','4']}); });
    });

    k._recursiveUpdate(updateParams, records).then(function(resp) {
      expect(resp.ids).toEqual(['1', '2']);
      expect(resp.revisions).toEqual(['3','4']);
      done();
    });
  });

  it("aexlib.kintone._recursiveUpdate uses separate updates for different appIds.", function(done) {
    var a2 = k.App.getApp('2');
    var updateParams = k.Record._getUpdateParams();
    var records = [
       a.newRecord({foo:{value:''}, '$id':{value:'1'}}),
       a.newRecord({foo:{value:''}, '$id':{value:'2'}}),
      a2.newRecord({foo:{value:''}, '$id':{value:'3'}}),
      a2.newRecord({foo:{value:''}, '$id':{value:'4'}})
    ];
    records = records.map(function(record) {record.val('foo', 'hoge'); return record;});
    var result1 = {records:[{id:'1', revision:'5'}, {id:'2', revision:'6'}]};
    var result2 = {records:[{id:'3', revision:'7'}, {id:'4', revision:'8'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('PUT');
      if (params.app === '1') {
         expect(params.records).toEqual([{id:1, record:{foo:{value:'hoge'}}},{id:2, record:{foo:{value:'hoge'}}}]);
         return new Promise(function(resolve, reject) { resolve(result1); });
      } else if (params.app === '2') {
         expect(params.records).toEqual([{id:3, record:{foo:{value:'hoge'}}},{id:4, record:{foo:{value:'hoge'}}}]);
         return new Promise(function(resolve, reject) { resolve(result2); });
      } else {
         expect('This should not be called').toBe();
      }
    });

    k._recursiveUpdate(updateParams, records, false).then(function(resp) {
      expect(resp.records.length).toEqual(4);
      expect(resp.records[0]).toEqual({id:'1', revision:'5'});
      expect(resp.records[1]).toEqual({id:'2', revision:'6'});
      expect(resp.records[2]).toEqual({id:'3', revision:'7'});
      expect(resp.records[3]).toEqual({id:'4', revision:'8'});
      done();
    });
  });


  it("aexlib.kintone.App.fetchApp fetch app info and return Promise.", function(done) {
    var app = k.App.getApp('1');
    expect(app.app).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('1');
      return new Promise(function(resolve) { resolve({appId: '1'}); });
    });

    app.fetchApp().then(function(info) {
      expect(info.appId).toEqual('1');
      expect(app.app).toBeDefined();
      done();
    });
  });


  it("aexlib.kintone.App.fetchApp may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.app).toBeUndefined();
  
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchApp().then(function() {}, function(error) {
      expect(error).toEqual('failed');
      expect(app.app).toBeUndefined();
      done();
    });
  });


  it("aexlib.kintone.App.fetchFields fetch field properties info and return Promise.", function(done) {
    var app = k.App.getApp('1');
    expect(app.fields).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/form/fields');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('1');
      expect(params.lang).toEqual('default');
      return new Promise(function(resolve) { resolve({properties: { 'foo': {code:'foo'} } }); });
    });

    app.fetchFields().then(function(info) {
      expect(app.fields).toBeDefined();
      expect(app.fields.properties.foo.code).toEqual('foo');
      done();
    });
  });


  it("aexlib.kintone.App.fetchFields fetch field properties info and return Promise.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      return new Promise(function(resolve) { resolve({properties: { 'foo': {code:'foo'} } }); });
    });

    app.fetchFields({preview:true}).then(function(info) {
      expect(app.fields.properties.foo.code).toEqual('foo');
      done();
    });
  });


  it("aexlib.kintone.App.fetchFields may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.fields).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchFields().then(function() {}, function(error) {
      expect(error).toEqual('failed');
      expect(app.fields).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.newRecord creates a new Record instance.", function() {
    expect(a.newRecord({foo:{value:'bar'}}).val('foo')).toEqual('bar');
  });

  it("aexlib.kintone.Query.first fetch a record and then return Promise.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 1 offset 0');
      expect(params.app).toEqual('1');
      expect(params.fields).toBeUndefined();
      return new Promise(function(resolve) { resolve({records: [ { 'foo': {code:'foo'} } ] }); });
    });

    app.first().then(function(record) {
      expect(record.record.foo.code).toEqual('foo');
      done();
    });
  });

  it("aexlib.kintone.Query.first fetch records and then return Promise.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 3 offset 0');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve({records: [
          { 'foo' : {code:'foo'} },
          { 'bar' : {code:'bar'} },
          { 'hoge': {code:'hoge'} }
        ] }); });
    });

    app.first(3).then(function(records) {
      expect(records[0].record.foo.code).toEqual('foo');
      expect(records[1].record.bar.code).toEqual('bar');
      expect(records[2].record.hoge.code).toEqual('hoge');
      done();
    });
  });


  it("aexlib.kintone.Query.first returns undefined when limit is 1.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.query).toEqual('limit 1 offset 0');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    app.first(1).then(function(record) {
      expect(record).toBeUndefined();
      done();
    });
  });


  it("aexlib.kintone.Query.first fetch blank array when limit is 2 or more than 2.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.query).toEqual('limit 3 offset 0');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    app.first(3).then(function(records) {
      expect(records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.App.select can start query.", function() {
    var app = k.App.getApp('1');
    var q = app.select();
    expect(q.app).toEqual(app);
    expect(q._fields).toBeUndefined();
  });

  it("aexlib.kintone.App.where can start query.", function() {
    var app = k.App.getApp('1');
    var q = app.where('code = "foo"');
    expect(q.app).toEqual(app);
    expect(q._qParams.pop()).toEqual('code = "foo"');
  });

  it("aexlib.kintone.App.order can start query with order by param.", function() {
    var app = k.App.getApp('1');
    var q = app.order('code asc');
    expect(q._buildQuery()).toEqual('order by code asc');
  });

  it("aexlib.kintone.Query.select can set fields using a string.", function() {
    var q = k.App.getApp('1').select('foo');
    expect(q._fields).toEqual(['foo']);
  });

  it("aexlib.kintone.Query.select can set fields using an array.", function() {
    var q = k.App.getApp('1').select(['foo', 'bar']);
    expect(q._fields).toEqual(['foo', 'bar']);
  });

  it("aexlib.kintone.Query.select set fields params for kintone.api.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.fields).toEqual(['foo']);
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    k.App.getApp('1').select(['foo']).first().then(function(record) {
      done();
    });
  });

  it("aexlib.kintone.Query.select can set a string field code.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.fields).toEqual(['foo']);
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    k.App.getApp('1').select('foo').first().then(function(record) {
      done();
    });
  });

  it("aexlib.kintone.Query.where can set string.", function() {
    expect(q.where('code = "foo"')._qParams.pop()).toEqual('code = "foo"');
  });

  it("aexlib.kintone.Query.where can set condition.", function() {
    expect(q.where(q.notEqual('code', 'foo'))._qParams.pop()).toEqual('code != "foo"');
  });

  it("aexlib.kintone.Query.where throws Error for a wrong argument.", function() {
    try {
      q.where(1);
      expect(1).toEqual(0); // Should fail.
    } catch (e) {
      // A correct behavior.
    }
  });

  it("aexlib.kintone.Query.order can set order by.", function() {
    expect(q.order("code asc")._buildQuery()).toEqual('order by code asc');
  });

  it("aexlib.kintone.Query.order can set order by for several field codes.", function() {
    expect(q.order("foo asc, bar desc")._buildQuery()).toEqual('order by foo asc, bar desc');
  });

  it("aexlib.kintone.Query.orderAsc can set order by foo asc.", function() {
    expect(q.orderAsc("foo")._buildQuery()).toEqual('order by foo asc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    expect(q.orderDesc("foo")._buildQuery()).toEqual('order by foo desc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    expect(q.orderAsc('foo').orderDesc('bar')._buildQuery()).toEqual('order by foo asc, bar desc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    var stmt = q.select().where(q.equal('foo', 'bar')).orderAsc('foo').orderDesc('bar')._buildQuery();
    expect(stmt).toEqual('foo = "bar" order by foo asc, bar desc');
  });

  it("aexlib.kintone.Query.limit and offset is added at the end of query param.", function() {
    var stmt = q.where(q.equal('foo', 'bar').lessThan('foo', 'hoge')).orderAsc('foo').limit(5).offset(1)._buildQuery();
    expect(stmt).toEqual('foo = "bar" and foo < "hoge" order by foo asc limit 5 offset 1');
  });

  it("aexlib.kintone.Query.offset can set an offset value", function() {
    expect(q.offset(1)._buildQuery()).toEqual('offset 1');
  });

  it("aexlib.kintone.Query.Condition._escapeValue returns a value which may escape quote chars.", function() {
    expect(k.Query.Condition._escapeValue('code', 'foo')).toEqual('"foo"');
    expect(k.Query.Condition._escapeValue('code', 1)).toEqual('"1"');
    expect(k.Query.Condition._escapeValue('code', 'foo"bar"')).toEqual('"foo\\"bar\\""');
  });

  it("aexlib.kintone.Query.Condition._toQueryValue returns a quote and escaped value.", function() {
    expect(k.Query.Condition._toQueryValue('code', 'foo')).toEqual('"foo"');
    expect(k.Query.Condition._toQueryValue('code', 'foo"bar"')).toEqual('"foo\\"bar\\""');
  });

  it("aexlib.kintone.Query.Condition._toQueryValue returns a function if Query.Constant is set.", function() {
    expect(k.Query.Condition._toQueryValue('code', k.Query.LOGINUSER)).toEqual('LOGINUSER()');
    expect(k.Query.Condition._toQueryValue('code', k.Query.NOW)).toEqual('NOW()');
    expect(k.Query.Condition._toQueryValue('code', k.Query.TODAY)).toEqual('TODAY()');
    expect(k.Query.Condition._toQueryValue('code', k.Query.THIS_MONTH)).toEqual('THIS_MONTH()');
    expect(k.Query.Condition._toQueryValue('code', k.Query.LAST_MONTH)).toEqual('LAST_MONTH()');
    expect(k.Query.Condition._toQueryValue('code', k.Query.THIS_YEAR)).toEqual('THIS_YEAR()');
  });

  it("aexlib.kintone.Query._toOperatorQuery set query params and then return Query instance.", function() {
    expect(new k.Query.Condition()._addOperatorQuery('code', 'op', '"foo')._qParams.pop()).toEqual('code op "\\"foo"');
  });

  it("aexlib.kintone.Query.equal set operator = to query.", function() {
    expect(q.equal('code', 'foo')._qParams.pop()).toEqual('code = "foo"');
  });

  it("aexlib.kintone.Query.notEqual set operator != to query.", function() {
    expect(q.notEqual('code', 'foo')._qParams.pop()).toEqual('code != "foo"');
  });

  it("aexlib.kintone.Query.greaterThan set operator > to query.", function() {
    expect(q.greaterThan('code', 'foo')._qParams.pop()).toEqual('code > "foo"');
  });

  it("aexlib.kintone.Query.lessThan set operator < to query.", function() {
    expect(q.lessThan('code', 'foo')._qParams.pop()).toEqual('code < "foo"');
  });

  it("aexlib.kintone.Query.greaterEqual set operator >= to query.", function() {
    expect(q.greaterEqual('code', 'foo')._qParams.pop()).toEqual('code >= "foo"');
  });

  it("aexlib.kintone.Query.lessEqual set operator <= to query.", function() {
    expect(q.lessEqual('code', 'foo')._qParams.pop()).toEqual('code <= "foo"');
  });

  it("aexlib.kintone.Query.inList set operator in to query.", function() {
    expect(q.inList('code', ['foo', 'bar'])._qParams.pop()).toEqual('code in ("foo","bar")');
  });

  it("aexlib.kintone.Query.inList set operator in to query.", function() {
    expect(q.inList('code', 'foo')._qParams.pop()).toEqual('code in ("foo")');
  });

  it("aexlib.kintone.Query.notInList set operator not in to query.", function() {
    expect(q.notInList('code', ['foo', 'bar'])._qParams.pop()).toEqual('code not in ("foo","bar")');
  });

  it("aexlib.kintone.Query.notInList set operator not in to query.", function() {
    expect(q.notInList('code', 'foo')._qParams.pop()).toEqual('code not in ("foo")');
  });

  it("aexlib.kintone.Query.like set operator like to query.", function() {
    expect(q.like('code', 'foo')._qParams.pop()).toEqual('code like "foo"');
  });

  it("aexlib.kintone.Query.notLike set operator 'not like' to query.", function() {
    expect(q.notLike('code', 'foo')._qParams.pop()).toEqual('code not like "foo"');
  });

  it("aexlib.kintone.Query.or set operator 'or' to query.", function() {
    expect(q.equal('code', 'foo').or().equal('code2', 'bar').toString()).toEqual('code = "foo" or code2 = "bar"');
  });

  it("aexlib.kintone.Query.or set operator 'or' to query.", function() {
    expect(q.equal('code', 'foo').or(q.equal('code2', 'bar')).toString()).toEqual('code = "foo" or (code2 = "bar")');
  });

  it("aexlib.kintone.Query.and set operator 'and' to query.", function() {
    expect(q.equal('code', 'foo').and().equal('code2', 'bar').toString()).toEqual('code = "foo" and code2 = "bar"');
  });

  it("aexlib.kintone.Query.and set operator 'and' to query.", function() {
    expect(q.equal('code', 'foo').and(q.equal('code2', 'bar')).toString()).toEqual('code = "foo" and (code2 = "bar")');
  });

  it("aexlib.kintone.Query.Condition is used a container for conditions.", function() {
    expect(q.cond('code = "foo"').toString()).toEqual('(code = "foo")');
  });

  it("aexlib.kintone.Query.Condition can handle other Condition instances.", function() {
    expect(q.cond(q.equal('code', 'foo')).toString()).toEqual('(code = "foo")');
  });

  it("aexlib.kintone.Query.Condition  .", function() {
    var c = q.cond(q.equal('code', 'foo').equal('code2', 'bar')).equal('code3', 'hoge').toString();
    expect(c).toEqual('(code = "foo" and code2 = "bar") and code3 = "hoge"');
  });

  it("aexlib.kintone.Query.Condition.and can add bracket.", function() {
    var c = q.equal('code', 'foo').and(q.equal('code2', 'bar').equal('code3', 'hoge')).toString();
    expect(c).toEqual('code = "foo" and (code2 = "bar" and code3 = "hoge")');
  });

  it("aexlib.kintone.Query.Condition operators can set Record instance instead of a value.", function() {
    var r = new k.Record(a, {foo:{value:'bar'}});
    expect(q.greaterThan('foo', r).toString()).toEqual('foo > "bar"');
  });

  it("aexlib.kintone.Query.Condition list operators can set Record instance instead of a value.", function() {
    var r = new k.Record(a, {foo:{value:'bar'}});
    expect(q.inList('foo', r).toString()).toEqual('foo in ("bar")');
  });

  it("aexlib.kintone.Query.Condition list operators can set Records instead of values.", function() {
    var records = [new k.Record(a, {foo:{value:'bar'}}), new k.Record(a, {foo:{value:'hoge'}})];
    expect(q.inList('foo', records).toString()).toEqual('foo in ("bar","hoge")');
  });

  it("aexlib.kintone.Query.Condition list operators can set list value for Record instance.", function() {
    var r = new k.Record(a, {foo:{value:["bar", "hoge"]}});
    expect(q.notInList('foo', r).toString()).toEqual('foo not in ("bar","hoge")');
  });


  it("aexlib.kintone.Record wrap a record object returned by kintone.", function() {
    expect(new k.Record(a, {}).app).toEqual(a);
    expect(new k.Record(a, { foo:'bar' }).record).toEqual({ foo:'bar' });
  });

  it("aexlib.kintone.Record.val return a value for a field code.", function() {
    var r = new k.Record(a, { foo: { value:'bar' } });
    expect(r.val('foo')).toEqual('bar');
  });

  it("aexlib.kintone.Record.val throws an Error when there is no field code.", function() {
    var r = new k.Record(a, {});
    try {
      r.val('foo');
      expect(1).toEqual(0);
    } catch (e) {
      // This is correct behavior.
    }
  });

  it("aexlib.kintone.Record.val(code, newValue) can set a new value to a record.", function() {
    var r = new k.Record(a, { foo: { value:'bar'} });
    expect(r.val('foo', 'hoge')).toEqual('bar');
    expect(r.val('foo')).toEqual('hoge');
    expect(r.val('foo', 'piyo')).toEqual('hoge');
    expect(r.val('foo')).toEqual('piyo');
  });

  it("aexlib.kintone.Record.val(code, newValue) can set a new number value to a record.", function() {
    var r = new k.Record(a, {foo: {value:'bar', type:'NUMBER'}});
    expect(r.val('foo', 1.5)).toEqual('bar');
    expect(r.val('foo')).toEqual(1.5);
    expect(r.val('foo', '1.5')).toEqual('1.5');
    expect(r.val('foo')).toEqual(1.5);
  });

  it("aexlib.kintone.Record.val(code, newValue) can set a value when there is no record.", function() {
    var r = new k.Record(a, {});
    expect(r.val('foo', 'bar')).toBeUndefined();
    expect(r.val('foo')).toEqual('bar');
  });

  it("aexlib.kintone.Record(app) can create a new Record instance.", function() {
    var r = new k.Record(a);
    r.val('foo', 'bar');
    r.val('hoge', 'piyo');
    expect(r.val('foo')).toEqual('bar');
    expect(r.val('hoge')).toEqual('piyo');
    expect(r.updated).toEqual({ foo:{value:'bar'}, hoge:{value:'piyo'}});
  });

  it("aexlib.kintone.Record.revision returns a revision value.", function() {
    var r = new k.Record(a, { '$revision':{ value:'5' } });
    expect(r.revision()).toEqual(5);
  });

  it("aexlib.kintone.Record.revision(newValue) set a new revision and return old one.", function() {
    var r = new k.Record(a, { '$revision':{ value:'5' } });
    expect(r.revision('6')).toEqual('5');
    expect(r.revision()).toEqual(6);
    expect(r.isUpdated()).toEqual(false);
  });

  it("aexlib.kintone.Record.revision returns undefined when there is no record.", function() {
    var r = new k.Record(a, {});
    expect(r.revision()).toBeUndefined();
  });

  it("aexlib.kintone.Record.revision(newValue) set a new value for null record.", function() {
    var r = new k.Record(a);
    expect(r.revision(0)).toBeUndefined();
    expect(r.revision()).toEqual(0);
  });

  it("aexlib.kintone.Record.isUpdated returns false when there is no update.", function() {
    var r = new k.Record(a, { foo: { value:'bar' } });
    expect(r.isUpdated()).toEqual(false);
  });

  it("aexlib.kintone.Record.isUpdated returns true when there is an update.", function() {
    var r = new k.Record(a, { foo: { value:'bar' } });
    r.val('foo', 'hoge');
    expect(r.isUpdated()).toEqual(true);
    expect(r.updated).toEqual({ foo: { value: 'hoge' } });
  });

  it("aexlib.kintone.Record.recordId returns a default record id value.", function() {
    var record = {};
    record[k.RECORD_ID_CODE] = { value: '0' };
    var r = new k.Record(a, record);
    expect(r.recordId()).toEqual(0);
  });

  it("aexlib.kintone.Record.recordId returns undefined when there is no key.", function() {
    var record = {};
    var r = new k.Record(a, record);
    expect(r.recordId()).toBeUndefined();
  });

  it("aexlib.kintone.Record.recordId(newRecordId) set a new recordId without setting updated.", function() {
    var record = {};
    record[k.RECORD_ID_CODE] = { value: 'foo' };
    var r = new k.Record(a, record);
    expect(r.recordId('0')).toEqual('foo');
    expect(r.recordId()).toEqual(0);
  });

  it("aexlib.kintone.Record.recordId(newRecordId) set a new value for null record without setting updated.", function() {
    var r = new k.Record(a);
    expect(r.recordId('10')).toBeUndefined();
    expect(r.recordId()).toEqual(10);
  });

  it("aexlib.kintone.Record._convertToTypeValue can support converting NUMBER to JavaScript class object.", function() {
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'1',   type:'NUMBER'}}, 'foo')).toEqual(1);
    expect(k.Record._convertToTypeValue(null, {'foo':{value:1,     type:'NUMBER'}}, 'foo')).toEqual(1);
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'0',   type:'NUMBER'}}, 'foo')).toEqual(0);
    expect(k.Record._convertToTypeValue(null, {'foo':{value:0,     type:'NUMBER'}}, 'foo')).toEqual(0);
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'0.5', type:'NUMBER'}}, 'foo')).toEqual(0.5);
    expect(k.Record._convertToTypeValue(null, {'foo':{value:0.5,   type:'NUMBER'}}, 'foo')).toEqual(0.5);
  });

  it("aexlib.kintone.Record._convertFromTypeValue can support converting NUMBER to JavaScript class object.", function() {
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '1')).toEqual('1');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 1)).toEqual('1');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '0')).toEqual('0');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 0)).toEqual('0');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '0.5')).toEqual('0.5');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 0.5)).toEqual('0.5');
  });

  it("aexlib.kintone.Record._convertToTypeValue can support converting SINGLE_LINE_TEXT to JavaScript String.", function() {
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'bar', type:'SINGLE_LINE_TEXT'}}, 'foo')).toEqual('bar');
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'',    type:'SINGLE_LINE_TEXT'}}, 'foo')).toEqual('');
    expect(k.Record._convertToTypeValue({foo:{type:'SINGLE_LINE_TEXT'}}, {'foo':{value:'bar'}}, 'foo')).toEqual('bar');
    expect(k.Record._convertToTypeValue({foo:{type:'SINGLE_LINE_TEXT'}}, {'foo':{value:''}},    'foo')).toEqual('');
  });

  it("aexlib.kintone.Record._convertFromTypeValue can support converting SINGLE_LINE_TEXT to JavaScript String.", function() {
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'SINGLE_LINE_TEXT'}}, 'foo', 'bar')).toEqual('bar');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'SINGLE_LINE_TEXT'}}, 'foo', '')).toEqual('');
    expect(k.Record._convertFromTypeValue({foo:{type:'SINGLE_LINE_TEXT'}}, {'foo':{}}, 'foo', 'bar')).toEqual('bar');
    expect(k.Record._convertFromTypeValue({foo:{type:'SINGLE_LINE_TEXT'}}, {'foo':{}}, 'foo', '')).toEqual('');
  });

  it("aexlib.kintone.Record._convertToTypeValue returns no converted value when there is no type.", function() {
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'bar'}}, 'foo')).toEqual('bar');
    expect(k.Record._convertToTypeValue({},   {'foo':{value:'bar'}}, 'foo')).toEqual('bar');
  });

  it("aexlib.kintone.Record._convertFromTypeValue returns no converted value when there is no type.", function() {
    expect(k.Record._convertFromTypeValue(null, {}, 'foo', 'bar')).toEqual('bar');
    expect(k.Record._convertFromTypeValue({},   {}, 'foo', 'bar')).toEqual('bar');
  });

  it("aexlib.kintone.Record.save creates a new data if it is a new value.", function(done) {
    var receiver = {};
    var r = a.newRecord();
    r.val('foo', 'bar');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.record).toEqual({foo:{value:'bar'}});
      return new Promise(function(resolve) { resolve({id: "11", revision:"1"}); });
    });

    r.save(receiver, 'resp').then(function(resp) {
      expect(resp.id).toEqual('11');
      expect(resp.revision).toEqual('1');
      expect(r.recordId()).toEqual(11);
      expect(r.revision()).toEqual(1);
      expect(receiver.resp).toEqual({id:"11",revision:"1"});
      expect(resp).toEqual({id:"11",revision:"1"});
      done();
    });
  });

  it("aexlib.kintone.Record.save creates a new data if there is no recordId.", function(done) {
    var r = a.newRecord({foo:{value:'bar'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.record).toEqual({foo:{value:'bar'}});
      return new Promise(function(resolve) { resolve({id: "11", revision:"2"}); });
    });

    r.save().then(function(resp) {
      expect(resp.id).toEqual('11');
      expect(resp.revision).toEqual('2');
      expect(r.recordId()).toEqual(11);
      expect(r.revision()).toEqual(2);
      expect(resp).toEqual({id:"11",revision:"2"});
      done();
    });
  });

  it("aexlib.kintone.Record.save updates data if it has recordId.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}, 'foo':{value:'foo'}});
    r.val('foo', 'bar');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.id).toEqual(2);
      expect(params.revision).toEqual(3);
      expect(params.record).toEqual({foo:{value:'bar'}});
      return new Promise(function(resolve) { resolve({revision:"4"}); });
    });

    r.save().then(function(resp) {
      expect(resp.revision).toEqual('4');
      expect(r.recordId()).toEqual(2);
      expect(r.revision()).toEqual(4);
      expect(resp).toEqual({revision:"4"});
      done();
    });
  });

  it("aexlib.kintone.Record.save(false) updates data without revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}, 'foo':{value:'foo'}});
    r.val('foo', 'bar');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.id).toEqual(2);
      expect(params.revision).toBeUndefined();
      expect(params.record).toEqual({foo:{value:'bar'}});
      return new Promise(function(resolve) { resolve({revision:"4"}); });
    });

    r.save(null, null, false).then(function(resp) {
      expect(resp.revision).toEqual('4');
      expect(r.recordId()).toEqual(2);
      expect(r.revision()).toEqual(4);
      expect(resp).toEqual({revision:"4"});
      done();
    });
  });


  it("aexlib.kintone.Record.save throws when there is no update.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}, 'foo':{value:'foo'}});

    r.save().then(function() {}, function(message) {
      expect(message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Record.remove delete data if it has recordId and revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2', type:k.RECORD_ID_TYPE},
                         '$revision':{value:'3', type:k.REVISION_TYPE}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2]);
      expect(params.revisions).toEqual([3]);
      return new Promise(function(resolve) { resolve({}); });
    });

    r.remove().then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Record.remove delete data if it has recordId and revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2]);
      expect(params.revisions).toEqual([3]);
      return new Promise(function(resolve) { resolve({}); });
    });

    r.remove().then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Record.remove(false) delete data without revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2]);
      expect(params.revisions).toBeUndefined();
      return new Promise(function(resolve) { resolve({}); });
    });

    r.remove(false).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Record.remove calls reject for Promise when there is no recordId.", function(done) {
    var r = a.newRecord({});

    r.remove().then(function() {}, function(message) {
      expect(message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll deletes some Records.", function(done) {
    var records = [
      a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}}),
      a.newRecord({'$id':{value:'5'}, '$revision':{value:'6'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2, 5]);
      expect(params.revisions).toEqual([3, 6]);
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Record.removeAll(records).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll deletes some Records without revisions.", function(done) {
    var records = [
      a.newRecord({'$id':{value:'2'}}),
      a.newRecord({'$id':{value:'5'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2, 5]);
      expect(params.revisions).toBeUndefined();
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Record.removeAll(records, false).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll returns rejected Promise when there is no record.", function(done) {
    k.Record.removeAll([]).then(function() {}, function(err) {
      expect(err).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll deletes records for several apps.", function(done) {
    var a2 = k.App.getApp('2');

    var records = [
       a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}}),
       a.newRecord({'$id':{value:'4'}, '$revision':{value:'5'}}),
      a2.newRecord({'$id':{value:'6'}, '$revision':{value:'7'}}),
      a2.newRecord({'$id':{value:'8'}, '$revision':{value:'9'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      if (params.app === '1') {
        expect(params.ids).toEqual([2, 4]);
        expect(params.revisions).toEqual([3, 5]);
      } else if (params.app === '2') {
        expect(params.ids).toEqual([6, 8]);
        expect(params.revisions).toEqual([7, 9]);
      } else {
        expect('This should not be called.').toBe('');
      }
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Record.removeAll(records).then(function(resp) {
      expect(resp).toEqual({});
      expect(kintone.api.calls.count()).toEqual(2);
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll returns rejected Promise when kintone.api calls rejected Promise.", function(done) {
    var records = [ a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}}) ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return new Promise(function(resolve, reject) { reject({message: 'failed'}); });
    });

    k.Record.removeAll(records).then(function() {}, function(message) {
      expect(message).toEqual('failed');
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll returns unknown error message when kintone.api calls rejected Promise.", function(done) {
    var records = [ a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}}) ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return new Promise(function(resolve, reject) { reject({wrongFormat:'failed'}); });
    });

    k.Record.removeAll(records).then(function() {}, function(message) {
      expect(message).toEqual(k._UNKNOWN_ERROR);
      done();
    });
  });

  it("aexlib.kintone.Record.removeAll deletes many Records.", function(done) {
    var records = [];
    var count = 0;

    for (var i = 0;i < 201;i++) {
      records.push(a.newRecord({'$id':{value:i}, '$revision':{value:'3'}}));
    }

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');

      if (count === 0) {
        expect(params.ids.length).toEqual(100);
        expect(params.ids.length).toEqual(100);
        expect(params.ids[0]).toEqual(0);
        expect(params.ids[99]).toEqual(99);
      } else if (count === 1) {
        expect(params.ids.length).toEqual(100);
        expect(params.ids.length).toEqual(100);
        expect(params.ids[0]).toEqual(100);
        expect(params.ids[99]).toEqual(199);
      } else if (count === 2) {
        expect(params.ids.length).toEqual(1);
        expect(params.ids.length).toEqual(1);
        expect(params.ids[0]).toEqual(200);
      } else {
        expect('This should not be called.').toEqual();
      }
      count++;
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Record.removeAll(records).then(function(resp) {
      expect(resp).toEqual({});
      expect(count).toEqual(3);
      done();
    });
  });

  it("aexlib.kintone.Record._getUpdateParams returns params for _recursiveUpdate to update new records.", function() {
    var updateParams = k.Record._getUpdateParams();
    var records = [
      a.newRecord({foo:{value:'bar'}, '$id':{value:'2'}, '$revision':{value:'4'} }),
      a.newRecord({foo:{value:'hoge'},'$id':{value:'3'}, '$revision':{value:'5'} })
    ];
    var records2 = [
      a.newRecord({foo:{value:'bar'}, '$id':{value:'9'}, '$revision':{value:'10'} }),
      a.newRecord({foo:{value:'hoge'},'$id':{value:'8'}, '$revision':{value:'9'} })
    ];
    records = records.map(function(record) {
        record.val('foo', 'piyo');
        return record;
    });
    var paramRecords = [
      {id:2, revision:4, record:records[0].updated},
      {id:3, revision:5, record:records[1].updated}
    ];
    var resultRecords = [{id:'2', revision:'6'}, {id:'3', revision:'7'}];
    var resultRecords2 = [{id:'8', revision:'10'}, {id:'9', revision:'11'}];
    var params;
    var resp;

    expect(updateParams.url).toEqual('/k/v1/records');
    expect(updateParams.request).toEqual('PUT');
    params = updateParams.toParamsHandler('1', records, true);
    expect(params.app).toEqual('1');
    expect(params.records).toEqual(paramRecords);

    resp = updateParams.toResultHandler(records, {records:resultRecords});
    expect(resp.records).toEqual(resultRecords);
    resp = updateParams.toResultHandler(records2, {records:resultRecords2}, resp);

    params = updateParams.toParamsHandler('1', records);
    expect(params.app).toEqual('1');
    expect(params.records).toEqual([{id:2, record:records[0].updated}, {id:3, record:records[0].updated}]);
  });

  it("aexlib.kintone.Record._getCreateParams returns params for _recursiveUpdate to create new records.", function() {
    var updateParams = k.Record._getCreateParams();
    var records = [
      a.newRecord({foo:{value:'bar'}}),
      a.newRecord({foo:{value:'hoge'}})
    ];
    var paramRecords = [
      records[0].record,
      records[1].record
    ];
    var params;
    var resp;

    expect(updateParams.url).toEqual('/k/v1/records');
    expect(updateParams.request).toEqual('POST');
    params = updateParams.toParamsHandler('1', records, true);
    expect(params.app).toEqual('1');
    expect(params.records).toEqual(paramRecords);
    resp = updateParams.toResultHandler(records, {ids:['1','2'], revisions:['3','4']});
    expect(resp.ids).toEqual(['1','2']);
    expect(resp.revisions).toEqual(['3','4']);
    resp = updateParams.toResultHandler(records, {ids:['5','6'], revisions:['7','8']}, resp);
    expect(resp.ids).toEqual(['1','2','5','6']);
    expect(resp.revisions).toEqual(['3','4','7','8']);
  });

  it("aexlib.kintone.Record._getRemoveParams returns params for _recursiveUpdate to remove records.", function() {
    var updateParams = k.Record._getRemoveParams();
    var records = [
      a.newRecord({foo:{value:'bar'}, '$id':{value:'1'}, '$revision':{value:'3'}}),
      a.newRecord({foo:{value:'hoge'},'$id':{value:'2'}, '$revision':{value:'4'}})
    ];
    var params;
    var resp;

    expect(updateParams.url).toEqual('/k/v1/records');
    expect(updateParams.request).toEqual('DELETE');
    params = updateParams.toParamsHandler('1', records, true);
    expect(params.app).toEqual('1');
    expect(params.ids).toEqual([1, 2]);
    expect(params.revisions).toEqual([3, 4]);
    resp = updateParams.toResultHandler(records, {});
    expect(resp).toEqual({});
    resp = updateParams.toResultHandler(records, {}, resp);
    expect(resp).toEqual({});
  });

  it("aexlib.kintone.Record.createAll creates records.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}}),
      a.newRecord({'foo':{value:'hoge'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual([{foo:{value:'bar'}}, {foo:{value:'hoge'}}]);
      return new Promise(function(resolve) { resolve({ids:['1','2'], revisions:['3','4']}); });
    });

    k.Record.createAll(records).then(function(resp) {
      expect(resp).toEqual({ids:['1','2'], revisions:['3','4']});
      expect(records[0].recordId()).toEqual(1);
      expect(records[1].recordId()).toEqual(2);
      expect(records[0].revision()).toEqual(3);
      expect(records[1].revision()).toEqual(4);
      done();
    });
  });

  it("aexlib.kintone.Record.updateAll updates records.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'1'}, '$revision':{value:'3'}}),
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'2'}, '$revision':{value:'4'}})
    ];
    records = records.map(function(record) { record.val('foo', 'piyo'); return record;});
    var paramRecords = [
      {id:1,revision:3,record:{foo:{value:'piyo'}}},
      {id:2,revision:4,record:{foo:{value:'piyo'}}}
    ];
    var respRecords = [{id:'1', revision:'5'}, {id:'2',revision:'6'}];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual(paramRecords);
      return new Promise(function(resolve) { resolve({records:respRecords}); });
    });

    k.Record.updateAll(records).then(function(resp) {
      expect(resp).toEqual({records:respRecords});
      expect(records[0].revision()).toEqual(5);
      expect(records[1].revision()).toEqual(6);
      done();
    });
  });

  it("aexlib.kintone.Record.saveAll creates records.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}}),
      a.newRecord({'foo':{value:'hoge'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual([{foo:{value:'bar'}}, {foo:{value:'hoge'}}]);
      return new Promise(function(resolve) { resolve({ids:['1','2'], revisions:['3','4']}); });
    });

    k.Record.saveAll(records).then(function(resp) {
      expect(resp).toEqual({ids:['1','2'], revisions:['3','4']});
      done();
    });
  });

  it("aexlib.kintone.Record.saveAll updates records.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'1'}}),
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'2'}})
    ];
    records = records.map(function(record) { record.val('foo', 'piyo'); return record;});
    var paramRecords = [
      {id:1, record:{foo:{value:'piyo'}}},
      {id:2, record:{foo:{value:'piyo'}}}
    ];
    var respRecords = [{id:'1', revision:'5'}, {id:'2',revision:'6'}];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual(paramRecords);
      return new Promise(function(resolve) { resolve({records:respRecords}); });
    });

    k.Record.saveAll(records, false).then(function(resp) {
      expect(resp).toEqual({records:respRecords});
      done();
    });
  });

  it("aexlib.kintone.Record.saveAll returns error for no updates.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'1'}}),
      a.newRecord({'foo':{value:'hoge'},'$id':{value:'2'}})
    ];

    k.Record.saveAll(records).then(function() {}, function(message) {
      expect(message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Record.saveAll returns error for no record.", function(done) {
    k.Record.saveAll([]).then(function() {}, function(message) {
      expect(message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Record.saveAll returns error when there are new and update records.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}}),
      a.newRecord({'foo':{value:'hoge'},'$id':{value:'2'}})
    ];
    records[1].val('foo','piyo');

    k.Record.saveAll(records).then(function() {}, function(message) {
      expect(message).toBeDefined();
      done();
    });
  });
});

