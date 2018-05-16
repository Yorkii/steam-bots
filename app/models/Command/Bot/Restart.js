var Command = require('../Command.js');
var colors = require('colors');

var BotConnectFunc = function ()
{
    Command.apply(this, arguments);

    this.signature = 'bot-restart';
    this.description = 'Restart a bot';
    this.usage = 'bot-restart [login] [mode]';
};

require('util').inherits(BotConnectFunc, Command);

BotConnectFunc.prototype.dispatch = function ()
{
    var bot = this.getServerManager().getBotManager().getBotByLogin(this.getArgument(1));
    var mode = Number(this.getArgument(2));

    if (!bot) {
        return this.error('Bot not found');
    }

    bot.restart(mode);
};

module.exports = function (ServerManager)
{
    return new BotConnectFunc(ServerManager);
};