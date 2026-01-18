// dice.js

export const DiceColor = {
  RED: "red",
  YELLOW: "yellow",
  BLUE: "blue",
  BLACK: "black"
};

export class Die {
  constructor(color, sides = 6) {
    this.color = color;
    this.sides = sides;
  }

  roll() {
    return Math.floor(Math.random() * this.sides) + 1;
  }
}

export class DicePool {
  constructor() {
    this.initialDice = [];
    this.availableDice = [];
    this.discardedDice = [];

    this._buildPool();
    this.reset();
  }

  _buildPool() {
    // 12 red, yellow, blue dice (standard 6-sided)
    this._addDice(DiceColor.RED, 12);
    this._addDice(DiceColor.YELLOW, 12);
    this._addDice(DiceColor.BLUE, 12);

    // 4 black hazard dice
    this._addDice(DiceColor.BLACK, 4);
  }

  _addDice(color, count) {
    for (let i = 0; i < count; i++) {
      this.initialDice.push(new Die(color));
    }
  }

  reset() {
    this.availableDice = [...this.initialDice];
    this.discardedDice = [];
    this._shuffle(this.availableDice);
  }

  drawDie(color = null) {
    let index;

    if (color) {
      index = this.availableDice.findIndex(d => d.color === color);
      if (index === -1) return null;
    } else {
      index = 0;
    }

    const [die] = this.availableDice.splice(index, 1);
    return die;
  }

  discardDie(die) {
    this.discardedDice.push(die);
  }

  remaining(color = null) {
    if (!color) return this.availableDice.length;
    return this.availableDice.filter(d => d.color === color).length;
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
