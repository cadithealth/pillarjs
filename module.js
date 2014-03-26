/*
  Module
  Synchronous dependency resolver.

  * What Is it?

    Module is a javascript dependency resolver. It helps you structure
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

    In development and production, Module performs loading the same
    way; synchronously. It makes no difference if your files are
    served separately, concatenated, or minified.

  * Basic Usage

    To define a module:
      module.register(moduleName, function() {...})

    To include a module:
      module.register('foobar', function(moduleA, moduleB) {...})
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

       module.register('$', function() {
         var jQuery = jQuery;
         window.$ = null;  // Remove global references to jQuery.
         window.jQuery = null;
         return jQuery;
       });

       module.register('Backbone', function() {
         var Backbone = Backbone;
         window.Backbone = null;
         return Backbone;
       });

    You might want to package all your adapters into a single
    module like this:

       module.register('adaptors', function() {

         module.register('$', function() {
           var jQuery = jQuery;
           window.$ = null;  // Remove global references to jQuery.
           window.jQuery = null;
           return jQuery;
         });


         module.register('Backbone', function() {
           var Backbone = Backbone;
           window.Backbone = null;
           return Backbone;
         });

         return module.needs(['$', 'Backbone'])

       });

    Then from your main module, you can do this:

      module.register('main', function() {
        runs('adaptors');  // Same as needs, but suppresses return value.
      });

  * Issues
    - Circular dependencies are an issue. Module fails if it
      detects if it detects one. For example, this is critically bad:

        module.register('foo', function(bar) {...});
        module.register('bar', function(foo) {...});

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
      asynchronous loading in dev mode. Module is not a module loader,
      it is a dependency resolver whereas RequireJS is a module loader
      AND a dependency resolver. This actually makes it more
      comparable to Almond than RequireJS.

    - RequireJS executes code within a define block as soon as the
      file is loaded. Module waits until a module is needed before it
      executes its define block.

    - Doesn't come packaged with a directory traversal or file
      minification/concatenation tool akin r.js

    - Defined modules must be given names so they can be
      referenced. The downside to this is that names must be managed,
      but module referencing is more flexible.

    - With Module, you can define a module anywhere and as many as you
      want within a single file. You can also list and get
      dependencies anywhere you want. For example, this is perfectly valid code:

        // utils.js

        module.register('domUtils', function() {});
        module.register('strUtils', function(depA, depB) {

          // This has the same effect of listing "depC" in the parameters.
          var depC = needs('depC');

          // More includes.
          var moreDeps = needs(['app', 'math', 'trig']);

          for (var i=0; i < 4; i++) {

            // Registering modules dynamically.
            module.register('module' + i, function() {
              return i;
            }));

          }

        });

    - Dependencies can be listed in function parameters similar to
      AngularJS. Example:

        // RequireJS
        define(['app/app', 'utils/dom'], function(app, domUtils), {...});

        // Module
        module.register('main', function(app, domUtils) {...});

  * Similarities with RequireJS

    - Both require an entry point file. RequireJS requires a main.js
      file. Module simply requires you to register a module named
      "main".

  * TODO
    - Give it a trendy name. Eg, Tangler, Lasso, Curkit,
      standoff. "Module" is too generic and probably taken.
    - Write unit tests.
    - What about circular dependencies?
    - Detect circular dependencies and throw errors.
    - Allow global/default options.
    - In register, disallow any tag names that can't be used as in function params.
    - Allow namespace needs(). Eg,

      Allow separator option (default=/).
      needs:
       'editor: controller view', -> editor/controller, editor/view
       'gui: controller view'     -> editor/controller, editor/view

    - Document options

*/


(function(context) {

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
  context.needs = function(moduleNames) {

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

  // Alias for needs(), but suppresses return value. You can always
  // use needs() instead, but calling this instead makes it clear that
  // you care only about the module's definition code, not whatever
  // (if anything) the module returns.
  context.runs = function() {
    needs.apply(null, arguments);
    return null;
  };

  context.module = loader;

})(window);
