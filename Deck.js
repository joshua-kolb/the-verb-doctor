function Deck(cards) {
	this.originalCardSet = cards;
	this.cards = [];
	this.reset();
};

Deck.prototype.deal = function (numberOfCards) {
	if (this.cards.length < numberOfCards) {
		this.reset();			
	}
	return this.cards.splice(this.cards.length - numberOfCards, numberOfCards);		
}

Deck.prototype.shuffle = function () {
	for(var i = 0, ilen = this.cards.length; i < ilen; ++i) {
		var temp = this.cards[i];
		var rand = Math.floor(Math.random() * ilen);
		this.cards[i] = this.cards[rand];
		this.cards[rand] = temp;
	}
}

Deck.prototype.reset = function () {
	var resetCards = (this.cards && this.cards.length > 0) ?
		this.originalCardSet.concat(this.cards) : this.originalCardSet;
	this.cards = resetCards.slice(0);
	this.shuffle();
}

module.exports = Deck;