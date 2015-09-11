#  Fail Fast
## Overview
**FailFast** lets developers employ defensive programming techniques in their **Node.js** applications. Since Javascript provides dynamic typing it is often possible to generate errors that are difficult to debug by providing one or more methods with incorrect or missing arguments. **Fail Fast** allows you to test for type/existence of method arguments before they can cause problems deeper down the stack.

Note - this is just one way to develop using Javascript and some developers prefer to shift the responsibility caller rather than enforce type within each method. As with anything it comes down to personal preference.

## Features
 - Assert or test for the type of an argument or variable including:
 	- **Arrays**
 	- **Booleans**
 	- **Buffers**, including optional length
 	- **Defined**, checks for null and undefined
 	- **Dates**
 	- **Errors**
 	- **Functions**
 	- **Instances**
 	- **Numbers**
 	- **Objects**, including optional required parameters
 	- **RegExps**
 	- **Strings**, including optional length
 	- **Variants**, allows for checking one or more of the above

 - Optionally, each test may pass an assert if the value is null or undefined.
 - Provide default values for arguments that is safe to use with ```0``` and ```false```

## Installation

	$ npm install fail-fast

## Examples

Begin by referencing the module:

```javascript
var Assert = require("fail-fast");
```

Once you have reference you can type-check your arguments within functions:

```javascript
function doSomeWork(someArray, someBoolean, someBuffer, someFunction) {
	Assert.array(someArray, true); // May be null or undefined.
	Assert.boolean(someBoolean);
	Assert.buffer(someBuffer, 200); // requires a minimum for 200 bytes
	Assert.method( someFunction );
	Assert.string(someString, /(^\d{5}$)/); // Validate against the regular expression.

    // Safely do some work.
}

function doSomeWork(someClass, someNumber, someObject, someString) {
	Assert.method(someFunction);
	Assert.number(someNumber);
	Assert.object(someObject, "property1", "property2"); // Validates an object and the supplied properties.
	Assert.string(someString, 10) // Validates a string of length 10

    // Safely do some work.

}

function doSomeWork(someDate, someError, someRegExp) {
	Assert.date(someDate);
	Assert.error(someError);
	Assert.regExp(someRegExp);

	// Safely do some work.
}
```
It also works with variants. send it the value and and a list of asserts to use in the validation.
```javascript
function doSomeWork(someVariant) {
	Assert.variant(someVariant, Assert.isArray, Assert.isString);

	// Safely do some work
    if (Assert.isString(someVariant)) {
    	// It's a string
    } else if(Assert.isArray(someVariant)) {
    	// It's an array.
    }
}
```
You can implement variable function arity as well:
```javascript
function doSomeWork(job, settings, callback) {
	Assert.instance(job, Job);
  	if (Assert.isFunction(settings)) {
		callback = settings;
		settings = {};
    }
	Assert.object(settings);
	Assert.method(callback);

  // Safe to do some work
}
```

NOTE - when an argument fails a type-check Validate Arguments throws either a TypeError or a RangeError as appropriate.

Set argument defaults before validation:

```javascript
function doSomeWork(someArray, someBoolean) {
	someArray = Assert.setDefault(someArray, []);
	someBoolean = Assert.setDefault(someArray, false);
    
	Assert.isArray(someArray);
	Assert.isBoolean(someBoolean);
}
```

## License

Copyright (c) 2014 Apple Inc. All rights reserved.