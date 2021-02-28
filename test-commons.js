//NOTE: load this after DOM or with ready-state check

function debugInfo(source, data){
	console.log(source, data);
}

function showLogMessage(msg, data){
	var info = (typeof data == "object")? (data.name && data.message? (data.name + " - " + data.message) : JSON.stringify(data)) : data;
	logElement.textContent += "\n" + (new Date().toLocaleTimeString()) + " - " + (msg + " - " + info);
	logElement.scrollTo(0, logElement.scrollHeight);
}

function vibrate(pattern){
	if (typeof window.navigator.vibrate == "function"){
		window.navigator.vibrate(pattern);
	}
}

function addWaveToPage(wavAudio, targetEle){
	var audioEle = document.createElement("audio");
	audioEle.src = window.URL.createObjectURL((wavAudio.constructor.name == "Blob")? wavAudio : (new Blob([wavAudio], { type: "audio/wav" })));
	audioEle.setAttribute("controls", "controls");
	var audioBox = document.createElement("div");
	audioBox.appendChild(audioEle);
	if (!targetEle) targetEle = document.getElementById("mainView") || document.body;
	targetEle.appendChild(audioBox);
}

uPlot.lazy.colorPalette[0] = "#ceff1a";		//default color for first line in graph
var fixedPlots = {
	1: {
		graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart1'), 150, {
			rememberMax: true
		})), 
		use: (document.getElementById("usePlot1")? document.getElementById("usePlot1").checked : true)
	},
	2: {
		graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart2'), 150, {
			rememberMax: true
		}, {
			showAxisX: false
		})),
		use: (document.getElementById("usePlot2")? document.getElementById("usePlot2").checked : true)
	},
	3: {
		graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart3'), 150, {
			//rememberMax: true
		}, {
			showAxisX: false
			//yRange: [-0.1, 1.1]
		})),
		use: (document.getElementById("usePlot3")? document.getElementById("usePlot3").checked : true)
	},
	4: {
		graph: (new uPlot.lazy.AutoSeries(document.getElementById('chart4'), 150, {
			rememberMax: true
		}, {
			fill: ["#ceff1a1a"]
		})), 
		use: (document.getElementById("usePlot4")? document.getElementById("usePlot4").checked : true)
	},
}
function usePlot(index, ele){
	var p = fixedPlots[index];
	if (p){
		p.use = ele.checked;
		var container = document.getElementById("chart" + index);
		if (container) container.style.display = p.use? "" : "none";
	}
}
function useHeatmap(index, ele){
	useHeatmaps[index] = ele.checked;
	if (heatmaps[index]) heatmaps[index].resetMax();
}
var useHeatmaps = {};
var heatmaps = {
	1: new uPlot.lazy.Heatmap(document.getElementById('heatmap1'), {
		dataPixelWidth: 4,
		dataPixelHeight: 4,
		colorIndex: 4,
		maxDataPoints: 150
	})
};
usePlot(1, document.getElementById('usePlot1'));
usePlot(2, document.getElementById('usePlot2'));
usePlot(3, document.getElementById('usePlot3'));
usePlot(4, document.getElementById('usePlot4'));
useHeatmap(1, document.getElementById('useHeatmap1'));

function addTitleToPage(titleText){
	var ele = document.createElement("p");
	ele.textContent = titleText;
	(document.getElementById("mainView") || document.body).appendChild(ele);
	return ele;
}
function addChartContainerToPage(){
	var ele = document.createElement("div");
	ele.className = "chart";
	(document.getElementById("mainView") || document.body).appendChild(ele);
	return ele;
}
function plotData(data, plotIndex, expandData){
	var p = (plotIndex != undefined)? fixedPlots[plotIndex] : undefined;
	if (p){
		if (p.use){
			if (expandData){
				p.graph.addValues(...data);
			}else{
				p.graph.addValues(data);
			}
			p.graph.draw();
		}
	}else{
		var ele = addChartContainerToPage();
		var conf = {
			targetElement: ele,
			showPoints: false,
			strokeWidth: 1
		}
		if (expandData){
			var x = uPlot.lazy.createSequence(0, data[0].length);
			conf.data = [x, ...data];
		}else{
			var x = uPlot.lazy.createSequence(0, data.length);
			conf.data = [x, data];
		}
		uPlot.lazy.plot(conf);
	}
}
function drawHeatmap(data, hmIndex, maxPoints){
	var heatmap = (hmIndex != undefined)? heatmaps[hmIndex] : undefined;
	if (!heatmap){
		var ele = addChartContainerToPage();
		let colorIndex = 4;
		heatmap = new uPlot.lazy.Heatmap(ele, {
			dataPixelWidth: 4,
			dataPixelHeight: 4,
			colorIndex: colorIndex,
			maxDataPoints: maxPoints || 150
		});
		if (hmIndex != undefined) heatmaps[hmIndex] = heatmap;
	}
	data.forEach(function(d, i){
		heatmap.addDataArray(d);
	});
	heatmap.draw();
}
function createArrayWithStartValue(n, startValue){
	if (startValue == undefined) startValue = 0;
	var array = new Array(n);
	for (let i=0; i<n; i++){
		array[i] = startValue;
	}
	return array;
}