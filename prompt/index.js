// http://api.jquery.com/
// https://developer.chrome.com/apps/about_apps
$(function() {
	// 设置初始状态
	resizeStage();
	$('#source').show();
	$('#stage').hide();
	$('#progress').hide();
	$('#btn-source').addClass('pressed');
	$('#btn-flip').get(0).checked = false;

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
					};
					reader.readAsText(file, 'GBK');
				});
			});
			return;
		}
		switchMode('source');
	});
	$('#btn-play').on('click', function() {
		if ($('#btn-play').hasClass('pressed')) return;
		switchMode('play');
	});

	// 阻止选择文本，便于快速连点按钮
	$('#toolbar').on('selectstart', function(evt) {
		evt.preventDefault();
	});

	// 控制每行字数
	$('#btn-dec-chars').on('click', function() {
		adjustChars(-1);
		if ($('#btn-play').hasClass('pressed')) {
			switchMode('play');
		}
	});
	$('#btn-inc-chars').on('click', function() {
		adjustChars(1);
		if ($('#btn-play').hasClass('pressed')) {
			switchMode('play');
		}
	});
	$('#btn-reset-chars').on('click', function() {
		$('#chars').text('20');
		if ($('#btn-play').hasClass('pressed')) {
			switchMode('play');
		}
	});

	// 控制语速
	$('#btn-dec-speed').on('click', function() {
		adjustSpeed(-10);
	});
	$('#btn-inc-speed').on('click', function() {
		adjustSpeed(10);
	});
	$('#btn-reset-speed').on('click', function() {
		$('#speed').text('270');
	});

	// 控制镜像翻转
	$('#btn-flip').on('change', resetFlip);

	// 鼠标滚轮动作
	$('#stage').on('mousewheel', function(evt) {
		evt.preventDefault();
		slideStop();
		$('#stage').scrollTop($('#stage').scrollTop() - evt.originalEvent.wheelDeltaY);
		$('#slide div').removeClass('current-line');
		slideUp();
	});

//	$(document).on('keypress', function(evt) {
//		if (evt.charCode == 32) { // 空格键
//			if (evt.target.id == 'source') return;
//			window._curSlide ? slideStop() : slideUp();
//		}
//	});

	$(document).on('keydown', function(evt) {
		if (evt.keyCode == 32) { // 空格键
			slideStop();
		}
	});
	$(document).on('keyup', function(evt) {
		if (evt.keyCode == 32) { // 空格键
			slideUp();
		}
	});

	// 播放/暂停
	$('#stage').on('click', function() {
		window._curSlide ? slideStop() : slideUp();
	});
});

// mode - source / play
function switchMode(mode)
{
	if (mode == 'source') {
		slideStop();
		$('#btn-source').addClass('pressed');
		$('#btn-play').removeClass('pressed');
		$('#source').show();
		$('#stage').hide();
		$('#progress').hide();
		//chrome.app.window.current().restore();
	} else if (mode == 'play') {
		slideStop();
		$('#btn-play').addClass('pressed');
		$('#btn-source').removeClass('pressed');
		parseSource();
		resetFlip();
		$('#source').hide();
		$('#stage').show();
		$('#progress').show();

		$('#stage').scrollTop(0);
		slideUp();
		//chrome.app.window.current().fullscreen();
	}
}

// 调整每行字数
function adjustChars(inc)
{
	var chars = parseInt($('#chars').text()) + inc;
	if (chars < 10) chars = 10;
	if (chars > 60) chars = 60;
	$('#chars').text(chars);
}

// 调整语速：字/分钟
function adjustSpeed(inc)
{
	var speed = parseInt($('#speed').text()) + inc;
	if (speed < 100) speed = 100;
	if (speed > 500) speed = 500;
	$('#speed').text(speed);
}

var totalCharNum = 0;
function appendLine(line, bop)
{
	totalCharNum += Math.max(line.replace(/[，、。！“”‘’：《》 ,\.!"':<>]/g, '').length, 3);
	if (line.length > 0) {
		var div = $('<div/>').text(line).appendTo('#slide').data('data-sofar', totalCharNum);
		if (bop === true) { // Begin Of Paragraph
			div.addClass('bop');
		}
	} else {
		$('<div>&nbsp;</div>').appendTo('#slide').data('data-sofar', totalCharNum);
	}
}
function parseSource()
{
	totalCharNum = 0;
	$('#slide').empty();
	appendLine('');
	appendLine('');
	appendLine('');
	appendLine('');
	appendLine('');
	appendLine('');
	var blocks = reformSource($('#source').val());
	$.each(blocks, function(idx, lines) {
		var bop = true;
		$.each(lines, function(idx, line) {
			appendLine(line, bop);
			bop = false;
		});
	});
	recalcFontSize();
}

// 段落重组：以空行为段落分隔，段落内部以固定长度重新分行
function reformSource(source)
{
	// 空行作为段落分隔，其它部分都拼合为一个段落
	var paragraphs = [];
	var paragraph = [];
	$.each(source.split('\n'), function(idx, line) {
		line = line.trim();
		if (line.length == 0) {
			if (paragraph.length > 0) {
				paragraphs.push(paragraph.join(''));
			}
			paragraph = [];
		} else {
			paragraph.push(line);
		}
	});
	if (paragraph.length > 0) {
		paragraphs.push(paragraph.join(''));
	}

	// 按固定长度（20个中文字符）重新分行
	var blocks = [];
	var chars = parseInt($('#chars').text());
	$.each(paragraphs, function(idx, paragraph) {
		paragraph = paragraph.replace(/\s+/g, '　');
		var lines = [];
		while (paragraph.length > 0) {
			var len = 0;
			var pos = 0;
			while (pos < paragraph.length && len < chars * 2) {
				len += paragraph.charCodeAt(pos) > 0x7f ? 2 : 1;
				pos ++;
			}
			lines.push(paragraph.substr(0, pos));
			paragraph = paragraph.substr(pos);
		}
		//blocks.push(lines);
		paragraphs[idx] = lines;
	});
	
	//return blocks;
	return paragraphs;
}

function recalcFontSize()
{
	var chars = parseInt($('#chars').text()) + 1;
	var sz = Math.floor($(window).width() / chars)
	$('#stage').css('font-size', sz + 'px');
	//console.log('字体[' + sz + ']  行高[' + (sz*1.8) + ']');
}

function slideUp()
{
	slideStop();

	// 找到当前行（位于中心位置偏下一行）
	var w = $('#stage').width();
	var h = $('#stage').height();
	var cur = $(document.elementFromPoint(w/2, h/2)).next();
	if (cur.length == 0) return;

	window._curLine = cur;
	window._curLine.addClass('current-line');

	// 计算滚动目标位置
	var scrollTop = $('#stage').scrollTop() + window._curLine.outerHeight();

	// 计算滚动所需时间
	var speed = parseInt($('#speed').text());
	var chars = Math.max(window._curLine.text().trim().length, 3);
	var duration = chars / speed * 60 * 1000;

	// 滚动文字
	window._curSlide = $('#stage').animate({
		scrollTop: scrollTop
	}, {
		duration: duration,
		easing: 'linear',
		complete: slideUp
	});

	// 计算播放进度
	recalcProgress();
}

function slideStop()
{
	if (window._curSlide) {
		window._curSlide.stop();
		window._curSlide = null;
	}
	if (window._curLine) {
		window._curLine.removeClass('current-line');
		window._curLine = null;
	}
}

function resetFlip()
{
	if ($('#btn-flip').get(0).checked) {
		$('#slide').css('transform', 'scaleX(-1)');
		$('#progress').css('transform', 'scaleX(-1)');
	} else {
		$('#slide').css('transform', 'none');
		$('#progress').css('transform', 'none');
	}
	// checkbox 去焦，避免影响空格键操作
	$('#btn-flip').blur();
}

function recalcProgress()
{
	
	var total = $('#toolbar').innerWidth() - $('#progress-anchor').position()['left'] - 100;
	var sofar = window._curLine ? Math.floor(total * window._curLine.data('data-sofar') / totalCharNum) : total;
	var rest = total - sofar;
	$('#progress').width(total);
	$('#sofar').width(sofar);
	$('#rest').width(rest);
}

function resizeStage()
{
	var w = $(window).width();
	var h = $(window).height() - $('#toolbar').outerHeight();
	$('#stage').width(w).height(h);
	$('#source').width(w).height(h);
	recalcFontSize();
	recalcProgress();
}
