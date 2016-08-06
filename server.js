var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sanitizeHtml = require('sanitize-html');
var cards = require('./cards.json');
var Deck = require('./Deck.js');

/* Constants */
var numberOfCardsInHand = 4;

var clients = {};
var games = {};

function validatePlay(situationCard, cardsPlayed, nounDeck, verbDeck) {
	var slots = getSlotsFromCard(situationCard);
	// reverse it so we can treat it like a queue instead of a stack,
	// still using the pop method.
	slots.reverse();

	var nounsPlayed = 0;
	var verbsPlayed = 0;
	for (var j = 0, jlen = cardsPlayed.length; j < jlen; ++j) {
		var card = cardsPlayed[j];
		card.text = sanitizeHtml(card.text);
		if (!card.text) {
			console.log('Card did not sanitize properly')
			return null;
		}

		var slot;
		if (slots.length <= 0) {
			console.log('Too many cards playd.');
			return null;
			
		}

		slot = slots.pop();	

		if (card.type === 'noun') {
			++nounsPlayed;
			if (slot !== 'noun' && slot !== 'bi') {
				if (!slots.find(function(item) { item === 'noun' }) &&
					!slots.find(function(item) { item === 'bi' })) {
					console.log('No more noun slots.');
					return null;
				}
				// skip this slot
				--j;
			}
		} else if (card.type === 'verb') {
			++verbsPlayed;
			if (slot !== 'verb' && slot !== 'bi') {
				if (!slots.find(function(item) { item === 'verb' }) &&
					!slots.find(function(item) { item === 'bi' })) {

					console.log('No more verb slots.')
					return null;
				}
				// skip this slot
				--j;
			}
		}

		// The card may have been a chainer, so we need
		// to add the extra slots from the card.
		slots = slots.concat(getSlotsFromCard(card).reverse());
	}

	var extraCards = [];
	if (slots.length > 0) {
		// The player didn't have enough cards in his hand to finish the
		// play (this can happen sometimes with chainers). So, deal
		// random cards to finish the play.
		for (var i = 0, ilen = slots.length; i < ilen; ++i) {
			var slot = slots.pop();

			var card;
			switch (slot) {
				case 'bi':
					if (Math.random() < 0.5) {
						card = nounDeck.deal(1)[0];
					} else {
						card = verbDeck.deal(1)[0];
					}
					break;
				case 'noun':
					card = nounDeck.deal(1)[0];
					break;
				case 'verb':
					card = verbDeck.deal(1)[0];
					break;
				default:
					break;
			}
			extraCards.push(card);

			var extraSlots = getSlotsFromCard(card);
			// I know, super edge case, but if the random card dealt
			// ends up being a chainer too, we need to deal another
			// random card.
			slots = slots.concat(extraSlots.reverse());
			ilen += extraSlots.length;
		}
	}

	return {
		nounsPlayed: nounsPlayed,
		verbsPlayed: verbsPlayed,
		extraCards: extraCards
	};
}

function getSlotsFromCard(card) {
	var result = [];
	card.text.split(' ').forEach(function (item, index) {
		
		if (/\[noun\]/g.test(item)) {
			result.push('noun');
		} else if (/\[verb\]/g.test(item)) {
			result.push('verb');
		} else if (/\[bi\]/g.test(item)) {
			result.push('bi');
		}
		
	});
	return result;
}

app.use(express.static('public'));

app.get('/', function (req, res) {
	res.sendfile('public/index.html');
});

io.on('connection', function (socket) {
	console.log('A user connected.');

	socket.on('login', function (data) {

		var username = sanitizeHtml(data.username, {
			allowedTags: [],
			allowedAttributes: []
		});

		if (!username) {
			console.log('User attempted to log in, but the username provided was invalid.');
			socket.emit('login-response', { success: false });
			return;
		}

		if (clients[username] !== undefined) {
			// Username is already taken
			console.log('User attempted to log in with name "' + username + '", but it was already taken.');
			socket.emit('login-response', { success: false });
			return;
		}

		clients[username] = socket;
		socket.username = username;
		socket.emit('login-response', { success: true, games: games });

		console.log(username + ' logged in successfully.');
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

		var name = sanitizeHtml(data.name, {
			allowedTags: [],
			allowedAttributes: []
		});

		if (!name) {
			console.log('User attempted to create game with invalid name.');
			socket.emit('game-create-response', { success: false });
			return;
		}

		if (games[name] !== undefined) {
			// Username is already taken
			console.log('User attempted to create game with name "' + name + '", but it was already taken.');
			socket.emit('game-create-response', { success: false });
			return;
		}

		var game = {
			name: name,
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
		games[name] = game;
		socket.game = game;

		socket.emit('game-create-response', { success: true });
		console.log(socket.username + ' successfully created a new game named ' + name);
	});

	socket.on('join-game', function (data) {
		if (games[data.gameName] === undefined) {
			console.log('User attempted to join non-existent game "' + data.gameName + '".');
			socket.emit('join-game-response', { success: false });
			return;
		}

		var game = games[data.gameName];
		if (game.password) {
			socket.emit('join-game-challenge');
			return;
		}

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

	socket.on('join-game-answer-challenge', function (data) {
		var game = games[data.gameName];
		if (game.password !== data.password) {
			console.log('User attempted to join game, but gave the wrong password.');
			socket.emit('join-game-response', { success: false });
			return;
		}

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
		game.currentSituation.text = sanitizeHtml(game.currentSituation.text);
		for(var i = 0, ilen = game.players.length; i < ilen; ++i) {

			var nouns = game.nounDeck.deal(numberOfCardsInHand);
			var verbs = game.verbDeck.deal(numberOfCardsInHand);
			nouns.forEach(function (card) {
				card.text = sanitizeHtml(card.text);
			});
			verbs.forEach(function (card) {
				card.text = sanitizeHtml(card.text);
			});

			clients[game.players[i]].emit('game-started', {
				decider: game.players[game.deciderIndex],
				nouns: nouns,
				verbs: verbs,
				situation: game.currentSituation,
				firstRound: game.firstRound
			});
		}
		if (game.firstRound) {
			console.log('Game ' + game.name + ' has been successfully started.');
			game.firstRound = false;
		} else {
			console.log('Game ' + game.name + ' has successfully started a new round.');
		}
		games[data.name] = game;
		
	});

	socket.on('submit-play', function (data) {
		var game = socket.game;
		var count = validatePlay(
			game.currentSituation, 
			data.cardsPlayed, 
			game.nounDeck, 
			game.verbDeck
		);
		if (count === null) {
			// Invalid play
			socket.emit('submit-play-response', {
				success: false
			});
			return;
		}

		data.cardsPlayed = data.cardsPlayed.concat(count.extraCards);

		for (var i = 0, ilen = game.players.length; i < ilen; ++i) {
			clients[game.players[i]].emit('play-submitted', {
				cardsPlayed: data.cardsPlayed,
				situation: game.currentSituation,
				player: socket.username
			});
		} 
		socket.emit('submit-play-response', {
			success: true,
			nouns: game.nounDeck.deal(count.nounsPlayed),
			verbs: game.verbDeck.deal(count.verbsPlayed)
		});
		console.log(socket.username + ' has successfully subitted a play.');
	});

	socket.on('decide-winner', function (data) {
		var game = games[data.gameName];
		if (game.deciderIndex !== game.players.indexOf(socket.username)) {
			return;
		}

		var count = validatePlay(game.currentSituation, data.cardsPlayed);
		if (count === null) {
			//TODO: Display error message
			return;
		}

		game.players.forEach(function (item, index) {
			clients[item].emit('winner-found', {
				player: data.player,
				cardsPlayed: data.cardsPlayed,
				situation: game.currentSituation
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