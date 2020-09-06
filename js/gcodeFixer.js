GcodeFixer = {
    fix: {
        head: null,
        end: null,
        functions: {}
    },
    settings: {
        piercing: true
    },

    process: function(sourse, settings) {

        this.settings.piercing = settings.piercing;

        return this.fixSource(sourse);
        var parts = [];
        parts.push(this.fix.head);
        parts.push(this.fixSource(sourse));
        parts.push(this.fix.end);
        parts.push("\n\n" + Object.values(this.fix.functions).join("\n\n"));
        return parts.join("\n");
    },

    vectorAngle: function(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
    },

    degToRad: function(angle) {
        return (angle * Math.PI) / 180;
    },


    distance: function(p1, p2) {
        var dx = p1.x - p2.x;
        var dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    toPolar: function(point, direct, dist) {
        var direct = GcodeFixer.degToRad(direct);
        return {
            'x': ((dist * Math.cos(direct)) + point.x),
            'y': ((dist * Math.sin(direct)) + point.y),
        }
    },

    parseGVariables: function(line) {
        const regex = /(([GXYIJ])(\-?[0-9]{1,5}\.[0-9]{1,3}))/g;
        const found = line.match(regex);
        var vars = {};
        if (found) {
            found.forEach(function(variable) {
                var varName = variable.substring(0, 1).toUpperCase();
                vars[varName] = parseFloat(variable.replace(varName, ''));
            })
        }
        return vars;
    },

    formatCoordinate: function(num) {
        return Math.round(num * 1000) / 1000
    },

    lastPosition: {x: null, y: null},

    updateLastPosition: function(vars) {
        if (vars['X']) {
            GcodeFixer.lastPosition.x = vars['X'];
        }

        if (vars['Y']) {
            GcodeFixer.lastPosition.y = vars['Y'];
        }
        if (vars['I']) {
            GcodeFixer.lastPosition.i = vars['I'];
        }

        if (vars['J']) {
            GcodeFixer.lastPosition.j = vars['J'];
        }
    },

    fixSource: function(sourse) {

        var parts = [];
        var page = 5001;
        var seq = 1;
        var result = [];
        var lines = sourse.split("\n");
        var lastPosition = {x: null, y: null};
        var lastSubcode = null;
        // lines.slice(0, 20).forEach(function(line, index) {
        lines.forEach(function(line, index) {

            var code = line.substring(0, 1);
            var subcode = line.substring(0, 3);
            if (subcode === 'G00') {

                let subResult = result.join("\n");

                if (subResult.length > (1024 * 240)) {
                    parts.push(subResult);
                    result = [];
                }

                result.push('N' + page.toString() + ' P200=' + page.toString());
                result.push(line);//'холостий хід'
                result.push('Z=P6');
                result.push('G90');// - абсолютні координати
                result.push('G08');// - блокування переміщення
                page++;
                let vars = GcodeFixer.parseGVariables(line);
                GcodeFixer.updateLastPosition(vars);
                lastSubcode = subcode;

            } else if (subcode === 'M02') {

            } else if (subcode === 'G01') {

                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                result.push(subcode + 'X' + GcodeFixer.lastPosition.x + 'Y' + GcodeFixer.lastPosition.y);
                lastSubcode = subcode;

            } else if (subcode === 'G02' || subcode === 'G03') {
                let vars = GcodeFixer.parseGVariables(line);


                // console.log(GcodeFixer.lastPosition.x, GcodeFixer.lastPosition.y, vars['I'], vars['J'], {
                //     i: GcodeFixer.formatCoordinate(GcodeFixer.lastPosition.x - vars['I']),
                //     j: GcodeFixer.formatCoordinate(GcodeFixer.lastPosition.y - vars['J'])
                // })

                let x = vars['X'] || GcodeFixer.lastPosition.x;
                let y = vars['Y'] || GcodeFixer.lastPosition.y;

                if (lastSubcode == 'G00') {
                    var x1 = GcodeFixer.lastPosition.x;
                    var y1 = GcodeFixer.lastPosition.y;
                } else {
                    var x1 = x;
                    var y1 = y;
                }

                let i = null;
                let j = null;

                // console.log(subcode, lastSubcode);


                if (vars['I'] == x1) {
                    if (subcode == 'G03') {
                        i = GcodeFixer.formatCoordinate(vars['J'] - y1);
                    } else {
                        i = GcodeFixer.formatCoordinate(y1 - vars['J']);
                    }
                    j = 0;
                } else if (vars['Y'] == vars['J']) {
                    i = 0;
                    if (subcode == 'G03') {
                        j = GcodeFixer.formatCoordinate(x1 - vars['I']);
                    } else {
                        j = GcodeFixer.formatCoordinate(vars['I'] - x1);
                    }
                } else {
                    i = GcodeFixer.formatCoordinate(vars['I'] - x1);

                    if (subcode == 'G03') {
                        if (i == 0) {
                            j = GcodeFixer.formatCoordinate(y1 - vars['J']);
                        } else {
                            j = GcodeFixer.formatCoordinate(vars['J'] - y1);
                        }

                    } else {
                        j = GcodeFixer.formatCoordinate(vars['J'] - y1);
                    }
                }
                // console.log(subcode, lastSubcode, i, j);

                if (isNaN(i)) {
                    console.log(line, vars, x, y);
                }
                lastSubcode = subcode;

                var angle = GcodeFixer.vectorAngle({x: vars['I'], y: vars['J']}, {x: x, y: y});
                var dist = GcodeFixer.distance({x: x, y: y}, {x: vars['I'], y: vars['J']});

                if (subcode === 'G02') {
                    angle += 0.05;

                } else if (subcode === 'G03') {
                    angle -= 0.05;

                }

                var fixedPoint = GcodeFixer.toPolar({x: vars['I'], y: vars['J']}, angle, dist);

                x2 = GcodeFixer.formatCoordinate(fixedPoint.x);
                y2 = GcodeFixer.formatCoordinate(fixedPoint.y);

                // console.log({x: x, y: y}, {x: x2, y: y2});

                GcodeFixer.updateLastPosition(vars);

                result.push(subcode + 'X' + x + 'Y' + y + 'I' + i + 'J' + j);
            } else if (subcode === 'G41') {
                // console.log('g41')
                result.push('Q2000');//'пробивка'

                if (GcodeFixer.settings.piercing) {
                    console.log('piercing');
                    result.push('Q1002');//'пробивка'
                }

                result.push('G41 D1');
                result.push('F=P5');
                result.push('G09');
            } else if (subcode === '(Se') {
                result.push("\n" + '(*Seq ' + seq + ')');
                seq++;
            } else if (subcode === 'G40') {
                result.push('G08');// - завершення кадру
                result.push('S101 T2=1');
                result.push(line);
                result.push('Q1901');
            } else if (code === '%') {

            } else if (['G21', 'G90', 'G92', 'M08', 'M07'].includes(subcode)) {

            } else if (code === 'F') {
                let func = line;
                let funcIndex = "N10" + func.substring(func.length - 3, func.length).trim();
                if (GcodeFixer.fix.functions.hasOwnProperty(funcIndex)) {
                    result.push(funcIndex.replace('N', 'Q'));//--------------------------------------------tmp disable
                } else {
                    //result.push(line);
                }
            } else if (['I', 'J'].includes(code)) {
                let vars = GcodeFixer.parseGVariables(line);
                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                // console.log(lastSubcode, vars);

                if (vars['I']) {

                    let i = GcodeFixer.formatCoordinate(vars['I'] - GcodeFixer.lastPosition.x);
                    let j = i * -1;


                    let x = GcodeFixer.lastPosition.x + i;
                    let y = GcodeFixer.lastPosition.y + j;


                    var angle = GcodeFixer.vectorAngle({x: x, y: y}, {x: GcodeFixer.lastPosition.x, y: GcodeFixer.lastPosition.y});

                    var dist = GcodeFixer.distance({x: GcodeFixer.lastPosition.x, y: GcodeFixer.lastPosition.y}, {x: x, y: y});

                    // console.log(angle, dist,{cx:x, cy:y}, {x: GcodeFixer.lastPosition.x, y: GcodeFixer.lastPosition.y});

                    if (lastSubcode === 'G02') {
                        angle += 0.05;

                    } else if (lastSubcode === 'G03') {
                        angle -= 0.05;
                    }

                    var fixedPoint = GcodeFixer.toPolar({x: x, y: y}, angle, dist);

                    let x2 = GcodeFixer.formatCoordinate(fixedPoint.x);
                    let y2 = GcodeFixer.formatCoordinate(fixedPoint.y);

                    GcodeFixer.updateLastPosition(vars);


                    result.push(lastSubcode + 'X' + x2 + 'Y' + y2 + 'I' + i + 'J' + j);
                }

            } else if (['X', 'Y'].includes(code)) {
                let vars = GcodeFixer.parseGVariables(line);
                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                result.push(lastSubcode + 'X' + GcodeFixer.lastPosition.x + 'Y' + GcodeFixer.lastPosition.y);
            } else {
                result.push(line);
            }

        });
        parts.push(result.join("\n"));

        return parts;
        // return result.join("\n");
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
        });
    },
    repack: function(string) {
        var strings = string.split("\n");
        var newArr = strings.map(function(line) {
            return line.trim();
        });
        return newArr.join("\n");
    }
};
