/**********************/
/* WebSocketServer.js */
/**********************/

var ws = require('ws');

var mywssocks = require('./mywssocks')();

var Connection = require('./Connection');

/**
 *  Costructor
 */
function WebSocketServer()
{
    if (WebSocketServer.prototype.singleton)
        throw new Error('WebSocketServer already instanced')
    WebSocketServer.prototype.singleton = this;

    this.wss = new ws.Server({
        server: mywssocks.server,
        path: "/socks",
        verifyClient: this.VerifyClient.bind(this)
    });

    this.debug = mywssocks.cfg.debug;
    this.connections = [];
    this.maxConnections   = 0;
    this.totalConnections = 0;
    this.lastConnectionAt = null;
    this.totalInBytes     = 0;
    this.totalOutBytes    = 0;

    this.wss.on('connection', this.OnConnection.bind(this));
    this.wss.on('error'     , this.OnError     .bind(this));
};

/**
 *  Verify client
 */
WebSocketServer.prototype.VerifyClient = function(info)
{
//  # ...check data in info and return true or false...
//    this.debug&&mywssocks.Debug("WebSocket Server verify client "+mywssocks.Dump(info));
    return true;
};

/**
 *  wss 'connection' event callback
 */
WebSocketServer.prototype.OnConnection = function(ws)
{
    mywssocks.Debug("WebSocket Server 'connection' event");
    this.totalConnections++;
/*  ws._socket.on('data', function(data) {
        mywssocks.Log("##### RECV "+data.length+" bytes: "+mywssocks.Stringify(data,10));
    }.bind(this)); */
    this.connections[this.connections.length] = new Connection(ws);
    if (this.maxConnections < this.connections.length)
        this.maxConnections = this.connections.length;
    this.lastConnectionAt = mywssocks.CurrentTime();
    mywssocks.Log("WebSocket Server now has "+this.connections.length+" active connections ("+this.totalConnections+" total)");
};

/**
 *  wss 'error' event callback
 */
WebSocketServer.prototype.OnError = function(error)
{
    mywssocks.Log("WebSocket Server ERROR: "+mywssocks.Stringify(error,999999));
};

/**
 *  ws 'close' event
 */
WebSocketServer.prototype.OnCloseConnection = function(connection)
{
    if (!connection.ws && !connection.socks) {
        var ix = this.connections.indexOf(connection);
        if (ix !== -1)
            this.connections.splice(ix);
        mywssocks.Log("WebSocket Server now has "+this.connections.length+" active connections ("+this.totalConnections+" total)");
    }
};

/**
 *  StatusAsHtml
 */
WebSocketServer.prototype.StatusAsHtml = function()
{
    var status = "<tr><td>Max connections</td><td>"+this.maxConnections+"</td></tr>"+
                 "<tr><td>Total connections</td><td>"+this.totalConnections+"</td></tr>"+
                 "<tr><td>Last connection at</td><td>"+this.lastConnectionAt+"</td></tr>"+
                 "<tr><td>Total in bytes</td><td>"+this.totalInBytes+"</td></tr>"+
                 "<tr><td>Total out bytes</td><td>"+this.totalOutBytes+"</td></tr>"+
                 "<tr><td>Active connections</td><td>"+this.connections.length+"</td></tr>";
    this.connections.forEach(function(connection, index, array) {
        status += connection.StatusAsHtml(index+1);
    }.bind(this));
    return status;
};

/**
 *  StatusAsObject
 */
WebSocketServer.prototype.StatusAsObject = function()
{
    var status = {
        maxConnections:    this.maxConnections,
        totalConnections:  this.totalConnections,
        lastConnectionsAt: this.lastConnectionAt,
        totalInBytes:      this.totalInBytes,
        totalOutBytes:     this.totalOutBytes,
        connections:       []
    };
    this.connections.forEach(function(connection, index, array) {
        status.connections[status.connections.length] = connection.StatusAsObject();
    }.bind(this));
    return status;
};

/**
 *  StatusAsText
 */
WebSocketServer.prototype.StatusAsText = function()
{
    var status = "   Max connections :: "+this.maxConnections+"\n"+
                 " Total connections :: "+this.totalConnections+"\n"+
                 "Last connection at :: "+this.lastConnectionAt+"\n"+
                 "    Total in bytes :: "+this.totalInBytes+"\n"+
                 "   Total out bytes :: "+this.totalOutBytes+"\n"+
                 "Active connections :: "+this.connections.length+"\n";
    this.connections.forEach(function(connection, index, array) {
        status += connection.StatusAsText(index+1);
    }.bind(this));
    return status;
};

/**
 *  singleton
 */
WebSocketServer.prototype.singleton = null;

/**
 *  export class
 */
module.exports = function() {
    if (WebSocketServer.prototype.singleton)
        return WebSocketServer.prototype.singleton;
    else
        return new WebSocketServer();
};

/****************************/
/* WebSocketServer.js : EOF */
/****************************/

