var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cards = require('./cards.json');
var Deck = require('./Deck.js');

/* Constants */
var numberOfCardsInHand = 4;

var clients = {};
var games = {};

app.use(express.static('public'));

app.get('/', function (req, res) {
	res.sendfile('public/index.html');
});

io.on('connection', function (socket) {
	console.log('A user connected.');

	socket.on('login', function (data) {

		if (clients[data.username] !== undefined) {
			// Username is already taken
			console.log('User attempted to log in with name "' + data.username + '", but it was already taken.');
			socket.emit('login-response', { success: false });
			return;
		}

		clients[data.username] = socket;
		socket.username = data.username;
		socket.emit('login-response', { success: true, games: games });

		console.log(data.username + ' logged in successfully.');
	});

	socket.on('refresh-game-list', function (data) {
		if (socket.username === undefined) {
			// User isn't logged in yet
			socket.emit('refresh-game-list-response', {
				success: false
			});
			return;
		}
		socket.emit('refresh-game-list-response', {
			success: true,
			games: games
		});
	});

	socket.on('game-create', function (data) {
		if (games[data.name] !== undefined) {
			// Username is already taken
			console.log('User attempted to create game with name "' + data.name + '", but it was already taken.');
			socket.emit('game-create-response', { success: false });
			return;
		}

		var game = {
			name: data.name,
			players: [ socket.username ],
			started: false,
			host: socket.username,
			password: data.password,			
			nounDeck: new Deck(cards.nounCards),
			verbDeck: new Deck(cards.verbCards),
			situationDeck: new Deck(cards.situationCards),
			deciderIndex: -1,
			currentSituation: null,
			firstRound: true
		};
		games[data.name] = game;
		socket.game = game;

		socket.emit('game-create-response', { success: true });
		console.log(socket.username + ' successfully created a new game named ' + data.name);
	});

	socket.on('join-game', function (data) {
		if (games[data.gameName] === undefined) {
			console.log('User attempted to join non-existent game "' + data.gameName + '".');
			socket.emit('join-game-response', { success: false });
			return;
		}

		var game = games[data.gameName];
		game.players[game.players.length] = socket.username;
		socket.game = game;

		socket.emit('join-game-response', { 
			success: true,
			waiting: !game.started,
			players: game.players,
			host: game.host
		});

		console.log(socket.username + ' successfully joined game "' + data.gameName + '".');

		for (var i = 0, ilen = game.players.length; i < ilen; ++i) {
			var player = game.players[i];
			if (player !== socket.username) {
				clients[player].emit('player-joined-game', { player: socket.username });
			}			
		}
	});

	socket.on('start-game', function (data) {
		var game = games[data.name];
		game.deciderIndex = (game.deciderIndex + 1) % game.players.length;
		game.started = true;
		game.currentSituation = game.situationDeck.deal(1)[0];
		for(var i = 0, ilen = game.players.length; i < ilen; ++i) {
			clients[game.players[i]].emit('game-started', {
				decider: game.players[game.deciderIndex],
				nouns: game.nounDeck.deal(numberOfCardsInHand),
				verbs: game.verbDeck.deal(numberOfCardsInHand),
				situation: game.currentSituation,
				firstRound: game.firstRound
			});
		}
		if (game.firstRound) {
			game.firstRound = false;
		}
		games[data.name] = game;
		console.log('Game ' + game.name + ' has been successfully started.');
	});

	socket.on('submit-play', function (data) {
		var game = socket.game;
		var slots = getSlotsFromCard(game.currentSituation);
		if (slots === null) {
			// Someone is trying to hack us. Drop their connection.
			socket.emit('disconnect');
			delete clients[socket.username];
		}
		// reverse it so we can treat it like a queue instead of a stack,
		// still using the pop method.
		slots.reverse();

		var nounsPlayed = 0;
		var verbsPlayed = 0;
		for (var j = 0, jlen = data.cardsPlayed.length; j < jlen; ++j) {
			var card = data.cardsPlayed[j];
			var slot = slots.pop();
			if (card.type === 'noun') {
				++nounsPlayed;
				if (slot !== 'noun' && slot !== 'bi') {
					// Invalid play
					socket.emit('submit-play-response', {
						success: false
					});
				}
			} else if (card.type === 'verb') {
				++verbsPlayed;
				if (slot !== 'verb' && slot !== 'bi') {
					// Invalid play
					socket.emit('submit-play-response', {
						success: false
					});
				}
			}
			// The card may have been a chainer, so we need
			// to add the extra slots from the card.
			slots = slots.concat(getSlotsFromCard(card).reverse());
		}

		for (var i = 0, ilen = game.players.length; i < ilen; ++i) {
			clients[game.players[i]].emit('play-submitted', {
				cardsPlayed: data.cardsPlayed,
				situation: game.currentSituation,
				player: socket.username
			});
		} 
		socket.emit('submit-play-response', {
			success: true,
			nouns: game.nounDeck.deal(nounsPlayed),
			verbs: game.verbDeck.deal(verbsPlayed)
		});
		console.log(socket.username + ' has successfully subitted a play.');
	});

	socket.on('decide-winner', function (data) {
		var game = games[data.gameName];
		if (game.deciderIndex !== game.players.indexOf(socket.username)) {
			return;
		}

		game.players.forEach(function (item, index) {
			clients[item].emit('winner-found', {
				player: data.player,
				card: data.card
			});
		});
		console.log(data.player + ' has won a round in game ' + data.gameName);
	});

	socket.on('disconnect', function () {
		var username = 'Unknown user';
		if (socket.username !== undefined && clients[socket.username] !== undefined) {
			clients[socket.username] = undefined;
			username = socket.username;
		}

		if (socket.game !== undefined) {
			var game = games[socket.game.name];
			game.players.splice(game.players.indexOf(socket.username), 1);
			if (game.players.length < 1) {
				delete games[game.name];
			}
		}

		console.log(username + ' disconnected.');
	});
})

http.listen(8080, function () {
	console.log('listening on *:8080');
});

function getSlotsFromCard(card) {
	var result = [];
	card.text.split(' ').forEach(function (item, index) {
		switch(item) {
			case '[noun]':
				result.push('noun');
				break;
			case '[verb]':
				result.push('verb');
				break;
			case '[bi]':
				result.push('bi');
				break;
			default:
				// This will only happen if someone is hacking us.
				// Show them no mercy!!!
				return null;
		}
	});
	return result;
}