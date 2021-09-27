GcodeFixer = {
    fix: {
        head: null,
        end: null,
        functions: {},
    },
    usedFunctions: {},
    settings: {
        piercing: true,
        // limit: 1024
        limit: 1024 * 170
    },

    process: function(sourse, settings) {

        this.settings.piercing = settings.piercing;
        this.usedFunctions = {};
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
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    toPolar: function(point, angle, r) {
        let direct = GcodeFixer.degToRad(angle);
        return {
            'x': (r * Math.cos(direct)) + point.x,
            'y': (r * Math.sin(direct)) + point.y,
        }
    },

    parseGVariables: function(line) {
        // const regex = /(([GXYIJ])(\-?[0-9]{1,5}\.[0-9]{1,3}))/g;
        const regex = /([GXYIJ])(-?\d+(\.\d*)?)/g;
        const found = line.match(regex);
        let vars = {
            getOwnProperty: function(prop, def) {
                return vars.hasOwnProperty(prop) ? vars[prop] : def;
            }
        };
        if (found) {
            found.forEach(function(variable) {
                let varName = variable.substring(0, 1).toUpperCase();
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
        var fIndex = 0;
        var parts = [];
        var page = 5001;
        var seq = 1;
        var result = [];
        var lines = sourse.split("\n");
        var lastPosition = {x: null, y: null};
        var lastSubcode = null;
        var laterEnabled = false;
        var FinMemory = null;
        // lines.slice(0, 20).forEach(function(line, index) {
        lines.forEach(function(line, index) {

            var code = line.substring(0, 1);
            var subcode = line.substring(0, 3);
            var nextCode = null;
            var nextSubcode = null;
            var nextLine = null;
            var prevCode = null;
            var prevSubcode = null;
            var prevLine = null;

            if (lines[index + 1]) {
                nextCode = lines[index + 1].substring(0, 1);
                nextSubcode = lines[index + 1].substring(0, 3);
                nextLine = lines[index + 1];
            }


            if (lines[index - 1]) {
                prevCode = lines[index - 1].substring(0, 1);
                prevSubcode = lines[index - 1].substring(0, 3);
                prevLine = lines[index - 1];
            }


            if (subcode === 'G00') {

                let subResult = result.join("\n");
                let vars = GcodeFixer.parseGVariables(line);

                if (subResult.length > GcodeFixer.settings.limit) {
                    parts.push(subResult);
                    result = [];
                }

                let x = vars.getOwnProperty('X', GcodeFixer.lastPosition.x);
                let y = vars.getOwnProperty('Y', GcodeFixer.lastPosition.y);

                result.push('N' + page.toString() + ' P200=' + page.toString());
                result.push(subcode + 'X' + x + 'Y' + y);
                result.push('Z=P6');
                result.push('G90');// - абсолютні координати
                result.push('G08');// - блокування переміщення
                page++;
                GcodeFixer.updateLastPosition(vars);
                lastSubcode = subcode;

            } else if (subcode === 'M02') {

            } else if (subcode === 'G01') {

                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                result.push(subcode + 'X' + GcodeFixer.lastPosition.x + 'Y' + GcodeFixer.lastPosition.y);
                lastSubcode = subcode;

            } else if (['G02', 'G03'].includes(subcode)) {
                let vars = GcodeFixer.parseGVariables(line);
                // let x = vars['X'] || GcodeFixer.lastPosition.x;
                // let y = vars['Y'] || GcodeFixer.lastPosition.y;

                let x = vars.getOwnProperty('X', GcodeFixer.lastPosition.x) ;
                let y = vars.getOwnProperty('Y', GcodeFixer.lastPosition.y) ;

                let x1 = GcodeFixer.lastPosition.x;
                let y1 = GcodeFixer.lastPosition.y;
                let j = GcodeFixer.formatCoordinate(vars['J'] - y1);
                let i = GcodeFixer.formatCoordinate(vars['I'] - x1);
                lastSubcode = subcode;
                let x2;
                let y2;


                if (!vars['X'] && !vars['Y']) {

                    var angle = GcodeFixer.vectorAngle({x: vars['I'], y: vars['J']}, {x: GcodeFixer.lastPosition.x, y: GcodeFixer.lastPosition.y});

                    var dist = GcodeFixer.distance({x: vars['I'], y: vars['J']}, {x: x, y: y});

                    // console.log(angle, dist,{cx:x, cy:y}, {x: GcodeFixer.lastPosition.x, y: GcodeFixer.lastPosition.y});

                    if (lastSubcode === 'G02') {
                        angle += 0.05;

                    } else if (lastSubcode === 'G03') {
                        angle -= 0.05;
                    }

                    var fixedPoint = GcodeFixer.toPolar({x: vars['I'], y: vars['J']}, angle, dist);


                    if ((fixedPoint.x - x) < (fixedPoint.y - y)) {
                        if (fixedPoint.x > x) {
                            fixedPoint.x = x + 0.02
                        } else {
                            fixedPoint.x = x - 0.02
                        }
                        fixedPoint.y = y;
                    } else {
                        if (fixedPoint.y > y) {
                            fixedPoint.y = y + 0.02
                        } else {
                            fixedPoint.y = y - 0.02
                        }
                        fixedPoint.x = x;
                    }

                    x2 = vars.getOwnProperty('X', GcodeFixer.formatCoordinate(fixedPoint.x));
                    y2 = vars.getOwnProperty('Y', GcodeFixer.formatCoordinate(fixedPoint.y));

                    if (index < 30) {
                        console.table(x2, y2, angle, dist, vars['I'], vars['J']);
                        console.table(x, y, angle, dist, vars['I'], vars['J']);
                        console.table(0, 0, 0, 0);
                    }

                } else {
                    x2 = x;
                    y2 = y;

                }

                GcodeFixer.updateLastPosition(vars);


                result.push(subcode + 'X' + x2 + 'Y' + y2 + 'I' + i + 'J' + j);
            } else if (['G41', 'M07'].includes(subcode)) {
                if (!laterEnabled) {
                    if (GcodeFixer.settings.piercing) {
                        result.push('Q2000');//'пробивка'
                    }


                    if (prevCode === 'F') {
                        let func = GcodeFixer.funcForF(prevLine);
                        if (func) {
                            result.push(func);//'робочий різ'
                        } else {
                            result.push('Q1002');//'робочий різ'
                        }
                    } else if (nextCode === 'F') {
                        let func = GcodeFixer.funcForF(nextLine);
                        if (func) {
                            result.push(func);//'робочий різ'
                        } else {
                            result.push('Q1002');//'робочий різ'
                        }
                    } else {
                        result.push('Q1002');//'робочий різ'
                    }
                    result.push('G41 D1');
                    result.push('F=P5');
                    result.push('G09');
                }
                laterEnabled = true;
                // result.push('G08');//
                if (subcode.charAt(0) === 'G') {
                    lastSubcode = subcode;
                }
            } else if (subcode === '(Se') {
                result.push("\n" + '(*Seq ' + seq + ')');
                seq++;
            } else if (['G40', 'M08'].includes(subcode)) {
                if (laterEnabled) {
                    result.push('G08');// - завершення кадру
                    result.push('S101 T2=1');
                    result.push('G40');
                    result.push('Q1901');
                }
                laterEnabled = false;
                if (subcode.charAt(0) === 'G') {
                    lastSubcode = subcode;
                }
            } else if (code === '%') {

            } else if (['G21', 'G90', 'G92', 'G08'].includes(subcode)) {
                lastSubcode = subcode;
            } else if (code === 'F') {
                // fIndex++;
                // let func = GcodeFixer.funcForF(line);
                // if (func) {
                //     FinMemory = func;
                // } else {
                //     //result.push(line);
                // }
            } else if (['I', 'J'].includes(code)) {
                let vars = GcodeFixer.parseGVariables(line);
                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                // console.log(lastSubcode, vars);

                if (vars['I']) {

                    let i = GcodeFixer.formatCoordinate(vars['I'] - GcodeFixer.lastPosition.x);
                    let j = GcodeFixer.formatCoordinate(vars['J'] - GcodeFixer.lastPosition.y);

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
                let lastX = GcodeFixer.lastPosition.x;
                let lastY = GcodeFixer.lastPosition.y;
                GcodeFixer.updateLastPosition(GcodeFixer.parseGVariables(line));
                if (['G02', 'G03'].includes(lastSubcode)) {
                    let j = GcodeFixer.formatCoordinate(GcodeFixer.lastPosition.j - lastY);
                    let i = GcodeFixer.formatCoordinate(GcodeFixer.lastPosition.i - lastX);
                    result.push(lastSubcode + 'X' + GcodeFixer.lastPosition.x + 'Y' + GcodeFixer.lastPosition.y + 'I' + i + 'J' + j);
                } else {
                    result.push(lastSubcode + 'X' + GcodeFixer.lastPosition.x + 'Y' + GcodeFixer.lastPosition.y);
                }
            } else {
                result.push(line);
            }

        });
        parts.push(result.join("\n"));

        return parts;
        // return result.join("\n");
        // return result.slice(0, 500).join("\n");
    },

    funcForF: function(func) {
        let funcIndex = "N10" + func.substring(func.length - 3, func.length).trim();
        if (GcodeFixer.fix.functions.hasOwnProperty(funcIndex)) {
            if (!GcodeFixer.usedFunctions.hasOwnProperty(funcIndex)) {
                GcodeFixer.usedFunctions[funcIndex] = 0;
            }
            GcodeFixer.usedFunctions[funcIndex]++;
            // result.push(funcIndex.replace('N', 'Q') + " inline " + line + '  i' + fIndex); //--------------------------------------------tmp disable
            return funcIndex.replace('N', 'Q');
//                    FinMemory = funcIndex.replace('N', 'Q') + ' ->' + line;
        } else {
            return null
        }
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
//
//
// let x = 24.587;
// let y = 19.596;
//
// let cx = 26.178;
// let cy = 18.005;
//
// var angle = GcodeFixer.vectorAngle({x: cx, y: cy}, {x: x, y: y});
//
// angle = angle - 0.75
// var dist = GcodeFixer.distance({x: cx, y: cy}, {x: x, y: y});
//
// var fixedPoint = GcodeFixer.toPolar({x: cx, y: cy}, angle, dist);
//
//
// if ((fixedPoint.x - x) < (fixedPoint.y - y)) {
//     if (fixedPoint.x > x) {
//         fixedPoint.x = x + 0.02
//     } else {
//         fixedPoint.x = x - 0.02
//     }
//     fixedPoint.y = y;
// } else {
//     if (fixedPoint.y > y) {
//         fixedPoint.y = y + 0.02
//     } else {
//         fixedPoint.y = y - 0.02
//     }
//     fixedPoint.x = x;
// }
//
//
// console.log((fixedPoint.x - x), (fixedPoint.y - y));
// console.log(angle, dist, {x: x, y: y}, {x: fixedPoint.x, y: fixedPoint.y});
