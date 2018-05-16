var colors              = require('colors');
var EventEmitter        = require('events').EventEmitter;
var SteamUser           = require('steam-user');
var SteamCommunity      = require('steamcommunity');
var SteamStore          = require('steamstore');
var SteamTotp           = require('steam-totp');
var SteamTradeOffers    = require('./SteamTradeOffers.js');
var SteamInventory      = require('./SteamInventory.js');
var Logger              = require('./Logger.js');
var getSteamAPIKey      = require('./Steam/WebApiKey.js');
var TradeModel          = require('./Tradev2.js');
var TradeStatus         = require('./TradeStatus.js');
var Request             = require('request');

module.exports = function(options)
{
    return new BotModel(options);
};

/**
 * @constructor
 *
 * @param {Object} options
 * @param {string} options.path Path of application used to store bots data
 * @param {ServerManagerFunc} options.serverManager Instance of ServerManager
 */
var BotModel = function (options)
{
    var self = this;

    this.options = options;

    /** @var {ServerManagerFunc} **/
    this.serverManager = options.serverManager;

    /** @var {LoggerFunc} */
    this.logger = new Logger();
    this.logger.setDebug(options.serverManager.getLogger().isDebug());
    this.logger.on('log', function (log) {
        self.getServerManager().sendLog('bot', self.getSteamId(), log);
    });

    this.initEmitter();
};

require('util').inherits(BotModel, EventEmitter);

/**
 * @return {ServerManagerFunc}
 */
BotModel.prototype.getServerManager = function ()
{
    return this.serverManager;
};

/**
 * @return {BotManagerFunc}
 */
BotModel.prototype.getBotManager = function ()
{
    return this.getServerManager().getBotManager();
};

/**
 * @return {BotsClientFunc}
 */
BotModel.prototype.getWebsiteManager = function ()
{
    return this.getServerManager().getWebsiteManager();
};

/**
 * @return LoggerFunc
 */
BotModel.prototype.getLogger = function ()
{
    return this.logger;
};

/**
 * @return object
 */
BotModel.prototype.getConfig = function ()
{
    return this.getServerManager().getConfig();
};

/**
 * @return {int} Int64 SteamId
 */
BotModel.prototype.getSteamId = function ()
{
    return this.steamId;
};

/**
 * @param {int} steam64Id Steam Id
 *
 * @return {BotModel}
 */
BotModel.prototype.setSteamId = function (steam64Id)
{
    this.steamId = steam64Id;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getSecret = function ()
{
    return this.secret;
};

/**
 * @param {string} secretKey
 *
 * @return {BotModel}
 */
BotModel.prototype.setSecret = function (secretKey)
{
    this.secret = secretKey;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getIdentitySecret = function()
{
    return this.identitySecret;
};

/**
 * @param {string} identitySecretKey
 *
 * @return {BotModel}
 */
BotModel.prototype.setIdentitySecret = function(identitySecretKey)
{
    this.identitySecret = identitySecretKey;

    return this;
};

/**
 * @return {boolean}
 */
BotModel.prototype.getActive = function ()
{
    return this.active;
};

/**
 * @alias getActive
 *
 * @return {boolean}
 */
BotModel.prototype.isActive = function ()
{
    return this.getActive();
};

/**
 * @param {boolean} active
 *
 * @return {BotModel}
 */
BotModel.prototype.setActive = function (active)
{
    this.active = !!active;

    if (!this.active) {
        this.getLogger().warning('» Setting bot ' + colors.cyan(this.getLogin()) + ' to ' + colors.yellow('inactive'));
        this.logged = false;
    }

    return this;
};

/**
 * @return {boolean}
 */
BotModel.prototype.getOnline = function ()
{
    return this.online;
};

/**
 * @return {boolean}
 */
BotModel.prototype.isOnline = function ()
{
    if (!this.online) {
        this.getLogger().warning('» Bot ' + colors.cyan(this.getLogin()) + ' not online, reason is ' + colors.yellow(this.disconnectReason));
    }

    return this.online;
};

/**
 * @return {boolean}
 */
BotModel.prototype.isLogged = function ()
{
    return this.logged;
};

/**
 * @param {boolean} online
 * @param {string} [reason]
 *
 * @return {BotModel}
 */
BotModel.prototype.setOnline = function (online, reason)
{
    this.online = !!online;

    if (typeof(reason) !== 'undefined') {
        this.disconnectReason = reason;
    } else if (!online) {
        this.disconnectReason = '';
    }

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getName = function ()
{
    return this.name;
};

/**
 * @param {string} name
 *
 * @return {BotModel}
 */
BotModel.prototype.setName = function (name)
{
    this.name = name;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getLogin = function ()
{
    return this.loginname;
};

/**
 * @param {String} loginName
 *
 * @return {BotModel}
 */
BotModel.prototype.setLogin = function(loginName)
{
    this.loginname = loginName;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getLoginKey = function()
{
    return this.loginKey;
};

/**
 * @param {string} loginKey
 *
 * @return {BotModel}
 */
BotModel.prototype.setLoginKey = function (loginKey)
{
    this.loginKey = loginKey;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getPassword = function ()
{
    return this.password;
};

/**
 * @param {string} password
 *
 * @return {BotModel}
 */
BotModel.prototype.setPassword = function (password)
{
    this.password = password;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getApiKey = function ()
{
    return this.apiKey;
};

/**
 * @param {string} apiKey
 *
 * @return {BotModel}
 */
BotModel.prototype.setApiKey = function (apiKey)
{
    this.apiKey = apiKey;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getTradeUrl = function ()
{
    return this.tradeUrl;
};

/**
 * @param {string} tradeUrl
 *
 * @return {BotModel}
 */
BotModel.prototype.setTradeUrl = function (tradeUrl)
{
    this.tradeUrl = tradeUrl;

    return this;
};

/**
 * @return {int}
 */
BotModel.prototype.getAppId = function ()
{
    return this.appId;
};

/**
 * @param {int} appId
 *
 * @return {BotModel}
 */
BotModel.prototype.setAppId = function (appId)
{
    this.appId = appId;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getDomain = function ()
{
    return this.getConfig().bot.domain;
};

/**
 * @param {string} proxy
 *
 * @return {BotModel}
 */
BotModel.prototype.setProxy = function (proxy)
{
    this.proxy = proxy;

    return this;
};

/**
 * @return {string}
 */
BotModel.prototype.getProxy = function ()
{
    return this.proxy;
};

BotModel.prototype.logOffModeSafe = 1;
BotModel.prototype.logOffModeCancelTrades = 2;
BotModel.prototype.logOffModeForce = 3;

/**
 * @param {int} logOffMode
 */
BotModel.prototype.logOff = function (logOffMode)
{
    if (this.plannedLogOff) {
        return;
    }

    if (typeof(logOffMode) === 'undefined') {
        logOffMode = this.logOffModeSafe;
    }

    this.plannedLogOff = true;

    if (logOffMode === this.logOffModeForce) {
        this.getLogger().info('» Bot ' + colors.cyan(this.getLogin()) + ' is about to log off');
        this.logOffForce();

        return;
    }

    if (logOffMode === this.logOffModeCancelTrades) {
        this.getLogger().info('» Bot ' + colors.cyan(this.getLogin()) + ' is about to log off after canceling all trades');
        this.logOffCancelingTrades();

        return;
    }

    this.getLogger().info('» Bot ' + colors.cyan(this.getLogin()) + ' is about to log off after all trades are finished');
    this.logOffAfterTrades();
};

/**
 * Clear everything after logOff was successful
 *
 * @private
 */
BotModel.prototype.logOffClear = function ()
{
    this.isLogging = false;
    this.logged = false;
    this.setOnline(false, 'Log off bot');
    this.getLogger().log('» Bot ' + colors.cyan(this.getLogin()) + ' logging off');

    if (this.client) {
        try {
            this.client.logOff();
            this.client.removeAllListeners();
        } catch (e) {
            this.getLogger().error('» Bot ' + colors.cyan(this.getLogin()) + ' got error on logging off. ' + e);
        }
    }

    if (this.offers) {
        try {
            this.offers.removeAllListeners();
        } catch (e) {
            this.getLogger().error('» Bot ' + colors.cyan(this.getLogin()) + ' got error on removing offers listeners. ' + e);
        }
    }

    this.plannedLogOff = false;
    this.emit('loggedOff');
};

/**
 * LogOff bot after all ongoing trades are handled
 *
 * @private
 */
BotModel.prototype.logOffAfterTrades = function ()
{
    var self = this;
    var isOngoing = false;

    this.trades.forEach(function (trade) {
        if (!trade.isDone) {
            isOngoing = true;

            if (!trade.isWatchedByLogOff) {
                trade.isWatchedByLogOff = true;
                trade.on('stop', function () {
                    self.logOffAfterTrades();
                });
            }
        }
    });

    if (!isOngoing) {
        this.logOffClear();
    }
};

/**
 * LogOff bot after canceling all ongoing trades
 *
 * @private
 */
BotModel.prototype.logOffCancelingTrades = function ()
{
    var self = this;
    var isOngoing = false;

    this.trades.forEach(function (trade) {
        if (!trade.isDone) {
            isOngoing = true;

            if (!trade.isWatchedByLogOff) {
                trade.isWatchedByLogOff = true;
                trade.on('stop', function () {
                    self.logOffCancelingTrades();
                });
                trade.cancel();
            }
        }
    });

    if (!isOngoing) {
        this.logOffClear();
    }
};

/**
 * Force logOff bot leaving unhandled trades
 *
 * @private
 */
BotModel.prototype.logOffForce = function ()
{
    this.trades.forEach(function (trade) {
        if (!trade.isDone) {
            trade.stop();
        }
    });

    this.logOffClear();
};

/**
 * @return {boolean}
 */
BotModel.prototype.isDuringLogOff = function ()
{
    return this.plannedLogOff;
};

/**
 * Restart bot
 */
BotModel.prototype.restart = function (logOffMode)
{
    var self = this;

    this.once('loggedOff', function () {
        self.login();
    });

    this.logOff(logOffMode);
};

/**
 * @callback loginCallback
 * @param {object} data
 */

/**
 * Login bot to steam servers
 *
 * @param {loginCallback} callback - The callback that handles the response.
 */
BotModel.prototype.login = function (callback)
{
    if (this.isLogged()) {
        return 'function' === typeof(callback) ? callback() : null;
    }

    if ('function' === typeof(callback)) {
        this.once('logged', callback);
    }

    if (this.isLogging) {
        return;
    }

    this.isLogging = true;

    this.client = new SteamUser();
    this.client.setOptions({
        promptSteamGuardCode: false,
        dataDirectory: this.options.path + '/bots-data'
    });

    this.community = new SteamCommunity();
    this.store = new SteamStore();

    if (this.getProxy()) {
        this.client.client.setHttpProxy('http://' + this.getProxy());
        this.community = new SteamCommunity({
            request: Request.defaults({
                proxy: 'http://' + this.getProxy()
            })
        });
        this.store.request = Request.defaults({
            'jar': this.store._jar,
            'timeout': 50000,
            'gzip': true,
            'proxy': 'http://' + this.getProxy()
        });

        this.getLogger().error('» Bot ' + colors.cyan(this.getLogin()) + ' configured to use proxy');
    }

    this.offers = new SteamTradeOffers();
    this.inventory = null;
    this.trades = [];
    this.webSessionId = null;
    this.webCookies = null;
    this.loginTimeoutFunc = null;

    var logOnOptions = {
        accountName: this.getLogin(),
        rememberPassword: true
    };

    if (this.authCode) {
        logOnOptions['authCode'] = this.authCode;
    }

    if (this.loginKey) {
        logOnOptions.loginKey = this.loginKey;
        this.getLogger().info('» Bot ' + colors.cyan(this.getLogin()) + ' using login key instead of password');
    } else {
        logOnOptions.password = this.getPassword();
    }

    this.client.logOn(logOnOptions);
    this.loginTimeout();
    this.initEvents();

    var self = this;
    clearInterval(this.onlineSaverInterval);
    this.onlineSaverInterval = setInterval(function () {
        if (self.isOnline()) {
            self.getServerManager().getWebsiteManager().setOnline(self.getSteamId());
        }
    }, 15000);
};

BotModel.prototype.loginTimeout = function ()
{
    var self = this;

    this.loginTimeoutFunc = setTimeout(function() {
        self.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' timeout login');
        self.isLogging = false;
        self.logged = false;
        self.login();
    }, this.loginTimeoutSeconds * 1000);
};

/**
 * Initialize events for bot steam objects
 */
BotModel.prototype.initEvents = function ()
{
    var self = this;

    this.offers.on('notLogged', function(){
        clearTimeout(self.loginTimeoutFunc);
        self.getLogger().warning('» Looks like we are not logged in! Trying to login again.');
        self.isLogging = false;
        self.logged = false;
        self.login();
    });

    /* Dont double events after dc and login again */
    this.client.on('loggedOn', function(data){
        if (self.client.steamID.toString()) {
            self.setSteamId(self.client.steamID.toString());
            self.getWebsiteManager().updateSteamId(self.getLogin(), self.getSteamId());
        }

        self.setOnline(true);
        clearTimeout(self.loginTimeoutFunc);

        self.client.getSteamGuardDetails(function(enabled, enabledTime, machineTime, canTrade){
            /**
             * enabledTime must be at least 15 days ago (account-level restriction)
             * machineTime must be at least 7 days ago (sentryfile-level restriction)
             */
            this.steamGuard = enabled;
        });

        self.client.setPersona(SteamUser.Steam.EPersonaState.Online, self.getName());
        self.getLogger().log('» Logged in! Bot ' + colors.cyan(self.getLogin()) + ' with steam ID: ' + colors.green(self.client.steamID.toString()));

        self.emit('logged', data);
    });

    this.client.on('webSession', function(sessionID, cookies) {
        self.webSessionId = sessionID;
        self.webCookies = cookies;
        self.community.setCookies(cookies);
        self.store.setCookies(cookies);

        self.obtainKey(function (err) {
            if (err) {
                self.setActive(false);
                self.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' cannot work correctly without API KEY!');
                return;
            }

            self.obtainTradeUrl(function (err) {
                if (err) {
                    self.setActive(false);
                    self.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' cannot work correctly without Trade URL!');
                    return;
                }

                self.obtainInventory(function (err) {
                    if (err) {
                        self.setActive(false);
                        self.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' cannot work correctly without fetching inventory!');
                        return;
                    }

                    self.community.startConfirmationChecker(10000, self.getIdentitySecret());
                    self.community.on('confirmationAccepted', function (d) {
                        if (d && typeof(d.offerID) !== 'undefined') {
                            self.confirmOffer(d.offerID);
                        }
                    });

                    self.community.on('newConfirmation', function (d) {
                        console.log('newConfirmation', d);
                    });

                    self.community.on('confKeyNeeded', function(tag, c) {
                        self.getLogger().warning('» Bot ' + colors.cyan(self.getLogin()) + ' needs a new confirmation key, ' + colors.yellow("generating.."));
                        var time = Math.floor(Date.now() / 1000);
                        c(null, time, SteamTotp.getConfirmationKey(self.getIdentitySecret(), time, tag));
                    });

                    self.loadTrades();
                    self.listenToTrades();
                    self.emit('ready');
                });
            });
        });

        self.community.profileSettings({
            tradeConfirmation: true,
            inventory: 3 //public
        }, function(){});

        self.store.hasPhone(function(err, hasPhone, dig) {
            if (err) {
                return self.getLogger().error('» Bot ' + self.getLogin() + ' was unable to get phone info', err);
            }
        });
    });


    this.client.on('disconnected', function(result){
        clearTimeout(self.loginTimeoutFunc);

        self.setOnline(false, 'Client disconnected');
        self.getLogger().warning('» Bot ' + colors.cyan(self.getLogin()) + colors.red(" disconnected"));
    });

    var lastAuthCode = null;
    var lastAuthCodeTimeout = null;

    this.client.on('steamGuard', function(mail, callback) {
        if (null === mail){
            var nowTime = (new Date()).getTime() / 1000;

            var generateCode = function (callback) {
                self.generateMobileCode(function(err, code){
                    var lastAuthCode = nowTime;
                    if (err || !code) {
                        self.setOnline(false, 'Could not generate 2FA');

                        return self.getLogger().error('» Error on 2FA authorization', err ? err : 'No code');
                    }

                    self.getLogger().log('» Bot ' + colors.cyan(self.getLogin()) + " authorized 2FA with code " + colors.green(code));

                    return 'function' === typeof(callback) ? callback(code) : null;
                });
            };

            if (lastAuthCode !== null && nowTime - lastAuthCode < 30) {
                var timeout = nowTime - lastAuthCode;

                if (timeout < 0) {
                    timeout = 1;
                }

                clearTimeout(lastAuthCodeTimeout);

                lastAuthCodeTimeout = setTimeout(function () {
                    generateCode(callback);
                }, timeout * 1000);

                self.getLogger().log('» Bot ' + colors.cyan(self.getLogin()) + ' needs to wait ' + Math.floor(timeout) + 's before trying auth again');
            } else {
                generateCode(callback);
            }
        } else {
            self.setOnline(false, 'Steam guard from email');
            self.getLogger().warning('» Steam Guard code needed from email ending in ' + mail);
            self.storeSteamGuardCallback(callback);
            self.getServerManager().getWebsiteManager().getClient().post('/bot/error', {
                type: 'email_guard',
                steam_id: self.getSteamId()
            });
        }
    });

    this.client.on('loginKey', function(key) {
        self.setLoginKey(key);
        self.getServerManager().getWebsiteManager().setLoginKey(self.getSteamId(), key);
    });

    this.client.on('error', function(e) {
        clearTimeout(self.loginTimeoutFunc);

        switch (e.eresult) {
            case SteamUser.EResult.InvalidPassword:
                self.getLogger().error('» Bot ' + colors.red(self.getLogin()) + ' has invalid password or temporary escrow ban');

                if (self.getLoginKey()) {
                    self.setLoginKey(null);

                    return self.restart(self.logOffModeForce);
                }

                break;
            case SteamUser.EResult.LoggedInElsewhere:
                self.getLogger().error('» Bot ' + colors.red(self.getLogin()) + ' has been logged off due to another machine logon');
                break;
            case SteamUser.EResult.RateLimitExceeded:
                self.getLogger().error('» Bot ' + colors.red(self.getLogin()) + ' has tried to many logons');
                break;
            case SteamUser.EResult.LogonSessionReplaced:
                self.getLogger().error('» Bot ' + colors.red(self.getLogin()) + ' has ' + colors.red(LogonSessionReplaced));

                return self.restart(self.logOffModeForce);
            default:
                self.getLogger().error('» Bot ' + colors.red(self.getLogin()) + ' has error [code: ' + e.eresult + '] -> ' + SteamUser.EResult[e.eresult]);
        }

        self.getServerManager().getWebsiteManager().getClient().post('/bot/error', {
            type: 'general',
            steam_id: self.getSteamId(),
            resultCode: e.eresult,
            error: 'Steam error: ' + SteamUser.EResult[e.eresult]
        });

        self.setOnline(false, 'Client error - ' + e.eresult);
    });
};

/**
 * @param {int} offerId
 */
BotModel.prototype.confirmOffer = function (offerId)
{
    var self = this;

    self.getWebsiteManager().confirmOffer(offerId, function (success) {
        if (!success) {
            setTimeout(function () {
                self.confirmOffer(offerId);
            }, 1000);
        }
    });
};

/**
 * Store steam guard callback to later use
 *
 * @param {function} callback
 */
BotModel.prototype.storeSteamGuardCallback = function(callback)
{
    this.steamGuardMailCallback = callback;
};

/**
 * @callback obtainKeyCallback
 *
 * @param {string} error
 */

/**
 * Obtain API Key from Steam.
 *
 * @param {obtainKeyCallback} callback - The callback that handles the response.
 * @param {boolean} force - Whenever force call to steam
 */
BotModel.prototype.obtainKey = function(callback, force, refresh)
{
    if (!force && this.apiKey) {
        var options = {
            sessionID: this.webSessionId,
            webCookie: this.webCookies,
            APIKey: this.apiKey
        };

        if (this.getProxy()) {
            options.request = {
                proxy: 'http://' + this.getProxy()
            }
        }

        this.offers.setup(options, function () {
            return 'function' === typeof(callback) ? callback(null) : null;
        });

        return;
    }

    var self = this;

    if (!self.online) {
        this.getLogger().error('» Tried to obtain key, but bot ' + colors.red(this.getLogin()) + ' is not logged in!');
        return 'function' === typeof(callback) ? callback('Bot is not logged in') : null;
    }

    if (refresh) {
        return getSteamAPIKey({
            domain: this.getDomain(),
            sessionID: self.webSessionId,
            webCookie: self.webCookies,
            forceNew: true
        }, function(err, key) {
            self.apiKey = key;

            self.getWebsiteManager().updateBot(self.getSteamId(), {
                api_key: key
            });

            return 'function' === typeof(callback) ? callback(null) : null;
        });
    }

    self.community.getWebApiKey(self.getDomain(), function(err, APIKey) {
        if (err || !APIKey) {
            /**
             * I M P O R T A N T
             *
             * Account needs to has at least one game to get api key
             */
            self.getLogger().error('» Tried to obtain key, but error occured: ' + colors.red(err ? err.message : 'unknown'));
            self.getServerManager().getWebsiteManager().getClient().post('/bot/error', {
                type: 'api_key',
                steam_id: self.getSteamId(),
                error: err ? err.message : 'APIKey is invalid'
            });

            return 'function' === typeof(callback) ? callback(err ? err : 'APIKey is invalid') : null;
        }

        self.apiKey = APIKey;

        self.getWebsiteManager().updateBot(self.getSteamId(), {
            api_key: APIKey
        });

        self.offers.setup({
            sessionID: self.webSessionId,
            webCookie: self.webCookies,
            APIKey: APIKey
        }, function(){
            return 'function' === typeof(callback) ? callback(null) : null;
        });
    });
};

/**
 * @callback obtainTradeUrlCallback
 *
 * @param {string} error
 */

/**
 * Obtain Trade URL for bot from Steam.
 *
 * @param {obtainTradeUrlCallback} callback - The callback that handles the response.
 * @param {boolean} force - Whenever force call to steam
 */
BotModel.prototype.obtainTradeUrl = function(callback, force)
{
    if (!force && this.tradeUrl) {
        return 'function' === typeof(callback) ? callback(null) : null;
    }

    var self = this;

    if (!self.online) {
        this.getLogger().error('» Tried to obtain trade url, but bot ' + colors.red(this.getLogin()) + ' is not logged in!');
        return 'function' === typeof(callback) ? callback('Bot is not logged in') : null;
    }

    self.offers.getOfferToken(function(err, token, url) {
        if (err || !url) {
            self.getLogger().error('» Tried to obtain trade url, but error occured: ' + colors.red(err ? err : 'Trade url not found in response'));
            return 'function' === typeof(callback) ? callback(err ? err : 'Trade url not found in response') : null;
        }

        self.tradeUrl = url;
        self.getWebsiteManager().updateBot(self.getSteamId(), {
            steam_id: self.getSteamId(),
            trade_url: url
        });

        return 'function' === typeof(callback) ? callback(null) : null;
    });
};

/**
 * @callback obtainInventoryCallback
 *
 * @param {string} error
 */

/**
 * Obtain bot inventory from Steam.
 *
 * @param {obtainInventoryCallback} callback - The callback that handles the response.
 */
BotModel.prototype.obtainInventory = function(callback)
{
    var self = this;

    if (!self.online) {
        this.getLogger().error('» Tried to obtain inventory, but bot ' + colors.red(this.getLogin()) + ' is not logged in!');

        return 'function' === typeof(callback) ? callback('Bot is not logged in') : null;
    }

    if (!self.tradeUrl) {
        this.getLogger().error('» Tried to obtain inventory, but bot ' + colors.red(this.getLogin()) + ' has no trade url set!');

        return 'function' === typeof(callback) ? callback('Bot has no trade url') : null;
    }

    self.loadInventory(function(err) {
        if (err) {
            self.getLogger().error('» Tried to load inventory, but bot ' + colors.red(this.getLogin()) + ' had error: ' + color.red(err));

            return 'function' === typeof(callback) ? callback(err) : null;
        }

        self.emit('inventoryReady');

        return 'function' === typeof(callback) ? callback(null) : null;
    });
};

/**
 * @callback generateMobileCodeCallback
 *
 * @param {string} error
 * @param {string} [code]
 */

/**
 * Get mobile auth code for bot
 *
 * @param {generateMobileCodeCallback} callback - The callback that handles the response.
 */
BotModel.prototype.generateMobileCode = function(callback)
{
    this.getServerManager().getWebsiteManager().getAuthCode(this.getSteamId(), function(err, code) {
        if (err) {
            return 'function' === typeof(callback) ? callback(err) : null;
        }

        return 'function' === typeof(callback) ? callback(null, code) : null;
    });
};

/**
 * @callback loadInventoryCallback
 *
 * @param {string} error
 */

/**
 * Loads inventory from Steam
 *
 * @param {loadInventoryCallback} callback - The callback that handles the response.
 */
BotModel.prototype.loadInventory = function (callback)
{
    var self = this;

    this.inventory = new SteamInventory({
        serverManager: self.getServerManager(),
        bot: self,
        steamId: self.getSteamId(),
        appId: self.getAppId()
    });

    this.inventory.fetchAll(function(err) {
        if (err) {
            return setTimeout(function() {
                self.getLogger().warning('» Retrying to get inventory for bot ' + colors.cyan(self.getLogin()));
                self.loadInventory(callback);
            }, 5000);
        }

        self.getLogger().log('» Bot ' + colors.cyan(self.getLogin()) + ' loaded inventory for appId=' + colors.cyan(self.getAppId()) + ', having ' + colors.green(self.getInventory().getCount()) + ' items');

        return 'function' === typeof(callback) ? callback(null) : null;
    });
};

/**
 * Get json ready object from bot inventory
 *
 * @return {Object[]} inventoryJson
 */
BotModel.prototype.getInventoryJson = function ()
{
    var items = [];

    if (!this.getInventory()) {
        this.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' called to get inventory but no inventory object is set');

        return [];
    }

    this.getInventory().getItems().forEach(function(Item) {
        var data = {
            id: Item._id,
            name: Item.getName(),
            market_hash_name: Item.getMarketName(),
            steam_class_id: Item.getClassId(),
            steam_id: Item.getSteamId(),
            price: Item.getPrice(),
            owner_steam_id: Item.getOwnerSteamId(),
            first_owner_steam_id: Item.getFirstOwnerSteamId()
        };
        items.push(data);
    });

    return items;
};

/**
 * @return {SteamInventory}
 */
BotModel.prototype.getInventory = function ()
{
    return this.inventory;
};

/**
 * Check if bot already handling trade
 *
 * @param {int} tradeOfferId
 *
 * @return {boolean}
 */
BotModel.prototype.isTradeHandled = function (tradeOfferId)
{
    var handled = false;

    this.trades.forEach(function(trade) {
        if (trade.getTradeOfferId() === tradeOfferId) {
            handled = true;
        }
    });

    return handled;
};

/**
 * @param {int} tradeOfferId
 *
 * @return {TradeModel|null}
 */
BotModel.prototype.getTrade = function (tradeOfferId)
{
    var t = null;

    this.trades.forEach(function(trade) {
        if (trade.getTradeOfferId() === tradeOfferId) {
            t = trade;
        }
    });

    return t;
};

/**
 * Casts database variable to string
 *
 * @param {string} name
 *
 * @return {string}
 */
BotModel.prototype.cast = function (name)
{
    return 'cast(' + name + ' as char(255)) as ' + name;
};

/**
 * Load trades from database
 */
BotModel.prototype.loadTrades = function ()
{
    this.declineAllOffers();
    this.secondaryIncomingOffersHandler();
};

/**
 * Decline all incoming offers on Steam
 */
BotModel.prototype.declineAllOffers = function ()
{
    var self = this;
    var ts = Math.round(Date.now() / 1000);

    this.offers.getOffers({
        get_received_offers: 1,
        active_only: 1,
        time_historical_cutoff: ts
    }, function(error, body) {
        if (error) {
            if (403 === error.message) {
                self.getServerManager().getWebsiteManager().api('POST', '/bot/error', {
                    steam_id: self.getSteamId(),
                    type: 'wrong_api_key',
                    error: 'Steam returns 403 when declining offers'
                });
            }

            return self.getLogger().error('» Could not get offers to decline');
        }

        if (body
            && body.response
            && body.response.trade_offers_received
        ) {
            body.response.trade_offers_received.forEach(function(offer) {
                if (offer.trade_offer_state === TradeStatus.Pending
                    || offer.trade_offer_state === TradeStatus.PendingConfirmation
                ) {
                    var trade = new TradeModel({
                        bot: self,
                        offer: offer,
                        serverManager: self.getServerManager()
                    });
                    trade.save();
                    trade.watch();
                    trade.decline();
                    self.trades.push(trade);
                    self.emit('incomingTrade', trade);
                }
            });
        }
    });
};

/**
 * Runs 30s interval checker for trade offers
 */
BotModel.prototype.secondaryIncomingOffersHandler = function ()
{
    var self = this;

    clearInterval(this.secondaryIncomingOffersHandlerInterval);

    this.secondaryIncomingOffersHandlerInterval = setInterval(function() {
        self.handleIncomingOffers();
    }, 30000);
};

/**
 * Bind event listeners for trades
 */
BotModel.prototype.listenToTrades = function ()
{
    var self = this;
    this.client.removeAllListeners('tradeOffers');
    this.client.on('tradeOffers', function(number) {
        self.emit('tradeOffers', number);
    });
};

/**
 * Fetch incoming offers and trigger events on them
 */
BotModel.prototype.handleIncomingOffers = function ()
{
    var self = this;
    var ts = Math.round(Date.now() / 1000);

    if (!this.isActive() || !this.isOnline()) {
        return;
    }

    if (this.isHandlingIncomingOffers + 3 > ts) {
        /* 3s timeout */
        return;
    }

    this.isHandlingIncomingOffers = ts;

    self.getLogger().debug('» Bot ' + colors.cyan(self.getSteamId()) + ' is trying to get incoming offers');

    this.offers.getOffers({
        get_received_offers: 1,
        get_sent_offers: 1,
        time_historical_cutoff: ts
    }, function(error, body) {
        self.isHandlingIncomingOffers = 0;

        if (error) {
            if (403 === error.message) {
                self.getServerManager().getWebsiteManager().api('POST', '/bot/error', {
                    steam_id: self.getSteamId(),
                    type: 'wrong_api_key',
                    error: 'Steam returns 403 when getting offers'
                });
            }

            return self.getLogger().error('» Bot ' + colors.cyan(self.getSteamId()) + ' has failed to get incoming offers');
        }

        self.fetchIncomingOffers(body);
    });
};

/**
 * @param {Object} obj
 * @param {string} path
 * @param defaultValue
 *
 * @return {*}
 */
BotModel.prototype.getValueByPath = function (obj, path, defaultValue)
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

/**
 * @return {TradeModel[]}
 */
BotModel.prototype.getTrades  = function ()
{
    return this.trades;
};

/**
 * @param {Object} offer
 * @param {string} type
 */
BotModel.prototype.pushTrade = function (offer, type)
{
    var trade = new TradeModel({
        bot: this,
        offer: offer,
        serverManager: this.getServerManager()
    });
    trade.save();
    trade.watch();
    this.trades.push(trade);
    this.emit(type, trade);
};

/**
 * @param {Object} offer
 * @param {string} type
 *
 * @return {boolean}
 */
BotModel.prototype.checkAndPushOffer = function (offer, type)
{
    var self = this;

    if (self.isTradeHandled(offer.tradeofferid)) {
        return false;
    }

    if (offer.trade_offer_state === TradeStatus.Pending) {
        self.pushTrade(offer, type);
    }

    if (type !== 'outgoingTrade') {
        return false;
    }

    if (offer.trade_offer_state === TradeStatus.Accepted
        || offer.trade_offer_state === TradeStatus.Declined
    ) {
        self.getWebsiteManager().getTradeBySteamId(offer.tradeofferid, function (err, data, res) {
            var shouldCheckTrade = false;

            if (res.getHttpCode() === 404) {
                shouldCheckTrade = true;
            }

            if (data !== null
                && typeof(data.status) !== 'undefined'
                && data.status !== offer.trade_offer_state
            ) {
                shouldCheckTrade = true;
            }

            if (shouldCheckTrade) {
                self.getLogger().debug('» Bot ' + colors.cyan(self.getSteamId()) + ' fetched incoming offer which should be checked: ' + offer.tradeofferid);
                offer.trade_offer_state = TradeStatus.RecheckTrade;
                self.pushTrade(offer, type);
            }
        });
    }
};

/**
 * @param {Object} body
 */
BotModel.prototype.fetchIncomingOffers = function (body)
{
    var self = this;
    var tradesReceived = this.getValueByPath(body, 'response.trade_offers_received', []);
    var tradesSent =  this.getValueByPath(body, 'response.trade_offers_sent', []);

    tradesReceived.forEach(function(offer) {
        self.checkAndPushOffer(offer, 'incomingTrade');
    });

    tradesSent.forEach(function(offer) {
        self.checkAndPushOffer(offer, 'outgoingTrade');
    });

    self.getLogger().debug('» Bot ' + colors.cyan(self.getSteamId()) + ' fetched incoming offers');
};

/**
 * Initialize event listener
 */
BotModel.prototype.initEmitter = function()
{
    var self = this;
    var lastInventoryReady = null;

    this.on('ready', function() {
        self.getLogger().log('» Bot ' + colors.cyan(self.getLogin()) + ' is ' + colors.green('ready to go!'));
        self.isLogging = false;
        self.logged = true;
    });

    this.on('inventoryReady', function() {
        self.getWebsiteManager().updateBotItems(self.getSteamId(), self.getInventory().toJson());
    });

    this.on('tradeOffers', function(n) {
        if (n > 0) {
            self.handleIncomingOffers();
        }
    });

    this.on('incomingTrade', function(trade) {
        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' got new trade');

        trade.on('ready', function() {
            self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' is determining decision');
            self.getServerManager().getWebsiteManager().getTradeDecision({
                type: 'incoming',
                steamId: self.getSteamId(),
                offer: trade.getOffer(),
                descriptions: trade.getDescriptionsForApi()
            }, function (err, accept) {
                if (err || !accept) {
                    self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' is declining offer due to negative decision');
                    trade.decline();
                } else {
                    self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' is accepting offer due to positive decision');
                    trade.accept();
                }
            });
        });
    });

    this.on('outgoingTrade', function(trade) {
        trade.on('descriptionsFetched', function () {
            trade.save('descriptionsFetched');
        });

        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' sent new trade');
    });

    this.on('loadedTrade', function(trade) {
        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' loaded new trade');
    });

    this.on('tradeDeclined', function(trade) {
        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' declined trade ' + colors.yellow(trade.getTradeOfferId()));
    });

    this.on('tradeAccepted', function(trade) {
        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' accepted trade ' + colors.yellow(trade.getTradeOfferId()));
        self.obtainInventory();

        var bot = self.getBotManager().getBotBySteamId(trade.getTraderSteamId());
        
        if (bot) {
            bot.obtainInventory();
        }
    });

    this.on('tradeCanceled', function(trade) {
        self.getLogger().info('» Bot ' + colors.cyan(self.getLogin()) + ' canceled trade ' + colors.yellow(trade.getTradeOfferId()));
    });

    this.on('tradeFailed', function(trade) {
        self.getLogger().error('» Bot ' + colors.cyan(self.getLogin()) + ' failed trade ' + colors.yellow(trade.getTradeOfferId()) + ' due to ' + trade.getTradeFailReason());
    });
};