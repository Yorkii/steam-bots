var colors              = require('colors');
var EventEmitter        = require('events').EventEmitter;
var TradeStatus         = require('./TradeStatus.js');

module.exports = function(options)
{
    return new TradeModel(options);
};

/**
 * @constructor
 *
 * @param {Object} options
 * @param {ServerManagerFunc} options.serverManager
 * @param {Object} options.offer
 * @param {BotModel} options.bot
 */
var TradeModel = function (options)
{
    this.options = options;
    this.serverManager = options.serverManager;
    this.bot = options.bot;
    this.offer = options.offer;
    this.initEvents();
};

require('util').inherits(TradeModel, EventEmitter);

/**
 * @return {ServerManagerFunc}
 */
TradeModel.prototype.getServerManager = function()
{
    return this.serverManager;
};

/**
 * @return {BotModel}
 */
TradeModel.prototype.getBot = function()
{
    return this.bot;
};

/**
 * @return {LoggerFunc}
 */
TradeModel.prototype.getLogger = function()
{
    return this.bot.getLogger();
};

/**
 * Watch trade and check for its changes
 */
TradeModel.prototype.watch = function()
{
    if (this.isWatched) {
        return;
    }

    this.isWatched = true;

    clearInterval(this.watchInterval);

    this.watchInterval = setInterval(this.refresh.bind(this), 15000);

    if (null === this.descriptions) {
        this.fetch();
    }

    this.getLogger().error('» Trade ' + colors.green(this.getTradeOfferId()) + ' is now watched');
};

/**
 * @return {string}
 */
TradeModel.prototype.getTradeFailReason = function ()
{
    return this.getAttribute('tradeFailReason');
};

/**
 * @param {string} reason
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTradeFailReason = function (reason)
{
    this.setAttribute('tradeFailReason', reason);

    return this;
};

/**
 * Get trade offer from steam and check if it changed
 */
TradeModel.prototype.refresh = function()
{
    if (!this.getBot()) {
        return;
    }

    if (!this.getBot().isOnline() || !this.getBot().isActive()) {
        return;
    }

    if (this.getServerManager().isDebug()) {
        this.getLogger().debug('Refreshing trade ' + this.getTradeOfferId());
    }

    var self = this;

    this.getBot().offers.getOffer({
        tradeofferid: this.getTradeOfferId()
    }, function(err, trade) {
        if (self.isDone) {
            return;
        }

        if (err || !trade || !trade.response || !trade.response.offer) {
            return self.getLogger().error('» Trade ' + colors.green(self.getTradeOfferId()) + ' has failed to refresh');
        }

        if (self.offer && self.offer.trade_offer_state === trade.response.offer.trade_offer_state) {
            if (self.getServerManager().isDebug()) {
                self.getLogger().debug('Trade ' + self.getTradeOfferId() + ' status not changed: ' + trade.response.offer.trade_offer_state);
            }

            return;
        }

        if (self.getServerManager().isDebug()) {
            self.getLogger().debug('Trade ' + self.getTradeOfferId() + ' status is ' + trade.response.offer.trade_offer_state);
        }

        if (null === self.descriptions) {
            return self.getLogger().warning('» Trade ' + colors.green(self.getTradeOfferId()) + ' changed status, but no descriptions yet');
        }

        self.offer = trade.response.offer;
        self.tradeId = trade.response.offer.tradeid;
        self.emit('changed');

        if (self.offer.trade_offer_state === TradeStatus.Accepted) {
            self.stop();
            self.emit('accepted');
        } else if (self.offer.trade_offer_state === TradeStatus.Declined) {
            self.stop();
            self.emit('declined');
        } else if (self.offer.trade_offer_state === TradeStatus.Canceled
            || self.offer.trade_offer_state === TradeStatus.CanceledByMail
        ) {
            self.stop();
            self.emit('canceled');
        } else if (self.offer.trade_offer_state === TradeStatus.Countered
            || self.offer.trade_offer_state === TradeStatus.Expired
            || self.offer.trade_offer_state === TradeStatus.InvalidItems
        ) {
            self.stop();
            self.emit('failed');
        } else if (self.offer.trade_offer_state === TradeStatus.PendingConfirmation) {
            self.emit('pendingConfirmation');
        }
    });
};

/**
 * Guess appId based on items in trade
 *
 * @return {int}
 */
TradeModel.prototype.guessAppId = function ()
{
    var appId = null;

    if (this.getTradeItems()) {
        this.getTradeItems().forEach(function (item) {
            appId = item.appid;
        });
    }

    if (appId !== null) {
        return appId;
    }

    if (!this.offer) {
        return 730;
    }
    if (this.offer.items_to_receive && this.offer.items_to_receive.length > 0) {
        this.offer.items_to_receive.forEach(function (item) {
            appId = item.appid;
        });
    }


    if (this.offer.items_to_give && this.offer.items_to_give.length > 0) {
        this.offer.items_to_give.forEach(function (item) {
            appId = item.appid;
        });
    }

    return appId !== null
        ? appId
        : 730;
};

/**
 * Load inventories descriptions of both parties
 */
TradeModel.prototype.fetch = function ()
{
    var self = this;
    var fetched = 0;

    this.getBot().offers.loadMyInventory({
        appId: self.guessAppId(),
        contextId: 2,
        language: 'en'
    }, function(err, items) {
        self.getLogger().debug('Loaded self inventory');

        self.emit('fetch', {
            isMine: true,
            success: !err,
            error: err,
            items: items
        });
        fetched++;

        if (fetched === 2) {
            self.emit('descriptionsFetched');
        }
    });

    this.getBot().offers.loadPartnerInventory({
        partnerSteamId: self.getTraderSteamId(),
        appId: self.guessAppId(),
        contextId: 2,
        language: 'en'
    }, function(err, items) {
        self.getLogger().debug('Loaded partner inventory');

        self.emit('fetch', {
            isMine: false,
            success: !err,
            error: err,
            items: items
        });
        fetched++;

        if (fetched === 2) {
            self.emit('descriptionsFetched');
        }
    });
};

/**
 * Decline trade
 */
TradeModel.prototype.decline = function ()
{
    if (this.isDone) {
        return;
    }

    var self = this;

    this.getBot().offers.declineOffer({
        tradeOfferId: this.getTradeOfferId()
    }, function(err) {
        if (err) {
            return self.getLogger().error('» Trade ' + colors.green(self.getTradeOfferId()) + ' has failed to decline');
        }
    });
};

/**
 * Cancel trade
 */
TradeModel.prototype.cancel = function ()
{
    if (this.isDone) {
        return;
    }

    var self = this;

    this.getBot().offers.cancelOffer({
        tradeOfferId: this.getTradeOfferId()
    }, function(err) {
        if (err) {
            return self.getLogger().error('» Trade ' + colors.green(self.getTradeOfferId()) + ' has failed to cancel');
        }
    });
};

/**
 * Accept trade
 */
TradeModel.prototype.accept = function ()
{
    if (this.isDone) {
        return;
    }

    var self = this;

    this.getBot().offers.acceptOffer({
        tradeOfferId: this.getTradeOfferId()
    }, function(err) {
        if (err) {
            setTimeout(function () {
                self.accept();
            }, 10000);

            return self.getLogger().error('» Trade ' + colors.green(self.getTradeOfferId()) + ' has failed to accept');
        }

        var offer = self.getOffer();

        if (offer && offer.items_to_give && offer.items_to_give.length > 0) {
            self.getBot().community.checkConfirmations();
        }
    });
};

/**
 * Stop watching trade
 */
TradeModel.prototype.stop = function ()
{
    this.isDone = true;
    this.isWatched = false;
    clearInterval(this.watchInterval);
    this.emit('stop');
};

/**
 * @return {int}
 */
TradeModel.prototype.getTradeId = function ()
{
    if ('undefined' !== typeof(this.attributes.tradeid)) {
        return this.attributes.tradeid;
    }

    return this.tradeId;
};

/**
 * @param {int} tradeRequestId
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTradeRequestId = function (tradeRequestId)
{
    return this.setAttribute('tradeRequestId', tradeRequestId);
};

/**
 * @param items
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTradeItems = function (items)
{
    return this.setAttribute('tradeItems', items);
};

TradeModel.prototype.getTradeItems = function ()
{
    return this.getAttribute('tradeItems');
};

/**
 * @param type
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTradeType = function (type)
{
    return this.setAttribute('tradeType', type);
};

/**
 * @param token
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTradeToken = function (token)
{
    return this.setAttribute('tradeToken', token);
};

/**
 * @param message
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setMessage = function (message)
{
    return this.setAttribute('message', message);
};

/**
 * @param traderSteamId
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setTraderSteamId = function (traderSteamId)
{
    return this.setAttribute('traderSteamId', traderSteamId);
};

/**
 * @param name
 * @param value
 *
 * @return {TradeModel}
 */
TradeModel.prototype.setAttribute = function (name, value)
{
    this.attributes[name] = value;

    return this;
};

/**
 * @return {int}
 */
TradeModel.prototype.getTraderSteamId = function ()
{
    if ('undefined' !== typeof(this.attributes.traderSteamId)) {
        return this.attributes.traderSteamId;
    }

    if ('undefined' !== typeof(this.offer)
        && 'undefined' !== typeof(this.offer.steamid_other)
    ) {
        return this.offer.steamid_other;
    }

    return null;
};

/**
 * @return {int}
 */
TradeModel.prototype.getTradeOfferId = function ()
{
    if ('undefined' !== typeof(this.attributes.tradeofferid)) {
        return this.attributes.tradeofferid;
    }

    return this.offerId;
};

/**
 * @return {int}
 */
TradeModel.prototype.getStatus = function ()
{
    if ('undefined' !== typeof(this.offer)
        && 'undefined' !== typeof(this.offer.trade_offer_state)
    ) {
        return this.offer.trade_offer_state;
    }

    if ('undefined' !== typeof(this.attributes.status)) {
        return this.attributes.status;
    }

    return 0;
};

/**
 * @return {Object}
 */
TradeModel.prototype.getOffer = function ()
{
    if ('undefined' !== typeof(this.offer)) {
        return this.offer;
    }

    if ('undefined' !== typeof(this.attributes.offer)
        && null !== this.attributes.offer
    ) {
        return this.attributes.offer;
    }

    return {};
};

/**
 * @return {Object[]}
 */
TradeModel.prototype.getDescriptions = function ()
{
    if ('undefined' !== typeof(this.descriptions)
        && null !== this.descriptions
    ) {
        return this.descriptions;
    }

    return [];
};

/**
 * @return {Object[]}
 */
TradeModel.prototype.getMineDescriptions = function ()
{
    if ('undefined' !== typeof(this.descriptionsMine)
        && null !== this.descriptionsMine
    ) {
        return this.descriptionsMine;
    }

    return [];
};

/**
 * Check whenever this offer contains item with give class id
 *
 * @param {int} itemClassId
 *
 * @return {boolean}
 */
TradeModel.prototype.containItemClassId = function (itemClassId)
{
    try {
        var contain = false;

        if (this.getOffer().items_to_give) {
            this.getOffer().items_to_give.forEach(function(item) {
                if (item.classid === itemClassId) {
                    contain = true;
                }
            });
        }

        if (this.getOffer().items_to_receive) {
            this.getOffer().items_to_receive.forEach(function(item) {
                if (item.classid === itemClassId) {
                    contain = true;
                }
            });
        }

        return contain;
    } catch (e) {
        return false;
    }
};

/**
 * Check whenever this offer contains item with given asset id
 *
 * @param {int} itemAssetId
 *
 * @return {boolean}
 */
TradeModel.prototype.containItemAssetId = function (itemAssetId)
{
    try {
        var contain = false;

        if (this.getOffer().items_to_give) {
            this.getOffer().items_to_give.forEach(function(item) {
                if (item.assetid === itemAssetId) {
                    contain = true;
                }
            });
        }

        if (this.getOffer().items_to_receive) {
            this.getOffer().items_to_receive.forEach(function(item) {
                if (item.assetid === itemAssetId) {
                    contain = true;
                }
            });
        }

        return contain;
    } catch (e) {
        return false;
    }
};

/**
 * Check whenever this offer contains item with given instance and class id
 *
 * @param {int} instanceId
 * @param {int} classId
 *
 * @return {boolean}
 */
TradeModel.prototype.containItemInstanceIdAndClassId = function (instanceId, classId)
{
    try {
        var contain = false;

        if (this.getOffer().items_to_give) {
            this.getOffer().items_to_give.forEach(function(item) {
                if (item.instanceid === instanceId && item.classid === classId) {
                    contain = true;
                }
            });
        }

        if (this.getOffer().items_to_receive) {
            this.getOffer().items_to_receive.forEach(function(item) {
                if (item.instanceid === instanceId && item.classid === classId) {
                    contain = true;
                }
            });
        }

        return contain;
    } catch (e) {
        return false;
    }
};

/**
 * @param {Object} info
 *
 * @return {Object}
 */
TradeModel.prototype.extractDescription = function (info)
{
    var data = {
        id: info.id,
        classid: info.classid,
        market_hash_name: info.market_hash_name,
        tradeable: info.tradeable,
        type: info.type,
        tags: this.extractDescriptionTags(info.tags)
    };

    return data;
};

/**
 * @param {Object[]} tags
 *
 * @return {Object[]}
 */
TradeModel.prototype.extractDescriptionTags = function (tags)
{
    var t = [];

    if (!tags || tags.length === 0) {
        return t;
    }

    tags.forEach(function(tag) {
        t.push({
            name: tag.name,
            category: tag.category_name
        });
    });

    return t;
};

/**
 * @return {Object[]}
 */
TradeModel.prototype.getDescriptionsForApi = function ()
{
    var desc = this.getDescriptions();
    var descSelf = this.getMineDescriptions();
    var added = [];
    var data = [];
    var self = this;

    try {
        desc.forEach(function(info) {
            var key = info.classid + '_' + info.instanceid;

            if (added.indexOf(key) === -1
                && self.containItemInstanceIdAndClassId(info.instanceid, info.classid)
            ) {
                data.push(self.extractDescription(info));
                added.push(key);
            }
        });

        descSelf.forEach(function(info) {
            var key = info.classid + '_' + info.instanceid;

            if (added.indexOf(key) === -1
                && self.containItemInstanceIdAndClassId(info.instanceid, info.classid)
            ) {
                data.push({
                    id: info.id,
                    classid: info.classid,
                    instanceid: info.instanceid,
                    market_hash_name: info.market_hash_name,
                    tradeable: info.tradeable
                });
                added.push(key);
            }
        });

        return data;
    } catch (e) {
        console.log(e);
        return [];
    }
};

/**
 * @callback getReceiptItemsCallback
 * @param {string} [error]
 */
/**
 * @param {getReceiptItemsCallback} callback
 */
TradeModel.prototype.getReceiptItems = function (callback)
{
    var self = this;

    this.getBot().offers.getItems({
        tradeId: this.getTradeId()
    }, function (err, items) {
        if (err) {
            self.getLogger().error('» Trade ' + self.getTradeOfferId() + ' failed to get receipt items', err);

            return typeof(callback) === 'function'
                ? callback(err)
                : null;
        }

        self.itemsReceipted = items;
        self.save('getReceiptItems');

        return typeof(callback) === 'function'
            ? callback(null)
            : null;
    });
};

/**
 * Fires accepted state on trade
 */
TradeModel.prototype.accepted = function ()
{
    var self = this;

    this.getReceiptItems(function (err) {
        if (err) {
            self.setTradeFailReason(TradeStatus.FailedToFetchReceiptItems);

            return self.getBot().emit('tradeFailed', self);
        }

        self.getBot().emit('tradeAccepted', self);
    });
};

/**
 * Initialize event listeners
 */
TradeModel.prototype.initEvents = function ()
{
    var self = this;

    this.on('changed', function() {
        self.save('tradeChanged');
        self.getLogger().info('» Trade status changed or fetched for the first time without self.offer set!');
    });

    this.on('accepted', function() {
        self.accepted();
    });

    this.on('declined', function() {
        self.getBot().emit('tradeDeclined', self);
    });

    this.on('canceled', function() {
        self.getBot().emit('tradeCanceled', self);
    });

    this.on('failed', function() {
        self.getBot().emit('tradeFailed', self);
    });

    this.on('stop', function() {
        self.save('tradeStopped');
        self.getBot().emit('tradeStop', self);
    });

    this.on('pendingConfirmation', function() {
        self.save('pendingConfirmation');
    });

    this.on('fetch', function(res) {
        if (!res.success) {
            if (res.error.message.indexOf('private')){
                return self.getLogger().error('Could not fetch user items because of private inventory');
            }

            return self.getLogger().error('Could not fetch user items', res.error);
        }

        if (res.isMine) {
            self.descriptionsMine = res.items;
        } else {
            self.descriptions = res.items;
        }

        if (self.descriptions && self.descriptionsMine) {
            self.emit('ready');
        }
    });

    this.on('ready', function() {
        self.save('tradeReady');
        self.getBot().emit('tradeReady', self);
    });
};

/**
 * Updates attributes of trade
 */
TradeModel.prototype.update = function ()
{
    this.attributes.tradeofferid = this.getTradeOfferId();
    this.attributes.tradeid = this.getTradeId();
    this.attributes.steambotid = this.getBot().getSteamId();
    this.attributes.traderSteamId = this.getTraderSteamId();
    this.attributes.ended = this.isDone;
    this.attributes.status = this.getStatus();
    this.attributes.offer = this.getOffer();
    this.attributes.descriptions = this.getDescriptions();
};

/**
 * @return {string|int|Object}
 */
TradeModel.prototype.getAttribute = function (attributeName)
{
    if ('undefined' !== typeof(this.attributes[attributeName])) {
        return this.attributes[attributeName];
    }

    return null;
};

/**
 * @return {Array}
 */
TradeModel.prototype.getAttributes = function ()
{
    return this.attributes;
};

/**
 * Save trade via API
 *
 * @param {string} reason
 */
TradeModel.prototype.save = function (reason)
{
    var self = this;
    var json = this.toJson();

    if (this.getServerManager().deepCompare(this.lastSavedData, json)) {
        return self.getLogger().debug('» Trade ' + self.getTradeOfferId() + ' skip save[' + reason + '], up to date');
    }

    this.lastSavedData = this.toJson();

    this.getServerManager().getWebsiteManager().updateTrade(
        this.getBot().getSteamId(),
        this.lastSavedData,
        function (err) {
            if (err) {
                self.getLogger().error('» Trade ' + self.getTradeOfferId() + ' save[' + reason + '] failed', err);

                return;
            }

            self.getLogger().debug('» Trade ' + self.getTradeOfferId() + ' saved[' + reason + '] via API');
        }
    );
};

/**
 * @callback canSendCallback
 * @param {boolean} botCanSendTrade
 */
/**
 * Determine if bot can send the offer
 *
 * @param {canSendCallback} callback
 */
TradeModel.prototype.canSend = function (callback)
{
    var tradeRequestId = this.getAttribute('tradeRequestId');
    var traderSteamId = this.getAttribute('traderSteamId');
    var tradeToken = this.getAttribute('tradeToken');

    if (!tradeRequestId || !traderSteamId || !tradeToken) {
        return typeof(callback) === 'function'
            ? callback(false)
            : null;
    }

    this.getBot().offers.getHoldDuration({
        partnerSteamId: traderSteamId,
        accessToken: tradeToken
    }, function(err, res){
        var cannotSend = err
            || !res
            || typeof(res.my) === 'undefined'
            || typeof(res.their) === 'undefined'
            || res.my > 0
            || res.their > 0;

        return typeof(callback) === 'function'
            ? callback(!cannotSend)
            : null;
    });
};

/**
 * @return {Object}
 */
TradeModel.prototype.getTradeSendInfo = function ()
{
    var tradeItems = this.getAttribute('tradeItems');
    var tradeType = this.getAttribute('tradeType');

    return {
        partnerSteamId: this.getTraderSteamId(),
        accessToken: this.getAttribute('tradeToken'),
        itemsFromThem: tradeType === 'deposit' ? tradeItems : [],
        itemsFromMe: tradeType === 'withdraw' ? tradeItems : [],
        message: this.getAttribute('message')
    };
};

/**
 *
 * @param {Object} errorObject
 *
 * @return {int}
 */
TradeModel.prototype.tryToGetErrorCode = function (errorObject)
{
    try {
        var regex = /\(([0-9]+)\)/g;
        var code = regex.exec(errorObject.message);

        if (code) {
            return parseInt(code[1]);
        }
    } catch (e) {
        //
    }

    return null;
};

/**
 * @callback sendCallback
 * @param {string} error
 */
/**
 * @param {sendCallback} callback
 *
 * @return {TradeModel}
 */
TradeModel.prototype.send = function (callback)
{
    var self = this;

    this.canSend(function (canSend) {
        if (!canSend) {
            self.notifyTradeRequestFailed();

            return typeof(callback) === 'function'
                ? callback('Cannot send trade')
                : null;
        }

        self.sendOffer();
    });

    return this;
};

/**
 * Send offer to user
 */
TradeModel.prototype.sendOffer = function ()
{
    var self = this;
    this.getLogger().debug('» Bot ' + this.getBot().getLogin() + ' sending offer', self.getTradeSendInfo());

    this.makeOffer(self.getTradeSendInfo(), function(err, result) {
        if (err){
            var errCode = self.tryToGetErrorCode(err);

            if (errCode === 50){
                console.log('» Trade ' + colors.red('failed') + ' you sent more than 5 offers to this user');

                return false;
            }

            if (self.serverManager.isDebug()) {
                console.log(colors.yellow('» [DEBUG]: ') + 'Failed to make offer ', self.getTradeSendInfo(), err, result);
            }

            return self.sendOfferRetry();
        }

        self.tradeofferid = result.tradeofferid;

        var tradeRequestId = self.getAttribute('tradeRequestId');

        if (tradeRequestId) {
            self.getServerManager().getWebsiteManager().tradeRequestResult(tradeRequestId, result);
        }

        if (self.getAttribute('tradeType') === 'withdraw') {
            setTimeout(function () {
                self.getBot().community.checkConfirmations();
            }, 2000);
        }

        self.emit('sent');
    });
};

/**
 * Retry sending offer which failed to send
 *
 * @return {boolean}
 */
TradeModel.prototype.sendOfferRetry = function ()
{
    var self = this;

    if (this.retriesCount >= this.retriesMax){
        console.log('» Trade ' + colors.red('failed') + ' after ' + this.retriesMax + ' retries');

        var tradeRequestId = self.getAttribute('tradeRequestId');

        if (tradeRequestId) {
            self.getServerManager().getWebsiteManager().tradeRequestResult(tradeRequestId, {
                error: 'Trade request failed after 5 retries'
            });
        }

        return false;
    }

    this.retriesCount++;
    this.lastRetryTime = new Date();
    this._makeOfferTimeout = setTimeout( function(){
        self.sendOffer();
    }, 5000);
};

/**
 * Send user notify about request failed
 */
TradeModel.prototype.notifyTradeRequestFailed = function ()
{
    this.getServerManager().getWebsiteManager().getClient().post('/trade/request/' + this.getAttribute('tradeRequestId') + '/fail');
};

/**
 * @return {Object[]}
 */
TradeModel.prototype.getItemsReceiptedForApi = function ()
{
    if (null === this.itemsReceipted) {
        return [];
    }

    var itemsReceipted = [];
    this.itemsReceipted.forEach(function (item) {
        itemsReceipted.push({
            id: item.id,
            classid: item.classid,
            instanceid: item.instanceid
        });
    });

    return itemsReceipted;
};

/**
 * @return {Object}
 */
TradeModel.prototype.toJson = function ()
{
    return {
        attributes: this.getAttributes(),
        botSteamId: this.getBot().getSteamId(),
        traderSteamId: this.getTraderSteamId(),
        tradeOfferId: this.getTradeOfferId(),
        offer: this.getOffer(),
        itemsReceipted: this.getItemsReceiptedForApi(),
        descriptions: this.getDescriptionsForApi()
    };
};