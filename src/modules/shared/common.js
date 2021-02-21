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
function ChannelCountException(message){
	this.message = message;
	this.name = "ChannelCountException";
}

//Converters

var CommonConverters = {};

CommonConverters.singleSampleFloatTo16BitPCM = function(s){
	s = Math.max(-1, Math.min(1, s));
	return (s < 0 ? s * 0x8000 : s * 0x7FFF);
}
CommonConverters.floatTo16BitPCM = function(output, input){
	for (let i = 0; i < input.length; i++) {
		output[i] = CommonConverters.singleSampleFloatTo16BitPCM(input[i]);
	}
}
CommonConverters.singleSampleInt16ToFloat32BitAudio = function(s){
	//s = Math.max(-32768, Math.min(32767, s));
	return Math.max(-1.0, Math.min(1.0, s/32768));
}
CommonConverters.int16ToFloat32BitAudio = function(output, input){
	for (let i = 0; i < input.length; i++) {
		return CommonConverters.singleSampleInt16ToFloat32BitAudio(input[i]);
	}
}
