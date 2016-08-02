window.CardAnimator = function() {

	/* Please note, all measurements are in pixels. */
	var maxScreenWidth = 400;
	var stackSidePadding = 10;
	var stackBetweenPadding = 7;
	var decayRate = 0.95;
	var speedMultiplier = 15;
	var cardSectionClassName = 'card-section';
	var cardClassName = 'card';

	var speed = 0;
	var cardWidth = 0; // Gets initialize automatically
	var cardSections = null;
	var cardsBeingAnimated = null;
	var cardSectionBeingTouched = null;
	var touchObj = null;
	var startTime = null;
	var originalStartPoint = 0;
	var tempStartPoint = 0;
	var endPoint = 0;
	var isDragging = false;

	function Init() {

		if (window.innerWidth > maxScreenWidth) {
			return;
		}

		cardSections = document.getElementsByClassName(cardSectionClassName);
		for (var i = 0, len = cardSections.length; i < len; ++i) {	

			var cards = cardSections[i].getElementsByClassName(cardClassName);
			cardSections[i].cards = cards;

			cardWidth = cards[0].offsetWidth;
			for (var j = 0, jlen = cards.length; j < jlen; ++j) {
				cards[j].style['z-index'] = j + 1;
				cards[j].style['left'] = ((stackBetweenPadding * j) + stackSidePadding) + 'px';						
			}

			cardSections[i].addEventListener('touchstart', onTouchStart);
			cardSections[i].addEventListener('touchmove', onTouchMove);
			cardSections[i].addEventListener('touchend', onTouchEnd);
						
			cardSections[i].addEventListener('mousedown', onMouseDown);
			cardSections[i].addEventListener('mousemove', onMouseMove);
			cardSections[i].addEventListener('mouseup', onMouseUp);				
		}
	}

	function onMouseDown(e) {
		startTime = (new Date()).getTime();
		originalStartPoint =  e.pageX;	
		tempStartPoint = originalStartPoint
		isDragging = true;	
		
		var touchTarget = e.target;

		if(touchTarget.cards === undefined) {
			cardsBeingAnimated = touchTarget.parentElement.cards;
		} else {
			cardsBeingAnimated = touchTarget.cards;
		}

		e.preventDefault();
	}

	function onMouseMove(e) {
		if (isDragging) {
			endPoint =  e.pageX;	
			var delta = tempStartPoint - endPoint;
			moveCardGroup(cardsBeingAnimated, delta);
			tempStartPoint = endPoint;	
		}
		e.preventDefault();
	}

	function onMouseUp(e) {
		var time = (new Date()).getTime();
		var distance = originalStartPoint - endPoint;
		speed = (distance / (time - startTime)) * speedMultiplier;
		isDragging = false;
		e.preventDefault();		
		window.requestAnimationFrame(animate);
	}

	function onTouchStart(e) {
		startTime = (new Date()).getTime();
		originalStartPoint =  e.touches[0].pageX;	
		tempStartPoint = originalStartPoint
		isDragging = true;	
		
		var touchTarget = e.touches[0].target;

		if(touchTarget.cards === undefined) {
			cardsBeingAnimated = touchTarget.parentElement.cards;
		} else {
			cardsBeingAnimated = touchTarget.cards;
		}

		e.preventDefault();
	}

	function onTouchMove(e) {
		if (isDragging) {
			endPoint =  e.touches[0].pageX;	
			var delta = tempStartPoint - endPoint;
			moveCardGroup(cardsBeingAnimated, delta);
			tempStartPoint = endPoint;	
		}
		e.preventDefault();
	}

	function onTouchEnd(e) {
		var time = (new Date()).getTime();
		var distance = originalStartPoint - endPoint;
		speed = (distance / (time - startTime)) * speedMultiplier;
		isDragging = false;
		e.preventDefault();		
		window.requestAnimationFrame(animate);
	}

	function animate() {
		moveCardGroup(cardsBeingAnimated, speed);
		speed = speed * decayRate;
		
		if (speed > 0.5 || speed < -0.5) {
			window.requestAnimationFrame(animate);
		}
	};

	function moveCardGroup(cards, numberOfPixels) {

		if (numberOfPixels < 0) {
			/* We are moving the cards to the right, so we need to
			 * start with the last card and work our way back. */
			for (var i = (cards.length - 1); i >= 0; --i) {
				moveCard(cards, i, numberOfPixels);

				/* This makes sure that when on the other side, the stack of cards
				 * is 'leaning' the other direction. */
				var stackOffset = (stackBetweenPadding * ((cards.length) - i)) + stackSidePadding;
				var cardPosition = getPositionOfCard(cards, i);
				var cardIsAtEdge = getPositionOfCard(cards, i) >= (window.innerWidth - cardWidth - stackOffset);
				var distanceBetween = i > 0 ? (getPositionOfCard(cards, i) - getPositionOfCard(cards, i - 1) - cardWidth) : 0;
				if (!cardIsAtEdge && (distanceBetween < stackBetweenPadding)) {
					break;
				}
			}
		} else if (numberOfPixels > 0) {
			/* We are moving the cards to the left, so we need to
			 * start with the first card and work our way through. */
			for (var i = 0, len = cards.length; i < len; ++i) {
				moveCard(cards, i, numberOfPixels);

				var stackOffset = (stackBetweenPadding * i) + stackSidePadding;
				var cardIsAtEdge = getPositionOfCard(cards, i) <= stackOffset;
				var distanceBetween = i < (len - 1) ? ((getPositionOfCard(cards, i + 1) - getPositionOfCard(cards, i)) - cardWidth) : 0;
				if (!cardIsAtEdge && (distanceBetween < stackBetweenPadding)) {
					break;
				}
			}
		}

		
	}

	function moveCard(cards, cardIndex, numberOfPixels) {
		var card = cards[cardIndex];
		var originalPosition = getPositionOfCard(cards, cardIndex);
		var newPosition = originalPosition - numberOfPixels;
		var startedLeft = ((originalPosition + (cardWidth / 2)) < (window.innerWidth / 2));
		
		/* Make sure the move won't make the card go off screen,
		 * and will leave some room to see the card underneath it. */
		var stackOffset;
		if (startedLeft) {
			stackOffset = (stackBetweenPadding * cardIndex) + stackSidePadding;
		} else {
			stackOffset = (stackBetweenPadding * ((cards.length) - cardIndex)) + stackSidePadding;
		}

		if (newPosition > (window.innerWidth - cardWidth - stackOffset)) {
			newPosition = (window.innerWidth - cardWidth - stackOffset);
		} else if (newPosition < stackOffset) {
			newPosition = stackOffset
		}

		card.style['left'] = newPosition + 'px';

		var distanceBetweenGoingRight = cardIndex > 0 ? (newPosition - getPositionOfCard(cards, cardIndex - 1) - cardWidth) : (stackBetweenPadding + 1);
		var distanceBetweenGoingLeft = cardIndex < (cards.length - 1) ? ((getPositionOfCard(cards, cardIndex + 1) - newPosition) + cardWidth) : (stackBetweenPadding + 1);
		if (numberOfPixels < 0 && distanceBetweenGoingRight >= stackBetweenPadding && parseInt(card.style['z-index']) > 0) {
			card.style['z-index'] = -1 * card.style['z-index'];
		}
		if (numberOfPixels > 0 && distanceBetweenGoingLeft >= stackBetweenPadding && parseInt(card.style['z-index']) < 0) {
			card.style['z-index'] = -1 * card.style['z-index'];
		}
	}

	function getPositionOfCard(cards, cardIndex) {
		var positionStyle = cards[cardIndex].style['left'];
		return parseInt(positionStyle.substring(0, positionStyle.length - 2));
	}

	return {
		Init: Init
	};

}();