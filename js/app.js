function appendLeadingZeroes(n) {
    if (n <= 9) {
        return "0" + n;
    }
    return n
};

var vueApp = new Vue({
    el: '#app',
    data: {
        input: null,
        inputName: null,
        output: '',
        fix: null,
        head: null,
        end: null,
        functions: {},
        isoFiles: {},
        template: {
            name: 'null',
            head: '',
            functions: [],
            end: '',
            updated: ""
        },
        settings: {
            debug: false,
            piercing: true
        },
        downloads: [],
        usedFunctions: {}
    },
    methods: {
        onCncFile(sourse, name) {
            this.input = sourse;
            this.inputName = name;
            if (this.template.name !== 'null') {
                this.onSelectIsoFile();
            }
        },

        onIsoFile(sourse, name) {
            GcodeFixer.parseFix(sourse);
            this.functions = GcodeFixer.fix.functions;
            this.head = GcodeFixer.fix.head;
            this.end = GcodeFixer.fix.end;

            let current_datetime = new Date();
            let formatted_date = appendLeadingZeroes(current_datetime.getDate()) + "." + appendLeadingZeroes(current_datetime.getMonth() + 1) + "." + (current_datetime.getYear() - 100) + " " + appendLeadingZeroes(current_datetime.getHours()) + ":" + appendLeadingZeroes(current_datetime.getMinutes());

            var isoFile = {
                name: name,
                head: GcodeFixer.fix.head,
                functions: GcodeFixer.fix.functions,
                end: GcodeFixer.fix.end,
                updated: formatted_date,
            };
            this.addIsoFile(isoFile, name);
        },
        addIsoFile: function(isoFile, name) {
            Vue.set(this.isoFiles, name, isoFile);
            localStorage['isoFiles'] = JSON.stringify(this.isoFiles);
        },

        onSelectIsoFile: function() {
            this.downloads = [];
            this.usedFunctions = {};
            this.functions = this.template.functions;
            GcodeFixer.fix.functions = this.template.functions;
            this.head = this.template.head;
            this.end = this.template.end;

            if (this.input) {
                setTimeout(function() {
                    GcodeFixer.process(this.input, this.settings).forEach(function(part, key) {
                        if (key == 0) {
                            this.output = part;
                        }
                        var data = [];
                        data.push(this.head);
                        data.push(part);
                        data.push(Object.values(this.functions).join("\n"));
                        data.push(this.end);

                        this.downloads.push({
                            data: data.join("\n"),
                            title: (key + 1) + ' ' + Math.floor(part.length / 1024) + 'kb',
                            name: this.inputName + '_part-' + (key + 1)
                        });


                    }.bind(this));

                    this.usedFunctions = GcodeFixer.usedFunctions;

                    //
                    // parts.push(this.fix.head);
                    // parts.push(this.fixSource(sourse));
                    // parts.push(this.fix.end);
                    // parts.push("\n\n" + Object.values(this.fix.functions).join("\n\n"));
                    //
                    //
                    // this.output = GcodeFixer.process(this.input);

                }.bind(this), 10);

            }
        },
        deleteIsoFiles: function() {
            if (confirm('Ви точно хочете видалити всі шаблони')) {
                Object.keys(this.isoFiles).forEach(function(name) {
                    Vue.delete(this.isoFiles, name)
                }.bind(this));
                localStorage['isoFiles'] = JSON.stringify(this.isoFiles);
            }
        },
        deleteIsoFile: function(isoFile) {
            if (confirm('Ви точно хочете видалити ' + isoFile.name + '?')) {
                Vue.delete(this.isoFiles, isoFile.name);
            }
        },
        downloadPart: function(downloadPart) {
            var blob = new Blob([downloadPart.data], {type: 'application/iso'});
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = downloadPart.name + '.iso';
            link.click();
            URL.revokeObjectURL(link.href)
        }
    },
    computed: {
        isoFilesList: function() {
            return this.isoFiles;
        }
    },
    created: function() {
        if (localStorage.hasOwnProperty('isoFiles')) {
            var isoFiles = JSON.parse(localStorage['isoFiles']);
            Object.keys(isoFiles).forEach(function(name) {
                Vue.set(this.isoFiles, name, isoFiles[name]);
            }.bind(this));
        }
    },
    filters: {
        length: function(value) {
            return Math.floor(value.length / 1024);
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
        var filename = re.exec(file.name.toLowerCase());
        var ext = filename[1];
        if (ext === 'cnc') {
            var fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = function() {
                vueApp.onCncFile(fileReader.result, file.name.toLowerCase().replace('.' + filename[1], ''));
            };
        } else if (ext === 'iso') {
            var fileReader = new FileReader();
            fileReader.readAsText(file);
            fileReader.onload = function() {
                vueApp.onIsoFile(fileReader.result, file.name.toLowerCase().replace('.' + filename[1], ''));
            };
        }
    });
    return false;
};
