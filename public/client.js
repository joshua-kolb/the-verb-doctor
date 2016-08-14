var client = function (library) {
	return library(window, document, window.io);
}(function (window, document, io) {

	// constants
	var numberOfCardsInHand = 4;
	var displayWinnerTime = 5000; // In milliseconds

	// private variables
	var socket = null;
	var username = '';
	var waiting = false;
	var isHost = false;
	var isDecider = false;
	var currentGameName = '';
	var currentGamePassword = '';
	var cardsToBePlayed = [];
	var submittedPlays = {};
	var submissionClicked = null;
	var reconnecting = false;

	// HTML elements
	var loginView                    = null;
	var usernameTextbox              = null;
	var usernameOkButton             = null;
	var loginNotification            = null;
	var gameSelectView               = null;
	var createNewGameButton          = null;
	var refreshGameListButton        = null;
	var gameList                     = null;
	var gameChallengeView            = null;
	var gameChallengePasswordTextbox = null;
	var gameChallengeOkButton        = null;
	var gameCreateView               = null;
	var gameNameTextbox              = null;
	var gamePasswordTextbox          = null;
	var gameCreateOkButton           = null;
	var gameCreateNotification       = null;
	var playerView                   = null;
	var playerSituationCard          = null;
	var nounCardSection              = null;
	var verbCardSection              = null;
	var deciderView                  = null;
	var deciderHeader                = null;
	var deciderSubmissions           = null;
	var waitingView                  = null;
	var waitingPlayerList            = null;
	var startGameButton              = null;
	var betweenRoundsView            = null;
	var confirmView                  = null;
	var confirmButton                = null;
	var backButton                   = null;

	function init() {
		initializeHtmlElements();
		setUpHtmlElementEvents();

		socket = io();
		setUpSocketEvents();
	}

	function initializeHtmlElements() {
		loginView                    = document.getElementById('login-view');
		usernameTextbox              = document.getElementById('username-textbox');
		usernameOkButton             = document.getElementById('username-ok-button');
		loginNotification            = document.getElementById('login-notification');
		gameSelectView               = document.getElementById('game-select-view');
		createNewGameButton          = document.getElementById('create-new-game-button');
		refreshGameListButton        = document.getElementById('refresh-game-list-button');
		gameList                     = document.getElementById('game-list');
		gameChallengeView            = document.getElementById('game-challenge-view');
		gameChallengePasswordTextbox = document.getElementById('game-challenge-password-textbox');
		gameChallengeOkButton        = document.getElementById('game-challenge-ok-button');
		gameCreateView               = document.getElementById('game-create-view');
		gameNameTextbox              = document.getElementById('game-name-textbox');
		gamePasswordTextbox          = document.getElementById('game-password-textbox');
		gameCreateOkButton           = document.getElementById('game-create-ok-button');
		gameCreateNotification       = document.getElementById('game-create-notification');
		playerView                   = document.getElementById('player-view');
		playerSituationCard          = document.getElementById('player-situation-card');
		nounCardSection              = document.getElementById('noun-card-section');
		verbCardSection              = document.getElementById('verb-card-section');
		deciderView                  = document.getElementById('decider-view');
		deciderHeader                = document.getElementById('decider-header');
		deciderSubmissions           = document.getElementById('decider-submissions');
		waitingView                  = document.getElementById('waiting-view');
		waitingPlayerList            = document.getElementById('waiting-player-list');
		startGameButton              = document.getElementById('start-game-button');
		betweenRoundsView            = document.getElementById('between-rounds-view');
		confirmView                  = document.getElementById('confirm-view');
		confirmButton                = document.getElementById('confirm-button');
		backButton                   = document.getElementById('back-button');
	}

	function setUpHtmlElementEvents() {
		usernameTextbox.addEventListener('keyup', function(event) {
			if (event.keyCode == 13) {
				// The enter key was pressed
				socket.emit('login', { username: usernameTextbox.value });
				username = usernameTextbox.value;
			}
		});

		usernameOkButton.addEventListener('click', function(event) {
			loginNotification.classList.add('hidden');
			username = usernameTextbox.value;
			socket.emit('login', { username: usernameTextbox.value });
		});

		gameChallengePasswordTextbox.addEventListener('keyup', function (event) {
			if (event.keyCode == 13) {
				// The enter key was pressed
				socket.emit('join-game-answer-challenge', { 
					gameName: currentGameName,
					password: gameChallengePasswordTextbox.value 
				});
				gameChallengePasswordTextbox.blur();
				gameChallengeView.classList.add('hidden');
			}
		});

		gameChallengeOkButton.addEventListener('click', function(event) {
			currentGamePassword = gameChallengePasswordTextbox.value;
			socket.emit('join-game-answer-challenge', { 
				gameName: currentGameName,
				password: currentGamePassword
			});
			gameChallengePasswordTextbox.blur();
			gameChallengeView.classList.add('hidden');
		});

		createNewGameButton.addEventListener('click', function(event) {
			gameSelectView.classList.add('hidden');
			gameCreateView.classList.remove('hidden');
		});

		refreshGameListButton.addEventListener('click', function(event) {
			socket.emit('refresh-game-list');
		});

		gameNameTextbox.addEventListener('keyup', function (event) {
			if (event.keyCode == 13) {
				// The enter key was pressed
				socket.emit('game-create', {
					name: gameNameTextbox.value,
					password: gamePasswordTextbox.value
				});
				gameNameTextbox.blur();
			}
		});

		gamePasswordTextbox.addEventListener('keyup', function (event) {
			if (event.keyCode == 13) {
				// The enter key was pressed
				socket.emit('game-create', {
					name: gameNameTextbox.value,
					password: gamePasswordTextbox.value
				});
				gamePasswordTextbox.blur();
			}
		});

		gameCreateOkButton.addEventListener("click", function(event) {
			socket.emit('game-create', {
				name: gameNameTextbox.value,
				password: gamePasswordTextbox.value
			});
			gameNameTextbox.blur();
			gamePasswordTextbox.blur();
		});

		startGameButton.addEventListener('click', function(event) {
			socket.emit('start-game', {
				name: currentGameName
			});
		});

		confirmButton.addEventListener('click', function(event) {
			if (!isDecider) {
				socket.emit('submit-play', {
					cardsPlayed: cardsToBePlayed
				});
				cardsToBePlayed = [];
				playerView.classList.add('hidden');
				confirmView.classList.add('hidden');
				deciderView.classList.remove('hidden');
				return;
			}

			var winner = submissionClicked.getAttribute('data-player');
			socket.emit('decide-winner', {
				gameName: currentGameName,
				player: winner,
				cardsPlayed: submittedPlays[winner]
			});	
			confirmView.classList.add('hidden');
		});

		backButton.addEventListener('click', function(event) {
			if (!isDecider) {
				// Remove cards from cards to be played, and render
				// them back into the view
				var nounReplaced = false;
				var verbReplaced = false;
				for (var i = 0, ilen = cardsToBePlayed.length; i < ilen; ++i) {
					var card = cardsToBePlayed.pop();
					if (card.type === 'noun') {
						nounCardSection.innerHTML += renderPlayableCard(card);
						nounReplaced = true;
					} else {
						verbCardSection.innerHTML += renderPlayableCard(card);
						verbReplaced = true;
					}
				}

				if (nounReplaced) {
					wireUpCardsInCardSection(nounCardSection);
				}

				if (verbReplaced) {
					wireUpCardsInCardSection(verbCardSection);
				}

				// Empty out the plays from the situation card
				var spans = playerSituationCard.getElementsByTagName('span');
				for (var i = 0, ilen = spans.length; i < ilen; ++i) {
					spans[i].innerHTML = '';
				}
				
			}

			confirmView.classList.add('hidden');
		});
	}

	function setUpSocketEvents() {
		socket.on('reconnect', function() {
			if (!username) {
				return;
			}

			socket.emit('login', { username: username });

			if (!currentGameName) {				
				return;
			}

			reconnecting = true;
			window.setTimeout(function () {
				socket.emit('join-game', { gameName: currentGameName });
			}, 2000);
		});

		socket.on('login-response', function(data) {
			if (!data.success) {
				loginNotification.innerHTML = 'That username has already been chosen. Please choose another.';
				loginNotification.classList.remove('hidden');
				return;
			}

			gameList.innerHTML = renderGameTiles(data.games);
			wireUpGameTiles();
			
			usernameTextbox.blur();
			loginView.classList.add('hidden');
			gameSelectView.classList.remove('hidden');
		});

		socket.on('refresh-game-list-response', function (data) {
			if (!data.success) {
				// TODO: Display error message
				return;
			}
			gameList.innerHTML = renderGameTiles(data.games);
			wireUpGameTiles();
		});

		socket.on('join-game-challenge', function (data) {
			if (!reconnecting) {
				gameChallengeView.classList.remove('hidden');
			}
			
			socket.emit('join-game-answer-challenge', { 
				gameName: currentGameName,
				password: currentGamePassword
			});
		});

		socket.on('join-game-response', function (data) {
			reconnecting = false;
			if (!data.success) {
				//Display error message
				return;
			}

			isHost = false;

			if (data.waiting) {
				waitingView.classList.remove('hidden');

				var markup = '';
				for (var i = 0, ilen = data.players.length; i < ilen; ++i) {
					markup += '<li>' + data.players[i];
					if (data.host === data.players[i]) {
						markup += ' (Host)';
					}
					markup += '</li>';
				}
				waitingPlayerList.innerHTML = markup;
				waiting = true;
			}

			
		});

		socket.on('player-joined-game', function(data) {
			if (waiting) {
				waitingPlayerList.innerHTML += '<li>' + data.player + '</li>';
				if (isHost) {
					startGameButton.classList.remove('hidden');
				}
			}
		});

		socket.on('game-create-response', function(data) {
			if (!data.success) {
				gameCreateNotification.innerHTML = 'That game name has already been taken. Please choose another.';
				gameCreateNotification.classList.remove('hidden');
				return;
			}			
			gameCreateView.classList.add('hidden');
			waitingView.classList.remove('hidden');
			waitingPlayerList.innerHTML = '<li>' + username + ' (Host)</li>';
			waiting = true;
			isHost = true;
			currentGameName = gameNameTextbox.value;
		});

		socket.on('game-started', function(data) {
			if (data.firstRound) {
				waitingView.classList.add('hidden');

				// put cards into the view...
				nounCardSection.innerHTML = renderPlayableCards(data.nouns);
				wireUpCardsInCardSection(nounCardSection);
				verbCardSection.innerHTML = renderPlayableCards(data.verbs);
				wireUpCardsInCardSection(verbCardSection);
			} else {
				betweenRoundsView.classList.add('hidden');
			}

			if(data.decider === username) {
				isDecider = true;
				deciderHeader.innerHTML = 
					'<h1>You are the Decider</h1>' +
					renderSituationCard(data.situation);
				deciderView.classList.remove('hidden');
				return;
			}
			
			isDecider = false;
			deciderHeader.innerHTML = 
				'<h1>' + data.decider + ' is the Decider<h1>';	

			playerSituationCard.innerHTML = convertCardTextToHTML(data.situation.text);
			playerView.classList.remove('hidden');
		});

		socket.on('submit-play-response', function(data) {
			if (!data.success) {
				// TODO: display an error message
				return;
			}
			// put cards into the view...
			nounCardSection.innerHTML += renderPlayableCards(data.nouns);
			wireUpCardsInCardSection(nounCardSection);
			verbCardSection.innerHTML += renderPlayableCards(data.verbs);
			wireUpCardsInCardSection(verbCardSection);
		});

		socket.on('play-submitted', function (data) {
			deciderSubmissions.innerHTML += renderSituationCard(data.situation, data.player, isDecider);
			var newSituationElement = deciderSubmissions.children[deciderSubmissions.children.length - 1];
			data.cardsPlayed.forEach(function (item, index) {
				insertPlayableCardIntoSituation(
					convertCardTextToHTML(item.text),
					item.type === 'noun',
					newSituationElement
				);
			});
			if (isDecider) {
				//Save the cards played for submitting to the server later
				//when choosing the winner.
				submittedPlays[data.player] = data.cardsPlayed;

				var submissions = deciderSubmissions.children;
				for (var i = 0, ilen = submissions.length; i < ilen; ++i) {
					submissions[i].addEventListener('click', function(event) {
						var card = event.target
						// Find the actual card element by looping up through
						// the target's parent elements. This is because the target could
						// potentially be a span.
						while (!card.classList.contains('situation-card')) {
							card = card.parentNode;
						}
						confirmView.classList.remove('hidden');
						submissionClicked = card;
					});
				}				
			}			
		});

		socket.on('winner-found', function (data) {
			deciderView.classList.add('hidden');
			deciderHeader.innerHTML = '';
			deciderSubmissions.innerHTML = '';
			betweenRoundsView.innerHTML = 
				'<h1>' + data.player + ' won the round!</h1>';
			
			betweenRoundsView.innerHTML += renderSituationCard(data.situation, data.player, isDecider);
			var newSituationElement = betweenRoundsView.children[betweenRoundsView.children.length - 1];
			data.cardsPlayed.forEach(function (item, index) {
				insertPlayableCardIntoSituation(
					convertCardTextToHTML(item.text),
					item.type === 'noun',
					newSituationElement
				);
			});

			betweenRoundsView.classList.remove('hidden');

			if (isDecider) {
				window.setTimeout(function () {
					socket.emit('start-game', {
						name: currentGameName
					});
				}, displayWinnerTime);
			}
		});
	}

	function renderGameTiles(games) {
		var markup = '';
		for (var key in games) {
			if (!games.hasOwnProperty(key)) {
				continue;
			}
			markup += '<div class="game-tile"><h1>' + games[key].name + '</h1>';
			markup += '<div><h2>Players</h2>';
			markup += '<span class="started-status">';
			markup += games[key].started ? 'Playing' : 'Waiting'; 
			markup += '</span><ul>';
			for (var j = 0, jlen = games[key].players.length; j < jlen; ++j) {
				markup += '<li>' + games[key].players[j];
				if (games[key].players[j] === games[key].host) {
					markup += ' (Host)';
				}
				markup += '</li>';
			}
			markup += '</ul></div></div>';
		}
		return markup;
	}

	function wireUpGameTiles() {
		var tiles = document.getElementsByClassName('game-tile');
		for (var k = 0, klen = tiles.length; k < klen; ++k) {
			tiles[k].addEventListener('click', function (event) {
				var gameName = this.children[0].innerHTML;
				currentGameName = gameName;
				socket.emit('join-game', { gameName: gameName });
				gameSelectView.classList.add('hidden');
			});
		}
	}

	function wireUpCardsInCardSection(cardSection) {
		var cards = cardSection.children;
		for (var i = 0, ilen = cards.length; i < ilen; ++i) {
			cards[i].addEventListener('click', function (event) {
				var card = event.target;
				// Find the actual card element by looping up through
				// the target's parent elements. This is because the target could
				// potentially be a span.
				while (!card.classList.contains('card')) {
					card = card.parentNode;
				}
				cardsToBePlayed.push(convertHTMLToCard(card));
				var success = insertPlayableCardIntoSituation(
					card.innerHTML,
					card.parentNode.id === 'noun-card-section',
					playerSituationCard
				);
				if (success) {
					// Remove card from the playfield
					cardSection.removeChild(card);
				}
			});
		}
	}

	function insertPlayableCardIntoSituation(cardText, isNoun, situationCardElement) {
		var emptySlotsLeft = false;
		var inserted = false;
		var isNextEmptySlot = true;
		var slots = situationCardElement.getElementsByTagName('span');
		for (var i = 0, ilen = slots.length; i < ilen; ++i) {
			if (slots[i].innerHTML !== '') {
				continue;
			}
			if (!inserted && isNextEmptySlot &&
				((slots[i].className === 'bi-curious-noun') ||
				(slots[i].className === 'noun' && isNoun) ||
				(slots[i].className === 'verb' && !isNoun))) {

				slots[i].innerHTML = cardText;
				inserted = true;

				// In the case of a chainer, we have more slots.
				slots = situationCardElement.getElementsByTagName('span');
				ilen = slots.length;
				continue;
			}
			isNextEmptySlot = false;
			emptySlotsLeft = true;
		}
		var noMorePlayableVerbs = verbCardSection.children.length === 1 && !isNoun;
		var noMorePlayableNouns = nounCardSection.children.length === 1 && isNoun;
		if (situationCardElement === playerSituationCard && 
			(!emptySlotsLeft || noMorePlayableVerbs || noMorePlayableNouns)) {
			
			confirmView.classList.remove('hidden');
		}
		return inserted;
	}

	function convertHTMLToCard(cardElement) {
		var type;
		if (cardElement.parentNode === nounCardSection) {
			type = 'noun';
		} else if (cardElement.parentNode === verbCardSection) {
			type = 'verb';
		}

		var text = cardElement.innerHTML
			.replace(/<span class="noun">.*<\/span>/g, '[noun]')
			.replace(/<span class="verb">.*<\/span>/g, '[verb]')
			.replace(/<span class="bi-curious-noun">.*<\/span>/g, '[bi]');

		return { 
			text: text,
			type: type
		};
	}

	function convertCardTextToHTML(text) {
		var result = text.replace(/\[noun\]/g, '<span class="noun"></span>');
		result = result.replace(/\[verb\]/g, '<span class="verb"></span>');
		return result.replace(/\[bi\]/g, '<span class="bi-curious-noun"></span>');
	}

	function renderSituationCard(card, playerName, isClickable) {
		var result =  '<div';
		if (playerName !== undefined) {
			result += ' data-player="' + playerName + '"';
		}
		result += ' class="situation-card';
		if (isClickable) {
			result += ' clickable';
		}
		result += '">' + convertCardTextToHTML(card.text) + '</div>';
		return result;
	}

	function renderPlayableCard(card) {
		return '<div class="card">' +
				convertCardTextToHTML(card.text) +
				'</div>';
	}

	function renderPlayableCards(cards) {
		var result = '';
		for (var i = 0, ilen = cards.length; i < ilen; ++i) {
			result += renderPlayableCard(cards[i]);
		}
		return result;
	}

	return {
		init: init
	}

});