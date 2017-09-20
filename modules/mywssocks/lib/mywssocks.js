/****************/
/* mywssocks.js */
/****************/

var express = require('express');
var http    = require('http');
var socks   = require('socksv5');
try {
var tz      = require('timezone/loaded');
} catch(e) {
var tz      = require('timezone');
}
var fs      = require('fs');

/**
 *  Costructor
 */
function mywssocks(cfg)
{
    if (mywssocks.prototype.singleton)
        throw new Error('mywssocks already instanced')
    mywssocks.prototype.singleton = this;

    this.SetupTerminationHandlers();

    this.cfg = cfg;

    this.startedAt = this.CurrentTime();

    this.app = express();
    this.app.get('/status'  , this.SendStatus.bind(this));
    this.app.get('/explorer', this.Explorer  .bind(this));
    this.app.get('/get'     , this.GetFile   .bind(this));
    this.app.get('/view'    , this.ViewFile  .bind(this));
    this.server = http.createServer(this.app);
    this.wss = require('./WebSocketServer')();
    this.server.listen(cfg.port, cfg.addr, this.OnListening.bind(this));

    this.CreateSocksServer();

    this.ExplorerRequest = require('./ExplorerRequest');
};

/**
 *  Setup termination handlers (for exit and a list of signals).
 */
mywssocks.prototype.SetupTerminationHandlers = function()
{
    //  Process on exit and signals.
    process.on('exit', (function() { this.Terminator(); }).bind(this));
    // Removed 'SIGPIPE' from the list - bugz 852598.
    ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
     'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
    ].forEach((function(element, index, array) {
        process.on(element, (function() { this.Terminator(element); }).bind(this));
    }).bind(this));
};

/**
 *  terminator === the termination handler
 *  Terminate server on receipt of the specified signal.
 *  @param {string} sig  Signal to terminate on.
 */
mywssocks.prototype.Terminator = function(sig)
{
    if (sig) {
       this.Log('Received '+sig+' - terminating mywssocks ...');
       process.exit(1);
    }
    this.Log('mywssocks stopped.');
};

/**
 *  On Listening event
 */
mywssocks.prototype.OnListening = function()
{
    this.Log("Listening on " + (this.cfg.addr ? this.cfg.addr+':' : 'port ') + this.cfg.port);
};

/**
 *  Create socks server
 */
mywssocks.prototype.CreateSocksServer = function()
{
    var _onConnection = socks.Server.prototype._onConnection;
    socks.Server.prototype._onConnection = function(socket) {
        this.cfg.dump&&this.Dump("SOCKS Server 'connection' event", socket);
        this.cfg.dump&&this.Dump("SOCKS Server 'connection' event", socket.address());
        if (socket.remoteAddress == this.socksServerAddr) {
            this.cfg.debug&&this.Debug("SOCKS Server ACCEPT connection from "+socket.remoteAddress+':'+socket.remotePort);
            _onConnection.apply(this.socksServer, arguments);
        } else {
            this.Log("SOCKS Server DENY connection from "+socket.remoteAddress+':'+socket.remotePort);
            socket.end();
        }
    }.bind(this);

    this.socksServer = socks.createServer({ debug: this.cfg.debug ? function(text) {
        this.Debug("SOCKS Server: "+text);
    }.bind(this) : false }, function(info, accept, deny) {
        this.cfg.debug&&this.Debug("SOCKS Server 'connect' request", info);
        if (info.srcAddr == this.socksServerAddr) {
            this.cfg.debug&&this.Debug("SOCKS Server ACCEPT 'connect' request from "+info.srcAddr+':'+info.srcPort);
            accept();
        } else {
            this.Log("SOCKS Server DENY 'connect' request from "+info.srcAddr+':'+info.srcPort);
            deny();
        }
    }.bind(this));

    this.socksServer.listen(0, ((this.cfg.addr && (this.cfg.addr != '0.0.0.0')) ? this.cfg.addr : '127.0.0.1'), function() {
        this.cfg.dump&&this.Dump("SOCKS Server listening", this.socksServer);
        this.cfg.dump&&this.Dump("SOCKS Server listening", this.socksServer.address());
        this.socksServerAddr = this.socksServer.address().address;
        this.socksServerPort = this.socksServer.address().port   ;
        this.Log('SOCKS Server listening on '+this.socksServerAddr+':'+this.socksServerPort);
    }.bind(this));

    this.socksServer.useAuth(socks.auth.None());
};

/**
 *  Send mywssocks status.
 */
mywssocks.prototype.SendStatus = function(req, res)
{
    var memoryUsage = process.memoryUsage();
    if (req.accepts('html')) {
        res.type('html')
           .send("<html><body><table>"+
                 "<tr><td>Status at</td><td>"+this.CurrentTime()+"</td></tr>"+
                 "<tr><td>Started at</td><td>"+this.startedAt+"</td></tr>"+
                 "<tr><td>Memory rss</td><td>"+memoryUsage.rss+"</td></tr>"+
                 "<tr><td>Memory total heap</td><td>"+memoryUsage.heapTotal+"</td></tr>"+
                 "<tr><td>Memory used heap</td><td>"+memoryUsage.heapUsed+"</td></tr>"+
                 this.wss.StatusAsHtml()+
                 "</table></body></html>");
    } else if (req.accepts('json')) {
        var status = this.wss.StatusAsObject();
        status.statusAt    = this.CurrentTime();
        status.startedAt   = this.startedAt;
        status.memoryUsage = memoryUsage;
        res.json(status);
    } else {
        res.type('txt')
           .send("         Status at :: "+this.CurrentTime()+"\n"+
                 "        Started at :: "+this.startedAt+"\n"+
                 "        Memory rss :: "+memoryUsage.rss+"\n"+
                 " Memory total heap :: "+memoryUsage.heapTotal+"\n"+
                 "  Memory used heap :: "+memoryUsage.heapUsed+"\n"+
                 this.wss.StatusAsText()+"\n");
    }
};

/**
 *  Explorer
 */
mywssocks.prototype.Explorer = function(req, res)
{
    new this.ExplorerRequest(req, res);
};

/**
 *  GetFile
 */
mywssocks.prototype.GetFile = function(req, res)
{
    res.download(req.query.path);
};

/**
 *  ViewFile
 */
mywssocks.prototype.ViewFile = function(req, res)
{
/*  if (res.sendFile)
        res.type('txt').sendFile(req.query.path);
    else */
        res.type('txt').send(fs.readFileSync(req.query.path));
};

/**
 *  log
 */
mywssocks.prototype.Log = function(text)
{
    if (this.cfg.logTime) {
        var prefix = this.FormatTime();
        text = (prefix + " : " + text);
        text = text.replace(/\n/g, "\n"+prefix.replace(/./g, " ")+" : ");
    }
    console.log(text);
};

/**
 *  debug
 */
mywssocks.prototype.Debug = function(text)
{
    if (this.cfg.debug)
        this.Log('[DEBUG] '+text);
};

/**
 *  dump
 */
mywssocks.prototype.Dump = function(text, obj, max)
{
    if (this.cfg.dump)
        this.Log('[DUMP] '+text+" : "+this.Stringify(obj, max));
};

/**
 *  Stringify
 */
mywssocks.prototype.Stringify = function(obj, max)
{
    if (typeof obj === 'undefined')
        return 'undefined';
    if (!max)
        max = 100;
    var seen = [];
    var stringified = JSON.stringify(obj, function(_, value) {
        if (typeof value === 'object' && value !== null) {
            if (seen.indexOf(value) !== -1)
                return ">>>DUP<<<";
//          if (this.GetClassName(value) == 'Buffer')
//              return "Buffer(".value.length+")";
            if (this.GetClassName(value) == 'Array') {
                if (value.length > 100) {
                    var missing = (value.length - 100);
                    value = value.slice(1, 102);
                    value[101] = ".... other "+missing+" elements ...";
                }
            }
            seen.push(value);
        }
        return value;
    }.bind(this));
    if (stringified.length > max)
        stringified = stringified.substr(0, max)+"...";
    return stringified;
};

/**
 *  GetClassName
 */
mywssocks.prototype.GetClassName = function(obj)
{
    if (typeof obj != 'object') return "";
    if (typeof (obj).constructor === 'undefined')
        return undefined
    var funcNameRegex = /function (.{1,})\(/;
    var results = (funcNameRegex).exec((obj).constructor.toString());
    return (results && results.length > 1) ? results[1] : "";
};

/**
 *  Get current time.
 */
mywssocks.prototype.CurrentTime = function()
{
    return new Date();
};

/**
 *  Format time.
 */
mywssocks.prototype.FormatTime = function(tm)
{
    if (!tm)
        tm = this.CurrentTime();
    return tz(tm, '%Y-%m-%d %H:%M:%S %Z', 'it_IT', 'Europe/Rome'); 
};

/**
 *  singleton
 */
mywssocks.prototype.singleton = null;

/**
 *  export creator
 */
module.exports = function(cfg) {
    if (mywssocks.prototype.singleton)
        return mywssocks.prototype.singleton;
    else
        return new mywssocks(cfg);
};

/**********************/
/* mywssocks.js : EOF */
/**********************/

