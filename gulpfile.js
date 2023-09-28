const gulp = require('gulp');
const del = require('del');
const plugins = require('gulp-load-plugins')();
const rollup = require('rollup-stream');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const hbs = require('rollup-plugin-handlebars-plus');
const through = require('through2');
const sass = require('gulp-sass')(require('sass'));

const args = process.argv.slice(3);

function clean () {
  return del(['build']);
}

gulp.task('clean', clean);

const copy = gulp.parallel(
  () => gulp.src('public/imgs/**/*').pipe(gulp.dest('build/public/imgs/')),
  () => gulp.src('public/avatars/**/*').pipe(gulp.dest('build/public/avatars/')),
  () => gulp.src('server/*.txt').pipe(gulp.dest('build/server/')),
  () => gulp.src('public/*.json').pipe(gulp.dest('build/public/'))
);

gulp.task('copy', copy);

function css() {
  return gulp.src('public/scss/*.scss')
    .pipe(sass.sync().on('error', sass.logError))
    .pipe(plugins.sourcemaps.init())
    .pipe(sass({ outputStyle: 'compressed' }))
    .pipe(plugins.sourcemaps.write('./'))
    .pipe(gulp.dest('build/public/css/'));
}

gulp.task('css', css);

function createJsTask(src, dest) {
  const splitPath = dest.split('/');
  const outputFile = splitPath[splitPath.length - 1];
  const outputDir = splitPath.slice(0, -1).join('/');

  let cache;

  return () => (
    rollup({
      input: src,
      sourcemap: true,
      cache,
      format: 'iife',
      plugins: [
        resolve({
          jsnext: true,
          browser: true
        }),
        commonjs(),
        hbs({
          handlebars: {
            options: {
              // Whether to generate sourcemaps for the templates
              sourceMap: true // Default: true
            }
          }
        })
      ]
    })
      .on('bundle', bundle => {
        cache = bundle;
      })
      // point to the entry file.
      .pipe(source('main.js', './src'))
      // buffer the output. most gulp plugins, including gulp-sourcemaps, don't support streams.
      .pipe(buffer())
      // tell gulp-sourcemaps to load the inline sourcemap produced by rollup-stream.
      .pipe(plugins.sourcemaps.init({ loadMaps: true }))
      .pipe(plugins.rename(outputFile))
      .pipe(plugins.sourcemaps.write('.'))
      .pipe(gulp.dest('build/public/' + outputDir))
  );
}

const jsBrowser = gulp.parallel(
  createJsTask('./public/js/settings/index.js', 'js/settings.js'),
  createJsTask('./public/js/main/index.js', 'js/main.js'),
  createJsTask('./public/js/remote-executor/index.js', 'js/remote-executor.js'),
  createJsTask('./public/js/idb-test/index.js', 'js/idb-test.js'),
  createJsTask('./public/js/sw/index.js', 'sw.js')
);

gulp.task('jsBrowser', jsBrowser);

function jsServer() {
  return gulp.src('server/**/*.js')
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel({
      plugins: ['transform-es2015-modules-commonjs']
    }))
    .on('error', plugins.util.log.bind(plugins.util))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest('build/server'));
}

gulp.task('jsServer', jsServer);

function templatesServer() {
  return gulp.src('templates/*.hbs')
    .pipe(plugins.handlebars())
    .on('error', plugins.util.log.bind(plugins.util))
    .pipe(through.obj((file, enc, callback) => {
      // Don't want the whole lib
      file.defineModuleOptions.require = {Handlebars: 'handlebars/runtime'};
      callback(null, file);
    }))
    .pipe(plugins.defineModule('commonjs'))
    .pipe(plugins.rename((path) => {
      path.extname = '.js';
    }))
    .pipe(gulp.dest('build/server/templates'));
}

gulp.task('templatesServer', templatesServer);


function watch() {
  gulp.watch(['public/scss/**/*.scss'], css);
  gulp.watch(['templates/*.hbs'], gulp.parallel(templatesServer, jsBrowser));
  gulp.watch(['server/**/*.js'], jsServer);
  gulp.watch(['public/imgs/**/*', 'public/avatars/**/*', 'server/*.txt', 'public/*.json'], copy);
  gulp.watch(['public/imgs/**/*', 'public/avatars/**/*', 'server/*.txt', 'public/*.json'], copy);
  gulp.watch(['public/js/**/*.js'], jsBrowser);
}

gulp.task('watch', watch);

function server() {
  plugins.developServer.listen({
    path: './index.js',
    cwd: './build/server',
    args
  });

  gulp.watch([
    'build/server/**/*.js'
  ], plugins.developServer.restart);
}

gulp.task('serve', gulp.series(
  clean,
  gulp.parallel(css, jsBrowser, templatesServer, jsServer, copy),
  gulp.parallel(server, watch)
));
