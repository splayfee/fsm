"use strict";

var gulp = require("gulp");

var exec = require("child_process").exec;

var del = require("del");
var eslint = require("gulp-eslint");
var istanbul = require("gulp-istanbul");
var jsonlint = require("gulp-jsonlint");
var mocha = require("gulp-mocha");

var APP_SRC = ["index.js", "./libs/**/*.js"];
var TEMP_SRC = ["./coverage/**/*"];
var TEST_SRC = ["./tests/**/*tests.js"];
var ALL_SRC = [].concat(APP_SRC, TEST_SRC, "./gulpfile.js");

function handleErrorWithExit(err) {
    console.log(err);
    process.exit(1);
}

function handleError(err) {
    console.log(err.toString());
}

var ERROR_HANDLER;

var exitOnError = process.argv.some(function (arg) {
    return (arg === "--exit-on-error");
});

if (exitOnError) {
    ERROR_HANDLER = handleErrorWithExit;
} else {
    ERROR_HANDLER = handleError;
}

gulp.task("default", ["clean", "lint", "coverage"]);

gulp.task("clean", function (done) {
    del(TEMP_SRC, done);
});

gulp.task("coverage", function (callback) {
    gulp.src(APP_SRC)
        .pipe(istanbul())
        .on("finish", function () {
            gulp.src(TEST_SRC)
                .pipe(mocha({
                    reporter: "spec"
                }))
                .pipe(istanbul.writeReports())
                .on("end", callback);
        });
});

gulp.task("docs", function () {
    exec("./node_modules/.bin/jsdoc lib README.md -d docs -p -r", function (err, stdout, stderr) {
        if (err) {
            return console.log(err);
        }
    });
});

gulp.task("lint", function () {
    gulp.src(ALL_SRC)
        .pipe(eslint())
        .pipe(eslint.format("stylish", ERROR_HANDLER));

    gulp.src("./package.json")
        .pipe(jsonlint())
        .pipe(jsonlint.reporter("stylish", ERROR_HANDLER));
});

gulp.task("test", ["clean"], function () {
    gulp.src(TEST_SRC)
        .pipe(mocha({
            reporter: "spec"
        }).on("error", ERROR_HANDLER));
});

gulp.task("watch", function () {
    gulp.watch([APP_SRC, TEST_SRC], ["lint", "test"]);
});