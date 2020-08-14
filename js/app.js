GcodeFixer = {
    fix: {
        head: null,
        end: null,
        functions: {}
    },

    process: function(sourse) {
        var parts = [];
        parts.push(this.fix.head);
        parts.push(this.fixSource(sourse));
        parts.push(this.fix.end);
        parts.push("\n\n" + Object.values(this.fix.functions).join("\n\n"));
        return parts.join("\n");
    },

    fixSource: function(sourse) {

        var page = 5001;
        var result = [];
        var lines = sourse.split("\n");
        lines.forEach(function(line) {

            var code = line.substring(0, 1);
            var subcode = line.substring(0, 3);
            if (subcode === 'G00') {
                result.push('N' + page.toString() + ' P200=' + page.toString());
                result.push(line);//'холостий хід'
                result.push('Z=P6');
                result.push('G90');// - абсолютні координати
                result.push('G08');// - блокування переміщення
                page++;
            } else if (subcode === 'G41') {
                result.push('Q2000');//'пробивка'
                result.push('Q1002');//'пробивка'
                result.push('G41 D1');
                result.push('F=P5');
                result.push('G09');
            } else if (subcode === '(Se') {
                result.push("\n" + line);
            } else if (subcode === 'G40') {
                result.push('G08');// - завершення кадру
                result.push('S101 T2=1');
                result.push(line);
                result.push('Q1901');
            } else if (code === '%') {
                return;
            } else if (['G21', 'G90', 'G92', 'M08', 'M07'].includes(subcode)) {
                return;
            } else if (code === 'F') {
                let func = line;
                let funcIndex = "N10" + func.substring(func.length - 3, func.length).trim();
                if (GcodeFixer.fix.functions.hasOwnProperty(funcIndex)) {
                    result.push(funcIndex.replace('N', 'Q'));
                } else {
                    //result.push(line);
                }
            } else {
                result.push(line);
            }


        });

        return result.join("\n");
    },

    parseFix: function(fix) {

        var parts = this.repack(fix).split("\n\n");

        this.fix.head = [parts[0], parts[1]].join("\n");
        this.fix.end = [parts[2]].join("\n");

        parts.forEach(function(part, index) {
            var result = [];
            var lines = part.split("\n");
            lines.forEach(function(line) {
                var code = line.substring(0, 3);
                if (code) {
                    result.push(line);
                }
            });

            var part = result.join("\n");

            var code = part.substring(0, 1);
            if (code === "N") {
                GcodeFixer.fix.functions[result[0].replace(/\(.*\)/g, '').trim()] = part;
            }

//          return result.join("\n");

//            console.log(index, result.join("\n"));
        });

        // console.log(GcodeFixer.fix.functions);
    },
    repack: function(string) {

        var strings = string.split("\n");

        var newArr = strings.map(function(line) {
            return line.trim();
        });

        return newArr.join("\n");

    }
};


var vueApp = new Vue({
    el: '#app',
    data: {
        input: null,
        output: null,
        fix: null,
        head: null,
        end: null,
        functions: {}
    },
    methods: {
        onCncFile(sourse) {
            this.input = sourse;
            if (this.head) {
                this.output = GcodeFixer.process(sourse);
            }
        },

        onIsoFile(sourse) {
            GcodeFixer.parseFix(sourse);
            this.functions = GcodeFixer.fix.functions;
            this.head = GcodeFixer.fix.head;
            this.end = GcodeFixer.fix.end;

            if (this.input) {
                this.output = GcodeFixer.process(this.input);
            }
        }
    }
});

var holder = document.getElementById('holder'),
    state = document.getElementById('status');

if (typeof window.FileReader === 'undefined') {
    state.className = 'fail';
} else {
    state.className = 'success';
    state.innerHTML = 'Киньте сюди по черзі ISO і CNC файли';
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
        if (ext === 'cnc') {
            var fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = function() {
                vueApp.onCncFile(fileReader.result);
            };
        } else if (ext === 'iso') {
            var fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = function() {
                vueApp.onIsoFile(fileReader.result);
            };
        }


    });
    return false;
};
