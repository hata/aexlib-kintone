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
    "use strict";

    k._MAX_FETCH_BATCH_SIZE = 100;
    k._MAX_UPDATE_LIMIT = 100;
    k._DEFAULT_VALIDATE_REVISION = true;
    k._DEFAULT_LANG = "default";
    k._UNKNOWN_ERROR = 'Unknown error';
    k._WRONG_QUERY_TYPE_ERROR = 'Wrong query parameter type found.';
    k._NO_UPDATE_FOUND_ERROR = 'No update found';
    k._NO_RECORD_ID_FOUND_ERROR = 'No record id found';
    k._NO_RECORD_FOUND = 'No record found';
    k._NO_LABEL_FOUND = 'No label found';
    k._NO_FIELDS_FOUND = 'No fields found. Use fetchFields to get it.';
    k._UNKNOWN_UPDATE_REQUEST_FOUND_ERROR = 'Unknown update request found.';
    k._CANNOT_USE_BOTH_POST_AND_PUT_REQUESTS = 'Cannot use both POST and PUT requests.';
    k._CANNOT_USE_STRING_LABEL_ACCESS = 'Cannot use string when label access is set.';

    k.NUMBER_TYPE = 'NUMBER';

    k.REVISION_CODE = '$revision';
    k.REVISION_TYPE = '__REVISION__';

    k.RECORD_ID_CODE = '$id';
    k.RECORD_ID_TYPE = '__ID__';

    k._DEFAULT_APP_OPTIONS = { lang: k._DEFAULT_LANG, labelAccess:false };

    k._KINTONE_API = 'kintone.api';
    k._KINTONE_APP_GETID = 'kintone.app.getId';

    k._HOOK_API_TABLE = {
        'kintone.api': null,
        'kintone.app.getId': null
    };


    k._isDefined = function(x) {
        return x !== undefined;
    };

    k._isUndefined = function(x) {
        return x === undefined;
    };

    k._isString = function(x) {
        return typeof x === 'string' || x instanceof String;
    };


    /**
     * When opt_labelAccess is set to true, then 'code' is
     * handled as 'label' value and then find a real field code
     * from fields. If there is no fields, then throw error
     * when it is set.
     * @param fields is properties returned by fields.
     * This is like {'code1':{label:'label'}, 'code2': ... }
     * @param code is a key value. Default is handled as field code.
     * @param opt_labelAccess is a flag to use label or not.
     */
    k._toCode = function(fields, code, opt_labelAccess) {
        if (opt_labelAccess) {
            if (fields) {
                for (var fieldCode in fields) {
                    if (fields[fieldCode].label === code) {
                        return fieldCode;
                    }
                }
                throw new Error(k._NO_LABEL_FOUND);
            } else {
                throw new Error(k._NO_FIELDS_FOUND);
            }
        } else {
            // NOTE: It may be better to validate fields if fields is not null.
            return code;
        }
    };

    k._reject = function(error) {
        try {
            return kintone.Promise.reject(error);
        } catch (e) {
            // If the environment is not in kintone env, then try to use Promise.
            return Promise.reject(error);
        }
    };

    k._kintoneFunc = function(kintoneAPIName) {
        var hookFunc = k._HOOK_API_TABLE[kintoneAPIName];
        if (k._isDefined(hookFunc) && hookFunc !== null) {
            return hookFunc;
        } else {
            if (kintoneAPIName == k._KINTONE_API) {
                return kintone.api;
            } else if (kintoneAPIName == k._KINTONE_APP_GETID) {
                return kintone.app.getId;
            }

            throw new Error('No ' + kintoneAPIName + ' found.');
        }
    };

    /*
     * required:
     * fetchParams.url = '/k/v1/apps'
     * fetchParams.request = 'GET'
     * fetchParams.resultProperty = 'apps'
     * fetchParams.toParamsHandler(startOffset, batchSize)
     * options
     * fetchParams.toResultHandler(resp, cumulativeResult)
     *
     * @param opt_max is the maximum number of records to be returned.
     * If null is set, then returns all records.
     */
    k._recursiveFetch = function(fetchParams, opt_offset, opt_max, opt_result) {
        var offset = opt_offset || 0;
        var max  = k._isUndefined(opt_max) ? null : opt_max;
        var result = opt_result || [];
        var params;

        var batchSize = max === null || max > k._MAX_FETCH_BATCH_SIZE ? k._MAX_FETCH_BATCH_SIZE : max;
        var remains = max === null ? null : max - batchSize;

        params = fetchParams.toParamsHandler(offset, batchSize);

        return k._kintoneFunc(k._KINTONE_API)(fetchParams.url, fetchParams.request, params).then(function(resp) {
            if (fetchParams.toResultHandler) {
                result = fetchParams.toResultHandler(resp, result);
            } else {
                result = result.concat(resp[fetchParams.resultProperty]);
            }
            if (resp[fetchParams.resultProperty].length === batchSize &&
                (remains === null || remains > 0)) {
                return k._recursiveFetch(fetchParams, offset + batchSize, remains, result);
            } else {
                return result;
            }
        }, function(errResp) {
            return k._reject(errResp);
        });
    };

    k._fetch = function(url, request, params, obj, property) {
        return k._kintoneFunc(k._KINTONE_API)(url, request, params).then(function(resp) {
            if (obj && property) {
                obj[property] = resp;
            }
            return resp;
        }, function(errResp) {
            return k._reject(errResp);
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
        var maxBatchSize;

        if (k._isUndefined(records) || records.length === 0) {
            return k._reject({message:k._NO_RECORD_FOUND});
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

        return k._kintoneFunc(k._KINTONE_API)(updateParams.url, updateParams.request, params).then(function(resp) {
            var result = updateParams.toResultHandler(records, resp, opt_result);
            return remains ? k._recursiveUpdate(updateParams, remains, validateRevisions, result) : result;
        }, function(errResp) {
            return k._reject(errResp);
        });
    };


    k._newQuery = function(app) {
        return new k.Query(app);
    };

    k._newRecord = function(app, opt_record) {
        return new k.Record(app, opt_record);
    };

    k.hookKintoneAPI = function(api, callback) {
        k._HOOK_API_TABLE[api] = callback;
    };

    /**
     * Create a new App instance.
     *
     * @params opt_options is additional options like lang and labelAccess flag.
     *  e.g. opt_options = {lang:'default', labelAccess:false}
     */
    k.App = function(appIdOrApp, opt_fields, opt_options) {
        var options = k._isDefined(opt_options) ? opt_options : k._DEFAULT_APP_OPTIONS;

        this.appId = appIdOrApp && appIdOrApp.appId ? appIdOrApp.appId : appIdOrApp;
        this.app =   appIdOrApp && appIdOrApp.appId ? appIdOrApp       : undefined;
        this.fields = opt_fields;
        this.lang = k._isDefined(options.lang) ? options.lang : k._DEFAULT_APP_OPTIONS.lang;
        this._labelAccess = k._isDefined(options.labelAccess) ? options.labelAccess : k._DEFAULT_APP_OPTIONS.labelAccess;
    };

    k.App.getApp = function(opt_appId, opt_fields, opt_options) {
        var appId = k._isDefined(opt_appId) ? opt_appId : k._kintoneFunc(k._KINTONE_APP_GETID)();
        return new k.App(appId, opt_fields, opt_options);
    };

    k.App.fetchApps = function(opt_params) {
        var toParamsHandler = function(startOffset, batchSize) {
            var params = { offset: startOffset, limit: batchSize };
            if (k._isDefined(opt_params)) {
                if (opt_params.ids) {
                    params.ids = opt_params.ids;
                }
                if (opt_params.codes) {
                    params.codes = opt_params.codes;
                }
                if (opt_params.name) {
                    params.name = opt_params.name;
                }
                if (opt_params.spaceIds) {
                    params.spaceIds = opt_params.spaceIds;
                }
            }
            return params;
        };
        var fetchParams = {
            url: '/k/v1/apps',
            request:'GET',
            resultProperty: 'apps',
            toParamsHandler: toParamsHandler
        };
        return k._recursiveFetch(fetchParams).then(function(apps) {
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
        return k._fetch(url, 'GET', {app: this.appId, lang: this.lang}, this, 'fields');
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

    k.App.prototype.labelAccess = function(opt_labelAccess) {
        if (k._isUndefined(opt_labelAccess)) {
            return this._labelAccess ? this._labelAccess : false;
        } else {
            this._labelAccess = opt_labelAccess;
        }
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
        this.limit(maxRecordNum);

        return this.fetch().then(function(records) {
            return records.length > 1 ?
                records :
                (records.length === 1 ?
                    records[0] :
                    (maxRecordNum > 1 ? [] : undefined ));
        });
    };

    k.Query.prototype.fetch = function() {
        var self = this;
        var toParamsHandler = function(offset, batchSize) {
            return {app: self.app.appId, fields: self._fields, query: self._buildQuery(offset, batchSize) };
        };
        var toResultHandler = function(resp, cumulativeResult) {
            // TODO: resp.totalCount can get here and then return it later ?
            return cumulativeResult.concat(resp.records);
        };
        var startOffset = k._isDefined(this._offset) ? this._offset : 0;
        var maxRecordNum = k._isDefined(this._limit) ? this._limit : null;
        var fetchParams = {
            url: '/k/v1/records',
            request:'GET',
            resultProperty: 'records',
            toParamsHandler: toParamsHandler,
            toResultHandler: toResultHandler
        };

        return k._recursiveFetch(fetchParams, startOffset, maxRecordNum).then(function(records) {
            return records.map(function(rec) { return self.app.newRecord(rec); });
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
        var self = this;

        if (k._isDefined(fieldCodes)) {
            this._fields = this._fields || [];

            if (Array.isArray(fieldCodes)) {
                fieldCodes = fieldCodes.map(function(code) { return self._toCode(code); });
                this._fields = this._fields.concat(fieldCodes);
            } else {
                this._fields.push(this._toCode(fieldCodes));
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
            if (this.app && this.app.labelAccess()) {
                throw new Error(k._CANNOT_USE_STRING_LABEL_ACCESS);
            }
            this._qParams.push(cond);
        } else if (cond instanceof k.Query.Condition) {
            this._qParams.push(cond.toString());
        } else {
            throw new Error(k._WRONG_QUERY_TYPE_ERROR);
        }
        return this;
    };


    k.Query.prototype.order = function(orderValue) {
        if (this.app && this.app.labelAccess()) {
            throw new Error(k._CANNOT_USE_STRING_LABEL_ACCESS);
        }
        return this._addOrder(orderValue);
    };

    k.Query.prototype._addOrder = function(orderValue) {
        if (k._isUndefined(this._orders)) {
            this._orders = [];
        }
        this._orders.push(orderValue);
        return this;
    };

    k.Query.prototype.orderAsc = function(fieldCode) {
        return this._addOrder(this._toCode(fieldCode) + ' asc');
    };

    k.Query.prototype.orderDesc = function(fieldCode) {
        return this._addOrder(this._toCode(fieldCode) + ' desc');
    };

    k.Query.prototype.equal = function(fieldCode, value) {
        return new k.Query.Condition(this).equal(fieldCode, value);
    };

    k.Query.prototype.notEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).notEqual(fieldCode, value);
    };

    k.Query.prototype.greaterThan = function(fieldCode, value) {
        return new k.Query.Condition(this).greaterThan(fieldCode, value);
    };

    k.Query.prototype.lessThan = function(fieldCode, value) {
        return new k.Query.Condition(this).lessThan(fieldCode, value);
    };

    k.Query.prototype.greaterEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).greaterEqual(fieldCode, value);
    };

    k.Query.prototype.lessEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).lessEqual(fieldCode, value);
    };

    k.Query.prototype.inList = function(fieldCode, value) {
        return new k.Query.Condition(this).inList(fieldCode, value);
    };

    k.Query.prototype.notInList = function(fieldCode, value) {
        return new k.Query.Condition(this).notInList(fieldCode, value);
    };

    k.Query.prototype.like = function(fieldCode, value) {
        return new k.Query.Condition(this).like(fieldCode, value);
    };

    k.Query.prototype.notLike = function(fieldCode, value) {
        return new k.Query.Condition(this).notLike(fieldCode, value);
    };

    k.Query.prototype.cond = function(conds) {
        return new k.Query.Condition(this, conds);
    };


    k.Query.prototype.limit = function(numLimit) {
        this._limit = numLimit;
        return this;
    };

    k.Query.prototype.offset = function(numOffset) {
        this._offset = numOffset;
        return this;
    };

    k.Query.prototype._buildQuery = function(opt_startOffset, opt_batchSize) {
        var stmt = this._qParams.join(' ');

        if (k._isDefined(this._orders)) {
            var orderBy = stmt ? ' order by ' : 'order by ';
            stmt += orderBy + this._orders.join(', ');
        }
        if (k._isDefined(opt_batchSize)) {
            stmt += (stmt ? ' limit ' : 'limit ') + opt_batchSize;
        }
        if (k._isDefined(opt_startOffset)) {
            stmt += (stmt ? ' offset ' : 'offset ') + opt_startOffset;
        }

        return stmt;
    };

    k.Query.prototype._toCode = function(code) {
        return this.app && this.app._labelAccess ?
            k._toCode(this.app.fields, code, this.app._labelAccess) :
            code;
    };

    k.Query.Condition = function(query, opt_cond) {
        this._query = query;
        this._qParams = [];
        if (k._isString(opt_cond)) {
            this._qParams.push('(' + opt_cond + ')');
        } else if (opt_cond instanceof k.Query.Condition) {
            this._qParams.push('(' + opt_cond.toString() + ')');
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
        var code = this._query._toCode(fieldCode);
        return this._appendQuery(code + ' in (' + k.Query.Condition._toListString(code, values) + ')');
    };

    k.Query.Condition.prototype.notInList = function(fieldCode, values) {
        var code = this._query._toCode(fieldCode);
        return this._appendQuery(code + ' not in (' + k.Query.Condition._toListString(code, values) + ')');
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
            this._qParams.push(new k.Query.Condition(this._query, value).toString());
        }
        return this;
    };

    k.Query.Condition.prototype.and = function(value) {
        this._qParams.push('and');
        if (k._isDefined(value)) {
            this._qParams.push(new k.Query.Condition(this._query, value).toString());
        }
        return this;
    };

    k.Query.Condition.prototype.toString = function() {
        return this._qParams.join(' ');
    };

    k.Query.Condition.prototype._addOperatorQuery = function(fieldCode, op, value) {
        var code = this._query._toCode(fieldCode);
        return this._appendQuery(code + ' ' + op + ' ' + k.Query.Condition._toQueryValue(code, value));
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
            values = values._getValue(code);
        }
        if (!Array.isArray(values)) {
            values = [values];
        }
        return values.map(function(x) { return k.Query.Condition._escapeValue(code, x); }).join();
    };

    k.Query.Condition._toQueryValue = function(code, value) {
        return value instanceof k.Query.Constant ? value.text : k.Query.Condition._escapeValue(code, value);
    };

    k.Query.Condition._escapeValue = function(code, value) {
        if (value instanceof k.Record) {
            value = value._getValue(code);
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
           return k._reject({message:k._CANNOT_USE_BOTH_POST_AND_PUT_REQUESTS});
       }

       if (creatingRecords.length > 0) {
           return k.Record.createAll(creatingRecords, opt_validateRevisions);
       } else if (updatingRecords.length > 0) {
           return k.Record.updateAll(updatingRecords, opt_validateRevisions);
       } else {
           return k._reject({message:k._NO_UPDATE_FOUND_ERROR});
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

    k.Record.prototype.val = function(code, opt_newValue) {
        code = this.app && this.app.labelAccess() ?
            k._toCode(this.app.fields, code, this.app.labelAccess()) :
            code;

        return k._isUndefined(opt_newValue) ?
            this._getValue(code) :
            this._setValue(code, opt_newValue);
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
            return k._reject({message:k._NO_UPDATE_FOUND_ERROR});
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
            return k._reject({message:k._NO_RECORD_ID_FOUND_ERROR});
        }
    };

    k.Record.prototype._getValue = function(code) {
        if (this.record && this.record[code]) {
            return k.Record._convertToTypeValue(this.app.fields, this.record, code); 
        } else { 
            throw new Error('No ' + code + ' found exception');
        }
    };

    k.Record.prototype._setValue = function(code, opt_newValue) {
        var oldValue;

        k.Record._prepareValue(this, 'record', code);
        oldValue = this.record[code].value;
        this.record[code].value =
            k.Record._convertFromTypeValue(this.app.fields, this.record, code, opt_newValue);

        k.Record._prepareValue(this, 'updated', code);
        this.updated[code].value = this.record[code].value;

        return oldValue;
    };


    // For node.js, App, Query, and Record are exported objects.
    try {
        if (k._isDefined(exports)) {
            exports.App = k.App;
            exports.Query = k.Query;
            exports.Record = k.Record;
            exports.hookKintoneAPI = k.hookKintoneAPI;
        }
    } catch (e) {
        // If there is no module || exports, then ignore it.
    }

})(aexlib.kintone = aexlib.kintone || {});

