/******************/
/* SocksClient.js */
/******************/

var net = require('net');

var mywssocks = require('./mywssocks')();

/**
 *  Costructor
 */
function SocksClient(connection)
{
    this.connection = connection;
    this.debug = mywssocks.cfg.debug;
    this.dump  = mywssocks.cfg.dump ;
    this.socket = net.connect({ host: mywssocks.socksServerAddr, port: mywssocks.socksServerPort }, function() {
        this.debug&&mywssocks.Debug('SOCKS Client '+this.socket.address().address+':'+this.socket.address().port+' connected to '+this.socket.remoteAddress+':'+this.socket.remotePort);
    }.bind(this));
    this.socket.on('data' , this.OnData .bind(this));
    this.socket.on('close', this.OnClose.bind(this));
    this.socket.on('error', this.OnError.bind(this));
    this.socket.on('end'  , this.OnEnd  .bind(this));
};

/**
 *  socket 'data' event callback
 */
SocksClient.prototype.OnData = function(data)
{
    this.debug&&mywssocks.Debug("SOCKS Client 'data' event, received "+data.length + " bytes from SOCKS Server");
    this.dump &&mywssocks.Dump ("SOCKS Client 'data' event", data);
    this.Pause();
    this.connection.outBlocks++;
    this.connection.outBytes += data.length;
    this.connection.lastOutAt = mywssocks.CurrentTime();
    this.connection.wss.totalOutBytes += data.length;
    this.dump&&(this.connection.outBlocks<=2)&&mywssocks.Dump("WebSocket Connection OUT", data);
    if (this.connection.outBlocks == 1) {
        if ((data[0] != 5) || (data.length != 2)) { 
            mywssocks.Log("BAD RESPONSE to VERSION SOCKSv5 from "+this.connection.remoteId+" ("+mywssocks.Stringify(data)+")");
        }
    }
    if (this.connection.outBlocks == 2) {
        if ((data[0] != 5) || (data[1] != 0)) { 
            mywssocks.Log("BAD RESPONSE to CONNECT SOCKSv5 from "+this.connection.remoteId+" ("+mywssocks.Stringify(data)+")");
        } else if (data[3] == 1) {
            mywssocks.Log("SOCKSv5 CONNECTED via "+data[4]+'.'+data[5]+'.'+data[6]+'.'+data[7]+':'+(data[8]*256+data[9])+" for "+this.connection.remoteId);
        } else {
            mywssocks.Log("SOCKSv5 CONNECTED via "+data[3]+" address type for "+this.connection.remoteId+" ("+mywssocks.Stringify(data)+")");
        }
    }
    if (this.connection.ws) {
        if (mywssocks.cfg.extended)
            data = Buffer.concat([new Buffer([0]), data]);
        this.connection.ws.send(data, function(error) {
            if (error) {
                this.dump&&mywssocks.Dump("WebSocket Connection send error", error);
                this.connection.ws.terminate();
            } else
                this.debug&&mywssocks.Debug("Sended "+data.length+" bytes via WebSocket Connection");
            this.Resume();
        }.bind(this));
    } else {
        this.debug&&mywssocks.Debug("Losted "+data.length+" bytes for CLIENT because closed");
        this.Resume();
    }
};

/**
 *  socket 'close' event callback
 */
SocksClient.prototype.OnClose = function(had_error)
{
    this.debug&&mywssocks.Debug("SOCKS Client 'close' event"+(had_error?" (with ERROR)":""));
    if (had_error)
        this.connection.Terminate();
    else
        this.connection.Close();
    this.socket.destroy();
    this.socket = null;
    this.connection.socks = null;
    this.connection.OnCloseConnection();
};

/**
 *  socket 'error' event callback
 */
SocksClient.prototype.OnError = function(error)
{
    this.debug&&mywssocks.Debug("SOCKS Client 'error' event");
    this.dump &&mywssocks.Dump ("SOCKS Client 'error' event", error);
    mywssocks.Log("SOCKS Client ERROR : "+error.code+((error.errno&&error.errno!=error.code)?(" ("+error.errno+")"):"")+(error.syscall?(" in "+error.syscall+"()"):""));
};

/**
 *  socket 'end' event callback
 */
SocksClient.prototype.OnEnd = function()
{
    this.debug&&mywssocks.Debug("SOCKS Client 'end' event");
    mywssocks.Log("SOCKS Client ENDED !!!!!!!!!!!!!");
    this.connection.Close();
};

/**
 *  pause
 */
SocksClient.prototype.Pause = function()
{
    this.socket.pause();
    this.debug&&mywssocks.Debug("SOCKS Client paused");
};

/**
 *  resume
 */
SocksClient.prototype.Resume = function()
{
    this.socket.resume();
    this.debug&&mywssocks.Debug("SOCKS Client resumed");
};

/**
 *  write
 */
SocksClient.prototype.Write = function(data, callback)
{
    this.socket.write(data, callback);
};

/**
 *  end
 */
SocksClient.prototype.End = function()
{
    this.socket.end();
};

/**
 *  export class
 */
module.exports = SocksClient;

/************************/
/* SocksClient.js : EOF */
/************************/

