// https://developer.chrome.com/apps/about_apps
// http://api.jquery.com/
// http://www.w3.org/TR/FileAPI/
// http://dev.w3.org/2009/dap/file-system/file-writer.html
// 播放视频 http://www.w3schools.com/tags/ref_av_dom.asp
// 文字效果 http://www.1stwebdesigner.com/css/css3-text-effects-typography/
// http://enjoycss.com/
// http://www.colorzilla.com/gradient-editor/

var player = null;

$(function() {
	// 设置窗口位置、尺寸
	chrome.system.display.getInfo(function(displayInfo) {
		var wa = displayInfo[0].workArea;
		var win = chrome.app.window.current();
		win.resizeTo(Math.floor(wa.width / 2), wa.height);
		win.moveTo(0, 0);
	});

	// 可全局访问的播放器对象
	player = $('#player').get(0);

	// 打开视频文件
	$('#btn-load-video').on('click', function() {
		chrome.fileSystem.chooseEntry({
			type: 'openFile',
			accepts: [{description:'音视频文件 (*.mp4, *.mp3)', extensions:['mp4', 'mp3']}]
		}, function(entry) {
			chrome.fileSystem.getDisplayPath(entry, function(displayPath) {
				entry.file(function(file) {
					player.src = URL.createObjectURL(file);
				});
			});
		});
	});

	// 打开文本文件
	$('#btn-load-text').on('click', function() {
		chrome.fileSystem.chooseEntry({
			type: 'openFile',
			accepts: [
				{description:'文本文件 (*.txt)', extensions:['txt']},
				{description:'字幕文件 (*.srt)', extensions:['srt']}
			]
		}, function(entry) {
			entry.file(function(file) {
				var reader = new FileReader();
				var isSrt = file.name.toLowerCase().substr(-4) == '.srt';
				reader.onloadend = function(e) {
					isSrt ? parseSrtSource(e.target.result) : parseTxtSource(e.target.result);
				};
				reader.readAsText(file, isSrt ? 'UTF8' : 'GBK');
			});
		});
	});

	// 保存字幕文件
	$('#btn-save-srt').on('click', function() {
		chrome.fileSystem.chooseEntry({
			type: 'saveFile',
			suggestedName: 'subtitles.srt',
			accepts: [{description:'字幕文件 (*.srt)', extensions:['srt']}]
		}, function(entry) {
			entry.createWriter(function(fileWriter) {
				var srt = [];
				var seq = 1;
				$.each(_lines, function(idx, line) {
					if (line.passed) {
						if (srt.length > 0) {
							srt.push('\r\n');
						}
						srt.push((seq ++) + '\r\n');
						srt.push(formatTime(line.tsIn, true, true) + ' --> ' + formatTime(line.tsOut, true, true) + '\r\n');
					}
					srt.push(line.text + '\r\n');
				});

				fileWriter.onwriteend = function(e) {
					fileWriter.onwriteend = null;
					fileWriter.write(new Blob(srt, {type: 'text/plain'}));
				};
				fileWriter.truncate(0);
			});
		});
	});

	// 鼠标点击时切换“播放/暂停”
	$('#slide-view').on('click', function() {
		player.paused ? player.play() : player.pause();
	});

	// 播放进度
	$(player).on('timeupdate', function() {
		// 实时显示播放进度
		var str = formatTime(this.currentTime) + ' / ' + formatTime(this.duration);
		$('#hud').text(str).show();

		// 根据播放进度找到当前行
		updateToTime(this.currentTime);
	});

	// 键盘控制
	$(document).on('keydown', function(evt) {
		if (evt.keyCode == 40) { // 下箭头
			markNextLine(player.currentTime);
			evt.preventDefault();

		} else if (evt.keyCode == 38) { // 上箭头
			// 切换“播放/暂停”
			if (player.readyState > 0) {
				player.paused ? player.play() : player.pause();
			}
			evt.preventDefault();

		} else if (evt.keyCode == 37) { // 左箭头
			// 回退
			if (player.readyState > 0) {
				player.currentTime -= 3;
			}
			evt.preventDefault();

		} else if (evt.keyCode == 39) { // 右箭头
			// 快进
			if (player.readyState > 0) {
				player.currentTime += 3;
			}
			evt.preventDefault();

		} else if (evt.keyCode == 13) { // 回车键
			// 停止当前行结束时间戳的自动延展
			if (_lines.current >= 0) {
				_lines[_lines.current].autoExtend = false;
			}
			evt.preventDefault();
		}
	});

	// 编辑区点击清除时间戳
	$('#lines').delegate('tr.passed-line', 'click', function(evt) {
		var line = $(evt.currentTarget).data('data-line');
		line.passed = false;
		renderLine(line);
	});

	// 调整界面布局
	$(window).on('resize', recalcLayout);
	recalcLayout();
});

function formatPadding(str, pad)
{
	return (pad + str).substr(- pad.length);
}

function formatTime(ts, ms, h)
{
	var hours = Math.floor(ts / 3600);
	ts -= hours * 3600;
	var minutes = Math.floor(ts / 60);
	ts -= minutes * 60;
	var seconds = Math.floor(ts);
	ts -= seconds;
	var msec = Math.floor(ts * 1000);
	var str = (hours > 0 || h) ? formatPadding(hours, '00') + ':' : '';
	str += formatPadding(minutes, '00') + ':';
	str += formatPadding(seconds, '00');
	if (ms) {
		str += '.' + formatPadding(msec, '000');
	}
	return str;
}

function recalcLayout()
{
	var toolbarHeight = $('#toolbar').outerHeight();
	var h = Math.floor(($(window).height() - toolbarHeight) / 2);
	$('#stage').height(h).show();
	$('#slide-view').height(h - 40).show();
	$('#editor').height(h).show();
}

var _lines = [];

function parseTxtSource(source)
{
	_lines = [];
	_lines.current = -1;

	$('#slide-bar').empty();
	$('#lines').empty();
	$.each(source.split('\n'), function(idx, text) {
		text = text.replace(/ {2,}/g, ' ').trim();
		if (text.length == 0) return;

		var line = {
			text: text,
			tsIn: 0.0,
			tsOut: 0.0,
			passed: false,
			autoExtend: true
		};

		// 播放区
		line.elVisual = $('<div/>').appendTo('#slide-bar').data('data-line', line);

		// 编辑区
		line.elText = $('<tr><td class="ts ts-in"></td><td class="ts ts-out"></td><td class="text"></td></tr>').appendTo('#lines').data('data-line', line);

		renderLine(line);

		_lines.push(line);
	});
	$('#slide-view').scrollTop(0);
}

function parseSrtSource(source)
{
	console.log('parseSrtSource', source);
}

function renderLine(line)
{
	if (line.passed) {
		line.elVisual.text(line.text);
		line.elVisual.addClass('passed-line');

		line.elText.children('.ts-in').text(formatTime(line.tsIn, true));
		line.elText.children('.ts-out').text(formatTime(line.tsOut, true));
		line.elText.children('.text').text(line.text);
		line.elText.addClass('passed-line');
	} else {
		line.elVisual.text(line.text);
		line.elVisual.removeClass('passed-line');

		line.elText.children('.ts-in').text('--:--.---');
		line.elText.children('.ts-out').text('--:--.---');
		line.elText.children('.text').text(line.text);
		line.elText.removeClass('passed-line');
	}
}

function markNextLine(currentTime)
{
	// 处理原来的“当前行”
	var curLine = null;
	if (_lines.current >= 0) {
		// 确保视频播放时间已经推进 0.3s 以上
		if (_lines[_lines.current].tsIn + 0.3 >= currentTime) return;
		curLine = _lines[_lines.current];
	}

	if (curLine) {
		curLine.elVisual.removeClass('current-line');

		// 当前行的时间戳
		// TODO:
		//   后续行如果已经打过点，会随着播放自动跳进，所以实际上
		//   只能将其提前，无法将其推迟。
		if (curLine.tsOut > currentTime) {
			curLine.tsOut = currentTime;
		}
		curLine.elText.removeClass('current-line');
		renderLine(curLine);
	}

	// 处理“下一行”，也就是新的“当前行”
	var nextLine = null;
	var next = _lines.current + 1;
	if (next < _lines.length) {
		nextLine = _lines[next];
		_lines.current = next;
	} else {
		_lines.current = -1;
	}

	if (nextLine) {
		nextLine.passed = true;
		nextLine.autoExtend = true;

		nextLine.elVisual.addClass('passed-line');
		nextLine.elVisual.addClass('current-line');

		nextLine.tsIn = currentTime;
		nextLine.tsOut = currentTime;
		nextLine.elText.addClass('current-line');
		renderLine(nextLine);
	}

	scrollCurrentLineIntoView();
}

function updateToTime(currentTime)
{
	// 原来的“当前行”
	var curLine = null;
	if (_lines.current >= 0) {
		curLine = _lines[_lines.current];
	}

	// 根据时间戳找到新的当前行
	var newLineNum = -1;
	if (curLine && currentTime > curLine.tsIn && _lines.current + 1 < _lines.length && !_lines[_lines.current + 1].passed) {
		newLineNum = _lines.current;
	} else {
		for (var i=0; i < _lines.length; i++) {
			if (!_lines[i].passed) continue;
			if (_lines[i].tsIn > currentTime) break;
			newLineNum = i;
		}
	}

	// 如果当前行没有变化则……
	if (newLineNum == _lines.current) {
		if (curLine) {
			// 自动延展当前行的结束时间
			if (curLine.tsOut < currentTime && curLine.autoExtend) {
				curLine.tsOut = currentTime;
				curLine.elText.children('.ts-out').text(formatTime(curLine.tsOut, true));
			}

			// 确保后续行的时间戳递增
			while (++newLineNum < _lines.length) {
				var newLine = _lines[newLineNum];
				if (newLine.passed && newLine.tsIn < currentTime) {
					newLine.passed = false;
					renderLine(newLine);
				}
			}
		}
		return;
	}
	_lines.current = newLineNum;

	// 原来的“当前行”去掉高亮
	if (curLine) {
		curLine.elVisual.removeClass('current-line');
		curLine.elText.removeClass('current-line');
	}

	// 新的“当前行”加高亮
	if (newLineNum < 0) return;
	var newLine = _lines[newLineNum];
	newLine.elVisual.addClass('current-line');
	newLine.elText.addClass('current-line');

	// 当前行滑动到合适的位置
	scrollCurrentLineIntoView();
}

function scrollCurrentLineIntoView()
{
	if (_lines.current < 0) return;
	var curLine = _lines[_lines.current];
	var preferTop = Math.floor($('#slide-view').height() * 0.7);
	var scrollTop = Math.max(curLine.elVisual.position()['top'] - preferTop, 0);
	$('#slide-view').stop(true).animate({
		scrollTop: scrollTop
	}, {
		duration: 200
	});
}
