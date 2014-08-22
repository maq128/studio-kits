{
    function createSubtitles(thisObj)
    {
        // 在当前的 Composition Item 上操作
        var item = app.project.activeItem;
        if (!item || (item.typeName != 'Composition' && item.typeName != '合成')) {
            alert('请先打开一个 Composition Item');
            return;
        }

        // 找到字幕层（没有则创建一个）
        var layer = item.layers.byName('字幕');
        if (!layer) {
            app.beginUndoGroup('创建字幕层');
            layer = item.layers.addText('');
            layer.name = '字幕';

            // 设置缺省的文字格式
            var prop = layer.Text.property('Source Text');
            var textDocument = prop.value;
            textDocument.resetCharStyle();
            textDocument.text = '';
            textDocument.fontSize = 75;
            textDocument.tracking = 22;
            textDocument.fillColor = [1, 1, 1];
            textDocument.strokeColor = [0, 0, 0];
            textDocument.strokeWidth = 7;
            textDocument.font = 'YouYuan';
            textDocument.strokeOverFill = false;
            textDocument.applyStroke = true;
            textDocument.applyFill = true;
            textDocument.justification = ParagraphJustification.LEFT_JUSTIFY;
            prop.setValue(textDocument);

            // 设定文字位置
            prop = layer.Transform.property('Position');
            prop.setValue([88, item.height - 82, 0]);
            app.endUndoGroup();

            // 给用户留一个机会，先调整文字属性
            alert([
                '刚刚创建了一个“字幕”层，部分文字属性已经设置为适当的缺省值。\r\n',
                '有些属性无法通过程序设定（比如字体加粗），您可以先检查一下现有',
                '的文字属性，需要的话可做适当调整，然后再重新运行本程序。'
            ].join('\r\n'));
            return;
        }

        // 读入字幕文件
        var subtitles = loadSrt();
        if (!subtitles) return;
        log('字幕解析完毕: ' + subtitles.length + ' 行');

        // 进度条
        var pb = new ProgressBar("导入字幕");

        // 开启 undo-group
        app.beginUndoGroup('导入字幕');

        // 清除所有 keyframes
        var prop = layer.Text.property('Source Text');
        var total = prop.numKeys;
        while (prop.numKeys > 0 && !pb.isCanceled()) {
            log('  清除: ' + prop.numKeys);
            pb.setValue((total - prop.numKeys) / (total + 10));
            pb.setText('清除原有关键帧: ' + prop.numKeys);

            prop.removeKey(prop.numKeys);
        }

        if (!pb.isCanceled()) {
            // 创建 keyframes
            var getPerfectTimePosition = function(t) {
                return Math.round(t / item.frameDuration) * item.frameDuration;
            };
            var timesArray = [0.0];
            var valuesArray = [''];
            for (var i=0; i < subtitles.length; i++) {
                var subtitle = subtitles[i];
                timesArray.push(subtitle.from);
                valuesArray.push(subtitle.text);
                timesArray.push(subtitle.to);
                valuesArray.push('');
            }
            if (timesArray.length > 0) {
                log('  导入: ' + subtitles.length);
                pb.setValue(1.0);
                pb.setText('创建字幕关键帧');

                prop.setValuesAtTimes(timesArray, valuesArray);
            }
        }
        app.endUndoGroup();

        pb.close();
        log('导入' + (pb.isCanceled() ? '中止' : '完成'));

        app.activate();
        alert('字幕导入已' + (pb.isCanceled() ? '中止' : '完成') + '。', '导入字幕');
    }

    function loadSrt()
    {
        var srt = File.openDialog('打开字幕文件', '字幕文件:*.srt');
        if (!srt) return null;

        var seq = 0;
        var from = 0.0;
        var to = 0.0;
        var waitingFor = 1;
        var lines = [];

        srt.open();
        while (!srt.eof) {
            var line = srt.readln();
            if (line.length > 0) {
                if (waitingFor == 1) {
                    seq = parseInt(line);
                    waitingFor = 2;
                } else if (waitingFor == 2) {
                    var m = line.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
                    from = (parseInt(m[1]) * 60 + parseInt(m[2])) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
                    to   = (parseInt(m[5]) * 60 + parseInt(m[6])) * 60 + parseInt(m[7]) + parseInt(m[8]) / 1000;
                    waitingFor = 3;
                } else if (waitingFor == 3) {
                    lines.push({
                        seq: seq,
                        from: from,
                        to: to,
                        text: line
                    });
                    waitingFor = 1;
                }
            }
        }
        srt.close();
        return lines;
    }

    function log(msg)
    {
        if (arguments.callee.t0 === undefined) {
            arguments.callee.t0 = new Date().getTime();
        }
        var tc = (new Date().getTime() - arguments.callee.t0) / 1000;
        clearOutput();
        writeLn('[' + tc + '] ' + msg);
    }

    function ProgressBar(title)
    {
        var pb = new Object();
        pb.cancel = false;
        pb.win = new Window("palette", title);
        pb.win.orientation = "column";
        pb.win.alignChildren = "left";

        pb.text = pb.win.add("statictext", {x:0, y:0, width:300, height:24}, '正在运行……');
        pb.bar = pb.win.add("progressbar", {x:0, y:0, width:300, height:24});

        pb.btn = pb.win.add("button", undefined, "停止");
        pb.btn.onClick = function() {
            log('用户点击了【停止】按钮');
            pb.cancel = true;
        }

        pb.isCanceled = function() { return this.cancel; }
        pb.setValue = function(x) { this.bar.value = x * 100; }
        pb.setText = function(text) { this.text.text = text; this.win.update(); $.sleep(10); }
        pb.close = function() { this.win.close(); }

        pb.win.show();
        pb.win.center();
        return pb;
    }

    createSubtitles(this);
}
