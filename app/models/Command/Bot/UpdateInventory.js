var Command = require('../Command.js');
var colors = require('colors');

var BotConnectFunc = function ()
{
    Command.apply(this, arguments);

    this.signature = 'bot-update-inventory';
    this.description = 'Updates bot inventory from steam and sends to service';
    this.usage = 'bot-update-inventory [login]';
};

require('util').inherits(BotConnectFunc, Command);

BotConnectFunc.prototype.dispatch = function ()
{
    var bot = this.getServerManager().getBotManager().getBotByLogin(this.getArgument(1));

    if (!bot) {
        return this.error('Bot not found');
    }

    bot.obtainInventory();
};

module.exports = function (ServerManager)
{
    return new BotConnectFunc(ServerManager);
};