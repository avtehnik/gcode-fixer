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

    parseGVariables: function(line) {
        const regex = /(([GXYIJ])(\-?[0-9]{1,5}\.[0-9]{1,3}))/g;
        const found = line.match(regex);
        var vars = {};
        found.forEach(function(variable) {
            var varName = variable.substring(0, 1).toUpperCase();
            vars[varName] = parseFloat(variable.replace(varName, ''));
        })
        return vars;
    },

    formatCoordinate: function(num) {
        return Math.round(num * 1000) / 1000
    },

    fixSource: function(sourse) {

        var page = 5001;
        var seq = 1;
        var result = [];
        var lines = sourse.split("\n");
        var lastPosition = {x: null, y: null};
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
                let vars = GcodeFixer.parseGVariables(line);

                if (vars['X']) {
                    lastPosition.x = vars['X'];
                }

                if (vars['Y']) {
                    lastPosition.y = vars['Y'];
                }

            } else if (subcode === 'M02') {
                return;
            } else if (subcode === 'G01') {

                let vars = GcodeFixer.parseGVariables(line);

                if (vars['X']) {
                    lastPosition.x = vars['X'];
                }

                if (vars['Y']) {
                    lastPosition.y = vars['Y'];
                }

                result.push(subcode + 'X' + lastPosition.x + 'Y' + lastPosition.y);

            } else if (subcode === 'G02' || subcode === 'G03') {
                let vars = GcodeFixer.parseGVariables(line);

                if (vars['X']) {
                    lastPosition.x = vars['X'];
                }
                if (vars['Y']) {
                    lastPosition.y = vars['Y'];
                }


                let x = (vars['X'] || lastPosition.x);
                let y = (vars['Y'] || lastPosition.y);
                let i = null;
                let j = null;

                if (vars['I'] == vars['X']) {
                    if (subcode == 'G03') {
                        i = GcodeFixer.formatCoordinate(vars['J'] - y);
                    } else {
                        i = GcodeFixer.formatCoordinate(y - vars['J']);
                    }
                    j = 0;
                } else if (vars['Y'] == vars['J']) {
                    i = 0;
                    if (subcode == 'G03') {
                        j = GcodeFixer.formatCoordinate(x - vars['I']);
                    } else {
                        j = GcodeFixer.formatCoordinate(vars['I'] - x);
                    }
                } else {
                    i = GcodeFixer.formatCoordinate(vars['I'] - x);

                    if (subcode == 'G03') {

                        if(i==0){
                            j = GcodeFixer.formatCoordinate(y - vars['J']);
                        }else {
                            j = GcodeFixer.formatCoordinate(vars['J'] - y );
                        }

                    } else {
                        j = GcodeFixer.formatCoordinate(vars['J'] - y);
                    }
                }


                if (isNaN(i)) {
                    console.log(line, vars, x, y);
                }
                result.push(subcode + 'X' + x + 'Y' + y + 'I' + i + 'J' + j);
            } else if (subcode === 'G03') {
            } else if (subcode === 'G41') {
                result.push('Q2000');//'пробивка'
                result.push('Q1002');//'пробивка'
                result.push('G41 D1');
                result.push('F=P5');
                result.push('G09');
            } else if (subcode === '(Se') {
                result.push("\n" + '(*Seq '+seq+')');
                seq++;
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
                    result.push(funcIndex.replace('N', 'Q'));//--------------------------------------------tmp disable
                } else {
                    //result.push(line);
                }
            } else {
                result.push(line);
            }


        });

        return result.join("\n");
       // return result.slice(0, 500).join("\n");
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
