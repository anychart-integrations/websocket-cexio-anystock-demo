var express = require('express');
var WebSocket = require('ws');
var CryptoJS = require("crypto-js");
var path = require('path');


//#region WEbSocket init
//these keys are for demonstration purposes
//never show your real keys
//to create your own keys visit the following page - https://cex.io/#/modal/sign-in
var secretKey = "ycZV8pEnDOrp45YNkKkayWYBZQU";
var apiKey = 'ZTU4IIkSzfpzPz2hTler3giTr6U';

//global respond variable
var globalRes;

//create socket
var appWS = {
  socket: null,
  started: false,

  // open socket
  start: function () {
    // create new connection
    if (appWS.socket === null) {
      console.log('start WebSocket');
      appWS.socket = new WebSocket('wss://ws.cex.io/ws/');
      // set messages listenere
      appWS.socket.onmessage = appWS.onmessage;
      appWS.socket.onclose = appWS.onclose;
      // connection is stable
      appWS.socket.onopen = function () {
        appWS.auth();
        appWS.started = true;
      };
    }
  },

  // logging function
  log: function (msg) {
     console.log(msg);
  },

  // send messages
  send: function (data) {
    appWS.log('send: ' + data);
    appWS.socket.send(data);
    // console.log(data);
  },

  // messages listener
  onmessage: function (e) {
    // get answer
    var data = JSON.parse(e.data);
    // log
    appWS.log(e.data);
    // console.log(e.data);

    //ping-pong handler
    if (data.e === 'ping') {
      appWS.pong();
    }

    //auth confirmation
    if (data.e === 'auth' && data.data.ok === 'ok') {
      appWS.started = true;
      appWS.tickerSubscription();
      // appWS.pairRoomSubscription();
      appWS.OHLCVsubscription();
    }

    // process data
    appWS.processData(data);
  },

  onclose: function (event) {
    if (event.wasClean) {
      console.log('Clear close');
    } else {
      console.log('Connection lost');
    }
    console.log('Error: ' + event.code + ' reason: ' + event.reason);
  },

  // process data handler
  processData: function (data) {

    //  BTC/USD current price ticker
    if (data.e === 'tick' && data.data.symbol1 === 'BTC' && data.data.symbol2 === 'USD') {
      sendDataToHost(globalRes, data);
    }

    // data for the last 120 minutes
    if (data.e === 'init-ohlcv-data' && data.pair === 'BTC:USD') {
      sendDataToHost(globalRes, data);
    }

    //  BTC/USD 1 minute changes subscription
    if (data.e === 'ohlcv1m' && data.data.pair === 'BTC:USD') {
      sendDataToHost(globalRes, data);
    }

  },
  auth: function () {
    //get current timestamp
    var timestamp = Math.floor(Date.now() / 1000);
    //create crypto-ket
    var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
    hmac.update(timestamp + apiKey);
    var hash = hmac.finalize();
    var hex = CryptoJS.enc.Hex.stringify(hash);
    //prepare and send auth message
    var args = {
      e: 'auth', auth: {
        key: apiKey,
        signature: hex, timestamp: timestamp
      }
    };
    var authMessage = JSON.stringify(args);
    appWS.send(authMessage);
  },
  pong: function () {
    appWS.send(JSON.stringify({
      e: "pong"
    }));
  },

  //OHLCV charts subscriptions
  OHLCVsubscription: function () {
    appWS.send(JSON.stringify({
      e: "init-ohlcv",
      i: "1m",
      rooms: [
        "pair-BTC-USD"
      ]
    }));
  },

  // Ticker subscription
  tickerSubscription: function () {
    appWS.send(JSON.stringify({
      "e": "subscribe",
      "rooms": [
        "tickers"
      ]
    }));
  }
};

//#endregion


//#region COMET
//creates COMET connection
function openStreamingToHost(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  console.log('open stream');
}

function sendDataToHost(res, data) {
  console.log('send data');
  res.write('data: ' + JSON.stringify(data) + '\n\n');
}

//#endregion


//#region Express init
// Creates server instance
var app = express();
app.use(express.static(path.join(__dirname + '/public')));

//basic get request handler
app.get('/', function (req, res) { //on html request of root directory, run callback function
  res.sendFile(path.join(__dirname, '/public/index.html')); //send html file named "index.html"
});

//handler for get request to connect to CEXio
app.get('/cexIO', function (req, res) {
  globalRes = res;
  openStreamingToHost(req, res);
  if (appWS.started === false) {
    appWS.start();
  } else {
    reconnect();
  }
});


// Runs express server
app.listen(8081, function () {
  console.log('Example app is listening on port ' + 8081 + '!\n');
});

function reconnect() {
  try {
    appWS.socket.close(1000, 'Reconnecting');
    appWS.socket = null;
    appWS.start();
  } catch (e) {
    console.log('Reconnect failed, retrying...');
    reconnect();
  }
}

//#endregion