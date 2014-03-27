/*
  Pillar
  Synchronous dependency resolver.

  * What Is it?

    Pillar is a javascript dependency resolver. It helps you structure
    your app as modules.

    Basically, you define your app as a bunch of encapsulated
    modules.

    Each module is a function that lists its dependencies to other
    modules.

    You have one module called "main" that kicks everything off. That's
    pretty much all there is to it.

  * Why Does This Exist?

    RequireJS is a fine tool, but I had some issues with it. In
    production, you usually want to compress your assets into a single
    file and serve it as such. In development, you want to serve your
    assets separately. In dev mode with RequireJS, you perform
    asynchronous requests to the server to get modules, but this
    breaks parity with how you get assets in production (ie, in prod,
    all your files are in one big glob, so you don't need to hit the
    server).

    Usually, this makes no difference, but there are cases where it
    does. For example, if you're building an Ember app and define your
    routes in different modules - the app will fail if you try to
    navigate to a route before it's module file has been loaded. In
    production mode, however, it would work.

    In development and production, Pillar performs loading the same
    way; synchronously. It makes no difference if your files are
    served separately, concatenated, or minified.

  * Basic Usage

    To define a module:
      module.define(moduleName, function() {...})

    To include a module:
      module.define('foobar', function(moduleA, moduleB) {...})
    OR
      needs('moduleA', 'moduleB')

  * Where To Include Files

    Suggestions on where to include your asset files (ie, <head>,
    <body>) are only guidelines. Do what's best for your app.

    - Include this file in the <head> tag so it loads quickly.
    - Include your module definition files in the <body>.
    - You modules need to be defined before they can be loaded, so
      include your main module after your module definitions.

  ** Working With Third Party Libraries

     I prefer to simply leave third-party libraries as globals, but if
     you want to be very strictly modular, you can define adapters
     like so:

       module.define('$', function() {
         var jQuery = jQuery;
         window.$ = null;  // Remove global references to jQuery.
         window.jQuery = null;
         return jQuery;
       });

       module.define('Backbone', function() {
         var Backbone = Backbone;
         window.Backbone = null;
         return Backbone;
       });

    You might want to package all your adapters into a single
    module like this:

       module.define('adaptors', function() {

         module.define('$', function() {
           var jQuery = jQuery;
           window.$ = null;  // Remove global references to jQuery.
           window.jQuery = null;
           return jQuery;
         });


         module.define('Backbone', function() {
           var Backbone = Backbone;
           window.Backbone = null;
           return Backbone;
         });

         return module.needs(['$', 'Backbone'])

       });

    Then from your main module, you can do this:

      module.define('main', function() {
        runs('adaptors');  // Same as needs, but suppresses return value.
      });

  * Issues
    - Circular dependencies are an issue. Pillar fails if it
      detects if it detects one. For example, this is critically bad:

        module.define('foo', function(bar) {...});
        module.define('bar', function(foo) {...});

  * Guidelines For A Good Dependency Resolver
    - Doesn't get in the way of:
      - [X] Debugging
      - [X] Minification
      - [X] Gzip compression
      - [X] File concatentation
      - [X] Caching
    - [ ] File load order doesn't matter.
    - [X] Supports fast development/reloads.
    - [X] Production and development mode is the same.

  * Differences with RequireJS

    - The biggest difference is that this library doesn't do
      asynchronous loading in dev mode. Pillar is not a module loader,
      it is a dependency resolver whereas RequireJS is a module loader
      AND a dependency resolver. This actually makes it more
      comparable to Almond than RequireJS.

    - RequireJS executes code within a define block as soon as the
      file is loaded. Pillar waits until a module is needed before it
      executes its define block.

    - Doesn't come packaged with a directory traversal or file
      minification/concatenation tool akin r.js

    - Defined modules must be given names so they can be
      referenced. The downside to this is that names must be managed,
      but module referencing is more flexible.

    - With Pillar, you can define a module anywhere and as many as you
      want within a single file. You can also list and get
      dependencies anywhere you want. For example, this is perfectly valid code:

        // utils.js

        module.define('domUtils', function() {});
        module.define('strUtils', function(depA, depB) {

          // This has the same effect of listing "depC" in the parameters.
          var depC = needs('depC');

          // More includes.
          var moreDeps = needs(['app', 'math', 'trig']);

          for (var i=0; i < 4; i++) {

            // Defining modules dynamically.
            module.define('module' + i, function() {
              return i;
            }));

          }

        });

    - Dependencies can be listed in function parameters similar to
      AngularJS. Example:

        // RequireJS
        define(['app/app', 'utils/dom'], function(app, domUtils), {...});

        // Pillar
        module.define('main', function(app, domUtils) {...});

  * Similarities with RequireJS

    - Both require an entry point file. RequireJS requires a main.js
      file. Pillar simply requires you to define a module named
      "main".

  * TODO
    - Update docs
    - Write unit tests.
    - In define, disallow any moduleNames that can't be used as in function params?
    - Disallow certain characters so that namespacing works. Ex: space
    - Allow namespace needs(). Eg,

        Allow separator option (default=/).
        needs:
         'editor: controller view', -> editor/controller, editor/view
         'gui: controller view'     -> editor/controller, editor/view

    - s/module/pillar
    - Add @logAfterLoad option
    - Revise docs
    - Add throwError function

*/


var pillar = (function() {

  'use strict';

  function first(arr) {
    if (arr.length > 0)
      return arr[0];
    else
      throw "Error: Object has no items.";
  }

  function hasKey(obj, key) {
    return obj.hasOwnProperty(key);
  }

  // arguments -> array
  function toArr(args) {
    return Array.prototype.slice.call(args);
  }

  function keys(obj) {
    var results = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
        results.push(key);
    }
    return results;
  }

  // Returns the values of an object.
  function values(obj) {
    var results = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key))
        results.push(obj[key]);
    }
    return results;
  }

  // Removes a value from an array and returns the array. Uses
  // identity to check, not equality.
  function removeFromArr(arr, val) {
    for (var i=0; i < arr.length; i++) {
      if (arr[i] === val) {
        arr.splice(i, 1);
        return arr;
      }
    }
    return arr;
  }

  // Merges object @right into object @left and returns object @left.
  function merge(left, right) {
    for (var key in right) {
      if (hasKey(right, key))
        left[key] = right[key];
    }
    return left;
  }

  function map(arr, fn) {
    var results = [];
    for (var i=0; i < arr.length; i++) {
      results.push(fn(arr[i]));
    }
    return results;
  }

  // Gets items in an array that appear more than once.
  function getDuplicates(arr) {
    var dupes = [];
    for (var i=0; i < arr.length - 1; i++) {
      for (var j=i+1; j < arr.length; j++) {
        if (arr[i] === arr[j])
          dupes.push(arr[i]);
      }
    }
    return dupes;
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

  function Package(config) {

    if (typeof config !== 'undefined')
      var config = {};

    this.modules = {};

    this.defaultModuleOptions = {
      loadNow: false,
      logOnLoad: false
    };

    this.nthModuleLoaded = 0;

    this.config(config);

    // Modules being loaded. Used to detect circular imports.
    this.loading = [];

  };

  // @pillar.Package.Module
  // You won't need to touch this because the proper interface is
  // @addModule, but it's here if you need it.
  Package.Module = Module;

  // Package methods
  merge(Package.prototype, {

    // Set default module options.
    config: function(options) {
      merge(this.defaultModuleOptions, options);
    },

    exists: function(moduleName) {
      return hasKey(this.modules, moduleName);
    },

    getModule: function(moduleName) {
      if (this.exists(moduleName))
        return this.modules[moduleName];
      else {
        var errorMsg = 'PillarError: Module [' + moduleName + '] not found.';
        for (var key in this.modules) {
          if (this.modules.hasOwnProperty(key)) {
            if (moduleName.toLowerCase() === key.toLowerCase()) {
              errorMsg += ' Did you mean [' + key + ']?';
              break;
            }
          }
        }
        throw errorMsg;
      }
    },

    /*
      Loads packages. Arguments are flexible. Eg, these all return the
      same result.

        needs('foo', 'bar');
        needs(['foo', 'bar']);
        needs('foo bar');
    */
    needs: function(moduleNames) {

      var that = this;

      if (arguments.length > 1)
        moduleNames = toArr(arguments);

      if (typeof moduleNames === 'string') {
        var split = moduleNames.split(' ');
        if (split.length > 1)
          return this.needs(split);
        else {
          var moduleName = moduleNames;
          var module = this.getModule(moduleName);
          this.nthModuleLoaded += 1;
          module.nthModuleLoaded = this.nthModuleLoaded;
          return this.load(module);
        }
      }

      if (moduleNames instanceof Array) {
        var results = {};
        for (var i=0; i < moduleNames.length; i++) {
          var name = moduleNames[i];
          results[name] = this.needs(name);
        }
        return results;
      }

    },

    load: function(module) {
      this.addToLoading(module);
      this.checkCircularDeps();
      var result = module.load();
      this.removeFromLoading(module);
      return result;
    },

    addToLoading: function(module) {
      this.loading.push(module.moduleName);
    },

    removeFromLoading: function(module) {
      removeFromArr(this.loading, module.moduleName);
    },

    // Checks if there's a sneaky circular dependency making the rounds.
    checkCircularDeps: function() {
      var circularDeps = getDuplicates(this.loading);
      if (circularDeps.length > 0)
        throw "PillarError: Circular dependency detected on modules [" + circularDeps.join(', ') + "].";
      return false;
    },

    /*
      Same as @needs, but always returns undefined. You can always use
      @load instead, but calling this clarifies that you don't need
      the return value.
    */
    run: function() {
      this.needs.apply(this, arguments);
      return undefined;
    },

    /*
      Defines a module. Similar to RequireJS's define function. The
      module name is case-sensitive.
    */
    define: function(moduleName, fn, options) {

      /*

        options: {

          @loadNow: Load the module right now, without any other
          module calling it as a dependency. Be careful with this
          option as it allows your app to undermine the behavoir or
          "main" by having multiple entry points.

          @logOnLoad: Show a message when this module is loaded.

        }

      */

      if (typeof options === 'undefined')
        var options = {};

      // Problem: This sets the options property on the loader object, not the module.
      // this.options = merge(merge({}, this.defaultOptions), options);

      if (typeof moduleName !== 'string')
        throw "PillarError: First parameter must be a unique string to identify the module.";
      else if (moduleName.length == 0)
        throw "PillarError: Module name cannot be an empty string.";
      else if (this.exists(moduleName))
        throw "PillarError: Module [" + moduleName + "] already exists.";

      this.addModule(moduleName, fn, options);
      if (moduleName === 'main' || options.loadNow)
        this.needs(moduleName);

    },

    addModule: function(moduleName, fn, options) {
      return this.modules[moduleName] = new Module({
        package: this,
        moduleName: moduleName,
        definition : fn,
        options: merge(merge({}, this.defaultModuleOptions), options)
      });
    }

  });

  function Module(opts) {

    if (typeof opts === 'undefined')
      var opts = {};

    if (!hasKey(opts, 'package'))
      throw "PillarError: You must attach the module to a Package object.";

    this.package = opts.package;
    this.moduleName = opts.moduleName;
    this.options = merge(merge({}, opts.package.defaultOptions), opts.options);

    this._definition = opts.definition;
    this._cache = null;
    this._isCached = false;

  }

  merge(Module.prototype, {

    cache: function(expr) {
      this._cache = expr;
      this._isCached = true;
      return expr;
    },

    isCached: function() {
      return this._isCached;
    },

    // TODO: This fn shouldn't need to exist. Don't expose internals.
    getCache: function() {
      return this._cache;
    },

    getDefinition: function() {
      return this._definition;
    },

    callDefinition: function() {
      return this.cache(this._definition.apply(this, arguments));
    },

    load: function() {
      if (!this.isCached()) {
        if (this.options.logOnLoad)
          console.log('Pillar: Loading [' + this.moduleName + ']');
        var paramNames = getFnParams(this.getDefinition());
        var dependencies = this.needs(paramNames);
        this.callDefinition.apply(this, (values(dependencies)));
      }
      return this.getCache();
    },

    needs: function() {
      return this.package.needs.apply(this.package, arguments);
    },

    run: function() {
      return this.package.run.apply(this.package, arguments);
    }

  });

  return {Package: Package};

})();
