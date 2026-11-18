// Minimal in-browser test runner: describe / it / expect.
(function () {
  var suites = [], current = null;
  window.describe = function (name, fn) { current = { name: name, tests: [] }; suites.push(current); fn(); current = null; };
  window.it = function (name, fn) { current.tests.push({ name: name, fn: fn }); };
  function fmt(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  window.expect = function (actual) {
    function make(neg) {
      function assert(ok, msg) { if (neg ? ok : !ok) throw new Error((neg ? "NOT " : "") + msg); }
      return {
        toBe: function (e) { assert(actual === e, "expected " + fmt(actual) + " to be " + fmt(e)); },
        toEqual: function (e) { assert(fmt(actual) === fmt(e), "expected " + fmt(actual) + " to equal " + fmt(e)); },
        toContain: function (e) { assert(actual != null && actual.indexOf(e) >= 0, "expected " + fmt(actual) + " to contain " + fmt(e)); },
        toBeTruthy: function () { assert(!!actual, "expected " + fmt(actual) + " to be truthy"); },
        toBeFalsy: function () { assert(!actual, "expected " + fmt(actual) + " to be falsy"); },
        toHaveLength: function (n) { assert(actual.length === n, "expected length " + actual.length + " to be " + n); }
      };
    }
    var o = make(false);
    o.not = make(true);
    return o;
  };
  window.runTests = function (out) {
    var pass = 0, fail = 0, html = "";
    suites.forEach(function (s) {
      html += "<h2>" + s.name + "</h2><ul>";
      s.tests.forEach(function (t) {
        try { t.fn(); pass++; html += "<li class='pass'>✅ " + t.name + "</li>"; }
        catch (e) { fail++; html += "<li class='fail'>❌ " + t.name + " — " + String(e.message).replace(/</g, "&lt;") + "</li>"; }
      });
      html += "</ul>";
    });
    out.innerHTML = "<h1 id='summary' class='" + (fail ? "fail" : "pass") + "'>" + (fail ? "FAIL" : "PASS") + ": " + pass + " passed, " + fail + " failed</h1>" + html;
    document.title = (fail ? "FAIL " : "PASS ") + pass + "/" + (pass + fail);
    window.__testResult = { pass: pass, fail: fail };
  };
})();
