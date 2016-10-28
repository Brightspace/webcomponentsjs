/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
window.HTMLImports.addModule(function(scope) {

// imports
var xhr = scope.xhr;
var flags = scope.flags;

// This loader supports a dynamic list of urls
// and an oncomplete callback that is called when the loader is done.
// NOTE: The polyfill currently does *not* need this dynamism or the
// onComplete concept. Because of this, the loader could be simplified
// quite a bit.
var Loader = function(onLoad, onComplete) {
  this.cache = {};
  this.onload = onLoad;
  this.oncomplete = onComplete;
  this.inflight = 0;
  this.pending = {};

  this._isIE = (function() {
    var ua = window.navigator.userAgent;

    return ua.indexOf('MSIE ') !== -1
      || ua.indexOf('Trident/') !== -1;
  })();
};

Loader.prototype = {

  addNodes: function(nodes) {
    // number of transactions to complete
    this.inflight += nodes.length;
    // commence transactions
    for (var i=0, l=nodes.length, n; (i<l) && (n=nodes[i]); i++) {
      this.require(n);
    }
    // anything to do?
    this.checkDone();
  },

  addNode: function(node) {
    // number of transactions to complete
    this.inflight++;
    // commence transactions
    this.require(node);
    // anything to do?
    this.checkDone();
  },

  require: function(elt) {
    var url = elt.src || elt.href;
    // ensure we have a standard url that can be used
    // reliably for deduping.
    // TODO(sjmiles): ad-hoc
    elt.__nodeUrl = url;
    // deduplication
    if (!this.dedupe(url, elt)) {
      // fetch this resource
      this.fetch(url, elt);
    }
  },

  dedupe: function(url, elt) {
    if (this.pending[url]) {
      // add to list of nodes waiting for inUrl
      this.pending[url].push(elt);
      // don't need fetch
      return true;
    }
    var resource;
    if (this.cache[url]) {
      this.onload(url, elt, this.cache[url]);
      // finished this transaction
      this.tail();
      // don't need fetch
      return true;
    }
    // first node waiting for inUrl
    this.pending[url] = [elt];
    // need fetch (not a dupe)
    return false;
  },

  fetch: function(url, elt) {
    flags.load && console.log('fetch', url, elt);
    if (!url) {
      setTimeout(function() {
        this.receive(url, elt, {error: 'href must be specified'}, null);
      }.bind(this), 0);
    } else if (url.match(/^data:/)) {
      // Handle Data URI Scheme
      var pieces = url.split(',');
      var header = pieces[0];
      var body = pieces[1];
      if(header.indexOf(';base64') > -1) {
        body = atob(body);
      } else {
        body = decodeURIComponent(body);
      }
      setTimeout(function() {
          this.receive(url, elt, null, body);
      }.bind(this), 0);
    } else if(this._isIE && this._urlIsCrossOrigin(url)) {
      this._addJsonpUtilities();

      var script = document.createElement('script');
      script.async = 'async';
      script.src = url + '.jsonp';
      document.body.appendChild(script);
    } else {
      var receiveXhr = function(err, resource, redirectedUrl) {
        this.receive(url, elt, err, resource, redirectedUrl);
      }.bind(this);
      xhr.load(url, receiveXhr);
    }
  },

  receive: function(url, elt, err, resource, redirectedUrl) {
    this.cache[url] = resource;
    var $p = this.pending[url];
    for (var i=0, l=$p.length, p; (i<l) && (p=$p[i]); i++) {
      // If url was redirected, use the redirected location so paths are
      // calculated relative to that.
      this.onload(url, p, resource, err, redirectedUrl);
      this.tail();
    }
    this.pending[url] = null;
  },

  tail: function() {
    --this.inflight;
    this.checkDone();
  },

  checkDone: function() {
    if (!this.inflight) {
      this.oncomplete();
    }
  },

  _urlIsCrossOrigin: function(url) {
    return url.indexOf(window.location.origin + '/') !== 0;
  },

  _addJsonpUtilities: function() {
    window._d2l_receiveJsonpImport = window._d2l_receiveJsonpImport
      || function(resourceId, resource) {
        var scriptElements = document.querySelectorAll('script');
        for(var i = 0; i < scriptElements.length; ++i) {
          var script = scriptElements[i];
          var url = script.src.substr(0, script.src.length - 6); // strip jsonp
          var lastIndex = url.lastIndexOf(resouceId);
          if (lastIndex !== -1 && lastIndex) === url.length - resourceId.length) {
            this.receive(url, null, null, resource, null);
            script.parentElement.removeChild(script);
            break;
          }
        }
      }.bind(this);
  }

};

// exports
scope.Loader = Loader;

});
