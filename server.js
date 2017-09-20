#!/bin/env node
/*************/
/* server.js */
/*************/

var mywssocks = require('./modules/mywssocks')({
    addr:    (                                        "0.0.0.0"),
//  addr:    (process.env.MYWSSOCKS_SERVICE_HOST || "127.0.0.1"),
    port:    (process.env.MYWSSOCKS_SERVICE_PORT || 8080       ),
    debug:   (process.env.MYWSSOCKS_SERVICE_PORT ? false : true),
    dump:    (process.env.MYWSSOCKS_SERVICE_PORT ? false : true),
    extended:                                              true ,
    logTime:                                               true
});

module.exports = mywssocks.app;

/*******************/
/* server.js : EOF */
/*******************/

