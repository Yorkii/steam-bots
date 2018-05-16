var fs = require('fs');

process.env.TZ = 'Europe/Warsaw';

if (!fs.existsSync(__dirname + '/config/config.js')) {
    console.error('Config not found!');
    process.exit(1);
}

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ServerManager = require('./models/Manager/Server.js');
var config = require('./config/config.js');

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.enable('trust proxy');

var serverManager = new ServerManager({
    app: app,
    path: __dirname,
    config: config
});

app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;

    next(err);
});

app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.send( err.message );
});

module.exports = app;