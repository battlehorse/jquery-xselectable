// Config file to create the minified version of the xselectable plugin.
//
// Execute with
// /path/to/node lib/r.js -o app.build.js
({
  baseUrl: '.',
  name: 'lib/almond',
  out: 'xselectable.min.js',
  wrap: true,
  include: ['xselectable'],
  paths: {
  	'jquery': 'lib/jquery-shim'
  }
})