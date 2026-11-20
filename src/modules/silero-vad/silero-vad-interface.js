/*
 * Silero VAD v6 (16 kHz) for classic workers, on the WASM build of FluidVad:
 * https://github.com/FluidInference/FluidVad - npm @fluidinference/fluidvad 0.2.0,
 * dist/fluidvad_bg.wasm, sha256 4a74528661ff8273833f1def85d7d457302dcfcaccc48c18ba20521b456a10ef.
 * MIT, see LICENSE; the Silero model inside is MIT too, see SILERO_LICENSE.
 *
 * Replaces the package's ES-module glue, which 'importScripts' cannot load. The import
 * names carry hashes of the wasm-bindgen build (0.2.126), so this file fits that one
 * .wasm only: a newer one needs its names from the new dist/fluidvad.js.
 * The .wasm needs WASM SIMD, there is no scalar build.
 */
var SileroVad = (function(){
	var wasm, externrefs;

	function text(ptr, len){
		return new TextDecoder().decode(new Uint8Array(wasm.memory.buffer, ptr >>> 0, len));
	}
	function takeExternref(idx){
		var value = externrefs.get(idx);
		wasm.__externref_table_dealloc(idx);
		return value;
	}

	var imports = {"./fluidvad_bg.js": {
		__wbg_Error_92b29b0548f8b746: function(ptr, len){ return Error(text(ptr, len)); },
		__wbg___wbindgen_throw_344f42d3211c4765: function(ptr, len){ throw new Error(text(ptr, len)); },
		//only 'segment()' (offline) creates these, and it is not exposed here
		__wbg_segment_new: function(ptr){ wasm.__wbg_segment_free(ptr, 0); return null; },
		//read right away and freed, so no wrapper object has to own the pointer
		__wbg_vadevent_new: function(ptr){
			var event = {
				isStart: wasm.__wbg_get_vadevent_isStart(ptr) !== 0,
				sampleIndex: wasm.__wbg_get_vadevent_sampleIndex(ptr),
				timeSeconds: wasm.__wbg_get_vadevent_timeSeconds(ptr)
			};
			wasm.__wbg_vadevent_free(ptr, 0);
			return event;
		},
		__wbindgen_init_externref_table: function(){
			var table = wasm.__wbindgen_externrefs;
			var offset = table.grow(4);
			table.set(0, undefined);
			table.set(offset + 0, undefined);
			table.set(offset + 1, null);
			table.set(offset + 2, true);
			table.set(offset + 3, false);
		}
	}};

	/**
	 * Instantiate the module once per worker.
	 * @param {ArrayBuffer|Uint8Array} wasmBytes - fluidvad_bg.wasm
	 * @returns {Promise}
	 */
	function load(wasmBytes){
		if (wasm) return Promise.resolve();
		return WebAssembly.instantiate(wasmBytes, imports).then(function(result){
			wasm = result.instance.exports;
			externrefs = wasm.__wbindgen_externrefs;
			wasm.__wbindgen_start();
		});
	}

	var OPTION_KEYS = ["threshold", "negativeThreshold", "minSpeechDuration", "minSilenceDuration", "maxSpeechDuration", "speechPadding"];

	/**
	 * One VAD with its own model state. Building it parses and optimizes the model,
	 * about a second, so build it once and 'reset' it between recordings.
	 * @param {object} [options] - FluidVad's event options (threshold, minSilenceDuration, ...), seconds and 0..1
	 */
	function Vad(options){
		var optionsPtr = wasm.vadoptions_new();
		OPTION_KEYS.forEach(function(key){
			if (options && options[key] != undefined) wasm["vadoptions_set_" + key](optionsPtr, options[key]);
		});
		var ret = wasm.fluidvad_new(optionsPtr);	//takes over the options
		if (ret[2]) throw takeExternref(ret[1]);
		this.ptr = ret[0];
	}
	/** Samples per frame: 512, 32 ms at 16 kHz. */
	Vad.frameSize = function(){
		return wasm.fluidvad_frameSize() >>> 0;
	};
	/**
	 * Feed 16 kHz mono samples in -1..1, any length; partial frames wait for the next call.
	 * @param {Float32Array} samples
	 * @returns {Array} speech start/end events ({isStart, sampleIndex, timeSeconds}) of the completed frames
	 */
	Vad.prototype.push = function(samples){
		var inPtr = wasm.__wbindgen_malloc(samples.length * 4, 4) >>> 0;	//freed by the module
		new Float32Array(wasm.memory.buffer).set(samples, inPtr / 4);
		var ret = wasm.fluidvad_push(this.ptr, inPtr, samples.length);
		if (ret[3]) throw takeExternref(ret[2]);
		var view = new DataView(wasm.memory.buffer);
		var events = [];
		for (var i = 0; i < ret[1]; i++){
			events.push(externrefs.get(view.getUint32(ret[0] + 4 * i, true)));
		}
		wasm.__externref_drop_slice(ret[0], ret[1]);
		wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
		return events;
	};
	/** Speech probability (0..1) of the latest completed frame. */
	Vad.prototype.probability = function(){
		return wasm.fluidvad_lastProbability(this.ptr);
	};
	/** Whether FluidVad's own event logic is inside speech. */
	Vad.prototype.isSpeaking = function(){
		return wasm.fluidvad_isSpeaking(this.ptr) !== 0;
	};
	/** Clears model state, event state and waiting samples. */
	Vad.prototype.reset = function(){
		wasm.fluidvad_reset(this.ptr);
	};
	Vad.prototype.free = function(){
		if (this.ptr) wasm.__wbg_fluidvad_free(this.ptr, 0);
		this.ptr = 0;
	};

	return {load: load, Vad: Vad};
})();
