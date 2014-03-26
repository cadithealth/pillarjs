/*
  module.js

  Synchronous dependency loader.

  TODO: Give it a trendy name. E.g, Tangler, Lasso, Curkit
  TODO: <description>
  TODO: Write unit tests.
  TODO: What about circular dependencies?
  TODO: What about server-side stuff?
  TODO: What about other libraries (?:create adapters)?
  TODO: Allow global/default options.
  TODO: In register, disallow any tag names that can't be used as in function params.
  TODO: Allow namespace needs(). E.g,


    Allow separator option (default=/).
    needs:
     'editor: controller view', -> editor/controller, editor/view
     'gui: controller view'     -> editor/controller, editor/view

*/


(function() {

  'use strict';

  function hasKey(obj, key) {
    return obj.hasOwnProperty(key);
  }

  // Merges object @right into object @left and returns object @left.
  function merge(left, right) {
    for (var key in right) {
      if (hasKey(right, key))
        left[key] = right[key];
    }
    return left;
  }

  // Gets function parameters as a list of strings.
  // Source: http://stackoverflow.com/a/9924463/376590
  function getFnParams(fn) {
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var fnStr = fn.toString().replace(STRIP_COMMENTS, '');
    var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
    if (result == null)
      result = [];
    return result;
  }

  function Loader() {
    this.modules = {};
    this.cache = {};
  };

  var loader = new Loader();

  merge(Loader.prototype, {


    exists: function(moduleName) {
      return hasKey(this.modules, moduleName);
    },

    // Get a module. If it doesn't exist, throw an error.
    get: function(moduleName) {
      if (this.exists(moduleName))
        return this.modules[moduleName];
      else
        throw 'ModuleError: Module [' + moduleName + '] not found.';
    },

    // Loads a module and its dependencies.
    load: function(moduleName) {

      if (!hasKey(this.cache, moduleName)) {

        var module = this.get(moduleName);
        var paramNames = getFnParams(module);
        var args = [];

        for (var i=0; i < paramNames.length; i++)
          args.push(this.load(paramNames[i]));

        var moduleThis = {
          moduleName: moduleName,
          moduleParams: paramNames
        };

        this.cache[moduleName] = module.apply(moduleThis, args);

      }

      return this.cache[moduleName];

    },

    /*
      Register a module. Similar to RequireJS's define function. Names
      are case-sensitive.
    */
    register: function(tag, fn, options) {

      /*

        options: {

          @loadNow: Load the module right now, without any other
          module calling it as a dependency. Be careful with this
          option as it allows your app to undermine the behavoir or
          "main" by having multiple entry points.

          @log: Show a message when this module is loaded.

        }


      */

      if (typeof options === 'undefined')
        var options = {};

      if (typeof tag !== 'string')
        throw "ModuleError: First parameter must be a unique tag string for the module.";
      else if (tag.length == 0)
        throw "ModuleError: Tag cannot be an empty string.";
      else if (this.exists(tag))
        throw "ModuleError: Module [" + tag + "] already exists.";

      this.modules[tag] = fn;
      if (tag === 'main' || options.loadNow)
        this.load(tag);

    }

  });

  // Alias for module.load, but can also take an array. It can also take a string with spaces.
  window.needs = function(moduleNames) {

    if (typeof moduleNames === 'string') {
      var split = moduleNames.split(' ');
      if (split.length > 1)
        moduleNames = split;
      else
        return loader.load(moduleNames);
    }

    if (moduleNames instanceof Array) {
      var moduleRets = {};
      for (var i=0; i < moduleNames.length; i++) {
        var name = moduleNames[i];
        moduleRets[name] = loader.load(name);
      }
      return moduleRets;
    }

  };

  window.module = loader;

})();
