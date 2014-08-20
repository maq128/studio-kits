{
    function createSubtitles(thisObj)
    {
        // 读入字幕文件
        var subtitles = loadSrt();
        if (!subtitles) return;
        log('字幕加载完毕: ' + subtitles.length + ' 行');

        // 在当前的 Composition Item 上操作
        var item = app.project.activeItem;
        if (!item || (item.typeName != 'Composition' && item.typeName != '合成')) {
            alert('请先打开一个 Composition Item');
            return;
        }

        var pb = progressBar("导入字幕");

        // 以下所有操作合并为一个 undo-group
        log('beginUndoGroup');
        app.beginUndoGroup('导入字幕');

        // 找到字幕层（没有则创建一个）
        var layer = item.layers.byName('字幕');
        if (!layer) {
            log('创建字幕层');
            pb.setText('创建字幕层...');

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
            textDocument.strokeWidth = 6;
            textDocument.font = 'YouYuan';
            textDocument.strokeOverFill = false;
            textDocument.applyStroke = true;
            textDocument.applyFill = true;
            textDocument.justification = ParagraphJustification.LEFT_JUSTIFY;
            prop.setValue(textDocument);

            // 设定文字位置
            prop = layer.Transform.property('Position');
            prop.setValue([88, item.height - 82, 0]);
        }

        // 清除所有 keyframes
        log('清除原有关键帧');

        var prop = layer.Text.property('Source Text');
        var total = prop.numKeys;
        while (prop.numKeys > 0) {
            log('  清除: ' + prop.numKeys);
            pb.setValue((total - prop.numKeys) / total);
            pb.setText('清除原有关键帧: ' + prop.numKeys);

            prop.removeKey(prop.numKeys);
        }

        // 创建 keyframes
        log('开始导入');
        var getPerfectTimePosition = function(t) {
            return Math.round(t / item.frameDuration) * item.frameDuration;
        };
        prop.setValueAtTime(0.0, '');
        for (var i=0; i < subtitles.length; i++) {
            log('  导入: ' + i + ' / ' + subtitles.length);
            pb.setValue(i / subtitles.length);
            pb.setText('导入: ' + i + ' / ' + subtitles.length);

            var subtitle = subtitles[i];
            prop.setValueAtTime(getPerfectTimePosition(subtitle.from), subtitle.text);
            prop.setValueAtTime(getPerfectTimePosition(subtitle.to), '');
            if (pb.isCanceled()) {
                log('停止导入');
                break;
            }
        }
        pb.close();
        log('导入完成');

        app.endUndoGroup();
        app.activate();
    }

    function progressBar(title)
    {
        var result = new Object();
        result.running = true;
        result.p = new Window("palette", title);
        result.p.orientation = "column";
        result.p.alignChildren = "left";

        result.t1 = result.p.add("statictext", {x:0, y:0, width:300, height:24}, '-');
        result.b = result.p.add("progressbar", {x:0, y:0, width:300, height:24});

        result.c = result.p.add("button", undefined, "停止");
        result.c.onClick = function() {
            log('用户点击了【停止】按钮');
            this.running = false;
        }

        result.isRunning = function() { return this.running; }
        result.isCanceled = function() { return !this.isRunning(); }
        result.setValue = function(x) { this.b.value = x * 100; }
        result.setText = function(t1) { this.t1.text = t1; this.p.update(); }
        result.close = function() { this.p.close(); }

        result.p.show();
        result.p.center();
        return result;
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
        $.writeln('[' + tc + '] ' + msg);
    }

    createSubtitles(this);
}
