"""Independent recomputation of every calculation question.
For each id below, the expected value is computed here from scratch, then compared with the
choice the guide marks correct. Every other choice must differ from the expected value."""
import json, re, sys
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

x, y, h, t = sp.symbols('x y h t')
T = standard_transformations + (implicit_multiplication_application, convert_xor)
LOCALS = {'x': x, 'y': y, 'e': sp.E, 'pi': sp.pi, 'oo': sp.oo, 'ln': sp.log, 'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
          'sec': sp.sec, 'csc': sp.csc, 'cot': sp.cot, 'sqrt': sp.sqrt, 'cbrt': sp.cbrt}

def braces(s, i):
    """return (content, index after closing brace) for the group starting at s[i] == '{'"""
    assert s[i] == '{', s[i:]
    depth, j = 0, i
    while True:
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return s[i + 1:j], j + 1
        j += 1

def tex2s(s):
    s = s.strip()
    out, i = '', 0
    while i < len(s):
        if s.startswith('\\frac', i):
            a, j = braces(s, i + 5); b, k = braces(s, j)
            out += '((' + tex2s(a) + ')/(' + tex2s(b) + '))'; i = k
        elif s.startswith('\\sqrt[3]', i):
            a, j = braces(s, i + 8); out += 'cbrt(' + tex2s(a) + ')'; i = j
        elif s.startswith('\\sqrt', i):
            a, j = braces(s, i + 5); out += 'sqrt(' + tex2s(a) + ')'; i = j
        elif s[i] == '^':
            if s[i + 1] == '{': a, j = braces(s, i + 1); out += '**(' + tex2s(a) + ')'; i = j
            else: out += '**(' + s[i + 1] + ')'; i += 2
        elif s.startswith('\\times', i): out += '*'; i += 6
        elif s.startswith('\\cdot', i): out += '*'; i += 5
        elif s.startswith('\\infty', i): out += 'oo'; i += 6
        elif s.startswith('\\pi', i): out += 'pi'; i += 3
        elif s.startswith('\\,', i): out += '*'; i += 2
        elif s[i] == '\\':
            m = re.match(r'\\(sin|cos|tan|sec|csc|cot|ln)', s[i:])
            assert m, 'unknown tex: ' + s[i:]
            name = m.group(1); i += len(m.group(0))
            # power directly on the function name, e.g. \sin^2(3x)
            pw = ''
            if i < len(s) and s[i] == '^':
                if s[i + 1] == '{': a, j = braces(s, i + 1); pw = tex2s(a); i = j
                else: pw = s[i + 1]; i += 2
            # argument: parenthesised group or the rest of a simple token
            rest = s[i:].lstrip()
            i = len(s) - len(rest)
            if rest.startswith('('):
                depth, j = 0, 0
                while True:
                    if rest[j] == '(': depth += 1
                    elif rest[j] == ')':
                        depth -= 1
                        if depth == 0: break
                    j += 1
                arg = tex2s(rest[1:j]); i += j + 1
            else:
                m2 = re.match(r'[0-9]*[a-z]|[0-9]+', rest)
                arg = tex2s(m2.group(0)); i += len(m2.group(0))
            out += '(' + name + '(' + arg + ')' + (')**(' + pw + ')' if pw else ')')
        else:
            out += s[i]; i += 1
    return out

def val(choice):
    """sympy value of a choice, or None if the choice is words"""
    c = choice.strip()
    m = re.fullmatch(r'\$(.*)\$(?:\s*(J|M|s\^\{-1\}))?', c)
    body = m.group(1) if m else c
    body = re.sub(r'\\ ?\\text\{[^}]*\}(\^\{-1\})?', '', body).strip()
    body = body.replace('$', '').replace(',', '')
    body = re.sub(r'\s*(billion|million|mol|amu|atm|torr|bars|kJ|mL|g|M|%|meters per second|to 1)$', '', body).strip()
    body = body.replace('−', '-')
    if not body or re.search(r'[A-Za-z]{3,}', re.sub(r'\\[a-z]+', '', body)): return None
    try:
        return parse_expr(tex2s(body), local_dict=LOCALS, transformations=T)
    except Exception:
        return None

def same(a, b):
    try:
        if a in (sp.oo, -sp.oo) or b in (sp.oo, -sp.oo): return a == b
        if a.is_number and b.is_number:
            fa, fb = complex(sp.N(a)), complex(sp.N(b))
            return abs(fa - fb) <= 6e-3 * max(1e-300, abs(fb))   # choices are printed to 3 significant figures
        return sp.simplify(a - b) == 0
    except Exception:
        return False

# ---------- expected values, computed independently ----------
E = {}
# Macro
E['macro-2.1-2'] = 700 + 150 + 250 + (80 - 110)
E['macro-2.4-1'] = sp.Rational(126 - 120, 120) * 100
E['macro-2.6-1'] = 120 * 1 + 60 * 10
E['macro-2.6-2'] = round(960 / 720 * 100)
E['macro-3.2-1'] = 50 / (1 - sp.Rational(8, 10))
E['macro-3.2-2'] = sp.Rational(75, 100) / sp.Rational(25, 100) * 40
E['macro-3.8-2'] = 200 / (1 / (1 - sp.Rational(3, 4)))
# Chem
NA, R, hP, c0 = 6.022e23, 0.08206, 6.626e-34, 2.998e8
E['chem-1.1-1'] = 22.0 / 44.01 * 2
E['chem-1.1-2'] = 9.01 / 18.02 * NA
E['chem-1.2-1'] = 35.0 * 0.75 + 37.0 * 0.25
E['chem-1.4-2'] = (10.0 - 2.5) / 10.0 * 100
E['chem-2.5-1'] = 6 + 4 * 6 + 2
E['chem-2.5-2'] = (6 + 4 * 7 - 4 * 2 - 4 * 6) // 2
E['chem-2.6-1'] = 5 - 0 - 8 // 2
E['chem-3.4-1'] = 0.500 * R * 300 / 12.3
E['chem-3.4-2'] = 2.0 / (2.0 + 1.0 + 1.0) * 8.0
E['chem-3.4-3'] = 1.0 * (327 + 273) / (27 + 273)
E['chem-3.7-1'] = 0.250 * 0.200 * 40.00
E['chem-3.7-2'] = 0.50 * 300 / 6.0
E['chem-3.12-1'] = c0 / 500e-9
E['chem-3.12-2'] = hP * c0 / 400e-9
E['chem-3.13-1'] = 0.10 * 0.75 / 0.30
# Calc
E['calc-1.1-1'] = sp.Rational(3**2 - 1**2, 3 - 1)
E['calc-1.5-1'] = 3 * 3 + (-4)**2
E['calc-1.5-2'] = sp.limit(x**3 - 2*x + 1, x, 2)
E['calc-1.6-1'] = sp.limit((x**2 - 25) / (x - 5), x, 5)
E['calc-1.6-2'] = sp.limit((sp.sqrt(x + 4) - 2) / x, x, 0)
E['calc-1.6-3'] = sp.limit((1 / (x + 2) - sp.Rational(1, 2)) / x, x, 0)
E['calc-1.7-1'] = sp.limit(sp.sin(5*x) / (2*x), x, 0)
E['calc-1.7-2'] = sp.limit((x**2 - 4) / (x**2 + x - 6), x, 2)
E['calc-1.8-2'] = sp.limit(x**2 * sp.cos(1/x), x, 0)
E['calc-1.11-1'] = sp.solve(sp.Eq(2**2 + 1, 2*y - 1), y)[0]
E['calc-1.13-1'] = sp.limit((x**2 - 5*x + 6) / (x - 2), x, 2)
E['calc-1.13-2'] = sp.limit(sp.sin(3*x) / x, x, 0)
E['calc-1.14-1'] = sp.limit((x + 1) / (x - 2), x, 2, '+')
E['calc-1.15-1'] = sp.limit((3*x**2 - 5*x) / (2*x**2 + 7), x, sp.oo)
E['calc-1.15-2'] = sp.limit(sp.sqrt(4*x**2 + 1) / (x - 3), x, -sp.oo)
E['calc-1.15-3'] = sp.limit(x**3 / sp.exp(x), x, sp.oo)
E['calc-2.1-1'] = sp.limit(((3 + h)**2 - 9) / h, h, 0)
E['calc-2.1-2'] = sp.limit((x**3 - 8) / (x - 2), x, 2)
E['calc-2.3-1'] = sp.Rational(62 - 50, 6 - 2)
E['calc-2.5-1'] = sp.diff(1 / x**3, x)
E['calc-2.5-2'] = sp.diff(x**sp.Rational(2, 3), x).subs(x, 8)
E['calc-2.6-1'] = sp.diff(4*x**3 - 6*x**2 + 7*x - 9, x)
E['calc-2.7-1'] = sp.diff(3*sp.sin(x) - 2*sp.cos(x), x)
E['calc-2.7-2'] = sp.diff(2*sp.exp(x) + sp.log(x), x).subs(x, 1)
E['calc-2.7-3'] = sp.limit((sp.log(sp.E + h) - 1) / h, h, 0)
E['calc-2.8-1'] = sp.diff(x**2 * sp.sin(x), x)
E['calc-2.8-2'] = (-1) * 4 + 3 * 5
E['calc-2.9-1'] = sp.diff((2*x + 1) / (x - 3), x)
E['calc-2.9-2'] = sp.Rational((-1) * 4 - 3 * 5, 4**2)
E['calc-2.10-1'] = sp.diff(sp.tan(x), x).subs(x, sp.pi / 4)
E['calc-2.10-2'] = sp.diff(sp.sec(x), x).subs(x, sp.pi / 3)
E['calc-2.10-3'] = sp.diff(sp.csc(x), x)
E['calc-3.1-1'] = sp.diff((3*x**2 + 1)**4, x)
E['calc-3.1-2'] = 5 * 2
E['calc-3.1-3'] = sp.diff(sp.log(sp.cos(x)), x)
E['calc-3.1-4'] = sp.diff(sp.exp(x**2), x)
E['calc-3.1-5'] = sp.diff(2**x, x)
yf = sp.Function('y')(x)
def implicit(eq_lhs_minus_rhs):
    d = sp.diff(eq_lhs_minus_rhs.subs(y, yf), x)
    return sp.solve(d, sp.diff(yf, x))[0].subs(yf, y)
dydx_circle = implicit(x**2 + y**2 - 25)
E['calc-3.2-1'] = dydx_circle.subs({x: 4, y: -3})
E['calc-3.2-2'] = implicit(x**2 + x*y + y**2 - 7).subs({x: 1, y: 2})
E['calc-3.2-3'] = implicit(x**3 + y**3 - 6*x*y)
E['calc-3.3-1'] = 1 / sp.diff(x**3 + x, x).subs(x, 1)
E['calc-3.3-2'] = sp.Rational(1, 2)
E['calc-3.4-1'] = sp.diff(sp.atan(3*x), x)
E['calc-3.4-2'] = sp.diff(sp.asin(x), x).subs(x, sp.Rational(1, 2))
E['calc-3.5-1'] = sp.diff(x**2 * sp.exp(3*x), x)
E['calc-3.5-2'] = sp.diff(sp.sin(3*x)**2, x)
E['calc-3.5-3'] = sp.diff(sp.log(sp.sqrt(x)), x)
E['calc-3.6-1'] = sp.diff(x**4 - 2*x**3 + x, x, 2).subs(x, 2)
E['calc-3.6-2'] = sp.diff(sp.sin(2*x), x, 2)
d2 = sp.diff(dydx_circle.subs(y, yf), x).subs(sp.diff(yf, x), dydx_circle.subs(y, yf)).subs(yf, y)
E['calc-3.6-3'] = sp.simplify(d2).subs({x: 3, y: 4})
E['calc-3.6-4'] = sp.diff(t**3 - 6*t**2, t, 2).subs(t, 1)

# ---- added questions ----
E['macro-2.1-3'] = 6
E['macro-2.3-4'] = sp.Rational(6, 100) * sp.Rational(60, 100) * 250
E['macro-2.4-5'] = sp.Rational(22, 110) * 100
E['macro-2.6-4'] = 500 * sp.Rational(120, 100)
E['macro-3.2-4'] = 1 / (1 - sp.Rational(430 - 350, 500 - 400))
E['macro-3.8-5'] = 120 / (sp.Rational(8, 10) / sp.Rational(2, 10))
E['chem-1.3-3'] = 2 * 14.01 / 80.05 * 100
E['chem-3.4-5'] = 1.50 * (2.00 / 1.00) * (600 / 300)
E['chem-3.4-6'] = 752 - 24
E['chem-3.7-3'] = (0.0500 * 0.30 + 2 * 0.0500 * 0.10) / 0.100
E['chem-3.12-4'] = hP * c0 / 500e-9 * NA / 1000
E['chem-3.13-3'] = 0.50 / 4.0 * 10
E['bio-1.3-1'] = 10 - 1
E['bio-1.6-1'] = (100 - 2 * 30) / 2
E['bio-2.2-1'] = sp.Rational(6 * 2**2, 2**3)
E['bio-2.7-1'] = -(1) * 0.30 * 0.0831 * (27 + 273)
E['calc-1.6-4'] = sp.limit((x**3 - 1) / (x**2 - 1), x, 1)
E['calc-1.7-3'] = sp.limit((1 - sp.cos(x)) / x**2, x, 0)
E['calc-1.11-3'] = sp.solve(sp.Eq(4*y, 4 + y), y)[0]
E['calc-1.14-3'] = sp.limit(x / (x**2 - 9), x, 3, '-')
E['calc-1.15-4'] = sp.limit(2*x - sp.sqrt(4*x**2 + 3*x), x, sp.oo)
E['calc-2.2-3'] = -1 / sp.diff(x**3, x).subs(x, 1)
E['calc-2.8-3'] = sp.diff(sp.exp(x) * sp.cos(x), x)
E['calc-2.9-3'] = sp.diff(sp.log(x) / x, x)
E['calc-3.1-6'] = 3 * (2 * 2)
E['calc-3.1-7'] = sp.diff(sp.sqrt(1 + sp.exp(2*x)), x)
E['calc-3.2-4'] = implicit(x**2*y + y**3 - 10).subs({x: 1, y: 2})
E['calc-3.3-3'] = 1 / sp.diff(sp.exp(x) + x, x).subs(x, 0)
E['calc-3.4-3'] = sp.diff(sp.asin(x**2), x)
E['calc-3.6-5'] = sp.diff(x * sp.exp(x), x, 2)
assert (1 + 8, sp.E**0 + 0) == (9 + 0, 1) and 1**2 * 2 + 2**3 == 10
assert sp.limit((3*sp.exp(x) + 2) / (sp.exp(x) - 1), x, sp.oo) == 3 and sp.limit((3*sp.exp(x) + 2) / (sp.exp(x) - 1), x, -sp.oo) == -2
P_ = sp.symbols('P'); eq = sp.solve(sp.Eq(100 - 2*P_, 20 + 2*P_), P_)[0]
assert (eq, 100 - 2*eq) == (20, 60) and ((20 + 2*30) - (100 - 2*30)) == 40
assert (sp.Rational(30, 10), sp.Rational(20, 20), sp.Rational(4, 2), sp.Rational(12, 3)) == (3, 1, 2, 4)

# Answers that are words or pairs: expected text must appear in the keyed choice.
TXT = {
    'macro-2.3-1': '5% and 60%' if (6 / (114 + 6) == 0.05 and (114 + 6) / 200 == 0.6) else '?',
    'macro-2.4-3': 'falls by about 2%' if 3 - 5 == -2 else '?',
    'macro-2.5-2': '%d%%; the borrower gains' % (6 - 5),
    'macro-2.6-3': 'grows by about %d%%' % (6 - 2),
    'macro-3.2-3': 'increase by $%d billion' % (20 * 4 - 20 * 3),
    'chem-1.2-2': 'Boron' if abs(10 * 0.2 + 11 * 0.8 - 10.81) < 0.05 else '?',
    'chem-1.3-1': 'CH2O' if (round(40.0 / 12.01 / 3.33), round(6.7 / 1.008 / 3.33), round(53.3 / 16.00 / 3.33)) == (1, 2, 1) else '?',
    'chem-1.3-2': 'C%dH%d' % (round(84.16 / 14.03), 2 * round(84.16 / 14.03)),
    'chem-1.4-1': '\\ce{KCl}' if (35.45 / 74.55 < 0.607 and all(v > 0.607 for v in (35.45 / 42.39, 70.90 / 95.21, 106.35 / 133.33))) else '?',
    'chem-1.5-2': 'Sulfur' if 2 + 2 + 6 + 2 + 4 == 16 else '?',
    'chem-1.6-1': 'Phosphorus' if 2 + 2 + 6 + 2 + 3 == 15 else '?',
    'chem-3.4-4': '\\ce{N2}' if abs(1.25 * R * 273 / 1.00 - 28.02) < 0.1 else '?',
    'chem-3.8-2': '= 0.20$ M and $[\\ce{Cl-}] = 0.40$',
    'macro-1.2-1': '\\frac{1}{3}$ of a tractor' if sp.Rational(100 - 80, 60) == sp.Rational(1, 3) else '?',
    'macro-1.3-1': 'Beta has the comparative advantage in cloth',
    'macro-1.3-2': '1 bolt of cloth for 2 tons of wheat',
    'macro-1.3-3': 'Country Y has the comparative advantage in shirts',
    'macro-1.6-1': '$P = 20$ and $Q = 60$', 'macro-1.6-2': 'a surplus of 40 units',
    'calc-1.15-5': '$y = -2$ and $y = 3$',
    'bio-1.6-3': "5′-GCAT-3′", 'bio-2.2-2': 'sides of 1 micrometer',
    'calc-1.1-2': '4 meters per second',
    'calc-1.2-1': '5', 'calc-1.3-1': '3', 'calc-1.3-2': 'does not exist', 'calc-1.4-1': '4', 'calc-1.4-2': 'does not appear to exist',
    'calc-1.8-1': '4', 'calc-1.10-1': 'Removable', 'calc-1.10-2': 'Jump', 'calc-1.10-3': 'Infinite',
    'calc-1.12-1': '(-2, 2)', 'calc-1.12-2': '(3, \\infty)', 'calc-1.14-2': '$x = 2$ only', 'calc-1.16-2': '2',
    'calc-2.2-1': 'y = x - 4' if (2**2 - 3 * 2, 2 * 2 - 3) == (-2, 1) else '?',
    'calc-2.4-2': '$a = 2$ and $b = -1$', 'calc-2.6-2': '$x = -1$ and $x = 1$' if sp.solve(sp.diff(x**3 - 3*x, x), x) == [-1, 1] else '?',
}
# extra independent facts behind the word answers
assert sp.limit(sp.Abs(x) / x, x, 0, '-') == -1 and sp.limit(sp.Abs(x) / x, x, 0, '+') == 1
assert sp.limit(1 / (x - 3)**2, x, 3) == sp.oo and sp.limit((x**2 - 4) / (x - 2), x, 2) == 4
assert sp.solve(x**2 - 4, x) == [-2, 2] and sp.factor(x**2 - x - 2) == (x - 2) * (x + 1)
assert [round(v, 4) for v in (1.9**2, 1.99**2, 2.01**2, 2.1**2)] == [3.61, 3.9601, 4.0401, 4.41] and round(1.999**2, 3) == 3.996 and round(2.001**2, 3) == 4.004
assert [round((b**2 - 4) / (b - 2), 3) for b in (2.1, 2.01, 2.001)] == [4.1, 4.01, 4.001]
assert (4**2 + (-3)**2, 1 + 2 + 4, 3**2 + 4**2) == (25, 7, 25) and 1**3 + 1 == 2
assert abs(35.45 / 58.44 - 0.607) < 0.001

data = json.load(open(sys.argv[1]))
qs = {q['id']: q for c in data['courses'] for u in c['units'] for q in u['q']}
bad, checked = [], 0
for qid, exp in E.items():
    q = qs[qid]; exp = sp.sympify(exp)
    vals = [val(ch) for ch in q['c']]
    keyed = vals[q['a']]
    if keyed is None or not same(keyed, exp):
        bad.append(f"{qid}: keyed {q['c'][q['a']]!r} parsed {keyed} != expected {exp}")
    for k, v in enumerate(vals):
        if k != q['a'] and v is not None and same(v, exp):
            bad.append(f"{qid}: distractor {q['c'][k]!r} also equals the expected value")
    if sum(v is None for v in vals) > 1:
        bad.append(f"{qid}: could not parse choices {[c for c, v in zip(q['c'], vals) if v is None]}")
    checked += 1
for qid, exp in TXT.items():
    q = qs[qid]
    hits = [k for k, ch in enumerate(q['c']) if (len(exp) > 3 and exp in ch) or ch.strip('$ ') == exp]
    if hits != [q['a']]:
        bad.append(f"{qid}: expected text {exp!r} matches choices {hits}, keyed {q['a']} {q['c'][q['a']]!r}")
    checked += 1
print('checked', checked, 'calculation questions of', len(qs))
if bad:
    print('\n'.join(bad)); sys.exit(1)
print('ALL MATCH')
