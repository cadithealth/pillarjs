/*
  Pillar unit tests
*/


var should = require('./chai').should();
var expect = require('./chai').expect;
var pillar = require('../pillar');
var util = pillar.util;
var error = pillar.error;

var compose = function(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function() {
    return fn.apply(null, args);
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
    it("should return the first value of an array", function() {
      first(this.simpleArr).should.equal(1);
    });
    it("should throw an error", function() {
      compose(first, []).should.throw();
      first.should.throw();
    });
  });

  describe("last", function() {
    it("should return the last value of an array", function() {
      last(this.simpleArr).should.equal(4);
    });
    it("should throw an error", function() {
      compose(last, []).should.throw();
      last.should.throw();
    });
  });

  describe("trim", function() {
    it("should remove spaces around a string", function() {
      trim('  hello world   ').should.equal('hello world');
      trim('    ').should.equal('');
      trim('').should.equal('');
    });
  });

  describe("index", function() {
    it("should return the index of a value in an array", function() {
      index(this.simpleArr, 2).should.equal(1);
      index(['a', 'b', 'c', 'd'], 'd').should.equal(3);
      index(this.simpleArr, 'foobar').should.equal(-1);
    });
  });

  describe("has", function() {
    it("should return true if a collection has a value", function() {
      has(this.simpleArr, 3).should.be.true;
      has(this.simpleArr, 42).should.be.false;
    });
  });

  describe("keys", function() {
    it("should return the keys of a dict", function() {
      keys(this.simpleObj).should.eql(['a', 'b', 'c', 'd']);
    });
  });

  describe("values", function() {
    it("should return the values of a dict", function() {
      values(this.simpleObj).should.eql([1, 2, 3, 4]);
    });
  });

  describe("getDuplicates", function() {
    it("should return duplicate values in an array", function() {
      getDuplicates([1, 2, 3, 1, 1, 2]).should.eql([1, 2]);
    });
  });


  describe("getFnName", function() {
    it("should return a function's name", function() {
      getFnName(function foobar(){}).should.equal('foobar');
    });
  });

  describe("getFnParams", function() {
    it("should return the parameter names of a function", function() {
      getFnParams(function(foo, bar,    qux,   baz){})
        .should.eql(['foo', 'bar', 'qux', 'baz']);
    });
  });

  describe("fmt", function() {
    it("should format a string", function() {
      fmt('{foo} there {bar}', {foo: 'hello', bar: 'world'}).should.equal('hello there world');
    });
  });

  // Todo: Split this into separate functions.
  describe("parseNeeds", function() {
    it("should format a list of requirements into a flat array", function() {

      var foobarqux = ['foo', 'bar', 'qux'];
      var foobarheythere = ['foo', 'bar', 'hey', 'there'];
      var foobarheytherenow = ['foo', 'bar', 'hey', 'there', 'now'];
      var foobarheytherenowand = ['foo', 'bar', 'hey', 'there', 'now', 'and'];
      var abcd = ['foo/a', 'foo/b', 'foo/c', 'foo/d'];

      parseNeeds('foo').should.eql(['foo']);

      parseNeeds('foo bar qux').should.eql(foobarqux);
      parseNeeds('foo', 'bar', 'qux').should.eql(foobarqux);
      parseNeeds(['foo', 'bar', 'qux']).should.eql(foobarqux);
      parseNeeds(['foo', 'bar'], 'qux').should.eql(foobarqux);
      parseNeeds(['foo', 'bar'], ['qux']).should.eql(foobarqux);

      parseNeeds(['foo', 'bar'], 'hey there').should.eql(foobarheythere);
      parseNeeds(['foo', 'bar'], 'hey there', 'now').should.eql(foobarheytherenow);
      parseNeeds(['foo', 'bar'], 'hey there', ['now']).should.eql(foobarheytherenow);

      parseNeeds(['foo', 'bar'], 'hey there', ['now', 'and']).should.eql(foobarheytherenowand);

      parseNeeds('foo: a b c d').should.eql(abcd);
      parseNeeds('foo: a b', ['bar: a b c', ['qux: a b']])
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
    compose(bind(app.define, app), 'foo').should.not.throw();
  });

  describe("creating two packages of the same name", function() {
    it("should throw an error", function() {
      (function() {
        app.define('foo');
        app.define('foo');
      }).should.throw();
    });
  });

  it("Imports a module", function() {
    app.define('foo', function() {
      return 'I am foo';
    });
    app.define('bar', function(foo) {
      foo.should.equal('I am foo');
    }, {loadNow: true});
  });

});

// describe("Module", function() {
//   // Todo
// });
