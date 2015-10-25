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

var kintone = kintone || {};

(function (kintone) { // namespace: np.sio
  
  kintone.events = {};
  kintone.events.off = function() {};
  kintone.events.on = function() {};
  kintone.plugin = {};
  kintone.plugin.app = {};
  kintone.plugin.app.setConfig = function(x) { };
  kintone.plugin.app.getConfig = function(x) { return {}; };
  kintone.api = function() {
      return new Promise(function(resolve) { resolve(); });
  };
  kintone.api.url = function() {};
  kintone.app = {};
  kintone.app.getId = function() {};
  kintone.app.getFieldElements = function() {};

  kintone.app.record = {};
  kintone.app.record.getHeaderMenuSpaceElement = function() {};
  kintone.app.record.setFieldShown = function() {};
  kintone.app.record.getFieldElement = function() {};

})(kintone = kintone || {}); // namespace

