/*
  Pillar unit tests
*/


var should = require('./chai').should();
var pillar = require('../pillar');
var util = pillar.util;
var error = pillar.error;
var sinon = require('./sinon/lib/sinon');

// Helpers

/*
  Syntax:
    compose(fn)(args) -> fn
  Example:
    var fn = compose(Math.min, Math)(2, 5);
    fn() -> 2
*/
var compose = function(fn, context) {
  return function() {
    var args = arguments;
    return function() {
      return fn.apply(context, args);
    };
  };
};

var bind = function(fn, context) {
  return function() {
    return fn.apply(context, arguments)
  }
};

describe("Util", function() {

  // Make functions in util available in current scrope.
  for (var key in util)
    eval('var ' + key + ' = util[key];');

  beforeEach(function() {
    this.simpleArr = [1, 2, 3, 4];
    this.simpleObj = {a:1, b:2, c:3, d:4};
  });

  describe("first", function() {
    it("returns the first value of an array", function() {
      first(this.simpleArr).should.equal(1);
    });
    it("throws an error", function() {
      compose(first)([]).should.throw();
      first.should.throw();
    });
  });

  describe("last", function() {
    it("returns the last value of an array", function() {
      last(this.simpleArr).should.equal(4);
    });
    it("throws an error", function() {
      compose(last)([]).should.throw();
      last.should.throw();
    });
  });

  describe("trim", function() {
    it("removes spaces around a string", function() {
      trim('  hello world   ').should.equal('hello world');
      trim('    ').should.equal('');
      trim('').should.equal('');
    });
  });

  describe("index", function() {
    it("returns the index of a value in an array", function() {
      index(this.simpleArr, 2).should.equal(1);
      index(['a', 'b', 'c', 'd'], 'd').should.equal(3);
      index(this.simpleArr, 'foobar').should.equal(-1);
    });
  });

  describe("has", function() {
    it("returns true if a collection has a value", function() {
      has(this.simpleArr, 3).should.be.true;
      has(this.simpleArr, 42).should.be.false;
    });
  });

  describe("keys", function() {
    it("returns the keys of a dict", function() {
      keys(this.simpleObj).should.eql(['a', 'b', 'c', 'd']);
    });
  });

  describe("values", function() {
    it("returns the values of a dict", function() {
      values(this.simpleObj).should.eql([1, 2, 3, 4]);
    });
  });

  describe("getDuplicates", function() {
    it("returns duplicate values in an array", function() {
      getDuplicates([1, 2, 3, 1, 1, 2]).should.eql([1, 2]);
    });
  });


  describe("getFnName", function() {
    it("returns a function's name", function() {
      getFnName(function foobar(){}).should.equal('foobar');
    });
  });

  describe("getFnParams", function() {
    it("returns the parameter names of a function", function() {
      getFnParams(function(foo, bar,    qux,   baz){})
        .should.eql(['foo', 'bar', 'qux', 'baz']);
    });
  });

  describe("fmt", function() {
    it("formats a string", function() {
      fmt('{foo} there {bar}', {foo: 'hello', bar: 'world'}).should.equal('hello there world');
    });
  });

  // Todo: Split this into separate functions.
  describe("parseNeeds", function() {
    it("formats a list of requirements into a flat array", function() {

      var foobarqux = ['foo', 'bar', 'qux'];
      var foobarheythere = ['foo', 'bar', 'hey', 'there'];
      var foobarheytherenow = ['foo', 'bar', 'hey', 'there', 'now'];
      var foobarheytherenowand = ['foo', 'bar', 'hey', 'there', 'now', 'and'];
      var abcd = ['foo/a', 'foo/b', 'foo/c', 'foo/d'];

      parseNeeds(['foo']).should.eql(['foo']);

      parseNeeds(['foo bar qux']).should.eql(foobarqux);
      parseNeeds(['foo', 'bar', 'qux']).should.eql(foobarqux);
      parseNeeds([['foo', 'bar', 'qux']]).should.eql(foobarqux);
      parseNeeds([['foo', 'bar'], 'qux']).should.eql(foobarqux);
      parseNeeds([['foo', 'bar'], ['qux']]).should.eql(foobarqux);

      parseNeeds([['foo', 'bar'], 'hey there']).should.eql(foobarheythere);
      parseNeeds([['foo', 'bar'], 'hey there', 'now']).should.eql(foobarheytherenow);
      parseNeeds([['foo', 'bar'], 'hey there', ['now']]).should.eql(foobarheytherenow);

      parseNeeds([['foo', 'bar'], 'hey there', ['now', 'and']]).should.eql(foobarheytherenowand);

      parseNeeds(['foo: a b c d']).should.eql(abcd);
      parseNeeds(['foo: a b', ['bar: a b c', ['qux: a b']]])
        .should.eql([
          'foo/a', 'foo/b',
          'bar/a', 'bar/b', 'bar/c',
          'qux/a', 'qux/b'
        ]);

    });

  });

});

describe("Package", function() {

  // Todo

  var app;

  beforeEach(function() {
    app = new pillar.Package();
  });

  it("creates a basic module", function() {
    compose(app.define, app)('foo').should.not.throw();
  });

  it("imports a module", function() {
    app.define('foo', function() {
      return 'I am foo';
    });
    app.define('bar', function(foo) {
      foo.should.equal('I am foo');
    }, {loadNow: true});
  });

  it("imports itself and throws an error", function() {
    compose(app.define, app)('foo', function(foo){}, {loadNow: true})
      .should.throw();
  });

  it("defines a main module and runs immediately", function() {
    var ran = false;
    app.define('main', function() {
      ran = true;
    });
    ran.should.be.true;
  });

  it("defines a non-main module and does not run immediately", function() {
    var ran = false;
    app.define('foo');
    ran.should.be.false;
  });

  it("creates a circular dependency and throws an error", function() {
    app.define('foo');
    app.define('bar', function(qux){});
    app.define('qux', function(foo, bar){});
    app.define('main', function() {
      compose(this.needs, this)('qux').should.throw(/Circular/);
    });
  });

  it("imports a module and gets its return value", function() {
    app.define('answer', function() {
      return function(){return 42};
    });
    app.define('main', function(answer) {
      answer().should.equal(42);
    });
  });

  it("calls needs() with a single string and expects a module object", function() {
    app.define('foo', function() {return 'foo'});
    app.define('main', function() {
      this.needs('foo').should.equal('foo');
    });
  });

  it("calls needs() with an array of strings and expects a hash of module objects", function() {
    app.define('foo', function() {return 'foo'});
    app.define('bar', function() {return 'bar'});
    app.define('main', function() {
      this.needs('foo', 'bar').should.eql({foo: 'foo', bar: 'bar'});
      this.needs(['foo', 'bar']).should.eql({foo: 'foo', bar: 'bar'});
    });
  });

  it("creates two packages with the same name and throws an error", function() {
    app.define('foo');
    compose(app.define, app)('foo').should.throw();
  });

  it("loads 3 modules with namespacing", function() {
    app.define('foo/a', function(){return 'foo/a'});
    app.define('foo/b', function(){return 'foo/b'});
    app.define('foo/c', function(){return 'foo/c'});
    app.define('main', function() {
      var deps = this.needs('foo: a b c');
      deps.should.eql({
        'foo/a': deps['foo/a'],
        'foo/b': deps['foo/b'],
        'foo/c': deps['foo/c']
      });
    });
  });

  it("configures all modules to load immediately", function() {
    app.config({loadNow: true});
    var spy = sinon.spy();
    app.define('bar', function(){spy()});
    app.define('foo', function(){spy()});
    spy.calledTwice.should.be.true;
  });

  it("expects a module definition to be called only once", function() {
    var spy = sinon.spy();
    app.define('foo', function(){spy()});
    spy.called.should.be.false;
    app.define('main', function(foo) {
      this.needs('foo');
      this.needs('foo');
    });
    app.define('bar', function(foo){}, {loadNow: true});
    spy.calledOnce.should.be.true;
  });

  it("initializes a package to be global to the module or window namespace.", function() {
    var pkg = new pillar.Package();
    if (typeof module !== 'undefined')
      pkg.global(module);
    else if (typeof window !== 'undefined')
      pkg.global(module);
    (typeof module.define).should.equal('function');
  });

  it("interprets './' to mean the current module name within an import.", function() {
    var spy = sinon.spy();
    app.define('todo/models', function() {return 'models'});
    app.define('todo/views', function() {return 'views'});
    app.define('todo', function() {
      spy();
      this.needs('./models').should.equal('models');
      this.needs('./views').should.equal('views');
      this.needs('./models', './views').should.eql({
        'todo/models' : 'models',
        'todo/views'  : 'views'
      });
    }, {loadNow: true});
    spy.calledOnce.should.be.true;
  });

  it("calls .run and expects undefined to be returned", function() {
    var spy = sinon.spy();
    app.define('util/foo', function() {spy(); return 'foo';})
    app.define('util/bar', function() {spy(); return 'bar';})
    app.define('util', function() {
      (typeof this.run('./foo')).should.equal('undefined');
      (typeof this.run('./bar')).should.equal('undefined');
      (typeof this.run('./foo ./bar')).should.equal('undefined');
      spy();
    }, {loadNow: true});
    spy.calledThrice.should.be.true;
  });

});
