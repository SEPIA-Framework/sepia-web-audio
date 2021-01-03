var Speex = (function() {
    var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
    if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
    return (function(Speex) {
        Speex = Speex || {};
        var Module = typeof Speex !== "undefined" ? Speex : {};
        var readyPromiseResolve, readyPromiseReject;
        Module["ready"] = new Promise(function(resolve, reject) {
            readyPromiseResolve = resolve;
            readyPromiseReject = reject
        });
        var moduleOverrides = {};
        var key;
        for (key in Module) {
            if (Module.hasOwnProperty(key)) {
                moduleOverrides[key] = Module[key]
            }
        }
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = function(status, toThrow) {
            throw toThrow
        };
        var ENVIRONMENT_IS_WEB = false;
        var ENVIRONMENT_IS_WORKER = false;
        var ENVIRONMENT_IS_NODE = false;
        var ENVIRONMENT_IS_SHELL = false;
        ENVIRONMENT_IS_WEB = typeof window === "object";
        ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
        ENVIRONMENT_IS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
        ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
        var scriptDirectory = "";

        function locateFile(path) {
            if (Module["locateFile"]) {
                return Module["locateFile"](path, scriptDirectory)
            }
            return scriptDirectory + path
        }
        var read_, readAsync, readBinary, setWindowTitle;
        var nodeFS;
        var nodePath;
        if (ENVIRONMENT_IS_NODE) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = require("path").dirname(scriptDirectory) + "/"
            } else {
                scriptDirectory = __dirname + "/"
            }
            read_ = function shell_read(filename, binary) {
                var ret = tryParseAsDataURI(filename);
                if (ret) {
                    return binary ? ret : ret.toString()
                }
                if (!nodeFS) nodeFS = require("fs");
                if (!nodePath) nodePath = require("path");
                filename = nodePath["normalize"](filename);
                return nodeFS["readFileSync"](filename, binary ? null : "utf8")
            };
            readBinary = function readBinary(filename) {
                var ret = read_(filename, true);
                if (!ret.buffer) {
                    ret = new Uint8Array(ret)
                }
                assert(ret.buffer);
                return ret
            };
            if (process["argv"].length > 1) {
                thisProgram = process["argv"][1].replace(/\\/g, "/")
            }
            arguments_ = process["argv"].slice(2);
            process["on"]("uncaughtException", function(ex) {
                if (!(ex instanceof ExitStatus)) {
                    throw ex
                }
            });
            process["on"]("unhandledRejection", abort);
            quit_ = function(status) {
                process["exit"](status)
            };
            Module["inspect"] = function() {
                return "[Emscripten Module object]"
            }
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
            if (ENVIRONMENT_IS_WORKER) {
                scriptDirectory = self.location.href
            } else if (document.currentScript) {
                scriptDirectory = document.currentScript.src
            }
            if (_scriptDir) {
                scriptDirectory = _scriptDir
            }
            if (scriptDirectory.indexOf("blob:") !== 0) {
                scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
            } else {
                scriptDirectory = ""
            } {
                read_ = function shell_read(url) {
                    try {
                        var xhr = new XMLHttpRequest;
                        xhr.open("GET", url, false);
                        xhr.send(null);
                        return xhr.responseText
                    } catch (err) {
                        var data = tryParseAsDataURI(url);
                        if (data) {
                            return intArrayToString(data)
                        }
                        throw err
                    }
                };
                if (ENVIRONMENT_IS_WORKER) {
                    readBinary = function readBinary(url) {
                        try {
                            var xhr = new XMLHttpRequest;
                            xhr.open("GET", url, false);
                            xhr.responseType = "arraybuffer";
                            xhr.send(null);
                            return new Uint8Array(xhr.response)
                        } catch (err) {
                            var data = tryParseAsDataURI(url);
                            if (data) {
                                return data
                            }
                            throw err
                        }
                    }
                }
                readAsync = function readAsync(url, onload, onerror) {
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = function xhr_onload() {
                        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                            onload(xhr.response);
                            return
                        }
                        var data = tryParseAsDataURI(url);
                        if (data) {
                            onload(data.buffer);
                            return
                        }
                        onerror()
                    };
                    xhr.onerror = onerror;
                    xhr.send(null)
                }
            }
            setWindowTitle = function(title) {
                document.title = title
            }
        } else {}
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.warn.bind(console);
        for (key in moduleOverrides) {
            if (moduleOverrides.hasOwnProperty(key)) {
                Module[key] = moduleOverrides[key]
            }
        }
        moduleOverrides = null;
        if (Module["arguments"]) arguments_ = Module["arguments"];
        if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
        if (Module["quit"]) quit_ = Module["quit"];
        var wasmBinary;
        if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
        var noExitRuntime;
        if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
        if (typeof WebAssembly !== "object") {
            abort("no native wasm support detected")
        }

        function setValue(ptr, value, type, noSafe) {
            type = type || "i8";
            if (type.charAt(type.length - 1) === "*") type = "i32";
            switch (type) {
                case "i1":
                    HEAP8[ptr >> 0] = value;
                    break;
                case "i8":
                    HEAP8[ptr >> 0] = value;
                    break;
                case "i16":
                    HEAP16[ptr >> 1] = value;
                    break;
                case "i32":
                    HEAP32[ptr >> 2] = value;
                    break;
                case "i64":
                    tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
                    break;
                case "float":
                    HEAPF32[ptr >> 2] = value;
                    break;
                case "double":
                    HEAPF64[ptr >> 3] = value;
                    break;
                default:
                    abort("invalid type for setValue: " + type)
            }
        }

        function getValue(ptr, type, noSafe) {
            type = type || "i8";
            if (type.charAt(type.length - 1) === "*") type = "i32";
            switch (type) {
                case "i1":
                    return HEAP8[ptr >> 0];
                case "i8":
                    return HEAP8[ptr >> 0];
                case "i16":
                    return HEAP16[ptr >> 1];
                case "i32":
                    return HEAP32[ptr >> 2];
                case "i64":
                    return HEAP32[ptr >> 2];
                case "float":
                    return HEAPF32[ptr >> 2];
                case "double":
                    return HEAPF64[ptr >> 3];
                default:
                    abort("invalid type for getValue: " + type)
            }
            return null
        }
        var wasmMemory;
        var wasmTable = new WebAssembly.Table({
            "initial": 6,
            "maximum": 6 + 0,
            "element": "anyfunc"
        });
        var ABORT = false;
        var EXITSTATUS = 0;

        function assert(condition, text) {
            if (!condition) {
                abort("Assertion failed: " + text)
            }
        }

        function AsciiToString(ptr) {
            var str = "";
            while (1) {
                var ch = HEAPU8[ptr++ >> 0];
                if (!ch) return str;
                str += String.fromCharCode(ch)
            }
        }
        var WASM_PAGE_SIZE = 65536;

        function alignUp(x, multiple) {
            if (x % multiple > 0) {
                x += multiple - x % multiple
            }
            return x
        }
        var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

        function updateGlobalBufferAndViews(buf) {
            buffer = buf;
            Module["HEAP8"] = HEAP8 = new Int8Array(buf);
            Module["HEAP16"] = HEAP16 = new Int16Array(buf);
            Module["HEAP32"] = HEAP32 = new Int32Array(buf);
            Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
            Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
            Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
            Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
            Module["HEAPF64"] = HEAPF64 = new Float64Array(buf)
        }
        var DYNAMIC_BASE = 5249296,
            DYNAMICTOP_PTR = 6256;
        var INITIAL_INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 20971520;
        if (Module["wasmMemory"]) {
            wasmMemory = Module["wasmMemory"]
        } else {
            wasmMemory = new WebAssembly.Memory({
                "initial": INITIAL_INITIAL_MEMORY / WASM_PAGE_SIZE,
                "maximum": 2147483648 / WASM_PAGE_SIZE
            })
        }
        if (wasmMemory) {
            buffer = wasmMemory.buffer
        }
        INITIAL_INITIAL_MEMORY = buffer.byteLength;
        updateGlobalBufferAndViews(buffer);
        HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

        function callRuntimeCallbacks(callbacks) {
            while (callbacks.length > 0) {
                var callback = callbacks.shift();
                if (typeof callback == "function") {
                    callback(Module);
                    continue
                }
                var func = callback.func;
                if (typeof func === "number") {
                    if (callback.arg === undefined) {
                        Module["dynCall_v"](func)
                    } else {
                        Module["dynCall_vi"](func, callback.arg)
                    }
                } else {
                    func(callback.arg === undefined ? null : callback.arg)
                }
            }
        }
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var runtimeInitialized = false;

        function preRun() {
            if (Module["preRun"]) {
                if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
                while (Module["preRun"].length) {
                    addOnPreRun(Module["preRun"].shift())
                }
            }
            callRuntimeCallbacks(__ATPRERUN__)
        }

        function initRuntime() {
            runtimeInitialized = true;
            callRuntimeCallbacks(__ATINIT__)
        }

        function preMain() {
            callRuntimeCallbacks(__ATMAIN__)
        }

        function postRun() {
            if (Module["postRun"]) {
                if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
                while (Module["postRun"].length) {
                    addOnPostRun(Module["postRun"].shift())
                }
            }
            callRuntimeCallbacks(__ATPOSTRUN__)
        }

        function addOnPreRun(cb) {
            __ATPRERUN__.unshift(cb)
        }

        function addOnPostRun(cb) {
            __ATPOSTRUN__.unshift(cb)
        }
        var Math_abs = Math.abs;
        var Math_ceil = Math.ceil;
        var Math_floor = Math.floor;
        var Math_min = Math.min;
        var runDependencies = 0;
        var runDependencyWatcher = null;
        var dependenciesFulfilled = null;

        function addRunDependency(id) {
            runDependencies++;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies)
            }
        }

        function removeRunDependency(id) {
            runDependencies--;
            if (Module["monitorRunDependencies"]) {
                Module["monitorRunDependencies"](runDependencies)
            }
            if (runDependencies == 0) {
                if (runDependencyWatcher !== null) {
                    clearInterval(runDependencyWatcher);
                    runDependencyWatcher = null
                }
                if (dependenciesFulfilled) {
                    var callback = dependenciesFulfilled;
                    dependenciesFulfilled = null;
                    callback()
                }
            }
        }
        Module["preloadedImages"] = {};
        Module["preloadedAudios"] = {};

        function abort(what) {
            if (Module["onAbort"]) {
                Module["onAbort"](what)
            }
            what += "";
            out(what);
            err(what);
            ABORT = true;
            EXITSTATUS = 1;
            what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
            throw new WebAssembly.RuntimeError(what)
        }

        function hasPrefix(str, prefix) {
            return String.prototype.startsWith ? str.startsWith(prefix) : str.indexOf(prefix) === 0
        }
        var dataURIPrefix = "data:application/octet-stream;base64,";

        function isDataURI(filename) {
            return hasPrefix(filename, dataURIPrefix)
        }
        var wasmBinaryFile = "data:application/octet-stream;base64,AGFzbQEAAAABggETYAZ/f39/f38Bf2ABfwF/YAF/AGACf38AYAN/f38AYAJ/fwF/YAV/f39/fwF/YAAAYAV/f39/fwBgBn9/f39/fwBgA39/fwF/YAR/f39/AX9gB39/f39/f38Bf2ACfH8Bf2AEfX1/fwF9YAF8AXxgAnx/AXxgAnx8AXxgA3x8fwF8AikEAWEBYQAKAWEBYgABAWEGbWVtb3J5AgHAAoCAAgFhBXRhYmxlAXAABgMgHwIBAxABARIOAQMFEQkAAAAABAgFDwwNCwEEBgIABgcGCQF/AUGQssACCwchCAFjACABZAAfAWUAAgFmAB0BZwAcAWgAGwFpABoBagAHCQsBAEEBCwUSERAPHgrXpwEfgQ0BB38CQCAARQ0AIABBeGoiAyAAQXxqKAIAIgFBeHEiAGohBQJAIAFBAXENACABQQNxRQ0BIAMgAygCACICayIDQYQtKAIAIgRJDQEgACACaiEAIANBiC0oAgBHBEAgAkH/AU0EQCADKAIIIgQgAkEDdiICQQN0QZwtakcaIAQgAygCDCIBRgRAQfQsQfQsKAIAQX4gAndxNgIADAMLIAQgATYCDCABIAQ2AggMAgsgAygCGCEGAkAgAyADKAIMIgFHBEAgBCADKAIIIgJNBEAgAigCDBoLIAIgATYCDCABIAI2AggMAQsCQCADQRRqIgIoAgAiBA0AIANBEGoiAigCACIEDQBBACEBDAELA0AgAiEHIAQiAUEUaiICKAIAIgQNACABQRBqIQIgASgCECIEDQALIAdBADYCAAsgBkUNAQJAIAMgAygCHCICQQJ0QaQvaiIEKAIARgRAIAQgATYCACABDQFB+CxB+CwoAgBBfiACd3E2AgAMAwsgBkEQQRQgBigCECADRhtqIAE2AgAgAUUNAgsgASAGNgIYIAMoAhAiAgRAIAEgAjYCECACIAE2AhgLIAMoAhQiAkUNASABIAI2AhQgAiABNgIYDAELIAUoAgQiAUEDcUEDRw0AQfwsIAA2AgAgBSABQX5xNgIEIAMgAEEBcjYCBCAAIANqIAA2AgAPCyAFIANNDQAgBSgCBCIBQQFxRQ0AAkAgAUECcUUEQCAFQYwtKAIARgRAQYwtIAM2AgBBgC1BgC0oAgAgAGoiADYCACADIABBAXI2AgQgA0GILSgCAEcNA0H8LEEANgIAQYgtQQA2AgAPCyAFQYgtKAIARgRAQYgtIAM2AgBB/CxB/CwoAgAgAGoiADYCACADIABBAXI2AgQgACADaiAANgIADwsgAUF4cSAAaiEAAkAgAUH/AU0EQCAFKAIMIQIgBSgCCCIEIAFBA3YiAUEDdEGcLWoiB0cEQEGELSgCABoLIAIgBEYEQEH0LEH0LCgCAEF+IAF3cTYCAAwCCyACIAdHBEBBhC0oAgAaCyAEIAI2AgwgAiAENgIIDAELIAUoAhghBgJAIAUgBSgCDCIBRwRAQYQtKAIAIAUoAggiAk0EQCACKAIMGgsgAiABNgIMIAEgAjYCCAwBCwJAIAVBFGoiAigCACIEDQAgBUEQaiICKAIAIgQNAEEAIQEMAQsDQCACIQcgBCIBQRRqIgIoAgAiBA0AIAFBEGohAiABKAIQIgQNAAsgB0EANgIACyAGRQ0AAkAgBSAFKAIcIgJBAnRBpC9qIgQoAgBGBEAgBCABNgIAIAENAUH4LEH4LCgCAEF+IAJ3cTYCAAwCCyAGQRBBFCAGKAIQIAVGG2ogATYCACABRQ0BCyABIAY2AhggBSgCECICBEAgASACNgIQIAIgATYCGAsgBSgCFCICRQ0AIAEgAjYCFCACIAE2AhgLIAMgAEEBcjYCBCAAIANqIAA2AgAgA0GILSgCAEcNAUH8LCAANgIADwsgBSABQX5xNgIEIAMgAEEBcjYCBCAAIANqIAA2AgALIABB/wFNBEAgAEEDdiIBQQN0QZwtaiEAAn9B9CwoAgAiAkEBIAF0IgFxRQRAQfQsIAEgAnI2AgAgAAwBCyAAKAIICyECIAAgAzYCCCACIAM2AgwgAyAANgIMIAMgAjYCCA8LIANCADcCECADAn9BACAAQQh2IgFFDQAaQR8gAEH///8HSw0AGiABIAFBgP4/akEQdkEIcSIBdCICIAJBgOAfakEQdkEEcSICdCIEIARBgIAPakEQdkECcSIEdEEPdiABIAJyIARyayIBQQF0IAAgAUEVanZBAXFyQRxqCyICNgIcIAJBAnRBpC9qIQECQAJAAkBB+CwoAgAiBEEBIAJ0IgdxRQRAQfgsIAQgB3I2AgAgASADNgIAIAMgATYCGAwBCyAAQQBBGSACQQF2ayACQR9GG3QhAiABKAIAIQEDQCABIgQoAgRBeHEgAEYNAiACQR12IQEgAkEBdCECIAQgAUEEcWoiB0EQaigCACIBDQALIAcgAzYCECADIAQ2AhgLIAMgAzYCDCADIAM2AggMAQsgBCgCCCIAIAM2AgwgBCADNgIIIANBADYCGCADIAQ2AgwgAyAANgIIC0GULUGULSgCAEF/aiIANgIAIAANAEG8MCEDA0AgAygCACIAQQhqIQMgAA0AC0GULUF/NgIACwtSAQJ/QfAwKAIAIgEgAEEDakF8cSICaiEAAkAgAkEBTkEAIAAgAU0bDQAgAD8AQRB0SwRAIAAQAUUNAQtB8DAgADYCACABDwtB8CxBMDYCAEF/C9YCAQF/AkAgAUUNACAAIAFqIgJBf2pBADoAACAAQQA6AAAgAUEDSQ0AIAJBfmpBADoAACAAQQA6AAEgAkF9akEAOgAAIABBADoAAiABQQdJDQAgAkF8akEAOgAAIABBADoAAyABQQlJDQAgAEEAIABrQQNxIgJqIgBBADYCACAAIAEgAmtBfHEiAmoiAUF8akEANgIAIAJBCUkNACAAQQA2AgggAEEANgIEIAFBeGpBADYCACABQXRqQQA2AgAgAkEZSQ0AIABBADYCGCAAQQA2AhQgAEEANgIQIABBADYCDCABQXBqQQA2AgAgAUFsakEANgIAIAFBaGpBADYCACABQWRqQQA2AgAgAiAAQQRxQRhyIgJrIgFBIEkNACAAIAJqIQADQCAAQgA3AxggAEIANwMQIABCADcDCCAAQgA3AwAgAEEgaiEAIAFBYGoiAUEfSw0ACwsLqAEAAkAgAUGACE4EQCAARAAAAAAAAOB/oiEAIAFB/w9IBEAgAUGBeGohAQwCCyAARAAAAAAAAOB/oiEAIAFB/RcgAUH9F0gbQYJwaiEBDAELIAFBgXhKDQAgAEQAAAAAAAAQAKIhACABQYNwSgRAIAFB/gdqIQEMAQsgAEQAAAAAAAAQAKIhACABQYZoIAFBhmhKG0H8D2ohAQsgACABQf8Haq1CNIa/ogtTAgF/AX4CQAJ/QQAgAEUNABogAK0iAqciASAAQQFyQYCABEkNABpBfyABIAJCIIinGwsiARAHIgBFDQAgAEF8ai0AAEEDcUUNACAAIAEQBAsgAAvGLQELfyMAQRBrIgskAAJAAkACQAJAAkACQAJAAkACQAJAAkAgAEH0AU0EQEH0LCgCACIGQRAgAEELakF4cSAAQQtJGyIFQQN2IgB2IgFBA3EEQCABQX9zQQFxIABqIgJBA3QiBEGkLWooAgAiAUEIaiEAAkAgASgCCCIDIARBnC1qIgRGBEBB9CwgBkF+IAJ3cTYCAAwBC0GELSgCABogAyAENgIMIAQgAzYCCAsgASACQQN0IgJBA3I2AgQgASACaiIBIAEoAgRBAXI2AgQMDAsgBUH8LCgCACIITQ0BIAEEQAJAQQIgAHQiAkEAIAJrciABIAB0cSIAQQAgAGtxQX9qIgAgAEEMdkEQcSIAdiIBQQV2QQhxIgIgAHIgASACdiIAQQJ2QQRxIgFyIAAgAXYiAEEBdkECcSIBciAAIAF2IgBBAXZBAXEiAXIgACABdmoiAkEDdCIDQaQtaigCACIBKAIIIgAgA0GcLWoiA0YEQEH0LCAGQX4gAndxIgY2AgAMAQtBhC0oAgAaIAAgAzYCDCADIAA2AggLIAFBCGohACABIAVBA3I2AgQgASAFaiIHIAJBA3QiAiAFayIDQQFyNgIEIAEgAmogAzYCACAIBEAgCEEDdiIEQQN0QZwtaiEBQYgtKAIAIQICfyAGQQEgBHQiBHFFBEBB9CwgBCAGcjYCACABDAELIAEoAggLIQQgASACNgIIIAQgAjYCDCACIAE2AgwgAiAENgIIC0GILSAHNgIAQfwsIAM2AgAMDAtB+CwoAgAiCkUNASAKQQAgCmtxQX9qIgAgAEEMdkEQcSIAdiIBQQV2QQhxIgIgAHIgASACdiIAQQJ2QQRxIgFyIAAgAXYiAEEBdkECcSIBciAAIAF2IgBBAXZBAXEiAXIgACABdmpBAnRBpC9qKAIAIgEoAgRBeHEgBWshAyABIQIDQAJAIAIoAhAiAEUEQCACKAIUIgBFDQELIAAoAgRBeHEgBWsiAiADIAIgA0kiAhshAyAAIAEgAhshASAAIQIMAQsLIAEoAhghCSABIAEoAgwiBEcEQEGELSgCACABKAIIIgBNBEAgACgCDBoLIAAgBDYCDCAEIAA2AggMCwsgAUEUaiICKAIAIgBFBEAgASgCECIARQ0DIAFBEGohAgsDQCACIQcgACIEQRRqIgIoAgAiAA0AIARBEGohAiAEKAIQIgANAAsgB0EANgIADAoLQX8hBSAAQb9/Sw0AIABBC2oiAEF4cSEFQfgsKAIAIgdFDQBBACAFayECAkACQAJAAn9BACAAQQh2IgBFDQAaQR8gBUH///8HSw0AGiAAIABBgP4/akEQdkEIcSIAdCIBIAFBgOAfakEQdkEEcSIBdCIDIANBgIAPakEQdkECcSIDdEEPdiAAIAFyIANyayIAQQF0IAUgAEEVanZBAXFyQRxqCyIIQQJ0QaQvaigCACIDRQRAQQAhAAwBCyAFQQBBGSAIQQF2ayAIQR9GG3QhAUEAIQADQAJAIAMoAgRBeHEgBWsiBiACTw0AIAMhBCAGIgINAEEAIQIgAyEADAMLIAAgAygCFCIGIAYgAyABQR12QQRxaigCECIDRhsgACAGGyEAIAEgA0EAR3QhASADDQALCyAAIARyRQRAQQIgCHQiAEEAIABrciAHcSIARQ0DIABBACAAa3FBf2oiACAAQQx2QRBxIgB2IgFBBXZBCHEiAyAAciABIAN2IgBBAnZBBHEiAXIgACABdiIAQQF2QQJxIgFyIAAgAXYiAEEBdkEBcSIBciAAIAF2akECdEGkL2ooAgAhAAsgAEUNAQsDQCAAKAIEQXhxIAVrIgMgAkkhASADIAIgARshAiAAIAQgARshBCAAKAIQIgEEfyABBSAAKAIUCyIADQALCyAERQ0AIAJB/CwoAgAgBWtPDQAgBCgCGCEIIAQgBCgCDCIBRwRAQYQtKAIAIAQoAggiAE0EQCAAKAIMGgsgACABNgIMIAEgADYCCAwJCyAEQRRqIgMoAgAiAEUEQCAEKAIQIgBFDQMgBEEQaiEDCwNAIAMhBiAAIgFBFGoiAygCACIADQAgAUEQaiEDIAEoAhAiAA0ACyAGQQA2AgAMCAtB/CwoAgAiASAFTwRAQYgtKAIAIQACQCABIAVrIgJBEE8EQEH8LCACNgIAQYgtIAAgBWoiAzYCACADIAJBAXI2AgQgACABaiACNgIAIAAgBUEDcjYCBAwBC0GILUEANgIAQfwsQQA2AgAgACABQQNyNgIEIAAgAWoiASABKAIEQQFyNgIECyAAQQhqIQAMCgtBgC0oAgAiASAFSwRAQYAtIAEgBWsiATYCAEGMLUGMLSgCACIAIAVqIgI2AgAgAiABQQFyNgIEIAAgBUEDcjYCBCAAQQhqIQAMCgtBACEAIAVBL2oiBAJ/QcwwKAIABEBB1DAoAgAMAQtB2DBCfzcCAEHQMEKAoICAgIAENwIAQcwwIAtBDGpBcHFB2KrVqgVzNgIAQeAwQQA2AgBBsDBBADYCAEGAIAsiAmoiBkEAIAJrIgdxIgIgBU0NCUGsMCgCACIDBEBBpDAoAgAiCCACaiIJIAhNDQogCSADSw0KC0GwMC0AAEEEcQ0EAkACQEGMLSgCACIDBEBBtDAhAANAIAAoAgAiCCADTQRAIAggACgCBGogA0sNAwsgACgCCCIADQALC0EAEAMiAUF/Rg0FIAIhBkHQMCgCACIAQX9qIgMgAXEEQCACIAFrIAEgA2pBACAAa3FqIQYLIAYgBU0NBSAGQf7///8HSw0FQawwKAIAIgAEQEGkMCgCACIDIAZqIgcgA00NBiAHIABLDQYLIAYQAyIAIAFHDQEMBwsgBiABayAHcSIGQf7///8HSw0EIAYQAyIBIAAoAgAgACgCBGpGDQMgASEACwJAIAVBMGogBk0NACAAQX9GDQBB1DAoAgAiASAEIAZrakEAIAFrcSIBQf7///8HSwRAIAAhAQwHCyABEANBf0cEQCABIAZqIQYgACEBDAcLQQAgBmsQAxoMBAsgACIBQX9HDQUMAwtBACEEDAcLQQAhAQwFCyABQX9HDQILQbAwQbAwKAIAQQRyNgIACyACQf7///8HSw0BIAIQAyIBQQAQAyIATw0BIAFBf0YNASAAQX9GDQEgACABayIGIAVBKGpNDQELQaQwQaQwKAIAIAZqIgA2AgAgAEGoMCgCAEsEQEGoMCAANgIACwJAAkACQEGMLSgCACIDBEBBtDAhAANAIAEgACgCACICIAAoAgQiBGpGDQIgACgCCCIADQALDAILQYQtKAIAIgBBACABIABPG0UEQEGELSABNgIAC0EAIQBBuDAgBjYCAEG0MCABNgIAQZQtQX82AgBBmC1BzDAoAgA2AgBBwDBBADYCAANAIABBA3QiAkGkLWogAkGcLWoiAzYCACACQagtaiADNgIAIABBAWoiAEEgRw0AC0GALSAGQVhqIgBBeCABa0EHcUEAIAFBCGpBB3EbIgJrIgM2AgBBjC0gASACaiICNgIAIAIgA0EBcjYCBCAAIAFqQSg2AgRBkC1B3DAoAgA2AgAMAgsgAC0ADEEIcQ0AIAEgA00NACACIANLDQAgACAEIAZqNgIEQYwtIANBeCADa0EHcUEAIANBCGpBB3EbIgBqIgE2AgBBgC1BgC0oAgAgBmoiAiAAayIANgIAIAEgAEEBcjYCBCACIANqQSg2AgRBkC1B3DAoAgA2AgAMAQsgAUGELSgCACIESQRAQYQtIAE2AgAgASEECyABIAZqIQJBtDAhAAJAAkACQAJAAkACQANAIAIgACgCAEcEQCAAKAIIIgANAQwCCwsgAC0ADEEIcUUNAQtBtDAhAANAIAAoAgAiAiADTQRAIAIgACgCBGoiBCADSw0DCyAAKAIIIQAMAAALAAsgACABNgIAIAAgACgCBCAGajYCBCABQXggAWtBB3FBACABQQhqQQdxG2oiCSAFQQNyNgIEIAJBeCACa0EHcUEAIAJBCGpBB3EbaiIBIAlrIAVrIQAgBSAJaiEHIAEgA0YEQEGMLSAHNgIAQYAtQYAtKAIAIABqIgA2AgAgByAAQQFyNgIEDAMLIAFBiC0oAgBGBEBBiC0gBzYCAEH8LEH8LCgCACAAaiIANgIAIAcgAEEBcjYCBCAAIAdqIAA2AgAMAwsgASgCBCICQQNxQQFGBEAgAkF4cSEKAkAgAkH/AU0EQCABKAIIIgMgAkEDdiIEQQN0QZwtakcaIAMgASgCDCICRgRAQfQsQfQsKAIAQX4gBHdxNgIADAILIAMgAjYCDCACIAM2AggMAQsgASgCGCEIAkAgASABKAIMIgZHBEAgBCABKAIIIgJNBEAgAigCDBoLIAIgBjYCDCAGIAI2AggMAQsCQCABQRRqIgMoAgAiBQ0AIAFBEGoiAygCACIFDQBBACEGDAELA0AgAyECIAUiBkEUaiIDKAIAIgUNACAGQRBqIQMgBigCECIFDQALIAJBADYCAAsgCEUNAAJAIAEgASgCHCICQQJ0QaQvaiIDKAIARgRAIAMgBjYCACAGDQFB+CxB+CwoAgBBfiACd3E2AgAMAgsgCEEQQRQgCCgCECABRhtqIAY2AgAgBkUNAQsgBiAINgIYIAEoAhAiAgRAIAYgAjYCECACIAY2AhgLIAEoAhQiAkUNACAGIAI2AhQgAiAGNgIYCyABIApqIQEgACAKaiEACyABIAEoAgRBfnE2AgQgByAAQQFyNgIEIAAgB2ogADYCACAAQf8BTQRAIABBA3YiAUEDdEGcLWohAAJ/QfQsKAIAIgJBASABdCIBcUUEQEH0LCABIAJyNgIAIAAMAQsgACgCCAshASAAIAc2AgggASAHNgIMIAcgADYCDCAHIAE2AggMAwsgBwJ/QQAgAEEIdiIBRQ0AGkEfIABB////B0sNABogASABQYD+P2pBEHZBCHEiAXQiAiACQYDgH2pBEHZBBHEiAnQiAyADQYCAD2pBEHZBAnEiA3RBD3YgASACciADcmsiAUEBdCAAIAFBFWp2QQFxckEcagsiATYCHCAHQgA3AhAgAUECdEGkL2ohAgJAQfgsKAIAIgNBASABdCIEcUUEQEH4LCADIARyNgIAIAIgBzYCAAwBCyAAQQBBGSABQQF2ayABQR9GG3QhAyACKAIAIQEDQCABIgIoAgRBeHEgAEYNAyADQR12IQEgA0EBdCEDIAIgAUEEcWoiBCgCECIBDQALIAQgBzYCEAsgByACNgIYIAcgBzYCDCAHIAc2AggMAgtBgC0gBkFYaiIAQXggAWtBB3FBACABQQhqQQdxGyICayIHNgIAQYwtIAEgAmoiAjYCACACIAdBAXI2AgQgACABakEoNgIEQZAtQdwwKAIANgIAIAMgBEEnIARrQQdxQQAgBEFZakEHcRtqQVFqIgAgACADQRBqSRsiAkEbNgIEIAJBvDApAgA3AhAgAkG0MCkCADcCCEG8MCACQQhqNgIAQbgwIAY2AgBBtDAgATYCAEHAMEEANgIAIAJBGGohAANAIABBBzYCBCAAQQhqIQEgAEEEaiEAIAQgAUsNAAsgAiADRg0DIAIgAigCBEF+cTYCBCADIAIgA2siBEEBcjYCBCACIAQ2AgAgBEH/AU0EQCAEQQN2IgFBA3RBnC1qIQACf0H0LCgCACICQQEgAXQiAXFFBEBB9CwgASACcjYCACAADAELIAAoAggLIQEgACADNgIIIAEgAzYCDCADIAA2AgwgAyABNgIIDAQLIANCADcCECADAn9BACAEQQh2IgBFDQAaQR8gBEH///8HSw0AGiAAIABBgP4/akEQdkEIcSIAdCIBIAFBgOAfakEQdkEEcSIBdCICIAJBgIAPakEQdkECcSICdEEPdiAAIAFyIAJyayIAQQF0IAQgAEEVanZBAXFyQRxqCyIANgIcIABBAnRBpC9qIQECQEH4LCgCACICQQEgAHQiBnFFBEBB+CwgAiAGcjYCACABIAM2AgAgAyABNgIYDAELIARBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhAQNAIAEiAigCBEF4cSAERg0EIABBHXYhASAAQQF0IQAgAiABQQRxaiIGKAIQIgENAAsgBiADNgIQIAMgAjYCGAsgAyADNgIMIAMgAzYCCAwDCyACKAIIIgAgBzYCDCACIAc2AgggB0EANgIYIAcgAjYCDCAHIAA2AggLIAlBCGohAAwFCyACKAIIIgAgAzYCDCACIAM2AgggA0EANgIYIAMgAjYCDCADIAA2AggLQYAtKAIAIgAgBU0NAEGALSAAIAVrIgE2AgBBjC1BjC0oAgAiACAFaiICNgIAIAIgAUEBcjYCBCAAIAVBA3I2AgQgAEEIaiEADAMLQfAsQTA2AgBBACEADAILAkAgCEUNAAJAIAQoAhwiAEECdEGkL2oiAygCACAERgRAIAMgATYCACABDQFB+CwgB0F+IAB3cSIHNgIADAILIAhBEEEUIAgoAhAgBEYbaiABNgIAIAFFDQELIAEgCDYCGCAEKAIQIgAEQCABIAA2AhAgACABNgIYCyAEKAIUIgBFDQAgASAANgIUIAAgATYCGAsCQCACQQ9NBEAgBCACIAVqIgBBA3I2AgQgACAEaiIAIAAoAgRBAXI2AgQMAQsgBCAFQQNyNgIEIAQgBWoiAyACQQFyNgIEIAIgA2ogAjYCACACQf8BTQRAIAJBA3YiAUEDdEGcLWohAAJ/QfQsKAIAIgJBASABdCIBcUUEQEH0LCABIAJyNgIAIAAMAQsgACgCCAshASAAIAM2AgggASADNgIMIAMgADYCDCADIAE2AggMAQsgAwJ/QQAgAkEIdiIARQ0AGkEfIAJB////B0sNABogACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiBSAFQYCAD2pBEHZBAnEiBXRBD3YgACABciAFcmsiAEEBdCACIABBFWp2QQFxckEcagsiADYCHCADQgA3AhAgAEECdEGkL2ohAQJAAkAgB0EBIAB0IgVxRQRAQfgsIAUgB3I2AgAgASADNgIADAELIAJBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhBQNAIAUiASgCBEF4cSACRg0CIABBHXYhBSAAQQF0IQAgASAFQQRxaiIGKAIQIgUNAAsgBiADNgIQCyADIAE2AhggAyADNgIMIAMgAzYCCAwBCyABKAIIIgAgAzYCDCABIAM2AgggA0EANgIYIAMgATYCDCADIAA2AggLIARBCGohAAwBCwJAIAlFDQACQCABKAIcIgBBAnRBpC9qIgIoAgAgAUYEQCACIAQ2AgAgBA0BQfgsIApBfiAAd3E2AgAMAgsgCUEQQRQgCSgCECABRhtqIAQ2AgAgBEUNAQsgBCAJNgIYIAEoAhAiAARAIAQgADYCECAAIAQ2AhgLIAEoAhQiAEUNACAEIAA2AhQgACAENgIYCwJAIANBD00EQCABIAMgBWoiAEEDcjYCBCAAIAFqIgAgACgCBEEBcjYCBAwBCyABIAVBA3I2AgQgASAFaiIEIANBAXI2AgQgAyAEaiADNgIAIAgEQCAIQQN2IgVBA3RBnC1qIQBBiC0oAgAhAgJ/QQEgBXQiBSAGcUUEQEH0LCAFIAZyNgIAIAAMAQsgACgCCAshBSAAIAI2AgggBSACNgIMIAIgADYCDCACIAU2AggLQYgtIAQ2AgBB/CwgAzYCAAsgAUEIaiEACyALQRBqJAAgAAuZAQEDfCAAIACiIgMgAyADoqIgA0R81c9aOtnlPaJE65wriublWr6goiADIANEff6xV+Mdxz6iRNVhwRmgASq/oKJEpvgQERERgT+goCEFIAMgAKIhBCACRQRAIAQgAyAFokRJVVVVVVXFv6CiIACgDwsgACADIAFEAAAAAAAA4D+iIAQgBaKhoiABoSAERElVVVVVVcU/oqChC7YCAgJ9B3wgAbsiBpkiB0SN7bWg98awPmMEQCAADwsgByACtyIHRAAAAAAAAOA/omQEfUMAAAAABSAAIAGUIQEgAygCAAJ/IAYgBqAgB6O2iyADKAIEspQiBI4iBYtDAAAAT10EQCAFqAwBC0GAgICAeAsiAkEDdGoiAysDCCEHIAMrAwAhCiADKwMQIQkgAysDGCEGIAG7RBgtRFT7IQlAoiIIEBYgALuiIAijIAYgBCACspMiACAAIACUIgGUuyIIRJWoZ1VVVcU/oiILIAC7IgZElahnVVVVxT+ioSIMoiAJIAG7RAAAAAAAAOA/oiIJIAagIAhEAAAAAAAA4D+ioSIIoiAKIAkgBkS1K0xVVVXVv6KgIAuhIgaiIAdEAAAAAAAA8D8gDKEgCKEgBqGioKCgorYLC/IMAhJ/An0gACAAKAIIIgIgACgCDCIDbiIGNgIkIAAgACgCEEEUbCIBQbQJaigCACIENgIwIAAoAhghCSAAIAFBsAlqKAIAIgU2AhggACACIAMgBmxrNgIoIAAoAhwhDAJAAkACQCACIANLBEAgACABQbgJaioCACADs5QgArOVOAIsIAUgBSADbiIBIANsayIFQX8gAm4iBksNAiABIAZLDQIgASACbCIBIAIgBWwgA24iBUF/c0sNAiAAIAEgBWpBB2pBeHEiBTYCGCAEIANBAXQgAkkiAXYgA0ECdCACSSIGdiADQQN0IgcgAkl2IQQCQAJAIAENACAGDQAgByACTw0BCyAAIAQ2AjALIAQgA0EEdCACSSIBdiECIAFFQQAgAhsNASAAIAJBASACGyIENgIwDAELIAAgAUG8CWooAgA2AiwLAkAgAyAFbCICIAQgBWxBCGoiAU0EQEEBIQZB/////wEgA24gBU8NAQtBACEGIAEhAkH3////ASAEbiAFSQ0BCyAAKAJQIAJJBEAgACgCTCACQQJ0EAwiAUUNASAAIAI2AlAgACABNgJMCyAAAn8CQAJAIAZFBEBBfCEBIAAoAhgiAiAAKAIwIgRsQQRqIgVBfEoNASAAKAIQIQMMAgsgACgCGCECAkAgACgCDCIBRQ0AIAJFBEBBACECDAELIAFBASABQQFLGyEEIAJBfm0hBSAAKAIQQRRsQcAJaigCACEGIAGzIRMgACgCTCEHQQAhAwNAIAIgA2whCCADsyATlSEUQQAhAQNAIAcgASAIakECdGogACoCLCABQQFqIgEgBWqyIBSTIAIgBhAJOAIAIAEgAkcNAAsgA0EBaiIDIARHDQALC0EBQQIgACgCEEEIShsMAgsgAkEBdrMhEyAAKAIQIgNBFGxBwAlqKAIAIQYgBLMhFCAAKAJMIQQDQCABQQJ0IARqIAAqAiwgAbIgFJUgE5MgAiAGEAk4AhAgAUEBaiIBIAVHDQALC0EDQQQgA0EIShsLNgJUIAIgACgCIGpBf2oiASAAKAIcIgJLBEBB/////wEgACgCFCICbiABSQ0BIAAoAkggASACbEECdBAMIgJFDQEgACABNgIcIAAgAjYCSCABIQILIAAoAjhFBEAgAiAAKAIUbCICRQRAQQAPCyAAKAJIIAJBAnQQBEEADwsgACgCGCICIAlLBEAgACgCFCIDRQRAQQAPCyAJQX9qIQ0gA0ECdEF8aiEOIAAoAkQhD0EAIQYDQCAPIANBf2oiA0ECdCIQaiIHKAIAIgJBAXQhBSACIA1qIgEEQCADIAxsIQggACgCHCADbCEKIAAoAkghBANAIAQgAUF/aiIBIAJqIApqQQJ0aiAEIAEgCGpBAnRqKAIANgIAIAENAAsLIA4gBkECdGshCCACBEAgACgCSCAAKAIcIAhsaiACQQJ0EAQLIAdBADYCAAJAIAUgCWoiBCAAKAIYIgVJBEAgBEF/aiIHBEAgBUF+aiERIARBfmohEiAAKAIcIANsIQogACgCSCELQQAhAUEAIQIDQCALIAEgEWogCmpBAnRqIAsgASASaiAKakECdGooAgA2AgAgAkF/cyEBIAJBAWoiAiAHRw0ACwsgBUF/aiICIAdLBEAgACgCSCAAKAIcIAhsaiACIAdrQQJ0EAQLIAAoAjwgEGoiAiACKAIAIAUgBGtBAXZqNgIADAELIAcgBCAFa0EBdiICNgIAIAJBf2oiAUEAIAAoAhgiBGtGDQAgASAEaiIBQQEgAUEBSxshBSAAKAIcIANsIQcgACgCSCEEQQAhAQNAIAQgASAHaiIIQQJ0aiAEIAIgCGpBAnRqKAIANgIAIAFBAWoiASAFRw0ACwsgBkEBaiEGIAMNAAtBAA8LQQAhASACIAlPDQEgACgCFEUNASAAKAJEIQZBACEDA0AgBiADQQJ0aiIEKAIAIQEgBCAJIAJrQQF2IgI2AgAgASACaiIHQX9qIgFBACAAKAIYIgVrRwRAIAEgBWoiAUEBIAFBAUsbIQggACgCHCADbCEKIAAoAkghBUEAIQEDQCAFIAEgCmoiC0ECdGogBSACIAtqQQJ0aigCADYCACABQQFqIgEgCEcNAAsLIAQgBzYCACADQQFqIgMgACgCFE8EQEEADwUgACgCGCECDAELAAALAAsgACAJNgIYIABBBTYCVEEBIQELIAELhwwBBn8gACABaiEFAkACQCAAKAIEIgJBAXENACACQQNxRQ0BIAAoAgAiAyABaiEBIAAgA2siAEGILSgCAEcEQEGELSgCACEEIANB/wFNBEAgACgCCCIEIANBA3YiA0EDdEGcLWpHGiAEIAAoAgwiAkYEQEH0LEH0LCgCAEF+IAN3cTYCAAwDCyAEIAI2AgwgAiAENgIIDAILIAAoAhghBgJAIAAgACgCDCICRwRAIAQgACgCCCIDTQRAIAMoAgwaCyADIAI2AgwgAiADNgIIDAELAkAgAEEUaiIDKAIAIgQNACAAQRBqIgMoAgAiBA0AQQAhAgwBCwNAIAMhByAEIgJBFGoiAygCACIEDQAgAkEQaiEDIAIoAhAiBA0ACyAHQQA2AgALIAZFDQECQCAAIAAoAhwiA0ECdEGkL2oiBCgCAEYEQCAEIAI2AgAgAg0BQfgsQfgsKAIAQX4gA3dxNgIADAMLIAZBEEEUIAYoAhAgAEYbaiACNgIAIAJFDQILIAIgBjYCGCAAKAIQIgMEQCACIAM2AhAgAyACNgIYCyAAKAIUIgNFDQEgAiADNgIUIAMgAjYCGAwBCyAFKAIEIgJBA3FBA0cNAEH8LCABNgIAIAUgAkF+cTYCBCAAIAFBAXI2AgQgBSABNgIADwsCQCAFKAIEIgJBAnFFBEAgBUGMLSgCAEYEQEGMLSAANgIAQYAtQYAtKAIAIAFqIgE2AgAgACABQQFyNgIEIABBiC0oAgBHDQNB/CxBADYCAEGILUEANgIADwsgBUGILSgCAEYEQEGILSAANgIAQfwsQfwsKAIAIAFqIgE2AgAgACABQQFyNgIEIAAgAWogATYCAA8LQYQtKAIAIQMgAkF4cSABaiEBAkAgAkH/AU0EQCAFKAIIIgQgAkEDdiICQQN0QZwtakcaIAQgBSgCDCIDRgRAQfQsQfQsKAIAQX4gAndxNgIADAILIAQgAzYCDCADIAQ2AggMAQsgBSgCGCEGAkAgBSAFKAIMIgJHBEAgAyAFKAIIIgNNBEAgAygCDBoLIAMgAjYCDCACIAM2AggMAQsCQCAFQRRqIgMoAgAiBA0AIAVBEGoiAygCACIEDQBBACECDAELA0AgAyEHIAQiAkEUaiIDKAIAIgQNACACQRBqIQMgAigCECIEDQALIAdBADYCAAsgBkUNAAJAIAUgBSgCHCIDQQJ0QaQvaiIEKAIARgRAIAQgAjYCACACDQFB+CxB+CwoAgBBfiADd3E2AgAMAgsgBkEQQRQgBigCECAFRhtqIAI2AgAgAkUNAQsgAiAGNgIYIAUoAhAiAwRAIAIgAzYCECADIAI2AhgLIAUoAhQiA0UNACACIAM2AhQgAyACNgIYCyAAIAFBAXI2AgQgACABaiABNgIAIABBiC0oAgBHDQFB/CwgATYCAA8LIAUgAkF+cTYCBCAAIAFBAXI2AgQgACABaiABNgIACyABQf8BTQRAIAFBA3YiAkEDdEGcLWohAQJ/QfQsKAIAIgNBASACdCICcUUEQEH0LCACIANyNgIAIAEMAQsgASgCCAshAyABIAA2AgggAyAANgIMIAAgATYCDCAAIAM2AggPCyAAQgA3AhAgAAJ/QQAgAUEIdiICRQ0AGkEfIAFB////B0sNABogAiACQYD+P2pBEHZBCHEiAnQiAyADQYDgH2pBEHZBBHEiA3QiBCAEQYCAD2pBEHZBAnEiBHRBD3YgAiADciAEcmsiAkEBdCABIAJBFWp2QQFxckEcagsiAzYCHCADQQJ0QaQvaiECAkACQEH4LCgCACIEQQEgA3QiB3FFBEBB+CwgBCAHcjYCACACIAA2AgAgACACNgIYDAELIAFBAEEZIANBAXZrIANBH0YbdCEDIAIoAgAhAgNAIAIiBCgCBEF4cSABRg0CIANBHXYhAiADQQF0IQMgBCACQQRxaiIHQRBqKAIAIgINAAsgByAANgIQIAAgBDYCGAsgACAANgIMIAAgADYCCA8LIAQoAggiASAANgIMIAQgADYCCCAAQQA2AhggACAENgIMIAAgATYCCAsLfwECfyAARQRAIAEQBw8LIAFBQE8EQEHwLEEwNgIAQQAPCyAAQXhqQRAgAUELakF4cSABQQtJGxAVIgIEQCACQQhqDwsgARAHIgJFBEBBAA8LIAIgAEF8QXggAEF8aigCACIDQQNxGyADQXhxaiIDIAEgAyABSRsQEyAAEAIgAguSAQEDfEQAAAAAAADwPyAAIACiIgJEAAAAAAAA4D+iIgOhIgREAAAAAAAA8D8gBKEgA6EgAiACIAIgAkSQFcsZoAH6PqJEd1HBFmzBVr+gokRMVVVVVVWlP6CiIAIgAqIiAyADoiACIAJE1DiIvun6qL2iRMSxtL2e7iE+oKJErVKcgE9+kr6goqCiIAAgAaKhoKALzQgDEH8BfQF8IwBBoCBrIgckACAFKAIAIQsgAygCACEOIAAoAlwhECAAKAJYIREgACgCSCEGIAAoAhghCSAAKAIcIQggAEEBNgJcAkAgDkUNACALRQ0AIAggCWtBAWohEiAGIAEgCGwiCEECdGohEyAIQQJ0IAZqQXxqIRQDQCAHIBIgDiAOIBJLGzYCDCAHIAtBgAggC0GACEkbIgY2AggCQAJAAn8gAUECdCIPIAAoAkRqIggoAgBFBEBBACEJIAdBEGoMAQsgByAGNgKcICAHIAgoAgA2ApggIABBATYCOCAAKAIYIQwgACABIAAoAkggACgCHCABbEECdGoiCiAHQZggaiAHQRBqIAdBnCBqIAAoAlQRAAAhDSAAKAI8IA9qIgkoAgAiCCAHKAKYICIGSARAIAcgCDYCmCAgCCEGCyAHIA02ApwgIAkgCSgCACAGazYCACAHKAKYICEGIAxBAk4EQCAMQX9qIQhBACEJA0AgCiAJQQJ0aiAKIAYgCWpBAnRqKAIANgIAIAlBAWoiCSAIRw0ACwsgACgCRCAPaiIIIAgoAgAgBmsiBjYCACAGBEAgDEF/aiEMQQAhCSAHKAKYICENA0AgCiAJIAxqIhVBAnRqIAogDSAVakECdGooAgA2AgAgCUEBaiIJIAZHDQALCyAAKAJcIQYgByAHKAIIIAcoApwgIglrNgIIIAsgCWshCyAIKAIADQEgB0EQaiAGIAlsQQJ0agshDSAHKAIMIQgCQCACBEAgCEUNASAAKAIYIQpBACEGA0AgBiAKakECdCATakF8aiACIAYgEWxBAXRqLgEAsjgCACAGQQFqIgYgCEcNAAsMAQsgCEUNACAUIAAoAhhBAnRqIAhBAnQQBAsgAEEBNgI4IAAoAhghCiAAIAEgACgCSCAAKAIcIAFsQQJ0aiIMIAdBDGogDSAHQQhqIAAoAlQRAAAhDSAAKAI8IA9qIg8oAgAiBiAHKAIMIghIBEAgByAGNgIMIAYhCAsgByANNgIIIA8gDygCACAIazYCACAHKAIMIQggCkECSA0BIApBf2ohCkEAIQYDQCAMIAZBAnRqIAwgBiAIakECdGooAgA2AgAgBkEBaiIGIApHDQALDAELQQAhCCAHQQA2AgggB0EANgIMC0EAIQYgBygCCCIKIAlqIgkEQANAIAQgBiAQbEEBdGoCf0GAgAIgB0EQaiAGQQJ0aioCACIWQwD//8ZdDQAaQf//ASAWQwD9/0ZeDQAaIBa7RAAAAAAAAOA/oJwiF5lEAAAAAAAA4EFjBEAgF6oMAQtBgICAgHgLOwEAIAZBAWoiBiAJRw0ACwsgCyAKayELIA4gCGsiDkUNASACIAggEWxBAXRqQQAgAhshAiAEIAkgEGxBAXRqIQQgCw0ACwsgACAQNgJcIAMgAygCACAOazYCACAFIAUoAgAgC2s2AgAgACgCVBogB0GgIGokAAu/BQIPfwl9IAFBAnQiBiAAKAJAaiIOKAIAIQdBACEBAkAgACgCPCAGaiIPKAIAIgggAygCACIKTg0AIAAoAighCyAAKAIkIQwgACgCXCENIAUoAgAiA0EAIANBAEobIQUgACgCDCIGsyEbIAAoAhgiEEEBTgRAA0AgASAFRgRAIAUhAQwDCyAAKAIwIhEgB2wiAyADIAZuIgMgBmxrsyEYIAIgCEECdGohEkEEIANrIRMgACgCTCEUQQAhA0MAAAAAIRZDAAAAACEZQwAAAAAhGkMAAAAAIRcDQCAZIBIgA0ECdGoqAgAiFSAUIBMgA0EBaiIDIBFsakECdGoiCSoCAJSSIRkgFiAVIAkqAgSUkiEWIBogFSAJQXxqKgIAlJIhGiAXIBUgCUF4aioCAJSSIRcgAyAQRw0ACyAEIAEgDWxBAnRqIBggG5UiFSAVIBVDiqsqPpQiGJSUIhwgGJMiGCAXlCAVIBUgFUMAAAA/lJQiF5IgFSAXlJMiHSAalJIgGUQAAAAAAADwPyAYu6EgHbuhIBcgFUM7qqq+lJIgHJMiFbuhtpSSIBUgFpSSOAIAIAcgC2oiA0EAIAYgAyAGSRtrIQcgAUEBaiEBIAggDGogAyAGT2oiCCAKSA0ADAIACwALA0AgASAFRgRAIAUhAQwCCyAEIAEgDWxBAnRqIAAoAjAgB2wgBnCzIBuVIhUgFSAVQ4qrKj6UIhaUlCIZIBaTIhpDAAAAAJQgFSAVIBVDAAAAP5SUIhaSIBUgFpSTIhdDAAAAAJSSRAAAAAAAAPA/IBq7oSAXu6EgFiAVQzuqqr6UkiAZkyIVu6G2QwAAAACUkiAVQwAAAACUkjgCACAHIAtqIgJBACAGIAIgBkkbayEHIAFBAWohASAIIAxqIAIgBk9qIgggCkgNAAsLIA8gCDYCACAOIAc2AgAgAQvpBQMPfwR9BHwgAUECdCIGIAAoAkBqIg4oAgAhB0EAIQECQCAAKAI8IAZqIg8oAgAiCCADKAIAIgpODQAgACgCKCELIAAoAiQhDCAAKAJcIQ0gBSgCACIDQQAgA0EAShshBSAAKAIMIgazIRggACgCGCIQQQFOBEADQCABIAVGBEAgBSEBDAMLIAAoAjAiESAHbCIDIAMgBm4iAyAGbGuzIRYgAiAIQQJ0aiESQQQgA2shEyAAKAJMIRRBACEDRAAAAAAAAAAAIRlEAAAAAAAAAAAhGkQAAAAAAAAAACEbRAAAAAAAAAAAIRwDQCAaIBIgA0ECdGoqAgAiFSAUIBMgA0EBaiIDIBFsakECdGoiCSoCAJS7oCEaIBkgFSAJKgIElLugIRkgGyAVIAlBfGoqAgCUu6AhGyAcIBUgCUF4aioCAJS7oCEcIAMgEEcNAAsgBCABIA1sQQJ0aiAcIBYgGJUiFSAVIBVDiqsqPpQiFpSUIhcgFpO7IhyiIBsgFSAVIBVDAAAAP5SUIhaSIBUgFpSTuyIboqAgGkQAAAAAAADwPyAcoSAboSAWIBVDO6qqvpSSIBeTuyIaoba7oqAgGSAaoqC2OAIAIAcgC2oiA0EAIAYgAyAGSRtrIQcgAUEBaiEBIAggDGogAyAGT2oiCCAKSA0ADAIACwALA0AgASAFRgRAIAUhAQwCCyAEIAEgDWxBAnRqIAAoAjAgB2wgBnCzIBiVIhUgFSAVQ4qrKj6UIhaUlCIXIBaTuyIZRAAAAAAAAAAAoiAVIBUgFUMAAAA/lJQiFpIgFSAWlJO7IhpEAAAAAAAAAACioEQAAAAAAADwPyAZoSAaoSAWIBVDO6qqvpSSIBeTuyIZoba7RAAAAAAAAAAAoqAgGUQAAAAAAAAAAKKgtjgCACAHIAtqIgJBACAGIAIgBkkbayEHIAFBAWohASAIIAxqIAIgBk9qIgggCkgNAAsLIA8gCDYCACAOIAc2AgAgAQv1AgINfwF9IAFBAnQiBiAAKAJAaiINKAIAIQdBACEBAkAgACgCPCAGaiIOKAIAIgYgAygCACIJTg0AIAAoAgwhCCAAKAIoIQogACgCJCELIAAoAlwhDCAFKAIAIgNBACADQQBKGyEDIAAoAhgiBUEBTgRAIAAoAkwhDwNAIAEgA0YEQCADIQEMAwsgAiAGQQJ0aiEQIA8gBSAHbEECdGohEUMAAAAAIRNBACEAA0AgEyARIABBAnQiEmoqAgAgECASaioCAJSSIRMgAEEBaiIAIAVHDQALIAQgASAMbEECdGogEzgCACAHIApqIgBBACAIIAAgCEkbayEHIAFBAWohASAGIAtqIAAgCE9qIgYgCUgNAAsMAQsDQCABIANGBEAgAyEBDAILIAQgASAMbEECdGpBADYCACAHIApqIgBBACAIIAAgCEkbayEHIAFBAWohASAGIAtqIAAgCE9qIgYgCUgNAAsLIA4gBjYCACANIAc2AgAgAQv5AwIOfwR8IAFBAnQiBiAAKAJAaiIRKAIAIQdBACEBAkAgACgCPCAGaiISKAIAIgYgAygCACIMTg0AIAAoAgwhCCAAKAIoIQ0gACgCJCEOIAAoAlwhDyAFKAIAIgNBACADQQBKGyEDIAAoAhgiEEEBTgRAIAAoAkwhEwNAIAEgA0YEQCADIQEMAwsgAiAGQQJ0aiEAIBMgByAQbEECdGohCkEAIQVEAAAAAAAAAAAhFEQAAAAAAAAAACEVRAAAAAAAAAAAIRZEAAAAAAAAAAAhFwNAIBcgCiAFQQJ0IglqKgIAIAAgCWoqAgCUu6AhFyAUIAogCUEMciILaioCACAAIAtqKgIAlLugIRQgFSAKIAlBCHIiC2oqAgAgACALaioCAJS7oCEVIBYgCiAJQQRyIglqKgIAIAAgCWoqAgCUu6AhFiAFQQRqIgUgEEgNAAsgBCABIA9sQQJ0aiAXIBagIBWgIBSgtjgCACAHIA1qIgBBACAIIAAgCEkbayEHIAFBAWohASAGIA5qIAAgCE9qIgYgDEgNAAsMAQsDQCABIANGBEAgAyEBDAILIAQgASAPbEECdGpBADYCACAHIA1qIgBBACAIIAAgCEkbayEHIAFBAWohASAGIA5qIAAgCE9qIgYgDEgNAAsLIBIgBjYCACARIAc2AgAgAQv+AwECfyACQYAETwRAIAAgASACEAAaDwsgACACaiEDAkAgACABc0EDcUUEQAJAIAJBAUgEQCAAIQIMAQsgAEEDcUUEQCAAIQIMAQsgACECA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA08NASACQQNxDQALCwJAIANBfHEiAEHAAEkNACACIABBQGoiBEsNAANAIAIgASgCADYCACACIAEoAgQ2AgQgAiABKAIINgIIIAIgASgCDDYCDCACIAEoAhA2AhAgAiABKAIUNgIUIAIgASgCGDYCGCACIAEoAhw2AhwgAiABKAIgNgIgIAIgASgCJDYCJCACIAEoAig2AiggAiABKAIsNgIsIAIgASgCMDYCMCACIAEoAjQ2AjQgAiABKAI4NgI4IAIgASgCPDYCPCABQUBrIQEgAkFAayICIARNDQALCyACIABPDQEDQCACIAEoAgA2AgAgAUEEaiEBIAJBBGoiAiAASQ0ACwwBCyADQQRJBEAgACECDAELIANBfGoiBCAASQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAiABLQABOgABIAIgAS0AAjoAAiACIAEtAAM6AAMgAUEEaiEBIAJBBGoiAiAETQ0ACwsgAiADSQRAA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0cNAAsLC7kCAQR/AkAgAUUNACACRQ0AAkAgACgCACADRw0AIAAoAgQgBEcNACAAKAIIIAFHDQAgACgCDCACRg0BCyAAIAE2AgggACAENgIEIAAgAzYCACAAKAIMIQUgACACNgIMIAEhBCACIQMDQCAEIAMiBHAiAw0ACyAAIAIgBG4iAzYCDCAAIAEgBG42AggCQCAFRQ0AIAAoAhRFDQAgACgCQCEGQQAhBANAIAYgBEECdGoiASgCACICIAIgBW4iAiAFbGsiB0F/IANuIghLDQIgAiAISw0CIAIgA2wiAiADIAdsIAVuIgNBf3NLDQIgASACIANqIgI2AgAgAiAAKAIMIgJPBEAgASACQX9qNgIACyAEQQFqIgQgACgCFE8NASAAKAIMIQMMAAALAAsgACgCNEUEQA8LIAAQChoLC6sHAQl/IAAoAgQiB0EDcSECIAAgB0F4cSIGaiEEAkBBhC0oAgAiBSAASw0AIAJBAUYNAAsCQCACRQRAQQAhAiABQYACSQ0BIAYgAUEEak8EQCAAIQIgBiABa0HUMCgCAEEBdE0NAgtBAA8LAkAgBiABTwRAIAYgAWsiAkEQSQ0BIAAgB0EBcSABckECcjYCBCAAIAFqIgEgAkEDcjYCBCAEIAQoAgRBAXI2AgQgASACEAsMAQtBACECIARBjC0oAgBGBEBBgC0oAgAgBmoiBSABTQ0CIAAgB0EBcSABckECcjYCBCAAIAFqIgIgBSABayIBQQFyNgIEQYAtIAE2AgBBjC0gAjYCAAwBCyAEQYgtKAIARgRAQfwsKAIAIAZqIgUgAUkNAgJAIAUgAWsiAkEQTwRAIAAgB0EBcSABckECcjYCBCAAIAFqIgEgAkEBcjYCBCAAIAVqIgUgAjYCACAFIAUoAgRBfnE2AgQMAQsgACAHQQFxIAVyQQJyNgIEIAAgBWoiASABKAIEQQFyNgIEQQAhAkEAIQELQYgtIAE2AgBB/CwgAjYCAAwBCyAEKAIEIgNBAnENASADQXhxIAZqIgkgAUkNASAJIAFrIQoCQCADQf8BTQRAIAQoAggiBiADQQN2IgVBA3RBnC1qRxogBiAEKAIMIghGBEBB9CxB9CwoAgBBfiAFd3E2AgAMAgsgBiAINgIMIAggBjYCCAwBCyAEKAIYIQgCQCAEIAQoAgwiA0cEQCAFIAQoAggiAk0EQCACKAIMGgsgAiADNgIMIAMgAjYCCAwBCwJAIARBFGoiAigCACIGDQAgBEEQaiICKAIAIgYNAEEAIQMMAQsDQCACIQUgBiIDQRRqIgIoAgAiBg0AIANBEGohAiADKAIQIgYNAAsgBUEANgIACyAIRQ0AAkAgBCAEKAIcIgVBAnRBpC9qIgIoAgBGBEAgAiADNgIAIAMNAUH4LEH4LCgCAEF+IAV3cTYCAAwCCyAIQRBBFCAIKAIQIARGG2ogAzYCACADRQ0BCyADIAg2AhggBCgCECICBEAgAyACNgIQIAIgAzYCGAsgBCgCFCICRQ0AIAMgAjYCFCACIAM2AhgLIApBD00EQCAAIAdBAXEgCXJBAnI2AgQgACAJaiIBIAEoAgRBAXI2AgQMAQsgACAHQQFxIAFyQQJyNgIEIAAgAWoiAiAKQQNyNgIEIAAgCWoiASABKAIEQQFyNgIEIAIgChALCyAAIQILIAILxQEBAn8jAEEQayIBJAACQCAAvUIgiKdB/////wdxIgJB+8Ok/wNNBEAgAkGAgMDyA0kNASAARAAAAAAAAAAAQQAQCCEADAELIAJBgIDA/wdPBEAgACAAoSEADAELAkACQAJAAkAgACABEBhBA3EOAwABAgMLIAErAwAgASsDCEEBEAghAAwDCyABKwMAIAErAwgQDSEADAILIAErAwAgASsDCEEBEAiaIQAMAQsgASsDACABKwMIEA2aIQALIAFBEGokACAAC9cCAQJ/AkACQAJAIABFDQAgAUUNACACRQ0AIAVBC0kNAQsgBkUNASAGQQM2AgBBAA8LQeAAEAYiB0UEQEEAIQcgBkUNASAGQQE2AgBBAA8LIAdCADcCACAHQYCAgPwDNgIsIAdBfzYCECAHQoGAgIAQNwJYIAcgADYCFCAHQaABNgIgIAdCADcCCCAHIABBAnQiABAGIgg2AjwCQCAIRQ0AIAcgABAGIgg2AkQgCEUNACAHIAAQBiIANgJAIABFDQAgByAFNgIQIAcgASACIAMgBBAUAkAgBxAKIgBFBEAgB0EBNgI0DAELIAcoAkgQAiAHKAJMEAIgBygCPBACIAcoAkQQAiAHKAJAEAIgBxACQQAhBwsgBkUNASAGIAA2AgAgBw8LIAYEQCAGQQE2AgALIAcoAkwQAiAHKAI8EAIgBygCRBACIAcoAkAQAiAHEAJBACEHCyAHC8sJAwV/AX4EfCMAQTBrIgQkAAJAAkACQCAAvSIHQiCIpyICQf////8HcSIDQfrUvYAETQRAIAJB//8/cUH7wyRGDQEgA0H8souABE0EQCAHQgBZBEAgASAARAAAQFT7Ifm/oCIARDFjYhphtNC9oCIIOQMAIAEgACAIoUQxY2IaYbTQvaA5AwhBASECDAULIAEgAEQAAEBU+yH5P6AiAEQxY2IaYbTQPaAiCDkDACABIAAgCKFEMWNiGmG00D2gOQMIQX8hAgwECyAHQgBZBEAgASAARAAAQFT7IQnAoCIARDFjYhphtOC9oCIIOQMAIAEgACAIoUQxY2IaYbTgvaA5AwhBAiECDAQLIAEgAEQAAEBU+yEJQKAiAEQxY2IaYbTgPaAiCDkDACABIAAgCKFEMWNiGmG04D2gOQMIQX4hAgwDCyADQbuM8YAETQRAIANBvPvXgARNBEAgA0H8ssuABEYNAiAHQgBZBEAgASAARAAAMH982RLAoCIARMqUk6eRDum9oCIIOQMAIAEgACAIoUTKlJOnkQ7pvaA5AwhBAyECDAULIAEgAEQAADB/fNkSQKAiAETKlJOnkQ7pPaAiCDkDACABIAAgCKFEypSTp5EO6T2gOQMIQX0hAgwECyADQfvD5IAERg0BIAdCAFkEQCABIABEAABAVPshGcCgIgBEMWNiGmG08L2gIgg5AwAgASAAIAihRDFjYhphtPC9oDkDCEEEIQIMBAsgASAARAAAQFT7IRlAoCIARDFjYhphtPA9oCIIOQMAIAEgACAIoUQxY2IaYbTwPaA5AwhBfCECDAMLIANB+sPkiQRLDQELIAEgACAARIPIyW0wX+Q/okQAAAAAAAA4Q6BEAAAAAAAAOMOgIglEAABAVPsh+b+ioCIIIAlEMWNiGmG00D2iIguhIgA5AwAgA0EUdiIFIAC9QjSIp0H/D3FrQRFIIQMCfyAJmUQAAAAAAADgQWMEQCAJqgwBC0GAgICAeAshAgJAIAMNACABIAggCUQAAGAaYbTQPaIiAKEiCiAJRHNwAy6KGaM7oiAIIAqhIAChoSILoSIAOQMAIAUgAL1CNIinQf8PcWtBMkgEQCAKIQgMAQsgASAKIAlEAAAALooZozuiIgChIgggCUTBSSAlmoN7OaIgCiAIoSAAoaEiC6EiADkDAAsgASAIIAChIAuhOQMIDAELIANBgIDA/wdPBEAgASAAIAChIgA5AwAgASAAOQMIQQAhAgwBCyAHQv////////8Hg0KAgICAgICAsMEAhL8hAEEAIQJBASEFA0AgBEEQaiACQQN0agJ/IACZRAAAAAAAAOBBYwRAIACqDAELQYCAgIB4C7ciCDkDACAAIAihRAAAAAAAAHBBoiEAQQEhAiAFQQFxIQZBACEFIAYNAAsgBCAAOQMgAkAgAEQAAAAAAAAAAGIEQEECIQIMAQtBASEFA0AgBSICQX9qIQUgBEEQaiACQQN0aisDAEQAAAAAAAAAAGENAAsLIARBEGogBCADQRR2Qep3aiACQQFqEBkhAiAEKwMAIQAgB0J/VwRAIAEgAJo5AwAgASAEKwMImjkDCEEAIAJrIQIMAQsgASAAOQMAIAEgBCkDCDcDCAsgBEEwaiQAIAILtA4CEH8CfCMAQbAEayIGJAAgAiACQX1qQRhtIgRBACAEQQBKGyINQWhsaiEIQdQWKAIAIgkgA0F/aiIHakEATgRAIAMgCWohBCANIAdrIQIDQCAGQcACaiAFQQN0aiACQQBIBHxEAAAAAAAAAAAFIAJBAnRB4BZqKAIAtws5AwAgAkEBaiECIAVBAWoiBSAERw0ACwsgCEFoaiEKQQAhBCAJQQAgCUEAShshBSADQQFIIQsDQAJAIAsEQEQAAAAAAAAAACEUDAELIAQgB2ohDEEAIQJEAAAAAAAAAAAhFANAIBQgACACQQN0aisDACAGQcACaiAMIAJrQQN0aisDAKKgIRQgAkEBaiICIANHDQALCyAGIARBA3RqIBQ5AwAgBCAFRiECIARBAWohBCACRQ0AC0EvIAhrIRBBMCAIayEOIAhBZ2ohESAJIQQCQANAIAYgBEEDdGorAwAhFEEAIQIgBCEFIARBAUgiB0UEQANAIAZB4ANqIAJBAnRqAn8gFAJ/IBREAAAAAAAAcD6iIhSZRAAAAAAAAOBBYwRAIBSqDAELQYCAgIB4C7ciFEQAAAAAAABwwaKgIhWZRAAAAAAAAOBBYwRAIBWqDAELQYCAgIB4CzYCACAGIAVBf2oiBUEDdGorAwAgFKAhFCACQQFqIgIgBEcNAAsLAn8gFCAKEAUiFCAURAAAAAAAAMA/opxEAAAAAAAAIMCioCIUmUQAAAAAAADgQWMEQCAUqgwBC0GAgICAeAshCyAUIAu3oSEUAkACQAJAAn8gCkEBSCISRQRAIARBAnQgBmoiAiACKALcAyICIAIgDnUiAiAOdGsiBTYC3AMgAiALaiELIAUgEHUMAQsgCg0BIARBAnQgBmooAtwDQRd1CyIMQQFIDQIMAQtBAiEMIBREAAAAAAAA4D9mQQFzRQ0AQQAhDAwBC0EAIQJBACEFIAdFBEADQCAGQeADaiACQQJ0aiITKAIAIQ9B////ByEHAn8CQCAFDQBBgICACCEHIA8NAEEADAELIBMgByAPazYCAEEBCyEFIAJBAWoiAiAERw0ACwsCQCASDQACQAJAIBEOAgABAgsgBEECdCAGaiICIAIoAtwDQf///wNxNgLcAwwBCyAEQQJ0IAZqIgIgAigC3ANB////AXE2AtwDCyALQQFqIQsgDEECRw0ARAAAAAAAAPA/IBShIRRBAiEMIAVFDQAgFEQAAAAAAADwPyAKEAWhIRQLIBREAAAAAAAAAABhBEBBACEFAkAgBCICIAlMDQADQCAGQeADaiACQX9qIgJBAnRqKAIAIAVyIQUgAiAJSg0ACyAFRQ0AIAohCANAIAhBaGohCCAGQeADaiAEQX9qIgRBAnRqKAIARQ0ACwwDC0EBIQIDQCACIgVBAWohAiAGQeADaiAJIAVrQQJ0aigCAEUNAAsgBCAFaiEFA0AgBkHAAmogAyAEaiIHQQN0aiAEQQFqIgQgDWpBAnRB4BZqKAIAtzkDAEEAIQJEAAAAAAAAAAAhFCADQQFOBEADQCAUIAAgAkEDdGorAwAgBkHAAmogByACa0EDdGorAwCioCEUIAJBAWoiAiADRw0ACwsgBiAEQQN0aiAUOQMAIAQgBUgNAAsgBSEEDAELCwJAIBRBACAKaxAFIhREAAAAAAAAcEFmQQFzRQRAIAZB4ANqIARBAnRqAn8gFAJ/IBREAAAAAAAAcD6iIhSZRAAAAAAAAOBBYwRAIBSqDAELQYCAgIB4CyICt0QAAAAAAABwwaKgIhSZRAAAAAAAAOBBYwRAIBSqDAELQYCAgIB4CzYCACAEQQFqIQQMAQsCfyAUmUQAAAAAAADgQWMEQCAUqgwBC0GAgICAeAshAiAKIQgLIAZB4ANqIARBAnRqIAI2AgALRAAAAAAAAPA/IAgQBSEUAkAgBEF/TA0AIAQhAgNAIAYgAkEDdGogFCAGQeADaiACQQJ0aigCALeiOQMAIBREAAAAAAAAcD6iIRQgAkEASiEAIAJBf2ohAiAADQALQQAhByAEQQBIDQAgCUEAIAlBAEobIQAgBCEFA0AgACAHIAAgB0kbIQMgBCAFayEIQQAhAkQAAAAAAAAAACEUA0AgFCACQQN0QbAsaisDACAGIAIgBWpBA3RqKwMAoqAhFCACIANHIQogAkEBaiECIAoNAAsgBkGgAWogCEEDdGogFDkDACAFQX9qIQUgBCAHRyECIAdBAWohByACDQALC0QAAAAAAAAAACEUIARBAE4EQCAEIQIDQCAUIAZBoAFqIAJBA3RqKwMAoCEUIAJBAEohACACQX9qIQIgAA0ACwsgASAUmiAUIAwbOQMAIAYrA6ABIBShIRRBASECIARBAU4EQANAIBQgBkGgAWogAkEDdGorAwCgIRQgAiAERyEAIAJBAWohAiAADQALCyABIBSaIBQgDBs5AwggBkGwBGokACALQQdxCxoAIABBBE0EQCAAQQJ0QbAWaigCAA8LQewICxYAIAEgACgCADYCACACIAAoAgQ2AgALzAEBBn8gACgCXCEIIAIoAgAhBiAEKAIAIQcgACAAKAIUIgU2AlwgACgCWCEJIAAgBTYCWAJAIAVFDQBBACEFIAFFBEADQCAEIAc2AgAgAiAGNgIAIAAgBUEAIAIgAyAFQQF0aiAEEA4gBUEBaiIFIAAoAhRJDQAMAgALAAsDQCAEIAc2AgAgAiAGNgIAIAAgBSABIAVBAXQiCmogAiADIApqIAQQDiAFQQFqIgUgACgCFEkNAAsLIAAgCDYCXCAAIAk2AlggACgCVEEFRgspACAAKAJIEAIgACgCTBACIAAoAjwQAiAAKAJEEAIgACgCQBACIAAQAgvDAQEHfyABQQJ0IgYgACgCQGoiBygCACECQQAhAQJAIAAoAjwgBmoiCCgCACIGIAMoAgAiCU4NACAAKAIMIQMgACgCKCEKIAAoAiQhCyAAKAJcIQwgBSgCACIAQQAgAEEAShshAANAIAAgAUYEQCAAIQEMAgsgBCABIAxsQQJ0akEANgIAIAIgCmoiBUEAIAMgBSADSRtrIQIgAUEBaiEBIAYgC2ogBSADT2oiBiAJSA0ACwsgCCAGNgIAIAcgAjYCACABCxIAIAAgASACIAEgAiADIAQQFwsDAAELC9wkBgBBgAgLpgFTdWNjZXNzLgBNZW1vcnkgYWxsb2NhdGlvbiBmYWlsZWQuAEJhZCByZXNhbXBsZXIgc3RhdGUuAEludmFsaWQgYXJndW1lbnQuAElucHV0IGFuZCBvdXRwdXQgYnVmZmVycyBvdmVybGFwLgBVbmtub3duIGVycm9yLiBCYWQgZXJyb3IgY29kZSBvciBzdHJhbmdlIHZlcnNpb24gbWlzbWF0Y2guAEGwCQvQCAgAAAAEAAAA4XpUP/YoXD+MBQAAEAAAAAQAAACamVk/rkdhP4wFAAAgAAAABAAAAMHKYT/D9Wg/jAUAADAAAAAIAAAAuB5lP4PAaj+UBQAAQAAAAAgAAACoxms/16NwP5QFAABQAAAAEAAAADEIbD/Xo3A/nAUAAGAAAAAQAAAA16NwP4XrcT+cBQAAgAAAABAAAAAzM3M/MzNzP5wFAACgAAAAEAAAAI/CdT+PwnU/nAUAAMAAAAAgAAAA2c53P9nOdz+kBQAAAAEAACAAAACamXk/mpl5P6QFAACwBQAAIAAAANAGAAAgAAAA8AcAACAAAAAQCQAAQAAAAAAAAAAlkeC6IOrvPwAAAAAAAPA/JZHguiDq7z/eSyvPzajvP1of/5rmPO8/Vc8Xtdqn7j++oGT2ouvtP9eQbjq4Cu0/i+jPZQcI7D+13m+04+bqP1gAdBT3quk/InJVNDFY6D9Qxa5ptfLmP1jktgHIfuU/lEUnbLsA5D9HK0pL3XziP6mj42pk9+A/qqmXpb7o3j8WxHqCSO/bP0tmzI+FCdk/P+nhV+491j/Cam59P5LTP6C+p2ppC9E/K3JfOQhbzT8nmWIvkPfIP6EHyq8X8cQ/ymKsgIxKwT8ixb5sVAq8P2GFAIUfQbY/j95wH7k1sT9DhMmeTsOpPyF7e98ReKI/80co6LznmD9Z7Q7n6XWOPyECDqFKzX4/AAAAAAAAAADBU0zOHuLvPwAAAAAAAPA/wVNMzh7i7z/PQsiaDYnvPwxt55h/9u4/iBIteTwt7j+aTfS3DDHtP7WwwLqeBuw/zJkOGWaz6j/ceSzHdT3pP1GrIrtWq+c/lTbJTdwD5j91q+ek903kP3cAm96LkOI/E4HqH0TS4D/GAMPR2TLeP1M+BFWj19o/2QhhwT+d1z+oagbhn4zUP24kfRgprdE/Wu959kMJzj8bAGArVy7JP1GWaxuQzsQ/i+xardnrwD/p1ilefgq7P98X+tRvLrU/Bg2BTAA4sD/KvUTl9C+oP6YV+O2YeKE/S/VT0nlDmD+Uz5/0jQGQPwBuNz3/qIM/3mkZRs2ZdT/ghYzL4ShjP/yp8dJNYkA/AAAAAAAAAAC5pqOQItrvPwAAAAAAAPA/uaajkCLa7z+FCxbae2nvP0RGzXjXsO4/JlPDhsC07T8z2i5dVnvsP6nOFzkTDOs/qepxIYdv6T9y5pEeCq/nP9bRacRp1OU/wKekFJXp4z85oADlSvjhP+qDG9/NCeA/VWrVMkJN3D9DXd77n6zYPw9a9sGFPtU/HwXbykMN0j+gZzcjGEHOP4yLevPh+sg/8K5IhvtMxD904ycfzDfAP+5his0ib7k/O05VygCKsz/oYS7K6FetPyQzzSoieaU/u2lt+cyCnj8iLHRvj++UPz4R3RbZjIs/XcJfm6YygT9QCLLYBQd0P4HIKr4EG2U/3O6rk6/bUj8bypqibUY3PwBBkBILmATIUQzShPTvPwAAAAAAAPA/yFEM0oT07z/2lQfpKdLvP9rTxPEyme8/1P0Q2Q9K7z9+n7tuW+XuP2HBP53Za+4/HdfxJXXe7T9qf2/sPD7tP8nqNcFgjOw/dyRFAS7K6z8evH7aC/nqPzrQvzR3Guo/9SUjgP4v6T/yQEODPTvoPw4HU97YPec/9/Kvo3k55j9MyMUgyS/lP864eJFsIuQ//5laGQET4z8vnDHtFwPiP2PZBs0y9OA/TVqGcoHP3z/Nj2T7Nb7dPxXGN5AFt9s/4AetqD282T9gMwqT88/XP/Md/MQB9NU/SoVn+AUq1D/nzTwUYHPSP43KNDcy0dA/2NF68MGIzj+vJ3gSKpvLP8hIk9552sg/tc9bIx9Hxj89V0IUH+HDP7XNAUAdqME/TbqQu8Y2vz8uDCY41HO7P2aSBQrEBLg/gFQWx3nmtD9iSE4mbhWyP6QVhJeFG68/7LLrIKeWqj+XqEFFk5OmPz54L+9YCaM/1eesR8jdnz9sz00XOXaaP/Tx2Oj/yZU/Dwu1pnnHkT9VF2z6HruMP/6ksSiy94Y/PLeW6n4lgj+l+7XMVE58P2cfVHefwnU/BcR/FTt1cD90f7OcnW9oP9Pw8wCSwGE/91Lb+qcjWT8/wazteUBRP/FCAJH6wkY/e7LNUz6APD8mUZIi8I8wP8dUbmB6FCE/fYl/NyCrCz/xaOOItfjkPgBBsRYLEQQAAAkEAAAjBAAAOAQAAEoEAEHQFgvXFQMAAAAEAAAABAAAAAYAAACD+aIARE5uAPwpFQDRVycA3TT1AGLbwAA8mZUAQZBDAGNR/gC73qsAt2HFADpuJADSTUIASQbgAAnqLgAcktEA6x3+ACmxHADoPqcA9TWCAES7LgCc6YQAtCZwAEF+XwDWkTkAU4M5AJz0OQCLX4QAKPm9APgfOwDe/5cAD5gFABEv7wAKWosAbR9tAM9+NgAJyycARk+3AJ5mPwAt6l8Auid1AOXrxwA9e/EA9zkHAJJSigD7a+oAH7FfAAhdjQAwA1YAe/xGAPCrawAgvM8ANvSaAOOpHQBeYZEACBvmAIWZZQCgFF8AjUBoAIDY/wAnc00ABgYxAMpWFQDJqHMAe+JgAGuMwAAZxEcAzWfDAAno3ABZgyoAi3bEAKYclgBEr90AGVfRAKU+BQAFB/8AM34/AMIy6ACYT94Au30yACY9wwAea+8An/heADUfOgB/8soA8YcdAHyQIQBqJHwA1W76ADAtdwAVO0MAtRTGAMMZnQCtxMIALE1BAAwAXQCGfUYA43EtAJvGmgAzYgAAtNJ8ALSnlwA3VdUA1z72AKMQGABNdvwAZJ0qAHDXqwBjfPgAerBXABcV5wDASVYAO9bZAKeEOAAkI8sA1op3AFpUIwAAH7kA8QobABnO3wCfMf8AZh5qAJlXYQCs+0cAfn/YACJltwAy6IkA5r9gAO/EzQBsNgkAXT/UABbe1wBYO94A3puSANIiKAAohugA4lhNAMbKMgAI4xYA4H3LABfAUADzHacAGOBbAC4TNACDEmIAg0gBAPWOWwCtsH8AHunyAEhKQwAQZ9MAqt3YAK5fQgBqYc4ACiikANOZtAAGpvIAXHd/AKPCgwBhPIgAinN4AK+MWgBv170ALaZjAPS/ywCNge8AJsFnAFXKRQDK2TYAKKjSAMJhjQASyXcABCYUABJGmwDEWcQAyMVEAE2ykQAAF/MA1EOtAClJ5QD91RAAAL78AB6UzABwzu4AEz71AOzxgACz58MAx/goAJMFlADBcT4ALgmzAAtF8wCIEpwAqyB7AC61nwBHksIAezIvAAxVbQByp5AAa+cfADHLlgB5FkoAQXniAPTfiQDolJcA4uaEAJkxlwCI7WsAX182ALv9DgBImrQAZ6RsAHFyQgCNXTIAnxW4ALzlCQCNMSUA93Q5ADAFHAANDAEASwhoACzuWABHqpAAdOcCAL3WJAD3faYAbkhyAJ8W7wCOlKYAtJH2ANFTUQDPCvIAIJgzAPVLfgCyY2gA3T5fAEBdAwCFiX8AVVIpADdkwABt2BAAMkgyAFtMdQBOcdQARVRuAAsJwQAq9WkAFGbVACcHnQBdBFAAtDvbAOp2xQCH+RcASWt9AB0nugCWaSkAxsysAK0UVACQ4moAiNmJACxyUAAEpL4AdweUAPMwcAAA/CcA6nGoAGbCSQBk4D0Al92DAKM/lwBDlP0ADYaMADFB3gCSOZ0A3XCMABe35wAI3zsAFTcrAFyAoABagJMAEBGSAA/o2ABsgK8A2/9LADiQDwBZGHYAYqUVAGHLuwDHibkAEEC9ANLyBABJdScA67b2ANsiuwAKFKoAiSYvAGSDdgAJOzMADpQaAFE6qgAdo8IAr+2uAFwmEgBtwk0ALXqcAMBWlwADP4MACfD2ACtAjABtMZkAObQHAAwgFQDYw1sA9ZLEAMatSwBOyqUApzfNAOapNgCrkpQA3UJoABlj3gB2jO8AaItSAPzbNwCuoasA3xUxAACuoQAM+9oAZE1mAO0FtwApZTAAV1a/AEf/OgBq+bkAdb7zACiT3wCrgDAAZoz2AATLFQD6IgYA2eQdAD2zpABXG48ANs0JAE5C6QATvqQAMyO1APCqGgBPZagA0sGlAAs/DwBbeM0AI/l2AHuLBACJF3IAxqZTAG9u4gDv6wAAm0pYAMTatwCqZroAds/PANECHQCx8S0AjJnBAMOtdwCGSNoA912gAMaA9ACs8C8A3eyaAD9cvADQ3m0AkMcfACrbtgCjJToAAK+aAK1TkwC2VwQAKS20AEuAfgDaB6cAdqoOAHtZoQAWEioA3LctAPrl/QCJ2/4Aib79AOR2bAAGqfwAPoBwAIVuFQD9h/8AKD4HAGFnMwAqGIYATb3qALPnrwCPbW4AlWc5ADG/WwCE10gAMN8WAMctQwAlYTUAyXDOADDLuAC/bP0ApACiAAVs5ABa3aAAIW9HAGIS0gC5XIQAcGFJAGtW4ACZUgEAUFU3AB7VtwAz8cQAE25fAF0w5ACFLqkAHbLDAKEyNgAIt6QA6rHUABb3IQCPaeQAJ/93AAwDgACNQC0AT82gACClmQCzotMAL10KALT5QgAR2ssAfb7QAJvbwQCrF70AyqKBAAhqXAAuVRcAJwBVAH8U8ADhB4YAFAtkAJZBjQCHvt4A2v0qAGsltgB7iTQABfP+ALm/ngBoak8ASiqoAE/EWgAt+LwA11qYAPTHlQANTY0AIDqmAKRXXwAUP7EAgDiVAMwgAQBx3YYAyd62AL9g9QBNZREAAQdrAIywrACywNAAUVVIAB77DgCVcsMAowY7AMBANQAG3HsA4EXMAE4p+gDWysgA6PNBAHxk3gCbZNgA2b4xAKSXwwB3WNQAaePFAPDaEwC6OjwARhhGAFV1XwDSvfUAbpLGAKwuXQAORO0AHD5CAGHEhwAp/ekA59bzACJ8ygBvkTUACODFAP/XjQBuauIAsP3GAJMIwQB8XXQAa62yAM1unQA+cnsAxhFqAPfPqQApc98Atcm6ALcAUQDisg0AdLokAOV9YAB02IoADRUsAIEYDAB+ZpQAASkWAJ96dgD9/b4AVkXvANl+NgDs2RMAi7q5AMSX/AAxqCcA8W7DAJTFNgDYqFYAtKi1AM/MDgASiS0Ab1c0ACxWiQCZzuMA1iC5AGteqgA+KpwAEV/MAP0LSgDh9PsAjjttAOKGLADp1IQA/LSpAO/u0QAuNckALzlhADghRAAb2cgAgfwKAPtKagAvHNgAU7SEAE6ZjABUIswAKlXcAMDG1gALGZYAGnC4AGmVZAAmWmAAP1LuAH8RDwD0tREA/Mv1ADS8LQA0vO4A6F3MAN1eYABnjpsAkjPvAMkXuABhWJsA4Ve8AFGDxgDYPhAA3XFIAC0c3QCvGKEAISxGAFnz1wDZepgAnlTAAE+G+gBWBvwA5XmuAIkiNgA4rSIAZ5PcAFXoqgCCJjgAyuebAFENpACZM7EAqdcOAGkFSABlsvAAf4inAIhMlwD50TYAIZKzAHuCSgCYzyEAQJ/cANxHVQDhdDoAZ+tCAP6d3wBe1F8Ae2ekALqsegBV9qIAK4gjAEG6VQBZbggAISqGADlHgwCJ4+YA5Z7UAEn7QAD/VukAHA/KAMVZigCU+isA08HFAA/FzwDbWq4AR8WGAIVDYgAhhjsALHmUABBhhwAqTHsAgCwaAEO/EgCIJpAAeDyJAKjE5ADl23sAxDrCACb06gD3Z4oADZK/AGWjKwA9k7EAvXwLAKRR3AAn3WMAaeHdAJqUGQCoKZUAaM4oAAnttABEnyAATpjKAHCCYwB+fCMAD7kyAKf1jgAUVucAIfEIALWdKgBvfk0ApRlRALX5qwCC39YAlt1hABY2AgDEOp8Ag6KhAHLtbQA5jXoAgripAGsyXABGJ1sAADTtANIAdwD89FUAAVlNAOBxgABBsywLPUD7Ifk/AAAAAC1EdD4AAACAmEb4PAAAAGBRzHg7AAAAgIMb8DkAAABAICV6OAAAAIAiguM2AAAAAB3zaTU=";
        if (!isDataURI(wasmBinaryFile)) {
            wasmBinaryFile = locateFile(wasmBinaryFile)
        }

        function getBinary() {
            try {
                if (wasmBinary) {
                    return new Uint8Array(wasmBinary)
                }
                var binary = tryParseAsDataURI(wasmBinaryFile);
                if (binary) {
                    return binary
                }
                if (readBinary) {
                    return readBinary(wasmBinaryFile)
                } else {
                    throw "both async and sync fetching of the wasm failed"
                }
            } catch (err) {
                abort(err)
            }
        }

        function getBinaryPromise() {
            if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
                return fetch(wasmBinaryFile, {
                    credentials: "same-origin"
                }).then(function(response) {
                    if (!response["ok"]) {
                        throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
                    }
                    return response["arrayBuffer"]()
                }).catch(function() {
                    return getBinary()
                })
            }
            return new Promise(function(resolve, reject) {
                resolve(getBinary())
            })
        }

        function createWasm() {
            var info = {
                "a": asmLibraryArg
            };

            function receiveInstance(instance, module) {
                var exports = instance.exports;
                Module["asm"] = exports;
                removeRunDependency("wasm-instantiate")
            }
            addRunDependency("wasm-instantiate");

            function receiveInstantiatedSource(output) {
                receiveInstance(output["instance"])
            }

            function instantiateArrayBuffer(receiver) {
                return getBinaryPromise().then(function(binary) {
                    return WebAssembly.instantiate(binary, info)
                }).then(receiver, function(reason) {
                    err("failed to asynchronously prepare wasm: " + reason);
                    abort(reason)
                })
            }

            function instantiateAsync() {
                if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
                    fetch(wasmBinaryFile, {
                        credentials: "same-origin"
                    }).then(function(response) {
                        var result = WebAssembly.instantiateStreaming(response, info);
                        return result.then(receiveInstantiatedSource, function(reason) {
                            err("wasm streaming compile failed: " + reason);
                            err("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(receiveInstantiatedSource)
                        })
                    })
                } else {
                    return instantiateArrayBuffer(receiveInstantiatedSource)
                }
            }
            if (Module["instantiateWasm"]) {
                try {
                    var exports = Module["instantiateWasm"](info, receiveInstance);
                    return exports
                } catch (e) {
                    err("Module.instantiateWasm callback failed with error: " + e);
                    return false
                }
            }
            instantiateAsync();
            return {}
        }
        var tempDouble;
        var tempI64;
        __ATINIT__.push({
            func: function() {
                ___wasm_call_ctors()
            }
        });

        function _emscripten_memcpy_big(dest, src, num) {
            HEAPU8.copyWithin(dest, src, src + num)
        }

        function _emscripten_get_heap_size() {
            return HEAPU8.length
        }

        function emscripten_realloc_buffer(size) {
            try {
                wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
                updateGlobalBufferAndViews(wasmMemory.buffer);
                return 1
            } catch (e) {}
        }

        function _emscripten_resize_heap(requestedSize) {
            requestedSize = requestedSize >>> 0;
            var oldSize = _emscripten_get_heap_size();
            var PAGE_MULTIPLE = 65536;
            var maxHeapSize = 2147483648;
            if (requestedSize > maxHeapSize) {
                return false
            }
            var minHeapSize = 16777216;
            for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
                var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
                overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
                var newSize = Math.min(maxHeapSize, alignUp(Math.max(minHeapSize, requestedSize, overGrownHeapSize), PAGE_MULTIPLE));
                var replacement = emscripten_realloc_buffer(newSize);
                if (replacement) {
                    return true
                }
            }
            return false
        }
        var ASSERTIONS = false;

        function intArrayToString(array) {
            var ret = [];
            for (var i = 0; i < array.length; i++) {
                var chr = array[i];
                if (chr > 255) {
                    if (ASSERTIONS) {
                        assert(false, "Character code " + chr + " (" + String.fromCharCode(chr) + ")  at offset " + i + " not in 0x00-0xFF.")
                    }
                    chr &= 255
                }
                ret.push(String.fromCharCode(chr))
            }
            return ret.join("")
        }
        var decodeBase64 = typeof atob === "function" ? atob : function(input) {
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;
            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
            do {
                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));
                chr1 = enc1 << 2 | enc2 >> 4;
                chr2 = (enc2 & 15) << 4 | enc3 >> 2;
                chr3 = (enc3 & 3) << 6 | enc4;
                output = output + String.fromCharCode(chr1);
                if (enc3 !== 64) {
                    output = output + String.fromCharCode(chr2)
                }
                if (enc4 !== 64) {
                    output = output + String.fromCharCode(chr3)
                }
            } while (i < input.length);
            return output
        };

        function intArrayFromBase64(s) {
            if (typeof ENVIRONMENT_IS_NODE === "boolean" && ENVIRONMENT_IS_NODE) {
                var buf;
                try {
                    buf = Buffer.from(s, "base64")
                } catch (_) {
                    buf = new Buffer(s, "base64")
                }
                return new Uint8Array(buf["buffer"], buf["byteOffset"], buf["byteLength"])
            }
            try {
                var decoded = decodeBase64(s);
                var bytes = new Uint8Array(decoded.length);
                for (var i = 0; i < decoded.length; ++i) {
                    bytes[i] = decoded.charCodeAt(i)
                }
                return bytes
            } catch (_) {
                throw new Error("Converting base64 string to bytes failed.")
            }
        }

        function tryParseAsDataURI(filename) {
            if (!isDataURI(filename)) {
                return
            }
            return intArrayFromBase64(filename.slice(dataURIPrefix.length))
        }
        var asmLibraryArg = {
            "a": _emscripten_memcpy_big,
            "b": _emscripten_resize_heap,
            "memory": wasmMemory,
            "table": wasmTable
        };
        var asm = createWasm();
        var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
            return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["c"]).apply(null, arguments)
        };
        var _speex_resampler_init = Module["_speex_resampler_init"] = function() {
            return (_speex_resampler_init = Module["_speex_resampler_init"] = Module["asm"]["d"]).apply(null, arguments)
        };
        var _free = Module["_free"] = function() {
            return (_free = Module["_free"] = Module["asm"]["e"]).apply(null, arguments)
        };
        var _speex_resampler_destroy = Module["_speex_resampler_destroy"] = function() {
            return (_speex_resampler_destroy = Module["_speex_resampler_destroy"] = Module["asm"]["f"]).apply(null, arguments)
        };
        var _speex_resampler_process_interleaved_int = Module["_speex_resampler_process_interleaved_int"] = function() {
            return (_speex_resampler_process_interleaved_int = Module["_speex_resampler_process_interleaved_int"] = Module["asm"]["g"]).apply(null, arguments)
        };
        var _speex_resampler_get_rate = Module["_speex_resampler_get_rate"] = function() {
            return (_speex_resampler_get_rate = Module["_speex_resampler_get_rate"] = Module["asm"]["h"]).apply(null, arguments)
        };
        var _speex_resampler_strerror = Module["_speex_resampler_strerror"] = function() {
            return (_speex_resampler_strerror = Module["_speex_resampler_strerror"] = Module["asm"]["i"]).apply(null, arguments)
        };
        var _malloc = Module["_malloc"] = function() {
            return (_malloc = Module["_malloc"] = Module["asm"]["j"]).apply(null, arguments)
        };
        Module["setValue"] = setValue;
        Module["getValue"] = getValue;
        Module["AsciiToString"] = AsciiToString;
        var calledRun;

        function ExitStatus(status) {
            this.name = "ExitStatus";
            this.message = "Program terminated with exit(" + status + ")";
            this.status = status
        }
        dependenciesFulfilled = function runCaller() {
            if (!calledRun) run();
            if (!calledRun) dependenciesFulfilled = runCaller
        };

        function run(args) {
            args = args || arguments_;
            if (runDependencies > 0) {
                return
            }
            preRun();
            if (runDependencies > 0) return;

            function doRun() {
                if (calledRun) return;
                calledRun = true;
                Module["calledRun"] = true;
                if (ABORT) return;
                initRuntime();
                preMain();
                readyPromiseResolve(Module);
                if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
                postRun()
            }
            if (Module["setStatus"]) {
                Module["setStatus"]("Running...");
                setTimeout(function() {
                    setTimeout(function() {
                        Module["setStatus"]("")
                    }, 1);
                    doRun()
                }, 1)
            } else {
                doRun()
            }
        }
        Module["run"] = run;
        if (Module["preInit"]) {
            if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
            while (Module["preInit"].length > 0) {
                Module["preInit"].pop()()
            }
        }
        noExitRuntime = true;
        run();
        return Speex.ready
    });
})();
