var express                 = require('express');
var colors                  = require('colors');
var CmdManager              = require('./Command.js');
var MarketManager           = require('./Market.js');
var BotManager              = require('./Bot.js');
var Bot                     = require('../Bot.js');
var DatabaseManager         = require('./Database.js');
var ApiManager              = require('./Api.js');
var WebsiteManager          = require('./../Client/Bots.js');
var NotificationManager     = require('./Notification.js');
var Deposit                 = require('../Deposit.js');
var DepositManager          = require('./Deposit.js');
var EventEmitter            = require('events').EventEmitter;
var fs                      = require('fs');
var Long                    = require('long');
var secureRandom            = require('secure-random');
var LoggerClass             = require('../Logger.js');
var Trade                   = require('../Tradev2.js');

module.exports = function (options)
{
    return new ServerManagerFunc(options);
};

var ServerManagerFunc = function (options)
{
    var self = this;

    /** @var {LoggerFunc} */
    this.Logger = new LoggerClass(this);
    this.Logger.on('log', function(log) {
        self.sendLog('server', null, log);
    });
    this.setDebug(true);
    this.listen();    
    this.app = options.app;
    this.options = options;
    this.config = options.config;

    if (this.config.bugsnag && this.config.bugsnag.enable) {
        var bugsnag = require("bugsnag");
        this.bugsnag = bugsnag.register(this.config.bugsnag.key);
    }

    var io = require('socket.io')(this.config.notifications.port);
  
    io.on('connection', function(socket) {
        var allow = false;
        self.getConfig().internal.allow.forEach(function(host) {
            try {
                if (socket.request.connection._peername.address.indexOf(host) > -1) {
                    allow = true;
                }
            } catch(e) {}
        });

        if (!allow) {
            self.Logger.warning('Unauthorized access to notification server from ' + colors.red(socket.request.connection._peername.address));
            return socket.disconnect();
        }

        socket.on('query', function(d) {
            self.query(d,socket);
        });
    });

    this.cmdManager = new CmdManager(this);
    this.cmdManager.initTerminal();
    this.cmdManager.use(options.app);
    
    this.webManager = new WebsiteManager({
        serverManager: this,
        apiEndpoint: this.config.apiEndpoint
    });
    this.webManager.check();

    /** @var BotManagerFunc */
    this.botManager = new BotManager(this);
    this.botManager.setAppPath(options.path);
    this.botManager.setSentryPath(options.path + '/sentry');
    this.botManager.use(options.app);
    
    this.cmdManager.setBotManager(this.botManager);
    
    this.marketManager = new MarketManager(this);
    this.marketManager.use(options.app);
    
    this.notificationManager = new NotificationManager(this);
    this.notificationManager.start();

    this.apiManager = new ApiManager(this);
    this.apiManager.use(options.app);

    this.Logger.log("» " + colors.green("Server is ready to go!"));
    this.Logger.log('» API Port: ' + colors.cyan(this.config.internal.port));
};

require('util').inherits(ServerManagerFunc, EventEmitter);

/**
 * @return {Object}
 */
ServerManagerFunc.prototype.getApp = function ()
{
    return this.app;
};

/**
 * @return {LoggerFunc}
 */
ServerManagerFunc.prototype.getLogger = function ()
{
    return this.Logger;
};

/**
 * @param {string} type
 * @param {int} id
 * @param {string} log
 */
ServerManagerFunc.prototype.sendLog = function (type, id, log)
{
    var webManager = this.getWebsiteManager();

    if (typeof(webManager) === 'undefined') {
        return;
    }

    webManager.saveLog(type, id, log, function (err)
    {
        //
    });
};

/**
 * @return {string}
 */
ServerManagerFunc.prototype.getPath = function ()
{
    return this.options.path;
};

/**
 * @return {Object}
 */
ServerManagerFunc.prototype.getConfig = function ()
{
    return this.config;
};

ServerManagerFunc.prototype.listen = function ()
{
    var self = this;

    this.on('criticalError', function (error) {
        self.getLogger().error("» " + colors.red("Server could not continue executing. Fix critical errors before starting!"));
        self.getLogger().error(error);

        process.exit();
    }); 
};

ServerManagerFunc.prototype.log = function ()
{
    return this.getLogger().log.apply(this.getLogger(), arguments);
};

ServerManagerFunc.prototype.error = function ()
{
    return this.getLogger().error.apply(this.getLogger(), arguments);
};

/**
 * @returns WebsiteClientFunc
 */
ServerManagerFunc.prototype.getWebsiteManager = function ()
{
    return this.webManager;
};

/**
 * @returns DatabaseManagerFunc
 */
ServerManagerFunc.prototype.getDatabaseManager = function ()
{
    return this.dbManager;
};

/**
 * @returns MarketManagerFunc
 */
ServerManagerFunc.prototype.getMarketManager = function ()
{
    return this.marketManager;
};

/**
 * @returns CmdManagerFunc
 */
ServerManagerFunc.prototype.getCmdManager = function ()
{
    return this.cmdManager;
};

/**
 * @returns BotManagerFunc
 */
ServerManagerFunc.prototype.getBotManager = function ()
{
    return this.botManager;
};

/**
 * @returns NotificationManagerFunc
 */
ServerManagerFunc.prototype.getNotificationManager = function ()
{
    return this.notificationManager;
};

ServerManagerFunc.prototype.createTrade = function (req, res, type)
{
    var json = req.body;
    var requiredFields = [
        'botSteamId', 'traderSteamId', 'token', 'message', 'items', 'tradeRequestId'
    ];

    if (!json) {
        return res.json({
            success: false,
            error: 'Invalid request'
        });
    }

    if (!this.bodyHasFields(json, requiredFields)) {
        return res.json({
            success: false,
            error: 'Missing params: ' + this.getBodyMissingFields(json, requiredFields).join(', ')
        });
    }

    if (json.items.length === 0) {
        return res.json({
            success: false,
            error: 'Empty item list provided'
        });
    }

    try {
        var bot = this.botManager.getBotBySteamId(json.botSteamId);

        if (!bot) {
            return res.json({
                success: false,
                error: 'Bot not found'
            });
        }

        if (!bot.isActive()) {
            return res.json({
                success: false,
                error: 'Bot is inactive'
            });
        }

        if (!bot.isOnline()) {
            return res.json({
                success: false,
                error: 'Bot is offline'
            });
        }

        if (bot.isDuringLogOff()) {
            return res.json({
                success: false,
                error: 'Bot is during logOff'
            });
        }

        var trade = new Trade({
            bot: bot,
            serverManager: this
        });

        trade.setTraderSteamId(json.traderSteamId)
            .setTradeRequestId(json.tradeRequestId)
            .setTradeToken(json.token)
            .setTradeItems(json.items)
            .setTradeType(type)
            .setMessage(json.message)
            .send();

        trade.once('sent', function () {
            setTimeout(function () {
                bot.handleIncomingOffers();
            }, 5000);
        });

        return res.json({
            success: true
        });
    } catch(e) {
        return res.json({
            success: false,
            error: e.message,
            stack: e.stack
        });
    }
};

ServerManagerFunc.prototype.depositCreate = function(req, res)
{
    return this.createTrade(req, res, 'deposit');
};

ServerManagerFunc.prototype.withdrawCreate = function(req, res)
{
    return this.createTrade(req, res, 'withdraw');
};

/**
 * @return {boolean}
 */
ServerManagerFunc.prototype.isDebug = function()
{
    return this.debug;
};

/**
 * @param {boolean} debug
 */
ServerManagerFunc.prototype.setDebug = function (debug)
{
    if (debug) {
        console.log("» Debug mode: " + colors.green("ON"));

        this.debug = true;
        this.Logger.setDebug(true);
    } else {
        console.log("» Debug mode: " + colors.yellow("OFF"));

        this.debug = false;
        this.Logger.setDebug(false);
    }
};

ServerManagerFunc.prototype.deepCompare = function ()
{
    var i, l, leftChain, rightChain;

    function compare2Objects (x, y) {
        var p;

        if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
            return true;
        }

        if (x === y) {
            return true;
        }

        if ((typeof x === 'function' && typeof y === 'function') ||
            (x instanceof Date && y instanceof Date) ||
            (x instanceof RegExp && y instanceof RegExp) ||
            (x instanceof String && y instanceof String) ||
            (x instanceof Number && y instanceof Number)) {
            return x.toString() === y.toString();
        }

        if (!(x instanceof Object && y instanceof Object)) {
            return false;
        }

        if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
            return false;
        }

        if (x.constructor !== y.constructor) {
            return false;
        }

        if (x.prototype !== y.prototype) {
            return false;
        }

        if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
            return false;
        }

        for (p in y) {
            if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
                return false;
            }
            else if (typeof y[p] !== typeof x[p]) {
                return false;
            }
        }

        for (p in x) {
            if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
                return false;
            }
            else if (typeof y[p] !== typeof x[p]) {
                return false;
            }

            switch (typeof (x[p])) {
                case 'object':
                case 'function':

                    leftChain.push(x);
                    rightChain.push(y);

                    if (!compare2Objects (x[p], y[p])) {
                        return false;
                    }

                    leftChain.pop();
                    rightChain.pop();
                    break;

                default:
                    if (x[p] !== y[p]) {
                        return false;
                    }
                    break;
            }
        }

        return true;
    }

    if (arguments.length < 1) {
        return true;
    }

    for (i = 1, l = arguments.length; i < l; i++) {
        leftChain = [];
        rightChain = [];

        if (!compare2Objects(arguments[0], arguments[i])) {
            return false;
        }
    }

    return true;
};

/**
 * @param {Object} obj
 * @param {string} path
 * @param defaultValue
 */
ServerManagerFunc.prototype.getValueByPath = function (obj, path, defaultValue)
{
    if (null === obj) {
        return typeof(defaultValue) !== 'undefined'
            ? defaultValue
            : null;
    }

    if ('' === path) {
        return obj;
    }

    var tmp = path.split('.');

    if (typeof(obj[tmp[0]]) === 'undefined') {
        return typeof(defaultValue) !== 'undefined'
            ? defaultValue
            : null;
    }

    return this.getValueByPath(obj[tmp[0]], tmp.slice(1).join('.'), defaultValue);
};