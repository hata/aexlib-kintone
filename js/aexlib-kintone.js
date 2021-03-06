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

/**
 * @main aexlib-kintone
 * @namespace aexlib.kintone
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
    k._NO_NEW_CONFIG_FOUND = 'No new config found.';
    k._NO_PARAMS_FOUND = 'No parameters found. Please set params option.';
    k._UNKNOWN_UPDATE_REQUEST_FOUND_ERROR = 'Unknown update request found.';
    k._CANNOT_USE_BOTH_POST_AND_PUT_REQUESTS = 'Cannot use both POST and PUT requests.';
    k._CANNOT_USE_STRING_LABEL_ACCESS = 'Cannot use string when label access is set.';
    k._UNSUPPORTED_TYPE_FOUND = 'Unsupported type found.';
    k._DEPLOY_FAILED_INVALID_APPS_SET = 'Deploy failed because of invalid apps.';

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

    k._isNumber = function(x) {
        return typeof x === 'number' || x instanceof Number;
    };

    k._toDoubleDigits = function(num) {
        return ('0' + num).slice(-2);
    };


    /*
     * When opt_labelAccess is set to true, then 'code' is
     * handled as 'label' value and then find a real field code
     * from fields. If there is no fields, then throw error
     * when it is set.
     * @param fields is like {properties:{...}} which is returned by
     * fetchFields.
     * This is like {'code1':{label:'label'}, 'code2': ... }
     * @param code is a key value. Default is handled as field code.
     * @param opt_labelAccess is a flag to use label or not.
     */
    k._toCode = function(fields, code, opt_labelAccess) {
        if (opt_labelAccess) {
            if (fields) {
                for (var fieldCode in fields.properties) {
                    if (fields.properties[fieldCode].label === code) {
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


    /*
     * This do not support multiple appId update in 1 txn.
     *
     * updateParams.url = '/k/v1/records'
     * updateParams.request = 'PUT'
     * updateParams.toParamsHandler = function(appId, records, validateRevisions) {}
     * updateParams.toResultHandler = function(records, resp, cumulativeResult) {}
     */
    k._recursiveUpdate = function(updateParams, records, opt_params, opt_result) {
        var validateRevisions = k.Record._isValidationEnabled(opt_params);
        var bulk = k._isDefined(opt_params) ? opt_params._bulk : undefined;
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

        // opt_params may have a bulk instance as _bulk property.
        if (k.BulkRequest._isBulk(bulk)) {
            bulk._add(updateParams.request, updateParams.url, params);
            return remains ? k._recursiveUpdate(updateParams, remains, opt_params, opt_result) : null;
        } else {
            return k._kintoneFunc(k._KINTONE_API)(updateParams.url, updateParams.request, params).then(function(resp) {
                var result = updateParams.toResultHandler(records, resp, opt_result);
                return remains ? k._recursiveUpdate(updateParams, remains, opt_params, result) : result;
            }, function(errResp) {
                return k._reject(errResp);
            });
        }
    };


    k._newQuery = function(app) {
        return new k.Query(app);
    };

    k._newRecord = function(app, opt_record) {
        return new k.Record(app, opt_record);
    };

    // cmd {String} e.g. records, app/settings
    // opt_params {guestSpaceId:'foo', preview:true|false}
    k._requestPath = function(cmd, opt_params) {
        return (k._isDefined(opt_params) && k._isDefined(opt_params.guestSpaceId) ? '/k/guest/' + opt_params.guestSpaceId : '/k') +
               (k._isDefined(opt_params) && opt_params.preview ? '/v1/preview' : '/v1') + '/' + cmd;
    };

    // cmd {String} e.g. records, app/settings
    // opt_params {guestSpaceId:'foo'}
    k._previewRequestPath = function(cmd, opt_params) {
        var params = k._isDefined(opt_params) && k._isDefined(opt_params.guestSpaceId) ?
            {guestSpaceId:opt_params.guestSpaceId, preview:true} : {preview:true};
        return k._requestPath(cmd, params);
    };

    /**
     * Hook kintone api to use this library in node environment.
     * This is used to hook kintone.api to send REST request from
     * nodejs environment.
     *
     * @static
     * @method hookKintoneAPI
     * @param api {String} kintone API name.
     * @param callback {Function} a function to be called.
     */
    k.hookKintoneAPI = function(api, callback) {
        k._HOOK_API_TABLE[api] = callback;
    };

    /**
     * Create a new App instance.
     *
     * @class App
     * @constructor
     * @param appIdOrApp {Number|String|Object} Number or String is used for appId.
     * Otherwise, app object which is get from kintone server should be set.
     * @param opt_fields {Object} is fields like {properties:{code:{type: ...}}}
     * @param opt_options is additional options like lang and labelAccess flag.
     *  e.g. opt_options = {lang:'default', labelAccess:false}
     */
    k.App = function(appIdOrApp, opt_fields, opt_options) {
        var options = k._isDefined(opt_options) ? opt_options : k._DEFAULT_APP_OPTIONS;
        this.appId = (appIdOrApp && appIdOrApp.appId) ? appIdOrApp.appId : appIdOrApp;
        this.app =   (appIdOrApp && appIdOrApp.appId) ? appIdOrApp       : undefined;
        this.fields = opt_fields;
        this.lang = k._isDefined(options.lang) ? options.lang : k._DEFAULT_APP_OPTIONS.lang;
        this._labelAccess = k._isDefined(options.labelAccess) ? options.labelAccess : k._DEFAULT_APP_OPTIONS.labelAccess;
    };


    /**
     * Get App instance using arguments.
     *
     * <pre><code>
     * var app = aexlib.kintone.App.getApp(); // app.appid is set from kintone.app.getId().
     * app = aexlib.kintone.App.getApp('appId');
     * </code></pre>
     *
     * @static
     * @method getApp
     * @param opt_appId {Number|String} Set appid to get a known App instance for a known appid.
     * @param opt_fields {Object} Set fields which is get from /k/v1/app/fields REST API.
     * @param opt_options {property} Set optional parameters. It is like {lang:'default'} .
     * @return {App} App instance is returned.
     */
    k.App.getApp = function(opt_appId, opt_fields, opt_options) {
        var appId = k._isDefined(opt_appId) ? opt_appId : k._kintoneFunc(k._KINTONE_APP_GETID)();
        return new k.App(appId, opt_fields, opt_options);
    };


    /**
     * Get App instances.
     *
     * <pre><code>
     * App.fetchApps().then(function(apps) {
     *   // apps is the instance of array.
     * });
     *
     * App.fetchApps({name:'foo'}).then(function(apps) {
     *   // apps is the instance of array which contains 'foo' in the name of the app.
     * }, function(error) {
     *   // error.message contains error message when there is a problem.
     * });
     * </code></pre>
     *
     * @method fetchApps
     * @param opt_params {guestSpaceId:'foo', ids, codes, name, spaceIds}
     * Set properties to fetch apps. ids, codes, and name can be used
     * to set query params.
     * If guestSpaceId is set, then set it to url for a guest space id.
     * @return {Promise} Promise is returned. When the request is failed,
     * then reject is called.
     * Otherwise, resolve(the array of App instance) is called.
     */
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
            url: k._requestPath('apps', opt_params),
            request:'GET',
            resultProperty: 'apps',
            toParamsHandler: toParamsHandler
        };
        return k._recursiveFetch(fetchParams).then(function(apps) {
            return apps.map(function(app) { return new k.App(app); });
        });
    };

    /**
     * Create a new app at a test environment.
     *
     * @method createApp
     * @static
     * @param name {String} Set a new app name.
     * @param opt_space {Number} Set a space value if needed.
     * @param opt_thread {Number} Set a thread value if needed.
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id if needed.
     * @return {Promise} Promise.resolve(resp) is returned for success.
     * resp is App instance which contains a new appId.
     */
    k.App.createApp = function(name, opt_space, opt_thread, opt_params) {
        var params = {name:name};
        if (k._isNumber(opt_space)) {
            params.space = opt_space;
        }
        if (k._isNumber(opt_thread)) {
            params.thread = opt_thread;
        }

        // Response is like {app:"23", revision:"1"}
        return k._fetch(k._previewRequestPath('app', opt_params),
            'POST', params).then(function(resp) {
            return k.App.getApp(resp.app);
        });
    };

    /**
     * Deploy App instance.
     *
     * @method deployAll
     * @static
     * @param apps {Array of App|App} Set Array of App or a App instance to
     * deploy the app.
     * @param opt_params {guestSpaceId:'foo',revert:true} If a guest space app, then set
     * a guest space id. And if applications should be reverted, then set revert:true.
     * @return {Promise} Promise.resolve(resp) is returned for success.
     */
    k.App.deployAll = function(apps, opt_params) {
        var appIds = [];
        var params = {};
        var app;

        if (!Array.isArray(apps)) {
            apps = [apps];
        }

        for (var i = 0;i < apps.length;i++) {
            app = apps[i];
            if (app instanceof k.App) {
                appIds.push({app:app.appId});
            } else if (k._isString(app) || (k._isNumber(app) && !isNaN(app))) {
                appIds.push({app:app});
            } else {
                return k._reject({message:k._DEPLOY_FAILED_INVALID_APPS_SET});
            }
        }

        if (opt_params && opt_params.revert) {
            params.revert = true;
        }

        params.apps = appIds;

        return k._fetch(k._previewRequestPath('app/deploy', opt_params), 'POST', params);
    };

    /**
     * Get current status of applications.
     * @method statusAll
     * @static
     * @param apps {Array of (App|String|Number)|App|String|Number}
     * @param opt_params {guestSpaceId:'foo'} Set id for a guest space apps.
     * @return {Promise} Promise.resolve is called for success.
     */
    k.App.statusAll = function(apps, opt_params) {
        var appIds = [];

        if (!Array.isArray(apps)) {
            apps = [apps];
        }

        for (var i = 0;i < apps.length;i++) {
            var appId = apps[i] instanceof k.App ? apps[i].appId : apps[i];
            if (k._isString(appId)) {
                appId = parseInt(appId);
            }

            if (k._isNumber(appId) && !isNaN(appId)) {
                appIds.push(appId);
            } else {
                return k._reject({message:k._DEPLOY_FAILED_INVALID_APPS_SET});
            }
        }

        return k._fetch(k._previewRequestPath('app/deploy', opt_params), 'GET', {apps:appIds});
    };

    /**
     * Fetch /k/v1/app request.
     *
     * @method fetchApp
     * @param opt_params {guestSpaceId:'foo'} Set a space id if needed.
     * @return {Promise} Promise.resolve(resp) is returned. And App.app is also set.
     */
    k.App.prototype.fetchApp = function(opt_params) {
        return k._fetch(k._requestPath('app', opt_params),
            'GET', {id: this.appId, lang: this.lang}, this, 'app');
    };

    /**
     * Fetch /k/v1/app/settings request.
     *
     * @method fetchSettings
     * @param opt_params {guestSpaceId:'foo',preview:true|false} Set params to get request path.
     * @return {Promise} Promise.resolve(resp) is returned. And also App.settings is set.
     */
    k.App.prototype.fetchSettings = function(opt_params) {
        return k._fetch(k._requestPath('app/settings', opt_params),
            'GET', {app: this.appId, lang: this.lang}, this, 'settings');
    };

    /**
     * PUT /k/v1/preview/app/settings using the argument's settings or this.settings.
     * If there is revision in the new settings, the property is deleted.
     * @method updateSettings
     * @param newSettings {JavaScript Object} This parameter can set to update settings for this app.
     * @param opt_params {guestSpaceId:'foo'} Set guest space id if needed. (preview is always true)
     * If this value is not set, then this.settings is used to update the app settings.
     * @return {Promise} Return result.
     */
    k.App.prototype.updateSettings = function(newSettings, opt_params) {
        return this._updateConfig(k._previewRequestPath('app/settings', opt_params), newSettings);
    };

    /**
     * Fetch /k/v1/app/form/fields request.
     *
     * @method fetchFields
     * @param opt_params {guestSpaceId:'foo',preview:true|false} Set preview property flag.
     * @return {Promise} Promise.resolve(resp) is returned. And also App.fields is set.
     */
    k.App.prototype.fetchFields = function(opt_params) {
        return k._fetch(k._requestPath('app/form/fields', opt_params),
            'GET', {app: this.appId, lang: this.lang}, this, 'fields');
    };

    /**
     * POST /k/v1/preview/app/form/fields request which adds new fields.
     * @method createFields
     * @param newFields {JavaScript object} Set new fields config.
     * @param opt_params {guestSpaceId:'foo'} Set guestSpaceId if needed. preview is always true.
     * @return {Promise} Promise.resolve(resp) is returned when it is succeeded.
     * resp is like {revision:'3'}.
     */
    k.App.prototype.createFields = function(newFields, opt_params) {
        var userFields = {};

        for (var key in newFields.properties) {
            var field = newFields.properties[key];
            if (!k.App._isBuiltInField(field)) {
                userFields[key] = field;
            }
        }

        return k._fetch(k._previewRequestPath('app/form/fields', opt_params),
            'POST', {app:this.appId, properties:userFields});
    };

    /**
     * PUT /k/v1/preview/app/form/fields request.
     * @method updateFields
     * @param updateFields {JavaScript object} Set updating fields config.
     * @param params {JavaScript object} Set options to filter updating fields.
     * It is like {builtInFields:true|false, userFields:true|false}
     * And this can also set guestSpaceId to add guest/spaceId to request path.
     * It is like {buildInFields:true, guestSpaceId:'foo'}.
     * @return {Promise} Promise.resolve(resp) is returned when it is succeeded.
     * resp is like {revision:'3'}.
     */
    k.App.prototype.updateFields = function(updateFields, params) {
        var putFields = {};
        var field;

        if (k._isUndefined(params)) {
            return k._reject({message:k._NO_PARAMS_FOUND});
        }

        for (var key in updateFields.properties) {
            field = updateFields.properties[key];

            if (k.App._isIgnoreField(field)) {
                continue;
            } else if ((params.builtInFields && k.App._isBuiltInField(field)) ||
                (params.userFields && !k.App._isBuiltInField(field))) {
                putFields[key] = field;
            }
        }

        return k._fetch(k._previewRequestPath('app/form/fields', params),
            'PUT', {app:this.appId, properties:putFields});
    };


    /**
     * DELETE /k/v1/preview/app/form/fields request.
     * @method removeFields
     * @param rmFields {JavaScript object|Array} Set fields config
     * to be removed or Array of field codes.
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id if needed.
     * @return {Promise} Promise.resolve(resp) is returned when it is succeeded.
     * resp is like {revision:'3'}.
     */
    k.App.prototype.removeFields = function(rmFields, opt_params) {
        var names = [];
        var field;

        if (rmFields.properties) {
            for (var key in rmFields.properties) {
                if (!k.App._isIgnoreField(rmFields.properties[key])) {
                    names.push(key);
                }
            }
        } else if (Array.isArray(rmFields)) {
            names = rmFields;
        } else {
            return k._reject({message:k._UNSUPPORTED_TYPE_FOUND});
        }

        return k._fetch(k._previewRequestPath('app/form/fields', opt_params),
            'DELETE', {app:this.appId, fields:names});
    };

    /**
     * Fetch /k/v1/app/form/layout request.
     *
     * @method fetchLayout
     * @param opt_params {guestSpaceId:'foo', preview:true|false} Set a guest space id
     * and/or a preview flag.
     * @return {Promise} Promise.resolve(resp) is returned. App.layout is also set.
     */
    k.App.prototype.fetchLayout = function(opt_params) {
        return k._fetch(k._requestPath('app/form/layout', opt_params),
            'GET', {app: this.appId}, this, 'layout');
    };

    /**
     * Update /k/v1/app/form/layout request.
     * @method updateLayout
     * @param newLayout {property} Set a new layout config.
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id if needed.
     * @return {Promise} Promise.resolve(resp) is returned when it is succeeded.
     */
    k.App.prototype.updateLayout = function(newLayout, opt_params) {
        return this._updateConfig(k._previewRequestPath('app/form/layout', opt_params), newLayout);
    };

    /**
     * Fetch /k/v1/app/views request.
     *
     * @method fetchViews
     * @param opt_params {guestSpaceId:'foo', preview:true|false} Set a guest space id and/or
     * a preview flag.
     * @return {Promise} Promise.resolve(resp) is returned. App.views is also set.
     */
    k.App.prototype.fetchViews = function(opt_params) {
        var url = k._requestPath('app/views', opt_params);
        return k._fetch(url, 'GET', {app: this.appId, lang: this.lang}, this, 'views');
    };

    /**
     * Update '/k/v1/app/views' request.
     * @method updateViews
     * @param newViews {property} Set a new views config.
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id if needed.
     * @return {Promise} Promise.resolve(resp) is returned when it is succeeded.
     */
    k.App.prototype.updateViews = function(newViews, opt_params) {
        return this._updateConfig(k._previewRequestPath('app/views', opt_params), newViews);
    };

    /**
     * Fetch /k/v1/form request.
     *
     * @method fetchForm
     * @param opt_params {guestSpaceId:'foo', preview:true|false} Set a guest space id
     * and/or preview flag if needed.
     * @return {Promise} Promise(resp) is returned. And App.form is also set.
     */
    k.App.prototype.fetchForm = function(opt_params) {
        return k._fetch(k._requestPath('form', opt_params),
            'GET', {app: this.appId}, this, 'form');
    };

    /**
     * Deploy this app.
     * @method deploy
     * @param opt_param {JavaScript object} Set {revert:true} when reverting the deploy.
     * @return {Promise} Promise.resolve is returned when deploy operation is suceeded.
     * resp is undefined.
     */
    k.App.prototype.deploy = function(opt_params) {
        return k.App.deployAll(this.appId, opt_params);
    };

    /**
     * Check current status.
     * @method status
     * @return {Promise} Promise.resolve is returned when status check returns successfully.
     * resp is like {status:'PROCESSING}
     */
    k.App.prototype.status = function() {
        return k.App.statusAll(this.appId).then(function(resp) {
            return resp.apps[0];
        });
    };

    /**
     * Fetch a record and then return Promise instance.
     *
     * <pre><code>
     * app.first().then(function(record) {
     *   // record is Record instance.
     *   ...
     * }), function(error) {
     *   ...
     * });
     *
     * app.first(3).then(function(records) {
     *  // records is the instance of Array.
     *   ...
     * });
     * </code></pre>
     *
     * @method first
     * @param opt_maxRecordNum {Number} Set the max number of records to be return.
     * If this value is not set(or set to 1), then this method only returns 1 Record.
     * If the value is set more than 2, then return the array of Record.
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id to get
     * records from a guest space's app.
     * @return {Promise} This method returns Promise instance. When the request
     * is successful, then resolve is called. Otherwise, reject is called.
     */
    k.App.prototype.first = function(opt_maxRecordNum, opt_params) {
        return k._newQuery(this).first(opt_maxRecordNum, opt_params);
    };


    /**
     * Create a new Query instance with fields.
     * @method select
     * @param opt_fieldCodes {String|Array}
     * If this value is set, query result only contains these fields.
     * @return {Query} Return a new Query instance.
     */
    k.App.prototype.select = function(opt_fieldCodes) {
        return k._newQuery(this).select(opt_fieldCodes);
    };


    /**
     * Create a new Query instance with query operations.
     * @method where
     * @param opt_cond {Query.Condition|String} 
     * @return {Query} Return a new Query instance.
     */
    k.App.prototype.where = function(opt_cond) {
        return k._newQuery(this).where(opt_cond);
    };


    /**
     * Create a new Query with order value.
     * @method order
     * @param order {String} Set order fieldCode/order type.
     * @return {Query} Return a new Query instance.
     */
    k.App.prototype.order = function(order) {
        return k._newQuery(this).order(order);
    };


    /**
     * Create a new Record instance.
     *
     * @method newRecord
     * @param opt_record {property} Initial kintone record value like event.record.
     * @return {Record} Return a new Record instance.
     */
    k.App.prototype.newRecord = function(opt_record) {
        return k._newRecord(this, opt_record);
    };

    /**
     * If label string is used to access field code instead of the code value,
     * then set this parameter to true.
     * If this value is set to true, user should make labels unique.
     *
     * @method labelAccess
     * @param opt_labelAccess {boolean} Set this value if label access flag
     * to true.
     * @return {boolean} If label access is used, then return true.
     * Otherwise, return false.
     */
    k.App.prototype.labelAccess = function(opt_labelAccess) {
        if (k._isUndefined(opt_labelAccess)) {
            return this._labelAccess ? this._labelAccess : false;
        } else {
            this._labelAccess = opt_labelAccess;
        }
    };

    /**
     * Copy a current App to a new created App.
     * @method copy
     * @param newApp {JavaScript object}
     *  {name:appName, space:opt_space, thread: opt_thread}
     * @return {Promise} Promise.resolve(resp) is returned.
     */
    k.App.prototype.copy = function(newAppParams) {
        var self = this;
        var app;
        return this.fetchSettings().
           then(function() {
            return self.fetchFields();
        }).then(function() {
            return self.fetchLayout();
        }).then(function() {
            return self.fetchViews();
        }).then(function() {
            return k.App.createApp(newAppParams.name, newAppParams.space, newAppParams.thread);
        }).then(function(newApp) {
            app = newApp;
            var newSettings = {
                description: self.settings.description,
                icon: self.settings.icon,
                theme: self.settings.theme
            };
            return app.updateSettings(newSettings);
        }).then(function() {
            return app.createFields(self.fields);
        }).then(function() {
            return app.updateFields(self.fields, {builtInFields:true});
        }).then(function() {
            return app.updateLayout(self.layout);
        }).then(function() {
            return app.updateViews(self.views);
        }).then(function() {
            return app.deploy();
        }).then(function() {
            return app;
        });
    };

    /**
     * Fetch app/acl from kintone and return Promise.
     * @method fetchAppACL
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with response like
     * {rights:...}
     */
    k.App.prototype.fetchAppACL = function(opt_params) {
        return k._fetch(k._requestPath('app/acl', opt_params),
            'GET', {app:this.appId}, this, 'appACL');
    };

    /**
     * Fetch record/acl from kintone and return Promise.
     * @method fetchRecordACL
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with response like
     * {rights:...}
     */
    k.App.prototype.fetchRecordACL = function(opt_params) {
        return k._fetch(k._requestPath('record/acl', opt_params),
            'GET', {app:this.appId}, this, 'recordACL');
    };

    /**
     * Fetch field/acl from kintone and return Promise.
     * @method fetchFieldACL
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with response like
     * {rights:...}
     */
    k.App.prototype.fetchFieldACL = function(opt_params) {
        return k._fetch(k._requestPath('field/acl', opt_params),
            'GET', {app:this.appId}, this, 'fieldACL');
    };

    /**
     * Update app/acl in kintone and return Promise.
     * @method updateAppACL
     * @param acl {JS Object} acl is like {rights:..., revision:'5'}.
     * If you set revision, then it is validated. Otherwise, revision
     * is not required.
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with {revision:...}.
     */
    k.App.prototype.updateAppACL = function(acl, opt_params) {
        var revision = k._isDefined(acl.revision) ? acl.revision : -1;
        return k._fetch(k._requestPath('app/acl', opt_params),
            'PUT', {app:this.appId, rights:acl.rights, revision:revision});
    };

    /**
     * Update record/acl in kintone and return Promise.
     * @method updateRecordACL
     * @param acl {JS Object} acl is like {rights:..., revision:'5'}.
     * If you set revision, then it is validated. Otherwise, revision
     * is not required.
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with {revision:...}.
     */
    k.App.prototype.updateRecordACL = function(acl, opt_params) {
        var revision = k._isDefined(acl.revision) ? acl.revision : -1;
        return k._fetch(k._requestPath('record/acl', opt_params),
            'PUT', {app:this.appId, rights:acl.rights, revision:revision});
    };

    /**
     * Update field/acl in kintone and return Promise.
     * @method updateFieldACL
     * @param acl {JS Object} acl is like {rights:..., revision:'5'}.
     * If you set revision, then it is validated. Otherwise, revision
     * is not required.
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     * Set an option for request path.
     * @retrun {Promise} Promise is returned with {revision:...}.
     */
    k.App.prototype.updateFieldACL = function(acl, opt_params) {
        var revision = k._isDefined(acl.revision) ? acl.revision : -1;
        return k._fetch(k._requestPath('field/acl', opt_params),
            'PUT', {app:this.appId, rights:acl.rights, revision:revision});
    };


    /**
     * Fetch customize.
     * @method fetchCustomize
     * @param opt_params {guestSpaceId:'foo', preview:boolean} Set request path options.
     * @return {Promise} Promise.resolve(resp) is return.
     */
    k.App.prototype.fetchCustomize = function(opt_params) {
        return k._fetch(k._requestPath('app/customize', opt_params),
            'GET', {app:this.appId}, this, 'customize');
    };


    /**
     * Update customize.
     * @method updateCustomize
     * @param customize {desktop:...,mobile:...,scope:...,revision:...} Customize
     * information is set.
     * @param opt_params {guestSpaceId:'foo', preview:boolean} Set request path options.
     * @return {Promise} Promise.resolve(resp) is return.
     */
    k.App.prototype.updateCustomize = function(customize, opt_params) {
        var params = {app:this.appId};
        if (k._isDefined(customize.desktop)) {
            params.desktop = customize.desktop;
        }
        if (k._isDefined(customize.mobile)) {
            params.mobile = customize.mobile;
        }
        if (k._isDefined(customize.scope)) {
            params.scope = customize.scope;
        }
        if (k._isDefined(customize.revision)) {
            params.revision = customize.revision;
        }
        return k._fetch(k._requestPath('app/customize', opt_params), 'PUT', params);
    };


    // It maybe required to refactor this method because the current
    // code is to set revision after successful call. However, we may
    // not be required to do it.
    k.App.prototype._updateConfig = function(url, newConfig) {
        var self = this;
        var oldRevision;
        if (k._isUndefined(newConfig)) {
            return k._reject({message:k._NO_NEW_CONFIG_FOUND});
        }

        if (k._isDefined(newConfig.revision)) {
            oldRevision = newConfig.revision;
            delete newConfig.revision;
        }

        newConfig.app = this.appId;

        return k._fetch(url, 'PUT', newConfig).then(function(resp) {
            newConfig.revision = resp.revision;
            delete newConfig.app;
            return resp;
        }, function(error) {
            if (k._isDefined(oldRevision)) {
                newConfig.revision = oldRevision;
            }
            delete newConfig.app;
            return k._reject(error);
        });
    };

    k.App._isBuiltInField = function(field) {
        var type = field ? field.type : undefined;
        return type && (type === 'RECORD_NUMBER' ||
                        type === 'CREATOR' ||
                        type === 'CREATED_TIME' ||
                        type === 'MODIFIER' ||
                        type === 'UPDATED_TIME' ||
                        k.App._isIgnoreField(field));
    };

    k.App._isIgnoreField =  function(field) {
        var type = field ? field.type : undefined;
        return type &&  type === 'STATUS' ||
                        type === 'STATUS_ASSIGNEE' ||
                        type === 'CATEGORY';
    };

    /**
     * Query object to build query text to fetch records.
     *
     * @class Query
     * @constructor
     * @param app {App} Set App instance for this Query.
     */
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
     * Get first Record instance(s).
     *
     * @method first
     * @param opt_maxRecordNumOrParams {Number|{maxRecordNum:1,guestSpaceId:'foo'}}
     * When set a Number, then return several Record instance. The default number is 1.
     * When set a JavaScript object like {maxRecordNum:1, guestSpaceId:'foo'},
     * then set a guest space id to access a guest space's app.
     * @return {Promise}. If it succeeded, then return record. Otherwise, undefined.
     * If kintone returns an error response, then reject is called by Promise.
     */
    k.Query.prototype.first = function(opt_maxRecordNumOrParams) {
        var maxRecordNum = k._isNumber(opt_maxRecordNumOrParams) ? opt_maxRecordNumOrParams : 1;
        var params;

        if (!k._isNumber(opt_maxRecordNumOrParams) && k._isDefined(opt_maxRecordNumOrParams)) {
            if (k._isNumber(opt_maxRecordNumOrParams.maxRecordNum)) {
                maxRecordNum = opt_maxRecordNumOrParams.maxRecordNum;
            }
            if (k._isDefined(opt_maxRecordNumOrParams.guestSpaceId)) {
                params = {guestSpaceId: opt_maxRecordNumOrParams.guestSpaceId};
            }
        }

        // TODO: This may cause a bug when call first and then find.
        this.limit(maxRecordNum);

        return this.find(params).then(function(resp) {
            return resp.records.length > 1 ?
                resp.records :
                (resp.records.length === 1 ?
                    resp.records[0] :
                    (maxRecordNum > 1 ? [] : undefined ));
        });
    };


    /**
     * Fetch Records.
     *
     * <pre><code>
     * var q = app.select();
     * q.where(q.equal('fieldFoo', 10).and().(q.lessThan('fieldBar', 20))).find().then(function(records) {
     * ...
     * });
     * </code></pre>
     *
     * @method find
     * @param opt_params {guestSpaceId:'foo'} Set a guest space id
     * if the request is for a guest space's app.
     * @return {Promise} Return Promise.resolve(Array of Record) .
     */
    k.Query.prototype.find = function(opt_params) {
        var self = this;
        var totalCountFlag = k._isDefined(this._totalCountFlag) ? this._totalCountFlag : false;
        var total = 0;
        var toParamsHandler = function(offset, batchSize) {
            return {app: self.app.appId, fields: self._queryFields,
                    query: self._buildQuery(offset, batchSize), totalCount:totalCountFlag };
        };
        var toResultHandler = function(resp, cumulativeResult) {
            // TODO: resp.totalCount can get here and then return it later ?
            if (totalCountFlag) {
                total = resp.totalCount;
            }
            return cumulativeResult.concat(self._applyFilters(resp.records));
        };
        var startOffset = k._isDefined(this._offset) ? this._offset : 0;
        var maxRecordNum = k._isDefined(this._limit) ? this._limit : null;
        var fetchParams = {
            url: k._requestPath('records', opt_params),
            request:'GET',
            resultProperty: 'records',
            toParamsHandler: toParamsHandler,
            toResultHandler: toResultHandler
        };

        return k._recursiveFetch(fetchParams, startOffset, maxRecordNum).then(function(records) {
            var result = records.map(function(rec) { return self.app.newRecord(rec); });
            return totalCountFlag ? {records:result, totalCount:total} : {records:result, totalCont:null};
        });
    };

    /**
     * Set fields parameter to query records.
     * 
     * <pre><code>
     * q.select()
     *  // or
     * q.select(['code1', 'code2']) 
     *  // or
     * q.select('code1')
     * </code></pre>
     *
     * @method select
     * @param opt_fieldCodes
     * @return {Query} Query instance(this value) is returned.
     */
    k.Query.prototype.select = function(opt_fieldCodes) {
        var self = this;

        if (k._isDefined(opt_fieldCodes)) {
            this._queryFields = this._queryFields || [];

            if (Array.isArray(opt_fieldCodes)) {
                opt_fieldCodes = opt_fieldCodes.map(function(code) { return self._toCode(code); });
                this._queryFields = this._queryFields.concat(opt_fieldCodes);
            } else {
                this._queryFields.push(this._toCode(opt_fieldCodes));
            }
        }

        return this;
    };


    /**
     * Set Query.Condition instance to build a query.
     *
     * <pre><code>
     * q.where('code = "foo"') ...
     * q.where(q.equal('code', 'foo').and(). ...)
     * q.where(q.cond(q.equal(a,b).lessThan(c,d)).and(q.equal(...)))
     * </code></pre>
     *
     * @method where
     * @param cond {String|Query.Condition}
     * @return {Query}
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


    /**
     * Add order field and sort(asc|desc) text.
     * @method order
     * @param orderValue {String} Set order text like 'fieldCode asc'.
     * @return {Query}
     */
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


    /**
     * Add order field for 'asc'
     * @method orderAsc
     * @param fieldCode {String} Set field code.
     * @return {Query} Return 'this' instance.
     */
    k.Query.prototype.orderAsc = function(fieldCode) {
        return this._addOrder(this._toCode(fieldCode) + ' asc');
    };

    /**
     * Add order field for 'desc'
     * @method orderDesc
     * @param fieldCode {String} Set field code.
     * @return {Query} Return 'this' instance.
     */
    k.Query.prototype.orderDesc = function(fieldCode) {
        return this._addOrder(this._toCode(fieldCode) + ' desc');
    };

    /**
     * Add query operation for '='
     * @method equal
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.equal = function(fieldCode, value) {
        return new k.Query.Condition(this).equal(fieldCode, value);
    };

    /**
     * Add query operation for '!='
     * @method notEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.notEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).notEqual(fieldCode, value);
    };

    /**
     * Add query operation for '>'
     * @method greaterThan
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.greaterThan = function(fieldCode, value) {
        return new k.Query.Condition(this).greaterThan(fieldCode, value);
    };

    /**
     * Add query operation for '<'
     * @method lessThan
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.lessThan = function(fieldCode, value) {
        return new k.Query.Condition(this).lessThan(fieldCode, value);
    };

    /**
     * Add query operation for '>='
     * @method greaterEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.greaterEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).greaterEqual(fieldCode, value);
    };

    /**
     * Add query operation for '<='
     * @method lessEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.lessEqual = function(fieldCode, value) {
        return new k.Query.Condition(this).lessEqual(fieldCode, value);
    };

    /**
     * Add query operation for 'in'
     * @method inList
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.inList = function(fieldCode, value) {
        return new k.Query.Condition(this).inList(fieldCode, value);
    };

    /**
     * Add query operation for 'not in'
     * @method notInList
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.notInList = function(fieldCode, value) {
        return new k.Query.Condition(this).notInList(fieldCode, value);
    };

    /**
     * Add query operation for 'like'
     * @method like
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.like = function(fieldCode, value) {
        return new k.Query.Condition(this).like(fieldCode, value);
    };

    /**
     * Add query operation for 'not like'
     * @method notLike
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.notLike = function(fieldCode, value) {
        return new k.Query.Condition(this).notLike(fieldCode, value);
    };

    /**
     * Wrap Query.Condition instance to use bracket.
     *
     * <pre><code>
     * var q = app.select();
     * var cond = q.equal('foo', 'hoge').and().equal('bar','piyo');
     * var cond2 = q.greaterThan('foo', 1).and().lessThan('foo', 10);
     * q.cond(cond).and(cond2);
     * // Create query string like this bracket:
     * //  (foo = "hoge" and bar = "piyo") and (foo > 1 and foo < 10)
     * </code></pre>
     *
     * @method cond
     * @param conds {Query.Condition}
     * @return {Query.Condition} Return Query.Condition instance.
     */
    k.Query.prototype.cond = function(conds) {
        return new k.Query.Condition(this, conds);
    };


    /**
     * Set the maximum number of records.
     * This is NOT the same as query's limit.
     *
     * @method limit
     * @param numLimit {Number} The maximum number of records for a query.
     * If this value is greater than 100, fetch records several times.
     * @return {Query} Return Query(this) instance.
     */
    k.Query.prototype.limit = function(numLimit) {
        this._limit = numLimit;
        return this;
    };


    /**
     * Set offset.
     *
     * @method offset
     * @param numOffset {Number} Set offset.
     * @return {Query} Return Query(this) instance.
     */
    k.Query.prototype.offset = function(numOffset) {
        this._offset = numOffset;
        return this;
    };


    /**
     * Set filter functions.
     * Each function is called with kintone's record(json) object such as
     * {'code':{code:'code', value:'value'}. If a filterfunction return false,
     * then it is removed from the result of query. Otherwise, the record is returned.
     *
     * @method filter
     * @param filterFuncs {function|Array of functions} Set filter functions
     * to apply the result of responses for Query.
     * @return {Query} Retrun Query(this) instance.
     */
    k.Query.prototype.filter = function(filterFuncs) {
        this._addFilterFunctions('filter', filterFuncs);
        return this;
    };

    /**
     * Set map functions.
     * Each function is called with kintone's record(json) object such as
     * {'code':{code:'code', value:'value'}. When the map function updates
     * the record values, then the result of query is also changed.
     *
     * @method map
     * @param mapFuncs {function|Array of functions} Set map functions
     * to apply the result of responses for Query.
     * @return {Query} Retrun Query(this) instance.
     */
    k.Query.prototype.map = function(mapFuncs) {
        this._addFilterFunctions('map', mapFuncs);
        return this;
    };


    /**
     * Enable to return totalCount property.
     * When this method is set to call records, then
     * returned value is {records:Array of Records, totalCount:totalCountValue}
     * instead of Records only.
     * @method totalCount
     * @param opt_totalCountFlag {boolean} Set the flag explicitly.
     * @return {Query} Return Query(this) instance.
     */
    k.Query.prototype.totalCount = function(opt_totalCountFlag) {
        this._totalCountFlag = k._isDefined(opt_totalCountFlag) ? (opt_totalCountFlag ? true : false) : true;
        return this;
    };

    k.Query.prototype._addFilterFunctions = function(type, func) {
        var funcs = Array.isArray(func) ? func : [func];
        if (k._isUndefined(this._filters)) {
            this._filters = [];
        }

        this._filters.push(function(records) {
            for (var i = 0;i < funcs.length;i++) {
                if (type === 'filter') {
                    records = records.filter(funcs[i]);
                } else { // type === 'map'
                    records = records.map(funcs[i]);
                }
            }
            return records;
        });
    };

    k.Query.prototype._applyFilters = function(records) {
        if (k._isDefined(this._filters) && this._filters.length > 0) {
            for (var i = 0;i < this._filters.length;i++) {
                records = this._filters[i](records);
            }
        }
        return records;
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


    /**
     * Query.Condition is used to build query statement to fetch Records.
     * Normally, this constructor is not used directly.
     *
     * @class Query.Condition
     * @constructor
     * @param query {Query} is a Query instance for this object.
     * @param opt_cond {String|Query.Condition} This is an optional parameter.
     * If it is required to group(using a bracket), then set Query.Condition.
     * Or, just set a condition as a String instance.
     */
    k.Query.Condition = function(query, opt_cond) {
        this._query = query;
        this._qParams = [];
        if (k._isString(opt_cond)) {
            this._qParams.push('(' + opt_cond + ')');
        } else if (opt_cond instanceof k.Query.Condition) {
            this._qParams.push('(' + opt_cond.toString() + ')');
        }
    };


    /**
     * Add query operation for '='
     * @method equal
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.equal = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '=', value);
    };


    /**
     * Add query operation for '!='
     * @method notEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.notEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '!=', value);
    };


    /**
     * Add query operation for '>'
     * @method greaterThan
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.greaterThan = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '>', value);
    };


    /**
     * Add query operation for '<'
     * @method lessThan
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.lessThan = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '<', value);
    };


    /**
     * Add query operation for '>='
     * @method greaterEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.greaterEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '>=', value);
    };


    /**
     * Add query operation for '<='
     * @method lessEqual
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.lessEqual = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, '<=', value);
    };


    /**
     * Add query operation for 'in'
     * @method inList
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.inList = function(fieldCode, values) {
        var code = this._query._toCode(fieldCode);
        return this._appendQuery(code + ' in (' + k.Query.Condition._toListString(code, values) + ')');
    };


    /**
     * Add query operation for 'not in'
     * @method notInList
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.notInList = function(fieldCode, values) {
        var code = this._query._toCode(fieldCode);
        return this._appendQuery(code + ' not in (' + k.Query.Condition._toListString(code, values) + ')');
    };

    /**
     * Add query operation for 'like'
     * @method like
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.like = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, 'like', value);
    };


    /**
     * Add query operation for 'not like'
     * @method notLike
     * @param fieldCode {String} Set field code.
     * @param value {Number|String|Array|Record}
     * If Record is set, then value.val(fieldCode) is used as a value.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.notLike = function(fieldCode, value) {
        return this._addOperatorQuery(fieldCode, 'not like', value);
    };


    /**
     * Add query operation for 'or'.
     * If opt_value is set, then add 'or ( ' + value + ' )'.
     * @method or
     * @param opt_value {String|Query.Condition} If this value is set,
     * then brackets are added to value like '(' + value + ')'.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
    k.Query.Condition.prototype.or = function(opt_value) {
        this._qParams.push('or');
        if (k._isDefined(opt_value)) {
            this._qParams.push(new k.Query.Condition(this._query, opt_value).toString());
        }
        return this;
    };


    /**
     * Add query operation for 'and'.
     * If opt_value is set, then add 'and ( ' + value + ' )'.
     * @method and
     * @param opt_value {String|Query.Condition} If this value is set,
     * then brackets are added to value like '(' + value + ')'.
     * @return {Query.Condition} Return Query.Condition(this) instance.
     */
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
     *
     * @class Record
     * @constructor
     * @param app {App} Set App instance for this record.
     * @param record {Object} Set kintone record object like event.record. Or,
     * set {} for a new record.
     */
    k.Record = function(app, record) {
        this.app = app;
        this.record = record;
        this.updated = undefined;
    };

    /**
     * Create or Update records at the same time. If there are more than 100 records,
     * this update may be run several times. In this case, records may be partially
     * updated.
     *
     * This only support for the same request types like update(PUT) or create(POST).
     * records should not have both update and create records at the same time.
     *
     * @method saveAll
     * @static
     * @param records {Array of Record}
     * @param opt_params {guestSpaceId:'foo', validation:true|false}
     * @return {Promise}
     */
    k.Record.saveAll = function(records, opt_params, opt_requestParams) {
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
           return k.Record.createAll(creatingRecords, opt_params, opt_requestParams);
       } else if (updatingRecords.length > 0) {
           return k.Record.updateAll(updatingRecords, opt_params, opt_requestParams);
       } else {
           return k._reject({message:k._NO_UPDATE_FOUND_ERROR});
       }
    };


    /**
     * Create records.
     *
     * @method createAll
     * @static
     * @param records {Array of Record} All Records should be new Records.
     * @param opt_params {guestSpaceId:'foo', validation:true|false}
     * @return {Promise}
     */
    k.Record.createAll = function(records, opt_params, opt_requestParams) {
        if (k.BulkRequest._isBulk(opt_params)) {
            opt_params = k.BulkRequest._mergeParams(opt_params, opt_requestParams);
        }
        return k._recursiveUpdate(k.Record._getCreateParams(opt_params), records, opt_params);
    };

    /**
     * Update all records.
     *
     * @method updateAll
     * @static
     * @param records {Array of Record} All Records should be existing Records.
     * @param opt_params {guestSpaceId:'foo', validation:true|false}
     * If true is set to validation, then validate revisions.
     * @return {Promise}
     */
    k.Record.updateAll = function(records, opt_params, opt_requestParams) {
        if (k.BulkRequest._isBulk(opt_params)) {
            opt_params = k.BulkRequest._mergeParams(opt_params, opt_requestParams);
        }
        return k._recursiveUpdate(k.Record._getUpdateParams(opt_params), records, opt_params);
    };

    /**
     * Remove all records.
     *
     * @method removeAll
     * @static
     * @param records {Array of Record} All Records should be existing Records.
     * @param opt_params {guestSpaceId:'foo', validation:true|false}
     * @return {Promise}
     */
    k.Record.removeAll = function(records, opt_params, opt_requestParams) {
        if (k.BulkRequest._isBulk(opt_params)) {
            opt_params = k.BulkRequest._mergeParams(opt_params, opt_requestParams);
        }
        return k._recursiveUpdate(k.Record._getRemoveParams(opt_params), records, opt_params);
    };


    /**
     * Update some record status at the same time.
     * @method updateStatusAll
     * @static
     * @param records {Array of Record} All records should be existing records.
     * @param opt_params {guestSpaceId:'foo', preview:boolean}
     */
    k.Record.updateStatusAll = function(records, newStatus, opt_params) {
        return k._recursiveUpdate(k.Record._getUpdateStatusParams(newStatus, opt_params), records, opt_params);
    };


    // opt_params {guestSpaceId:'foo'}
    k.Record._getUpdateParams = function(opt_params) {
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
            url: k._requestPath('records', opt_params),
            request:'PUT',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    // opt_params {guestSpaceId:'foo'}
    k.Record._getCreateParams = function(opt_params) {
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
            url: k._requestPath('records', opt_params),
            request:'POST',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    // opt_params {guestSpaceId:'foo'}
    k.Record._getRemoveParams = function(opt_params) {
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
            url: k._requestPath('records', opt_params),
            request:'DELETE',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    k.Record._getUpdateStatusParams = function(newStatus, opt_params) {
        var toParamsHandler = function(appId, records, validateRevisions) {
            var reqRecords = [];
            for (var i = 0;i < records.length;i++) {
                var revision = validateRevisions ? records[i].revision() : undefined;
                var rid = records[i].recordId();
                var param = {action:newStatus.action};
                if (k._isUndefined(rid)) {
                    throw new Error('Record have to have id.');
                }
                param.id = rid;
                if (k._isDefined(newStatus.assignee)) {
                    param.assignee = newStatus.assignee;
                }
                if (k._isDefined(revision)) {
                    param.revision = revision;
                }
                reqRecords.push(param);
            }

            return {app:appId, records:reqRecords};
        };

        var toResultHandler = function(records, resp, opt_result) {
            for (var i = 0;i < resp.records.length;i++) {
                if (records[i].recordId() == resp.records[i].id) { // This line compares number and string.
                    records[i].revision(resp.records[i].revision);
                } else {
                    // NOTE: Ignore updating revision if record id is not matched.
                    // Normally, it should be matched.
                }
            }

            return k._isDefined(opt_result) ?
                {records:opt_result.records.concat(resp.records)} :
                {records:resp.records};
        };

        return {
            url: k._requestPath('records/status', opt_params),
            request:'PUT',
            toParamsHandler:toParamsHandler,
            toResultHandler:toResultHandler
        };
    };

    k.Record._convertToNumber = function(x) {
        return k._isString(x) ? (x.indexOf('.') != -1 ? parseFloat(x) : parseInt(x)) : x;
    };

    k.Record._convertFromNumber = function(x) {
        return k._isString(x) ? x : '' + x;
    };

    // format: 2012-01-11T11:30:00Z
    k.Record._convertToDateTime = function(dateString) {
        if (dateString instanceof Date) {
            return dateString;
        }

        if (!dateString || dateString.length < 'yyyy-MM-ddThh:mm:ssZ'.length) {
            return null;
        }

        var year = parseInt(dateString.substring(0, 4));
        var month = parseInt(dateString.substring(5, 7));
        var day = parseInt(dateString.substring(8, 10));
        var hour = parseInt(dateString.substring(11, 13));
        var min = parseInt(dateString.substring(14, 16));
        var sec = parseInt(dateString.substring(17, 19));

        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(min) || isNaN(sec)) {
            return null;
        }

        if (dateString.charAt(4)  != '-' || dateString.charAt(7)  != '-' ||
            dateString.charAt(10) != 'T' || dateString.charAt(13) != ':' ||
            dateString.charAt(16) != ':' || dateString.charAt(19) != 'Z') {
            return null;
        }

        return new Date(Date.UTC(year, month -1, day, hour, min, sec));
    };


    // format: 2012-01-11T11:30:00Z
    k.Record._convertFromDateTime = function(jsDate) {
        if (k._isString(jsDate)) {
            return jsDate;
        }

        var yyyy = jsDate.getUTCFullYear();
        var month = k._toDoubleDigits(jsDate.getUTCMonth() + 1);
        var day = k._toDoubleDigits(jsDate.getUTCDate());
        var hour = k._toDoubleDigits(jsDate.getUTCHours());
        var min = k._toDoubleDigits(jsDate.getUTCMinutes());
        var sec = k._toDoubleDigits(jsDate.getUTCSeconds());

        return '' + yyyy + '-' + month + '-' + day + 'T' + hour + ':' + min + ':' + sec + 'Z';
    };

    // Format is yyyy-MM-dd
    k.Record._convertToDate = function(dateString) {
        if (dateString instanceof Date) {
            return dateString;
        }

        if (!dateString || dateString.length < 10) {
            return null;
        }

        var year = parseInt(dateString.substring(0, 4));
        if (isNaN(year)) {
            return null;
        }

        var month = parseInt(dateString.substring(5, 7));
        if (isNaN(month)) {
            return null;
        }

        var day = parseInt(dateString.substring(8, 10));
        if (isNaN(day)) {
            return null;
        }

        return new Date(year, month -1, day);
    };

    // format is yyyy-MM-dd
    k.Record._convertFromDate = function(jsDate) {
        return k._isString(jsDate) ?
                   jsDate :
                   (jsDate.getFullYear() + '-' +
                    k._toDoubleDigits(jsDate.getMonth() + 1) + '-' +
                    k._toDoubleDigits(jsDate.getDate()));
    };

    // ref. https://cybozudev.zendesk.com/hc/ja/articles/202166330-%E3%83%95%E3%82%A3%E3%83%BC%E3%83%AB%E3%83%89%E5%BD%A2%E5%BC%8F
    k.Record._CONVERT_TO_TABLE = {
        '__REVISION__': k.Record._convertToNumber,
        '__ID__':       k.Record._convertToNumber,
        'CREATED_TIME': k.Record._convertToDateTime,
        'DATE':         k.Record._convertToDate,
        'DATETIME':     k.Record._convertToDateTime,
        'NUMBER':       k.Record._convertToNumber,
        'UPDATED_TIME': k.Record._convertToDateTime
    };
    k.Record._CONVERT_FROM_TABLE = {
        'DATE':         k.Record._convertFromDate,
        'DATETIME':     k.Record._convertFromDateTime,
        'NUMBER':       k.Record._convertFromNumber
    };

    k.Record._convertToTypeValue = function(fields, record, code) {
        var props = fields ? fields.properties: undefined;
        var value = record && record[code] ? record[code].value : undefined;
        var type = props && props[code] ? props[code].type : (record && record[code] ? record[code].type : undefined);
        var func = k.Record._CONVERT_TO_TABLE[type];
        return func ? func(value) : value;
    };

    k.Record._convertFromTypeValue = function(fields, record, code, newValue) {
        var props = fields ? fields.properties : undefined;
        var type = props && props[code] ? props[code].type : (record && record[code] ? record[code].type : undefined);
        var func = k.Record._CONVERT_FROM_TABLE[type];
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

    k.Record._isValidationEnabled = function(params) {
        return k._isDefined(params) && k._isDefined(params.validation) ?
            params.validation :
            k._DEFAULT_VALIDATE_REVISION;
    };


    /**
     * Get a value from Record.record property and then return it if
     * opt_newValue is not set.
     * Set a new value to Record property when opt_newValue is set.
     * In this case, old value is returned.
     *
     * <pre><code>
     * app.select().first().then(function(record) {
     *   var value = record.val('fieldCode');
     *   record.val('fieldCode', 10); // If fieldCode type is Number.
     *   ...
     * });
     * </code></pre>
     *
     * When getting a value:
     *
     * If one of NUMBER, __ID__, and __REVISION__ is the field type, then
     * return Number instance.
     * If one of DATE, DATETIME, CREATED_TIME, and UPDATED_TIME is the
     * field type, then return Date instance.
     * Other types are return String or Array of String.
     *
     * When setting a value:
     * DATE and DATETIME accept Date instance.
     * NUMBER accept Number instance.
     *
     * @method val
     * @param code {String} code is fieldCode or label if App.labelAccess is true.
     * @param opt_newValue {Number|Date|String|Array} is a new value when
     * updating a value.
     * @return {Number|Date|String|Array} Returned object type depends on
     * field type.
     */
    k.Record.prototype.val = function(code, opt_newValue) {
        code = this.app && this.app.labelAccess() ?
            k._toCode(this.app.fields, code, this.app.labelAccess()) :
            code;

        return k._isUndefined(opt_newValue) ?
            this._getValue(code) :
            this._setValue(code, opt_newValue);
    };

    /**
     * Get or Set recordId.
     *
     * @method recordId
     * @param opt_newRecord {Number} Set a new recordId if it is set.
     * @return {Number} Return a current recordId.
     */
    k.Record.prototype.recordId = function(opt_newRecordId) {
        return this._internalNumberVal(k.RECORD_ID_CODE, opt_newRecordId);
    };

    /**
     * Get or Set revision.
     *
     * @method revision
     * @param opt_newRevision {Number} Set a new revision if it is set.
     * @return {Number} Return a current revision.
     */
    k.Record.prototype.revision = function(opt_newRevision) {
        return this._internalNumberVal(k.REVISION_CODE, opt_newRevision);
    };

    k.Record.prototype._internalNumberVal = function(fieldCode, opt_newValue) {
        if (k._isUndefined(opt_newValue)) {
            if (this.record && this.record[fieldCode]) {
                var value = k.Record._convertToTypeValue(this.app.fields, this.record, fieldCode);
                return k._isString(value) ? parseInt(value) : value;
            } else {
                return undefined;
            }
        } else {
            k.Record._prepareValue(this, 'record', fieldCode);
            var oldValue = this.record[fieldCode].value;
            this.record[fieldCode].value = opt_newValue;
            return oldValue;
        }
    };

    /**
     * Get the flag of updated record or not.
     * @method isUpdated
     * @return {boolean} Return true if this Record is updated.
     * Otherwise, return false.
     */
    k.Record.prototype.isUpdated = function() {
        return k._isDefined(this.updated);
    };

    /**
     * Save an updated record to the server.
     * If there is a recordId, then update the record. Otherwise,
     * a new record will be created.
     *
     * @method save
     * @param opt_params {BulkRequest|{guestSpaceId:'foo', validation:true|false}}
     * Set BulkRequest instance if this method should be post/put in a bulk request.
     * Otherwise, this parameter can use as a request parameter.
     * @param opt_requestParams {guestSpaceId:'foo', validation:true|false}
     * If opt_params is a bulk request, then set this parameter as a request parameter.
     * Otherwise, this parameter is not used.
     * @return {Promise} Promise.resolve(resp) is returned when the request
     * is succeeded. If error is returned, then Promise.reject(error) is called.
     * If bulk request is set, then this method doesn't return a value.
     */
    k.Record.prototype.save = function(opt_params, opt_requestParams) {
        var bulk = k.BulkRequest._isBulk(opt_params) ? opt_params : undefined;
        var requestParams = k.BulkRequest._isBulk(opt_params) ? opt_requestParams : opt_params;
        var validateRevision = k.Record._isValidationEnabled(requestParams);
        var rid = this.recordId();
        var params;
        var url = k._requestPath('record', requestParams);
        var self = this;


        if (k._isDefined(rid) && this.isUpdated()) {
            params = validateRevision ?
                {app:this.app.appId, id:rid, revision:this.revision(), record:this.updated} :
                {app:this.app.appId, id:rid, record:this.updated};
            if (k._isDefined(bulk)) {
                bulk._add('PUT', url, params);
                return null;
            } else {
                return k._fetch(url, 'PUT', params).then(function(resp) {
                    self.revision(resp.revision);
                    return resp;
                });
            }
        } else if (k._isUndefined(rid)) {
            // NOTE: If there is no recordId, then this.record should have a new data only.
            // (No type or other values in it. Or, it may be better to filter record.)
            params = {app:this.app.appId, record:this.record};
            if (k._isDefined(bulk)) {
                bulk._add('POST', url, params);
                return null;
            } else {
                return k._fetch(url, 'POST', params).then(function(resp) {
                    self.recordId(resp.id);
                    self.revision(resp.revision);
                    return resp;
               });
            }
        } else {
            return k._reject({message:k._NO_UPDATE_FOUND_ERROR});
        }
    };

    /**
     * Delete the record of this instance.
     *
     * @method remove
     * @param opt_params {BulkRequest|{guestSpaceId:'foo', validation:true|false}}
     * Set validation to true if revision should be validated.
     * Set BulkRequest instance if this method should be post/put in a bulk request.
     * Otherwise, this parameter can use as a request parameter.
     * @param opt_requestParams {guestSpaceId:'foo', validation:true|false}
     * If opt_params is a bulk request, then set this parameter as a request parameter.
     * Otherwise, this parameter is not used.
     * @return {Promise} Return Promise.resolve(resp) if it succeed to delete a request.
     * If it failed, then Promise.reject(error) is returned.
     * If bulk request is set, then this method doesn't return a value.
     */
    k.Record.prototype.remove = function(opt_params, opt_requestParams) {
        var bulk = k.BulkRequest._isBulk(opt_params) ? opt_params : undefined;
        var requestParams = k.BulkRequest._isBulk(opt_params) ? opt_requestParams : opt_params;
        var validateRevision = k.Record._isValidationEnabled(requestParams);
        var rid = this.recordId();
        var params;
        var self = this;
        var url = k._requestPath('records', requestParams);

        if (k._isDefined(rid)) {
            params = validateRevision ?
                {app:this.app.appId, ids:[rid], revisions:[this.revision()]} :
                {app:this.app.appId, ids:[rid]};
            if (k._isDefined(bulk)) {
                bulk._add('DELETE', url, params);
            } else {
                return k._fetch(url, 'DELETE', params).then(function(resp) {
                    return resp;
                });
            }
        } else {
            return k._reject({message:k._NO_RECORD_ID_FOUND_ERROR});
        }
    };

    /**
     * Update status.
     * @method updateStatus
     * @param newStatus {action:...,revision:..., assignee:...}
     * Set a new status for this record.
     * Set action which is required. Optional value is revision and assignee.
     * @param opt_params {guestSpaceId:'foo',preview:boolean} Set a request
     * path parameters.
     * @return {Promise} Promise.resolve(resp) is returned.
     * resp contains the result of this request.
     */
    k.Record.prototype.updateStatus = function(newStatus, opt_params) {
        var url = k._requestPath('record/status', opt_params);
        var rid = this.recordId();
        var rev = k._isDefined(newStatus.revision) ? newStatus.revision : this.revision();
        var params = {app:this.app.appId, id:rid, action:newStatus.action};

        if (k._isDefined(rev)) {
            params.revision = rev;
        }
        if (k._isDefined(newStatus.assignee)) {
            params.assignee = newStatus.assignee;
        }

        return k._fetch(url, 'PUT', params);
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


    /**
     * Create a new JS Object to handle kintone space.
     *
     * @class Space
     * @constructor
     * @param id {String} a space id.
     * @param opt_isGuest {boolean} Set a guest space flag.
     * The default value is false.
     */
    k.Space = function(id, opt_isGuest) {
        this.id = id;
        this._isGuest = k._isDefined(opt_isGuest) ? opt_isGuest : false;
    };

    /**
     * Get a new Space instance.
     * @method getSpace
     * @static
     * @param id {String} Space id.
     * @param opt_isGuest {boolean} Set a guest space or not.
     * If a new space instance is for a guest, then set to true.
     * @return a new Space instance.
     */
    k.Space.getSpace = function(id, opt_isGuest) {
        return new k.Space(id, opt_isGuest);
    };

    /**
     * Create a new Space in kintone env.
     * @method create
     * @static
     * @param params {JS Object} See doc.
     * @return {Promise} Promise instance is returned. And returned value is
     * aexlib.kintone.Space instance and Space.id has the created new instance.
     */
    k.Space.create = function(params) {
        return k._fetch(k._requestPath('template/space'),
            'POST', params, this, 'space').then(function(resp) {
            return new k.Space(resp.id);
        });
    };

    /**
     * Create guest users in kintone env.
     * @method createGuests
     * @static
     * @param guests {guests: ...} See doc for details.
     * @return {Promise} Promise instance is returned.
     */
    k.Space.createGuests = function(guests) {
        return k._fetch(k._requestPath('guests'), 'POST', guests);
    };

    /**
     * Fetch space information and return Promise.
     * @method fetchSpace
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resolve(resp) is returned. And Space.space is also set.
     * If the response has 'isGuest' property, then it is also set to space._isGuest
     * which is used for a request path after this method.
     */
    k.Space.prototype.fetchSpace = function(opt_isGuest) {
        var self = this;
        return k._fetch(k._requestPath('space', this._guestSpaceParams(opt_isGuest)),
            'GET', {id: this.id}, this, 'space').then(function(resp) {
            if (k._isDefined(resp.isGuest)) {
               self._isGuest = resp.isGuest;
            }
            return resp;
        });
    };

    /**
     * Update space body text and return Promise.
     * @method updateBody
     * @param htmlText {String} Set updated body text.
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resove(resp) is returned.
     */
    k.Space.prototype.updateBody = function(htmlText, opt_isGuest) {
        return k._fetch(k._requestPath('space/body', this._guestSpaceParams(opt_isGuest)),
            'PUT', {id: this.id, body:htmlText});
    };

    /**
     * Update thread text and return Promise.
     * @method updateThread
     * @param name {String} a thread name
     * @param htmlText {String} Set updated body text.
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resove(resp) is returned.
     */
    k.Space.prototype.updateThread = function(name, htmlText, opt_isGuest) {
        return k._fetch(k._requestPath('space/thread', this._guestSpaceParams(opt_isGuest)),
            'PUT', {id: this.id, name:name, body:htmlText});
    };


    /**
     * Fetch members and return it by Promise.resolve(resp).
     * @method fetchMembers
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resolve(resp) is returned. And Space.members is also set.
     * The returned response is like {members: [ ... ]}
     */
    k.Space.prototype.fetchMembers = function(opt_isGuest) {
        return k._fetch(k._requestPath('space/members', this._guestSpaceParams(opt_isGuest)),
            'GET', {id: this.id}, this, 'members');
    };

    /**
     * Update members and return Promise.
     * @method updateMembers
     * @param members {members:[...]} Set members to update members in kintone.
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resolve(resp) is returned.
     */
    k.Space.prototype.updateMembers = function(members, opt_isGuest) {
        return k._fetch(k._requestPath('space/members', this._guestSpaceParams(opt_isGuest)),
            'PUT', {id: this.id, members:members.members});
    };

    /**
     * Update guest space's guests. Space.id should be for a guest space id.
     * @method updateGuests
     * @param guests {guests:[...]} Set guests to update guests in a guest space.
     * @return {Promise} Promise.resolve(resp) is returned.
     */
    k.Space.prototype.updateGuests = function(guests) {
        return k._fetch(k._requestPath('space/guests', {guestSpaceId:this.id}),
            'PUT', {id: this.id, guests:guests.guests});
    };

    /**
     * Remove space from kintone.
     * @method remove
     * @param opt_isGuest {boolean} Set a guest space id if this value is true.
     * @return {Promise} Promise.resolve(resp) is returned.
     */
    k.Space.prototype.remove = function(opt_isGuest) {
        return k._fetch(k._requestPath('space', this._guestSpaceParams(opt_isGuest)),
            'DELETE', {id: this.id});
    };

    k.Space.prototype._guestSpaceParams = function(opt_isGuest) {
        return this._checkGuest(opt_isGuest) ? {guestSpaceId:this.id} : undefined;
    };

    k.Space.prototype._checkGuest = function(opt_isGuest) {
        return k._isDefined(opt_isGuest) ? opt_isGuest : (k._isDefined(this._isGuest) ? this._isGuest : false);
    };


    /**
     * Helper class to send buld request.
     *
     * @class BulkRequest
     *
     */
    k.BulkRequest = function() {
        this._requests = [];
    };

    /**
     * Create a new BulkRequest instance.
     * @method newRequest
     * @static
     * @return {BulkRequest} a new instance.
     */
    k.BulkRequest.newRequest = function() {
        return new k.BulkRequest();
    };

    k.BulkRequest._isBulk = function(bulkRequest) {
        return k._isDefined(bulkRequest) && (bulkRequest instanceof k.BulkRequest);
    };

    k.BulkRequest._mergeParams = function(bulk, opt_requestParams) {
        if (k._isDefined(opt_requestParams)) {
            opt_requestParams._bulk = bulk;
            return opt_requestParams;
        } else {
            return {_bulk:bulk};
        }
    };

    k.BulkRequest.prototype._add = function(method, requestPath, params) {
        this._requests.push({method:method, api:requestPath, payload:params});
    };

    /**
     * TODO: This should be able to send more than 20 requests.
     * Send a bulk request.
     * @method send
     * @param opt_params {guestSpaceId:'foo'} Set guestSpaceId if this request is for
     * a guest space request.
     * @return {Promise}
     */
    k.BulkRequest.prototype.send = function(opt_params) {
        return k._fetch(k._requestPath('bulkRequest', opt_params),
            'POST', {requests:this._requests});
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

