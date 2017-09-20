/**********************/
/* ExplorerRequest.js */
/**********************/

var fs   = require('fs'  );
var util = require('util');

var mywssocks = require('./mywssocks')();

/**
 *  Costructor
 */
function ExplorerRequest(req, res)
{
    this.req = req;
    this.res = res;
    this.path = req.query.path || process.cwd();
    this.html  = "<html>\n";
    this.html += "<head>\n";
    this.html += "  <style>body { text-align: center; background-color: black; color: lime; font-family: Verdana,Geneva,Arial,Helvetica,sans-serif; font-size: 1em; margin: 0.5em; }</style>\n";
    this.html += "  <style>table { margin-left: auto; margin-right: auto; border-spacing: 0.2em 0; width: 1%; }</style>\n";
    this.html += "  <style>th { background-color: green; color: white; font-size: 1em; padding: 0.05em 0.8em; text-align: center; white-space: nowrap; vertical-align: middle; }</style>\n";
    this.html += "  <style>td { padding: 0 0.5em; font-size: 1em; padding: 0.05em 0.8em; text-align: center; white-space: nowrap; vertical-align: middle; }</style>\n";
    this.html += "  <style>a, a:link, a:visited { text-decoration: none; color: white; }</style>\n";
    this.html += "  <style>td.error, span.error { color: red; }</style>\n";
    this.html += "  <style>td.name { text-align: left; }</style>\n";
    this.html += "</head>\n";
    this.html += "<body>\n";
    this.BuildBody();
    this.html += "</body>\n";
    this.html += "</html>\n";
    res.type('html').send(this.html);
};

/**
 *  BuildBody
 */
ExplorerRequest.prototype.BuildBody = function()
{
    var parts = this.path.split("/");
    var path  = "";
//    this.html += this.path+"\n";
    this.html += "<a href='?path=/'>/</a> ";
    for (var i=0; (i < parts.length); i++) {
        if (parts[i] != "") {
            if (path != "")
                this.html += " / ";
            path += "/" + parts[i];
            this.html += "<a href='?path="+path+"'>"+parts[i]+"</a>";
        }
    }
    this.html += "\n<br/>\n";
    var items;
    try {
        items = fs.readdirSync(this.path);
    } catch(e) {
        this.html += "<br/>\n<span class='error'>"+e+"</span>\n<br/>\n";
        return;
    }
    this.html += "  <table>\n";
    this.html += "    <tr>\n";
    this.html += "      <th>Mode</td>\n";
    this.html += "      <th>Owner</td>\n";
    this.html += "      <th>Group</td>\n";
    this.html += "      <th>Size</td>\n";
    this.html += "      <th>Time</td>\n";
    this.html += "      <th>Name</td>\n";
    this.html += "      <th></td>\n";
    this.html += "    </tr>\n";
    var path = this.path;
    if (path != "/")
        path += "/";
    for (var i=0; (i < items.length); i++) {
        mywssocks.Dump("ITEM["+i+"]", items[i]);
        var file = path + items[i];
        mywssocks.Dump("FILE", file);
        var stats;
        try {
            stats = fs.lstatSync(file);
        } catch(e) {
            this.html += "    <tr>\n";
            this.html += "      <td colspan='5' class='error'>"+e+"</td>\n";
            this.html += "      <td class='name'>"+items[i]+"</td>\n";
            this.html += "    </tr>\n";
            continue;
        }
        mywssocks.Dump("STATS", stats, 999999);
        this.html += "    <tr>\n";
        this.html += "      <td>"+this.FormatMode(stats)+"</td>\n";
        this.html += "      <td>"+stats["uid"]+"</td>\n";
        this.html += "      <td>"+stats["gid"]+"</td>\n";
        this.html += "      <td>"+stats["size"]+"</td>\n";
        this.html += "      <td>"+this.FormatDate(stats["mtime"])+"</td>\n";
        if (stats.isDirectory())
            this.html += "      <td class='name'><a href='?path="+file+"'>"+items[i]+"</a>/</td>\n";
        else
            this.html += "      <td class='name'><a href='get?path="+file+"' target='_blank'>"+items[i]+"</a></td>\n";
        this.html += "      <td><a href='view?path="+file+"' target='_blank'>view</a></td>\n";
        this.html += "    </tr>\n";
    }
    this.html += "  </table>\n";
};

/**
 *  FormatMode
 */
ExplorerRequest.prototype.FormatMode = function(stats)
{
    var mode = '';
    if (stats.isDirectory())
        mode += 'd';
    else if (stats.isBlockDevice())
        mode += 'b';
    else if (stats.isCharacterDevice())
        mode += 'c';
    else if (stats.isSymbolicLink())
        mode += 'l';
    else if (stats.isFIFO())
        mode += 'f';
    else if (stats.isSocket())
        mode += 's';
    else
        mode += '-';
    mode += ((stats["mode"] & 0x0100) ?                                   'r'  : '-');
    mode += ((stats["mode"] & 0x0080) ?                                   'w'  : '-');
    mode += ((stats["mode"] & 0x0040) ? ((stats["mode"] & 0x0800) ? 's' : 'x') : '-');
    mode += ((stats["mode"] & 0x0020) ?                                   'r'  : '-');
    mode += ((stats["mode"] & 0x0010) ?                                   'w'  : '-');
    mode += ((stats["mode"] & 0x0008) ? ((stats["mode"] & 0x0400) ? 's' : 'x') : '-');
    mode += ((stats["mode"] & 0x0004) ?                                   'r'  : '-');
    mode += ((stats["mode"] & 0x0002) ?                                   'w'  : '-');
    mode += ((stats["mode"] & 0x0001) ?                                   'x'  : '-');
    return mode/*+" - "+stats["mode"].toString(8)+" - "+stats["mode"].toString(16)+" - "+stats["mode"].toString(2)*/;
};

/**
 *  FormatDate
 */
ExplorerRequest.prototype.FormatDate = function(date)
{
    return this.FormatNumber(date.getFullYear(),4)+'-'+this.FormatNumber(date.getMonth()+1,2)+'-'+this.FormatNumber(date.getDate(),2)+" "
          +this.FormatNumber(date.getHours(),2)+':'+this.FormatNumber(date.getMinutes(),2)+':'+this.FormatNumber(date.getSeconds(),2);
};

/**
 *  FormatNumber
 */
ExplorerRequest.prototype.FormatNumber = function(num, size)
{
    return ("0000000000" + num).slice(-1*size);
};

/**
 *  export class
 */
module.exports = ExplorerRequest;

/****************************/
/* ExplorerRequest.js : EOF */
/****************************/

