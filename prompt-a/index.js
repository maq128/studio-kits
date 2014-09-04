// http://api.jquery.com/
// https://developer.chrome.com/apps/about_apps
$(function() {
	// 设置初始状态
	resizeStage();
	$('#source').show();
	$('#stage').hide();
	$('#btn-source').addClass('pressed');

	// 随窗口尺寸变化调整布局
	$(window).on('resize', resizeStage);

	// 切换状态“文本编辑/播放”
	$('#btn-source').on('click', function() {
		if ($('#btn-source').hasClass('pressed')) {
			// 打开文本文件
			chrome.fileSystem.chooseEntry({
				type: 'openFile',
				accepts: [{description:'文本文件 (*.txt)', extensions:['txt']}]
			}, function(entry) {
				entry.file(function(file) {
					var reader = new FileReader();
					reader.onloadend = function(e) {
						$('#source').val(e.target.result);
						countChars();
					};
					reader.readAsText(file, 'GBK');
				});
			});
			return;
		}
		switchMode('source');
	});
	$('#btn-play').on('click', function() {
		if ($('#btn-play').hasClass('pressed')) {
			playStart();
			return;
		}
		switchMode('play');
	});

	// 点击播放区重新开始播放
	$('#stage').on('click', playStart);

	$('#source').on('change', countChars);

	// 控制每行字数
	$('#chars').on('change', function() {
		var chars = parseInt($('#chars').val());
		if (isNaN(chars)) {
			$('#chars').val(40);
		} else if (chars < 10) {
			$('#chars').val(10);
		} else if (chars > 200) {
			$('#chars').val(200);
		}
		recalcFontSize();
		parseSource();
	});

	// 控制播放时长
	$('#duration').on('change', function() {
		var duration = parseInt($('#duration').val());
		if (isNaN(duration)) {
			$('#duration').val(60);
		} else if (duration < 10) {
			$('#duration').val(10);
		} else if (duration > 300) {
			$('#duration').val(300);
		}
	});
});

// mode - source / play
function switchMode(mode)
{
	if (mode == 'source') {
		playStop();
		$('#btn-source').addClass('pressed');
		$('#btn-play').removeClass('pressed');
		$('#source').show();
		$('#stage').hide();
	} else if (mode == 'play') {
		playStop();
		$('#btn-play').addClass('pressed');
		$('#btn-source').removeClass('pressed');
		parseSource();
		$('#source').hide();
		$('#stage').show();
		playStart();
	}
}

var totalCharNum = 0;
function parseSource()
{
	totalCharNum = 0;
	$('#slide').empty();
	var lines = reformSource($('#source').val());
	$.each(lines, function(idx, line) {
		appendLine(line);
	});
}

function appendLine(line)
{
	totalCharNum += line.length;
	var div = $('<div/>').text(line).appendTo('#slide').data('data-sofar', totalCharNum);
	$('<br/>').appendTo('#slide');
}

// 段落重组：以固定长度重新分行
function reformSource(source)
{
	var chars = parseInt($('#chars').val());
	var lines = [];
	$.each(source.split('\n'), function(idx, paragraph) {
		paragraph = paragraph.trim();
		while (paragraph.length > 0) {
			var line = paragraph.substr(0, chars);
			lines.push(line);
			paragraph = paragraph.substr(line.length);
		}
	});
	return lines;
}

function countChars()
{
	var count = 0;
	var lines = reformSource($('#source').val());
	$.each(lines, function(idx, line) {
		count += line.length;
	});
	$('#info').text('总共 ' + count + ' 字');
}

function playStart()
{
	playStop();

	window._curPlay = $('#splash')
		.show()
		.css({opacity: 1}).text('3')
		.animate({
			opacity: 0.4
		}, {
			duration: 1000,
			complete: function() {
				$(this).css({opacity: 1}).text('2');
			}
		})
		.animate({
			opacity: 0.4
		}, {
			duration: 1000,
			complete: function() {
				$(this).css({opacity: 1}).text('1');
			}
		})
		.animate({
			opacity: 0.4
		}, {
			duration: 1000,
			complete: playStep
		})
		.hide(1);
}

function playStep()
{
	var line = null;
	if (window._curPlay && window._curPlay.parent().attr('id') == 'slide') {
		line = window._curPlay.nextAll('div').first();
	} else if (window._curPlay != null) {
		var duration = parseInt($('#duration').val());
		window._endTime = new Date().getTime() + duration * 1000;
		line = $('#slide div:first-child');
	} else {
		// 已经调用 playStop() 中止了
		return;
	}

	if (line.length == 0) {
		window._curPlay = null;
		return;
	}

	var duration = parseInt($('#duration').val());
	var till = window._endTime - (1 - line.data('data-sofar') / totalCharNum) * duration * 1000;
	var now = new Date().getTime();
	if (now >= till) {
		window._curPlay = line;
		setTimeout(playStep, 1);
		return;
	}

	window._curPlay = line.animate({
		'dummy': 10
	}, {
		duration: till - now,
		progress: function(promise, percent, remainingMs) {
			var sz = Math.floor(percent * 100 * 1000) / 1000 + '% 100%';
			$(this).css('background-size', sz);
		},
		complete: function() {
			$(this).addClass('passed').css('background-size', '0% 100%');
			playStep();
		}
	});
}

function playStop()
{
	if (window._curPlay) {
		var temp = window._curPlay;
		window._curPlay = null;
		temp.stop(true, true);
	}
	$('#slide div').removeClass('passed');
}

function recalcFontSize()
{
	var chars = parseInt($('#chars').val()) + 1;
	var sz = Math.floor($(window).width() / chars);
	$('#stage').css('font-size', sz + 'px');
	//console.log('字体[' + sz + ']  行高[' + (sz*1.8) + ']');
	$('#splash').css({
		'font-size': Math.floor($(window).width() * 2 / 3) + 'px',
		'line-height': Math.floor($(window).height() * 2 / 3) + 'px'
	});
}

function resizeStage()
{
	var w = $(window).width();
	var h = $(window).height() - $('#toolbar').outerHeight();
	$('#stage').width(w).height(h);
	$('#source').width(w).height(h);
	recalcFontSize();
}
