/*eslint-disable*/

"use strict";

var chai = require("chai");
var expect = chai.expect;

var Assert = require("../index");


describe("Assert", function () {

  describe("#isArray", function () {
    it("returns true", function () {
      expect(Assert.isArray([])).to.eql(true);
    });
    it("returns true", function () {
      expect(Assert.isArray(new Array())).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isArray("test")).to.eql(false);
    });
  });

  describe("#isBoolean", function () {
    it("returns true", function () {
      expect(Assert.isBoolean(true)).to.eql(true);
    });
    it("returns true", function () {
      expect(Assert.isBoolean(new Boolean(true))).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isBoolean("test")).to.eql(false);
    });
  });

  describe("#isBuffer", function () {
    it("returns true", function () {
      expect(Assert.isBuffer(new Buffer(100))).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isBuffer("test")).to.eql(false);
    });
  });

  describe("#isDate", function () {
    it("returns true", function () {
      expect(Assert.isDate(new Date())).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isDate("test")).to.eql(false);
    });
  });

  describe("#isDefined", function () {
    it("returns true", function () {
      expect(Assert.isDefined({})).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isDefined(null)).to.eql(false);
    });
    it("returns false", function () {
      expect(Assert.isDefined(undefined)).to.eql(false);
    });
  });

  describe("#isError", function () {
    it("returns true", function () {
      expect(Assert.isError(new Error())).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isError("test")).to.eql(false);
    });
  });

  describe("#isFunction", function () {
    it("returns true", function () {
      expect(Assert.isFunction(function(){})).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isFunction("test")).to.eql(false);
    });
  });

  describe("#isInstance", function () {
    var Car = function(make, model) {
      this.make = make;
      this.model = model;
    }
    it("returns true", function () {
      expect(Assert.isInstance(new Car("Mazda", "6"), Car)).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isInstance({make: "Mazda", model: "6"}, Car)).to.eql(false);
    });
  });

  describe("#isNumber", function () {
    it("returns true", function () {
      expect(Assert.isNumber(123)).to.eql(true);
    });
    it("returns true", function () {
      expect(Assert.isNumber(new Number(123))).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isNumber("test")).to.eql(false);
    });
  });

  describe("#isObject", function () {
    it("returns true", function () {
      expect(Assert.isObject({})).to.eql(true);
    });
    it("returns true", function () {
      expect(Assert.isObject(new Object())).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isObject("test")).to.eql(false);
    });
  });

  describe("#isRegExp", function () {
    it("returns true", function () {
      expect(Assert.isRegExp(new RegExp())).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isRegExp("test")).to.eql(false);
    });
  });

  describe("#isString", function () {
    it("returns true", function () {
      expect(Assert.isString("123")).to.eql(true);
    });
    it("returns true", function () {
      expect(Assert.isString(new String("123"))).to.eql(true);
    });
    it("returns false", function () {
      expect(Assert.isString(123)).to.eql(false);
    });
  });

  describe("#array()", function () {
    it("does not throw an error", function () {

      var data = [1, 2, 3];

      expect(function () {
          Assert.array(data);
      }).not.to.throw();

    });

  });

  describe("#array()", function () {
    it("throws an error", function () {

      var data = "testing123";

      expect(function () {
          Assert.array(data);
      }).to.throw();

    });

  });

  describe("#array()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.array(null);
      }).to.throw();

    });

  });

  describe("#array()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.array(null, true);
      }).to.not.throw();

    });

  });

  describe("#boolean()", function () {
      it("does not throw an error", function () {

          var data = new Boolean(true);

          expect(function () {
              Assert.boolean(data);
          }).not.to.throw();

      });

  });

  describe("#boolean()", function () {
    it("does not throw an error", function () {

      var data = true;

      expect(function () {
        Assert.boolean(data);
      }).not.to.throw();

    });

  });

  describe("#boolean()", function () {
    it("does not throw an error", function () {

      var data = false;

      expect(function () {
        Assert.boolean(data);
      }).not.to.throw();

    });

  });

  describe("#boolean()", function () {
    it("throws an error", function () {

      var data = 0;

      expect(function () {
        Assert.array(data);
      }).to.throw();

    });

  });

  describe("#boolean()", function () {
    it("throws an error", function () {

      var data = 1;

      expect(function () {
        Assert.array(data);
      }).to.throw();

    });

  });

  describe("#boolean()", function () {
    it("throws an error", function () {

      var data = "true";

      expect(function () {
        Assert.array(data);
      }).to.throw();

    });

  });

  describe("#boolean()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.boolean(null);
      }).to.throw();

    });

  });

  describe("#boolean()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.boolean(null, true);
      }).to.not.throw();

    });

  });

  describe("#buffer()", function () {
    it("does not throw an error", function () {

      var data = new Buffer(23);
      data.fill(25, 0, 22);

      expect(function () {
        Assert.buffer(data);
      }).not.to.throw();

    });

  });

  describe("#buffer()", function () {
    it("does not throw an error", function () {

      var data = new Buffer(55);
      data.fill(25, 0, 54);

      expect(function () {
        Assert.buffer(data, 55);
      }).not.to.throw();

    });

  });

  describe("#buffer()", function () {
    it("throws an error", function () {

      var data = "testing123";

      expect(function () {
        Assert.buffer(data);
      }).to.throw();

    });

  });

  describe("#buffer()", function () {
    it("throws an error due to size", function () {

      var data = new Buffer(55);
      data.fill(25, 0, 54);

      expect(function () {
        Assert.buffer(data, 100);
      }).to.throw();

    });

  });

  describe("#buffer()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.buffer(null);
      }).to.throw();

    });

  });

  describe("#buffer()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.buffer(null, true);
      }).to.not.throw();

    });

  });

  describe("#date()", function () {
    it("does not throw an error", function () {

      var data = new Date();

      expect(function () {
        Assert.date(data);
      }).not.to.throw();

    });

  });

  describe("#date()", function () {
    it("throws an error", function () {

      var data = "1/2/2014";

      expect(function () {
        Assert.date(data);
      }).to.throw();

    });

  });

  describe("#date()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.date(null);
      }).to.throw();

    });

  });

  describe("#date()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.date(null, true);
      }).to.not.throw();

    });

  });

  describe("#defined()", function () {
    it("does not throw an error", function () {

      var data = "testing123";

      expect(function () {
        Assert.defined(data);
      }).not.to.throw();

    });

  });

  describe("#defined()", function () {
    it("throws an error", function () {

      expect(function () {
        Assert.defined(undefined);
      }).to.throw();

    });

  });

  describe("#defined()", function () {
    it("throws an error", function () {

      var data = null;

      expect(function () {
        Assert.defined(data);
      }).to.throw();

    });

  });

  describe("#error()", function () {
    it("does not throw an error", function () {

      var data = new Error("testing123");

      expect(function () {
        Assert.error(data);
      }).not.to.throw();

    });

  });

  describe("#error()", function () {
    it("throws an error", function () {

      var data = "error:testing123";

      expect(function () {
        Assert.error(data);
      }).to.throw();

    });

  });

  describe("#error()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.error(null);
      }).to.throw();

    });

  });

  describe("#error()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.error(null, true);
      }).to.not.throw();

    });

  });

  describe("#method()", function () {
    it("does not throw an error", function () {

      var data = function () {
      };

      expect(function () {
        Assert.method(data);
      }).not.to.throw();

    });

  });

  describe("#method()", function () {
    it("throws an error", function () {

      var data = "testing123";

      expect(function () {
        Assert.method(data);
      }).to.throw();

    });

  });

  describe("#method()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.method(null);
      }).to.throw();

    });

  });

  describe("#method()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.method(null, true);
      }).to.not.throw();

    });

  });

  describe("#instance()", function () {
    it("does not throw an error", function () {

      var data = new Date();

      expect(function () {
        Assert.instance(data, Date);
      }).not.to.throw();

    });

  });

  describe("#instance()", function () {
    it("throws an error", function () {

      var data = "testing123";

      expect(function () {
        Assert.instance(data, Date);
      }).to.throw();

    });

  });

  describe("#instance()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.instance(null, Date);
      }).to.throw();

    });

  });

  describe("#instance()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.instance(null, Date, true);
      }).to.not.throw();

    });

  });

  describe("#number()", function () {
      it("does not throw an error", function () {

          var data = new Number(123);

          expect(function () {
              Assert.number(data);
          }).not.to.throw();

      });

  });

  describe("#number()", function () {
    it("does not throw an error", function () {

      var data = 123;

      expect(function () {
        Assert.number(data);
      }).not.to.throw();

    });

  });

  describe("#number()", function () {
    it("throws an error", function () {

      var data = "123";

      expect(function () {
        Assert.number(data);
      }).to.throw();

    });

  });

  describe("#number()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.number(null);
      }).to.throw();

    });

  });

  describe("#number()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.number(null, true);
      }).to.not.throw();

    });

  });

  describe("#object()", function () {
      it("does not throw an error", function () {

          var data = new Object();
          data.name = "David";
          data.age = 45;

          expect(function () {
              Assert.object(data);
          }).not.to.throw();

      });

  });

  describe("#object()", function () {
    it("does not throw an error", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data);
      }).not.to.throw();

    });

  });

  describe("#object()", function () {
    it("does not throw an error because properties exist", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data, "name", "age");
      }).not.to.throw();

    });

  });

  describe("#object()", function () {
    it("throws an error", function () {

      var data = "testing123";
      expect(function () {
        Assert.object(data);
      }).to.throw();

    });

  });

  describe("#object()", function () {
    it("throws an error due to missing property", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data, "birthday");
      }).to.throw();

    });

  });

  describe("#object()", function () {
    it("does not throw an error due to missing property", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data, "name", "age");
      }).to.not.throw();

    });

  });

  describe("#object()", function () {
    it("throws an error due to missing property and set to optional", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data, true, "birthday");
      }).to.throw();

    });

  });

  describe("#object()", function () {
    it("does not throw an error due to missing property and set to optional", function () {

      var data = {name: "David", age: 45};

      expect(function () {
        Assert.object(data, true, "name", "age");
      }).to.not.throw();

    });

  });

  describe("#object()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.object(null);
      }).to.throw();

    });

  });

  describe("#object()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.object(null, true);
      }).to.not.throw();

    });

  });

  describe("#object()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.object(null, true);
      }).to.not.throw();

    });

  });

  describe("#regExp()", function () {
    it("does not throw an error", function () {

      var data = new RegExp("/d5");

      expect(function () {
        Assert.regExp(data);
      }).not.to.throw();

    });

  });

  describe("#regExp()", function () {
    it("throws an error", function () {

      var data = "/d5";

      expect(function () {
        Assert.regExp(data);
      }).to.throw();

    });

  });

  describe("#regExp()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.regExp(null);
      }).to.throw();

    });

  });

  describe("#regExp()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.regExp(null, true);
      }).to.not.throw();

    });

  });

  describe("#string()", function () {
    it("does not throw an error", function () {

      var data = "1000";

      expect(function () {
        Assert.string(data);
      }).not.to.throw();

    });

  });

  describe("#string()", function () {
      it("does not throw an error due to string match", function () {

          var data = new String("testing123");

          expect(function () {
              Assert.string(data, "testing123");
          }).not.to.throw();

      });

  });

  describe("#string()", function () {
    it("does not throw an error due to string match", function () {

      var data = "testing123";

      expect(function () {
        Assert.string(data, "testing123");
      }).not.to.throw();

    });

  });

  describe("#string()", function () {
    it("throws an error", function () {

      var data = 1000;

      expect(function () {
        Assert.string(data);
      }).to.throw();

    });

  });

  describe("#string()", function () {
    it("throws an error on null", function () {

      expect(function () {
        Assert.string(null);
      }).to.throw();

    });

  });

  describe("#string()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.string(null, true);
      }).to.not.throw();

    });

  });

  describe("#variant()", function () {
    it("throws an error on incorrect", function () {

      expect(function () {
        Assert.variant("testing123", Assert.string, Assert.array);
      }).to.not.throw();

      expect(function () {
        Assert.variant(["testing123"], Assert.string, Assert.array);
      }).to.not.throw();

      expect(function () {
        Assert.variant(123, Assert.string, Assert.array);
      }).to.throw();

    });

  });

  describe("#variant()", function () {
    it("does not throw an error on null", function () {

      expect(function () {
        Assert.variant(null, true, Assert.string, Assert.array);
      }).to.not.throw();

    });

  });
});
