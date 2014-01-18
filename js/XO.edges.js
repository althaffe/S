var X = (function () {
    "use strict";

    var count = 1,
        consumer = 0,
        edges = [],
        updaters = [],
        bundler = noop;

    // initializer
    X.lift     = lift;

    X.val      = val;
    X.proc     = proc;
    X.bundle   = bundle;
    X.peek     = peek;
    X.sub      = sub;

    // modifiers
    X.detach   = detach;
    X.defer    = defer;
    X.throttle = throttle;
    X.debounce = debounce;

    return X;

    function X(arg1, arg2) {
        return X.lift(arg1, arg2);
    }

    function lift(arg1, arg2) {
        return typeof arg1 === 'function' ? proc(arg1, arg2)
            : arg1 instanceof Array ? X.seq(arg1)
            : val(arg1);
    }

    function val(value) {
        var id = count++,
            propagate = propagateImmediately;

        edges[id] = {};

        val.out = out;

        bundler(val);

        return val;

        function val(set_value) {
            if (arguments.length > 0) {
                if (value !== set_value) {
                    value = set_value;
                    propagate(id);
                }
            } else {
                addEdge(id);
            }
            return value;
        }

        function out(mod) {
            propagate = mod(propagate);

            return val;
        }
    }

    function proc(get, set) {
        var id = count++,
            propagate = propagateImmediately,
            updating = false,
            value;

        edges[id] = {};
        updaters[id] = update;

        proc.in = _in;
        proc.out = out;

        bundler(proc);

        update();

        return proc;

        function proc(setValue) {
            var _consumer;

            if (arguments.length > 0) {
                if (set) {
                    _consumer = consumer;
                    consumer = 0;
                    try {
                        set(setValue);
                    } finally {
                        consumer = _consumer;
                    }
                }
            } else {
                addEdge(id);
            }

            return value;
        }

        function _in(mod) {
            updaters[id] = mod(updaters[id]);

            return proc;
        }

        function out(mod) {
            propagate = mod(propagate);

            return proc;
        }

        function update() {
            var newValue,
                _consumer;

            if (!updating) {
                updating = true;
                _consumer = consumer;
                consumer = id;

                try {
                    newValue = get();
                } finally {
                    consumer = _consumer;
                    updating = false;
                }

                if (value !== newValue) {
                    value = newValue;
                    propagate(id);
                }
            }
        }
    }

    function addEdge(source) {
        if (consumer) {
            edges[source][consumer] = true;
        }
    }

    function propagateImmediately(source) {
        var consumers = edges[source],
            consumer;

        edges[source] = {};

        for (consumer in consumers) {
            updaters[consumer]();
        }
    }

    function bundle(fn) {
        var inMods = identity,
            outMods = identity,
            bundle = {
                in: _in,
                out: out,
                watch: watch
            };

        if (fn) watch(fn);

        return bundle;

        function watch(fn) {
            var _bundler = bundler;
            bundler = add;

            try {
                fn();
            } finally {
                bundler = _bundler;
            }

            function add(node) {
                if (node.in) node.in(inModer);
                if (node.out) node.out(outModer);
                _bundler(node);
            }
        }

        function _in(mod) {
            inMods = compose(inMods, mod);

            return bundle;
        }

        function out(mod) {
            outMods = compose(outMods, mod);

            return bundle;
        }

        function inModer(fn) {
            return function (x) {
                (inMods(fn))(x);
            }
        }

        function outModer(fn) {
            return function (x) {
                (outMods(fn))(x);
            }
        }
    }

    function peek(fn) {
        var _consumer = consumer;
        consumer = 0;

        try {
            return fn();
        } finally {
            consumer = _consumer;
        }
    }

    function sub(/* arg1, arg2, ... argn, fn */) {
        var args = arguments.slice(),
            fn = noop,
            realFn = args.pop(),
            sub = proc(function () {
                var values = [],
                    i;

                for (i = 0; i < args.length; i++) {
                    values.push(args[i]());
                }

                return X.peek(function () {
                    return fn.apply(undefined, values);
                });
            });

        fn = realFn;

        return sub;
    }

    // in/out modifiers
    function detach(fn) {
        return noop;
    }

    function defer(fn) {
        return function (id) {
            setTimeout(fn, 0, id);
        };
    }

    function throttle(delay) {
        return function (fn) {
            var last = 0,
                scheduled = false;

            return function (id) {
                if (scheduled) return;

                var now = Date.now();

                if ((now - last) >= delay) {
                    last = now;
                    fn(id);
                } else {
                    scheduled = true;
                    setTimeout(function () {
                        last += delay;
                        scheduled = false;
                        fn(id);
                    }, delay - (now - last));
                }
            };
        };
    }

    function debounce(delay) {
        return function (fn) {
            var tout = 0;

            return function (id) {
                if (tout) clearTimeout(tout);

                tout = setTimeout(fn, delay, id);
            };
        };
    }

    function compose(g, f) {
        return function (x) {
            return g(f(x));
        };
    }

    function noop() { }

    function identity(x) { return x; }
}());