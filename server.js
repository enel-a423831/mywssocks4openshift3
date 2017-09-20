#!/bin/env node
/*************/
/* server.js */
/*************/

var mywssocks = require('./modules/mywssocks')({
    addr:    (process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1"),
    port:    (process.env.OPENSHIFT_NODEJS_PORT || 8080),
    logTime:                                              true ,
    debug:   (process.env.OPENSHIFT_NODEJS_PORT ? false : true),
    dump:    (process.env.OPENSHIFT_NODEJS_PORT ? false : true),
    extended:                                             true
});

module.exports = mywssocks.app;

/*******************/
/* server.js : EOF */
/*******************/

