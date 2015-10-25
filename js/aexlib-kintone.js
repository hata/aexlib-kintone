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

var aexlib = aexlib || {};

(function(k) {
    k._MAX_FETCH_LIMIT = 100;
    k._MAX_UPDATE_LIMIT = 100;
    k._DEFAULT_VALIDATE_REVISION = true;
    k._DEFAULT_LANG = "default";
    k._UNKNOWN_ERROR = 'Unknown error';
    k._WRONG_QUERY_TYPE_ERROR = 'Wrong query parameter type found.';
    k._NO_UPDATE_FOUND_ERROR = 'No update found';
    k._NO_RECORD_ID_FOUND_ERROR = 'No record id found';
    k._NO_RECORD_FOUND = 'No record found';
    k._UNKNOWN_UPDATE_REQUEST_FOUND_ERROR = 'Unknown update request found.';
    k._CANNOT_USE_BOTH_POST_AND_PUT_REQUESTS = 'Cannot use both POST and PUT requests.';

    k.NUMBER_TYPE = 'NUMBER';

    k.REVISION_CODE = '$revision';
    k.REVISION_TYPE = '__REVISION__';

    k.RECORD_ID_CODE = '$id';
    k.RECORD_ID_TYPE = '__ID__';


    k._isDefined = function(x) {
        return x !== undefined;
    };

    k._isUndefined = function(x) {
        return x === undefined;
    };

    k._isString = function(x) {
        return typeof x === 'string' || x instanceof String;
    };

    k._reject = function(message) {
        if (kintone.Promise) {
            return kintone.Promise.reject(message);
        } else if (Promise) {
            return Promise.reject(message);
        } else {
            throw new Error('No Promise found.');
        }
    };

    k._requestFunc = function() {
        if (kintone.api) {
            return kintone.api;
        } else {
            throw new Error('No kintone.api found.');
        }
    };

    /*
     * required:
     * fetchParams.url = '/k/v1/apps'
     * fetchParams.request = 'GET'
     * fetchParams.resultProperty = 'apps'
     * options:
     * fetchParams.max = <Set max returns>
     * fetchParams.params = <Set a specific params for kintone.api request.>
     */
    k._recursiveFetch = function(fetchParams, opt_offset, opt_limit, opt_result) {
        var offset = opt_offset || 0;
        var limit = opt_limit || k._MAX_FETCH_LIMIT;
        var result = opt_result || [];

        if (fetchParams.max && fetchParams.max > 0 && fetchParams.max < (offset + limit)) {
            limit = fetchParams.max - offset;
        }

        var params = k._isDefined(fetchParams.params) ? fetchParams.params : {};
        params.limit = limit;
        params.offset = offset;

        return k._requestFunc()(fetchParams.url, fetchParams.request, params).then(function(resp) {
            result = result.concat(resp[fetchParams.resultProperty]);
            if (resp[fetchParams.resultProperty].length === limit &&
                (!fetchParams.max || (offset + limit) < fetchParams.max)) {
                return k._recursiveFetch(fetchParams, offset + limit, limit, result);
            } else {
                return result;
            }
        }, function(errResp) {
            return k._reject(k._isDefined(errResp.message) ? errResp.message : k._UNKNOWN_ERROR);
        });
    };

    k._fetch = function(url, request, params, obj, property) {
        return k._requestFunc()(url, request, params).then(function(resp) {
            if (obj && property) {
                obj[property] = resp;
            }
            return resp;
        }, function(errResp) {
            return k._reject(k._isDefined(errResp.message) ? errResp.message : k._UNKNOWN_ERROR);
        });
    };


    /**
     * This do not support multiple appId update in 1 txn.
     *
     * updateParams.url = '/k/v1/records'
     * updateParams.request = 'PUT'
     * updateParams.toParamsHandler = function(appId, records, validateRevisions) {}
     * updateParams.toResultHandler = function(records, resp, cumulativeResult) {}
     */
    k._recursiveUpdate = function(updateParams, records, opt_validateRevisions, opt_result) {
        var validateRevisions = k.Record._isValidationEnabled(opt_validateRevisions);
        var remains;
        var params;
        var appId;
        var i;
        var maxLoopLength;
        var record;

        if (k._isUndefined(records) || records.length === 0) {
            return k._reject(k._NO_RECORD_FOUND);
        }

        maxBatchSize = records.length > k._MAX_UPDATE_LIMIT ? k._MAX_UPDATE_LIMIT : records.length;

        for (i = 0;i < maxBatchSize;i++) {
            record = records[i];
            if (i === 0) {
                appId = record.app.appId;
            } else if (appId !== record.app.appId) {
                break;
            }
        }

        if (records.length > i) {
            remains = records.slice(i);
            records = records.slice(0, i);
        }
        params = updateParams.toParamsHandler(appId, records, validateRevisions);

        return k._requestFunc()(updateParams.url, updateParams.request, params).then(function(resp) {
            var result = updateParams.toResultHandler(records, resp, opt_result);
            return remains ? k._recursiveUpdate(updateParams, remains, validateRevisions, result) : result;
        }, function(errResp) {
            return k._reject(k._isDefined(errResp.message) ? errResp.message : k._UNKNOWN_ERROR);
        });
    };


    k._newQuery = function(app) {
        return new k.Query(app);
    };

    k._newRecord = function(app, opt_record) {
        return new k.Record(app, opt_record);
    };

    k.App = function(appIdOrApp, opt_fields) {
        if (appIdOrApp && appIdOrApp.app) {
            this.appId = appIdOrApp.app;
            this.app = appIdOrApp;
        } else {
            this.appId = appIdOrApp;
        }
        this.fields = opt_fields;
        this.lang = k._DEFAULT_LANG;
    };

    k.App.getApp = function(opt_appId) {
        var appId = k._isDefined(opt_appId) ? opt_appId : kintone.app.getId();
        return new k.App(appId);
    };

    k.App.fetchApps = function() {
        return k._recursiveFetch({url: '/k/v1/apps', request:'GET', resultProperty: 'apps'}).then(function(apps) {
            return apps.map(function(app) { return new k.App(app); });
        });
    };

    k.App.prototype.fetchApp = function() {
        return k._fetch('/k/v1/app', 'GET', {id: this.appId, lang: this.lang}, this, 'app');
    };

    /**
     * opt_params = {preview: true|false}
     */
    k.App.prototype.fetchFields = function(opt_params) {
        var url = k._isDefined(opt_params) && opt_params.preview ? '/k/v1/preview/app/form/fields' : '/k/v1/app/form/fields';
        return k._fetch(url, 'GET', {id: this.appId, lang: this.lang}, this, 'fields');
    };

    /**
     * @param opt_maxRecordNum is not set, then this value is 1. In this case,
     * Promise returns a Record instance instead of an array of Records.
     * If this value is 2 or more than 2, then Promise returns an array of Record
     * instances.
     */
    k.App.prototype.first = function(opt_maxRecordNum) {
        return k._newQuery(this).first(opt_maxRecordNum);
    };

    k.App.prototype.select = function(opt_fieldCodes) {
        return k._newQuery(this).select(opt_fieldCodes);
    };

    k.App.prototype.where = function(opt_cond) {
        return k._newQuery(this).where(opt_cond);
    };

    k.App.prototype.order = function(order) {
        return k._newQuery(this).order(order);
    };

    k.App.prototype.newRecord = function(opt_record) {
        return k._newRecord(this, opt_record);
    };

    k.Query = function(app) {
      this.app = app;
      this._qParams = [];
      this._orders = undefined;
      this._limit = undefined;
      this._offset = undefined;
    };

    k.Query.Constant = function(text) {
      this.text = text;
    };

    k.Query.LOGINUSER  = new k.Query.Constant('LOGINUSER()');
    k.Query.NOW        = new k.Query.Constant('NOW()');
    k.Query.TODAY      = new k.Query.Constant('TODAY()');
    k.Query.THIS_MONTH = new k.Query.Constant('THIS_MONTH()');
    k.Query.LAST_MONTH = new k.Query.Constant('LAST_MONTH()');
    k.Query.THIS_YEAR  = new k.Query.Constant('THIS_YEAR()');

    /**
     * Get a first instance.
     * @return Promise. If it succeeded, then return record. Otherwise, undefined.
     * If kintone returns an error response, then reject is called by Promise.
     */
    k.Query.prototype.first = function(opt_maxRecordNum) {
        var maxRecordNum = k._isDefined(opt_maxRecordNum) ? opt_maxRecordNum : 1;
        var self = this;
        var params;

        this.offset(0);
        this.limit(maxRecordNum);
        params = { app: this.app.appId, fields: this._fields, query:this._buildQuery() };

        return k._recursiveFetch({url: '/k/v1/records', request:'GET', params:params,
            resultProperty: 'records', max: maxRecordNum}).then(function(records) {

            return records.length > 1 ?
                records.map(function(rec) { return new k.Record(self.app, rec); }) :
                (records.length === 1 ? new k.Record(self.app, records[0]) :
                                        (maxRecordNum > 1 ? [] : undefined));
        });
    };


    /**
     * Set fields parameter to query records.
     * 
     * q.select(['code1', 'code2']) 
     * or
     * q.select('code1')
     */
    k.Query.prototype.select = function(fieldCodes) {
        if (k._isDefined(fieldCodes)) {
            this._fields = this._fields || [];

            if (Array.isArray(fieldCodes)) {
                this._fields = this._fields.concat(fieldCodes);
            } else {
                this._fields.push(fieldCodes);
            }
        }

        return this;
    };


    /**
     * q.where('code = "foo"') ...
     * q.where(q.equal('code', 'foo').and(). ...)
     * q.where(q.cond(q.equal(a,b).lessThan(c,d)).and(q.equal(...)))
     */
    k.Query.prototype.where = function(cond) {
        if (k._isString(cond)) {
            this._qParams.push(cond);
        } else if (cond instanceof k.Query.Condition) {
            this._qParams.push(cond.toString());
        } else {
            throw new Error(k._WRONG_QUERY_TYPE_ERROR);
        }
        return this;
    };


    k.Query.prototype.order = function(orderValue) {
        if (k._isUndefined(this._orders)) {
            this._orders = [];
        }
        this._orders.push(orderValue);
        return this;
    };

    k.Query.prototype.orderAsc = function(fieldCode) {
        return this.order(fieldCode + ' asc');
    };

    k.Query.prototype.orderDesc = function(fieldCode) {
        return this.order(fieldCode + ' desc');
    };

    k.Query.prototype.equal = function(fieldCode, value) {
        return new k.Query.Condition().equal(fieldCode, value);
    };

    k.Query.prototype.notEqual = function(fieldCode, value) {
        return new k.Query.Condition().notEqual(fieldCode, value);
    };

    k.Query.prototype.greaterThan = function(fieldCode, value) {
        return new k.Query.Condition().greaterThan(fieldCode, value);
    };

    k.Query.prototype.lessThan = function(fieldCode, value) {
        return new k.Query.Condition().lessThan(fieldCode, value);
    };

    k.Query.prototype.greaterEqual = function(fieldCode, value) {
        return new k.Query.Condition().greaterEqual(fieldCode, value);
    };

    k.Query.prototype.lessEqual = function(fieldCode, value) {
        return new k.Query.Condition().lessEqual(fieldCode, value);
    };

    k.Query.prototype.inList = function(fieldCode, value) {
        return new k.Query.Condition().inList(fieldCode, value);
    };

    k.Query.prototype.notInList = function(fieldCode, value) {
        return new k.Query.Condition().notInList(fieldCode, value);
    };

    k.Query.prototype.like = function(fieldCode, value) {
        return new k.Query.Condition().like(fieldCode, value);
    };

    k.Query.prototype.notLike = function(fieldCode, value) {
        return new k.Query.Condition().notLike(fieldCode, value);
    };

    k.Query.prototype.cond = function(conds) {
        return new k.Query.Condition(conds);
    };


    k.Query.prototype.limit = function(numLimit) {
        this._limit = numLimit;
        return this;
    };

    k.Query.prototype.offset = function(numOffset) {
        this._offset = numOffset;
        return this;
    };

    k.Query.prototype._buildQuery = function() {
        var stmt = this._qParams.join(' ');
        if (k._isDefined(this._orders)) {
            var orderBy = stmt ? ' order by ' : 'order by ';
            stmt += orderBy + this._orders.join(', ');
        }
        if (k._isDefined(this._limit)) {
            stmt += (stmt ? ' limit ' : 'limit ') + this._limit;
        }
        if (k._isDefined(this._offset)) {
            stmt += (stmt ? ' offset ' : 'offset ') + this._offset;
        }
        return stmt;
    };


    k.Query.Condition = function(query) {
        this._qParams = [];
        if (k._isString(query)) {
            this._qParams.push('(' + query + ')');
        } else if (query instanceof k.Query.Condition) {
            this._qParams.push('(' + query.toString() + ')');
        }
    };

    k.Query.Condition.prototype.equal = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '=', value);
    };

    k.Query.Condition.prototype.notEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '!=', value);
    };

    k.Query.Condition.prototype.greaterThan = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '>', value);
    };

    k.Query.Condition.prototype.lessThan = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '<', value);
    };

    k.Query.Condition.prototype.greaterEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '>=', value);
    };

    k.Query.Condition.prototype.lessEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '<=', value);
    };

    k.Query.Condition.prototype.inList = function(fieldCode, values) {
        return this._appendQuery(fieldCode + ' in (' + k.Query.Condition._toListString(fieldCode, values) + ')');
    };

    k.Query.Condition.prototype.notInList = function(fieldCode, values) {
        return this._appendQuery(fieldCode + ' not in (' + k.Query.Condition._toListString(fieldCode, values) + ')');
    };

    k.Query.Condition.prototype.like = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, 'like', value);
    };

    k.Query.Condition.prototype.notLike = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, 'not like', value);
    };

    k.Query.Condition.prototype.or = function(value) {
        this._qParams.push('or');
        if (k._isDefined(value)) {
            this._qParams.push(new k.Query.Condition(value).toString());
        }
        return this;
    };

    k.Query.Condition.prototype.and = function(value) {
        this._qParams.push('and');
        if (k._isDefined(value)) {
            this._qParams.push(new k.Query.Condition(value).toString());
        }
        return this;
    };

    k.Query.Condition.prototype.toString = function() {
        return this._qParams.join(' ');
    };

    k.Query.Condition.prototype._addOperatorQuery = function(fieldCode, op, value) {
        return this._appendQuery(fieldCode + ' ' + op + ' ' + k.Query.Condition._toQueryValue(fieldCode, value));
    };

    k.Query.Condition.prototype._appendQuery = function(queryText) {
        if (this._qParams.length > 0 && this._qParams.length % 2 === 1) {
            this._qParams.push('and');
        }
        this._qParams.push(queryText);
        return this;
    };

    k.Query.Condition._toListString = function(code, values) {
        if (values instanceof k.Record) {
            values = values.val(code);
        }
        if (!Array.isArray(values)) {
            values = [values];
        }
        return values.map(function(x) { return k.Query.Condition._escapeValue(code, x); }).join();
    };

    k.Query.Condition._toQueryValue = function(fieldCode, value) {
        return value instanceof k.Query.Constant ? value.text : k.Query.Condition._escapeValue(fieldCode, value);
    };

    k.Query.Condition._escapeValue = function(fieldCode, value) {
        if (value instanceof k.Record) {
            value = value.val(fieldCode);
        }

        value = value.toString();
        // NOTE: Do we need this escape ?
        value = value.replace(/"/g, '\\"');
        return '"' + value + '"';
    };


    /**
     * Record instance.
     */
    k.Record = function(app, record) {
        this.app = app;
        this.record = record;
        this.updated = undefined;
    };

// TODO: buik update should also be required.

    /**
     * This only support for the same request types like update(PUT) or create(POST).
     * records should not have both update and create records at the same time.
     */
    k.Record.saveAll = function(records, opt_validateRevisions) {
       var i;
       var recordId;
       var creatingRecords = [];
       var updatingRecords = [];

       if (records && records.length > 0) {
           for (i = 0;i < records.length;i++) {
               recordId = records[i].recordId();
               if (k._isDefined(recordId) && records[i].isUpdated()) {
                   updatingRecords.push(records[i]);
               } else if (k._isUndefined(recordId)) {
                   creatingRecords.push(records[i]);
               }
           }
       }

       if (creatingRecords.length > 0 && updatingRecords.length > 0) {
           return k._reject(k._CANNOT_USE_BOTH_POST_AND_PUT_REQUESTS);
       }

       if (creatingRecords.length > 0) {
           return k.Record.createAll(creatingRecords, opt_validateRevisions);
       } else if (updatingRecords.length > 0) {
           return k.Record.updateAll(updatingRecords, opt_validateRevisions);
       } else {
           return k._reject(k._NO_UPDATE_FOUND_ERROR);
       }
    };

    k.Record.createAll = function(records, opt_validateRevisions) {
        return k._recursiveUpdate(k.Record._getCreateParams(), records, opt_validateRevisions);
    };

    k.Record.updateAll = function(records, opt_validateRevisions) {
        return k._recursiveUpdate(k.Record._getUpdateParams(), records, opt_validateRevisions);
    };

    k.Record.removeAll = function(records, opt_validateRevisions) {
        return k._recursiveUpdate(k.Record._getRemoveParams(), records, opt_validateRevisions);
    };

    k.Record._getUpdateParams = function() {
        var toParamsHandler = function(appId, records, validateRevisions) {
            var updatedRecords = records.map(function(record) {
                return validateRevisions ?
                    {id:record.recordId(), revision:record.revision(), record:record.updated} :
                    {id:record.recordId(), record:record.updated};
            });
            return { app: appId, records:updatedRecords };
        };

        var toResultHandler = function(records, resp, cumulativeResult) {
            var i, m, r;
            for (i = 0;i < resp.records.length;i++) {
                r = resp.records[i];
                if (r.id == records[i].recordId()) {
                    records[i].revision(r.revision);
                } else {
                    // Note: I'm not sure we need this type of result.
                    // This call is used when the response is disorder of params.record.
                    for (m = 0;m < records.length;m++) {
                        if (r.id == records[m].recordId()) {
                            records[m].revision(r.revision);
                            break;
                        }
                    }
                }
            }

            var result = k._isDefined(cumulativeResult) ? cumulativeResult : {records:[]};
            result.records = result.records.concat(resp.records);
            return result;
        };

        return {
            url: '/k/v1/records',
            request:'PUT',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    k.Record._getCreateParams = function() {
        var toParamsHandler = function(appId, records, validateRevisions) {
            var updatedRecords = records.map(function(record) {
                return record.record;
            });
            return { app: appId, records:updatedRecords };
        };

        var toResultHandler = function(records, resp, opt_result) {
            for (var i = 0;i < resp.ids.length;i++) {
                records[i].recordId(resp.ids[i]);
                records[i].revision(resp.revisions[i]);
            }

            return k._isDefined(opt_result) ?
                {ids:opt_result.ids.concat(resp.ids), revisions:opt_result.revisions.concat(resp.revisions)} :
                {ids:resp.ids, revisions:resp.revisions};
        };

        return {
            url: '/k/v1/records',
            request:'POST',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    k.Record._getRemoveParams = function() {
        var toParamsHandler = function(appId, records, validateRevisions) {
            var recordIds = [];
            var revisions = [];
            for (var i = 0;i < records.length;i++) {
                recordIds.push(records[i].recordId());
                if (validateRevisions) {
                    revisions.push(records[i].revision());
                }
            }

            return validateRevisions ?
                {app:appId, ids:recordIds, revisions:revisions} :
                {app:appId, ids:recordIds};
        };

        var toResultHandler = function(records, resp, opt_result) { return {}; };

        return {
            url: '/k/v1/records',
            request:'DELETE',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    k.Record._convertToTypeValue = function(fields, record, code) {
        var value = record && record[code] ? record[code].value : undefined;
        var type = fields && fields[code] ? fields[code].type : (record && record[code] ? record[code].type : undefined);
        var funcTable = {};
        var func;

        funcTable[k.NUMBER_TYPE] = function(x) {
            return k._isString(x) ? (x.indexOf('.') != -1 ? parseFloat(x) : parseInt(x)) : x;
        };
        funcTable[k.REVISION_TYPE] = funcTable[k.NUMBER_TYPE];
        funcTable[k.RECORD_ID_TYPE] = funcTable[k.NUMBER_TYPE];

        func = funcTable[type];
        return func ? func(value) : value;
    };

    k.Record._convertFromTypeValue = function(fields, record, code, newValue) {
        var type = fields && fields[code] ? fields[code].type : (record && record[code] ? record[code].type : undefined);
        var funcTable = {};
        var func;

        funcTable[k.NUMBER_TYPE] = function(value) { return k._isString(value) ? value : '' + value; };
        funcTable[k.REVISION_TYPE] = funcTable[k.NUMBER_TYPE];
        funcTable[k.RECORD_ID_TYPE] = funcTable[k.NUMBER_TYPE];

        func = funcTable[type];
        return func ? func(newValue) : newValue;
    };

    k.Record._prepareValue = function(obj, prop, code) {
        if (k._isUndefined(obj[prop])) {
            obj[prop] = {};
        }
        if (k._isUndefined(obj[prop][code])) {
            obj[prop][code] = {};
        }
    };

    k.Record._isValidationEnabled = function(validation) {
        return k._isDefined(validation) ?
            validation :
            k._DEFAULT_VALIDATE_REVISION;
    };

    k.Record.prototype.val = function(fieldCode, opt_newValue) {
        return k._isUndefined(opt_newValue) ?
            this._getValue(fieldCode) :
            this._setValue(fieldCode, opt_newValue);
    };

    k.Record.prototype.recordId = function(opt_newRecordId) {
        if (k._isUndefined(opt_newRecordId)) {
            if (this.record && this.record[k.RECORD_ID_CODE]) {
                var value = k.Record._convertToTypeValue(this.app.fields, this.record, k.RECORD_ID_CODE);
                return k._isString(value) ? parseInt(value) : value;
            } else {
                return undefined;
            }
        } else {
            k.Record._prepareValue(this, 'record', k.RECORD_ID_CODE);
            var oldRecordId = this.record[k.RECORD_ID_CODE].value;
            this.record[k.RECORD_ID_CODE].value = opt_newRecordId;
            return oldRecordId;
        }
    };

    k.Record.prototype.revision = function(opt_newRevision) {
        if (k._isUndefined(opt_newRevision)) {
            if (this.record && this.record[k.REVISION_CODE]) {
                var value = k.Record._convertToTypeValue(this.app.fields, this.record, k.REVISION_CODE);
                return k._isString(value) ? parseInt(value) : value;
            } else {
                return undefined;
            }
        } else {
            k.Record._prepareValue(this, 'record', k.REVISION_CODE);
            var oldRevision = this.record[k.REVISION_CODE].value;
            this.record[k.REVISION_CODE].value = opt_newRevision;
            return oldRevision;
        }
    };

    k.Record.prototype.isUpdated = function() {
        return k._isDefined(this.updated);
    };

    /**
     * Save an updated record to the server.
     * If there is a recordId, then update the record. Otherwise,
     * a new record will be created.
     *
     * @return a Promise instance.
     */
    k.Record.prototype.save = function(opt_obj, opt_prop, opt_validateRevision) {
        var obj = k._isUndefined(opt_obj) ? undefined : opt_obj;
        var prop = k._isUndefined(opt_prop) ? undefined : opt_prop;
        var validateRevision = k.Record._isValidationEnabled(opt_validateRevision);
        var rid = this.recordId();
        var params;
        var self = this;


        if (k._isDefined(rid) && this.isUpdated()) {
            params = validateRevision ?
                {app:this.app.appId, id:rid, revision:this.revision(), record:this.updated} :
                {app:this.app.appId, id:rid, record:this.updated};
            return k._fetch('/k/v1/record', 'PUT', params, obj, prop).then(function(resp) {
                self.revision(resp.revision);
                return resp;
            });
         } else if (k._isUndefined(rid)) {
            // NOTE: If there is no recordId, then this.record should have a new data only.
            // (No type or other values in it. Or, it may be better to filter record.)
            params = {app:this.app.appId, record:this.record};
            return k._fetch('/k/v1/record', 'POST', params, obj, prop).then(function(resp) {
                self.recordId(resp.id);
                self.revision(resp.revision);
                return resp;
            });
        } else {
            return k._reject(k._NO_UPDATE_FOUND_ERROR);
        }
    };

    k.Record.prototype.remove = function(opt_validateRevision) {
        var rid = this.recordId();
        var params;
        var self = this;
        var validateRevision = k.Record._isValidationEnabled(opt_validateRevision);

        if (k._isDefined(rid)) {
            params = validateRevision ?
                {app:this.app.appId, ids:[rid], revisions:[this.revision()]} :
                {app:this.app.appId, ids:[rid]};
            return k._fetch('/k/v1/records', 'DELETE', params).then(function(resp) {
                return resp;
            });
        } else {
            return k._reject(k._NO_RECORD_ID_FOUND_ERROR);
        }
    };

    k.Record.prototype._getValue = function(fieldCode) {
        if (this.record && this.record[fieldCode]) {
            return k.Record._convertToTypeValue(this.app.fields, this.record, fieldCode); 
        } else { 
            throw new Error('No ' + fieldCode + ' found exception');
        }
    };

    k.Record.prototype._setValue = function(fieldCode, opt_newValue) {
        var oldValue;

        k.Record._prepareValue(this, 'record', fieldCode);
        oldValue = this.record[fieldCode].value;
        this.record[fieldCode].value =
            k.Record._convertFromTypeValue(this.app.fields, this.record, fieldCode, opt_newValue);

        k.Record._prepareValue(this, 'updated', fieldCode);
        this.updated[fieldCode].value = this.record[fieldCode].value;

        return oldValue;
    };


})(aexlib.kintone = aexlib.kintone || {});

