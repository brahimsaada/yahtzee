'use strict';

const player0 = document.querySelector('.player--0');
const player1 = document.querySelector('.player--1');
const score0 = document.querySelector('#score--0');
const score1 = document.querySelector('#score--1');

const btnRoll = document.querySelector('.btn--roll');
const btnNew = document.querySelector('.btn--new');
const btnHold = document.querySelector('.btn--hold');
const diceImages = [
  document.querySelector('.checkbox-container1 img'),
  document.querySelector('.checkbox-container2 img'),
  document.querySelector('.checkbox-container3 img'),
  document.querySelector('.checkbox-container4 img'),
  document.querySelector('.checkbox-container5 img'),
];
const checkboxes = [
  document.querySelector('.checkbox-container1 input'),
  document.querySelector('.checkbox-container2 input'),
  document.querySelector('.checkbox-container3 input'),
  document.querySelector('.checkbox-container4 input'),
  document.querySelector('.checkbox-container5 input'),
];
const gameCheckboxes1 = [
  document.getElementById('1-1'),
  document.getElementById('2-1'),
  document.getElementById('3-1'),
  document.getElementById('4-1'),
  document.getElementById('5-1'),
  document.getElementById('6-1'),
  document.getElementById('7-1'),
  document.getElementById('8-1'),
  document.getElementById('9-1'),
  document.getElementById('10-1'),
  document.getElementById('11-1'),
  document.getElementById('12-1'),
  document.getElementById('13-1'),
];
const gameCheckboxes2 = [
  document.getElementById('1-2'),
  document.getElementById('2-2'),
  document.getElementById('3-2'),
  document.getElementById('4-2'),
  document.getElementById('5-2'),
  document.getElementById('6-2'),
  document.getElementById('7-2'),
  document.getElementById('8-2'),
  document.getElementById('9-2'),
  document.getElementById('10-2'),
  document.getElementById('11-2'),
  document.getElementById('12-2'),
  document.getElementById('13-2'),
];

let scores, scoreUP, scoreDOWN, currentScore, activePlayer, playing;
let count = 0;
let bonus = [false, false];
let val;
let turns = 0;
init();

function init() {
  scores = [0, 0];
  scoreUP = [0, 0];
  scoreDOWN = [0, 0];
  currentScore = 0;
  activePlayer = 0;
  playing = [true, true, true, true, true];
  val = [0, 0, 0, 0, 0];
  count = 0;
  turns = 0;

  score0.textContent = 0;
  score1.textContent = 0;

  diceImages.forEach(img => img.classList.add('hidden'));
  player0.classList.remove('player--winner');
  player1.classList.remove('player--winner');
  player0.classList.remove('player--loser');
  player1.classList.remove('player--loser');
  player0.classList.add('player--active');
  player1.classList.remove('player--active');
  document.getElementById('name--0').textContent = 'Player 1';
  document.getElementById('name--1').textContent = 'Player 2';

  document.getElementById(`35-0`).classList.add('hidden');
  document.getElementById(`35-1`).classList.add('hidden');
  document.querySelector(`#current--00`).textContent = 0;
  document.querySelector(`#current--01`).textContent = 0;

  // Reset all checkboxes
  checkboxes.forEach(checkbox => (checkbox.checked = false));

  gameCheckboxes1.forEach(checkbox => {
    checkbox.checked = false;
    checkbox.style.display = 'inline';
  });
  gameCheckboxes2.forEach(checkbox => {
    checkbox.checked = false;
    checkbox.style.display = 'inline';
  });

  btnRoll.classList.remove('hidden');
  btnHold.classList.remove('hidden');
}

//Button New Game
btnNew.addEventListener('click', init);

//Button Roll Dice
btnRoll.addEventListener('click', roll);

//Function Roll
function roll() {
  if(count==2){
    btnRoll.classList.add('hidden');
  }
  if (count < 3) {
    diceImages.forEach((image, index) => {
      if (playing[index]) {
        let rndm = Math.trunc(Math.random() * 6) + 1;
        val[index] = rndm;
        image.src = `dice-${rndm}.png`;
        image.classList.remove('hidden');
      }
    });
    count++;
  } else {
    hold();
    count = 0;
  }
}

//Button Hold
btnHold.addEventListener('click', hold);

//Function Hold
function hold() {
  let chekk = false;
  let delet;
  let gamecheck = activePlayer === 0 ? gameCheckboxes1 : gameCheckboxes2;
  
  // Check if any checkbox is checked
  gamecheck.forEach((checkbox, index) => {
    if (checkbox.checked) {
      chekk = true;
      delet = index + 1;
    }
  });
  if (!chekk) {
    console.log('select an option!!');
  } else {
    const checkbox = document.getElementById(`${delet}-${activePlayer + 1}`);
    checkbox.style.display = 'none';
    updateScores();
    document.querySelector(`#score--${activePlayer}`).textContent = scores[activePlayer];
    switchPlayer();
    btnRoll.classList.remove('hidden');
    if (turns == 26) {
      winner();
    }
  }
}

//Function to select the Winner
function winner() {
  player0.classList.remove('player--active');
  player1.classList.remove('player--active');
  btnHold.classList.add('hidden');
  btnRoll.classList.add('hidden');
  if (scores[0] > scores[1]) {
    player0.classList.add('player--winner');
    player1.classList.add('player--loser');
    document.querySelector('#name--0').textContent = "WINNER";
    document.querySelector('#name--1').textContent = "LOOSER";
  } else if (scores[1] > scores[0]) {
    player1.classList.add('player--winner');
    player0.classList.add('player--loser');
    document.querySelector('#name--1').textContent = "WINNER";
    document.querySelector('#name--0').textContent = "LOOSER";
  }
}

//Function to update scores in HTML
function updateScores() {
  let gamecheck = activePlayer === 0 ? gameCheckboxes1 : gameCheckboxes2;
  gamecheck.forEach((checkbox, index) => {
    if (checkbox.checked && index < 6) {
      for (let i = 0; i < 5; i++) {
        if (val[i] == index + 1) scoreUP[activePlayer] += val[i];
      }
    }
  });
  checkRepeat(val);
  document.querySelector(`#current--0${activePlayer}`).textContent = scoreUP[activePlayer];
  if (scoreUP[activePlayer] >= 63 && !bonus[activePlayer]) {
    document.getElementById(`35-${activePlayer}`).classList.remove('hidden');
    bonus[activePlayer] = true;
  }
  if (bonus[activePlayer]) {
    scores[activePlayer] = scoreUP[activePlayer] + scoreDOWN[activePlayer] + 35;
  } else {
    scores[activePlayer] = scoreUP[activePlayer] + scoreDOWN[activePlayer];
  }
}

//Function to change the player
function switchPlayer() {
  activePlayer === 0
    ? gameCheckboxes1.forEach(checkbox => (checkbox.checked = false))
    : gameCheckboxes2.forEach(checkbox => (checkbox.checked = false));
  activePlayer = activePlayer === 0 ? 1 : 0;
  player0.classList.toggle('player--active');
  player1.classList.toggle('player--active');
  val = [0, 0, 0, 0, 0];
  checkboxes.forEach(checkbox => (checkbox.checked = false));
  playing = [true, true, true, true, true];
  diceImages.forEach(img => img.classList.add('hidden'));
  count = 0;
  turns++;
}

checkboxes.forEach((checkbox, index) => {
  checkbox.addEventListener('change', function () {
    playing[index] = !this.checked;
  });
});

// Down section code
function checkRepeat(arr) {
  const numCount = {};
  let hasThreeKind = false;
  let hasFourKind = false;
  let hasTwoPair = false;
  let yahtzee = false;
  let fourConsecutives = false;
  let fiveConsecutives = true;

  // Count the occurrences of each number
  for (let i = 0; i < arr.length; i++) {
    const num = arr[i];
    numCount[num] = (numCount[num] || 0) + 1;
  }

  // Check if there's a number repeated 3 or 4 times
  for (const num in numCount) {
    if (numCount[num] >= 3) {
      hasThreeKind = true;
    }
    if (numCount[num] === 4) {
      hasFourKind = true;
    }
    if (numCount[num] === 5) {
      yahtzee = true;
    }
  }

  // Check if there are two pairs
  if (Object.entries(numCount).length == 2 && hasThreeKind) {
    hasTwoPair = true;
  }

  // Consecutive numbers
  const numbers = arr.map(Number);

  // Sort the numbers in ascending order
  numbers.sort((a, b) => a - b);

  // Check for consecutive subsets of length 4
  for (let i = 0; i <= 1; i++) {
    if (numbers[i + 1] == numbers[i] + 1 &&
        numbers[i + 2] == numbers[i] + 2 &&
        numbers[i + 3] == numbers[i] + 3) {
      fourConsecutives = true;
    }
  }

  for (let i = 0; i < 4; i++) {
    if (numbers[i] + 1 !== numbers[i + 1]) {
      fiveConsecutives = false;
    }
  }

  // Update the score based on the found combinations
  if (document.getElementById(`7-${activePlayer+1}`).checked && hasThreeKind) {
    let sumThreeKind = 0;
    for (const num of arr) {
      sumThreeKind += num;
    }
    scoreDOWN[activePlayer] += sumThreeKind;
  }

  if (document.getElementById(`8-${activePlayer+1}`).checked && hasFourKind) {
    let sumFoureKind = 0;
    for (const num of arr) {
      sumFoureKind += num;
    }
    scoreDOWN[activePlayer] += sumFoureKind;
  }

  if (document.getElementById(`9-${activePlayer+1}`).checked && hasTwoPair) {
    scoreDOWN[activePlayer] += 25;
  }

  if (document.getElementById(`10-${activePlayer+1}`).checked && fourConsecutives) {
    scoreDOWN[activePlayer] += 30;
  }

  if (document.getElementById(`11-${activePlayer+1}`).checked && fiveConsecutives) {
    scoreDOWN[activePlayer] += 40;
  }

  if (document.getElementById(`12-${activePlayer+1}`).checked && yahtzee) {
    scoreDOWN[activePlayer] += 50;
  }

  if (document.getElementById(`13-${activePlayer+1}`).checked) {
    let sumChance = 0;
    for (const num of arr) {
      sumChance += num;
    }
    scoreDOWN[activePlayer] += sumChance;
  }
}
