
function add(a, b) {
  return parseFloat(a) + b;
}

function subtract(a, b) {
  return parseFloat(a) - b;
}

function multiply(a, b) {
  return parseFloat(a) * parseFloat(b);
}

function divide(a, b) {
  if (b != "0") {
    return parseFloat(a) / parseFloat(b);
  } else {
    return "I afraid you cannot divide by 0";
  }
}

function calculate(a, operator, b) {
  if (operator === "+") {
    return add(a, b);
  } else if (operator === "-") {
    return subtract(a, b);
  } else if (operator === "x") {
    return multiply(a, b);
  } else if (operator === "/") {
    return divide(a, b);
  }
}

const calculator = document.querySelector(".calculator");
const numButton = document.querySelectorAll(".number");
const opButton = document.querySelectorAll(".operator");
const clear = document.querySelector(".clear");
const display = document.querySelector(".calc_display");
const keyPad = document.querySelector(".calc_keys");
const equalsKey = document.querySelector(".equal");
const clearBtn = document.querySelector(".clear");
const decimal = document.querySelector(".decimal");

let displayVal = "";
let clickedOperator = "";
let firstNumber = "";
let result = "";

// Decimal counter
let decimalCount = 0;

display.textContent = 0;

numButton.forEach((number) => {
  number.addEventListener("click", function () {
    // For  the decimal increment decimal counter
    if (number.id === ".") {
      decimalCount++;
    }

    // For more than one decimal don't do anything. Return
    if (number.id === "." && decimalCount > 1) {
      return;
    }

    displayVal += number.id;
    display.textContent = displayVal;
  });
});

opButton.forEach((operator) => {
  operator.addEventListener("click", function () {
    if (firstNumber && displayVal) {
      displayResult();
    }
    firstNumber = displayVal;
    decimalCount = 0;
    clickedOperator = operator.textContent;
    display.textContent = displayVal + clickedOperator;
    displayVal = "";
  });
});

equalsKey.addEventListener("click", function () {
  displayResult();
});

function displayResult() {
  result = calculate(
    parseFloat(firstNumber),
    clickedOperator,
    parseFloat(displayVal)
  );
  display.textContent = result;
  display.textContent = firstNumber + displayVal;
  displayVal = result;
}

// clears the display
clearBtn.addEventListener("click", function () {
  return resetAll();
});

function resetAll() {
  displayVal = "";
  clickedOperator = "";
  firstNumber = "";
  result = "";
  display.textContent = 0;
}


