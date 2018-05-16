var Command = require('../Command.js');
var colors = require('colors');

var BotConnectFunc = function ()
{
    Command.apply(this, arguments);

    this.signature = 'bot-connect';
    this.description = 'Connect a bot to steam servers';
    this.usage = 'bot-connect [login]';
};

require('util').inherits(BotConnectFunc, Command);

BotConnectFunc.prototype.dispatch = function ()
{
    var bot = this.getServerManager().getBotManager().getBotByLogin(this.getArgument(1));

    if (!bot) {
        return this.error('Bot not found');
    }

    bot.login();
};

module.exports = function (ServerManager)
{
    return new BotConnectFunc(ServerManager);
};