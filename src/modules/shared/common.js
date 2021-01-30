//Exceptions / Errors

function SampleRateException(message) {
	this.message = message;
	this.name = "SampleRateException";
}
function ArrayTypeException(message) {
	this.message = message;
	this.name = "ArrayTypeException";
}
function SampleSizeException(message){
	this.message = message;
	this.name = "SampleSizeException";
}
function BufferSizeException(message){
	this.message = message;
	this.name = "BufferSizeException";
}

//Converters

var CommonConverters = {};

CommonConverters.floatTo16BitPCM = function (output, input){
	for (let i = 0; i < input.length; i++) {
		let s = Math.max(-1, Math.min(1, input[i]));
		output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
	}
}
