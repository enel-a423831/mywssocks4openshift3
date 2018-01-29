/*****************/
/* Connection.js */
/*****************/

var WebSocket = require('ws');

var mywssocks = require('./mywssocks')();

var SocksClient = require('./SocksClient');

/**
 *  Costructor
 */
function Connection(ws)
{
    this.ws = ws;
    this.wss = mywssocks.wss;
    this.debug = mywssocks.cfg.debug;
    this.dump  = mywssocks.cfg.dump ;
    this.connectedAt = mywssocks.CurrentTime();
    var processPacket = this.ws._receiver.processPacket.bind(this.ws._receiver);
/*  this.ws._receiver.processPacket = function(data) {
        mywssocks.Log("##### PACKET lastFragment="+((data[0]&0x80)==0x80)+" masked="+((data[1]&0x80)==0x80)+" compressed="+((data[0]&0x40)==0x40)+" opcode="+(data[0]&0xf));
        processPacket(data);
    }.bind(this); */
    this.ws.on('message', this.OnMessage.bind(this));
    this.ws.on('close'  , this.OnClose  .bind(this));
    this.ws.on('error'  , this.OnError  .bind(this));
    this.ws.on('ping'   , this.OnPing   .bind(this));
    this.ws.on('pong'   , this.OnPong   .bind(this));
    this.inBlocks = this.inBytes = this.outBlocks = this.outBytes = 0;
    this.lastInAt = this.lastOutAt = null;
    this.remoteId = (ws._socket.remoteAddress + ':' + ws._socket.remotePort);
    mywssocks.Log("WebSocket CONNECTED with "+this.remoteId);
    this.socks = new SocksClient(this);
//  this.SchedulePing();
};

/**
 *  ws 'message' event callback
 */
Connection.prototype.OnMessage = function(data)
{
    this.debug&&mywssocks.Debug("WebSocket Connection 'message' event ("+data.length+" bytes)");
    this.Pause();
    var type = 0;
    if (mywssocks.cfg.extended) {
        type = data[0];
        data = data.slice(1);
    }
    if (type == 1) {
        this.OnExtendedPing(data, function() { this.Resume(); }.bind(this));
        return;
    } else if (type == 2) {
        this.OnExtendedPong(data, function() { this.Resume(); }.bind(this));
        return;
    } 
    this.inBlocks++;
    this.inBytes += data.length;
    this.lastInAt = mywssocks.CurrentTime();
    this.wss.totalInBytes += data.length;
    this.dump&&(this.inBlocks<=2)&&mywssocks.Dump("WebSocket Connection IN", data);
    if (this.inBlocks == 1) {
        if (data[0] != 5) { 
            mywssocks.Log("NO VERSION SOCKSv5 from "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        }
    }
    if (this.inBlocks == 2) {
        if ((data.length < 4) || (data[0] != 5) || (data[1] != 1)) {
            mywssocks.Log("NO SOCKSv5 CONNECT from "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        } else if (data[3] == 1) {
            if (data.length == 10) {
                var address = data[4]+'.'+data[5]+'.'+data[6]+'.'+data[7];
                var port    = (data[8]*256+data[9]);
                mywssocks.Log("SOCKSv5 CONNECT to "+address+':'+port+" from "+this.remoteId);
                this.connectAddress = address;
                this.connectPort    = port   ;
            } else
                mywssocks.Log("SOCKSv5 CONNECT to IP V4 address type for "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        } else if (data[3] == 3) {
            if ((data.length > 4) && (data.length == (5+data[4]+2))) {
                var domain = new Buffer(data.slice(5,5+data[4])).toString();
                var port   = (data[5+data[4]]*256+data[5+data[4]+1]);
                mywssocks.Log("SOCKSv5 CONNECT to "+domain+':'+port+" for "+this.remoteId);
                this.connectDomain = domain;
                this.connectPort   = port  ;
            } else
                mywssocks.Log("SOCKSv5 CONNECT to DOMAINNAME address type for "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        } else if (data[3] == 4) {
            mywssocks.Log("SOCKSv5 CONNECT to IP V6 address type from "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        } else {
            mywssocks.Log("SOCKSv5 CONNECT to "+data[3]+" address type from "+this.remoteId+" ("+mywssocks.Stringify(data)+")");
        }
    }
    this.socks&&this.socks.Write(data, function() {
        this.debug&&mywssocks.Debug("Sended "+data.length+" bytes to SOCKS server");
        this.Resume();
    }.bind(this));
};

/**
 *  ws 'close' event callback
 */
Connection.prototype.OnClose = function()
{
    this.debug&&mywssocks.Debug("WebSocket Connection 'close' event");
    mywssocks.Log("WebSocket DISCONNECTED from "+this.remoteId+" ("+this.inBytes+" IN bytes, "+this.outBytes+" OUT bytes)");
    this.ws._socket.destroy();
    this.ws._socket = null;
    this.ws = null;
    if (typeof this.timeoutIdPing !== 'undefined') {
        clearTimeout(this.timeoutIdPing);
        this.timeoutIdPing = undefined;
    }
    this.socks&&this.socks.End();
    this.OnCloseConnection();
};

/**
 *  ws 'error' event callback
 */
Connection.prototype.OnError = function(error)
{
    this.debug&&mywssocks.Debug("WebSocket Connection 'error' event");
    mywssocks.Log("WebSocket from "+this.remoteId+" ERROR: "+((typeof error.code!=='undefined')?error.code+((error.errno&&error.errno!=error.code)?(" ("+error.errno+")"):"")+(error.syscall?(" in "+error.syscall+"()"):""):error));
    this.socks&&this.socks.socket&&this.socks.socket.destroy();
    this.ws.terminate();
};

/**
 *  ws 'ping' event callback
 */
Connection.prototype.OnPing = function(data, flags)
{
    this.dump&&mywssocks.Dump ("WebSocket Client 'ping' event", data);
    mywssocks.Log("WebSocket PING from "+this.remoteId);
//  this.ws.pong(data, flag, true);
};

/**
 *  ws 'pong' event callback
 */
Connection.prototype.OnPong = function(data, flags)
{
    this.dump&&mywssocks.Dump("WebSocket Client 'pong' event", data);
    mywssocks.Log("WebSocket PONG from "+this.remoteId);
};

/**
 *  OnExtendedPing
 */
Connection.prototype.OnExtendedPing = function(data, cb)
{
    this.dump&&mywssocks.Dump("WebSocket Client extended pIng", data);
    mywssocks.Log("WebSocket Client Extended pIng '"+data+"' from "+this.remoteId);
    this.ExtendedPong(data+"/pOngServer", cb);
};

/**
 *  OnExtendedPong
 */
Connection.prototype.OnExtendedPong = function(data, cb)
{
    this.dump&&mywssocks.Dump("WebSocket Client extended pOng", data);
    mywssocks.Log("WebSocket Client Extended pOng '"+data+"' from "+this.remoteId);
    cb();
};

/**
 *  ExtendedPing
 */
Connection.prototype.ExtendedPing = function(data, cb)
{
    if (!data)
        data = '';
    if (mywssocks.cfg.extended) this.ws.send(Buffer.concat([new Buffer([1]), new Buffer(data)]), function(error) {
        this.debug&&!error&&mywssocks.Debug("Sended "+data.length+" bytes to SERVER as Extended pIng");
        if (error) {
            mywssocks.Log("ERROR Sending "+data.length+" bytes to SERVER as Extended pIng");
            this.error = error;
            this.ws.terminate();
        }
        cb&&cb();
    }.bind(this));
};

/**
 *  ExtendedPong
 */
Connection.prototype.ExtendedPong = function(data, cb)
{
    if (!data)
        data = '';
    if (mywssocks.cfg.extended) this.ws.send(Buffer.concat([new Buffer([2]), new Buffer(data)]), function(error) {
        this.debug&&!error&&mywssocks.Debug("Sended "+data.length+" bytes to SERVER as Extended pOng");
        if (error) {
            mywssocks.Log("ERROR Sending "+data.length+" bytes to SERVER as Extended pOng");
            this.error = error;
            this.ws.terminate();
        }
        cb&&cb();
    }.bind(this));
};

/**
 *  OnCloseConnection
 */
Connection.prototype.OnCloseConnection = function()
{
    this.wss.OnCloseConnection(this);
};

/**
 *  pause
 */
Connection.prototype.Pause = function()
{
    if (this.ws.readyState !== WebSocket.OPEN) {
        this.debug&&mywssocks.Debug("WebSocket Connection not paused (already closed)");
    } else {
        this.ws.pause();
        this.debug&&mywssocks.Debug("WebSocket Connection paused");
    }
};

/**
 *  resume
 */
Connection.prototype.Resume = function()
{
    if (this.ws.readyState !== WebSocket.OPEN) {
        this.debug&&mywssocks.Debug("WebSocket Connection not resumed (already closed)");
    } else {
        this.ws.resume();
        this.debug&&mywssocks.Debug("WebSocket Connection resumed");
    }
};

/**
 *  terminate
 */
Connection.prototype.Terminate = function()
{
    this.ws.terminate();
};

/**
 *  close
 */
Connection.prototype.Close = function()
{
    this.ws&&this.ws.close();
};

/**
 *  IsOpen
 */
Connection.prototype.IsOpen = function()
{
    return (this.ws && (this.ws.readyState === WebSocket.OPEN));
};

/**
 *  SchedulePing
 */
Connection.prototype.SchedulePing = function()
{
    if (typeof this.timeoutIdPing !== 'undefined') {
        clearTimeout(this.timeoutIdPing);
        this.timeoutIdPing = undefined;
    }
    if (this.GetPingTimeout()) {
        this.timeoutIdPing = setTimeout(function() {
            if (typeof this.timeoutIdPing === 'undefined')
                throw new Error("UNEXPECTED (typeof this.timeoutIdPing === 'undefined')");
            this.timeoutIdPing = undefined;
            if (this.IsOpen()) {
                mywssocks.Log("WebSocket send PING for "+this.remoteId);
                this.ws.ping('--heartbeat--');
                this.ExtendedPing('pIngServer');
/*              this.ws._sender.messageHandlers.push(function(callback) {
                    this.ws._sender.frameAndSend(0xB, '>>>>>BbBbBbBbBbB<<<<<', true, false);
                    callback();
                }.bind(this));
                this.ws._sender.flush(); */
                this.SchedulePing();
            }
        }.bind(this), this.GetPingTimeout());
    }
};

/**
 *  GetPingTimeout
 */
Connection.prototype.GetPingTimeout = function()
{
    return 10000;
};

/**
 *  StatusAsHtml
 */
Connection.prototype.StatusAsHtml = function(pos)
{
    var status = "<tr><td>Connection "+pos+"</td><td>"+this.ws._socket.remoteAddress+':'+this.ws._socket.remotePort+"</td></tr>"+
                 "<tr><td>&nbsp;&nbsp;Connected at</td><td>"+this.connectedAt+"</td></tr>";
    if (typeof this.connectPort !== 'undefined')
        status += "<tr><td>&nbsp;&nbsp;CONNECT</td><td>"+(this.connectAddress?this.connectAddress:this.connectDomain)+":"+this.connectPort+"</td></tr>";
    status += "<tr><td>&nbsp;&nbsp;IN bytes</td><td>"+this.inBytes+"</td></tr>"+
              "<tr><td>&nbsp;&nbsp;OUT bytes</td><td>"+this.outBytes+"</td></tr>"+
              "<tr><td>&nbsp;&nbsp;Last IN at</td><td>"+this.lastInAt+"</td></tr>"+
              "<tr><td>&nbsp;&nbsp;Last OUT at</td><td>"+this.lastOutAt+"</td></tr>";
    return status;
};

/**
 *  StatusAsObject
 */
Connection.prototype.StatusAsObject = function()
{
    var status = {
        address:        this.ws._socket.remoteAddress,
        port:           this.ws._socket.remotePort,
        connectedAt:    this.connectedAt,
        connectPort:    this.connectPort,
        connectAddress: this.connectAddress,
        connectDomain:  this.connectDomain,
        inBytes:        this.inBytes,
        outBytes:       this.outBytes,
        lastInAt:       this.lastInAt,
        lastOutAt:      this.lastOutAt
    };
    return status;
};

/**
 *  StatusAsText
 */
Connection.prototype.StatusAsText = function()
{
    var status = "        Connection :: "+this.ws._socket.remoteAddress+':'+this.ws._socket.remotePort+"\n"+
                 "      Connected at :::: "+this.connectedAt+"\n";
    if (typeof this.connectPort !== 'undefined')
        status += "           CONNECT :::: "+(this.connectAddress?this.connectAddress:this.connectDomain)+":"+this.connectPort+"\n";
    status += "          IN bytes :::: "+this.inBytes+"\n"+
              "         OUT bytes :::: "+this.outBytes+"\n"+
              "        Last IN at :::: "+this.lastInAt+"\n"+
              "       Last OUT at :::: "+this.lastOutAt+"\n";
    return status;
};

/**
 *  export class
 */
module.exports = Connection;

/***********************/
/* Connection.js : EOF */
/***********************/

