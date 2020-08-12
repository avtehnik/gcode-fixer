GcodeFixer = {
    fix: {
        head: 'head',
        end: 'end',
        functions: 'functions',
    },

    process: function(sourse) {
        var parts = [];
        parts.push(this.fix.head);
        parts.push(this.fixSource(sourse));
        parts.push(this.fix.end);
        parts.push(this.fix.functions);
        return parts.join("\n");
    },

    fixSource: function(sourse) {

        var page = 1;
        var result = [];
        var lines = sourse.split("\n");

        lines.forEach(function(line) {

            var code = line.substring(0,3);

            if (code === 'G00') {
                result.push('N500'+page+' P200=500'+page+'');
                page++;
            }
            if (code === 'G21') {
                return;
            }


            result.push(line);
        });

        return result.join("\n");
    },

    parseFix: function(fix) {
        var parts = fix.split("\n\n");
        this.fix.head = [parts[0], parts[1]].join("\n");
//        console.log(parts);
    }

};


var vueApp = new Vue({
    el: '#app',
    data: {
        input: 'G00 X0 Y0',
        output: 'G00 X0 Y0',
        fix: 'G00 X0 Y0',
    },
    methods: {
        onFile(sourse) {
            this.input = sourse;


            this.fix = document.getElementById('fix').innerHTML;
            GcodeFixer.parseFix(this.fix);
            this.output = GcodeFixer.process(sourse);

        },
    }
});

var holder = document.getElementById('holder'),
    state = document.getElementById('status');

if (typeof window.FileReader === 'undefined') {
    state.className = 'fail';
} else {
    state.className = 'success';
    state.innerHTML = 'Киньте файли сюди';
}

holder.ondragover = function() {
    this.className = 'hover';
    return false;
};

holder.ondragend = function() {
    this.className = '';
    return false;
};

holder.ondrop = function(e) {
    this.className = '';
    e.preventDefault();
    Array.prototype.forEach.call(e.dataTransfer.files, function(file) {

        var re = /(?:\.([^.]+))?$/;
        var ext = re.exec(file.name.toLowerCase())[1];
        if (ext === 'iso' || ext === 'cnc') {
            var fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = function() {
                vueApp.onFile(fileReader.result);
            };
        }
    });
    return false;
};
