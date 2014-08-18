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
			accepts: [{description:'文本文件 (*.txt)', extensions:['txt']}]
		}, function(entry) {
			entry.file(function(file) {
				var reader = new FileReader();
				reader.onerror = function(e) {
					//
				};
				reader.onloadend = function(e) {
					parseSource(e.target.result);
				};
				reader.readAsText(file, 'GBK');
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
			console.log(arguments);
			entry.createWriter(function(fileWriter) {
				fileWriter.onwriteend = function(e) {
					console.log('Write completed.');
				};

				fileWriter.onerror = function(e) {
					console.log('Write failed: ' + e.toString());
				};

				var lines = [];
				$('#slide-bar div').each(function(idx, div) {
					var line = $(div).text();
					lines.push(line);
					lines.push('\r\n');
				});

debugger;
				fileWriter.truncate(0);
				fileWriter.write(new Blob(lines, {type: 'text/plain;charset=GBK'}));
//				fileWriter.write(new Blob(['中'], {type: 'text/plain;charset=GBK'}));
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
		slideToTime(this.currentTime);
	});

	// 键盘控制
	$(document).on('keydown', function(evt) {
		if (evt.keyCode == 40) { // 下箭头
			markNextLine();
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
		}
	});

	// 调整界面布局
	$(window).on('resize', recalcLayout);
	recalcLayout();
});

function formatPadding(str, pad)
{
	return (pad + str).substr(- pad.length);
}

function formatTime(ts, ms)
{
	var hours = Math.floor(ts / 3600);
	ts -= hours * 3600;
	var minutes = Math.floor(ts / 60);
	ts -= minutes * 60;
	var seconds = Math.floor(ts);
	ts -= seconds;
	var msec = Math.floor(ts * 1000);
	var str = (hours > 0) ? formatPadding(hours, '00') + ':' : '';
	str += formatPadding(minutes, '00') + ':';
	str += formatPadding(seconds, '00');
	if (ms) {
		str += '.' + formatPadding(msec, '000');
	}
	return str;
}

function slideToTime(currentTime)
{
	// 找到新的当前行
	var curLine = $('#slide-bar div.current-line');
	var newLine = null;
	$('#slide-bar div').each(function(idx, div) {
		if ($(div).data('data-ts') > currentTime) return false;
		if (!$(div).hasClass('passed-line')) return false;
		newLine = $(div);
	});
	if (!newLine) {
		curLine.removeClass('current-line');
		return;
	}

	// 如果当前行没有变化则返回
	if (curLine.get(0) == newLine.get(0)) return;

	// 当前行高亮显示
	curLine.removeClass('current-line');
	newLine.addClass('current-line');

	// 当前行滑动到合适的位置
	var preferTop = Math.floor($('#slide-view').height() * 0.7);
	var scrollTop = Math.max(newLine.position()['top'] - preferTop, 0);
	$('#slide-view').stop(true).animate({
		scrollTop: scrollTop
	}, {
		duration: 200
	});
}

function markNextLine()
{
	var currentTime = player.currentTime;

	// 找到“下一行”
	var curLine = $('#slide-bar div.current-line');
	var nextLine = null;
	if (curLine.length == 0) {
		nextLine = $('#slide-bar div').first();
	} else {
		// 确保视频播放时间已经推进 0.3s 以上
		if (curLine.data('data-ts') + 0.3 >= currentTime) return;

		nextLine = curLine.next();
	}
	if (nextLine.length == 0) return;

	// 标记为“已打点”
	nextLine.addClass('passed-line');

	// 当前行的时间戳
	// TODO:
	//   后续行如果已经打过点，会随着播放自动跳进，所以实际上
	//   只能将其提前，无法将其推迟。
	nextLine.data('data-ts', currentTime);
	nextLine = nextLine.next();

	// 后续所有行的时间戳（保证时间戳递增）
	while (nextLine.length > 0) {
		if (nextLine.data('data-ts') < currentTime) {
			nextLine.data('data-ts', currentTime);
		}
		nextLine = nextLine.next();
	}
}

function parseSource(source)
{
	// 编辑区
	$('#source').val(source);

	// 播放区
	$('#slide-bar').empty();
	$.each(source.split('\n'), function(idx, line) {
		line = line.replace(/ {2,}/g, ' ').trim();
		if (line.length == 0) return;
		$('<div/>').text(line).appendTo('#slide-bar').data('data-ts', 0.0);
	});
	$('#slide-view').scrollTop(0);
}

function recalcLayout()
{
	var toolbarHeight = $('#toolbar').outerHeight();
	var h = Math.floor(($(window).height() - toolbarHeight) / 2);
	$('#stage').height(h).show();
	$('#slide-view').height(h - 40).show();
	$('#editor').height(h).show();
}
