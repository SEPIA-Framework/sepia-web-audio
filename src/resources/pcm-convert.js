//original: https://github.com/audiojs/pcm-convert
function convert(buffer, from, to, target) {

	/*from = {
		channels: 2,
		interleaved: false,
		dtype: 'float32',
		endianness: 'le'
	}*/
	/*to = {
		channels: 1,
		interleaved: true,
		dtype: 'uint8',
		endianness: 'le'
	}*/
	
	to.type = to.dtype;
	from.type = from.dtype;

	//ignore same format
	if (from.type === to.type && from.interleaved === to.interleaved &&	from.endianness === to.endianness) 
		return buffer;

	normalize(from);
	normalize(to);

	var src
	if (buffer instanceof ArrayBuffer) {
		//convert buffer/alike to arrayBuffer
		src = new (dtypeClass[from.dtype])(buffer);
	}else {
		//typed arrays are unchanged as is
		src = buffer;
	}

	//dst is automatically filled with mapped values
	//but in some cases mapped badly, e. g. float → int(round + rotate)
	var dst = to.type === 'array' ? Array.from(src) : new (dtypeClass[to.dtype])(src);

	//if range differ, we should apply more thoughtful mapping
	if (from.max !== to.max) {
		var fromRange = from.max - from.min, toRange = to.max - to.min;
		for (var i = 0, l = src.length; i < l; i++) {
			var value = src[i];

			//ignore not changed range
			//bring to 0..1
			var normalValue = (value - from.min) / fromRange;

			//bring to new format ranges
			value = normalValue * toRange + to.min;

			//clamp (buffers do not like values outside of bounds)
			dst[i] = Math.max(to.min, Math.min(to.max, value));
		}
	}

	//reinterleave, if required
	if (from.interleaved != to.interleaved) {
		var channels = from.channels;
		var len = Math.floor(src.length / channels);

		//deinterleave
		if (from.interleaved && !to.interleaved) {
			dst = dst.map(function (value, idx, data) {
				var offset = idx % len;
				var channel = ~~(idx / len);

				return data[offset * channels + channel];
			});
		
		//interleave
		}else if (!from.interleaved && to.interleaved) {
			dst = dst.map(function (value, idx, data) {
				var offset = ~~(idx / channels);
				var channel = idx % channels;

				return data[channel * len + offset];
			});
		}
	}

	//ensure endianness
	if (to.dtype != 'array' && to.dtype != 'int8' && to.dtype != 'uint8' && from.endianness && to.endianness && from.endianness !== to.endianness) {
		var le = to.endianness === 'le';
		var view = new DataView(dst.buffer);
		var step = dst.BYTES_PER_ELEMENT;
		var methodName = 'set' + to.dtype[0].toUpperCase() + to.dtype.slice(1);
		for (var i = 0, l = dst.length; i < l; i++) {
			view[methodName](i*step, dst[i], le);
		}
	}

	if (to.type === 'audiobuffer') {
		//TODO
	}

	if (target) {
		if (Array.isArray(target)) {
			for (var i = 0; i < dst.length; i++) {
				target[i] = dst[i];
			}
		}else if (target instanceof ArrayBuffer) {
			var	targetContainer = new dtypeClass[to.dtype](target);
			targetContainer.set(dst);
			target = targetContainer;
		}else {
			target.set(dst);
		}
		dst = target;
	}

	if (to.type === 'arraybuffer' || to.type === 'buffer') dst = dst.buffer;

	return dst;
}

var dtypeClass = {
	'uint8': Uint8Array,
	'uint8_clamped': Uint8ClampedArray,
	'uint16': Uint16Array,
	'uint32': Uint32Array,
	'int8': Int8Array,
	'int16': Int16Array,
	'int32': Int32Array,
	'float32': Float32Array,
	'float64': Float64Array,
	'array': Array,
	'arraybuffer': Uint8Array,
	'buffer': Uint8Array,
	'audiobuffer': Float32Array
}

var defaultDtype = {
	'uint8': 'uint8',
	'uint8_clamped': 'uint8',
	'uint16': 'uint16',
	'uint32': 'uint32',
	'int8': 'int8',
	'int16': 'int16',
	'int32': 'int32',
	'float32': 'float32',
	'float64': 'float64',
	'array': 'array',
	'arraybuffer': 'uint8',
	'buffer': 'uint8',
	'audiobuffer': 'float32'
}

//make sure all format properties are present
function normalize(obj) {
	if (!obj.dtype) {
		obj.dtype = defaultDtype[obj.type] || 'array';
	}

	//provide limits
	switch (obj.dtype) {
		case 'float32':
		case 'float64':
		case 'audiobuffer':
			obj.min = -1
			obj.max = 1
			break;
		case 'uint8':
			obj.min = 0
			obj.max = 255
			break;
		case 'uint16':
			obj.min = 0
			obj.max = 65535
			break;
		case 'uint32':
			obj.min = 0
			obj.max = 4294967295
			break;
		case 'int8':
			obj.min = -128
			obj.max = 127
			break;
		case 'int16':
			obj.min = -32768
			obj.max = 32767
			break;
		case 'int32':
			obj.min = -2147483648
			obj.max = 2147483647
			break;
		default:
			obj.min = -1
			obj.max = 1
			break;
	}

	return obj;
}
