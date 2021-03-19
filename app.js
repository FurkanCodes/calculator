// function add(a, b) {
//     return a + b;
//   }
  
//   function subtract(a, b) {
//     return a - b;
//   }
  
//   function multiply(a, b) {
//     return a * b;
//   }
  
//   function divide(a, b) {
//     return a / b;
//   }
  
  
//   function calculate(a,operator,b) {
//       if(operator === '+') {
//           return add(a, b);
//       } else if(operator === '-'){
//           return subtract(a, b);
//       } else if(operator === '*') {
//           return multiply(a, b);
//       } else if(operator === '/'){
//           return divide(a, b);
//       }
      
//   }
  const calculator = document.querySelector('.calculator');
  const numButton = document.querySelectorAll('.number');
  const opButton = document.querySelectorAll('.operator');
  const clear = document.querySelector('.clear');
  const display = document.querySelector('.calc_display');
  const keyPad = document.querySelector('.calc_keys');


 
 function getDisplay(){
   return display.innerText;
 }


 function printDisplay(num) {
  if(num === ''){
    display.innerText = num;
  } else {
    display.innerText = getNumber(num);
  }
 }


 function getNumber(num) {
   let n = Number(num);
   let value = n.toLocaleString("en");
   return value;
 }


 function reverseNumberFormat(num){
	return Number(num.replace(/,/g,''));
}



for(let i = 0; i < opButton.length; i++) {
  opButton[i].addEventListener('click', function(){
  
	});
}



for(var i =0;i<numButton.length;i++){
	numButton[i].addEventListener('click',function(){
		var output=reverseNumberFormat(getDisplay());
		if(output!=NaN){ //if output is a number
			output=output+this.id;
			printDisplay(output);
		}
	});
}

