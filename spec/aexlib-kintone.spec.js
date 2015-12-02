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
  var b;

  beforeEach(function() {
    a = k.App.getApp('1');
    q = a.select();
    b = k.BulkRequest.newRequest();
  });

  afterEach(function() {
    k._HOOK_API_TABLE['kintone.api'] = null;
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
    expect(a.appId).toEqual('1');
    expect(a.app).toBeUndefined();
    expect(a.fields).toBeUndefined();
    expect(a.lang).toEqual('default');
    expect(a._labelAccess).toEqual(false);
  });

  it("aexlib.kintone.App.getApp(appId) can set fields and additional options.", function() {
    var fields = {properties: {'foo':{label:'bar'}}};
    var app = k.App.getApp('1', fields, {lang:'en', labelAccess:true});
    expect(app.appId).toEqual('1');
    expect(app.app).toBeUndefined();
    expect(app.fields).toEqual(fields);
    expect(app.lang).toEqual('en');
    expect(app._labelAccess).toEqual(true);
    expect(app.labelAccess()).toEqual(true);
  });

  it("aexlib.kintone.App.getApp(appId) can set fields and additional options.", function() {
    var app = k.App.getApp('1', null, {});
    expect(app.appId).toEqual('1');
    expect(app.app).toBeUndefined();
    expect(app.fields).toEqual(null);
    expect(app.lang).toEqual('default');
    expect(app._labelAccess).toEqual(false);
  });

  it("aexlib.kintone.App.fetchApps", function(done) {
    var result = {
      apps: [
        { appId: '1', name:'appName1' },
        { appId: '2', name:'appName2' }
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
      expect(apps[0].appId).toEqual(result.apps[0].appId);
      expect(apps[1].appId).toEqual(result.apps[1].appId);
      expect(apps[0].app).toEqual(result.apps[0]);
      expect(apps[1].app).toEqual(result.apps[1]);
      done();
    });
  });

  it("aexlib.kintone.App.fetchApps calls reject function when it failed.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/apps');
      return new Promise(function(resolve, reject) { reject({message: 'failed'}); });
    });

    k.App.fetchApps().then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      done();
    });
  });

  it("aexlib.kintone.App.fetchApps calls reject and return an object as it is.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/apps');
      return new Promise(function(resolve, reject) { reject({}); });
    });

    k.App.fetchApps({}).then(function() {}, function(error) {
      expect(error).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.App.fetchApps", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/apps');
      expect(params.ids, [1]);
      expect(params.codes, [2]);
      expect(params.name, 'test');
      expect(params.spaceIds, [3]);
      return new Promise(function(resolve, reject) { reject({}); });
    });

    k.App.fetchApps({ids:[1],codes:[2],name:'test',spaceIds:[3], guestSpaceId:'foo'}).then(function() {}, function(error) {
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can call more than limit and return as an array.", function(done) {
    var toParamsHandler = function(startOffset, batchSize) {
        return {offset:startOffset, limit:batchSize};
    };
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result',
        toParamsHandler:toParamsHandler
    };
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
    var toParamsHandler = function(startOffset, batchSize) { 
        return {offset:startOffset, limit:batchSize};
    };
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result',
        toParamsHandler:toParamsHandler
    };
    var startOffset = 0;
    var maxRecordNum = 2;
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

    k._recursiveFetch(fetchParams, startOffset, maxRecordNum).then(function(resp) {
      expect(resp.length).toEqual(2);
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can set the number of the max entries for more than 100 entries.", function(done) {
    var toParamsHandler = function(startOffset, batchSize) { 
        return {offset:startOffset, limit:batchSize};
    };
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result',
        toParamsHandler:toParamsHandler
    };
    var startOffset = 0;
    var maxRecordNum = 101;
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

    k._recursiveFetch(fetchParams, startOffset, maxRecordNum).then(function(resp) {
      expect(resp.length).toEqual(101);
      done();
    });
  });

  it("aexlib.kintone._recursiveFetch can set additional params.", function(done) {
    var toParamsHandler = function(startOffset, batchSize) { 
        return { name:'foo', offset:startOffset, limit:batchSize};
    };
    var fetchParams = { url: '/url', request:'GET', resultProperty:'result',
        toParamsHandler:toParamsHandler
    };

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

    k._recursiveUpdate(updateParams, records, {validation:false}).then(function(resp) {
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

  it("aexlib.kintone.App.fetchApp fetch app info with a guest space id", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/app');
      return new Promise(function(resolve) { resolve({appId: '1'}); });
    });

    a.fetchApp({guestSpaceId:'foo'}).then(function(info) {
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
      expect(error.message).toEqual('failed');
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
      expect(params.app).toEqual('1');
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

  it("aexlib.kintone.App.fetchFields fetch field properties with preview and guestSpaceId.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/5/v1/preview/app/form/fields');
      return new Promise(function(resolve) { resolve({properties: { 'foo': {code:'foo'} } }); });
    });

    app.fetchFields({guestSpaceId:'5', preview:true}).then(function(info) {
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
      expect(error.message).toEqual('failed');
      expect(app.fields).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchSettings fetch settings and return Promise.", function(done) {
    var result = {
      "name": "Foo",
      "description": "desc",
      "icon": {
        "type": "PRESET",
        "key": "APP60"
      },
      "theme": "WHITE",
      "revision": "24"
    };

    var app = k.App.getApp('1');
    expect(app.settings).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/settings');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      expect(params.lang).toEqual('default');
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchSettings().then(function(resp) {
      expect(app.settings).toBeDefined();
      expect(app.settings.name).toEqual('Foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchSettings fetch settings for preview and return Promise.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/settings');
      return new Promise(function(resolve) { resolve({name:'Foo'}); });
    });

    app.fetchSettings({preview:true}).then(function(resp) {
      expect(resp.name).toEqual('Foo');
      expect(app.settings.name).toEqual('Foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchSettings fetch settings for preview and guest space.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/5/v1/preview/app/settings');
      return new Promise(function(resolve) { resolve({name:'Foo'}); });
    });

    app.fetchSettings({preview:true, guestSpaceId:'5'}).then(function(resp) {
      expect(resp.name).toEqual('Foo');
      expect(app.settings.name).toEqual('Foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchSettings may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.settings).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchSettings().then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      expect(app.settings).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchLayout fetch layout info and return Promise.", function(done) {
    var app = k.App.getApp('1');
    expect(app.layout).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/form/layout');
      expect(request).toEqual('GET');
      expect(params).toEqual({app:'1'});
      return new Promise(function(resolve) { resolve({layout:[{type:'ROW'}]}); });
    });

    app.fetchLayout().then(function(resp) {
      expect(resp.layout.length).toEqual(1);
      expect(app.layout).toBeDefined();
      expect(app.layout.layout[0].type).toEqual('ROW');
      done();
    });
  });

  it("aexlib.kintone.App.fetchLayout fetch layout info for preview and return Promise.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/layout');
      return new Promise(function(resolve) { resolve({revision:'2', layout:[{type:'ROW'}]}); });
    });

    app.fetchLayout({preview:true}).then(function(resp) {
      expect(app.layout.revision).toEqual('2');
      expect(app.layout.layout[0].type).toEqual('ROW');
      done();
    });
  });

  it("aexlib.kintone.App.fetchLayout fetch layout info for preview and guestSpaceId.", function(done) {
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/5/v1/preview/app/form/layout');
      return new Promise(function(resolve) { resolve({revision:'2', layout:[{type:'ROW'}]}); });
    });

    app.fetchLayout({guestSpaceId:'5', preview:true}).then(function(resp) {
      expect(app.layout.revision).toEqual('2');
      expect(app.layout.layout[0].type).toEqual('ROW');
      done();
    });
  });

  it("aexlib.kintone.App.fetchLayout may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.layout).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchLayout().then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      expect(app.layout).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchViews fetch views info and return Promise.", function(done) {
    var result = {views:{'viewNameKey':{name:'viewNameKey'}}};
    var app = k.App.getApp('1');
    expect(app.views).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/views');
      expect(request).toEqual('GET');
      expect(params).toEqual({app:'1',lang:'default'});
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchViews().then(function(resp) {
      expect(resp.views).toEqual(result.views);
      expect(app.views).toBeDefined();
      expect(app.views.views.viewNameKey.name).toEqual('viewNameKey');
      done();
    });
  });

  it("aexlib.kintone.App.fetchViews fetch views info for preview and return Promise.", function(done) {
    var result = {views:{'viewNameKey':{name:'viewNameKey'}}};
    var app = k.App.getApp('1');
    expect(app.views).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/views');
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchViews({preview:true}).then(function(resp) {
      done();
    });
  });

  it("aexlib.kintone.App.fetchViews fetch views info for preview and guestSpaceId.", function(done) {
    var result = {views:{'viewNameKey':{name:'viewNameKey'}}};
    var app = k.App.getApp('1');
    expect(app.views).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/5/v1/preview/app/views');
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchViews({guestSpaceId:'5', preview:true}).then(function(resp) {
      done();
    });
  });

  it("aexlib.kintone.App.fetchViews may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.layout).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchViews().then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      expect(app.layout).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchForm fetch form info and return Promise.", function(done) {
    var result = {properties:[{code:'foo'}]};
    var app = k.App.getApp('1');
    expect(app.form).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/form');
      expect(request).toEqual('GET');
      expect(params).toEqual({app:'1'});
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchForm().then(function(resp) {
      expect(resp.properties).toEqual(result.properties);
      expect(app.form).toBeDefined();
      expect(app.form.properties[0].code).toEqual('foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchForm fetch form info for preview and return Promise.", function(done) {
    var result = {properties:[{code:'foo'}]};
    var app = k.App.getApp('1');
    expect(app.form).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/form');
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchForm({preview:true}).then(function(resp) {
      expect(resp.properties).toEqual(result.properties);
      expect(app.form.properties[0].code).toEqual('foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchForm fetch form info for preview and a guestSpaceId.", function(done) {
    var result = {properties:[{code:'foo'}]};
    var app = k.App.getApp('1');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/form');
      return new Promise(function(resolve) { resolve(result); });
    });

    app.fetchForm({guestSpaceId:'foo', preview:true}).then(function(resp) {
      expect(resp.properties).toEqual(result.properties);
      expect(app.form.properties[0].code).toEqual('foo');
      done();
    });
  });

  it("aexlib.kintone.App.fetchForm may return error message when there is a problem.", function(done) {
    var app = k.App.getApp('1');
    expect(app.layout).toBeUndefined();

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    app.fetchForm().then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      expect(app.form).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.newRecord creates a new Record instance.", function() {
    expect(a.newRecord({foo:{value:'bar'}}).val('foo')).toEqual('bar');
  });

  it("aexlib.kintone.App.labelAccess can set a new labelAccess flag value.", function() {
    expect(a.labelAccess()).toEqual(false);
    a.labelAccess(true);
    expect(a.labelAccess()).toEqual(true);
  });

  it("aexlib.kintone.App.fetchAppACL", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchAppACL().then(function(resp) {
      expect(resp).toEqual(result);
      expect(a.appACL).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchAppACL for guest and preview", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/app/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchAppACL({guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.fetchRecordACL", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchRecordACL().then(function(resp) {
      expect(resp).toEqual(result);
      expect(a.recordACL).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchRecordACL for guest and preview", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/record/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchRecordACL({guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.fetchFieldACL", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/field/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchFieldACL().then(function(resp) {
      expect(resp).toEqual(result);
      expect(a.fieldACL).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.fetchFieldACL for guest and preview", function(done) {
    var result = {revision:'2', rights:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/field/acl');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchFieldACL({guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });


  it("aexlib.kintone.App.updateAppACL", function(done) {
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual(-1);
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateAppACL({rights:[]}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateAppACL", function(done) {
    var result = {revision:'6'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/app/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual('5');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateAppACL({rights:[], revision:'5'}, {guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateRecordACL", function(done) {
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual(-1);
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateRecordACL({rights:[]}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateRecordACL", function(done) {
    var result = {revision:'6'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/record/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual('5');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateRecordACL({rights:[], revision:'5'}, {guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateFieldACL", function(done) {
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/field/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual(-1);
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFieldACL({rights:[]}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateFieldACL", function(done) {
    var result = {revision:'6'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/hoge/v1/preview/field/acl');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.rights).toEqual([]);
      expect(params.revision).toEqual('5');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFieldACL({rights:[], revision:'5'}, {guestSpaceId:'hoge', preview:true}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });


  it("aexlib.kintone.App.fetchCustomize", function(done) {
    var result = {revision:'2', desktop:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/customize');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.fetchCustomize().then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });


  it("aexlib.kintone.App.updateCustomize", function(done) {
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/app/customize');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.desktop).toEqual([]);
      expect(params.revision).toBeUndefined();
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateCustomize({desktop:[]}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });


  it("aexlib.kintone.Query.first fetch a record and then return Promise.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 1 offset 0');
      expect(params.app).toEqual('1');
      expect(params.fields).toBeUndefined();
      return new Promise(function(resolve) { resolve({records: [ { 'foo': {code:'foo'} } ] }); });
    });

    a.first().then(function(record) {
      expect(record.record.foo.code).toEqual('foo');
      done();
    });
  });

  it("aexlib.kintone.Query.first fetch records and then return Promise.", function(done) {
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

    a.first(3).then(function(records) {
      expect(records[0].record.foo.code).toEqual('foo');
      expect(records[1].record.bar.code).toEqual('bar');
      expect(records[2].record.hoge.code).toEqual('hoge');
      done();
    });
  });


  it("aexlib.kintone.Query.first returns undefined when limit is 1.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.query).toEqual('limit 1 offset 0');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    a.first(1).then(function(record) {
      expect(record).toBeUndefined();
      done();
    });
  });


  it("aexlib.kintone.Query.first fetch blank array when limit is 2 or more than 2.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.query).toEqual('limit 3 offset 0');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    a.first(3).then(function(records) {
      expect(records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.Query.first fetch blank array when limit is 2 or more than 2.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params.query).toEqual('limit 3 offset 2');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    a.select().offset(2).first(3).then(function(records) {
      expect(records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.Query.first can fetch a guest space's app record with guestSpaceId param.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/records');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    a.first({guestSpaceId:'foo'}).then(function(records) {
      done();
    });
  });

  it("aexlib.kintone.Query.first can fetch a guest space's app record with guestSpaceId param.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(params.query).toEqual('limit 2 offset 0');
      return new Promise(function(resolve) { resolve({records: []}); });
    });

    a.first({maxRecordNum:2}).then(function(records) {
      done();
    });
  });

  it("aexlib.kintone.Query.find fetch records and then return Promise.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 100 offset 0');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve({records: [
          { 'foo' : {code:'foo'} },
          { 'bar' : {code:'bar'} },
          { 'hoge': {code:'hoge'} }
        ] }); });
    });

    a.select().find().then(function(resp) {
      expect(resp.records[0].record.foo.code).toEqual('foo');
      expect(resp.records[1].record.bar.code).toEqual('bar');
      expect(resp.records[2].record.hoge.code).toEqual('hoge');
      done();
    });
  });

  it("aexlib.kintone.Query.find fetch records and then return Promise.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 100 offset 0');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve({records: [] }); });
    });

    a.select().find().then(function(resp) {
      expect(resp.records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.Query.find fetch records and then return Promise.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 20 offset 10');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve({records: [] }); });
    });

    a.select().offset(10).limit(20).find().then(function(resp) {
      expect(resp.records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.Query.find can fetch a guest space's app records when guestSpaceId param is set.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/records');
      return new Promise(function(resolve) { resolve({records: [] }); });
    });

    a.select().find({guestSpaceId:'foo'}).then(function(resp) {
      expect(resp.records).toEqual([]);
      done();
    });
  });

  it("aexlib.kintone.Query.find can apply filters to records and then return Promise.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.query).toEqual('limit 100 offset 0');
      expect(params.app).toEqual('1');
      return new Promise(function(resolve) { resolve({records: [
          { 'foo' : {code:'foo', value:'foo1'} },
          { 'foo' : {code:'foo', value:'foo2'} },
          { 'foo' : {code:'foo', value:'foo3'} }
        ] }); });
    });

    var f = function(record) {
        return record.foo.value === 'foo1';
    };

    var f2 = function(record) {
        record.foo.x = 'bar';
        return record;
    };

    a.select().filter(f).map(f2).find().then(function(resp) {
      expect(resp.records.length).toEqual(1);
      expect(resp.records[0].record.foo.value).toEqual('foo1');
      expect(resp.records[0].record.foo.x).toEqual('bar');
      done();
    });
  });

  it("aexlib.kintone.Query.find with totalCount returns totalCount.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('GET');
      expect(params.app).toEqual('1');
      expect(params.totalCount).toEqual(true);
      return new Promise(function(resolve) { resolve({records: [], totalCount:1 }); });
    });

    a.select().totalCount().find().then(function(resp) {
      expect(resp.records).toEqual([]);
      expect(resp.totalCount).toEqual(1);
      done();
    });
  });

  it("aexlib.kintone.Query.totalCount can set the flag for totalCount.", function() {
    expect(a.select()._totalCountFlag).toBeUndefined();
    expect(a.select().totalCount()._totalCountFlag).toEqual(true);
  });

  it("aexlib.kintone.Query.totalCount can set the enable flag to return totalCount.", function() {
    expect(a.select().totalCount(true)._totalCountFlag).toEqual(true);
  });

  it("aexlib.kintone.Query.totalCount(false) can set the disable flag to return totalCount.", function() {
    expect(a.select().totalCount(false)._totalCountFlag).toEqual(false);
  });

  it("aexlib.kintone.App.select can start query.", function() {
    var app = k.App.getApp('1');
    var q = app.select();
    expect(q.app).toEqual(app);
    expect(q._queryFields).toBeUndefined();
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
    expect(q._queryFields).toEqual(['foo']);
  });

  it("aexlib.kintone.Query.select can set fields using an array.", function() {
    var q = k.App.getApp('1').select(['foo', 'bar']);
    expect(q._queryFields).toEqual(['foo', 'bar']);
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

  it("aexlib.kintone.Query.select can use label when option is set.", function() {
    var app = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    var q = app.select('bar');
    expect(q._queryFields).toEqual(['foo']);
  });

  it("aexlib.kintone.Query.select can use label when option is set.", function() {
    var app = k.App.getApp('1', {properties:{foo:{label:'bar'}, bar:{label:'hoge'}}}, {labelAccess:true});
    var q = app.select(['bar', 'hoge']);
    expect(q._queryFields).toEqual(['foo', 'bar']);
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

  it("aexlib.kintone.Query.orderAsc can set order by foo asc when labelAccess is true.", function() {
    a = k.App.getApp('1', {properties:{foo:{label:'bar'}}});
    a.labelAccess(true);
    q = a.select();
    expect(q.orderAsc("bar")._buildQuery()).toEqual('order by foo asc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    expect(q.orderDesc("foo")._buildQuery()).toEqual('order by foo desc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc when labelAccess is true.", function() {
    a = k.App.getApp('1', {properties:{foo:{label:'bar'}}});
    a.labelAccess(true);
    q = a.select();
    expect(q.orderDesc("bar")._buildQuery()).toEqual('order by foo desc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    expect(q.orderAsc('foo').orderDesc('bar')._buildQuery()).toEqual('order by foo asc, bar desc');
  });

  it("aexlib.kintone.Query.orderDesc can set order by foo desc.", function() {
    var stmt = q.select().where(q.equal('foo', 'bar')).orderAsc('foo').orderDesc('bar')._buildQuery();
    expect(stmt).toEqual('foo = "bar" order by foo asc, bar desc');
  });

  it("aexlib.kintone.Query.offset can set an offset value", function() {
    expect(q.offset(1)._offset).toEqual(1);
  });

  it("aexlib.kintone.Query.limit can set an limit value", function() {
    expect(q.limit(1)._limit).toEqual(1);
  });

  it("aexlib.kintone.Query._buildQuery can set startOffset and batchSize with stmt.", function() {
    expect(q.where('a = b')._buildQuery(0, 1)).toEqual('a = b limit 1 offset 0');
  });

  it("aexlib.kintone.Query._buildQuery can set startOffset and batchSize only.", function() {
    expect(q._buildQuery(0, 1)).toEqual('limit 1 offset 0');
    expect(q._buildQuery(1)).toEqual('offset 1');
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
    expect(new k.Query.Condition(q)._addOperatorQuery('code', 'op', '"foo')._qParams.pop()).toEqual('code op "\\"foo"');
  });

  it("aexlib.kintone.Query._toOperatorQuery set query params from label.", function() {
    a = k.App.getApp('1', {properties:{foo:{label:'bar'}}});
    a.labelAccess(true);
    expect(new k.Query.Condition(a.select())._addOperatorQuery('bar', 'op', 'hoge')._qParams.pop()).toEqual('foo op "hoge"');
  });

  it("aexlib.kintone.Query.equal set operator = to query.", function() {
    var c = q.equal('code', 'foo');
    expect(c._qParams.pop()).toEqual('code = "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.equal set operator = to query with a record for labelAccess == true.", function() {
    var a2 = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    var r = a2.newRecord({foo:{value:'hoge'}});
    var c = q.equal('foo', r);
    expect(c._qParams.pop()).toEqual('foo = "hoge"');
  });

  it("aexlib.kintone.Query.equal set operator = to query with a record for labelAccess == false.", function() {
    var a2 = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    var q2 = a2.select();
    var r = a.newRecord({foo:{value:'hoge'}});
    var c = q2.equal('bar', r);
    expect(c._qParams.pop()).toEqual('foo = "hoge"');
  });

  it("aexlib.kintone.Query.notEqual set operator != to query.", function() {
    var c = q.notEqual('code', 'foo');
    expect(c._qParams.pop()).toEqual('code != "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.greaterThan set operator > to query.", function() {
    var c = q.greaterThan('code', 'foo');
    expect(c._qParams.pop()).toEqual('code > "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.lessThan set operator < to query.", function() {
    var c = q.lessThan('code', 'foo');
    expect(c._qParams.pop()).toEqual('code < "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.greaterEqual set operator >= to query.", function() {
    var c = q.greaterEqual('code', 'foo');
    expect(c._qParams.pop()).toEqual('code >= "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.lessEqual set operator <= to query.", function() {
    var c = q.lessEqual('code', 'foo');
    expect(c._qParams.pop()).toEqual('code <= "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.inList set operator in to query.", function() {
    var c = q.inList('code', ['foo', 'bar']);
    expect(c._qParams.pop()).toEqual('code in ("foo","bar")');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.inList set operator in to query.", function() {
    expect(q.inList('code', 'foo')._qParams.pop()).toEqual('code in ("foo")');
  });

  it("aexlib.kintone.Query.inList can use label for inList.", function() {
    a = k.App.getApp('1', {properties:{code:{label:'bar'}}}, {labelAccess:true});
    q = a.select();
    expect(q.inList('bar', 'foo')._qParams.pop()).toEqual('code in ("foo")');
  });

  it("aexlib.kintone.Query.inList can use label for inList with a record.", function() {
    a2 = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    q = a2.select();
    r = a.newRecord({foo:{value:'hoge'}});
    expect(q.inList('bar', r)._qParams.pop()).toEqual('foo in ("hoge")');
  });


  it("aexlib.kintone.Query.notInList set operator not in to query.", function() {
    var c = q.notInList('code', ['foo', 'bar']);
    expect(c._qParams.pop()).toEqual('code not in ("foo","bar")');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.notInList set operator not in to query.", function() {
    expect(q.notInList('code', 'foo')._qParams.pop()).toEqual('code not in ("foo")');
  });

  it("aexlib.kintone.Query.notInList set operator not in to query.", function() {
    a = k.App.getApp('1', {properties:{'code':{label:'bar'}}}, {labelAccess:true});
    q = a.select();
    expect(q.notInList('bar', 'foo')._qParams.pop()).toEqual('code not in ("foo")');
  });

  it("aexlib.kintone.Query.like set operator like to query.", function() {
    var c = q.like('code', 'foo');
    expect(c._qParams.pop()).toEqual('code like "foo"');
    expect(c._query).toEqual(q);
  });

  it("aexlib.kintone.Query.notLike set operator 'not like' to query.", function() {
    var c = q.notLike('code', 'foo');
    expect(c._qParams.pop()).toEqual('code not like "foo"');
    expect(c._query).toEqual(q);
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
    var c = q.cond(q.equal('code', 'foo'));
    expect(c.toString()).toEqual('(code = "foo")');
    expect(c._query).toEqual(q);
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

  it("aexlib.kintone.Query.filter can apply a filter function to a query result", function() {
    var f = function(x) { return x > 1; };
    q.filter(f);
    expect(q._applyFilters([1,2,3])).toEqual([2,3]);
  });

  it("aexlib.kintone.Query.filter can apply multiple filters.", function() {
    var f = function(x) { return x > 1; };
    var f2 = function(x) { return x < 5; };
    q.filter([f, f2]);
    expect(q._applyFilters([1,2,3,4,5])).toEqual([2,3,4]);
  });

  it("aexlib.kintone.Query.filter can use several times for multiple filters.", function() {
    var f = function(x) { return x > 1; };
    var f2 = function(x) { return x < 5; };
    q.filter([f]).filter(f2);
    expect(q._applyFilters([1,2,3,4,5])).toEqual([2,3,4]);
  });

  it("aexlib.kintone.Query.map can appy a map function to a query result", function() {
    var f = function(x) { return x + 1; };
    q.map(f);
    expect(q._applyFilters([1,2,3])).toEqual([2,3,4]);
  });

  it("aexlib.kintone.Query.map can use multiple map functions.", function() {
    var f1 = function(x) { return x + 1; };
    var f2 = function(x) { return x + 2; };
    var f3 = function(x) { return x + 3; };
    q.map([f1]).map([f2,f3]);
    expect(q._applyFilters([1,2,3])).toEqual([7,8,9]);
  });

  it("aexlib.kintone.Query.map can use filter and map functions.", function() {
    var f1 = function(x) { return x + 1; };
    var f2 = function(x) { return x % 2 === 0; };
    var f3 = function(x) { return x + 3; };
    q.map(f1).filter(f2).map(f3);
    expect(q._applyFilters([1,2,3,4,5])).toEqual([5,7,9]);
  });

  it("aexlib.kintone.Query.map and filter can use map and filter functions.", function() {
    var f1 = function(x) { return x + 1; };
    var f2 = function(x) { return x % 2 === 0; };
    var f3 = function(x) { return x > 5; };
    var f4 = function(x) { return x + 3; };
    var f5 = function(x) { return x + 4; };
    q.map(f1).filter([f2,f3]).map([f4,f5]);
    expect(q._applyFilters([1,2,3,4,5])).toEqual([13]);
  });

  it("aexlib.kintone.Record wrap a record object returned by kintone.", function() {
    expect(new k.Record(a, {}).app).toEqual(a);
    expect(new k.Record(a, { foo:'bar' }).record).toEqual({ foo:'bar' });
  });

  it("aexlib.kintone.Record.val return a value for a field code.", function() {
    var r = new k.Record(a, { foo: { value:'bar' } });
    expect(r.val('foo')).toEqual('bar');
  });

  it("aexlib.kintone.Record.val return a value for a label.", function() {
    a = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    var r = a.newRecord({foo:{ value:'hoge'}});
    expect(r.val('bar')).toEqual('hoge');
  });

  it("aexlib.kintone.Record.val throws an Error when there is no field code.", function() {
    var r = new k.Record(a, {});
    try {
      r.val('foo');
      expect('This should not be called.').toBe();
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

  it("aexlib.kintone.Record.val(label, newValue) can set a value using the label.", function() {
    a = k.App.getApp('1', {properties:{foo:{label:'bar'}}}, {labelAccess:true});
    var r = a.newRecord({foo:{ value:'hoge'}});
    expect(r.val('bar', 'piyo')).toEqual('hoge');
    expect(r.val('bar')).toEqual('piyo');
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
    expect(k.Record._convertToTypeValue({properties:{foo:{type:'NUMBER'}}}, {'foo':{value:'0.5'}}, 'foo')).toEqual(0.5);
  });

  it("aexlib.kintone.Record._convertFromTypeValue can support converting NUMBER to JavaScript class object.", function() {
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '1')).toEqual('1');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 1)).toEqual('1');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '0')).toEqual('0');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 0)).toEqual('0');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', '0.5')).toEqual('0.5');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'NUMBER'}}, 'foo', 0.5)).toEqual('0.5');
    expect(k.Record._convertFromTypeValue({properties:{foo:{type:'NUMBER'}}}, {'foo':{value:1}}, 'foo', 0.5)).toEqual('0.5');
  });

  it("aexlib.kintone.Record._convertToTypeValue can support converting SINGLE_LINE_TEXT to JavaScript String.", function() {
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'bar', type:'SINGLE_LINE_TEXT'}}, 'foo')).toEqual('bar');
    expect(k.Record._convertToTypeValue(null, {'foo':{value:'',    type:'SINGLE_LINE_TEXT'}}, 'foo')).toEqual('');
    expect(k.Record._convertToTypeValue({properties:{foo:{type:'SINGLE_LINE_TEXT'}}}, {'foo':{value:'bar'}}, 'foo')).toEqual('bar');
    expect(k.Record._convertToTypeValue({properties:{foo:{type:'SINGLE_LINE_TEXT'}}}, {'foo':{value:''}},    'foo')).toEqual('');
  });

  it("aexlib.kintone.Record._convertFromTypeValue can support converting SINGLE_LINE_TEXT to JavaScript String.", function() {
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'SINGLE_LINE_TEXT'}}, 'foo', 'bar')).toEqual('bar');
    expect(k.Record._convertFromTypeValue(null, {'foo':{type:'SINGLE_LINE_TEXT'}}, 'foo', '')).toEqual('');
    expect(k.Record._convertFromTypeValue({properties:{foo:{type:'SINGLE_LINE_TEXT'}}}, {'foo':{}}, 'foo', 'bar')).toEqual('bar');
    expect(k.Record._convertFromTypeValue({properties:{foo:{type:'SINGLE_LINE_TEXT'}}}, {'foo':{}}, 'foo', '')).toEqual('');
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
    var r = a.newRecord();
    r.val('foo', 'bar');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/record');
      expect(request).toEqual('POST');
      expect(params.app).toEqual('1');
      expect(params.record).toEqual({foo:{value:'bar'}});
      return new Promise(function(resolve) { resolve({id: "11", revision:"1"}); });
    });

    r.save().then(function(resp) {
      expect(resp.id).toEqual('11');
      expect(resp.revision).toEqual('1');
      expect(r.recordId()).toEqual(11);
      expect(r.revision()).toEqual(1);
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

  it("aexlib.kintone.Record.save creates a new data for a guest space if there is no recordId.", function(done) {
    var r = a.newRecord({foo:{value:'bar'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/record');
      return new Promise(function(resolve) { resolve({id: "11", revision:"2"}); });
    });

    r.save({guestSpaceId:'foo'}).then(function(resp) {
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

    r.save({validation:false}).then(function(resp) {
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
      expect(url).toEqual('/k/guest/foo/v1/record');
      return new Promise(function(resolve) { resolve({revision:"4"}); });
    });

    r.save({guestSpaceId:'foo', validation:false}).then(function(resp) {
      done();
    });
  });

  it("aexlib.kintone.Record.save(null, null, {validation:true}) doesn't update data without revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}, 'foo':{value:'foo'}});
    r.val('foo', 'bar');
    r.save({validation:true}).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
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

  it("aexlib.kintone.Record.remove({validation:false}) delete data without revision.", function(done) {
    var r = a.newRecord({'$id':{value:'2'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2]);
      expect(params.revisions).toBeUndefined();
      return new Promise(function(resolve) { resolve({}); });
    });

    r.remove({validation:false}).then(function(resp) {
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
      expect(url).toEqual('/k/guest/foo/v1/records');
      expect(request).toEqual('DELETE');
      expect(params.app).toEqual('1');
      expect(params.ids).toEqual([2, 5]);
      expect(params.revisions).toBeUndefined();
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Record.removeAll(records, {guestSpaceId:'foo', validation:false}).then(function(resp) {
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

    k.Record.removeAll(records).then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
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

  it("aexlib.kintone.Record.createAll creates records for a guest space id.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}}),
      a.newRecord({'foo':{value:'hoge'}})
    ];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/records');
      return new Promise(function(resolve) { resolve({ids:['1','2'], revisions:['3','4']}); });
    });

    k.Record.createAll(records, {guestSpaceId:'foo'}).then(function(resp) {
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

  it("aexlib.kintone.Record.updateAll updates records for a guest space.", function(done) {
    var records = [
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'1'}, '$revision':{value:'3'}}),
      a.newRecord({'foo':{value:'bar'}, '$id':{value:'2'}, '$revision':{value:'4'}})
    ];
    records = records.map(function(record) { record.val('foo', 'piyo'); return record;});
    var respRecords = [{id:'1', revision:'5'}, {id:'2',revision:'6'}];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/records');
      return new Promise(function(resolve) { resolve({records:respRecords}); });
    });

    k.Record.updateAll(records, {guestSpaceId:'foo'}).then(function(resp) {
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
      expect(url).toEqual('/k/guest/foo/v1/records');
      expect(request).toEqual('PUT');
      expect(params.app).toEqual('1');
      expect(params.records).toEqual(paramRecords);
      return new Promise(function(resolve) { resolve({records:respRecords}); });
    });

    k.Record.saveAll(records, {guestSpaceId:'foo', validation:false}).then(function(resp) {
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


  it("aexlib.kintone._toFieldCode is to parse fields if opt_labelAccess is true.", function() {
    var fields = {properties:{'piyo':{label:'piyo'}, 'foo':{label:'bar'}, 'hoge':{label:'foo'}}};
    expect(k._toCode(fields, 'foo')).toEqual('foo');
    expect(k._toCode(fields, 'foo', false)).toEqual('foo');
    expect(k._toCode(fields, 'bar', true)).toEqual('foo');
    expect(k._toCode(null, 'foo')).toEqual('foo');
    try {
      k._toCode(null, 'bar', true);
      expect('This should not be reached.').toBe();
    } catch (e) {
      expect(e).toBeDefined();
    }

    try {
      k._toCode(fields, 'NotFoundLabel', true);
      expect('This should not be reached.').toBe();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("aexlib.kintone.Query.where should fail if labelAccess and string is set.", function() {
    try {
      a.labelAccess(true);
      a.where('foo = "bar"');
      expect('This should not be called').toBe();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("aexlib.kintone.Query.order should fail if labelAccess and string is set.", function() {
    try {
      a.labelAccess(true);
      a.order('order by foo desc');
      expect('This should not be called.').toBe();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("aexlib.kintone.hookKintoneAPI can register a hook function for kintone.api to send http requests.", function() {
    var called = false;
    var hookFunc = function() { called = true; };
    expect(k._KINTONE_API).toEqual('kintone.api');
    expect(k._HOOK_API_TABLE['kintone.api']).toEqual(null);
    k.hookKintoneAPI('kintone.api', hookFunc);
    expect(k._HOOK_API_TABLE['kintone.api']).toEqual(hookFunc);
    expect(k._kintoneFunc('kintone.api')).toEqual(hookFunc);
  });

  it("aexlib.kintone.hookKintoneAPI can register a hook function for kintone.app.getId.", function() {
    var hookFunc = function() { return true; };
    expect(k._KINTONE_APP_GETID).toEqual('kintone.app.getId');
    expect(k._HOOK_API_TABLE[k._KINTONE_APP_GETID]).toEqual(null);
    k.hookKintoneAPI(k._KINTONE_APP_GETID, hookFunc);
    expect(k._HOOK_API_TABLE[k._KINTONE_APP_GETID]).toEqual(hookFunc);
    expect(k._kintoneFunc(k._KINTONE_APP_GETID)).toEqual(hookFunc);
    expect(k._kintoneFunc(k._KINTONE_APP_GETID)()).toEqual(true);
  });

  it("aexlib.kintone.hookKintoneAPI throws Error when there is no hook function.", function() {
    try {
      k._kintoneFunc('Not Found Func');
      expect('This should not be called').toBe();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("aexlib.kintone._convertToNumber converts a value to a number.", function() {
    expect(k.Record._convertToNumber('1')).toEqual(1);
    expect(k.Record._convertToNumber('-1.5')).toEqual(-1.5);
    expect(k.Record._convertToNumber('0')).toEqual(0);
    expect(k.Record._convertToNumber(1)).toEqual(1);
    expect(k.Record._convertToNumber(-1.5)).toEqual(-1.5);
    expect(k.Record._convertToNumber(0)).toEqual(0);
  });

  it("aexlib.kintone._convertFromNumber converts a number to text.", function() {
    expect(k.Record._convertFromNumber('1')).toEqual('1');
    expect(k.Record._convertFromNumber('-1.5')).toEqual('-1.5');
    expect(k.Record._convertFromNumber('0')).toEqual('0');
    expect(k.Record._convertFromNumber(1)).toEqual('1');
    expect(k.Record._convertFromNumber(-1.5)).toEqual('-1.5');
    expect(k.Record._convertFromNumber(0)).toEqual('0');
  });

  it("k._toDoubleDigits fill '0' text to a number when the number is less than 10.", function() {
    expect(k._toDoubleDigits(0)).toEqual('00');
    expect(k._toDoubleDigits(9)).toEqual('09');
    expect(k._toDoubleDigits(10)).toEqual('10');
  });

  it("aexlib.kintone._convertToDate converts a value to Date.", function() {
    expect(k.Record._convertToDate('2012-01-11')).toEqual(new Date(2012, 0, 11));
    expect(k.Record._convertToDate('2004-02-29')).toEqual(new Date(2004, 1, 29));
    expect(k.Record._convertToDate(new Date(2012, 11, 31))).toEqual(new Date(2012, 11, 31));
    expect(k.Record._convertToDate('2012')).toBeNull();
    expect(k.Record._convertToDate('yyyy-01-11')).toBeNull();
    expect(k.Record._convertToDate('2012-MM-11')).toBeNull();
    expect(k.Record._convertToDate('2012-01-dd')).toBeNull();
  });

  it("aexlib.kintone._convertFromDate converts a date to text.", function() {
    expect(k.Record._convertFromDate('2012-01-11')).toEqual('2012-01-11');
    expect(k.Record._convertFromDate(new Date(2012, 0, 11))).toEqual('2012-01-11');
    expect(k.Record._convertFromDate(new Date(2004, 1, 29))).toEqual('2004-02-29');
  });

  it("aexlib.kintone._convertToDateTime converts text to a date time.", function() {
    var date = new Date(Date.UTC(2012, 0, 11, 13, 30, 0));
    expect(k.Record._convertToDateTime('2012-01-11T13:30:00Z')).toEqual(date);
    expect(k.Record._convertToDateTime(date)).toEqual(date);
    expect(k.Record._convertToDateTime('')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-11T13:30:00')).toBeNull();
    expect(k.Record._convertToDateTime('yyyy-01-11T13:30:00Z')).toBeNull();
    expect(k.Record._convertToDateTime('2012-MM-11T13:30:00Z')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-ddT13:30:00Z')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-11THH:30:00Z')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-11T13:mm:00Z')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-11T13:30:SSZ')).toBeNull();
    expect(k.Record._convertToDateTime('2012-01-11T13:30:00T')).toBeNull();
  });


  it("aexlib.kintone._convertFromDateTime converts a date time to text.", function() {
    var msec = Date.UTC(2012, 0, 11, 11, 30, 0);
    var date = new Date();
    date.setTime(msec);
    expect(k.Record._convertFromDateTime(date)).toEqual('2012-01-11T11:30:00Z');
    expect(k.Record._convertFromDateTime('2012-01-11T11:30:00Z')).toEqual('2012-01-11T11:30:00Z');
  });

  it("aexlib.kintone.App.updateSettings can update settings from the argument.", function(done) {
    var newSettings = {app:'id', revision:'2'};
    var result = {};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/settings');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1'});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateSettings(newSettings).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateSettings can update settings with guestSpaceId.", function(done) {
    var newSettings = {app:'id', value:'foo'};
    var result = {};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/5/v1/preview/app/settings');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1', value:'foo'});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateSettings(newSettings, {guestSpaceId:'5'}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateSettings return Promise.reject when failing the request.", function(done) {
    newSettings = {value:'foo', revision:'2'};
    a.settings = newSettings;

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params).toEqual({app:'1', value:'foo'});
      return new Promise(function(resolve, reject) { reject({message:'failed'}); });
    });

    a.updateSettings(newSettings).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      expect(a.settings.app).toBeUndefined();
      expect(a.settings.revision).toEqual('2');
      done();
    });
  });

  it("aexlib.kintone.App.updateSettings return Promise.reject and no revision doesn't touch settings.", function(done) {
    newSettings = {value:'foo'};
    a.settings = newSettings;

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params).toEqual({app:'1', value:'foo'});
      return new Promise(function(resolve, reject) { reject({message:'failed'}); });
    }); 

    a.updateSettings(newSettings).then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      expect(a.settings.app).toBeUndefined();
      expect(a.settings.revision).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.updateSettings returns Promise.reject(error) for undefined settings.", function(done) {
    a.updateSettings().then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.updateLayout can update layout from the argument.", function(done) {
    var newLayout = {app:'id', revision:'2'};
    var result = {};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/layout');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1'});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateLayout(newLayout).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateLayout can update layout with guest space id.", function(done) {
    var newLayout = {app:'id', revision:'2'};
    var result = {};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/form/layout');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateLayout(newLayout, {guestSpaceId:'foo'}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.updateViews can update views from the argument.", function(done) {
    var newViews = {app:'id', revision:'2'};
    var result = {foo:'bar'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/views');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1'});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateViews(newViews).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.createApp creates a new app in a test(preview) environment", function(done) {
    var appName = 'foo';
    var newAppId = '2';
    var result = {app:'2', revision:'1'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app');
      expect(request).toEqual('POST');
      expect(params).toEqual({name:'foo'});
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.createApp(appName).then(function(newApp) {
      expect(newApp.appId).toEqual(newAppId);
      done();
    });
  });

  it("aexlib.kintone.App.createApp creates a new app with space and thread", function(done) {
    var appName = 'foo';
    var space = 5;
    var thread = 10;
    var newAppId = '2';
    var result = {app:'2', revision:'1'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params).toEqual({name:'foo', space:5, thread:10});
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.createApp(appName, space, thread).then(function(newApp) {
      expect(newApp.appId).toEqual(newAppId);
      done();
    });
  });

  it("aexlib.kintone.App.createApp creates a new app for a guest space.", function(done) {
    var newAppId = '2';
    var result = {app:'2', revision:'1'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app');
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.createApp('bar', null, null, {guestSpaceId:'foo'}).then(function(newApp) {
      expect(newApp.appId).toEqual(newAppId);
      done();
    });
  });

  it("aexlib.kintone.App._isIgnoreField returns true when field is built-in and cannot be created/updated/deleted.", function() {
    expect(k.App._isIgnoreField({type:'STATUS'})).toEqual(true);
    expect(k.App._isIgnoreField({type:'STATUS_ASSIGNEE'})).toEqual(true);
    expect(k.App._isIgnoreField({type:'CATEGORY'})).toEqual(true);
    expect(k.App._isIgnoreField({type:'CREATOR'})).toEqual(false);
  });

  it("aexlib.kintone.App._isBuiltInField returns true when field is built-in field type.", function() {
    expect(k.App._isBuiltInField({type:'STATUS'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'STATUS_ASSIGNEE'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'CATEGORY'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'CREATOR'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'MODIFIER'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'CREATED_TIME'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'UPDATED_TIME'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'RECORD_NUMBER'})).toEqual(true);
    expect(k.App._isBuiltInField({type:'SINGLE_LINE_TEXT'})).toEqual(false);
  });

  it("aexlib.kintone.App.createFields adds fields.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('POST');
      expect(params).toEqual({app:'1', properties:{foo:{code:'foo', type:'SINGLE_LINE_TEXT'}}});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.createFields(fields).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.createFields adds fields with guestSpaceId.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/form/fields');
      expect(request).toEqual('POST');
      expect(params).toEqual({app:'1', properties:{foo:{code:'foo', type:'SINGLE_LINE_TEXT'}}});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.createFields(fields, {guestSpaceId:'foo'}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.updateFields update fields.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1', properties:{
          foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
          builtIn: {code:'builtIn', type:'CREATOR'}
      }});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFields(fields, {builtInFields:true, userFields:true}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });


  it("aexlib.kintone.App.updateFields update built-in fields when builtInFields is true.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1', properties:{
          builtIn: {code:'builtIn', type:'CREATOR'}
      }});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFields(fields, {builtInFields:true}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });


  it("aexlib.kintone.App.updateFields update user fields when userFields is true.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1', properties:{
          foo:{code:'foo', type:'SINGLE_LINE_TEXT'}
      }});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFields(fields, {userFields:true}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });


  it("aexlib.kintone.App.updateFields update user fields when userFields is true with guestSpaceId.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/form/fields');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.updateFields(fields, {userFields:true, guestSpaceId:'foo'}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.updateFields does not update when there is no option.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};

    a.updateFields(fields).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.removeFields remove fields.", function(done) {
    var fields = {properties:{
      foo:{code:'foo', type:'SINGLE_LINE_TEXT'},
      builtIn: {code:'builtIn', type:'CREATOR'},
      ignore: {code:'ignore', type:'STATUS'}
    }};
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('DELETE');
      expect(params).toEqual({app:'1', fields: ['foo', 'builtIn']});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.removeFields(fields).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.removeFields remove fields from code list.", function(done) {
    var fields = ['foo', 'bar'];
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/form/fields');
      expect(request).toEqual('DELETE');
      expect(params).toEqual({app:'1', fields: fields});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.removeFields(fields).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.removeFields remove fields with guestSpaceId.", function(done) {
    var fields = ['foo', 'bar'];
    var result = {revision:'3'};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/form/fields');
      return new Promise(function(resolve) { resolve(result); });
    });

    a.removeFields(fields, {guestSpaceId:'foo'}).then(function(resp) {
      expect(resp).toEqual({revision:'3'});
      done();
    });
  });

  it("aexlib.kintone.App.removeFields return reject when fields are not correct type.", function(done) {
    a.removeFields({}).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy applications.", function(done) {
    var apps = [ k.App.getApp('1'), k.App.getApp('2')];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('POST');
      expect(params).toEqual({apps:[{app:'1'}, {app:'2'}]});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    k.App.deployAll(apps).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy a single appId.", function(done) {
    var appId = '1';

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('POST');
      expect(params).toEqual({apps:[{app:'1'}]});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    k.App.deployAll(appId).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy number appIds with revert option.", function(done) {
    var appIds = [1,2,3];

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('POST');
      expect(params).toEqual({apps:[{app:1}, {app:2}, {app:3}], revert:true});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    k.App.deployAll(appIds, {revert:true}).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy an app with revert false option.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(params).toEqual({apps:[{app:'1'}]});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    k.App.deployAll(['1'], {revert:false}).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy an app with revert false and guestSpaceId options.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/deploy');
      expect(params).toEqual({apps:[{app:'1'}]});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    k.App.deployAll(['1'], {guestSpaceId:'foo', revert:false}).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deployAll deploy error when invalid value is set.", function(done) {
    k.App.deployAll(null, {revert:false}).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.statusAll checks status for applications.", function(done) {
    var result = {apps:[{app:1, status:'PROCESSING'}, {app:2, status:'PROCESSING'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('GET');
      expect(params).toEqual({apps:[1,2]});
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.statusAll([1,2]).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.statusAll can handle an object like App instead of Array.", function(done) {
    var result = {apps:[{app:1, status:'PROCESSING'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('GET');
      expect(params).toEqual({apps:[1]});
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.statusAll(k.App.getApp('1')).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.statusAll can handle an object like App instead of Array.", function(done) {
    var result = {apps:[{app:1, status:'PROCESSING'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/preview/app/deploy');
      expect(request).toEqual('GET');
      expect(params).toEqual({apps:[1]});
      return new Promise(function(resolve) { resolve(result); });
    });

    k.App.statusAll(k.App.getApp('1'), {guestSpaceId:'foo'}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.App.statusAll throw when invalid argument is set.", function(done) {
    k.App.statusAll(null).then(function() {}, function(error) {
      expect(error.message).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.App.deploy deploy a current App.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('POST');
      expect(params).toEqual({apps:[{app:'1'}]});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    a.deploy().then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.deploy can revert a current App when {revert:true} is set.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('POST');
      expect(params).toEqual({apps:[{app:'1'}], revert:true});
      return new Promise(function(resolve) { resolve(); });
    });

    // No response from manual.
    a.deploy({revert:true}).then(function(resp) {
      expect(resp).toBeUndefined();
      done();
    });
  });

  it("aexlib.kintone.App.status check a current App status.", function(done) {
    var result = {apps:[{app:1, status:'PROCESSING'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/preview/app/deploy');
      expect(request).toEqual('GET');
      expect(params).toEqual({apps:[1]});
      return new Promise(function(resolve) { resolve(result); });
    });

    a.status().then(function(resp) {
      expect(resp.status).toEqual('PROCESSING');
      done();
    });
  });

  it("aexlib.kintone.App.copy can copy configs from an existing app to a new created app.", function(done) {
    var resultSettings = {
      "name": "Foo",
      "description": "desc",
      "icon": {
        "type": "PRESET",
        "key": "APP60"
      },
      "theme": "WHITE",
      "revision": "24"
    };

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      if (url === '/k/v1/app/settings' && request === 'GET') {
        expect(params.app).toEqual('1');
        return new Promise(function(resolve) { resolve(resultSettings); });
      } else if (url === '/k/v1/app/form/fields' && request === 'GET') {
        expect(params.app).toEqual('1');
        return new Promise(function(resolve) { resolve({properties: { 'foo': {code:'foo'} } }); });
      } else if (url === '/k/v1/app/form/layout' && request === 'GET') {
        expect(params).toEqual({app:'1'});
        return new Promise(function(resolve) { resolve({layout:[{type:'ROW'}]}); });
      } else if (url === '/k/v1/app/views' && request === 'GET') {
        expect(params.app).toEqual('1');
        return new Promise(function(resolve) { resolve({views:{'viewNameKey':{name:'viewNameKey'}}}); });
      } else if (url === '/k/v1/preview/app' && request === 'POST') {
        expect(params.name).toEqual('new_app');
        return new Promise(function(resolve) { resolve({app:'2', revision:'1'}); });
      } else if (url === '/k/v1/preview/app/settings' && request === 'PUT') {
        expect(params.app).toEqual('2');
        expect(params.name).toBeUndefined();
        expect(params.description).toEqual(resultSettings.description);
        expect(params.icon).toEqual(resultSettings.icon);
        expect(params.theme).toEqual(resultSettings.theme);
        return new Promise(function(resolve) { resolve( {app:'2', revision:'2'}); });
      } else if (url === '/k/v1/preview/app/form/fields' && request === 'POST') {
        expect(params.app).toEqual('2');
        expect(params.properties).toBeDefined();
        return new Promise(function(resolve) { resolve({revision:'4'}); });
      } else if (url === '/k/v1/preview/app/form/fields' && request === 'PUT') {
        expect(params.app).toEqual('2');
        return new Promise(function(resolve) { resolve({revision:'5'}); });
      } else if (url === '/k/v1/preview/app/form/layout' && request === 'PUT') {
        expect(params.app).toEqual('2');
        return new Promise(function(resolve) { resolve({revision:'6'}); });
      } else if (url === '/k/v1/preview/app/views' && request === 'PUT') {
        expect(params.app).toEqual('2');
        return new Promise(function(resolve) { resolve({revision:'7'}); });
      } else if (url === '/k/v1/preview/app/deploy' && request === 'POST') {
        expect(params.apps[0].app).toEqual('2');
        return new Promise(function(resolve) {resolve();});
      }

      expect('This should no tbe called').toBe();
    });

    a.copy({name:'new_app'}).then(function(resp) {
      expect(resp instanceof k.App).toEqual(true);
      expect(resp.appId).toEqual('2');
      done();
    });
  });

  it("aexlib.kintone.App.copy may call error response(Promise.reject) when there is a problem.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      return k._reject({message:'failed'});
    });

    a.copy({name:'new_app'}).then(function() {}, function(error) {
      expect(error.message).toEqual('failed');
      done();
    });
  });

  it("aexlib.kintone._requestPath generates a request path from command and space id.", function() {
    expect(k._requestPath('records')).toEqual('/k/v1/records');
    expect(k._requestPath('records', {guestSpaceId:'5'})).toEqual('/k/guest/5/v1/records');
    expect(k._requestPath('records', {preview:true})).toEqual('/k/v1/preview/records');
    expect(k._requestPath('records', {guestSpaceId:'5', preview:'true'})).toEqual('/k/guest/5/v1/preview/records');
  });


  it("aexlib.kintone.Space creates a class to handle kintone Space", function() {
    var space = new k.Space('foo');
    expect(space.id).toEqual('foo');
  });

  it("aexlib.kintone.getSpace creates a new Space instance and return it.", function() {
    var space = k.Space.getSpace('foo', true);
    expect(space.id).toEqual('foo');
    expect(space._isGuest).toEqual(true);
  });

  it("aexlib.kintone.Space.create creates a new Space in kintone.", function(done) {
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/template/space');
      expect(request).toEqual('POST');
      expect(params.id).toEqual(1);
      expect(params.name).toEqual('foo');
      return new Promise(function(resolve) { resolve({id: 'bar'}); });
    });

    k.Space.create({id:1, name:'foo'}).then(function(space) {
      expect(space.id).toEqual('bar');
      done();
    });
  });

  it("aexlib.kintone.Space.fetchSpace fetch space info and return Promise.", function(done) {
    var space = new k.Space('foo');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve({id: 'foo', name:'bar', isGuest:true}); });
    });

    space.fetchSpace().then(function(info) {
      expect(info.id).toEqual('foo');
      expect(info.name).toEqual('bar');
      expect(space._isGuest).toEqual(true);
      done();
    });
  });

  it("aexlib.kintone.Space.fetchSpace fetch space info for guest and return Promise.", function(done) {
    var space = new k.Space('foo');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve({id: 'foo', name:'bar'}); });
    });

    space.fetchSpace(true).then(function(info) {
      expect(info.id).toEqual('foo');
      expect(info.name).toEqual('bar');
      expect(space.space).toBeDefined();
      done();
    });
  });

  it("aexlib.kintone.Space.remove remove a space from kintone", function(done) {
    var space = new k.Space('foo');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space');
      expect(request).toEqual('DELETE');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve({}); });
    });

    space.remove().then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.remove remove a space from kintone for guest", function(done) {
    var space = new k.Space('foo');

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space');
      expect(request).toEqual('DELETE');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve({}); });
    });

    space.remove(true).then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.updateBody updates a body text in kintone", function(done) {
    var space = new k.Space('foo');
    var body = '<a href="bar">link</a>';

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space/body');
      expect(request).toEqual('PUT');
      expect(params.id).toEqual('foo');
      expect(params.body).toEqual(body);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateBody(body).then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.updateBody updates a body text for a guest in kintone", function(done) {
    var space = new k.Space('foo', true);
    var body = '<a href="bar">link</a>';

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space/body');
      expect(request).toEqual('PUT');
      expect(params.id).toEqual('foo');
      expect(params.body).toEqual(body);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateBody(body).then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });


  it("aexlib.kintone.Space.updateThread updates thread text in kintone", function(done) {
    var space = new k.Space('foo');
    var body = '<a href="bar">link</a>';

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space/thread');
      expect(request).toEqual('PUT');
      expect(params.id).toEqual('foo');
      expect(params.name).toEqual('bar');
      expect(params.body).toEqual(body);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateThread('bar', body).then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.updateThread updates thread text for a guest space in kintone", function(done) {
    var space = new k.Space('foo');
    var body = '<a href="bar">link</a>';

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space/thread');
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateThread('bar', body, true).then(function(info) {
      expect(info).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.createGuests adds guests in kintone", function(done) {
    var p = {guests:[{code:'foo@example.com'}, {code:'bar@example.com'}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/guests');
      expect(request).toEqual('POST');
      expect(params).toEqual(p);
      return new Promise(function(resolve) { resolve({}); });
    });

    k.Space.createGuests(p).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.fetchMembers fetch member info for a space", function(done) {
    var space = new k.Space('foo');
    var result = {members:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space/members');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve(result); });
    });

    space.fetchMembers().then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.Space.fetchMembers fetch member info for a guest space id", function(done) {
    var space = new k.Space('foo');
    var result = {members:[]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space/members');
      expect(request).toEqual('GET');
      expect(params.id).toEqual('foo');
      return new Promise(function(resolve) { resolve(result); });
    });

    space.fetchMembers(true).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });


  it("aexlib.kintone.Space.updateMembers update member info in a space", function(done) {
    var space = new k.Space('foo');
    var result = {members:[{entry:{},isAdmin:false}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/space/members');
      expect(request).toEqual('PUT');
      expect(params.id).toEqual('foo');
      expect(params.members).toEqual(result.members);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateMembers(result).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.updateMembers update member info for a guest space", function(done) {
    var space = new k.Space('foo');
    var result = {members:[{entry:{},isAdmin:false}]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space/members');
      expect(params.members).toEqual(result.members);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateMembers(result, true).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });

  it("aexlib.kintone.Space.updateGuests update member info for a guest space", function(done) {
    var space = new k.Space('foo');
    var result = {guests:["foo@example.com", "bar@example.com"]};

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/guest/foo/v1/space/guests');
      expect(request).toEqual('PUT');
      expect(params.id).toEqual('foo');
      expect(params.guests).toEqual(result.guests);
      return new Promise(function(resolve) { resolve({}); });
    });

    space.updateGuests(result).then(function(resp) {
      expect(resp).toEqual({});
      done();
    });
  });


  it("aexlib.kintone.BulkRequest.newRequest is to create a new instance.", function() {
    expect(b._requests).toBeDefined();
  });

  it("aexlib.kintone.BulkRequest._add can add a new request.", function() {
    b._add('GET', '/k/v1/records', {foo:'bar'});
    expect(b._requests[0]).toEqual({method:'GET', api:'/k/v1/records', payload:{foo:'bar'}});
  });

  it("aexlib.kintone.BulkRequest.send is to send a bulk request.", function(done) {
    var result = {dummy:'foo'};
    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/bulkRequest');
      expect(request).toEqual('POST');
      expect(params.requests).toEqual([{foo:'bar'}]);
      return new Promise(function(resolve) { resolve(result); });
    });

    b._requests.push({foo:'bar'});

    b.send().then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.BulkRequest can add a request.", function() {
    var r = a.newRecord();
    r.val('foo', 'bar');
    r.save(b);
    expect(b._requests.length).toEqual(1);
    expect(b._requests[0]).toEqual({method:'POST', api:'/k/v1/record', payload:{app:'1', record:{'foo':{value:'bar'}}}});
  });

  it("aexlib.kintone.BulkRequest can add some requests.", function() {
    var r1 = a.newRecord({'foo':{value:'bar'}});
    var r2 = a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}, 'foo':{value:'foo'}});
    r2.val('foo', 'bar2');

    r1.save(b);
    r2.save(b, {guestSpaceId:'hoge', preview:true});
    r2.remove(b);

    expect(b._requests.length).toEqual(3);
    expect(b._requests[0]).toEqual({method:'POST', api:'/k/v1/record', payload:{app:'1', record:{'foo':{value:'bar'}}}});
    expect(b._requests[1]).toEqual({method:'PUT', api:'/k/guest/hoge/v1/preview/record',
        payload:{app:'1', id: 2, revision: 3, record:{'foo':{value:'bar2'}}}});
    expect(b._requests[2]).toEqual({method:'DELETE', api:'/k/v1/records', payload:{app:'1', ids:[2], revisions:[3]}});
  });

  it("aexlib.kintone.Record.saveAll can use with a bulk request.", function() {
    var records = [
      a.newRecord({'foo':{value:'bar'}}),
      a.newRecord({'foo':{value:'hoge'}})
    ];

    k.Record.saveAll(records, b);
    expect(b._requests[0]).toEqual({method:'POST', api:'/k/v1/records',
      payload:{app:'1', records:[{foo:{value:'bar'}}, {foo:{value:'hoge'}}]}});
  });


  it("aexlib.kintone.Record.updateAll can use with a bulk request.", function() {
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

    k.Record.updateAll(records, b, {guestSpaceId:'hoge', preview:true});
    expect(b._requests[0]).toEqual({method:'PUT', api:'/k/guest/hoge/v1/preview/records',
      payload:{app:'1', records:paramRecords}});
  });

  it("aexlib.kintone.Record.removeAll can use with a bulk request.", function() {
    var records = [
      a.newRecord({'$id':{value:'2'}, '$revision':{value:'3'}}),
      a.newRecord({'$id':{value:'5'}, '$revision':{value:'6'}})
    ];

    k.Record.removeAll(records, b);
    expect(b._requests[0]).toEqual({method:'DELETE', api:'/k/v1/records',
      payload:{app:'1', ids:[2,5], revisions:[3,6]}});
  });

  it("aexlib.kintone.Record.saveAll can use with a bulk request.", function() {
    var records = [];
    var result = [];
    for (var i = 0;i < 101;i++) {
        var rec = {'foo':{value:('bar' + i)}};
        result.push(rec);
        records.push(a.newRecord(rec));
    }

    k.Record.saveAll(records, b);
    expect(b._requests.length).toEqual(2);
    expect(b._requests[1]).toEqual({method:'POST', api:'/k/v1/records',
      payload:{app:'1', records:[result[100]]}});
  });

  it("aexlib.kintone.Record.updateStatus can update status for a record.", function() {
    var result = {dummy:'foo'};
    var r = a.newRecord({'$id':{value:'2'}});

    spyOn(kintone, 'api').and.callFake(function(url, request, params) {
      expect(url).toEqual('/k/v1/records/status');
      expect(request).toEqual('PUT');
      expect(params).toEqual({app:'1', id:2, action:'foo'});
      return new Promise(function(resolve) { resolve(result); });
    });

    r.updateStatus({action:'foo'}).then(function(resp) {
      expect(resp).toEqual(result);
      done();
    });
  });

  it("aexlib.kintone.Record.updateStatusAll can update status for records.", function() {
    expect(1).toBe(2);
  });
});

